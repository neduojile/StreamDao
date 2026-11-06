const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const readline = require("readline/promises");

const prisma = new PrismaClient();
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function main() {
  const count = await prisma.admin.count();

  if (count > 0) {
    throw new Error("An administrator already exists. Setup is locked.");
  }

  const fullName = (await rl.question("Admin full name: ")).trim();
  const email = (await rl.question("Admin email: ")).trim().toLowerCase();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;

  if (!fullName || !email || !password || password.length < 12) {
    throw new Error("Name, email and a password of at least 12 characters are required.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.admin.create({
    data: {
      fullName,
      email,
      passwordHash,
      role: "SUPER_ADMIN",
      isActive: true,
    },
  });

  console.log("Super Admin created successfully.");
  console.log("Admin ID:", admin.id);
  console.log("Admin email:", admin.email);
}

main()
  .catch((error) => {
    console.error("Admin setup failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    await prisma.$disconnect();
  });