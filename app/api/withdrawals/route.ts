import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";

async function getUserId() {
  const token = (await cookies()).get("streamdao_session")?.value;
  if (!token) return null;
  return await verifySession(token);
}

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export async function GET() {
  try {
    const userId = await getUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [wallet, withdrawals, payoutProfile, couponSettings] =
      await Promise.all([
        prisma.wallet.findUnique({ where: { userId } }),
        prisma.withdrawal.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
        prisma.payoutProfile.findUnique({ where: { userId } }),
        prisma.couponSettings.findUnique({ where: { id: "default" } }),
      ]);

    return NextResponse.json({
      wallet,
      withdrawals,
      payoutProfile,
      customerServiceUrl: couponSettings?.customerServiceUrl ?? "",
    });
  } catch (error) {
    console.error("Withdrawal GET error:", error);
    return NextResponse.json(
      { error: "Unable to load withdrawal information." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const couponCode = String(body.couponCode ?? "").trim().toUpperCase();

    if (!/^SD-\d{3}-\d{3}-\d{3}$/.test(couponCode)) {
      return NextResponse.json(
        { error: "Enter a valid coupon code." },
        { status: 400 }
      );
    }

    const payoutProfile = await prisma.payoutProfile.findUnique({
      where: { userId },
    });

    if (!payoutProfile) {
      return NextResponse.json(
        { error: "Set up your payout details before withdrawing." },
        { status: 400 }
      );
    }

    const payoutDetails =
      payoutProfile.payoutMethod === "BANK"
        ? {
            bankName: payoutProfile.bankName,
            accountName: payoutProfile.accountName,
            accountNumber: payoutProfile.accountNumber,
            bankCode: payoutProfile.bankCode,
          }
        : {
            cryptoNetwork: payoutProfile.cryptoNetwork,
            walletAddress: payoutProfile.walletAddress,
          };

    const now = new Date();
    const codeHash = hashCode(couponCode);

    const result = await prisma.$transaction(
      async (tx) => {
        const coupon = await tx.withdrawalCoupon.findUnique({
          where: { codeHash },
        });

        if (!coupon) throw new Error("INVALID_COUPON");
        if (coupon.status !== "ACTIVE") throw new Error("COUPON_UNAVAILABLE");
        if (coupon.expiresAt <= now) throw new Error("COUPON_EXPIRED");

        await tx.wallet.upsert({
          where: { userId },
          create: { userId },
          update: {},
        });

        const wallet = await tx.wallet.findUnique({
          where: { userId },
        });

        if (!wallet) throw new Error("WALLET_UNAVAILABLE");

        const breakdown = {
          REFERRAL: new Prisma.Decimal(wallet.referralBalance),
          TASK: new Prisma.Decimal(wallet.taskBalance),
          WHOT: new Prisma.Decimal(wallet.whotBalance),
          TAPPING: new Prisma.Decimal(wallet.tappingBalance),
        };

        const total = Object.values(breakdown).reduce(
          (sum, value) => sum.plus(value),
          new Prisma.Decimal(0)
        );

        if (total.lessThanOrEqualTo(0)) {
          throw new Error("NO_WITHDRAWABLE_BALANCE");
        }

        const couponUpdate = await tx.withdrawalCoupon.updateMany({
          where: {
            id: coupon.id,
            status: "ACTIVE",
            expiresAt: { gt: now },
          },
          data: {
            status: "REDEEMED",
            redeemedAt: now,
            redeemedByUserId: userId,
          },
        });

        if (couponUpdate.count !== 1) {
          throw new Error("COUPON_UNAVAILABLE");
        }

        const deduction = await tx.wallet.updateMany({
          where: {
            userId,
            referralBalance: breakdown.REFERRAL,
            taskBalance: breakdown.TASK,
            whotBalance: breakdown.WHOT,
            tappingBalance: breakdown.TAPPING,
          },
          data: {
            referralBalance: 0,
            taskBalance: 0,
            whotBalance: 0,
            tappingBalance: 0,
          },
        });

        if (deduction.count !== 1) {
          throw new Error("BALANCE_CHANGED");
        }

        const walletBreakdown = {
          REFERRAL: breakdown.REFERRAL.toString(),
          TASK: breakdown.TASK.toString(),
          WHOT: breakdown.WHOT.toString(),
          TAPPING: breakdown.TAPPING.toString(),
        };

        const withdrawal = await tx.withdrawal.create({
          data: {
            userId,
            walletType: "COMBINED",
            amount: total,
            walletBreakdown,
            payoutMethod: payoutProfile.payoutMethod,
            payoutDetails,
            status: "PENDING",
          },
        });

        const transactionEntries = Object.entries(breakdown)
          .filter(([, amount]) => amount.greaterThan(0))
          .map(([walletType, amount]) => ({
            userId,
            walletType,
            type: "DEBIT",
            category: "WITHDRAWAL",
            description: `Withdrawal request ${withdrawal.id} - ${walletType}`,
            amount,
            status: "PENDING",
          }));

        await tx.transaction.createMany({
          data: transactionEntries,
        });

        await tx.withdrawalCoupon.update({
          where: { id: coupon.id },
          data: { redeemedWithdrawalId: withdrawal.id },
        });

        return withdrawal;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );

    return NextResponse.json({
      success: true,
      message: "Combined withdrawal request submitted successfully.",
      withdrawal: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    const errors: Record<string, string> = {
      INVALID_COUPON: "This coupon code does not exist.",
      COUPON_UNAVAILABLE: "This coupon has already been used or disabled.",
      COUPON_EXPIRED: "This coupon code has expired.",
      NO_WITHDRAWABLE_BALANCE: "You do not have any available balance to withdraw.",
      WALLET_UNAVAILABLE: "Your wallet could not be loaded.",
      BALANCE_CHANGED: "Your balance changed during the request. Please try again.",
    };

    if (errors[message]) {
      return NextResponse.json({ error: errors[message] }, { status: 400 });
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2034" || error.code === "P2002")
    ) {
      return NextResponse.json(
        { error: "This request conflicted with another transaction. Please try again." },
        { status: 409 }
      );
    }

    console.error("Withdrawal POST error:", error);

    return NextResponse.json(
      { error: "Unable to submit withdrawal. Please try again." },
      { status: 500 }
    );
  }
}