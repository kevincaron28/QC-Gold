# Changelog

## 3.0.0

A big release: everything below since 1.x, polished for the public.

**In game (addon)**
- A new tools window: a sidebar with grouped pages, a **Home** page (what is going
  on, your standing, your gear check, whether your data reached Discord) and
  tooltips. Officers get Raid, EPGP and Loot pages.
- **Send to Discord**: one button (or `/qg sync`) saves your data; officers'
  addons also do it by themselves at safe moments (out of combat, outside instances).
- **Roll games** (high roll, deathroll, duel). No gold, no wagers, no debts.
- **Mass invite**: `/qg invite raid` invites everyone signed up for the next raid on Discord;
  `/qg invite missing` lists who is not in your group.
- **Gear and consumable checks**: missing enchants, flasks, food; a readiness line
  for the whole raid.
- **Backup and restore** of your saved data (`/qg backup`, `/qg restore`), separate
  saved data per WoW guild.
- **Auto-invite** by whisper, login digest, read-only API for other addons
  (`QuebecGoldAPI`), `/qg diag` with slow-handler timings.
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
