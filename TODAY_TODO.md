# Today: ship v3.0.0 to CurseForge

Everything that could be built and tested without you is done (306 automated
tests, addon validator clean, zip built). What is left needs your hands, your
game or your accounts. Do it top to bottom; report anything that fails with a
screenshot or `/qg diag` output. Tick as you go.

## A. Make room and restart (10 min)

- [ ] **Free disk space.** C: was at 0 MB free. Delete something big (downloads,
      old installers, game recordings). The Windows installer build needs about 1 GB.
- [ ] Close the bot window, then run **start-bot.bat**. It applies the newest
      database migration (weekly raids) and starts the bot and the companion.
      If it says EPERM, another copy is still open: close it and run again.
- [ ] `/reload` is not needed yet. In Discord, `/health` answers.

## B. Decide two things (5 min)

- [ ] **Public name.** Keep "Quebec Gold" for v3, or pick a new one and tell me
      (or run `node scripts/rebrand.mjs "Name"`, then `npx vitest run`). Only display
      text changes; saved data and `/qg` do not.
- [ ] **License** is MIT (file added). Say so if you want another.

## C. Before release: test the addon in game (45 min)

Install: copy `addon\QuebecGold\` (or unzip `dist\QuebecGold-v3.0.0.zip` after
`npm run addon:zip`) into `Interface\AddOns\`, restart the game.

- [ ] Login: no error popup, no "blocked action". `/qg version` says 3.0.0.
      `/qg diag` first line `Identity: ...` (send it to me once, for the realm check).
- [ ] **Click the gold coin.** The window has a sidebar (Home, Me, Standings...).
      Nothing overlaps or runs off the window. **Tell me what looks cramped.**
- [ ] Home page: your name and rank, the standing sentence, the gear check, the sync line.
- [ ] Officer pages (Raid, EPGP, Loot) show for you; a non-officer alt sees fewer pages.
- [ ] `/qg sim start`, open a bid on any item (Loot page), bid from a second
      character or whisper `30`, award it, `/qg sim end`, `/qg sim clear`.
      (Party of 2 needed for the bid popup.)
- [ ] `/qg games duel <player>` with a friend; `/qg casino` only says it was removed.
- [ ] `/qg backup` then `/qg restore` (the round trip prints no error).
- [ ] `/qg sync` reloads the UI. After it, `/qg diag` has no red LUA_ERROR lines.
- [ ] Optional: `/qg modules off games` hides the Games page; `/qg modules on games` restores it.

## D. Discord side (only if you ship the bot to guilds; 45 min)

- [ ] `/setup`: 7 steps, "Create the whole WoW section" makes the channels in
      categories; `/setup status:true` shows no red.
- [ ] `/core setup` creates a core through the wizard.
- [ ] `/testraid start`, `/testraid finish raid:<id>`, approve EP, raid report lands in
      raid-logs, `/testraid cleanup`.
- [ ] `/raid create ... weekly:true`, start, end: the next week's raid appears. Cancel the extra.
- [ ] `/craft request item:"Flask of Titans" profession:Alchemy`: a **forum post** appears
      with Claim / Done buttons. Needs the craft-board to be a forum channel (`/setup` makes it).
- [ ] Companion app: `start-companion-app.bat` opens the window and a tray coin.
      Settings: **Find it**, **Test connection**, **Save and start**. Coin turns green.
      `/reload` in game: Status shows a fresh upload within seconds.
- [ ] `/qg invite missing` (officer in a party after creating a raid you signed up for).
- [ ] Warcraft Logs (optional, not a release blocker): put WCL_CLIENT_ID and
      WCL_CLIENT_SECRET in `.env.local`, restart, `/wcl report`.

## E. Package and publish (30 min, see docs/RELEASE_CURSEFORGE.md)

- [ ] `node addon/QuebecGold/validate-addon.mjs`, then `npm run addon:zip`.
- [ ] 3 to 5 screenshots from game, a 400x400 logo.
- [ ] Create the CurseForge project, paste the description from
      docs/RELEASE_CURSEFORGE.md, upload `dist/QuebecGold-v3.0.0.zip` as **Beta**,
      paste the 3.0.0 changelog.
- [ ] Publish the GitHub repo (or keep it private and skip the source URL) and, if you
      want a downloadable companion installer, `cd companion-app`, `npm install`,
      `npm run dist` (installer in `dist\companion\`).
- [ ] After the first day without bug reports: switch the file from Beta to Release.

## F. Not in v3 (decided, by design)

Public multi-guild hosted bot (each guild self-hosts), SoftRes/TMB/GRM imports (need sample
files), guild calendar sync, web dashboard, recipe database, bank overview, ownership
verification of characters, and the Oracle Cloud move (docs/DEPLOY_ORACLE.md when you want it).
They are in ROADMAP.md.
