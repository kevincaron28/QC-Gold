# Releasing on CurseForge (v3.0.0)

Everything you need is here; the parts only you can do are marked **YOU**.

## 1. Before you upload

1. **YOU: decide the public name.** Keep "Quebec Gold" for v3, or run
   `node scripts/rebrand.mjs "Your Name"` (then `npx vitest run` and fix any test
   that quotes the old name). It changes only what people read; the addon folder
   (`QuebecGold`), the saved variable and `/qg` stay, so nobody loses data.
   Use "WoW"/"Warcraft" only descriptively ("for WoW Forever"), not in the name.
2. `node addon/QuebecGold/validate-addon.mjs` passes and `npm run addon:zip` builds
   `dist/QuebecGold-v3.0.0.zip` (top folder inside the zip must be `QuebecGold`).
3. **YOU:** play with the zip installed, tick the "Before release" list in
   TODAY_TODO.md.
4. **YOU:** take 3 to 5 screenshots in game (Home page, Raid page during a raid,
   Standings, bid popup, the readiness board in Discord). Make a logo 400x400.

## 2. Create the project (CurseForge, "Author Studio")

- Game: **World of Warcraft**, Category: **Raid & Instance**, **Guild** or **Miscellaneous**.
- Name / slug: your public name.
- License: **MIT** (the LICENSE file is in the repo and inside the zip).
- Source URL: your GitHub repository (make it public first, or leave blank).
- Summary (one line, max ~250 chars):

  > Raid attendance, EPGP points, loot bidding, gear and consumable checks and fun
  > roll games for WoW Forever guilds, with an optional Discord bot.

- Description (paste; CurseForge accepts Markdown):

```markdown
# What it is

An officer-friendly raid toolkit for **WoW Forever** guilds. It works fully inside
the game with no setup, and can optionally sync with a free Discord bot.

## In game
- **Raid tools:** start/end a raid, attendance (with bench credit), boss kills, notes.
- **EPGP and loot:** award EP and GP, live GP bidding with a popup for raiders (and
  whisper bids for people without the addon), standings with priority (PR).
- **Gear check before the raid:** empty slots, missing enchants, flasks/food and
  attunements, with a one-line readiness status per raider.
- **Roll games:** high roll, deathroll, 1v1 duels. No gold, no wagers, no debts.
- **Mass invite:** `/qg invite raid` invites everyone signed up on Discord.
- **A friendly window:** click the gold coin on the minimap. A Home page tells you what
  is going on, your standing, and whether your data reached Discord.
- **Backups**, per-guild saved data, French translation, and every module can be
  switched off.

## With the optional Discord bot (self-hosted, free)
Signups with roles and waitlist, raid cores with priority, dungeon challenge and
leaderboard, craft board, readiness board, polls, Warcraft Logs, weekly reports.
A small Windows companion app (tray icon) uploads your data after each `/reload`.

## Commands
`/qg` shows the list. `/qg menu` opens the window. `/qg sync` sends your data to Discord.

## Notes
Made for WoW Forever (interface 16001 and 20506). Not affiliated with Blizzard.
```

## 3. Upload the file

- Files, Upload File: `dist/QuebecGold-v3.0.0.zip`.
- Release type: **Beta** for the first day, then **Release**.
- Game versions: pick the entries matching WoW Forever / Classic (the same numbers as
  the TOC: 16001 and 20506). If your version is not listed, choose the closest Classic
  entry; the TOC is what the game reads.
- Changelog: paste the "3.0.0" section of CHANGELOG.md.
- Submit; CurseForge moderators review the first file (usually within a day).

## 4. After it is live

- Put the CurseForge link in the guild's Discord and in the README.
- Optional: connect the GitHub repo to CurseForge or Wago so new tags upload
  automatically (needs a CurseForge API token and the project ID, put the ID in the
  TOC as `## X-Curse-Project-ID: 123456`).
- Wago Addons listing is the same zip, no extra work.
- The **bot and companion** are not distributed on CurseForge. Give guilds the
  GitHub link and docs/DEPLOY_ORACLE.md.
