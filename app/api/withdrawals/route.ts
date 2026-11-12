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

    const initialWallet = await prisma.wallet.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

    const minimums = {
      REFERRAL: new Prisma.Decimal(20),
      TASK: new Prisma.Decimal(115),
      WHOT: new Prisma.Decimal(25),
      TAPPING: new Prisma.Decimal(100),
    };

    const eligibleBreakdown = {
      REFERRAL: new Prisma.Decimal(initialWallet.referralBalance).greaterThanOrEqualTo(minimums.REFERRAL)
        ? new Prisma.Decimal(initialWallet.referralBalance) : new Prisma.Decimal(0),
      TASK: new Prisma.Decimal(initialWallet.taskBalance).greaterThanOrEqualTo(minimums.TASK)
        ? new Prisma.Decimal(initialWallet.taskBalance) : new Prisma.Decimal(0),
      WHOT: new Prisma.Decimal(initialWallet.whotBalance).greaterThanOrEqualTo(minimums.WHOT)
        ? new Prisma.Decimal(initialWallet.whotBalance) : new Prisma.Decimal(0),
      TAPPING: new Prisma.Decimal(initialWallet.tappingBalance).greaterThanOrEqualTo(minimums.TAPPING)
        ? new Prisma.Decimal(initialWallet.tappingBalance) : new Prisma.Decimal(0),
    };

    const requestedAmount = Object.values(eligibleBreakdown).reduce(
      (sum, value) => sum.plus(value),
      new Prisma.Decimal(0)
    );

    if (requestedAmount.lessThanOrEqualTo(0)) {
      throw new Error("NO_ELIGIBLE_BALANCE");
    }

    let payoutDetails: Record<string, string | number | null> =
      payoutProfile.payoutMethod === "BANK"
        ? {
            bankName: payoutProfile.bankName,
            accountName: payoutProfile.accountName,
            accountNumber: payoutProfile.accountNumber,
            bankCode: payoutProfile.bankCode,
            countryCode: payoutProfile.countryCode,
            countryName: payoutProfile.countryName,
            payoutCurrency: payoutProfile.payoutCurrency,
          }
        : {
            cryptoNetwork: payoutProfile.cryptoNetwork,
            walletAddress: payoutProfile.walletAddress,
          };

    if (payoutProfile.payoutMethod === "BANK") {
      const currency = payoutProfile.payoutCurrency;

      if (!currency) {
        return NextResponse.json(
          { error: "Please update your bank country in Account Setup." },
          { status: 400 }
        );
      }

      const rateResponse = await fetch(
        "https://open.er-api.com/v6/latest/EUR",
        { cache: "no-store" }
      );

      if (!rateResponse.ok) {
        throw new Error("EXCHANGE_RATE_UNAVAILABLE");
      }

      const rateData = await rateResponse.json();
      const exchangeRate = rateData?.rates?.[currency];

      if (
        rateData?.result !== "success" ||
        typeof exchangeRate !== "number" ||
        !Number.isFinite(exchangeRate) ||
        exchangeRate <= 0
      ) {
        throw new Error("EXCHANGE_RATE_UNAVAILABLE");
      }

      payoutDetails = {
        ...payoutDetails,
        exchangeRate,
        convertedAmount: Number(
          requestedAmount.mul(exchangeRate).toFixed(2)
        ),
        rateUpdatedAt: rateData.time_last_update_utc ?? null,
        rateProvider: "ExchangeRate-API",
      };
    }

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

        const available = {
          REFERRAL: new Prisma.Decimal(wallet.referralBalance),
          TASK: new Prisma.Decimal(wallet.taskBalance),
          WHOT: new Prisma.Decimal(wallet.whotBalance),
          TAPPING: new Prisma.Decimal(wallet.tappingBalance),
        };

        const breakdown = {
          REFERRAL: available.REFERRAL.greaterThanOrEqualTo(minimums.REFERRAL) ? available.REFERRAL : new Prisma.Decimal(0),
          TASK: available.TASK.greaterThanOrEqualTo(minimums.TASK) ? available.TASK : new Prisma.Decimal(0),
          WHOT: available.WHOT.greaterThanOrEqualTo(minimums.WHOT) ? available.WHOT : new Prisma.Decimal(0),
          TAPPING: available.TAPPING.greaterThanOrEqualTo(minimums.TAPPING) ? available.TAPPING : new Prisma.Decimal(0),
        };

        const transactionAmount = Object.values(breakdown).reduce(
          (sum, value) => sum.plus(value),
          new Prisma.Decimal(0)
        );

        if (transactionAmount.lessThanOrEqualTo(0)) {
          throw new Error("NO_ELIGIBLE_BALANCE");
        }

        if (!transactionAmount.equals(requestedAmount)) {
          throw new Error("BALANCE_CHANGED");
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
            referralBalance: available.REFERRAL,
            taskBalance: available.TASK,
            whotBalance: available.WHOT,
            tappingBalance: available.TAPPING,
          },
          data: {
            referralBalance: available.REFERRAL.minus(breakdown.REFERRAL),
            taskBalance: available.TASK.minus(breakdown.TASK),
            whotBalance: available.WHOT.minus(breakdown.WHOT),
            tappingBalance: available.TAPPING.minus(breakdown.TAPPING),
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
            amount: requestedAmount,
            walletBreakdown,
            payoutMethod: payoutProfile.payoutMethod,
            payoutDetails,
            status: "PENDING",
          },
        });

        const transactionEntries = Object.entries(breakdown)
          .filter(([, value]) => value.greaterThan(0))
          .map(([walletType, value]) => ({
            userId,
            walletType,
            type: "DEBIT",
            category: "WITHDRAWAL",
            description: `Withdrawal request ${withdrawal.id} - ${walletType}`,
            amount: value,
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
        maxWait: 10000,
        timeout: 20000,
      }
    );

    return NextResponse.json({
      success: true,
      message: "Withdrawal request submitted successfully.",
      withdrawal: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    const errors: Record<string, string> = {
      INVALID_COUPON: "This coupon code does not exist.",
      COUPON_UNAVAILABLE: "This coupon has already been used or disabled.",
      COUPON_EXPIRED: "This coupon code has expired.",
      NO_ELIGIBLE_BALANCE: "None of your wallets has reached its minimum cashout threshold yet.",
      WALLET_UNAVAILABLE: "Your wallet could not be loaded.",
      BALANCE_CHANGED: "Your balance changed during the request. Please try again.",
      EXCHANGE_RATE_UNAVAILABLE: "The payout exchange rate is temporarily unavailable. Please try again.",
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