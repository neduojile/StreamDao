import { NextRequest, NextResponse, connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  await connection();
  try {
    const token = request.cookies.get("streamdao_session")?.value;

    if (!token) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const userId = await verifySession(token);

    if (!userId) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        username: true,
        email: true,
        referralCode: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Session verification error:", error);
    return NextResponse.json({ error: "Unable to verify session." }, { status: 500 });
  }
}