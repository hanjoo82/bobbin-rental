import { convert as romanize } from "hangul-romanization";

/**
 * Convert an owner name (Korean or otherwise) into a deterministic slug
 * suitable for the local part of a synthetic email address.
 *
 * Rules:
 *  - Hangul → roman (revised romanization)
 *  - lowercase, ASCII only
 *  - strip everything except [a-z0-9]; collapse to a single token
 *  - if the result is empty, fall back to "owner"
 */
export function ownerNameToSlug(name: string): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "owner";
  let roman: string;
  try {
    roman = romanize(trimmed);
  } catch {
    roman = trimmed;
  }
  const slug = roman.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return slug || "owner";
}

export const OWNER_EMAIL_DOMAIN = "owner.local";
export const OWNER_DEFAULT_PASSWORD = "1234";

export function ownerNameToEmail(name: string): string {
  return `${ownerNameToSlug(name)}@${OWNER_EMAIL_DOMAIN}`;
}
