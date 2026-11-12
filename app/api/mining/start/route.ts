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

    const task = await prisma.miningTask.findFirst({
      where: {
        id: taskId,
        status: "ACTIVE",
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      select: { id: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Task is unavailable." }, { status: 404 });
    }

    const existing = await prisma.taskProgress.findUnique({
      where: {
        taskId_userId_cycleStart: { taskId, userId, cycleStart },
      },
    });

    if (existing?.claimedAt) {
      return NextResponse.json({ error: "You have already claimed this task." }, { status: 409 });
    }

    if (existing) {
      return NextResponse.json({
        success: true,
        startedAt: existing.startedAt,
        alreadyStarted: true,
        nextReset: nextReset.toISOString(),
      });
    }

    try {
      const progress = await prisma.taskProgress.create({
        data: { taskId, userId, cycleStart },
      });

      return NextResponse.json({
        success: true,
        startedAt: progress.startedAt,
        alreadyStarted: false,
        nextReset: nextReset.toISOString(),
      }, { status: 201 });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        const progress = await prisma.taskProgress.findUnique({
          where: {
            taskId_userId_cycleStart: { taskId, userId, cycleStart },
          },
        });

        if (progress) {
          return NextResponse.json({
            success: true,
            startedAt: progress.startedAt,
            alreadyStarted: true,
            nextReset: nextReset.toISOString(),
          });
        }
      }

      throw error;
    }
  } catch {
    return NextResponse.json({ error: "Unable to start task." }, { status: 500 });
  }
}