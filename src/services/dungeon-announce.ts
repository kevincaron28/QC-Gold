import { EmbedBuilder } from "discord.js";
import { t, type Lang } from "../i18n.js";
import type { DungeonImportSummary } from "./dungeon-import.js";
import { formatDuration } from "./dungeon-rules.js";
import { difficultyName } from "./dungeon-stats.js";

const MAX_RUNS = 12;

// One post per import (roadmap D6): the completed runs, then the records
// they set. Abandoned and rejected runs stay out of the channel (officers
// see them in the /import-apply reply). Null when there is nothing to show.
export function dungeonAnnouncement(summary: DungeonImportSummary, lang: Lang): EmbedBuilder | null {
  const done = summary.results.filter((run) => run.valid && run.state === "COMPLETED" && run.durationSec !== null);
  if (done.length === 0) return null;
  const label = (run: { dungeonName: string; difficultyId: number }) => {
    const difficulty = difficultyName(run.difficultyId);
    return difficulty ? `${run.dungeonName} (${difficulty})` : run.dungeonName;
  };
  const lines = done.slice(0, MAX_RUNS).map((run) => {
    const deaths = run.deaths === null ? "" : ` · ${run.deaths === 0 ? t(lang, "dungeon.post.flawless") : t(lang, "dungeon.deaths", { count: run.deaths })}`;
    return `✅ **${label(run)}** ${formatDuration(run.durationSec as number)}${deaths}\n  ${run.players.join(", ")}`;
  });
  if (done.length > MAX_RUNS) lines.push(t(lang, "dungeon.post.more", { count: done.length - MAX_RUNS }));

  const highlights: string[] = [];
  for (const run of done) {
    if (run.guildRecord && run.previousGuildBest !== null) {
      highlights.push(t(lang, "dungeon.post.guildRecord", {
        dungeon: label(run), before: formatDuration(run.previousGuildBest), now: formatDuration(run.durationSec as number)
      }));
    }
    if (run.personalRecords.length) {
      highlights.push(t(lang, "dungeon.post.personal", { dungeon: label(run), names: run.personalRecords.map((record) => record.character).join(", ") }));
    }
  }
  const embed = new EmbedBuilder().setColor(0xd4a017).setTitle(t(lang, "dungeon.post.title"))
    .setDescription(lines.join("\n").slice(0, 3500))
    .setFooter({ text: t(lang, "dungeon.post.footer") });
  if (highlights.length) embed.addFields({ name: t(lang, "dungeon.post.records"), value: highlights.join("\n").slice(0, 1024) });
  return embed;
}
