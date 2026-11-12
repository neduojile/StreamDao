import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";

const schema = z.object({
  fullName: z.string().trim().min(2).max(80),
  username: z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(7).max(20),
  password: z.string().min(8).max(72),
  referralCode: z.string().trim().max(32).optional().or(z.literal("")),
});

function makeReferralCode() {
  return randomBytes(6).toString("hex").toUpperCase();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid registration details." },
        { status: 400 }
      );
    }

    const { fullName, username, email, phone, password, referralCode } = parsed.data;
    const normalizedEmail = email.toLowerCase();
    const normalizedUsername = username.toLowerCase();

    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizedEmail },
          { username: normalizedUsername },
          { phone },
        ],
      },
      select: { email: true, username: true, phone: true },
    });

    if (existing) {
      const field = existing.email === normalizedEmail
        ? "Email"
        : existing.username === normalizedUsername
          ? "Username"
          : "Phone number";

      return NextResponse.json(
        { error: `${field} is already registered.` },
        { status: 409 }
      );
    }

    let referredById: string | undefined;

    if (referralCode) {
      const referrer = await prisma.user.findUnique({
        where: { referralCode: referralCode.toUpperCase() },
        select: { id: true },
      });

      if (!referrer) {
        return NextResponse.json(
          { error: "That referral code is invalid." },
          { status: 400 }
        );
      }

      referredById = referrer.id;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    type CreatedUser = {
      id: string;
      fullName: string;
      username: string;
      email: string;
      referralCode: string;
    };

    let user: CreatedUser | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        user = await prisma.$transaction(async (tx) => {
          const newUser = await tx.user.create({
            data: {
              fullName,
              username: normalizedUsername,
              email: normalizedEmail,
              phone,
              passwordHash,
              referralCode: makeReferralCode(),
              ...(referredById ? { referredById } : {}),
            },
            select: {
              id: true,
              fullName: true,
              username: true,
              email: true,
              referralCode: true,
            },
          });

          if (referredById) {
            const directReward = new Prisma.Decimal("0.50");

            await tx.wallet.upsert({
              where: { userId: referredById },
              create: {
                userId: referredById,
                referralBalance: directReward,
              },
              update: {
                referralBalance: { increment: directReward },
              },
            });

            await tx.transaction.create({
              data: {
                userId: referredById,
                walletType: "REFERRAL",
                type: "CREDIT",
                category: "DIRECT_REFERRAL",
                description: `Direct referral reward: ${normalizedUsername}`,
                amount: directReward,
                status: "COMPLETED",
              },
            });

            const directReferrer = await tx.user.findUnique({
              where: { id: referredById },
              select: { referredById: true },
            });

            const secondaryReferrerId = directReferrer?.referredById;

            if (secondaryReferrerId) {
              const secondaryReward = new Prisma.Decimal("0.20");

              await tx.wallet.upsert({
                where: { userId: secondaryReferrerId },
                create: {
                  userId: secondaryReferrerId,
                  referralBalance: secondaryReward,
                },
                update: {
                  referralBalance: { increment: secondaryReward },
                },
              });

              await tx.transaction.create({
                data: {
                  userId: secondaryReferrerId,
                  walletType: "REFERRAL",
                  type: "CREDIT",
                  category: "SECONDARY_REFERRAL",
                  description: `Secondary referral reward: ${normalizedUsername}`,
                  amount: secondaryReward,
                  status: "COMPLETED",
                },
              });
            }
          }

          return newUser;
        });

        break;
      } catch (error: unknown) {
        const code = (error as { code?: string })?.code;

        if (code === "P2002" && attempt < 2) continue;

        if (code === "P2002") {
          return NextResponse.json(
            { error: "Those details are already in use. Please check and try again." },
            { status: 409 }
          );
        }

        throw error;
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: "Could not create your account." },
        { status: 500 }
      );
    }

    const token = await createSession(user.id);

    const response = NextResponse.json(
      { message: "Account created successfully.", user },
      { status: 201 }
    );

    response.cookies.set("streamdao_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error("Registration error:", error);

    return NextResponse.json(
      { error: "Something went wrong while creating your account." },
      { status: 500 }
    );
  }
}