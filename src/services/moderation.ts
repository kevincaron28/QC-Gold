const UNIT_MS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

// Discord's own hard cap on member timeouts.
export const MAX_TIMEOUT_MS = 28 * UNIT_MS.d;

export function parseDuration(input: string): number {
  const match = /^(\d+)\s*([smhd])$/i.exec(input.trim());
  if (!match) throw new Error("Duration must look like 30m, 2h, or 1d.");
  const unit = match[2]!.toLowerCase() as keyof typeof UNIT_MS;
  const ms = Number(match[1]) * UNIT_MS[unit];
  if (ms <= 0) throw new Error("Duration must be greater than zero.");
  if (ms > MAX_TIMEOUT_MS) throw new Error("Timeouts can be at most 28 days.");
  return ms;
}

export function requireReason(reason: string): string {
  const trimmed = reason.trim();
  if (trimmed.length < 3) throw new Error("A reason of at least 3 characters is required.");
  return trimmed;
}

export interface HierarchyInput {
  actorPosition: number;
  targetPosition: number;
  botPosition: number;
  actorIsOwner: boolean;
  targetIsOwner: boolean;
}

// Mirrors Discord's own role-hierarchy rules so the bot refuses up front with
// a clear message instead of failing with an opaque API error, and so an
// officer can never use the bot to act on someone above their own rank.
export function hierarchyError(input: HierarchyInput): string | null {
  if (input.targetIsOwner) return "The server owner cannot be moderated.";
  if (!input.actorIsOwner && input.actorPosition <= input.targetPosition) {
    return "You cannot moderate someone whose highest role is equal to or above yours.";
  }
  if (input.botPosition <= input.targetPosition) {
    return "My role is not high enough to moderate that member. Move the bot role above theirs.";
  }
  return null;
}
