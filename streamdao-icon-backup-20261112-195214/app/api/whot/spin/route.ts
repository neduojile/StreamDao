import { NextRequest, NextResponse, connection } from "next/server";
import { randomInt } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";
import { ensureWhotConfiguration, getLagosDayKey } from "@/lib/whot";

export async function POST(request: NextRequest) {
  await connection();

  const token = request.cookies.get("streamdao_session")?.value;
  if (!token) {
    return NextResponse.json({ error: "Please log in to spin." }, { status: 401 });
  }

  const userId = await verifySession(token);
  if (!userId) {
    return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
  }

  try {
    const { settings, prizes } = await ensureWhotConfiguration();

    if (!settings.isEnabled) {
      return NextResponse.json({ error: "The WHOT wheel is currently unavailable." }, { status: 403 });
    }

    if (prizes.length === 0) {
      return NextResponse.json({ error: "No active prizes are configured." }, { status: 503 });
    }

    const weightedPrizes = prizes.map((prize) => ({
      prize,
      weight: Math.round(Number(prize.probability) * 10000),
    }));

    const totalWeight = weightedPrizes.reduce((sum, item) => sum + item.weight, 0);

    if (totalWeight !== 1000000 || weightedPrizes.some((item) => item.weight <= 0)) {
      return NextResponse.json(
        { error: "The prize probabilities must be positive and total exactly 100%." },
        { status: 503 }
      );
    }

    const winningNumber = randomInt(totalWeight);
    let cursor = 0;
    let winner = weightedPrizes[weightedPrizes.length - 1];

    for (const item of weightedPrizes) {
      cursor += item.weight;
      if (winningNumber < cursor) {
        winner = item;
        break;
      }
    }

    const dayKey = getLagosDayKey();
    let result;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        result = await prisma.$transaction(
          async (tx) => {
            const user = await tx.user.findUnique({
              where: { id: userId },
              select: { id: true },
            });

            if (!user) {
              throw new Error("USER_NOT_FOUND");
            }

            const spinsToday = await tx.whotSpin.count({
              where: { userId, dayKey },
            });

            if (spinsToday >= settings.dailySpinLimit) {
              throw new Error("DAILY_LIMIT_REACHED");
            }

            const spinNumber = spinsToday + 1;

            const spin = await tx.whotSpin.create({
              data: {
                userId,
                prizeId: winner.prize.id,
                dayKey,
                spinNumber,
                prizeLabel: winner.prize.label,
                reward: winner.prize.amount,
              },
            });

            const wallet = await tx.wallet.upsert({
              where: { userId },
              create: {
                userId,
                whotBalance: winner.prize.amount,
              },
              update: {
                whotBalance: { increment: winner.prize.amount },
              },
            });

            await tx.transaction.create({
              data: {
                userId,
                walletType: "WHOT",
                type: "CREDIT",
                category: "WHOT_SPIN",
                description: `WHOT Spin Reward: ${winner.prize.label}`,
                amount: winner.prize.amount,
                status: "COMPLETED",
              },
            });

            return {
              spin,
              balance: wallet.whotBalance,
              remainingSpins: settings.dailySpinLimit - spinNumber,
            };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );

        break;
      } catch (error) {
        const code = (error as { code?: string }).code;

        if (error instanceof Error && error.message === "USER_NOT_FOUND") {
          return NextResponse.json({ error: "User account not found." }, { status: 404 });
        }

        if (error instanceof Error && error.message === "DAILY_LIMIT_REACHED") {
          return NextResponse.json(
            { error: "You have used all your free spins for today.", remainingSpins: 0 },
            { status: 429 }
          );
        }

        if ((code === "P2034" || code === "P2002") && attempt < 2) {
          continue;
        }

        if (code === "P2034" || code === "P2002") {
          return NextResponse.json(
            { error: "Your spin could not be processed. Please try again." },
            { status: 409 }
          );
        }

        throw error;
      }
    }

    if (!result) {
      return NextResponse.json({ error: "Unable to complete your spin." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      prize: {
        id: winner.prize.id,
        label: winner.prize.label,
        amount: winner.prize.amount.toString(),
        color: winner.prize.color,
        sortOrder: winner.prize.sortOrder,
      },
      spinNumber: result.spin.spinNumber,
      remainingSpins: result.remainingSpins,
      balance: result.balance.toString(),
    });
  } catch (error) {
    console.error("WHOT spin error:", error);
    return NextResponse.json({ error: "Something went wrong while processing your spin." }, { status: 500 });
  }
}