# Roadmap

Where Guilded stands and what could come next. The full idea backlog, the code audit and the reviews of
other addons are kept in [docs/archive/ROADMAP-history.md](docs/archive/ROADMAP-history.md).
What is left before publishing is in [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md).

## Status (2026-09-26): version 3.1.0, ready to publish as a Beta

Built and tested (314 automated tests, the addon validator passes):

- **Addon:** raids and attendance, EPGP ledger, GP bidding, loot history, gear/enchant/consumable checks,
  roll games, dungeon challenge, calendar check, backups, a window with a Home page, French, per-guild data,
  switchable modules, a public read-only API for other addons.
- **Bot:** `/setup` wizard with categories and permissions, raid signups with roles, waitlist and FULL,
  raid cores with a bench and `/core edit`, weekly raids, EPGP standings and decay, loot council mode,
  dungeon leaderboard, forum craft board, readiness board, polls, Warcraft Logs import, applications,
  moderation helpers, daily backups, automatic character linking.
- **Companion:** tray app with setup window, standings written back into the game.
- **Release kit:** license (PolyForm Noncommercial), changelog, CurseForge text, addon zip, installer script.

Checked by hand in the real game and Discord: login, the window, sim raid and solo bidding, backup and
restore, sync, `/setup`, cores, test raid, weekly raid, craft board, the companion.
Not checked with a second player yet: the bid popup and whisper bids, duels, mass invite, the officer
versus member views. They are listed in the release checklist.

## Next, in the order I would do them

1. **Test with a second player** (see the checklist). Fix whatever it finds. This comes before any feature.
2. ~~Item tooltips~~ **built** (3.1.0): wishlist, usual GP and your PR on item tooltips; needs a look in the real game (the tooltip hooks are the untested part).
3. ~~Warcraft Logs, next level~~ **built** (`/config wcl-guild`, `/wcl check`); needs a try on a real guild page and a raid that was run through the bot.
4. **Chat tab for addon messages:** an optional "Guilded" chat tab so bid results and status lines stay out of raid chat.
5. **Loot response voting** (BiS / upgrade / off-spec) for loot council guilds.
6. **Imports** from SoftRes, That's My BiS and Guild Roster Manager. Needs sample files from a real export.
7. **Guild calendar sync:** in-game events to Discord and back. Half built (the check command exists).
8. **Recipes and cooldowns:** who can craft what, transmute cooldowns, shopping list.
9. **Web dashboard** for standings, loot and raid history.
10. **Hosting:** the free Oracle Cloud setup is written ([docs/DEPLOY_ORACLE.md](docs/DEPLOY_ORACLE.md)); a hosted
   multi-guild bot is a bigger step and only worth it if other guilds ask.

## Also done

- **French option** (setup language choice, French server and posts). Left for a later pass: officers' own screens and replies, and Discord's slash-command description translations.

## Decided against

- **Casino games and gold wagers:** removed in 2.4 (debts and disputes, no value for a guild).
- **Message edit/delete logging and a starboard:** need Discord's privileged Message Content or reaction intents.
- **Compressed sync, per-guild identity store rewrite:** the current sync is small enough; revisit only if it is not.
