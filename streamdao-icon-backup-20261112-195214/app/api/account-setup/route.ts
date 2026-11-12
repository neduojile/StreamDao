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

    const supportedCountries: Record<string, { name: string; currency: string }> = {
      NG: { name: "Nigeria", currency: "NGN" },
      GH: { name: "Ghana", currency: "GHS" },
      KE: { name: "Kenya", currency: "KES" },
      EG: { name: "Egypt", currency: "EGP" },
      ZA: { name: "South Africa", currency: "ZAR" },
      CM: { name: "Cameroon", currency: "XAF" },
      ZM: { name: "Zambia", currency: "ZMW" },
    };

    const supportedCryptoNetworks = [
      "Bitcoin (BTC)", "Ethereum (ERC-20)",
      "BNB Smart Chain (BEP-20)", "TRON (TRC-20)",
      "Solana", "Polygon (POL)", "Arbitrum One",
      "Base", "Avalanche C-Chain", "Optimism",
    ];
    const body = await request.json();
    const payoutMethod = String(body.payoutMethod ?? "").toUpperCase();

    if (!["BANK", "CRYPTO"].includes(payoutMethod)) {
      return NextResponse.json(
        { error: "Invalid payout method" },
        { status: 400 }
      );
    }

    const data =
      payoutMethod === "BANK"
        ? {
            payoutMethod,
            bankName: String(body.bankName ?? "").trim(),
            accountName: String(body.accountName ?? "").trim(),
            accountNumber: String(body.accountNumber ?? "").trim(),
            bankCode: String(body.bankCode ?? "").trim() || null,
            countryCode: String(body.countryCode ?? "").trim().toUpperCase(),
            countryName: String(body.countryName ?? "").trim(),
            payoutCurrency: String(body.payoutCurrency ?? "").trim().toUpperCase(),
            cryptoNetwork: null,
            walletAddress: null,
          }
        : {
            payoutMethod,
            bankName: null,
            accountName: null,
            accountNumber: null,
            bankCode: null,
            countryCode: null,
            countryName: null,
            payoutCurrency: null,
            cryptoNetwork: String(body.cryptoNetwork ?? "").trim(),
            walletAddress: String(body.walletAddress ?? "").trim(),
          };

    if (
      payoutMethod === "BANK" &&
      (!data.bankName ||
        !data.accountName ||
        !data.accountNumber ||
        !data.countryName ||
        !/^[A-Z]{2}$/.test(data.countryCode) ||
        !/^[A-Z]{3}$/.test(data.payoutCurrency) || !supportedCountries[data.countryCode] || supportedCountries[data.countryCode].name !== data.countryName || supportedCountries[data.countryCode].currency !== data.payoutCurrency)
    ) {
      return NextResponse.json(
        { error: "Complete your bank details and select a valid country." },
        { status: 400 }
      );
    }

    if (
      payoutMethod === "CRYPTO" &&
      (!data.cryptoNetwork || !data.walletAddress || !supportedCryptoNetworks.includes(data.cryptoNetwork))
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
  } catch (error) {
    console.error("Account setup POST error:", error);

    return NextResponse.json(
      { error: "Unable to save payout details" },
      { status: 500 }
    );
  }
}