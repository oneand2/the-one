export const PURCHASE_CONSENT_VERSION = '2026-10-17';

export function purchaseConsentKey(userId: string) {
  return `the-one:purchase-consent:${userId}`;
}

export function hasPurchaseConsent(userId: string) {
  if (typeof window === 'undefined' || !userId) return false;
  try {
    const record = JSON.parse(window.localStorage.getItem(purchaseConsentKey(userId)) || 'null');
    return record?.version === PURCHASE_CONSENT_VERSION
      && typeof record.acceptedAt === 'number' && record.acceptedAt > 0 && record.acceptedAt <= Date.now();
  } catch {
    return false;
  }
}

export function savePurchaseConsent(userId: string, accepted: boolean) {
  if (typeof window === 'undefined' || !userId) return;
  try {
    if (accepted) {
      window.localStorage.setItem(purchaseConsentKey(userId), JSON.stringify({
        version: PURCHASE_CONSENT_VERSION, acceptedAt: Date.now(),
      }));
    } else {
      window.localStorage.removeItem(purchaseConsentKey(userId));
    }
  } catch {}
}
