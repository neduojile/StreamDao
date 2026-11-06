import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const secret = process.env.ADMIN_AUTH_SECRET;

if (!secret) {
  throw new Error("ADMIN_AUTH_SECRET is missing from environment variables");
}

const key = new TextEncoder().encode(secret);

export async function createAdminSession(adminId: string) {
  return new SignJWT({ adminId, type: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(key);
}

export async function verifyAdminSession(token: string) {
  try {
    const { payload } = await jwtVerify(token, key);

    if (
      typeof payload.adminId !== "string" ||
      payload.type !== "admin"
    ) {
      return null;
    }

    const admin = await prisma.admin.findUnique({
      where: { id: payload.adminId },
      select: { id: true, fullName: true, email: true, role: true, isActive: true },
    });

    if (!admin || !admin.isActive) return null;

    return admin;
  } catch {
    return null;
  }
}

export async function getCurrentAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("streamdao_admin_session")?.value;

  if (!token) return null;

  return verifyAdminSession(token);
}