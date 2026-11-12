import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";

const schema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().min(1).max(72),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = schema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: "Enter your login details." }, { status: 400 });
    }

    const { identifier, password } = parsed.data;
    const normalized = identifier.toLowerCase();

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: normalized },
          { username: normalized },
        ],
      },
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return NextResponse.json(
        { error: "Invalid email, username or password." },
        { status: 401 }
      );
    }

    const token = await createSession(user.id);
    const response = NextResponse.json({
      message: "Login successful.",
      user: {
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
      },
    });

    response.cookies.set("streamdao_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Unable to log in right now." }, { status: 500 });
  }
}