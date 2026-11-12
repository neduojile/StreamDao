import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-auth";

export async function GET() {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await prisma.couponSettings.findUnique({
    where: { id: "default" },
  });

  return NextResponse.json({
    customerServiceUrl: settings?.customerServiceUrl ?? "",
  });
}

export async function POST(request: NextRequest) {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const url = String(body.customerServiceUrl ?? "").trim();

    if (url) {
      let parsed: URL;

      try {
        parsed = new URL(url);
      } catch {
        return NextResponse.json(
          { error: "Enter a valid customer service URL." },
          { status: 400 }
        );
      }

      if (!["https:", "http:"].includes(parsed.protocol)) {
        return NextResponse.json(
          { error: "Only HTTP or HTTPS links are allowed." },
          { status: 400 }
        );
      }
    }

    const settings = await prisma.couponSettings.upsert({
      where: { id: "default" },
      create: { id: "default", customerServiceUrl: url || null },
      update: { customerServiceUrl: url || null },
    });

    return NextResponse.json({
      success: true,
      customerServiceUrl: settings.customerServiceUrl ?? "",
    });
  } catch (error) {
    console.error("Coupon settings error:", error);
    return NextResponse.json(
      { error: "Unable to save customer service settings." },
      { status: 500 }
    );
  }
}