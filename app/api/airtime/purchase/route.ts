import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { decryptSecret } from "@/lib/secret-encryption";

const NETWORKS = ["mtn", "airtel", "glo", "9mobile"] as const;
type Network = (typeof NETWORKS)[number];
type Service = "airtime" | "data";

type ProviderPayload = {
  status?: string;
  message?: string;
  data?: {
    status?: string;
    reference?: string;
    clientReference?: string;
    mobileNumber?: string;
    amount?: number | string;
  };
};

function jsonError(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

async function getExchangeRate(settings: {
  exchangeRateSource: string;
  exchangeRateOverride: Prisma.Decimal | null;
}) {
  if (settings.exchangeRateSource === "MANUAL") {
    const rate = Number(settings.exchangeRateOverride);
    return Number.isFinite(rate) && rate > 0 ? rate : null;
  }

  try {
    const response = await fetch("https://open.er-api.com/v6/latest/EUR", {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;

    const result = await response.json();
    const rate = Number(result?.rates?.NGN);

    return result?.result === "success" && Number.isFinite(rate) && rate > 0
      ? rate
      : null;
  } catch {
    return null;
  }
}

async function refundDefinitiveFailure(
  orderId: string,
  userId: string,
  reference: string,
  amountEur: Prisma.Decimal,
  service: Service,
  providerPayload: ProviderPayload
) {
  const description = `${service === "data" ? "Data" : "Airtime"} purchase ${reference}`;

  return prisma.$transaction(
    async (tx) => {
      const debit = await tx.transaction.findFirst({
        where: {
          userId,
          walletType: "REFERRAL",
          type: "DEBIT",
          description,
          status: "PENDING",
        },
        select: { id: true },
      });

      if (!debit) {
        throw new Error("PENDING_REFERRAL_DEBIT_NOT_FOUND");
      }

      const updated = await tx.airtimeOrder.updateMany({
        where: {
          id: orderId,
          status: "PENDING",
          walletDebitedAt: { not: null },
          refundedAt: null,
          deliveredAt: null,
        },
        data: {
          status: "FAILED",
          providerStatus: "failed",
          providerReference: providerPayload.data?.reference ?? null,
          providerResponse: providerPayload as Prisma.InputJsonValue,
          failureReason: providerPayload.message || "Provider confirmed failure.",
          refundedAt: new Date(),
        },
      });

      if (updated.count !== 1) return false;

      const ledgerUpdate = await tx.transaction.updateMany({
        where: { id: debit.id, status: "PENDING" },
        data: { status: "REFUNDED" },
      });

      if (ledgerUpdate.count !== 1) {
        throw new Error("REFERRAL_LEDGER_UPDATE_CONFLICT");
      }

      await tx.wallet.update({
        where: { userId },
        data: { referralBalance: { increment: amountEur } },
      });

      await tx.transaction.create({
        data: {
          userId,
          walletType: "REFERRAL",
          type: "CREDIT",
          category: service === "data" ? "DATA_REFUND" : "AIRTIME_REFUND",
          description: `Refund for ${description}`,
          amount: amountEur,
          status: "COMPLETED",
        },
      });

      return true;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10000,
      timeout: 20000,
    }
  );
}

export async function POST(request: NextRequest) {
  if (process.env.AIRTIME_PURCHASES_ENABLED !== "true") {
    return jsonError("Purchases are temporarily unavailable.", 503);
  }

  const cookieStore = await cookies();
  const session = cookieStore.get("streamdao_session")?.value;
  const userId = session ? await verifySession(session) : null;

  if (!userId) return jsonError("Unauthorized.", 401);

  let body: {
    requestId?: string;
    service?: string;
    network?: string;
    phoneNumber?: string;
    amountNgn?: number | string;
    serviceId?: string;
  };

  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request body.", 400);
  }

  const requestId = body.requestId?.trim();
  const service = body.service?.toLowerCase() as Service;
  const network = body.network?.toLowerCase() as Network;
  const serviceId = body.serviceId?.trim();
  const phoneDigits = (body.phoneNumber ?? "").replace(/\D/g, "");

  if (
    !requestId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)
  ) {
    return jsonError("A valid request ID is required.", 400);
  }

  if (!["airtime", "data"].includes(service)) {
    return jsonError("Invalid purchase service.", 400);
  }

  if (!NETWORKS.includes(network)) {
    return jsonError("Invalid network.", 400);
  }

  if (!serviceId && service === "data") {
    return jsonError("Select a valid data plan.", 400);
  }

  if (
    !/^0[789][01]\d{8}$/.test(phoneDigits) &&
    !/^234[789][01]\d{8}$/.test(phoneDigits)
  ) {
    return jsonError("Enter a valid Nigerian mobile number.", 400);
  }

  const mobileNumber = phoneDigits.startsWith("0")
    ? `234${phoneDigits.slice(1)}`
    : phoneDigits;

  const reference = `SD_${requestId}`;

  try {
    const existingOrder = await prisma.airtimeOrder.findUnique({
      where: { reference },
    });

    if (existingOrder) {
      if (existingOrder.userId !== userId) {
        return jsonError("Request reference conflict.", 409);
      }

      return NextResponse.json({
        success: true,
        duplicate: true,
        reference: existingOrder.reference,
        status: existingOrder.status,
        message: "This purchase request has already been received.",
      });
    }

    const [user, settings, providerSettings] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { airtimePurchaseLimitNgn: true },
      }),
      prisma.airtimeSettings.findUnique({ where: { id: "default" } }),
      prisma.couponSettings.findUnique({
        where: { id: "default" },
        select: { topupWizardTokenEncrypted: true },
      }),
    ]);

    if (!user) return jsonError("User not found.", 404);
    if (!settings) return jsonError("Purchase settings are unavailable.", 503);

    const serviceEnabled = service === "airtime"
      ? settings.airtimeEnabled
      : settings.dataEnabled;

    if (!serviceEnabled) return jsonError("This service is currently disabled.", 403);

    const networkEnabled = {
      mtn: settings.mtnEnabled,
      airtel: settings.airtelEnabled,
      glo: settings.gloEnabled,
      "9mobile": settings.nineMobileEnabled,
    }[network];

    if (!networkEnabled) return jsonError("This network is currently unavailable.", 403);

    if (!providerSettings?.topupWizardTokenEncrypted) {
      return jsonError("Provider credentials are not configured.", 503);
    }

    const providerToken = decryptSecret(providerSettings.topupWizardTokenEncrypted);

    let amountNgn: Prisma.Decimal;
    let resolvedServiceId = serviceId ?? "";

    if (service === "data") {
      const plan = await prisma.airtimePlan.findFirst({
        where: {
          serviceId: resolvedServiceId,
          network,
          type: { in: ["sme", "cg", "direct"], mode: "insensitive" },
          isActive: true,
        },
      });

      if (!plan) return jsonError("Selected data plan is unavailable.", 400);
      amountNgn = new Prisma.Decimal(plan.amountNgn);
    } else {
      const requestedAmount = new Prisma.Decimal(String(body.amountNgn ?? ""));

      if (!requestedAmount.isFinite() || requestedAmount.lessThanOrEqualTo(0)) {
        return jsonError("Enter a valid Airtime amount.", 400);
      }

      amountNgn = requestedAmount;

      const pricingResponse = await fetch("https://topupwizard.com/api/pricing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization-Token": providerToken,
          Accept: "application/json",
        },
        body: JSON.stringify({ type: "airtime", typeSingle: network }),
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      });

      if (!pricingResponse.ok) {
        return jsonError("Unable to verify provider Airtime service.", 502);
      }

      const pricingPayload = await pricingResponse.json();
      const pricingItems = Array.isArray(pricingPayload?.data)
        ? pricingPayload.data
        : [pricingPayload?.data];

      const airtimeService = pricingItems.find((item: {
        network?: string;
        type?: string;
        serviceID?: string | number;
        isActive?: boolean;
      }) =>
        item?.network?.toLowerCase() === network &&
        item?.type?.toLowerCase() === "airtime" &&
        item?.isActive === true &&
        item?.serviceID !== undefined
      );

      if (pricingPayload?.status?.toLowerCase() !== "success" || !airtimeService) {
        return jsonError("Provider Airtime service is unavailable.", 502);
      }

      resolvedServiceId = String(airtimeService.serviceID);
    }

    const minimum = new Prisma.Decimal(
      service === "data" ? settings.minimumDataAmountNgn : settings.minimumAmountNgn
    );
    const maximum = new Prisma.Decimal(
      service === "data" ? settings.maximumDataAmountNgn : settings.maximumAmountNgn
    );

    if (amountNgn.lessThan(minimum) || amountNgn.greaterThan(maximum)) {
      return jsonError("Purchase amount is outside the permitted range.", 400);
    }

    if (
      user.airtimePurchaseLimitNgn &&
      amountNgn.greaterThan(user.airtimePurchaseLimitNgn)
    ) {
      return jsonError("Purchase exceeds your personal transaction limit.", 400);
    }

    const exchangeRate = await getExchangeRate(settings);

    if (!exchangeRate) {
      return jsonError("Exchange rate is unavailable. Please try again.", 503);
    }

    const markupPercent = new Prisma.Decimal(settings.markupPercent);
    const markupNgn = amountNgn.mul(markupPercent).div(100).toDecimalPlaces(2);
    const totalNgn = amountNgn.plus(markupNgn);
    const amountEur = totalNgn.div(exchangeRate).toDecimalPlaces(2);

    if (amountEur.lessThanOrEqualTo(0)) {
      return jsonError("Unable to calculate purchase price.", 400);
    }

    const description = `${service === "data" ? "Data" : "Airtime"} purchase ${reference}`;
    const now = new Date();
    const cooldownStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const order = await prisma.$transaction(
      async (tx) => {
        const recentSuccess = await tx.airtimeOrder.findFirst({
          where: {
            userId,
            deliveredAt: { gte: cooldownStart },
          },
          select: { id: true },
        });

        if (recentSuccess) throw new Error("PURCHASE_COOLDOWN");

        await tx.wallet.upsert({
          where: { userId },
          create: { userId },
          update: {},
        });

        const debit = await tx.wallet.updateMany({
          where: {
            userId,
            referralBalance: { gte: amountEur },
          },
          data: {
            referralBalance: { decrement: amountEur },
          },
        });

        if (debit.count !== 1) throw new Error("INSUFFICIENT_REFERRAL_BALANCE");

        const createdOrder = await tx.airtimeOrder.create({
          data: {
            reference,
            userId,
            network,
            type: service,
            serviceId: resolvedServiceId,
            phoneNumber: mobileNumber,
            amountNgn,
            markupNgn,
            exchangeRate: new Prisma.Decimal(exchangeRate),
            amountEur,
            status: "PENDING",
            providerStatus: "SUBMITTING",
            walletDebitedAt: now,
          },
        });

        await tx.transaction.create({
          data: {
            userId,
            walletType: "REFERRAL",
            type: "DEBIT",
            category: service === "data" ? "DATA_PURCHASE" : "AIRTIME_PURCHASE",
            description,
            amount: amountEur,
            status: "PENDING",
          },
        });

        return createdOrder;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10000,
        timeout: 20000,
      }
    );

    const providerEndpoint = service === "data"
      ? "https://topupwizard.com/api/data"
      : "https://topupwizard.com/api/airtime";

    const providerBody = service === "data"
      ? {
          serviceID: resolvedServiceId,
          mobileNumber,
          clientReference: reference,
          bypassMobileValidator: "false",
        }
      : {
          serviceID: resolvedServiceId,
          amount: amountNgn.toFixed(2),
          mobileNumber,
          clientReference: reference,
          bypassMobileValidator: "false",
        };

    let providerPayload: ProviderPayload | null = null;

    try {
      const providerResponse = await fetch(providerEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization-Token": providerToken,
          Accept: "application/json",
        },
        body: JSON.stringify(providerBody),
        cache: "no-store",
        signal: AbortSignal.timeout(25000),
      });

      providerPayload = await providerResponse.json() as ProviderPayload;

      const responseStatus = providerPayload.status?.toLowerCase();
      const providerOrderStatus = providerPayload.data?.status?.toLowerCase();
      const returnedClientReference = providerPayload.data?.clientReference?.trim();
      const returnedProviderReference = providerPayload.data?.reference?.trim();

      // Never trust a provider response that cannot be tied to this exact order.
      if (
        returnedClientReference !== reference ||
        !returnedProviderReference
      ) {
        await prisma.airtimeOrder.updateMany({
          where: { id: order.id, status: "PENDING" },
          data: {
            providerStatus: "UNKNOWN",
            providerResponse: providerPayload as Prisma.InputJsonValue,
          },
        });

        return NextResponse.json({
          success: true,
          reference,
          status: "PENDING",
          message: "The provider response could not be verified. Your order remains pending reconciliation.",
        }, { status: 202 });
      }

      // Refund only when TopupWizard explicitly reports a failed transaction.
      if (
        ["success", "error", "failed"].includes(responseStatus ?? "") &&
        providerOrderStatus === "failed"
      ) {
        const refunded = await refundDefinitiveFailure(
          order.id,
          userId,
          reference,
          amountEur,
          service,
          providerPayload
        );

        if (refunded) {
          return NextResponse.json({
            success: false,
            reference,
            status: "FAILED",
            refunded: true,
            message: "Provider confirmed failure. Your Referral Balance has been refunded.",
          });
        }

        const currentOrder = await prisma.airtimeOrder.findUnique({
          where: { id: order.id },
          select: { status: true },
        });

        return NextResponse.json({
          success: true,
          reference,
          status: currentOrder?.status ?? "PENDING",
          message: "The order was already being finalized. Check its current status before retrying.",
        }, { status: 202 });
      }

      // A successful submission is not proof of delivery.
      // Keep it pending until the authenticated callback confirms the result.
      await prisma.airtimeOrder.updateMany({
        where: { id: order.id, status: "PENDING" },
        data: {
          providerStatus: providerOrderStatus?.toUpperCase() ?? "UNKNOWN",
          providerReference: returnedProviderReference,
          providerResponse: providerPayload as Prisma.InputJsonValue,
        },
      });

      return NextResponse.json({
        success: true,
        reference,
        status: "PENDING",
        message: "Your purchase has been submitted and is awaiting delivery confirmation.",
      }, { status: 202 });
    } catch (providerError) {
      console.error("TopupWizard submission outcome is unknown:", providerError);

      await prisma.airtimeOrder.updateMany({
        where: { id: order.id, status: "PENDING" },
        data: { providerStatus: "UNKNOWN" },
      });

      return NextResponse.json({
        success: true,
        reference,
        status: "PENDING",
        message: "Your order is awaiting provider confirmation. Do not submit it again.",
      }, { status: 202 });
    }
  } catch (error) {
    if (error instanceof Error && error.message === "PURCHASE_COOLDOWN") {
      return jsonError("You can make one successful Airtime or Data purchase every 24 hours.", 429);
    }

    if (error instanceof Error && error.message === "INSUFFICIENT_REFERRAL_BALANCE") {
      return jsonError("Insufficient Referral Balance.", 400);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.airtimeOrder.findUnique({
        where: { reference: `SD_${String((await request.clone().json().catch(() => ({}))).requestId ?? "")}` },
      });

      if (existing?.userId === userId) {
        return NextResponse.json({
          success: true,
          duplicate: true,
          reference: existing.reference,
          status: existing.status,
        });
      }

      return jsonError("This purchase request is already being processed.", 409);
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return jsonError("Your wallet changed during checkout. Please retry.", 409);
    }

    console.error("Airtime purchase error:", error);
    return jsonError("Unable to process this purchase.", 500);
  }
}

