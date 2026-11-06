import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-auth";

const taskSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(5),
  instructions: z.string().trim().min(5),
  taskLink: z.string().url().optional().or(z.literal("")),
  sharePlatform: z.enum(["WHATSAPP", "FACEBOOK"]).nullable().optional(),
  shareMessage: z.string().max(5000).nullable().optional(),
  category: z.enum(["REGULAR", "SPONSORED"]),
  reward: z.number().positive().max(1000000),
  minDurationSeconds: z.number().int().min(1).max(86400),
}).superRefine((data, ctx) => {
  if (data.category === "REGULAR" && !data.taskLink) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["taskLink"],
      message: "Regular tasks require a destination link.",
    });
  }

  if (data.category === "SPONSORED" && !data.shareMessage?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["shareMessage"], message: "Sponsored tasks require a share message." });
  }
  if (data.category === "SPONSORED" && !data.sharePlatform) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["sharePlatform"],
      message: "Select a sharing platform for sponsored tasks.",
    });
  }
});

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const tasks = await prisma.miningTask.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ tasks });
  } catch {
    return NextResponse.json({ error: "Unable to load mining tasks." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const parsed = taskSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid task details.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const task = await prisma.miningTask.create({
      data: {
        title: data.title,
        description: data.description,
        instructions: data.instructions,
        taskLink: data.taskLink || null,
        sharePlatform: data.category === "SPONSORED" ? data.sharePlatform ?? null : null,
        shareMessage: data.category === "SPONSORED" ? data.shareMessage?.trim() || null : null,
        category: data.category,
        reward: data.reward,
        minDurationSeconds: data.minDurationSeconds,
        proofType: "TEXT",
        proofInstructions: null,
        maxCompletions: null,
        startsAt: null,
        endsAt: null,
        createdById: admin.id,
      },
    });

    return NextResponse.json({ success: true, task }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to create mining task." }, { status: 500 });
  }
}