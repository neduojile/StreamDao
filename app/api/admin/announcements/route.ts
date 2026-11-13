import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-auth";

const announcementSchema = z.object({
  title: z.string().trim().min(3).max(160),
  message: z.string().trim().min(5).max(10000),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  expiresAt: z.string().datetime().nullable().optional(),
});

export async function GET() {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const announcements = await prisma.announcement.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ announcements });
  } catch (error) {
    console.error("Admin announcements GET:", error);
    return NextResponse.json(
      { error: "Unable to load announcements." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const parsed = announcementSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid announcement details.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const announcement = await prisma.announcement.create({
      data: {
        title: data.title,
        message: data.message,
        status: data.status,
        publishedAt: data.status === "PUBLISHED" ? new Date() : null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      },
    });

    return NextResponse.json(
      { success: true, announcement },
      { status: 201 }
    );
  } catch (error) {
    console.error("Admin announcements POST:", error);
    return NextResponse.json(
      { error: "Unable to create announcement." },
      { status: 500 }
    );
  }
}