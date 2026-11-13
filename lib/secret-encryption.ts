import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function getEncryptionKey(): Buffer {
  const secret = process.env.COUPON_ENCRYPTION_KEY;

  if (!secret || secret.length < 32) {
    throw new Error("A valid COUPON_ENCRYPTION_KEY is required.");
  }

  return createHash("sha256").update(secret, "utf8").digest();
}

export function encryptSecret(value: string): string {
  if (!value) throw new Error("Cannot encrypt an empty secret.");

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);

  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(":");

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted secret format.");
  }

  const [ivEncoded, tagEncoded, encryptedEncoded] = parts;

  const iv = Buffer.from(ivEncoded, "base64");
  const tag = Buffer.from(tagEncoded, "base64");
  const encrypted = Buffer.from(encryptedEncoded, "base64");

  if (iv.length !== 12 || tag.length !== 16 || !encrypted.length) {
    throw new Error("Invalid encrypted secret payload.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    iv
  );

  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");
}