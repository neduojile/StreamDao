import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-auth";

const schema = z.object({
  airtimeEnabled: z.boolean(),
  dataEnabled: z.boolean(),
  mtnEnabled: z.boolean(),
  airtelEnabled: z.boolean(),
  gloEnabled: z.boolean(),
  nineMobileEnabled: z.boolean(),
  minimumAmountNgn: z.number().finite().min(0).max(50000000),
  maximumAmountNgn: z.number().finite().positive().max(50000000),
  minimumDataAmountNgn: z.number().finite().min(0).max(50000000),
  maximumDataAmountNgn: z.number().finite().positive().max(50000000),
  markupPercent: z.number().finite().min(0).max(100),
  exchangeRateSource: z.enum(["EXCHANGE_RATE_API", "MANUAL"]),
  exchangeRateOverride: z.number().finite().positive().nullable(),
}).superRefine((data, ctx) => {
  if (data.maximumAmountNgn < data.minimumAmountNgn) {
    ctx.addIssue({
      code: "custom",
      path: ["maximumAmountNgn"],
      message: "Maximum airtime amount must exceed minimum.",
    });
  }

  if (data.maximumDataAmountNgn < data.minimumDataAmountNgn) {
    ctx.addIssue({
      code: "custom",
      path: ["maximumDataAmountNgn"],
      message: "Maximum data amount must exceed minimum.",
    });
  }

  if (data.exchangeRateSource === "MANUAL" && !data.exchangeRateOverride) {
    ctx.addIssue({
      code: "custom",
      path: ["exchangeRateOverride"],
      message: "A manual exchange rate is required.",
    });
  }
});

const decimal = (value: number) => new Prisma.Decimal(value);

function serialize(settings: any) {
  return {
    ...settings,
    minimumAmountNgn: Number(settings.minimumAmountNgn),
    maximumAmountNgn: Number(settings.maximumAmountNgn),
    minimumDataAmountNgn: Number(settings.minimumDataAmountNgn),
    maximumDataAmountNgn: Number(settings.maximumDataAmountNgn),
    markupPercent: Number(settings.markupPercent),
    exchangeRateOverride: settings.exchangeRateOverride
      ? Number(settings.exchangeRateOverride)
      : null,
  };
}

export async function GET() {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await prisma.airtimeSettings.upsert({
      where: { id: "default" },
      create: { id: "default" },
      update: {},
    });

    return NextResponse.json({
      success: true,
      settings: serialize(settings),
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to load Airtime and Data settings." },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: unknown = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid settings.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const values = {
      ...data,
      minimumAmountNgn: decimal(data.minimumAmountNgn),
      maximumAmountNgn: decimal(data.maximumAmountNgn),
      minimumDataAmountNgn: decimal(data.minimumDataAmountNgn),
      maximumDataAmountNgn: decimal(data.maximumDataAmountNgn),
      markupPercent: decimal(data.markupPercent),
      exchangeRateOverride: data.exchangeRateOverride === null
        ? null
        : decimal(data.exchangeRateOverride),
    };

    const settings = await prisma.airtimeSettings.upsert({
      where: { id: "default" },
      create: { id: "default", ...values },
      update: values,
    });

    return NextResponse.json({
      success: true,
      message: "Airtime and Data settings saved successfully.",
      settings: serialize(settings),
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to save Airtime and Data settings." },
      { status: 500 }
    );
  }
}
