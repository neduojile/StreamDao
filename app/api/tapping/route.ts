import { NextRequest, NextResponse, connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";
import { getNextLagosMidnight } from "@/lib/lagos-time";

const SESSION_TAPS = 100;

export async function GET(request: NextRequest) {
  await connection();

  const token = request.cookies.get("streamdao_session")?.value;
  if (!token) {
    return NextResponse.json({ error: "Please log in." }, { status: 401 });
  }

  const userId = await verifySession(token);
  if (!userId) {
    return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
  }

  try {
    const [user, progress] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { wallet: { select: { tappingBalance: true } } },
      }),
      prisma.tappingProgress.findUnique({ where: { userId } }),
    ]);

    if (!user) {
      return NextResponse.json({ error: "User account not found." }, { status: 404 });
    }

    const now = Date.now();
    const lastClaimedAt = progress?.lastClaimedAt ?? null;
    const nextAvailableAt = lastClaimedAt
      ? getNextLagosMidnight(lastClaimedAt)
      : null;
    const cooldownMs = nextAvailableAt
      ? Math.max(0, nextAvailableAt.getTime() - now)
      : 0;
    const taps = progress?.taps ?? 0;

    return NextResponse.json({
      success: true,
      taps,
      remainingTaps: Math.max(0, SESSION_TAPS - taps),
      sessionComplete: taps >= SESSION_TAPS,
      claimable: taps >= SESSION_TAPS && cooldownMs === 0,
      cooldownSeconds: Math.ceil(cooldownMs / 1000),
      nextAvailableAt: cooldownMs > 0 ? nextAvailableAt?.toISOString() : null,
      balance: user.wallet?.tappingBalance.toString() ?? "0.00",
      reward: "5.00",
      sessionLimit: SESSION_TAPS,
    });
  } catch (error) {
    console.error("Tapping status error:", error);
    return NextResponse.json(
      { error: "Unable to load tapping information." },
      { status: 500 }
    );
  }
}