import { PrismaClient } from "@prisma/client";
import { config as loadDotenv } from "dotenv";

// Same files config.ts loads. Done here too because this module can be
// evaluated before config.ts, and DATABASE_URL is read below at import time.
loadDotenv({ path: ".env.local", quiet: true });
loadDotenv({ quiet: true });

// Neon suspends the database after a few idle minutes and needs several
// seconds to wake up. Prisma's default 5s connect timeout is shorter than
// that, so the first query after a quiet spell failed with "Can't reach
// database server". Allow 30s unless the URL already sets its own values.
export function withWakeUpTimeouts(url: string | undefined): string | undefined {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has("connect_timeout")) parsed.searchParams.set("connect_timeout", "30");
    if (!parsed.searchParams.has("pool_timeout")) parsed.searchParams.set("pool_timeout", "30");
    return parsed.toString();
  } catch {
    return url;
  }
}

const datasourceUrl = withWakeUpTimeouts(process.env["DATABASE_URL"]);

export const prisma = datasourceUrl ? new PrismaClient({ datasourceUrl }) : new PrismaClient();

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
