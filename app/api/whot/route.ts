import { NextRequest, NextResponse, connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";
import { ensureWhotConfiguration, getLagosDayKey } from "@/lib/whot";

export async function GET(request: NextRequest) {
  await connection();

  try {
    const token = request.cookies.get("streamdao_session")?.value;
    if (!token) {
      return NextResponse.json({ error: "Please log in." }, { status: 401 });
    }

    const userId = await verifySession(token);
    if (!userId) {
      return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
    }

    const { settings, prizes } = await ensureWhotConfiguration();
    const dayKey = getLagosDayKey();

    const [user, spinsToday, recentSpins] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          wallet: { select: { whotBalance: true } },
        },
      }),
      prisma.whotSpin.count({
        where: { userId, dayKey },
      }),
      prisma.whotSpin.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          prizeLabel: true,
          reward: true,
          createdAt: true,
          spinNumber: true,
        },
      }),
    ]);

    if (!user) {
      return NextResponse.json({ error: "User account not found." }, { status: 404 });
    }

    return NextResponse.json({
      enabled: settings.isEnabled,
      dailySpinLimit: settings.dailySpinLimit,
      spinsUsed: spinsToday,
      remainingSpins: Math.max(0, settings.dailySpinLimit - spinsToday),
      balance: user.wallet?.whotBalance.toString() ?? "0.00",
      prizes: prizes.map((prize) => ({
        id: prize.id,
        label: prize.label,
        amount: prize.amount.toString(),
        probability: prize.probability.toString(),
        color: prize.color,
        sortOrder: prize.sortOrder,
      })),
      recentSpins: recentSpins.map((spin) => ({
        ...spin,
        reward: spin.reward.toString(),
      })),
      dayKey,
    });
  } catch (error) {
    console.error("WHOT status error:", error);
    return NextResponse.json({ error: "Unable to load WHOT information.", detail: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}