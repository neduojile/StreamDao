import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { decryptSecret } from "@/lib/secret-encryption";


export async function GET() {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await prisma.couponSettings.findUnique({
      where: { id: "default" },
      select: { topupWizardTokenEncrypted: true },
    });

    if (!settings?.topupWizardTokenEncrypted) {
      return NextResponse.json(
        { error: "Save your TopupWizard API token first." },
        { status: 400 }
      );
    }

    const token = decryptSecret(settings.topupWizardTokenEncrypted);

    const response = await fetch("https://topupwizard.com/api/balance", {
      method: "GET",
      headers: {
        "Authorization-Token": token,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    const result: unknown = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          connected: false,
          error: "TopupWizard rejected the connection. Check your API credentials.",
        },
        { status: 502 }
      );
    }

    const payload = result as {
      status?: string;
      message?: string;
      data?: { funds?: unknown };
    };

    if (
      payload.status &&
      !["success", "successful", "200"].includes(payload.status.toLowerCase())
    ) {
      return NextResponse.json(
        {
          success: false,
          connected: false,
          error: payload.message || "Provider connection could not be verified.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      connected: true,
      balance: payload.data?.funds ?? null,
      message: "TopupWizard connection verified.",
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        connected: false,
        error: "Unable to reach TopupWizard. Check the connection and try again.",
      },
      { status: 502 }
    );
  }
}