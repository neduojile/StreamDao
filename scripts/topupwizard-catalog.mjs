import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { createDecipheriv, createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";

const prisma = new PrismaClient();

function decryptSecret(payload) {
  const secret = process.env.COUPON_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) {
    throw new Error("COUPON_ENCRYPTION_KEY is missing or invalid.");
  }

  const [ivEncoded, tagEncoded, encryptedEncoded] = payload.split(":");
  const key = createHash("sha256").update(secret, "utf8").digest();
  const iv = Buffer.from(ivEncoded, "base64");
  const tag = Buffer.from(tagEncoded, "base64");
  const encrypted = Buffer.from(encryptedEncoded, "base64");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");
}

async function main() {
  const settings = await prisma.couponSettings.findUnique({
    where: { id: "default" },
    select: { topupWizardTokenEncrypted: true },
  });

  if (!settings?.topupWizardTokenEncrypted) {
    throw new Error("No saved TopupWizard token found in StreamDao.");
  }

  const token = decryptSecret(settings.topupWizardTokenEncrypted);

  const headers = {
    "Authorization-Token": token,
    "Accept": "application/json",
    "Content-Type": "application/json",
  };

  console.log("\nChecking TopupWizard connection...");

  const balanceResponse = await fetch(
    "https://topupwizard.com/api/balance",
    { headers, signal: AbortSignal.timeout(20000) }
  );

  const balance = await balanceResponse.json();

  if (!balanceResponse.ok || balance.status !== "success") {
    throw new Error(balance.message || "Provider connection failed.");
  }

  console.log("Provider connection verified.");
  console.log("Provider balance:", balance.data?.funds ?? "Unavailable");

  const networks = ["mtn", "airtel", "glo", "9mobile"];
  const dataTypes = ["sme", "cg", "direct"];
  const results = [];

  for (const network of networks) {
    console.log(`\n========== ${network.toUpperCase()} ==========`);

    const requests = [
      { type: "airtime", typeSingle: network },
      ...dataTypes.map(dataType => ({
        type: "data",
        typeSingle: network,
        dataType,
      })),
    ];

    for (const body of requests) {
      const label = body.type === "airtime"
        ? "AIRTIME"
        : `DATA - ${body.dataType.toUpperCase()}`;

      try {
        const response = await fetch(
          "https://topupwizard.com/api/pricing",
          {
            method: "POST",
            headers,
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(20000),
          }
        );

        const payload = await response.json();

        if (!response.ok || payload.status !== "success") {
          console.log(`${label}: ${payload.message || "Lookup failed"}`);
          continue;
        }

        const items = Array.isArray(payload.data)
          ? payload.data
          : payload.data ? [payload.data] : [];

        console.log(`\n--- ${label}: ${items.length} services ---`);

        for (const item of items) {
          const entry = {
            network: item.network ?? network,
            type: item.type ?? body.type,
            dataType: item.dataType ?? null,
            serviceID: String(item.serviceID ?? ""),
            description: item.description ?? "",
            amount: item.amount ?? null,
            isActive: item.isActive === true,
            channel: item.channel ?? null,
          };

          results.push(entry);

          console.log(
            `${entry.serviceID} | ${entry.description} | ${entry.amount} | Active: ${entry.isActive}`
          );
        }
      } catch (error) {
        console.log(`${label}: ${error.message}`);
      }
    }
  }

  await writeFile(
    "topupwizard-catalog.json",
    JSON.stringify(results, null, 2),
    "utf8"
  );

  console.log("\nCatalog inspection completed.");
  console.log(`Total services retrieved: ${results.length}`);
  console.log("Saved to topupwizard-catalog.json");
}

main()
  .catch(error => {
    console.error("Catalog inspection failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });