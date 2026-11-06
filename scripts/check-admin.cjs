const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const admins = await prisma.admin.findMany({
    select: {
      email: true,
      fullName: true,
      role: true,
      isActive: true,
    },
  });

  console.table(admins);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
