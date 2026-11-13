import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-auth";

export async function PATCH(request: NextRequest) {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const rawLimit = body.limitNgn;

    if (!userId) {
      return NextResponse.json({ error: "A valid user is required." }, { status: 400 });
    }

    if (
      rawLimit !== null &&
      (typeof rawLimit !== "number" ||
        !Number.isFinite(rawLimit) ||
        rawLimit < 0 ||
        rawLimit > 50000000)
    ) {
      return NextResponse.json(
        { error: "Enter a valid limit between ₦0 and ₦50,000,000, or clear the override." },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        airtimePurchaseLimitNgn:
          rawLimit === null ? null : new Prisma.Decimal(rawLimit),
      },
      select: {
        id: true,
        airtimePurchaseLimitNgn: true,
      },
    });

    return NextResponse.json({
      success: true,
      user,
      message: rawLimit === null
        ? "Individual purchase limit cleared. The global default will apply."
        : "Individual purchase limit updated.",
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    console.error("Admin airtime limit update:", error);
    return NextResponse.json(
      { error: "Unable to update the user's purchase limit." },
      { status: 500 }
    );
  }
}