import { NextRequest, NextResponse } from "next/server";


export async function GET(request: NextRequest) {
  const currency = (request.nextUrl.searchParams.get("currency") || "").toUpperCase();

  if (!/^[A-Z]{3}$/.test(currency)) {
    return NextResponse.json({ error: "Invalid currency code." }, { status: 400 });
  }

  try {
    const response = await fetch("https://open.er-api.com/v6/latest/EUR", {
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      throw new Error("Exchange rate provider unavailable.");
    }

    const data = await response.json();
    const rate = data?.rates?.[currency];

    if (data?.result !== "success" || typeof rate !== "number" || !Number.isFinite(rate)) {
      return NextResponse.json(
        { error: "Exchange rate is unavailable for this currency." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      base: "EUR",
      currency,
      rate,
      updatedAt: data.time_last_update_utc ?? null,
      provider: "ExchangeRate-API",
    });
  } catch (error) {
    console.error("Exchange rate error:", error);
    return NextResponse.json(
      { error: "Unable to retrieve the exchange rate. Please try again." },
      { status: 503 }
    );
  }
}