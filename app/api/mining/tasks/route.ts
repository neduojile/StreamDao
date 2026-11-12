import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";
import { getTaskCycle } from "@/lib/task-cycle";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("streamdao_session")?.value;
  const userId = token ? await verifySession(token) : null;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const { cycleStart, nextReset } = getTaskCycle(now);

    const tasks = await prisma.miningTask.findMany({
      where: {
        status: "ACTIVE",
        createdAt: { gte: cycleStart, lt: nextReset },
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        instructions: true,
        taskLink: true,
        sharePlatform: true,
        shareMessage: true,
        category: true,
        reward: true,
        totalCompletions: true,
        minDurationSeconds: true,
        progress: {
          where: { userId },
          select: {
            startedAt: true,
            claimedAt: true,
          },
          take: 1,
        },
      },
    });

    return NextResponse.json({
      cycleStart: cycleStart.toISOString(),
      nextReset: nextReset.toISOString(),
      tasks: tasks.map((task) => ({
        ...task,
        reward: task.reward.toString(),
      })),
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to load mining tasks." },
      { status: 500 }
    );
  }
}