# CurseForge copy-paste sheet: Guilded 3.0.1

Each block below is one field. Copy the block, paste it in.

---

## Project name
```
Guilded
```

## Summary (one line)
```
Raid attendance, EPGP, loot bidding, pre-raid gear checks and fun roll games for WoW Forever guilds, with an optional Discord bot.
```

## Category
Raid & Instance (secondary: Guild, Miscellaneous)

## Logo
`docs/branding/guilded-logo-400.png` (400x400). Full size: `docs/branding/guilded-logo.png`.

## File to upload
`dist/Guilded-v3.0.1.zip` (top folder inside is `Guilded`). Release type: **Beta** for the first day, then **Release**.
Game versions: the WoW Forever / Classic entries closest to interface 16001 and 20506.

## License
Select **Custom License**, name it:
```
PolyForm Noncommercial 1.0.0
```
Then paste the full text of the `LICENSE` file in the project root (the first line is the
Required Notice, the rest is the official text). Optional link:
https://polyformproject.org/licenses/noncommercial/1.0.0

## Description (Markdown)
```markdown
# Guilded: the raid toolkit for WoW Forever guilds

Everything an officer needs to run a raid, inside the game, with no setup. Add the
free Discord bot when you want signups and reports outside the game too.

## In game
- **Raid tools:** start and end a raid, attendance with bench credit, boss kills, notes.
- **EPGP and loot:** award EP and GP, live GP bidding with a popup for raiders (whisper
  bids work for people without the addon), standings with priority (PR).
- **Gear check before the raid:** empty slots, missing enchants, flasks, food and
  attunements, with a one-line readiness status for every raider.
- **Roll games:** high roll, deathroll, 1v1 duels. No gold, no wagers, no debts.
- **Mass invite:** `/guilded invite raid` invites everyone who signed up on Discord.
- **A friendly window:** click the gold coin on the minimap. The Home page shows your
  standing, what is going on, and whether your data reached Discord.
- **Safe by design:** backups, per-guild saved data, French translation, and every
  module can be switched off.

## Optional Discord bot (self-hosted, free)
Signups with roles and waitlist, raid cores with priority, weekly raids, dungeon
challenge and leaderboard, craft board, readiness board, polls, Warcraft Logs and
weekly reports. A small Windows companion app (tray icon) uploads your data after
each `/reload`.

## Getting started
1. Install and log in. Type `/guilded` (or `/gd`) for the command list, or click the coin.
2. Officers: open the Raid page and start a raid.
3. Want Discord? Follow the bot guide on the project page.

## Good to know
Made for WoW Forever (interface 16001 and 20506). Free for noncommercial use under the
PolyForm Noncommercial license. Not affiliated with or endorsed by Blizzard Entertainment.
```

## Changelog (paste for the file upload)
```markdown

A big release: everything below since 1.x, polished for the public.

**In game (addon)**
- A new tools window: a sidebar with grouped pages, a **Home** page (what is going
  on, your standing, your gear check, whether your data reached Discord) and
  tooltips. Officers get Raid, EPGP and Loot pages.
- **Send to Discord**: one button (or `/guilded sync`) saves your data; officers'
  addons also do it by themselves at safe moments (out of combat, outside instances).
- **Roll games** (high roll, deathroll, duel). No gold, no wagers, no debts.
- **Mass invite**: `/guilded invite raid` invites everyone signed up for the next raid on Discord;
  `/guilded invite missing` lists who is not in your group.
- **Gear and consumable checks**: missing enchants, flasks, food; a readiness line
  for the whole raid.
- **Backup and restore** of your saved data (`/guilded backup`, `/guilded restore`), separate
  saved data per WoW guild.
- **Auto-invite** by whisper, login digest, read-only API for other addons
  (`GuildedAPI`), `/guilded diag` with slow-handler timings.
- Clear reasons when standings are missing instead of a generic "not linked".

**Discord bot (optional)**
- `/setup` wizard that makes and organises every channel with the right permissions.
- Raid cores with signup priority, per-core point rules and pools, `/core setup`.
- Weekly repeating raids, dungeon groups with temporary voice channels, polls,
  loot council mode, bench credit, Warcraft Logs import.
- Craft board as a forum: one post per request with tags and buttons.
- Automatic character discovery and linking; `/character import` for anyone.
- Dropdowns and suggestions instead of typing.
- Companion desktop app with a tray icon, settings window and activity log.
- Deploy kit for a free Oracle Cloud server.

**Removed**: the casino games and the gold debt ledger; the recruitment posts.
```
