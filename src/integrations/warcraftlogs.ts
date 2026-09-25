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
      masterData { actors(type: "Player") { name subType } }
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

  return {
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
          fights?: WclFight[] | null; masterData?: { actors?: { name: string; subType: string }[] | null } | null;
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
        players: (report.masterData?.actors ?? []).map((actor) => ({ name: actor.name, className: actor.subType }))
      };
    }
  };
}
