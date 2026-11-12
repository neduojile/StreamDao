import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";
import { getTaskCycle } from "@/lib/task-cycle";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("streamdao_session")?.value;
  const userId = token ? await verifySession(token) : null;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const taskId = typeof body.taskId === "string" ? body.taskId : "";

    if (!taskId) {
      return NextResponse.json({ error: "Task ID is required." }, { status: 400 });
    }

    const now = new Date();
    const { cycleStart, nextReset } = getTaskCycle(now);

    const result = await prisma.$transaction(async (tx) => {
      const task = await tx.miningTask.findFirst({
        where: {
          id: taskId,
          status: "ACTIVE",
          createdAt: { gte: cycleStart, lt: nextReset },
        },
        select: {
          id: true,
          title: true,
          reward: true,
          minDurationSeconds: true,
          startsAt: true,
          endsAt: true,
        },
      });

      if (!task) throw new Error("TASK_UNAVAILABLE");

      if (
        (task.startsAt && task.startsAt > now) ||
        (task.endsAt && task.endsAt <= now)
      ) {
        throw new Error("TASK_UNAVAILABLE");
      }

      const progress = await tx.taskProgress.findUnique({
        where: {
          taskId_userId: { taskId, userId },
        },
      });

      if (!progress) throw new Error("TASK_NOT_STARTED");
      if (progress.claimedAt) throw new Error("ALREADY_CLAIMED");

      const elapsedSeconds = Math.floor(
        (now.getTime() - progress.startedAt.getTime()) / 1000
      );

      if (elapsedSeconds < task.minDurationSeconds) {
        throw new Error("TASK_NOT_COMPLETED");
      }

      const claimed = await tx.taskProgress.updateMany({
        where: {
          id: progress.id,
          claimedAt: null,
        },
        data: { claimedAt: now },
      });

      if (claimed.count !== 1) throw new Error("ALREADY_CLAIMED");

      await tx.wallet.upsert({
        where: { userId },
        create: { userId, taskBalance: task.reward },
        update: { taskBalance: { increment: task.reward } },
      });

      await tx.transaction.create({
        data: {
          userId,
          walletType: "TASK",
          type: "CREDIT",
          category: "MINING_TASK",
          description: `Reward claimed: ${task.title}`,
          amount: task.reward,
          status: "COMPLETED",
        },
      });

      await tx.miningTask.update({
        where: { id: task.id },
        data: { totalCompletions: { increment: 1 } },
      });

      return { reward: task.reward, title: task.title };
    });

    return NextResponse.json({
      success: true,
      message: "Reward credited successfully.",
      reward: result.reward.toString(),
      taskTitle: result.title,
      nextReset: nextReset.toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    const errors: Record<string, { status: number; message: string }> = {
      TASK_UNAVAILABLE: { status: 404, message: "This task is unavailable." },
      TASK_NOT_STARTED: { status: 400, message: "Start this task first." },
      ALREADY_CLAIMED: { status: 409, message: "You have already claimed this reward." },
      TASK_NOT_COMPLETED: { status: 400, message: "The task timer has not finished yet." },
    };

    const known = errors[message];

    if (known) {
      return NextResponse.json({ error: known.message }, { status: known.status });
    }

    return NextResponse.json(
      { error: "Unable to claim reward. Please try again." },
      { status: 500 }
    );
  }
}