import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-auth";

const updateSchema = z.object({
  title: z.string().trim().min(3).max(120).optional(),
  description: z.string().trim().min(5).optional(),
  instructions: z.string().trim().min(5).optional(),
  taskLink: z.string().url().nullable().or(z.literal("")).optional(),
  sharePlatform: z.enum(["WHATSAPP", "FACEBOOK"]).nullable().optional(),
  shareMessage: z.string().max(5000).nullable().optional(),
  category: z.enum(["REGULAR", "SPONSORED"]).optional(),
  reward: z.number().positive().max(1000000).optional(),
  minDurationSeconds: z.number().int().min(1).max(86400).optional(),
  status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "Provide at least one field to update.",
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const parsed = updateSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid task details.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await prisma.miningTask.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 });
    }

    const data = parsed.data;
    const finalCategory = data.category ?? existing.category;
    const finalTaskLink =
      data.taskLink !== undefined ? data.taskLink : existing.taskLink;
    const finalSharePlatform =
      data.sharePlatform !== undefined
        ? data.sharePlatform
        : existing.sharePlatform;

    if (finalCategory === "REGULAR" && !finalTaskLink) {
      return NextResponse.json(
        { error: "Regular tasks require a destination link." },
        { status: 400 }
      );
    }

    if (finalCategory === "SPONSORED" && !(data.shareMessage ?? existing.shareMessage)?.trim()) {
      return NextResponse.json({ error: "Sponsored tasks require a share message." }, { status: 400 });
    }
    if (finalCategory === "SPONSORED" && !finalSharePlatform) {
      return NextResponse.json(
        { error: "Sponsored tasks require a sharing platform." },
        { status: 400 }
      );
    }

    const task = await prisma.miningTask.update({
      where: { id },
      data: {
        ...data,
        category: finalCategory,
        taskLink: finalTaskLink || null,
        sharePlatform:
          finalCategory === "SPONSORED" ? finalSharePlatform : null,
        shareMessage: finalCategory === "SPONSORED" ? (data.shareMessage ?? existing.shareMessage) : null,
        proofType: "TEXT",
        proofInstructions: null,
        maxCompletions: null,
        startsAt: null,
        endsAt: null,
      },
    });

    return NextResponse.json({ success: true, task });
  } catch {
    return NextResponse.json(
      { error: "Unable to update mining task." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;

    const existing = await prisma.miningTask.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 });
    }

    await prisma.miningTask.update({
      where: { id },
      data: { status: "ARCHIVED" },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Unable to archive task." },
      { status: 500 }
    );
  }
}