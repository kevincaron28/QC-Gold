# Today: ship v3.0.0 to CurseForge

Everything that could be built and tested without you is done (306 automated
tests, addon validator clean, zip built). What is left needs your hands, your
game or your accounts. Do it top to bottom; report anything that fails with a
screenshot or `/guilded diag` output. Tick as you go.

## A. Make room and restart (10 min)

- [x] **Free disk space.** Done.
- [x] Closed the bot window and ran **start-bot.bat**.
- [x] The companion reached the bot (`/health` answers, upload works).

## B. Name and license (done, two chores left)

- [x] **Public name: Guilded**, fully renamed: addon folder `Guilded`, saved data `GuildedDB`
      (your old data is adopted once), `/guilded` and `/gd` replace `/qg`, `[Guilded]` in chat,
      channels `guilded-*`. 304 tests green. Logo saved in docs/branding/ (400x400 ready).
      Still by hand: set the bot username and avatar (the logo) in the Discord developer portal.
      Note the logo image itself still reads GILDED; regenerate it with the u if you want them to match.
- [x] CurseForge project created (name Guilded). Copy-paste text: docs/CURSEFORGE_COPYPASTE.md.
- [ ] **Clean install for your game.** Delete `Interface\AddOns\QuebecGold`, copy in
      `addon\Guilded`, restart the game. Run `/setup status:true`: the bot now names its
      channels `guilded-*`, so an existing test server may need `/setup` again.
- [x] **License: PolyForm Noncommercial 1.0.0** (LICENSE, addon LICENSE.txt, TOC, release kit).
      On CurseForge pick "Custom License" and paste the LICENSE text. Others may use it
      noncommercially but not resell it. This is not legal advice.

## C. Before release: test the addon in game (45 min)

Install: copy `addon\Guilded\` (or unzip `dist\Guilded-v3.0.0.zip` after
`npm run addon:zip`) into `Interface\AddOns\`, restart the game.

- [x] (login OK 2026-09-26: Identity Ray / Classic Beta PvP matches the companion realm, no diagnostics, first /reload uploads reached the bot) Login: no error popup, no "blocked action". `/guilded version` says 3.0.0.
      `/guilded diag` first line `Identity: ...` (send it to me once, for the realm check).
- [ ] **Click the gold coin.** The window has a sidebar (Home, Me, Standings...).
      Nothing overlaps or runs off the window. **Tell me what looks cramped.**
- [ ] Home page: your name and rank, the standing sentence, the gear check, the sync line.
- [ ] Officer pages (Raid, EPGP, Loot) show for you; a non-officer alt sees fewer pages.
- [ ] `/guilded sim start`, open a bid on any item (Loot page), bid from a second
      character or whisper `30`, award it, `/guilded sim end`, `/guilded sim clear`.
      (Party of 2 needed for the bid popup.)
- [ ] `/guilded games duel <player>` with a friend; `/guilded casino` only says it was removed.
- [ ] `/guilded backup` then `/guilded restore` (the round trip prints no error).
- [ ] `/guilded sync` reloads the UI. After it, `/guilded diag` has no red LUA_ERROR lines.
- [ ] Optional: `/guilded modules off games` hides the Games page; `/guilded modules on games` restores it.

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
- [ ] `/guilded invite missing` (officer in a party after creating a raid you signed up for).
- [ ] Warcraft Logs (optional, not a release blocker): put WCL_CLIENT_ID and
      WCL_CLIENT_SECRET in `.env.local`, restart, `/wcl report`.

## E. Package and publish (30 min, see docs/RELEASE_CURSEFORGE.md)

- [ ] `node addon/Guilded/validate-addon.mjs`, then `npm run addon:zip`.
- [ ] 3 to 5 screenshots from game, a 400x400 logo.
- [ ] Create the CurseForge project, paste the description from
      docs/RELEASE_CURSEFORGE.md, upload `dist/Guilded-v3.0.0.zip` as **Beta**,
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
