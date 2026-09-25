// The /setup checklist: what's configured, what's missing, and exactly how
// to fix each missing thing. Pure (takes plain data) so it's easy to test.

export interface SetupFacts {
  existingRoleNames: string[];
  requiredRoleNames: string[];
  notifyChannel: ChannelFact | null;
  raidChannel: ChannelFact | null;
  logChannel: ChannelFact | null;
  welcomeChannel: ChannelFact | null;
  // Auto-roles the bot must be able to hand out (null when not configured).
  autoRoles: { name: string; botCanAssign: boolean }[];
  epgpConfigured: boolean;
  remindersOn: boolean;
  weeklyReportOn: boolean;
  companionTokenSet: boolean;
  linkedCharacters: number;
}

export interface ChannelFact {
  name: string;
  exists: boolean;
  botCanPost: boolean;
}

export interface SetupCheck {
  label: string;
  ok: boolean;
  optional: boolean;
  fix: string;
}

function channelCheck(label: string, fact: ChannelFact | null, optional: boolean, fix: string): SetupCheck {
  if (!fact) return { label, ok: false, optional, fix };
  if (!fact.exists) return { label, ok: false, optional, fix: `The saved channel was deleted. ${fix}` };
  if (!fact.botCanPost) return { label: `${label} (#${fact.name})`, ok: false, optional, fix: `I can't post in #${fact.name}. Give my role "Send Messages" and "Embed Links" there, or pick another channel.` };
  return { label: `${label} (#${fact.name})`, ok: true, optional, fix: "" };
}

export function setupChecks(facts: SetupFacts): SetupCheck[] {
  const missingRoles = facts.requiredRoleNames.filter((name) => !facts.existingRoleNames.includes(name));
  const checks: SetupCheck[] = [
    {
      label: "Permission roles (Guild Master, Officer, Raid Leader, DKP Officer)",
      ok: missingRoles.length === 0,
      optional: false,
      fix: `Missing: ${missingRoles.join(", ")}. Run /setup and press "Create missing roles", then give them to your officers.`
    },
    channelCheck("Announcements channel", facts.notifyChannel, false, "Run /setup, step 2 (Channels)."),
    channelCheck("Raid signups channel", facts.raidChannel, false, "Run /setup, step 2 (Channels)."),
    channelCheck("Officer log channel", facts.logChannel, false, "Run /setup, step 2 (Channels)."),
    channelCheck("Welcome channel", facts.welcomeChannel, true, "Optional: run /setup, step 3 (Welcome)."),
    ...facts.autoRoles.map((role) => ({
      label: `Auto-role "${role.name}"`,
      ok: role.botCanAssign,
      optional: true,
      fix: `My role must be above "${role.name}": Server Settings > Roles, drag my role higher.`
    })),
    {
      label: "EPGP point values (base GP set)",
      ok: facts.epgpConfigured,
      optional: true,
      fix: "Defaults work, but base GP is 0: run /setup step 4 and press \"Use recommended values\"."
    },
    { label: "Raid reminders", ok: facts.remindersOn, optional: true, fix: "Optional: turn them on in /setup step 4." },
    { label: "Weekly guild report", ok: facts.weeklyReportOn, optional: true, fix: "Optional: turn it on in /setup step 4." },
    {
      label: "Companion link to the WoW addon",
      ok: facts.companionTokenSet,
      optional: true,
      fix: "Needed only to sync the addon: put COMPANION_UPLOAD_TOKEN in .env.local (and the same value in companion.config.json), then restart the bot."
    },
    {
      label: "Characters linked",
      ok: facts.linkedCharacters > 0,
      optional: true,
      fix: "Everyone runs /character add once so addon data and EPGP match them."
    }
  ];
  return checks;
}

// One line per check for an embed: ✅ done, ❌ needed, ➖ optional and off.
export function formatChecks(checks: SetupCheck[]): string {
  return checks.map((check) => {
    if (check.ok) return `✅ ${check.label}`;
    return `${check.optional ? "➖" : "❌"} ${check.label}\n   ↳ ${check.fix}`;
  }).join("\n");
}

export function setupComplete(checks: SetupCheck[]): boolean {
  return checks.every((check) => check.ok || check.optional);
}
