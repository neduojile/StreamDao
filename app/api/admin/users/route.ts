import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const params = request.nextUrl.searchParams;
    const search = (params.get("search") ?? "").trim().slice(0, 100);
    const userId = params.get("id");
    const page = Math.max(1, Number(params.get("page")) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(params.get("pageSize")) || 20));

    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          fullName: true,
          username: true,
          email: true,
          phone: true,
          airtimePurchaseLimitNgn: true,
          referralCode: true,
          referredById: true,
          createdAt: true,
          referredBy: {
            select: { id: true, fullName: true, username: true },
          },
          referrals: {
            select: { id: true, fullName: true, username: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 10,
          },
          wallet: true,
          tappingProgress: {
            select: { taps: true, lastClaimedAt: true, lastTapAt: true },
          },
          _count: {
            select: {
              referrals: true,
              transactions: true,
              taskProgress: true,
              whotSpins: true,
              withdrawals: true,
            },
          },
          transactions: {
            orderBy: { createdAt: "desc" },
            take: 20,
            select: {
              id: true,
              walletType: true,
              type: true,
              category: true,
              description: true,
              amount: true,
              status: true,
              createdAt: true,
            },
          },
          withdrawals: {
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
              id: true,
              walletType: true,
              amount: true,
              payoutMethod: true,
              status: true,
              adminNote: true,
              createdAt: true,
              processedAt: true,
            },
          },
          whotSpins: {
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
              id: true,
              prizeLabel: true,
              reward: true,
              createdAt: true,
            },
          },
          taskProgress: {
            orderBy: { startedAt: "desc" },
            take: 10,
            select: {
              id: true,
              startedAt: true,
              claimedAt: true,
              task: {
                select: { id: true, title: true, category: true, reward: true },
              },
            },
          },
        },
      });

      if (!user) {
        return NextResponse.json({ error: "User not found." }, { status: 404 });
      }

      const earnings = await prisma.transaction.aggregate({
        where: { userId, type: "CREDIT", status: "COMPLETED" },
        _sum: { amount: true },
      });

      return NextResponse.json({
        user,
        totalEarnings: earnings._sum.amount ?? 0,
      });
    }

    const where: Prisma.UserWhereInput = search
      ? {
          OR: [
            { fullName: { contains: search, mode: "insensitive" } },
            { username: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};

    const [total, users] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          fullName: true,
          username: true,
          email: true,
          phone: true,
          airtimePurchaseLimitNgn: true,
          referralCode: true,
          createdAt: true,
          wallet: {
            select: {
              taskBalance: true,
              referralBalance: true,
              onehubBalance: true,
              whotBalance: true,
              tappingBalance: true,
            },
          },
          tappingProgress: {
            select: { taps: true, lastClaimedAt: true },
          },
          _count: {
            select: {
              referrals: true,
              transactions: true,
              taskProgress: true,
              whotSpins: true,
              withdrawals: true,
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      users,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Admin users API:", error);
    return NextResponse.json(
      { error: "Unable to load user information." },
      { status: 500 }
    );
  }
}