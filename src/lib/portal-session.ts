/** Session flag set after the portal password step succeeds on this tab. */
export const PORTAL_VERIFIED_KEY = "chhatralaya_portal_verified";

export function isPortalVerified(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(PORTAL_VERIFIED_KEY) === "1";
}
