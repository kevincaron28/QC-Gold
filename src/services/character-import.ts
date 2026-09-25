import type { PrismaClient } from "@prisma/client";
import { findCharacter } from "./character-match.js";
import { createGuildService } from "./guild.js";
import { BRAND } from "../brand.js";

// Turns what the addon captured about a character into a linked Character,
// so members paste one line instead of typing name, realm, class, race, ...
// The line comes from `/qg character` in game:
//   QG1|Name|Realm|CLASS|Race|level|spec|Profession:skill,Profession:skill

export interface ParsedCharacter {
  name: string;
  realm: string;
  className: string;
  race?: string;
  level?: number;
  spec?: string;
  professions: { name: string; skillLevel: number }[];
}

const CLASS_NAMES: Record<string, string> = {
  WARRIOR: "Warrior", PALADIN: "Paladin", HUNTER: "Hunter", ROGUE: "Rogue", PRIEST: "Priest",
  DEATHKNIGHT: "Death Knight", SHAMAN: "Shaman", MAGE: "Mage", WARLOCK: "Warlock", MONK: "Monk",
  DRUID: "Druid", DEMONHUNTER: "Demon Hunter", EVOKER: "Evoker"
};

const RACE_NAMES: Record<string, string> = { Scourge: "Undead", BloodElf: "Blood Elf", NightElf: "Night Elf", HighmountainTauren: "Highmountain Tauren" };

// "DEATHKNIGHT" / "Death Knight" / "warrior" -> "Death Knight" / "Warrior".
export function normalizeClassName(raw: string): string {
  const key = raw.replace(/[\s_-]/g, "").toUpperCase();
  return CLASS_NAMES[key] ?? raw.trim();
}

// "NightElf" -> "Night Elf"; already-spaced names pass through.
export function normalizeRaceName(raw: string): string {
  const trimmed = raw.trim();
  return RACE_NAMES[trimmed] ?? trimmed.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function parseCharacterString(input: string): ParsedCharacter {
  const parts = input.trim().split("|").map((part) => part.trim());
  if (parts[0] !== "QG1") throw new Error(`That doesn't look like a ${BRAND.name} character line. In game, type /qg character and copy the line it shows.`);
  const [, name = "", realm = "", className = "", race = "", levelText = "", spec = "", professionText = ""] = parts;
  if (!name || !realm || !className) throw new Error("The character line is missing the name, realm or class. Run /qg character again in game.");
  if (name.length > 24 || realm.length > 64) throw new Error("The character line looks damaged. Run /qg character again in game.");
  const level = Number(levelText);
  const professions = professionText
    .split(",")
    .map((entry) => {
      const [professionName = "", skill = ""] = entry.split(":");
      return { name: professionName.trim(), skillLevel: Math.trunc(Number(skill)) };
    })
    .filter((entry) => entry.name.length > 0 && entry.name.length <= 40 && Number.isFinite(entry.skillLevel) && entry.skillLevel >= 0)
    .slice(0, 10);
  return {
    name,
    realm,
    className: normalizeClassName(className),
    ...(race ? { race: normalizeRaceName(race) } : {}),
    ...(Number.isInteger(level) && level >= 1 && level <= 100 ? { level } : {}),
    ...(spec ? { spec } : {}),
    professions
  };
}

export type ImportOutcome = { action: "created" | "updated"; name: string; isMain: boolean };

// Links the character to `memberId`, or refreshes it if they already have it.
// A character that belongs to someone else is never taken over.
export async function importCharacter(
  database: PrismaClient,
  memberId: string,
  parsed: ParsedCharacter,
  mainChoice?: boolean
): Promise<ImportOutcome> {
  const owner = await database.member.findUnique({ where: { id: memberId }, select: { guildId: true } });
  if (!owner) throw new Error("Your member profile was not found.");
  // Same name in this guild, tolerating a different realm spelling (Forever has no real realms).
  const sameName = await database.character.findMany({
    where: { name: { equals: parsed.name, mode: "insensitive" }, member: { guildId: owner.guildId } }
  });
  const existing = findCharacter(sameName, parsed.name, parsed.realm);
  if (existing && existing.memberId !== memberId) {
    throw new Error(`${existing.name} (${existing.realm}) is already linked to another member. Ask an officer if that's a mistake.`);
  }

  let characterId: string;
  let isMain: boolean;
  let action: ImportOutcome["action"];
  if (existing) {
    const updated = await database.character.update({
      where: { id: existing.id },
      data: {
        className: parsed.className,
        ...(parsed.spec ? { spec: parsed.spec } : {}),
        ...(parsed.level !== undefined ? { level: parsed.level } : {}),
        ...(parsed.race ? { race: parsed.race } : {})
      }
    });
    if (mainChoice === true && !existing.isMain) {
      await database.character.updateMany({ where: { memberId }, data: { isMain: false } });
      await database.character.update({ where: { id: existing.id }, data: { isMain: true } });
    }
    characterId = updated.id;
    isMain = mainChoice === true || existing.isMain;
    action = "updated";
  } else {
    const hasMain = (await database.character.count({ where: { memberId, isMain: true } })) > 0;
    isMain = mainChoice ?? !hasMain;
    const created = await createGuildService(database).addCharacter({
      memberId,
      name: parsed.name,
      realm: parsed.realm,
      className: parsed.className,
      isMain,
      ...(parsed.spec ? { spec: parsed.spec } : {}),
      ...(parsed.level !== undefined ? { level: parsed.level } : {}),
      ...(parsed.race ? { race: parsed.race } : {})
    });
    characterId = created.id;
    action = "created";
  }

  for (const profession of parsed.professions) {
    await database.professionSkill.upsert({
      where: { characterId_profession: { characterId, profession: profession.name } },
      create: { characterId, profession: profession.name, skillLevel: profession.skillLevel },
      update: { skillLevel: profession.skillLevel }
    });
  }
  return { action, name: parsed.name, isMain };
}
