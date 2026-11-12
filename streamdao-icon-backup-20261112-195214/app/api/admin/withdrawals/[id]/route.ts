import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-auth";

const walletFields: Record<string, string> = {
  REFERRAL: "referralBalance",
  TASK: "taskBalance",
  ONEHUB: "onehubBalance",
  WHOT: "whotBalance",
  TAPPING: "tappingBalance",
};

const combinedWallets = ["REFERRAL", "TASK", "WHOT", "TAPPING"] as const;

const transitions: Record<string, string[]> = {
  PENDING: ["PROCESSING", "REJECTED"],
  PROCESSING: ["APPROVED", "REJECTED"],
  APPROVED: ["PAID", "REJECTED"],
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const body = await request.json();
    const status = String(body.status ?? "").toUpperCase();
    const adminNote = String(body.adminNote ?? "").trim();

    if (!["PROCESSING", "APPROVED", "PAID", "REJECTED"].includes(status)) {
      return NextResponse.json({ error: "Invalid withdrawal action." }, { status: 400 });
    }

    if (adminNote.length > 1000) {
      return NextResponse.json({ error: "Admin note cannot exceed 1000 characters." }, { status: 400 });
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const withdrawal = await tx.withdrawal.findUnique({ where: { id } });

        if (!withdrawal) throw new Error("WITHDRAWAL_NOT_FOUND");

        if (!transitions[withdrawal.status]?.includes(status)) {
          throw new Error("INVALID_STATUS_TRANSITION");
        }

        const now = new Date();

        const timestampData =
          status === "PROCESSING" ? { processingAt: now } :
          status === "APPROVED" ? { approvedAt: now } :
          status === "PAID" ? { paidAt: now, processedAt: now } :
          { processedAt: now };

        const updated = await tx.withdrawal.updateMany({
          where: { id, status: withdrawal.status },
          data: {
            status,
            adminNote: adminNote || withdrawal.adminNote,
            ...timestampData,
          },
        });

        if (updated.count !== 1) throw new Error("WITHDRAWAL_ALREADY_PROCESSED");

        if (status === "REJECTED") {
          if (withdrawal.walletType === "COMBINED") {
            const raw = withdrawal.walletBreakdown;

            if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
              throw new Error("INVALID_WALLET_BREAKDOWN");
            }

            const breakdown = raw as Record<string, unknown>;
            const refunds: { walletType: string; amount: Prisma.Decimal; balanceField: string }[] = [];

            for (const walletType of combinedWallets) {
              const rawAmount = breakdown[walletType];

              if (typeof rawAmount !== "string" && typeof rawAmount !== "number") {
                throw new Error("INVALID_WALLET_BREAKDOWN");
              }

              const amount = new Prisma.Decimal(String(rawAmount));

              if (!amount.isFinite() || amount.lessThan(0)) {
                throw new Error("INVALID_WALLET_BREAKDOWN");
              }

              if (amount.greaterThan(0)) {
                refunds.push({
                  walletType,
                  amount,
                  balanceField: walletFields[walletType],
                });
              }
            }

            const refundTotal = refunds.reduce(
              (sum, item) => sum.plus(item.amount),
              new Prisma.Decimal(0)
            );

            if (!refundTotal.equals(withdrawal.amount)) {
              throw new Error("INVALID_WALLET_BREAKDOWN");
            }

            for (const refund of refunds) {
              await tx.wallet.update({
                where: { userId: withdrawal.userId },
                data: { [refund.balanceField]: { increment: refund.amount } },
              });

              await tx.transaction.create({
                data: {
                  userId: withdrawal.userId,
                  walletType: refund.walletType,
                  type: "CREDIT",
                  category: "WITHDRAWAL_REFUND",
                  description: `Refund for rejected withdrawal ${id} - ${refund.walletType}`,
                  amount: refund.amount,
                  status: "COMPLETED",
                },
              });
            }
          } else {
            const balanceField = walletFields[withdrawal.walletType];

            if (!balanceField) throw new Error("INVALID_WALLET_TYPE");

            await tx.wallet.update({
              where: { userId: withdrawal.userId },
              data: { [balanceField]: { increment: withdrawal.amount } },
            });

            await tx.transaction.create({
              data: {
                userId: withdrawal.userId,
                walletType: withdrawal.walletType,
                type: "CREDIT",
                category: "WITHDRAWAL_REFUND",
                description: `Refund for rejected withdrawal ${id}`,
                amount: withdrawal.amount,
                status: "COMPLETED",
              },
            });
          }
        }

        if (status === "PAID") {
          const completed = await tx.transaction.updateMany({
            where: {
              userId: withdrawal.userId,
              category: "WITHDRAWAL",
              description: { startsWith: `Withdrawal request ${id}` },
              status: "PENDING",
            },
            data: { status: "COMPLETED" },
          });

          if (completed.count === 0) {
            throw new Error("WITHDRAWAL_TRANSACTION_NOT_FOUND");
          }
        }

        return { id, status };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10000,
        timeout: 20000,
      }
    );

    const messages: Record<string, string> = {
      PROCESSING: "Withdrawal moved to processing.",
      APPROVED: "Withdrawal approved. Complete the actual payout before marking it paid.",
      PAID: "Withdrawal marked as paid. Debit transactions completed.",
      REJECTED: "Withdrawal rejected and original wallet balances refunded.",
    };

    return NextResponse.json({
      success: true,
      message: messages[status],
      withdrawal: result,
    });
  } catch (error) {
    if (error instanceof Error) {
      const errors: Record<string, { message: string; status: number }> = {
        WITHDRAWAL_NOT_FOUND: { message: "Withdrawal request not found.", status: 404 },
        WITHDRAWAL_ALREADY_PROCESSED: { message: "This withdrawal has already changed. Refresh and try again.", status: 409 },
        INVALID_STATUS_TRANSITION: { message: "This status transition is not allowed.", status: 409 },
        INVALID_WALLET_TYPE: { message: "Invalid wallet type.", status: 400 },
        INVALID_WALLET_BREAKDOWN: { message: "Invalid wallet refund records. Contact technical support.", status: 400 },
        WITHDRAWAL_TRANSACTION_NOT_FOUND: { message: "Withdrawal debit transaction was not found. The payout was not marked as paid.", status: 409 },
      };

      const known = errors[error.message];
      if (known) {
        return NextResponse.json({ error: known.message }, { status: known.status });
      }
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        { error: "Another transaction changed this request. Refresh and try again." },
        { status: 409 }
      );
    }

    console.error("Admin withdrawal PATCH:", error);

    return NextResponse.json(
      { error: "Unable to process withdrawal." },
      { status: 500 }
    );
  }
}