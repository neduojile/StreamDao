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

    if (!["APPROVED", "REJECTED"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid withdrawal action." },
        { status: 400 }
      );
    }

    if (adminNote.length > 1000) {
      return NextResponse.json(
        { error: "Admin note cannot exceed 1000 characters." },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const withdrawal = await tx.withdrawal.findUnique({
          where: { id },
        });

        if (!withdrawal) {
          throw new Error("WITHDRAWAL_NOT_FOUND");
        }

        if (withdrawal.status !== "PENDING") {
          throw new Error("WITHDRAWAL_ALREADY_PROCESSED");
        }

        const updated = await tx.withdrawal.updateMany({
          where: { id, status: "PENDING" },
          data: {
            status,
            adminNote: adminNote || null,
            processedAt: new Date(),
          },
        });

        if (updated.count !== 1) {
          throw new Error("WITHDRAWAL_ALREADY_PROCESSED");
        }

        if (status === "REJECTED") {
          if (withdrawal.walletType === "COMBINED") {
            const rawBreakdown = withdrawal.walletBreakdown;

            if (
              !rawBreakdown ||
              typeof rawBreakdown !== "object" ||
              Array.isArray(rawBreakdown)
            ) {
              throw new Error("INVALID_WALLET_BREAKDOWN");
            }

            const breakdown = rawBreakdown as Record<string, unknown>;
            const refunds: {
              walletType: string;
              amount: Prisma.Decimal;
              balanceField: string;
            }[] = [];

            for (const walletType of combinedWallets) {
              const rawAmount = breakdown[walletType];

              if (
                typeof rawAmount !== "string" &&
                typeof rawAmount !== "number"
              ) {
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
                data: {
                  [refund.balanceField]: { increment: refund.amount },
                },
              });

              await tx.transaction.create({
                data: {
                  userId: withdrawal.userId,
                  walletType: refund.walletType,
                  type: "CREDIT",
                  category: "WITHDRAWAL_REFUND",
                  description: `Refund for rejected withdrawal ${withdrawal.id} - ${refund.walletType}`,
                  amount: refund.amount,
                  status: "COMPLETED",
                },
              });
            }
          } else {
            const balanceField = walletFields[withdrawal.walletType];

            if (!balanceField) {
              throw new Error("INVALID_WALLET_TYPE");
            }

            await tx.wallet.update({
              where: { userId: withdrawal.userId },
              data: {
                [balanceField]: { increment: withdrawal.amount },
              },
            });

            await tx.transaction.create({
              data: {
                userId: withdrawal.userId,
                walletType: withdrawal.walletType,
                type: "CREDIT",
                category: "WITHDRAWAL_REFUND",
                description: `Refund for rejected withdrawal ${withdrawal.id}`,
                amount: withdrawal.amount,
                status: "COMPLETED",
              },
            });
          }
        } else {
          await tx.transaction.updateMany({
            where: {
              userId: withdrawal.userId,
              category: "WITHDRAWAL",
              description: {
                startsWith: `Withdrawal request ${withdrawal.id}`,
              },
              status: "PENDING",
            },
            data: { status: "COMPLETED" },
          });
        }

        return { id, status };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );

    return NextResponse.json({
      success: true,
      message:
        status === "APPROVED"
          ? "Withdrawal approved successfully."
          : "Withdrawal rejected and original wallet balances refunded successfully.",
      withdrawal: result,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "WITHDRAWAL_NOT_FOUND") {
        return NextResponse.json(
          { error: "Withdrawal request not found." },
          { status: 404 }
        );
      }

      if (error.message === "WITHDRAWAL_ALREADY_PROCESSED") {
        return NextResponse.json(
          { error: "This withdrawal has already been processed." },
          { status: 409 }
        );
      }

      if (
        error.message === "INVALID_WALLET_TYPE" ||
        error.message === "INVALID_WALLET_BREAKDOWN"
      ) {
        return NextResponse.json(
          { error: "Withdrawal wallet records are invalid. Contact technical support." },
          { status: 400 }
        );
      }
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        { error: "Another transaction changed this request. Please try again." },
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