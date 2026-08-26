import { createCipheriv, randomBytes } from "node:crypto";

const VERSION = "enc:v1";

function encryptionKey(): Buffer {
  const value = process.env.FIELD_ENCRYPTION_KEY;
  if (!value) {
    throw new Error(
      "Configuração segura ausente: defina FIELD_ENCRYPTION_KEY no ambiente do servidor.",
    );
  }
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) {
    throw new Error("FIELD_ENCRYPTION_KEY deve conter uma chave Base64 de 32 bytes.");
  }
  return key;
}

/** Criptografa um campo sensível antes de ele ser persistido no Supabase. */
export async function encryptSensitiveValue(value: string): Promise<string> {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}
