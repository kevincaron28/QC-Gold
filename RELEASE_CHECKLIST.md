# Release checklist: Guilded 3.3.0

`[x]` done, `[ ]` left. Anything that fails: send a screenshot or the `/guilded diag` output.

## Done

- [x] Renamed to **Guilded**: addon folder, `/guilded` (short `/gd`), saved data (old data is adopted once), channels `guilded-*`.
- [x] License **PolyForm Noncommercial 1.0.0**; CurseForge project created; copy-paste text in `docs/CURSEFORGE_COPYPASTE.md`.
- [x] Addon in game: login, window and Home page, officer pages, sim raid and solo bidding, backup and restore, sync and diagnostics, modules on/off.
- [x] Discord: `/setup`, `/core setup` and `/core edit`, test raid, weekly raid, craft board, signup post (names, FULL, core and bench).
- [x] Companion tray app connects and uploads; characters link automatically.
- [x] Tests (314), addon validator and type check pass; `dist/Guilded-v3.3.0.zip` and the companion installer built.

## To publish (about 30 minutes)

- [ ] **3 to 5 screenshots** in game: Home page, Raid or Loot page, Me page (and a Discord signup post with the core roster).
- [ ] **Logo:** `docs/branding/guilded-logo-400.png` still reads "GILDED"; regenerate it with the u, then upload it to CurseForge.
- [ ] **Discord developer portal:** set the bot's name to Guilded and its avatar to the logo.
- [ ] **CurseForge:** upload `dist/Guilded-v3.3.0.zip` as **Beta**, paste the changelog from `docs/CURSEFORGE_COPYPASTE.md`. If 3.0.1 was never uploaded, mention the rename.
- [ ] **GitHub** stays private (no source URL on the listing). Optional: rename the repository from `QC-Gold` to `Guilded` in its settings.
- [ ] **Companion installer** (optional, for guilds that do not want the batch file): `cd companion-app`, `npm install`, `npm run dist`; the installer lands in `dist\companion\`.
- [ ] After a day with no bug reports: switch the file from Beta to **Release**.

## Still to test with a second player or a party

Say "untested" on the listing until these pass.

- [ ] Bid popup on a second character, then a bid by whisper (`/w Officer 30`); the officer sees both in the list and awards one.
- [ ] Soft reserves with a second character: officer `/guilded reserve open`, the other reserves an item (link and Reserves tab), the list appears on both; a whisper `res [link]` from a third; lock; `/guilded reserve roll` between two reservers; award. Check the tooltip line.
- [ ] Loot council on a second character: open an item in the Council tab, answer from the popup, then a whisper answer (`bis`); the officer sees both ranked and awards one.
- [ ] `/guilded games duel <player>` with a friend (and `/guilded casino` only says it was removed).
- [ ] `/guilded invite missing` and `/guilded invite raid` as officer in a party, after creating a raid you and a friend signed up for.
- [ ] A non-officer alt sees fewer pages (no Raid, EPGP, Loot).
- [ ] A second officer's companion uploads and the guild digest carries other online players.

## Optional

- [ ] **Ready page with other people** (officers and group leaders only): in a party or raid open the window, Ready tab (or `/guilded ready`). A plain member does not see the tab. Make a friend group leader or assistant: they should see it too. Each player appears with a colour and a reason. Press Ask everyone to check: guildmates with the addon update within seconds. Someone with no addon shows their flask and food from buffs and "no addon data" otherwise. Officers try Post to group chat.
- [ ] **Chat tab in the real game:** `/guilded chat tab` should open a tab called Guilded and show a first line there; then `/guilded sim start` prints its lines in that tab; `/guilded chat off` sends them back to the main chat.
- [ ] **Item tooltips in the real game:** in Discord `/wishlist add` an item for a linked character, wait for the companion (or `/reload`), then hover that item in your bags or the loot window: three gold "Guilded:" lines. If nothing shows, `/guilded diag` and tell me. Also try `/guilded modules off tooltip`.
- [ ] **Warcraft Logs automation:** `/config wcl-guild guild:<your guild's page link on warcraftlogs.com>`, run a raid through the bot (or use the sim raid) and upload a log; within 10 minutes of it ending the report card appears in the raid logs channel and the officer check in the officer log. Try `/wcl check raid:<id>` by hand first.
- [x] (works 2026-09-26: `/wcl report` posted a report card) Warcraft Logs: put `WCL_CLIENT_ID` and `WCL_CLIENT_SECRET` in `.env.local`, restart, `/wcl report`.
- [ ] Oracle Cloud move when you want the bot online without your PC ([docs/DEPLOY_ORACLE.md](docs/DEPLOY_ORACLE.md)).
