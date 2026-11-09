import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const DEFAULT_WHOT_PRIZES = [
  { label: "€0.05", amount: "0.05", probability: "30.0000", color: "#B9F34B", sortOrder: 0 },
  { label: "€0.10", amount: "0.10", probability: "25.0000", color: "#8FDA3D", sortOrder: 1 },
  { label: "€0.15", amount: "0.15", probability: "18.0000", color: "#C9FF6C", sortOrder: 2 },
  { label: "€0.20", amount: "0.20", probability: "12.0000", color: "#5CAE43", sortOrder: 3 },
  { label: "€0.25", amount: "0.25", probability: "8.0000", color: "#D6F27D", sortOrder: 4 },
  { label: "€0.50", amount: "0.50", probability: "5.0000", color: "#3D8242", sortOrder: 5 },
  { label: "€1.00", amount: "1.00", probability: "1.8000", color: "#D7B45A", sortOrder: 6 },
  { label: "€3.00", amount: "3.00", probability: "0.2000", color: "#F1D17B", sortOrder: 7 },
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