import { webcrypto } from "node:crypto";

function base64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

export async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
  const random = new Uint8Array(32);
  webcrypto.getRandomValues(random);
  const verifier = base64Url(random);
  const digest = await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = base64Url(new Uint8Array(digest));

  return { verifier, challenge };
}
