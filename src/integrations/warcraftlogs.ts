// Warcraft Logs API v2 (GraphQL, client-credentials). The client id/secret
// live only in the bot's environment, never in the addon.
// Docs: https://www.warcraftlogs.com/api/docs

export interface WclCredentials {
  clientId: string;
  clientSecret: string;
}

export interface ReportRef {
  code: string;
  // Site the report lives on: www., classic., etc. (each has its own API host).
  baseUrl: string;
}

// "https://classic.warcraftlogs.com/reports/aB3dE5gH7jK9mN1p#fight=3" or a
// bare 16-character code. Only warcraftlogs.com hosts are accepted, so the
// bot never sends its credentials anywhere else.
export function parseReportRef(input: string, defaultBaseUrl: string): ReportRef {
  const text = input.trim();
  if (/^[A-Za-z0-9]{12,20}$/.test(text)) return { code: text, baseUrl: defaultBaseUrl.replace(/\/+$/, "") };
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error("Paste the Warcraft Logs report link (https://.../reports/<code>) or just the report code.");
  }
  if (url.protocol !== "https:" || !/^([a-z0-9-]+\.)?warcraftlogs\.com$/i.test(url.hostname)) {
    throw new Error("That link isn't a warcraftlogs.com report.");
  }
  const match = /^\/reports\/([A-Za-z0-9]{12,20})/.exec(url.pathname);
  if (!match?.[1]) throw new Error("I couldn't find a report code in that link (expected .../reports/<code>).");
  return { code: match[1], baseUrl: `https://${url.hostname.toLowerCase()}` };
}

export interface WclFight {
  id: number;
  name: string;
  encounterID: number;
  kill: boolean | null;
  startTime: number;
  endTime: number;
}

export interface WclReport {
  code: string;
  title: string;
  startTime: number;
  endTime: number;
  owner: { name: string } | null;
  zone: { name: string } | null;
  fights: WclFight[];
  players: { name: string; className: string }[];
  // WCL's own numbers for the players (the per-fight data refers to them by id).
  actors?: { id: number; name: string; className: string }[];
}

// A guild's report list entry (no fights; fetch the report for those).
export interface WclReportStub { code: string; title: string; startTime: number; endTime: number; zone: string | null; }

// Raw per-pull data used for the officer-only check: which buffs a player had when a
// boss pull started, and who died. Names only, no performance numbers.
export interface WclFightDetails {
  combatants: { fight: number; actorId: number; auras: string[] }[];
  deaths: { fight: number; name: string }[];
}

// "https://classic.warcraftlogs.com/guild/id/12345", ".../guild/us/thrall/guild-name" or a bare id.
export type GuildRef = { id: number; baseUrl: string } | { name: string; serverSlug: string; serverRegion: string; baseUrl: string };
export function parseGuildRef(input: string, defaultBaseUrl: string): GuildRef {
  const text = input.trim();
  const base = defaultBaseUrl.replace(/\/+$/, "");
  if (/^\d{1,9}$/.test(text)) return { id: Number(text), baseUrl: base };
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error("Paste the guild's Warcraft Logs page link (https://.../guild/id/12345) or its number.");
  }
  if (url.protocol !== "https:" || !/^([a-z0-9-]+\.)?warcraftlogs\.com$/i.test(url.hostname)) {
    throw new Error("That link isn't a warcraftlogs.com guild page.");
  }
  const baseUrl = `https://${url.hostname.toLowerCase()}`;
  const byId = /^\/guild\/id\/(\d{1,9})/.exec(url.pathname);
  if (byId?.[1]) return { id: Number(byId[1]), baseUrl };
  const byName = /^\/guild\/([a-z]{2,3})\/([^/]+)\/([^/]+)/i.exec(url.pathname);
  if (byName?.[1] && byName[2] && byName[3]) {
    return { name: decodeURIComponent(byName[3]), serverSlug: decodeURIComponent(byName[2]).toLowerCase(), serverRegion: byName[1].toUpperCase(), baseUrl };
  }
  throw new Error("I couldn't find the guild in that link (expected .../guild/id/<number>).");
}

const REPORT_QUERY = `query Report($code: String!) {
  reportData {
    report(code: $code) {
      code
      title
      startTime
      endTime
      owner { name }
      zone { name }
      fights { id name encounterID kill startTime endTime }
      masterData { actors(type: "Player") { id name subType } }
    }
  }
}`;

type Fetch = typeof fetch;

