import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-auth";

type Context = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  title: z.string().trim().min(3).max(160).optional(),
  message: z.string().trim().min(5).max(10000).optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
}).refine((data) => Object.keys(data).length > 0);

export async function PATCH(request: NextRequest, context: Context) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await context.params;
    const parsed = updateSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid announcement details." }, { status: 400 });
    }

    const existing = await prisma.announcement.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Announcement not found." }, { status: 404 });

    const data = parsed.data;
    const announcement = await prisma.announcement.update({
      where: { id },
      data: {
        ...data,
        publishedAt:
          data.status === "PUBLISHED"
            ? existing.publishedAt ?? new Date()
            : data.status === "DRAFT"
              ? null
              : undefined,
        expiresAt:
          data.expiresAt === undefined
            ? undefined
            : data.expiresAt
              ? new Date(data.expiresAt)
              : null,
      },
    });

    return NextResponse.json({ success: true, announcement });
  } catch (error) {
    console.error("Admin announcement PATCH:", error);
    return NextResponse.json({ error: "Unable to update announcement." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await context.params;
    await prisma.announcement.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin announcement DELETE:", error);
    return NextResponse.json({ error: "Unable to delete announcement." }, { status: 500 });
  }
}