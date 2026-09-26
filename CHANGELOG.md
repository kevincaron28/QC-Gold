# Changelog

## 3.0.1

Renamed to **Guilded** (`/guilded`, short `/gd`; the old `/qg` is gone, saved data from the old name is adopted once).

- Me page: the Attunements block no longer overlaps a long gear result; readiness shows as Ready / Partly ready / Not ready.
- Bidding: officers can try it alone inside a test raid (`/guilded sim start`, then `/guilded sim bids`); nothing is sent to chat.
- Bot: no crash when Discord drops a slow command, database keepalive, clearer message when a character is already linked.

## 3.0.0

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

## 2.x and 1.x

See ROADMAP.md, "Progress log".
