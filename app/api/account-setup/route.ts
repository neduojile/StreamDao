import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";

async function getUserId() {
  const token = (await cookies()).get("streamdao_session")?.value;
  if (!token) return null;
  return await verifySession(token);
}

export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await prisma.payoutProfile.findUnique({
      where: { userId },
    });

    return NextResponse.json({ profile });
  } catch {
    return NextResponse.json(
      { error: "Unable to load payout details" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const payoutMethod = String(body.payoutMethod ?? "").toUpperCase();

    if (!["BANK", "CRYPTO"].includes(payoutMethod)) {
      return NextResponse.json({ error: "Invalid payout method" }, { status: 400 });
    }

    const data = payoutMethod === "BANK"
      ? {
          payoutMethod,
          bankName: String(body.bankName ?? "").trim(),
          accountName: String(body.accountName ?? "").trim(),
          accountNumber: String(body.accountNumber ?? "").trim(),
          bankCode: String(body.bankCode ?? "").trim() || null,
          cryptoNetwork: null,
          walletAddress: null,
        }
      : {
          payoutMethod,
          bankName: null,
          accountName: null,
          accountNumber: null,
          bankCode: null,
          cryptoNetwork: String(body.cryptoNetwork ?? "").trim(),
          walletAddress: String(body.walletAddress ?? "").trim(),
        };

    if (
      payoutMethod === "BANK" &&
      (!data.bankName || !data.accountName || !data.accountNumber)
    ) {
      return NextResponse.json(
        { error: "Complete all required bank details" },
        { status: 400 }
      );
    }

    if (
      payoutMethod === "CRYPTO" &&
      (!data.cryptoNetwork || !data.walletAddress)
    ) {
      return NextResponse.json(
        { error: "Enter your network and wallet address" },
        { status: 400 }
      );
    }

    const profile = await prisma.payoutProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });

    return NextResponse.json({ success: true, profile });
  } catch {
    return NextResponse.json(
      { error: "Unable to save payout details" },
      { status: 500 }
    );
  }
}