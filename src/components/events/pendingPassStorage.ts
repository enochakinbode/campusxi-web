export type PendingPass = {
  eventId: string;
  reference: string;
  tier: string;
  createdAt: number;
  authorizationUrl?: string;
  accessCode?: string;
  paystackProductId?: string;
};

const STORAGE_KEY = "campusxi.pendingPasses";

export function getPendingPasses() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    const parsed = value ? JSON.parse(value) : [];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isPendingPass);
  } catch {
    return [];
  }
}

export function getPendingPass(eventId: string) {
  return getPendingPasses()
    .filter((pendingPass) => pendingPass.eventId === eventId)
    .sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
}

export function savePendingPass(pendingPass: PendingPass) {
  const nextPasses = [
    pendingPass,
    ...getPendingPasses().filter(
      (item) =>
        item.eventId !== pendingPass.eventId ||
        item.reference !== pendingPass.reference,
    ),
  ];

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextPasses));
}

export function removePendingPass(eventId: string, reference: string) {
  const nextPasses = getPendingPasses().filter(
    (item) => item.eventId !== eventId || item.reference !== reference,
  );

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextPasses));
}

function isPendingPass(value: unknown): value is PendingPass {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Record<string, unknown>;

  return (
    typeof item.eventId === "string" &&
    typeof item.reference === "string" &&
    typeof item.tier === "string" &&
    typeof item.createdAt === "number" &&
    optionalString(item.authorizationUrl) &&
    optionalString(item.accessCode) &&
    optionalString(item.paystackProductId)
  );
}

function optionalString(value: unknown) {
  return value === undefined || typeof value === "string";
}
