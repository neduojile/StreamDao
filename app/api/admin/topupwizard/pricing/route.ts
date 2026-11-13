import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { decryptSecret } from "@/lib/secret-encryption";

const schema = z.object({
  serviceID: z.union([z.string(), z.number()]).optional(),
  type: z.enum([
    "airtime",
    "airtimepin",
    "cable",
    "data",
    "datacard",
    "education",
    "electricity",
    "smm",
  ]),
  dataType: z.enum(["sme", "cg", "direct"]).optional(),
  typeSingle: z.enum([
    "mtn",
    "glo",
    "airtel",
    "9mobile",
    "youtube",
    "instagram",
    "tiktok",
  ]).optional(),
});

export async function POST(request: NextRequest) {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const parsed = schema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid pricing lookup parameters." },
        { status: 400 }
      );
    }

    const settings = await prisma.couponSettings.findUnique({
      where: { id: "default" },
      select: { topupWizardTokenEncrypted: true },
    });

    if (!settings?.topupWizardTokenEncrypted) {
      return NextResponse.json(
        { error: "TopupWizard credentials have not been configured." },
        { status: 400 }
      );
    }

    const token = decryptSecret(settings.topupWizardTokenEncrypted);

    const response = await fetch("https://topupwizard.com/api/pricing", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization-Token": token,
        Accept: "application/json",
      },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });

    const result: unknown = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: "TopupWizard pricing request failed." },
        { status: 502 }
      );
    }

    const payload = result as {
      status?: string;
      message?: string;
      data?: unknown;
    };

    if (payload.status?.toLowerCase() !== "success") {
      return NextResponse.json(
        {
          error: payload.message || "Provider could not return pricing.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: payload.message || "Pricing retrieved successfully.",
      pricing: payload.data ?? null,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to retrieve TopupWizard pricing." },
      { status: 502 }
    );
  }
}