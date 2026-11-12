import { NextRequest, NextResponse, connection } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";
import { getNextLagosMidnight } from "@/lib/lagos-time";

const getNextReset = (date: Date) => {
  const next = new Date(date.toLocaleString("en-US", { timeZone: "Africa/Lagos" }));
  next.setHours(24, 0, 0, 0);
  return new Date(next.toLocaleString("en-US", { timeZone: "UTC" }) + " UTC");
};
const SESSION_TAPS = 100;
const REWARD = new Prisma.Decimal("5.00");

export async function POST(request: NextRequest) {
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
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await prisma.$transaction(
          async (tx) => {
            const progress = await tx.tappingProgress.findUnique({
              where: { userId },
            });

            if (!progress || progress.taps < SESSION_TAPS) {
              throw new Error("SESSION_NOT_COMPLETE");
            }

            const now = new Date();

            if (progress.lastClaimedAt) {
              const nextAvailableAt = new Date(
                getNextLagosMidnight(progress.lastClaimedAt).getTime()
              );

              if (now < nextAvailableAt) {
                throw new Error("COOLDOWN_ACTIVE");
              }
            }

            const wallet = await tx.wallet.upsert({
              where: { userId },
              create: {
                userId,
                tappingBalance: REWARD,
              },
              update: {
                tappingBalance: { increment: REWARD },
              },
            });

            await tx.transaction.create({
              data: {
                userId,
                walletType: "TAPPING",
                type: "CREDIT",
                category: "TAPPING_REWARD",
                description: "Daily tapping reward",
                amount: REWARD,
                status: "COMPLETED",
              },
            });

            await tx.tappingProgress.update({
              where: { userId },
              data: {
                taps: 0,
                lastClaimedAt: now,
                lastTapAt: null,
              },
            });

            return {
              balance: wallet.tappingBalance.toString(),
              reward: REWARD.toString(),
              nextAvailableAt: getNextLagosMidnight(now).toISOString(),
            };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );

        return NextResponse.json({ success: true, ...result });
      } catch (error) {
        const code = (error as { code?: string }).code;

        if (error instanceof Error) {
          if (error.message === "SESSION_NOT_COMPLETE") {
            return NextResponse.json(
              { error: "Complete all 100 taps before claiming your reward." },
              { status: 400 }
            );
          }
          if (error.message === "COOLDOWN_ACTIVE") {
            return NextResponse.json(
              { error: "Your next reward is not available yet." },
              { status: 403 }
            );
          }
        }

        if ((code === "P2034" || code === "P2002") && attempt < 2) {
          continue;
        }

        if (code === "P2034" || code === "P2002") {
          return NextResponse.json(
            { error: "Your reward could not be processed. Please try again." },
            { status: 409 }
          );
        }

        throw error;
      }
    }

    return NextResponse.json(
      { error: "Unable to process your reward." },
      { status: 500 }
    );
  } catch (error) {
    console.error("Tapping claim error:", error);
    return NextResponse.json(
      { error: "Something went wrong while claiming your reward." },
      { status: 500 }
    );
  }
}