import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";

export async function GET() {
  try {

    const cookieStore = await cookies();
    const token = cookieStore.get("streamdao_session")?.value;
    const userId = token ? await verifySession(token) : null;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [user, settings] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          airtimePurchaseLimitNgn: true,
          wallet: {
            select: { referralBalance: true },
          },
        },
      }),
      prisma.airtimeSettings.upsert({
        where: { id: "default" },
        create: { id: "default" },
        update: {},
      }),
    ]);

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    // Account-wide 24-hour cooldown, based only on successful delivery.
    const lastSuccessfulOrder = await prisma.airtimeOrder.findFirst({
      where: {
        userId,
        deliveredAt: { not: null },
      },
      orderBy: { deliveredAt: "desc" },
      select: {
        deliveredAt: true,
        reference: true,
      },
    });

    const cooldownDurationMs = 24 * 60 * 60 * 1000;
    const lastSuccessfulPurchaseAt = lastSuccessfulOrder?.deliveredAt ?? null;
    const nextPurchaseAt = lastSuccessfulPurchaseAt
      ? new Date(lastSuccessfulPurchaseAt.getTime() + cooldownDurationMs)
      : null;
    const remainingMs = nextPurchaseAt
      ? Math.max(0, nextPurchaseAt.getTime() - Date.now())
      : 0;

    const networkAvailability = {
      mtn: settings.mtnEnabled,
      airtel: settings.airtelEnabled,
      glo: settings.gloEnabled,
      "9mobile": settings.nineMobileEnabled,
    };

    const enabledNetworks = Object.entries(networkAvailability)
      .filter(([, enabled]) => enabled)
      .map(([network]) => network);

    const plans = settings.dataEnabled && enabledNetworks.length > 0
      ? await prisma.airtimePlan.findMany({
          where: {
            type: { in: ["sme", "cg", "direct"], mode: "insensitive" },
            isActive: true,
            network: { in: enabledNetworks, mode: "insensitive" },
          },
          orderBy: [
            { network: "asc" },
            { amountNgn: "asc" },
          ],
          select: {
            id: true,
            serviceId: true,
            network: true,
            type: true,
            name: true,
            amountNgn: true,
            validity: true,
            description: true,
          },
        })
      : [];

    let exchangeRate: number | null = null;

    if (settings.exchangeRateSource === "MANUAL") {
      exchangeRate = settings.exchangeRateOverride
        ? Number(settings.exchangeRateOverride)
        : null;
    } else {
      try {
        const response = await fetch(
          "https://open.er-api.com/v6/latest/EUR",
          {
            cache: "no-store",
            signal: AbortSignal.timeout(10000),
          }
        );

        if (response.ok) {
          const result = await response.json();
          const rate = Number(result?.rates?.NGN);

          if (result?.result === "success" && Number.isFinite(rate) && rate > 0) {
            exchangeRate = rate;
          }
        }
      } catch {
        exchangeRate = null;
      }
    }

    return NextResponse.json({
      success: true,
      balance: {
        referralBalance: user.wallet?.referralBalance.toString() ?? "0",
        currency: "EUR",
      },
      cooldown: {
        durationHours: 24,
        isCoolingDown: remainingMs > 0,
        lastSuccessfulPurchaseAt: lastSuccessfulPurchaseAt?.toISOString() ?? null,
        nextPurchaseAt: nextPurchaseAt?.toISOString() ?? null,
        remainingMs,
      },
      purchaseLimitNgn: user.airtimePurchaseLimitNgn?.toString() ?? null,
      services: {
        airtimeEnabled: settings.airtimeEnabled,
        dataEnabled: settings.dataEnabled,
      },
      networks: networkAvailability,
      pricing: {
        minimumAmountNgn: settings.minimumAmountNgn.toString(),
        maximumAmountNgn: settings.maximumAmountNgn.toString(),
        minimumDataAmountNgn: settings.minimumDataAmountNgn.toString(),
        maximumDataAmountNgn: settings.maximumDataAmountNgn.toString(),
        markupPercent: settings.markupPercent.toString(),
        exchangeRateSource: settings.exchangeRateSource,
        exchangeRateNgnPerEur: exchangeRate,
      },
      plans: plans.map((plan) => ({
        ...plan,
        amountNgn: plan.amountNgn.toString(),
      })),
    });
  } catch (error) {
    console.error("Airtime configuration error:", error);

    return NextResponse.json(
      { error: "Unable to load Airtime and Data services." },
      { status: 500 }
    );
  }
}




