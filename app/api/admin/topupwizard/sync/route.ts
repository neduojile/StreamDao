import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { decryptSecret } from "@/lib/secret-encryption";

const networks = ["mtn", "airtel", "glo", "9mobile"] as const;
const dataTypes = ["sme", "cg", "direct"] as const;

type ProviderPlan = {
  serviceID?: string | number;
  network?: string;
  type?: string;
  dataType?: string;
  description?: string;
  amount?: string | number;
  isActive?: boolean;
};

export async function POST() {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await prisma.couponSettings.findUnique({
      where: { id: "default" },
      select: { topupWizardTokenEncrypted: true },
    });

    if (!settings?.topupWizardTokenEncrypted) {
      return NextResponse.json(
        { error: "TopupWizard credentials are not configured." },
        { status: 400 }
      );
    }

    const token = decryptSecret(settings.topupWizardTokenEncrypted);
    const headers = {
      "Authorization-Token": token,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const plans: Array<{
      serviceId: string;
      network: string;
      type: string;
      name: string;
      amountNgn: Prisma.Decimal;
      isActive: boolean;
      lastSyncedAt: Date;
    }> = [];

    const errors: string[] = [];
    const syncedAt = new Date();

    for (const network of networks) {
      for (const dataType of dataTypes) {
        const response = await fetch("https://topupwizard.com/api/pricing", {
          method: "POST",
          headers,
          body: JSON.stringify({
            type: "data",
            typeSingle: network,
            dataType,
          }),
          cache: "no-store",
          signal: AbortSignal.timeout(20000),
        });

        if (!response.ok) {
          errors.push(`${network}/${dataType}: provider HTTP ${response.status}`);
          continue;
        }

        const payload = await response.json();

        if (payload.status !== "success") {
          if (payload.message !== "No result was found") {
            errors.push(`${network}/${dataType}: ${payload.message || "Lookup failed"}`);
          }
          continue;
        }

        const items: ProviderPlan[] = Array.isArray(payload.data)
          ? payload.data
          : payload.data
            ? [payload.data]
            : [];

        for (const item of items) {
          const serviceId = String(item.serviceID ?? "").trim();
          const amount = String(item.amount ?? "").trim();
          const name = String(item.description ?? "").trim();

          if (
            !serviceId ||
            !name ||
            !/^\d+(\.\d+)?$/.test(amount) ||
            item.type !== "data"
          ) {
            errors.push(`${network}/${dataType}: skipped an invalid provider entry`);
            continue;
          }

          plans.push({
            serviceId,
            network,
            type: dataType,
            name,
            amountNgn: new Prisma.Decimal(amount),
            isActive: item.isActive === true,
            lastSyncedAt: syncedAt,
          });
        }
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        {
          error: "Catalog synchronization aborted. Existing plans were not changed.",
          errors,
        },
        { status: 502 }
      );
    }

    if (plans.length === 0) {
      return NextResponse.json(
        { error: "No valid data plans were retrieved.", errors },
        { status: 502 }
      );
    }

    const serviceIds = plans.map((plan) => plan.serviceId);

    if (new Set(serviceIds).size !== serviceIds.length) {
      return NextResponse.json(
        { error: "Duplicate provider service IDs detected. No changes were saved." },
        { status: 502 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const existingPlans = await tx.airtimePlan.findMany({
        where: { serviceId: { in: serviceIds } },
        select: { serviceId: true },
      });

      const existingIds = new Set(
        existingPlans.map((plan) => plan.serviceId)
      );

      await tx.airtimePlan.updateMany({
        where: { network: { in: [...networks] } },
        data: { isActive: false },
      });

      await Promise.all(
        plans.map((plan) =>
          tx.airtimePlan.upsert({
            where: { serviceId: plan.serviceId },
            create: plan,
            update: {
              network: plan.network,
              type: plan.type,
              name: plan.name,
              amountNgn: plan.amountNgn,
              isActive: plan.isActive,
              lastSyncedAt: plan.lastSyncedAt,
            },
          })
        )
      );

      return {
        created: plans.filter((plan) => !existingIds.has(plan.serviceId)).length,
        updated: plans.filter((plan) => existingIds.has(plan.serviceId)).length,
      };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10000,
      timeout: 60000,
    });

    return NextResponse.json({
      success: true,
      message: "Provider catalog synchronized successfully.",
      total: plans.length,
      active: plans.filter((plan) => plan.isActive).length,
      inactive: plans.filter((plan) => !plan.isActive).length,
      ...result,
      errors,
      syncedAt,
    });
  } catch (error) {
    console.error("TopupWizard catalog sync error:", error);
    return NextResponse.json(
      { error: "Unable to synchronize the provider catalog." },
      { status: 502 }
    );
  }
}