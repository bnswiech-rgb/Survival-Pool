export const BANNED_STATES = ['NY', 'CA', 'MT', 'CT', 'NJ', 'TN', 'LA', 'IN', 'OK', 'WA', 'ID'] as const;

/**
 * Extracts the user's US state from Vercel geo headers.
 * Returns a two-letter state abbreviation if the user is in the US, null otherwise.
 * Returns null in local dev (headers not present).
 */
export function getUserState(headers: Headers): string | null {
  const country = headers.get('x-vercel-ip-country');
  if (country !== 'US') return null;
  return headers.get('x-vercel-ip-country-region');
}

/**
 * Returns true if the user's state has banned the dual-currency sweepstakes model.
 * null state (non-US or local dev) is treated as unrestricted.
 */
export function isRestrictedState(state: string | null): boolean {
  if (!state) return false;
  return (BANNED_STATES as readonly string[]).includes(state);
}
