import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { encryptSecret } from "@/lib/secret-encryption";


const schema = z.object({
  token: z.string().trim().min(8).max(500),
});

export async function GET() {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await prisma.couponSettings.findUnique({
      where: { id: "default" },
      select: { topupWizardTokenEncrypted: true, updatedAt: true },
    });

    const configured = Boolean(settings?.topupWizardTokenEncrypted);

    return NextResponse.json({
      configured,
      maskedToken: configured ? "••••••••" : "",
      updatedAt: settings?.updatedAt ?? null,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to load provider settings." },
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
    const parsed = schema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Enter a valid TopupWizard API token." },
        { status: 400 }
      );
    }

    const encrypted = encryptSecret(parsed.data.token);

    await prisma.couponSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        topupWizardTokenEncrypted: encrypted,
      },
      update: {
        topupWizardTokenEncrypted: encrypted,
      },
    });

    return NextResponse.json({
      success: true,
      configured: true,
      message: "TopupWizard credentials saved securely.",
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to save provider credentials." },
      { status: 500 }
    );
  }
}