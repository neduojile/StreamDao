import { NextRequest, NextResponse } from "next/server";
import { randomInt, createHash, createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-auth";

function generateCode() {
  const digits = () => String(randomInt(1000)).padStart(3, "0");
  return `SD-${digits()}-${digits()}-${digits()}`;
}

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}
function getCouponKey() {
  const value = process.env.COUPON_ENCRYPTION_KEY;
  if (!value || !/^[a-f0-9]{64}$/i.test(value)) {
    throw new Error("Coupon encryption key is missing or invalid.");
  }
  return Buffer.from(value, "hex");
}

function encryptCode(code: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getCouponKey(), iv);
  const encrypted = Buffer.concat([cipher.update(code, "utf8"), cipher.final()]);
  return [
    iv.toString("hex"),
    cipher.getAuthTag().toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

function decryptCode(value: string) {
  const [iv, tag, encrypted] = value.split(":");
  const decipher = createDecipheriv("aes-256-gcm", getCouponKey(), Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

export async function GET(request: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await prisma.withdrawalCoupon.updateMany({
      where: { status: "ACTIVE", expiresAt: { lte: new Date() } },
      data: { status: "EXPIRED" },
    });
    const batchId = new URL(request.url).searchParams.get("batchId");
    if (batchId) {
      const coupons = await prisma.withdrawalCoupon.findMany({
        where: { batchId },
        orderBy: { createdAt: "asc" },
        take: 1000,
        select: {
          id: true,
          encryptedCode: true,
          status: true,
          expiresAt: true,
          createdAt: true,
        },
      });

      return NextResponse.json({
        coupons: coupons.map((coupon) => ({
          id: coupon.id,
          code: coupon.encryptedCode ? decryptCode(coupon.encryptedCode) : null,
          status: coupon.status,
          expiresAt: coupon.expiresAt,
          createdAt: coupon.createdAt,
        })),
      });
    }

    const [batches, stats, settings] = await Promise.all([
      prisma.couponBatch.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { _count: { select: { coupons: true } } },
      }),
      prisma.withdrawalCoupon.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.couponSettings.findUnique({ where: { id: "default" } }),
    ]);

    return NextResponse.json({
      batches,
      stats,
      customerServiceUrl: settings?.customerServiceUrl ?? "",
    });
  } catch (error) {
    console.error("Coupon GET error:", error);
    return NextResponse.json(
      { error: "Unable to load coupon information." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const count = Number(body.count);
    const name = String(body.name ?? "").trim().slice(0, 80);

    if (!Number.isInteger(count) || count < 1 || count > 1000) {
      return NextResponse.json(
        { error: "Generate between 1 and 1,000 coupons per batch." },
        { status: 400 }
      );
    }

    const expiresAt = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);

    const result = await prisma.$transaction(async (tx) => {
      const batch = await tx.couponBatch.create({
        data: {
          name: name || null,
          totalCodes: count,
          createdByAdminId: admin.id,
          expiresAt,
        },
      });

      const issuedCodes = new Map<string, string>();
      let attempts = 0;

      while (issuedCodes.size < count && attempts < 20) {
        attempts++;

        const remaining = count - issuedCodes.size;
        const candidateCount = remaining;
        const candidates = new Map<string, string>();

        while (candidates.size < candidateCount) {
          const code = generateCode();
          candidates.set(hashCode(code), code);
        }

        const candidateHashes = Array.from(candidates.keys());

        await tx.withdrawalCoupon.createMany({
          data: candidateHashes.map((codeHash) => ({
            batchId: batch.id,
            codeHash,
            encryptedCode: encryptCode(candidates.get(codeHash)!),
            expiresAt,
          })),
          skipDuplicates: true,
        });

        const inserted = await tx.withdrawalCoupon.findMany({
          where: {
            batchId: batch.id,
            codeHash: { in: candidateHashes },
          },
          select: { codeHash: true },
        });

        for (const item of inserted) {
          const plaintext = candidates.get(item.codeHash);
          if (plaintext) issuedCodes.set(item.codeHash, plaintext);
        }
      }

      if (issuedCodes.size !== count) {
        throw new Error("Unique code generation limit reached. Please retry.");
      }

      return { batch, codes: Array.from(issuedCodes.values()) };
    }, {
      isolationLevel: "Serializable",
      maxWait: 10000,
      timeout: 30000,
    });

    return NextResponse.json({
      success: true,
      batch: result.batch,
      codes: result.codes,
      message: `${count} unique coupon codes generated successfully. They expire in 20 days.`,
    });
  } catch (error) {
    console.error("Coupon generation error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : "Unable to generate coupon codes.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const scope = body.scope;
    const batchId = String(body.batchId ?? "").trim();

    if (scope !== "all" && scope !== "batch") {
      return NextResponse.json(
        { error: "Choose all coupons or one batch." },
        { status: 400 }
      );
    }

    if (scope === "batch" && !batchId) {
      return NextResponse.json(
        { error: "A batch ID is required." },
        { status: 400 }
      );
    }

    const result = await prisma.withdrawalCoupon.updateMany({
      where: {
        ...(scope === "batch" ? { batchId } : {}),
        status: { in: ["ACTIVE", "EXPIRED"] },
      },
      data: {
        status: "DELETED",
        disabledAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
      message: `${result.count} unused coupons revoked. Their records remain protected against reuse.`,
    });
  } catch (error) {
    console.error("Coupon revocation error:", error);
    return NextResponse.json(
      { error: "Unable to revoke coupon codes." },
      { status: 500 }
    );
  }
}
