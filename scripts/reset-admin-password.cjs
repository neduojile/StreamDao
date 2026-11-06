const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_RESET_EMAIL;
  const password = process.env.ADMIN_RESET_PASSWORD;

  if (!email || !password || password.length < 12) {
    throw new Error("Valid email and password of at least 12 characters required.");
  }

  const admin = await prisma.admin.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!admin) throw new Error("Admin account not found.");

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.admin.update({
    where: { id: admin.id },
    data: { passwordHash },
  });

  console.log("Super Admin password updated successfully.");
}

main()
  .catch((error) => {
    console.error("Password reset failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());