import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export const SECRET_PREFIX = "enc:v1:";
export const REENTER_PASSWORD_MESSAGE = "re-enter the password";

function keyBytes(raw) {
  const value = String(raw ?? "").trim();
  if (!value) {
    const error = new Error("Fire Recovery credential key is not configured.");
    error.code = "SECRET_KEY_MISSING";
    throw error;
  }
  return createHash("sha256").update(value, "utf8").digest();
}

function reenter(code) {
  const error = new Error(REENTER_PASSWORD_MESSAGE);
  error.code = code;
  return error;
}

export function isEncryptedSecret(value) {
  return String(value ?? "").startsWith(SECRET_PREFIX);
}

export function encryptSecret(plain, keyMaterial = process.env.FIRE_RECOVERY_CREDENTIAL_KEY) {
  const key = keyBytes(keyMaterial);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return SECRET_PREFIX + Buffer.concat([iv, tag, ciphertext]).toString("base64url");
}

export function decryptSecret(stored, keyMaterial = process.env.FIRE_RECOVERY_CREDENTIAL_KEY) {
  const text = String(stored ?? "");
  if (!isEncryptedSecret(text)) {
    throw reenter("SECRET_PLAINTEXT");
  }
  const key = keyBytes(keyMaterial);
  const buf = Buffer.from(text.slice(SECRET_PREFIX.length), "base64url");
  if (buf.length < 29) {
    throw reenter("SECRET_CORRUPT");
  }
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch (error) {
    if (error && error.code === "SECRET_KEY_MISSING") throw error;
    throw reenter("SECRET_UNREADABLE");
  }
}
