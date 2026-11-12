import { NextRequest, NextResponse, connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";

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

    const referralGroups = await prisma.user.groupBy({
      by: ["referredById"],
      where: { referredById: { not: null } },
      _count: { _all: true },
      orderBy: [
        { _count: { referredById: "desc" } },
        { referredById: "asc" },
      ],
    });

    const ranked = referralGroups
      .filter((group) => group.referredById !== null)
      .map((group) => ({
        userId: group.referredById as string,
        referralCount: group._count._all,
      }));

    const users = await prisma.user.findMany({
      where: { id: { in: ranked.map((entry) => entry.userId) } },
      select: {
        id: true,
        username: true,
        fullName: true,
      },
    });

    const userMap = new Map(users.map((user) => [user.id, user]));

    const leaderboard = ranked.map((entry, index) => {
      const user = userMap.get(entry.userId);

      return {
        rank: index + 1,
        username: user?.username ?? "member",
        fullName: user?.fullName ?? "StreamDao Member",
        referralCount: entry.referralCount,
        isCurrentUser: entry.userId === userId,
      };
    }).filter((entry) => entry.username !== "member");

    const currentUserRank = leaderboard.find(
      (entry) => entry.isCurrentUser
    ) ?? null;

    return NextResponse.json({
      leaderboard: leaderboard.slice(0, 50),
      totalRankedUsers: leaderboard.length,
      currentUser: currentUserRank
        ? {
            rank: currentUserRank.rank,
            referralCount: currentUserRank.referralCount,
            isInTop50: currentUserRank.rank <= 50,
          }
        : {
            rank: null,
            referralCount: 0,
            isInTop50: false,
          },
    });
  } catch (error) {
    console.error("Referral leaderboard error:", error);

    return NextResponse.json(
      { error: "Unable to load the referral leaderboard." },
      { status: 500 }
    );
  }
}