export function createWclClient(credentials: WclCredentials, fetchImpl: Fetch = fetch) {
  const tokens = new Map<string, { token: string; expiresAt: number }>();

  async function token(baseUrl: string): Promise<string> {
    const cached = tokens.get(baseUrl);
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
    const response = await fetchImpl(`${baseUrl}/oauth/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok) {
      throw new Error(response.status === 401
        ? "Warcraft Logs rejected the client id/secret. Check WCL_CLIENT_ID and WCL_CLIENT_SECRET in .env.local."
        : `Warcraft Logs login failed (HTTP ${response.status}).`);
    }
    const body = await response.json() as { access_token?: string; expires_in?: number };
    if (!body.access_token) throw new Error("Warcraft Logs login returned no token.");
    tokens.set(baseUrl, { token: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 });
    return body.access_token;
  }

  // One GraphQL call with the shared login; errors come back as plain messages.
  async function graphql<T>(baseUrl: string, query: string, variables: Record<string, unknown>): Promise<T> {
    const response = await fetchImpl(`${baseUrl}/api/v2/client`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await token(baseUrl)}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(20_000)
    });
    if (!response.ok) throw new Error(`Warcraft Logs request failed (HTTP ${response.status}).`);
    const body = await response.json() as { data?: T; errors?: { message: string }[] };
    if (body.errors?.length) throw new Error(`Warcraft Logs: ${body.errors[0]?.message ?? "query failed"}`);
    if (!body.data) throw new Error("Warcraft Logs returned no data.");
    return body.data;
  }

  return {
    // The guild's newest public reports, newest first.
    async listGuildReports(baseUrl: string, guildId: number, limit = 15): Promise<WclReportStub[]> {
      const data = await graphql<{ reportData?: { reports?: { data?: { code: string; title: string; startTime: number; endTime: number; zone?: { name: string } | null }[] } } }>(
        baseUrl,
        "query Reports($guildID: Int!, $limit: Int!) { reportData { reports(guildID: $guildID, limit: $limit) { data { code title startTime endTime zone { name } } } } }",
        { guildID: guildId, limit }
      );
      return (data.reportData?.reports?.data ?? []).map((row) => ({ code: row.code, title: row.title, startTime: row.startTime, endTime: row.endTime, zone: row.zone?.name ?? null }));
    },

    // A guild's id and display name, by id or by name + server + region.
    async findGuild(ref: GuildRef): Promise<{ id: number; name: string; server: string }> {
      const query = "id" in ref
        ? "query G($id: Int!) { guildData { guild(id: $id) { id name server { name } } } }"
        : "query G($name: String!, $slug: String!, $region: String!) { guildData { guild(name: $name, serverSlug: $slug, serverRegion: $region) { id name server { name } } } }";
      const variables = "id" in ref ? { id: ref.id } : { name: ref.name, slug: ref.serverSlug, region: ref.serverRegion };
      const data = await graphql<{ guildData?: { guild?: { id: number; name: string; server?: { name: string } } | null } }>(ref.baseUrl, query, variables);
      const guild = data.guildData?.guild;
      if (!guild) throw new Error("Warcraft Logs has no guild there. Open the guild's page on warcraftlogs.com and paste that link.");
      return { id: guild.id, name: guild.name, server: guild.server?.name ?? "" };
    },

    // Buffs at each of the given boss pulls, and the deaths in them.
    async fetchDetails(ref: ReportRef, fightIds: number[]): Promise<WclFightDetails> {
      const result: WclFightDetails = { combatants: [], deaths: [] };
      if (fightIds.length === 0) return result;
      type EventsPage = { reportData?: { report?: { events?: { data?: unknown; nextPageTimestamp?: number | null } } } };
      let from: number | null = 0;
      for (let page = 0; page < 6 && from !== null; page++) {
        const data: EventsPage = await graphql<EventsPage>(
          ref.baseUrl,
          "query Info($code: String!, $fights: [Int]!, $from: Float!) { reportData { report(code: $code) { events(dataType: CombatantInfo, fightIDs: $fights, startTime: $from, endTime: 99999999999, limit: 10000) { data nextPageTimestamp } } } }",
          { code: ref.code, fights: fightIds, from }
        );
        const events = data.reportData?.report?.events;
        type CombatantEvent = { fight?: unknown; sourceID?: unknown; auras?: unknown };
        for (const raw of Array.isArray(events?.data) ? events.data as CombatantEvent[] : []) {
          if (typeof raw.fight !== "number" || typeof raw.sourceID !== "number") continue;
          const auras = Array.isArray(raw.auras) ? (raw.auras as { name?: unknown }[]).map((aura) => String(aura.name ?? "")).filter(Boolean) : [];
          result.combatants.push({ fight: raw.fight, actorId: raw.sourceID, auras });
        }
        from = events?.nextPageTimestamp ?? null;
      }
      const deaths = await graphql<{ reportData?: { report?: { table?: { data?: { entries?: { name?: string; fight?: number }[] } } } } }>(
        ref.baseUrl,
        "query Deaths($code: String!, $fights: [Int]!) { reportData { report(code: $code) { table(dataType: Deaths, fightIDs: $fights) } } }",
        { code: ref.code, fights: fightIds }
      );
      for (const entry of deaths.reportData?.report?.table?.data?.entries ?? []) {
        if (entry.name) result.deaths.push({ fight: Number(entry.fight ?? 0), name: entry.name });
      }
      return result;
    },

    async fetchReport(ref: ReportRef): Promise<WclReport> {
      const response = await fetchImpl(`${ref.baseUrl}/api/v2/client`, {
        method: "POST",
        headers: { Authorization: `Bearer ${await token(ref.baseUrl)}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: REPORT_QUERY, variables: { code: ref.code } }),
        signal: AbortSignal.timeout(20_000)
      });
      if (!response.ok) throw new Error(`Warcraft Logs request failed (HTTP ${response.status}).`);
      const body = await response.json() as {
        data?: { reportData?: { report?: {
          code: string; title: string; startTime: number; endTime: number;
          owner?: { name: string } | null; zone?: { name: string } | null;
          fights?: WclFight[] | null; masterData?: { actors?: { id: number; name: string; subType: string }[] | null } | null;
        } | null } };
        errors?: { message: string }[];
      };
      if (body.errors?.length) throw new Error(`Warcraft Logs: ${body.errors[0]?.message ?? "query failed"}`);
      const report = body.data?.reportData?.report;
      if (!report) throw new Error("Warcraft Logs has no report with that code (or it's private).");
      return {
        code: report.code,
        title: report.title,
        startTime: report.startTime,
        endTime: report.endTime,
        owner: report.owner ?? null,
        zone: report.zone ?? null,
        fights: report.fights ?? [],
        players: (report.masterData?.actors ?? []).map((actor) => ({ name: actor.name, className: actor.subType })),
        actors: (report.masterData?.actors ?? []).map((actor) => ({ id: actor.id, name: actor.name, className: actor.subType }))
      };
    }
  };
}
