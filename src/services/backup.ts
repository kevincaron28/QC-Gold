import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { Prisma, type PrismaClient } from "@prisma/client";

// Daily safety copy of the whole database as gzipped JSON, one file per day
// (backups/quebec-gold-YYYY-MM-DD.json.gz), keeping the newest `keep`.
// Neon has its own point-in-time restore; this is the local copy you can
// open, search, or hand to someone if something goes badly wrong.

export const BACKUP_DIR = "backups";
const PREFIX = "quebec-gold-";

export function backupFileName(date: Date): string {
  return `${PREFIX}${date.toISOString().slice(0, 10)}.json.gz`;
}

// Oldest files beyond `keep`, given file names sorted any way.
export function backupsToDelete(files: string[], keep: number): string[] {
  const ours = files.filter((file) => file.startsWith(PREFIX) && file.endsWith(".json.gz")).sort();
  return ours.slice(0, Math.max(0, ours.length - keep));
}

const delegateName = (model: string) => model.charAt(0).toLowerCase() + model.slice(1);

export async function runBackup(database: PrismaClient, now = new Date(), dir = BACKUP_DIR, keep = 14): Promise<{ file: string; rows: number } | null> {
  await mkdir(dir, { recursive: true });
  const existing = await readdir(dir);
  const file = backupFileName(now);
  if (existing.includes(file)) return null;

  const tables: Record<string, unknown[]> = {};
  let rows = 0;
  for (const model of Prisma.dmmf.datamodel.models) {
    const delegate = (database as unknown as Record<string, { findMany: () => Promise<unknown[]> }>)[delegateName(model.name)];
    if (!delegate?.findMany) continue;
    const data = await delegate.findMany();
    tables[model.name] = data;
    rows += data.length;
  }
  const json = JSON.stringify({ createdAt: now.toISOString(), tables }, (_key, value) => typeof value === "bigint" ? value.toString() : value);
  await writeFile(join(dir, file), gzipSync(json));
  for (const old of backupsToDelete([...existing, file], keep)) await rm(join(dir, old), { force: true });
  return { file, rows };
}
