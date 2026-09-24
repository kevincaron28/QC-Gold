import { timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { config } from "./config.js";
import { prisma } from "./database.js";
import { createAddonImportService } from "./services/addon-import.js";

const importService = createAddonImportService(prisma);

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function authorized(request: IncomingMessage): boolean {
  if (!config.COMPANION_UPLOAD_TOKEN) return false;
  const supplied = request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
  const expected = Buffer.from(config.COMPANION_UPLOAD_TOKEN);
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  let body = "";
  for await (const chunk of request) {
    body += chunk.toString();
    if (body.length > 1_000_000) throw new Error("Request body is too large.");
  }
  return JSON.parse(body);
}

export function startCompanionApi(): ReturnType<typeof createServer> {
  const server = createServer(async (request, response) => {
    try {
      if (request.method === "GET" && request.url === "/health") {
        json(response, 200, { ok: true });
        return;
      }
      if (request.method !== "POST" || request.url !== "/api/v1/addon-imports") {
        json(response, 404, { error: "Not found" });
        return;
      }
      if (!authorized(request)) {
        json(response, 401, { error: "Unauthorized" });
        return;
      }
      const payload = await readBody(request);
      if (!payload || typeof payload !== "object" || !("guildDiscordId" in payload) || !("export" in payload)) {
        json(response, 400, { error: "guildDiscordId and export are required" });
        return;
      }
      const requestPayload = payload as { guildDiscordId: unknown; export: unknown; createdBy?: unknown };
      if (typeof requestPayload.guildDiscordId !== "string") {
        json(response, 400, { error: "guildDiscordId must be a string" });
        return;
      }
      const guild = await prisma.guild.findUnique({ where: { discordId: requestPayload.guildDiscordId } });
      if (!guild) {
        json(response, 404, { error: "Guild is not initialized" });
        return;
      }
      const createdBy = typeof requestPayload.createdBy === "string" ? requestPayload.createdBy : "companion-app";
      const preview = await importService.preview(guild.id, requestPayload.export, createdBy);
      if (preview.duplicate) {
        json(response, 409, { error: "This export was already received", checksum: preview.checksum });
        return;
      }
      const record = await importService.record(guild.id, preview.snapshot, preview.checksum, createdBy);
      json(response, 201, {
        importId: record.id,
        checksum: preview.checksum,
        source: preview.snapshot.source,
        transactionCount: preview.transactionCount,
        status: record.status
      });
    } catch (error) {
      console.error("Companion API request failed", error);
      json(response, 400, { error: error instanceof Error ? error.message : "Invalid request" });
    }
  });
  server.listen(config.COMPANION_API_PORT, "127.0.0.1", () => {
    console.info(`Companion API listening on http://127.0.0.1:${config.COMPANION_API_PORT}`);
  });
  return server;
}
