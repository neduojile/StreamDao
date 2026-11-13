import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Payload = {
  status?: string;
  message?: string;
  data?: {
    type?: string;
    reference?: string;
    clientReference?: string;
  };
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ secret: string }> }
) {
  const { secret } = await params;
  const expected = process.env.TOPUPWIZARD_WEBHOOK_SECRET;

  if (!expected) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  }

  const supplied = Buffer.from(secret);
  const configured = Buffer.from(expected);

  if (
    supplied.length !== configured.length ||
    !timingSafeEqual(supplied, configured)
  ) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: Payload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const status = payload.status?.toLowerCase();
  const clientReference = payload.data?.clientReference?.trim();
  const providerReference = payload.data?.reference?.trim();
  const providerType = payload.data?.type?.toLowerCase();

  if (
    !["success", "failed"].includes(status ?? "") ||
    !clientReference ||
    !providerReference ||
    !["airtime", "data"].includes(providerType ?? "")
  ) {
    return NextResponse.json({ error: "Invalid callback payload." }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const order = await tx.airtimeOrder.findUnique({
          where: { reference: clientReference },
        });

        if (!order) return { error: "Order not found.", code: 404 };

        if (order.type.toLowerCase() !== providerType) {
          return { error: "Order type mismatch.", code: 400 };
        }

        if (order.providerReference && order.providerReference !== providerReference) {
          return { error: "Provider reference mismatch.", code: 409 };
        }

        const existingProviderOrder = await tx.airtimeOrder.findFirst({
          where: {
            providerReference,
            NOT: { id: order.id },
          },
          select: { id: true },
        });

        if (existingProviderOrder) {
          return { error: "Provider reference already used.", code: 409 };
        }

        if (order.status === "SUCCESS" && order.deliveredAt) {
          return status === "success"
            ? { received: true, duplicate: true, status: "success" }
            : { error: "Conflicting callback for a completed order.", code: 409 };
        }

        if (order.status === "FAILED" && order.refundedAt) {
          return status === "failed"
            ? { received: true, duplicate: true, status: "failed" }
            : { error: "Conflicting callback for a failed order.", code: 409 };
        }

        if (
          order.status !== "PENDING" ||
          !order.walletDebitedAt ||
          order.deliveredAt ||
          order.refundedAt
        ) {
          return { error: "Order is not awaiting confirmation.", code: 409 };
        }

        const description =
          `${providerType === "data" ? "Data" : "Airtime"} purchase ${order.reference}`;

        const debit = await tx.transaction.findFirst({
          where: {
            userId: order.userId,
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

        const now = new Date();

        const updated = await tx.airtimeOrder.updateMany({
          where: {
            id: order.id,
            status: "PENDING",
            walletDebitedAt: { not: null },
            deliveredAt: null,
            refundedAt: null,
          },
          data: {
            status: status === "success" ? "SUCCESS" : "FAILED",
            providerStatus: status,
            providerReference,
            providerResponse: payload as Prisma.InputJsonValue,
            ...(status === "success"
              ? { deliveredAt: now }
              : {
                  failureReason:
                    payload.message || "Provider reported transaction failure.",
                  refundedAt: now,
                }),
          },
        });

        if (updated.count !== 1) {
          throw new Error("ORDER_UPDATE_CONFLICT");
        }

        const ledgerUpdate = await tx.transaction.updateMany({
          where: {
            id: debit.id,
            status: "PENDING",
          },
          data: { status: status === "success" ? "COMPLETED" : "REFUNDED" },
        });

        if (ledgerUpdate.count !== 1) {
          throw new Error("REFERRAL_LEDGER_UPDATE_CONFLICT");
        }

        if (status === "success") {
          return { received: true, status: "success" };
        }

        await tx.wallet.update({
          where: { userId: order.userId },
          data: { referralBalance: { increment: order.amountEur } },
        });

        await tx.transaction.create({
          data: {
            userId: order.userId,
            walletType: "REFERRAL",
            type: "CREDIT",
            category: providerType === "data" ? "DATA_REFUND" : "AIRTIME_REFUND",
            description: `Refund for ${description}`,
            amount: order.amountEur,
            status: "COMPLETED",
          },
        });

        return { received: true, status: "failed", refunded: true };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10000,
        timeout: 20000,
      }
    );

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.code }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("TopupWizard webhook processing failed.");
    return NextResponse.json(
      { error: "Callback processing failed. Please retry." },
      { status: 500 }
    );
  }
}
