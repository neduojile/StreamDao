import { cookies } from "next/headers";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";
import AirtimeClient from "./airtime-client";

export const instant = false;

export default async function AirtimePage() {

  const cookieStore = await cookies();
  const token = cookieStore.get("streamdao_session")?.value;

  if (!token) redirect("/login");

  const userId = await verifySession(token);
  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      fullName: true,
      username: true,
    },
  });

  if (!user) redirect("/login");

  return (
    <AirtimeClient
      fullName={user.fullName}
      username={user.username}
    />
  );
}


