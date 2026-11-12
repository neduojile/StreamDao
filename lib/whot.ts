import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const DEFAULT_WHOT_PRIZES = [
  { label: "€10.00", amount: "10.00", probability: "0.5000", color: "#B9F34B", sortOrder: 0 },
  { label: "€9.00", amount: "9.00", probability: "1.0000", color: "#8FDA3D", sortOrder: 1 },
  { label: "€8.00", amount: "8.00", probability: "1.5000", color: "#C9FF6C", sortOrder: 2 },
  { label: "€7.00", amount: "7.00", probability: "2.0000", color: "#5CAE43", sortOrder: 3 },
  { label: "€6.00", amount: "6.00", probability: "3.0000", color: "#D6F27D", sortOrder: 4 },
  { label: "€5.00", amount: "5.00", probability: "5.0000", color: "#3D8242", sortOrder: 5 },
  { label: "€4.00", amount: "4.00", probability: "7.0000", color: "#D7B45A", sortOrder: 6 },
  { label: "€3.00", amount: "3.00", probability: "10.0000", color: "#F1D17B", sortOrder: 7 },
  { label: "€2.00", amount: "2.00", probability: "15.0000", color: "#B9F34B", sortOrder: 8 },
  { label: "€1.00", amount: "1.00", probability: "20.0000", color: "#8FDA3D", sortOrder: 9 },
  { label: "€0.50", amount: "0.50", probability: "35.0000", color: "#C9FF6C", sortOrder: 10 },
];

export function getLagosDayKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export async function ensureWhotConfiguration() {
  const settings = await prisma.whotSettings.upsert({
    where: { id: "default" },
    create: { id: "default", isEnabled: true, dailySpinLimit: 3 },
    update: {},
  });

  const count = await prisma.whotPrize.count({
    where: { settingsId: settings.id },
  });

  if (count === 0) {
    await prisma.whotPrize.createMany({
      data: DEFAULT_WHOT_PRIZES.map((prize) => ({
        ...prize,
        settingsId: settings.id,
        amount: new Prisma.Decimal(prize.amount),
        probability: new Prisma.Decimal(prize.probability),
      })),
    });
  }

  const prizes = await prisma.whotPrize.findMany({
    where: { settingsId: settings.id, isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  return { settings, prizes };
}