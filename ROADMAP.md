# Quebec Gold — Roadmap

Living roadmap for the Quebec Gold Discord bot + WoW addon. Update this file
as work happens so a fresh session (or a future you) can resume from it
alone. Two parts: **Part 1** is the correctness audit that's now done, kept
as a historical record. **Part 2** is the forward-looking feature roadmap
toward a full Guild-OS-style manager with Discord housekeeping built in.

Legend: `[ ]` not started · `[~]` in progress · `[x]` done · **P0/P1/P2** =
priority (P0 = do first) · **S/M/L** = rough size

---

## ⏸ Where we are — resume here (updated 2026-09-26, v2 push)

**Goal (reached 2026-09-27): v2.0.0 (addon + bot) ready for testing, with everything that
can be built without live data or a decision from the user built.** Items
are grouped below; the progress log at the end of this section is updated
after each commit so a session that hits a limit can resume from it.

**Already shipped (v1.x, in the repo):** EPGP ledger and bidding, raids with
waitlist and buttons, loot history, dungeon challenge, module switches,
`/setup` (7 steps, categories, permissions), character import, raid cores with
signup priority, dungeon groups with temporary voice, readiness board with
consumables, Warcraft Logs import, backups, French. See the sections below for
each item's notes.

### v2.0.0 scope

**Addon (Lua), tested with the new fengari harness (`tests/lua/`)**
- [x] **A1 (X3)** Lua test harness: the real addon files run against a mocked game inside vitest.
- [x] **A2 (X1)** Player identity for Forever (`ns.compat.playerKey/normalizeName`) and `/qg diag` identity line. *(done; `compat.identity`, `/qg diag`, realm-tolerant matching in every bot import)*
- [x] **A3 (GO5)** Enchant check: which equipped slots lack an enchant, in the snapshot and on the board. *(done; per-slot enchant ids, MISSING_ENCHANTS finding, reason flags in the peer digest)*
- [x] **A4 (X5)** Login digest: "since your last login" summary, `/qg digest`. *(done; Modules/Digest.lua)*
- [x] **A5 (X6)** `QuebecGoldAPI` read-only v1. *(done; Modules/API.lua)*
- [x] **A6 (X4)** Versioned addon-message envelope (accepts old, sends new). *(done in a lighter form: protocol rules documented, `/qg peers`; existing messages were already typed KIND|fields)*
- [x] **A7 (X2)** `QGEXP1:` paste export + `/import code:` for members without the companion. *(done; `/qg share` + `/character sync`, verified Lua-to-TypeScript)*
- [x] **A8 (ID3)** Attendance snapshot: `/qg snapshot [label]`. *(done; `/qg snapshot [label]`, local only)*
- [x] **A9 (VG1, VG2)** Casino ban list and session stats. *(built, then removed with the whole casino under N3)*

**Bot (Discord)**
- [x] **B1 (GO3)** Readiness aggregator: one status per member, sorted most actionable first, enchants and attunement target. *(done; summary line, most actionable first, `/readiness raid attunement:`)*
- [x] **B2 (GK2)** `/inactive`: members inactive for N days (read-only report). *(done; `/inactive`)*
- [x] **B3 (GP4)** `/export`: CSV of roster, attendance or loot for officers. *(done; `/export` roster, attendance, loot, EPGP ledger)*
- [x] **B4 (IR4, GK4)** Composition (class, race, level ranges) in `/stats`. *(done as `/guildhealth`)*
- [x] **B5 (RF4)** Bench credit: a BENCHED attendance status that counts as present for EP and rates. *(done; BENCHED status, attendance EP only, full attendance credit)*
- [x] **B6 (GO2)** Loot council mode: points shown but bidding buttons hidden. *(done; `/config loot-mode`, `/loot award`)*
- [x] **B7 (GO7)** `/poll`: officers create polls, members vote with buttons. *(done; `/poll create|close` with buttons (in-game polls not built))*
- [x] **B8 (GP10)** Retention cohorts (30/60/90 days) in `/stats`. *(done inside `/guildhealth`)*
- [x] **B9 (#46 prep)** One `BRAND` constant for the product name used in embeds, so the public rename is a one-line change. *(done; `src/brand.ts`)*

**Release**
- [x] **R1** Addon 2.0.0 (TOC, zip), README/COMMANDS, launch checklist sections for everything new, roadmap final status. *(done; addon and package 2.0.0, `dist/QuebecGold-v2.0.0.zip`, docs, checklist sections 12-13)*

### v2.4 request list (2026-09-27 night; built in this order, log below)

| # | Request | Plan |
| --- | --- | --- |
| N1 | In game, the standings line always says "character not linked with Discord" | Find why (the companion wrote Standings.lua while nobody was linked, and only refreshes every 15 min, the game only reads it at login or reload). Say the *actual* reason in the UI: "standings not synced yet" vs "not linked: /character claim"; companion refreshes standings every 2 minutes and right after each upload. |
| N2 | The `/reload` that sends data to the bot is too slow: send more often, more consistently | The game only writes the saved file on reload/logout, so the addon gets a **Sync to Discord** button (a click may reload the UI), a "data waiting" banner on a timer, and an opt-in **auto reload at safe moments** (out of combat, not in an instance, at most every N minutes). The companion uploads within seconds of the file changing. |
| N3 | Remove the casino games and the debt ledger completely; keep only 1v1 or chat games like deathroll, nothing against the guild | Replace the Casino module with a small **Roll games** module: 1v1 deathroll, group deathroll (last one standing), high-roll-off. No gold, no wagers, no ledger, no debts, no trade settlement, no house games. Old casino saved data is ignored. |
| N4 | Discord commands: pick from lists instead of typing | Class / race / profession as dropdowns, spec by class, realm defaults to the guild's, `/loot auction` needs only the item (minimum, increment and time default from the guild's settings), time suggestions on `/raid create`, quick reasons on EPGP awards, attunement suggestions. |
| N5 | A clear way to create a raid core in Discord | `/core setup`: a guided message (name in a form, then pick tanks / healers / DPS from member menus, then rules), plus a pointer in `/setup` and `/help`. |
| N6 | Rework the in-game UI so it is much easier to navigate, using other addons as the example | A **Home** page (what is going on right now, your standing, next raid, sync status), tabs grouped in a left sidebar (Home, Raid, Loot, Guild, Games, Tools), one consistent layout, big primary buttons, plain-language labels. Uses the same ideas as GuildOS (dashboard + feature panels), Guild Paragon (sections) and ElvUI-style sidebars. |
| N7 | Crafting: a craft board where open orders and important info are easy to see and people can interact | A **forum channel** (`craft-board`): every request is a forum post with tags (profession, Open / Claimed / Done) and Claim / Done / Cancel buttons inside the post; the post title and tag follow the state; finished posts close. A pinned guide post explains it. Works with `/craft request` too, and falls back to the old text channel if a forum can't be made. |

**Progress log for this batch (newest first):**

- (see "Progress log" at the top of this file)

### Not in v2 (why)

| Item | Why it waits |
| --- | --- |
| #46 public rebrand and CurseForge (M3) | needs a name and logo from the user, and a hosting decision |
| #18 WCL auto-discovery | needs `/wcl report` proven on real Forever logs first |
| #32 calendar sync | needs the output of `/qg calendar check` |
| #17 web dashboard, #20 achievements/graphs | held; data model still moving |
| #40 fully automatic character linking, IR3 verification | needs the verification design and live testing of `/qg character` |
| PM1/PM2/IR1 recipes, cooldowns, bank stock | need in-game API discovery on Forever (trade skill and guild bank windows) |
| RF1-RF3 mass invite, group layout, assignments | protected group APIs; needs in-game testing per call |
| ID1 loot responses, GO1 per-core rules | designs touch bidding/EPGP rules; better after v2 feedback |
| G6 roster panel, G1 tooltips, G7 compression | large UI/library decisions (bundling libs) |
| GO8/G13 SoftRes and TMB import | need sample export files from the user |
| LR1, LR2 roster events/permissions, GK1 auto invite, GP1/GP2 event log and DNI list | need live guild-log behaviour on Forever |

### Progress log (update after every commit)

- 2026-09-28 N3 done: casino, house games and debt ledger removed; Modules/Games.lua (high roll, deathroll, duel, no gold); addon 2.4.0 pending release notes.
- 2026-09-28 N2 done: /qg sync and auto-save at safe moments (Modules/SyncNow.lua).
- 2026-09-28 N1 done: standings message says the real reason; companion refreshes standings every 2 minutes.
- 2026-09-27 night: the user asked for N1-N7 (table above) and went to sleep; working through them in order N1, N2, N3, N4, N5, N7, N6 (UI last: biggest, least testable).

- 2026-09-26 14:40 A1 done: fengari harness; Consumables.lua and Core.lua (`/qg character`) verified against the mocked game.
- 2026-09-26 16:10 A2-A9 done (addon side complete, 60 Lua tests through the harness). Next: bot items B1-B9, then release.
- 2026-09-27 21:00 v2.3: character line fixed (QG2, semicolons), realm rename keeps guild data, recurring recruitment post removed, automatic character discovery and auto-link by Discord name, `/character claim|link|unclaimed|autolink`, `/config auto-import`, companion API host setting and failed-login throttle, Oracle deployment kit (`docs/DEPLOY_ORACLE.md`, `deploy/`). Still open: real ownership verification (IR3) instead of trusting the Discord name.
- 2026-09-27 06:00 v2.2: auto-invite by whisper (GK1) and Anniversary interface number (G11), addon 2.2.0.
- 2026-09-27 05:00 v2.1: per-core point rules and pools (GO1), one saved-data set per WoW guild (G10), `/qg backup` and `/qg restore` (GO9), addon 2.1.0, 249 tests. Not built as asked: in-game polls (dropped by you).
- 2026-09-27 01:30 B1-B9 and R1 done. **v2.0.0 is complete: addon 2.0.0 zip in `dist/`, 232 tests green, migrations applied to the live database through `20260927010000_polls`.** Next: the user runs checklist sections 0-13, then push and release.

## History — where we were on 2026-09-24 (kept for reference)

- **Blocked-action popup: fixed.** Cause was registering
  `COMBAT_LOG_EVENT_UNFILTERED`, which addons can't do since 12.0.0
  (Midnight), and WoW Forever inherits that. After removing it and setting
  `## Interface: 16001` (from `/dump select(4, GetBuildInfo())`), the user
  reports the login warning is gone. `validate-addon.mjs` fails the build if
  any file registers a combat log event again.
- **Bot confirmed working live** (`/health`, Server Members Intent on,
  companion API running). Phase 8–11 Discord features not yet exercised live.
- **Addon audit #2 done (v1.2.0, 2026-09-24).** Found after the first
  live `/qg inspect` returned NOT_READY with no explanation:
  - `READY` was unreachable (INFO findings counted as problems) — status now
    follows the bot's rule (ERROR → NOT_READY, WARNING → PARTIAL), and
    inspect names the empty slots and shows item level.
  - **Critical (bot):** every export carries the officer's whole ledger and
    import refs included the import id, so each weekly import would have
    re-added all past EP/GP. Ledger entries now carry a permanent `id`; the
    companion sends a stable ref; `/import-apply` skips refs already imported
    (`tests/addon-import-dedupe.test.ts`). Live DB had 0 addon imports, so
    no cleanup needed.
  - Empty EPGP reasons would have failed the bot's 3-char minimum and
    rejected the whole import — defaulted in addon and companion.
  - Names normalized everywhere ("bob"/"Bob-Realm" → "Bob"): roster,
    ledgers, attendance, addon-message senders. This also fixed casino
    results counting twice via the sender's own message echo.
  - Active raid now survives `/reload`/disconnect; starting a second raid
    while one is open is refused.
  - `/qg loot` item names with spaces, `/qg attune Onyxia Key` (was parsed
    as player "Onyxia"), quoted arguments — all fixed.
  - Peer readiness can only be reported by the character itself (no
    spoofing another player's readiness into officer exports).
  - SavedVariables bloat: events capped at 1000, exports are small markers
    (old versions stored a full DB copy per export), peer readiness spam
    kept out of the journal.
  - Casino: `/qg casino join` never reached the host (group games could
    not actually be joined) — now an OPEN/JOIN/JOINED addon-message
    handshake. Roll parsing uses the client's `RANDOM_ROLL_RESULT`, so
    French clients work. Mirrored ledger updates only accepted from someone
    involved, or an officer. Wagers capped.
  - Hardening: all sends pcall-guarded and truncated to 255 bytes, event
    handlers pcall-guarded, Midnight "secret value" chat text ignored.
  - New `/qg officer list|add|remove|rank` (GM only for changes) so rank
    layout doesn't require editing SavedVariables.
  - Companion watcher watches the folder, not the file (a file watch can go
    deaf after WoW replaces the file on save) and prints the exact
    `/import-apply` line.
  - Verified with a 28-check simulation of the addon under a Lua
    interpreter with stubbed WoW APIs (not committed; lives in the session
    scratchpad), plus 60 bot tests, `tsc`, `eslint`, validator.
- **Live-confirmed 2026-09-24:** v1.2.0 loads, minimap button shows,
  `/qg inspect` names empty slots and reports item level.
- **v1.3.0 (2026-09-24, not yet live):** tabbed tools window with a
  target-aware Player box (user found the first panel clunky), attendance
  from raid presence, version check, bot EPGP standings in game. Verified
  with a 29-check UI/sync simulation plus the earlier 28 logic checks,
  63 bot tests, `tsc`, `eslint`, validator.
- **Still unverified in a live client:** the new window, casino,
  readiness → `/readiness me` end to end, standings sync.
- **Command reference:** `COMMANDS.md`.
- **v1.4.0 (2026-09-24, not yet live):** casino reworked per the user:
  officers only; announcements in party/raid chat so pugs without the
  addon can play (type 1 to join, `/roll`, "stand"); gold or silver wagers
  (`10g`, `50s`, `1g50s`); chat pacing (queued lines merged, sends spaced,
  joins silent, deathroll elimination + next roll in one line); pot entries
  owed to the host; trades with the officer settle debts automatically.
  Window hides officer tabs/tools from members instead of greying them;
  `/qg help` lists only what your rank can use. In-game raid presence now
  imports into Discord raid attendance (see section A). Verified: 28-check
  casino simulation, 34-check window/sync simulation, 18 core checks,
  66 bot tests, `tsc`, `eslint`, validator.
- **Release:** `dist/QuebecGold-v1.4.0.zip` built; GitHub release and the
  install-page artifact still point at v1.1.0 — refresh both once the live
  test passes.

---

## ▶ Prioritized backlog (added 2026-09-24 from the "complete recommendation list" review)

Gaps between that list and what's already built. Everything else on the
list (EP/GP/PR, history, decay, audit log, attendance %, signups with role
caps, wishlists, professions per character, readiness, recruitment,
applications, gear snapshots) already exists. Work order is easiest-first
within priority. Update the checkbox the moment an item lands.

**P0 — core gaps (bot-side, testable without the game)**

> *(Superseded by "Where we are" at the top.)* **Resume here (2026-09-25, committed):** everything in P0, P1 #13-16,
> #0 test raid, #19 crafting, #21-23, and all quality-of-life items #24-31
> (autocomplete, friendly times, signup buttons, auto-restart, companion
> setup, French, backups, welcome with role buttons) are done. 126 bot
> tests; 66 + 28 + 18 addon simulation checks. Addon v1.6.0 zip built
> locally, not released. Next: user live-tests (LUNCH_TEST_CHECKLIST.md,
> untracked, plus /setup and the welcome preview); then push, GitHub
> release v1.6.0, refresh the install page. Blocked: #12 WCL
> (credentials). Held: #17 dashboard. Open: profession cooldowns.
>
> **#0 — [x] DONE 2026-09-25.** Bot: `/testraid start|finish|cleanup`
> (`src/services/simulation.ts`, `src/commands/testraid.ts`; `isTest` on
> Member/Raid, migration `20260925095244_test_raid_flags`). Verified end to
> end against the live Postgres in a throwaway guild: 7 signed up / 2
> maybe / 1 waitlisted, late + no-show + walk-in, 3/3 kills, 2 loot
> auctions, both attendance paths (direct and via addon import), EP
> approve twice = paid once, report, stats, cleanup left 0 rows. Addon:
> `/qg sim start|end|bids|clear` (`Modules/Sim.lua`, same fake names).
>
> **#0 — P0 / M — Raid test environment / simulation (requested
> 2026-09-24 for tomorrow).** No raids are released in WoW Forever yet, so
> the whole raid flow can't be tested for real. Build a way to run a fake
> raid end to end:
> - **In game:** an officer-only `/qg sim` (or "Test raid" button) that
>   runs a raid with made-up raiders and bosses. It would start the raid, fill
>   presence, mark attendance (some late/absent), record boss kills and loot,
>   and end it, all tagged as test data, using a 5-man dungeon group or
>   solo.
> - **Bot:** a `/raid create` test flag (or `/raid simulate`) that creates a
>   raid with fake signups (including Maybe / waitlist) so reminders,
>   signup embeds, `/raid end` EP proposal, raid report, and loot history
>   can be exercised; plus a matching SavedVariables fixture for the
>   companion → `/import-apply` path (attendance import, no-shows,
>   walk-ins).
> - **Safety:** test data must be clearly marked and removable in one
>   command (`/raid simulate cleanup`), and must never touch real EPGP
>   (separate test member records or a `TEST` sourceRef prefix that
>   standings and reports ignore). Remaining P1:
> #12 WCL (blocked on credentials + confirming Forever logs reach WCL),
> #17 web dashboard (held), #18 WCL auto-discovery (after #12). Next
> unblocked work is P2 (#19 crafting requests) or #21 in-game GP bidding. #12 Warcraft Logs is
> blocked on WCL API credentials from the user and on confirming Forever
> logs upload to WCL. The user must restart the bot to register the new
> commands (`/who`, `/raid progress|note|award-ep`, `/epgp reverse`,
> `/profession who|coverage`, `/config notify-channel`).
>
> Progress note (2026-09-24): one additive migration covers items 4-11 —
> `20260925002811_backlog_basegp_notify_reminders_notes_signups_loot_context`
> (GuildSettings `baseGp`/`notifyChannelId`/`raidReminderMinutes`/
> `epCompletionBonus`; RaidSignupStatus `MAYBE`/`WAITLISTED`; Raid
> `reminderSentAt` + `RaidNote` model; Auction/LootAward raid/boss/
> awardedBy/EP-GP-before; Character `race`/`lastSeenAt`). **Already applied
> to the live Neon DB.** `prisma generate` hit EPERM because the bot was
> running (engine DLL locked) but the types regenerated; restart the bot to
> be safe.

1. [x] **S — `/profession who <profession>`**: every linked character with
   that profession and skill, sorted; plus `/profession coverage` (count and
   top skill per profession). Query only. *(Done 2026-09-24:
   `src/services/profession-search.ts`, `tests/profession-search.test.ts`.)*
2. [x] **S — `/epgp reverse <transaction>`**: officer correction command
   (service `reverseTransaction` already exists); `/epgp history` shows
   transaction ids so they can be picked. *(Done 2026-09-24: `/epgp reverse
   entry reason`; refuses double reversal, other guilds' entries, and
   reversing a reversal; `/epgp history player:` lets officers view anyone.
   `tests/epgp-reverse.test.ts`.)*
3. [x] **S — `/raid progress`**: boss progression from recorded kills: each
   boss, first kill date, total kills, last kill. Query only. *(Done
   2026-09-24: `src/services/progress.ts`, `tests/progress.test.ts`.)*
4. [x] **S/M — Minimum (base) GP**: guild setting `baseGp` (default 0);
   PR = EP / (GP + baseGP) everywhere PR is shown or sorted. Standard EPGP;
   stops a new player with 1 GP having a huge PR. *(Done 2026-09-24:
   `priority()` in `src/services/epgp.ts` used by /epgp, /profile, the
   standings API; `/config set baseGp`; companion writes `baseGp` into
   Standings.lua and the addon's STAND sync message carries it, so in-game
   PR matches. Also added `/config set` choices for `raidReminderMinutes`
   and `epCompletionBonus` ahead of items 8 and 10.)*
5. [x] **M — Discord notifications channel**: `/config notify-channel`;
   posts raid started/ended, boss killed, loot awarded (item, winner, GP),
   and EPGP awards (batched per command, not per person). *(Done
   2026-09-24: `src/services/notify.ts`; hooked into /raid start|end|boss,
   /loot close, /epgp award-ep|award-gp|decay|reverse, /import-apply (one
   summary line). Never pings, never throws. `tests/notify.test.ts`.)*
6. [x] **M — Raid notes**: `/raid note <raid> <text> [boss]` officer notes
   (general, per boss, "improve next time"); shown in `/raid status`.
   *(Done 2026-09-24: raid-leader only to add and to see; `RaidNote` model,
   `raidService.addNote`, `tests/raid-notes.test.ts`.)*
7. [x] **M — Signup Maybe + waitlist**: signup status Available/Maybe;
   when a role is full, new signups go to a waitlist and auto-promote when
   a slot frees; embed shows Maybe and Waitlist sections. *(Done
   2026-09-24: `/raid signup availability:Maybe`; full role → WAITLISTED
   instead of an error; cancellations and raised caps (`/raid edit`)
   promote the earliest waitlisted player per role and DM them; embed has
   Maybe and Waitlist fields. Maybe/waitlisted aren't counted as no-shows.
   Tests in `tests/raid.test.ts`.)*
8. [x] **M — Raid reminders**: ping signed-up members N minutes before start
   (guild setting, default 60), once per raid. *(Done 2026-09-24:
   `src/services/reminders.ts`, checked every 5 min from main.ts; posts in
   the raid's signup channel, pings only SIGNED_UP members; marks the raid
   before sending so it can never double-ping; `/config set
   raidReminderMinutes` (0 = off). `tests/reminders.test.ts`.)*
9. [x] **M — Loot history detail**: record raid, boss, awarding officer, and
   EP/GP before/after on each award; show in `/loot history`. *(Done
   2026-09-24: `/loot auction` takes optional `boss`/`raid`; closing
   snapshots the winner's EP/GP before the award and who closed it;
   `/loot history` shows item [boss, raid], winner, GP, GP before → after,
   awarding officer, date.)*
10. [x] **M — EP award proposal with approval**: after a raid ends (or after
    addon attendance import), the bot proposes EP (attendance + per boss
    kill + completion bonus, from settings) with Approve / Cancel buttons;
    approval creates the transactions. Never automatic. *(Done 2026-09-24:
    `/raid end` shows the proposal; `/raid award-ep raid:` re-proposes any
    time (e.g. after `/import-apply` adds attendance). EP = attendance
    (`attendanceDkp`, late `lateAttendanceDkp`) + kills × `bossKillDkp` +
    `epCompletionBonus` on a full clear. Approve (EPGP officers only)
    recomputes and writes EP_AWARD rows with `sourceRef raid-ep:<raid>:<member>`
    so a raid can never be paid twice. `src/services/ep-award.ts`,
    `src/commands/ep-award.ts`, `tests/ep-award.test.ts`.)*
11. [x] **S — Character race + last seen**: store race on `/character add`,
    last seen from addon roster/readiness imports; show in `/profile`.
    *(Done 2026-09-24: `race` option; `lastSeenAt` moves forward only, from
    imported gear checks and from being seen in a raid group that matched a
    Discord raid; shown in `/profile` and `/character list`.)*

23. [x] **M — Guided first-time setup (`/setup`).** *(Done 2026-09-25,
    requested: "a complete idiot can set it up". Private click-through
    wizard: roles (create missing, give yourself Guild Master), channels
    (pick or auto-create announcements / raid signups / private officer
    log), welcome + auto-roles (warns if the bot's role is too low), EPGP
    recommended values + reminders + weekly report toggles, then a
    checklist where every ❌ says how to fix it, plus a "post getting
    started guide" button. Also: `/help` (rank-aware), greeting in the
    system channel when the bot joins a server, and a setup status line
    in the bot console at startup. `src/commands/setup.ts`,
    `src/services/setup-status.ts`, `src/commands/help.ts`; tests check
    every wizard screen against Discord's component limits.)*

**Quality of life — recommended 2026-09-25 (not started, easiest first)**

24. [x] **S — Raid ID autocomplete.** *(Done 2026-09-25: raid, auction, bank, craft, EPGP entry, application, import options; `src/services/autocomplete.ts`.)* Every `raid:` option (and auction /
    bank / craft IDs) suggests upcoming raids by title and date as you
    type, so nobody copies IDs again.
25. [x] **S — Friendly raid times.** *(Done 2026-09-25: `src/services/raid-time.ts`, EN+FR, DST-safe; timezone in /setup and `/config timezone`.)* `/raid create time:` accepts
    "tonight 8pm", "friday 20:00", "2026-10-01 20:00" in the guild's
    timezone (new setting in /setup), instead of strict ISO-8601 — the
    biggest remaining trap for non-technical officers.
26. [x] **M — Signup buttons on the raid post.** *(Done 2026-09-25.)* Tank / Healer / DPS /
    Maybe / Can't come buttons on the live signup embed; no command needed.
27. [x] **S — Bot auto-restart.** *(Done 2026-09-25: start-bot.bat loop.)* The desktop shortcut restarts the bot if
    it crashes, and the console shows a clear "bot stopped, restarting"
    line.
28. [x] **S — One-click companion setup.** *(Done 2026-09-25: `npm run companion:setup`, start-companion.bat.)* A script that finds the WoW
    folder, generates the upload token, and writes both `.env.local` and
    `companion.config.json` (today this is manual and error-prone).
29. [x] **M — French language option.** *(Done 2026-09-25: bot `src/i18n.ts` —
    signup post/buttons/replies, waitlist DM, reminders, announcements,
    raid report, weekly stats, welcome default + role prompt, getting
    started guide, /help follow the guild language from /setup; officer
    admin replies stay English. Addon v1.6.0 `Locale.lua` — player window,
    minimap tooltip, bid popup, and bidding chat lines; auto from the game
    client, `/qg lang en|fr|auto`; officer tabs and casino chat lines stay
    English for now.)* Bot replies and addon text in
    French for a Quebec guild (`/setup` language choice).
31. [x] **M — Welcome by channel / DM / both, with role buttons.** *(Done
    2026-09-25, requested: "access to either game of the server or both".
    Up to 5 role buttons on the welcome message; clicking toggles the role,
    works from DMs; DM falls back to the channel if closed; only roles still
    configured are honoured. /setup step 3 + `/config welcome send_to
    role_prompt preview`. `tests/welcome.test.ts`.)*
32. [~] **M — In-game guild calendar sync** *(Requested 2026-09-25.)* Only
    if WoW Forever's client has the calendar and lets addons use it.
    Discord stays the one official signup list.
    - [~] **S — `/qg calendar check`** (addon v1.6.1): reports whether the
      calendar API exists, whether you can create events, and lists guild
      events for the next 14 days. **Waiting on the user to run it in
      game** — the answer decides the next two steps.
    - [ ] **M — In game → Discord:** addon exports guild events and each
      member's response; `/import-apply` creates/updates the matching
      Discord raid and signups (accepted → signed up, tentative → Maybe,
      declined → Can't come) with the normal caps/waitlist rules.
    - [ ] **S/M — Discord → in game:** companion writes upcoming Discord
      raids into the addon folder; officer's Raid tab gets a "Create
      in-game event" button (calendar event creation needs a real click).
30. [x] **S — Nightly database backup** *(Done 2026-09-25: `src/services/backup.ts`, backups/ gitignored.)* (export key tables to a dated file,
    keep the last 14).

**Addon modules and distribution (requested 2026-09-25)**

Decision: **one addon with module switches, not separate CurseForge
addons.** Every module runs on Core (saved data, officer checks, names,
addon messaging, the tools window) and Sync (standings, version check).
Split addons would each need Core as a dependency, several downloads for
members, and version skew between parts that talk to each other
(bidding/casino/dungeon protocols). One install with switches gives guilds
the same choice. Casino, GP bidding and Dungeons are a single project on
CurseForge; a guild that doesn't want the casino turns it off for everyone.

M1. [x] **M — Module switches** *(Done 2026-09-25.)* `/qg modules`
    (list), `/qg modules on|off <module>` (just you), officers
    `/qg modules guild on|off <module>` (everyone, shared through Sync
    as `MODS|updatedAt|by|off-list`, newest officer setting wins,
    non-officer and stale messages ignored, members who log in later ask
    with `MODSREQ`). Switchable: casino, bidding, dungeon, calendar, sim.
    Always on: Core (raids, EPGP, loot, gear check) and Sync. Saved
    settings load only at login, so every module file still loads and
    stays dormant when off: events, tickers, commands, help lines, window
    tabs and widgets check `ns.moduleActive`. Off works at once; turning a
    module back on that was off at login needs `/reload`. Tools tab has a
    row per module with your switch and (officers) the guild switch.
M2. [x] **S — Module integration audit** *(Done 2026-09-25.)* Checked
    every cross-module call (all guarded), event overlap (bidding reads
    whispers, casino reads party/raid chat, only the casino parses rolls,
    the dungeon tracker ignores raids), prefixes (one per module, ≤16
    chars), and load order (UI harness now loads all 11 files in TOC
    order). Fixed: an unguarded standings call in the window, a dead
    `ns.simBidders`, sim sub-commands that needed a switched-off module.
M3. [ ] **M — CurseForge packaging** (when the user wants a public
    listing): CurseForge project + `## X-Curse-Project-ID` in the TOC,
    a `.pkgmeta` (or a packaging step) that ships only
    `addon/QuebecGold` without `validate-addon.mjs`, a license, the
    description/screenshots page, and a GitHub Action with the BigWigs
    packager on tags. Consider whether the Standings.lua file written by
    the companion should move to SavedVariables-free delivery for guilds
    without the companion (it already falls back to officer sync).

**Dungeon Challenge system (requested 2026-09-25) — build in this order**

Source: a detailed spec the user pasted (ChatGPT). Kept: permanent run
records with unique ids and duplicate protection; explicit run states;
stable ids (instance/encounter ids, never names); one compatibility layer
for every WoW API call; never faking a stat the client can't give;
bot-side configurable points with an audit trail; anti-farming;
seasons, records, achievements, rankings computed from stored runs;
offline-safe local storage until the bot confirms; protocol versions;
/reload safety; logged admin commands. Adapted: reuse the existing
`Core.lua + Modules/` layout and the companion → `/import-apply` sync
instead of a new folder tree or network path; deaths come from each
player's own addon (the combat log is blocked since 12.0), and players
without the addon show "deaths not tracked" instead of a guess;
completion = final boss from the Encounter Journal when the client has it,
otherwise the leader/officer presses Complete. Dropped: `/dungeon start`
and `/dungeon cancel` in Discord (Discord can't control the game; they
are in-game buttons), race tracking, a new folder structure.

Rules that apply to every step: reliability over feature count; one
failing API or event disables only that feature; points are never sent
by the addon, only computed by the bot from rules.

D1. [x] **M — Compatibility layer (addon `Compat.lua`)** *(Done 2026-09-25, v1.7.0.)*: every WoW API
    the dungeon system uses (instance info, group members and roles, GUIDs,
    encounter journal, time, death state) behind `ns.compat`, each checked
    before use, failures logged to `/qg diag`, `/qg dungeon check` reports
    which features are available on this client.
D2. [x] **M — Run tracker (addon `Modules/Dungeon.lua`)** *(Done 2026-09-25, v1.7.0; 29-check simulation incl. reload, abandon, peer merge, missing API.)*: state machine
    DETECTED → STARTING → ACTIVE → COMPLETED / ABANDONED / INVALID / ERROR;
    one recorder per group (leader if they have the addon, else first
    addon user by name) so five clients don't make five runs; timer starts
    at the group's first combat after entering (or Start button);
    encounters from ENCOUNTER_END; own deaths from PLAYER_DEAD shared
    after combat; per-player time present; saved every change so /reload,
    disconnect, or a crash resumes the run; runs kept until the bot
    confirms them.
D3. [x] **M — Sync + validation (companion, bot)** *(Done 2026-09-25: per-run zod + server checks, id + near-duplicate dedupe, acceptedRunRefs back to the addon.)*: runs in the export
    with `protocolVersion` / `addonVersion`; bot validates (known shape,
    duration 3 min – 4 h, no future timestamps, 1–5 players, completion
    state), rejects duplicates by run id and by same dungeon + same
    players + start within 2 minutes; stores `DungeonRun` +
    `DungeonRunPlayer`; companion writes accepted run ids back so the addon
    can mark them synced.
D4. [x] **M — Points (bot)** *(Done 2026-09-25: rules in dungeon-rules.ts, weekly repeat share, point transactions with rule source.)*: configurable rules (completion, 0/1/2
    deaths, personal record, guild record, first completion, full guild
    group, under target time) and anti-farming (per player per dungeon per
    week: 1st 100%, 2nd 50%, 3rd+ 0%, configurable); every point is a
    `DungeonPointTransaction` with reason, run, source.
D5. [x] **M — Seasons, records, leaderboards (bot)** *(Done 2026-09-25: /dungeon leaderboard|records|player|history|season; season start/end moves to D7 admin.)*: seasons with
    start/end, archived not deleted; records (fastest, fewest deaths) per
    dungeon, guild and personal; `/dungeon leaderboard [dungeon]
    [weekly|season|all]`, `/dungeon records`, `/dungeon player`,
    `/dungeon history`, `/dungeon season`.
D6. [x] **S — Announcements** *(Done 2026-09-25: one post per import, dungeon channel or notify fallback, /config dungeon-channel + /setup.)*: completed runs, new personal and guild
    records in a dungeon channel (/setup + `/config`).
D7. [x] **M — Admin + audit** *(Done 2026-09-25: /dungeon-admin invalidate|award|audit|config|target|season-start; every change is a new point row + DUNGEON_ADMIN audit + officer log. force-complete stays in game: /qg dungeon complete.)*: `/dungeon invalidate`, `award`, `remove`,
    `force-complete`, `audit`, `config`, `season start|end`, all logged.
D8. [x] **M — Achievements** *(Done 2026-09-25: permanent, no points; earned at import, revoked with an invalidated run, Season Champion on season-start; Dungeon Master count in /dungeon-admin config. "All dungeons" = N different dungeons, since the client has no reliable list.)*: First Blood, No One Dies, Speed Demon
    (target time), Record Breaker, Dungeon Master (all dungeons), Guild
    Squad, Season Champion — rules in config, permanent.
D9. [x] **S — In-game view** *(Done 2026-09-25: Dungeons tab for everyone: live run, start/complete/abandon/check, recent runs + sync state, season top from Discord via Standings.lua; EN/FR.)*: a Dungeons tab (current run, timer,
    Start / Complete / Abandon buttons, recent runs, your points).
D10. [x] **S — Test path** *(Done 2026-09-25: /testraid dungeon through the real import, /qg sim dungeon in game; SIM- runs in a made-up "Test Dungeon", removed by /testraid cleanup and /qg sim clear.)*: `/qg sim dungeon` and `/testraid`-style bot
    fixtures that play a full run (including reload, duplicate
    submission, disconnect) so this can be tested before release.

**P1 — second wave**

12. [x] **M — Warcraft Logs, manual import first** *(Built 2026-09-26, awaiting
    the live test in checklist section 8. `/wcl report url:<link|code> [raid]
    [post]` (officers) and `/wcl list`; `src/integrations/warcraftlogs.ts`
    (client-credentials token cache, only warcraftlogs.com hosts are ever
    contacted, site taken from the link so classic./www. both work),
    `src/services/wcl.ts`, `src/commands/wcl.ts`, `WarcraftLogsReport` model,
    tests/wcl.test.ts. Summary = zone, duration, per-boss kills/wipes/best
    kill time, player list; posted to the raid logs channel; a linked raid's
    report gets a Warcraft Logs field. Keys `WCL_CLIENT_ID` /
    `WCL_CLIENT_SECRET` (+ optional `WCL_BASE_URL`) live only in `.env.local`.
    Still unconfirmed: that Forever logs upload to WCL and on which site;
    deaths are not pulled yet.)*: `/wcl <report url>`
    pulls the report through WCL API v2 (GraphQL, client-credentials
    auth, keys only in the bot's `.env`, never in the addon), stores a
    compact summary (zone, duration, bosses killed/wipes, deaths, player
    list) linked to the raid, posts a raid report embed, and links to WCL
    for detail. No DPS leaderboard / "raid score" by design.
13. [x] **M — Automated raid report embed** (duration, raiders, bosses,
    EP awarded, loot and GP spent, WCL link) posted when a raid ends.
    *(Done 2026-09-24, minus the WCL link which waits for #12: posted to the
    notify channel when the raid's EP is approved (numbers are final then),
    and `/raid report raid:` posts it on demand. Loot counts only auctions
    started with `raid:`. `src/services/raid-report.ts`,
    `src/commands/raid-report.ts`, `tests/raid-report.test.ts`.)*
14. [x] **S — Player/character search** (`/who <name>`: main, alts, class,
    professions, EPGP, last seen, attendance %). *(Done 2026-09-24:
    exact then partial name match; `src/services/player-search.ts`,
    `src/commands/who.ts`, `tests/player-search.test.ts`.)*
15. [x] **M — Guild statistics / weekly guild report** (attendance trends,
    loot distribution, new members). *(Done 2026-09-24: `/stats [days]`
    (raids, avg raiders, boss kills, EP, loot/GP, new members,
    applications, most raids attended, most loot); `/config weekly-report
    enabled:` posts it to the notify channel every 7 days (hourly check,
    marked before posting). Migration `20260925004829_weekly_guild_report`
    applied to live DB. `src/services/guild-stats.ts`,
    `src/commands/stats.ts`, `tests/guild-stats.test.ts`.)*
16. [x] **M — Guild-bank requests** (request an item, officer
    approves/fulfils, logged). *(Done 2026-09-24: `/bank request|mine|
    cancel` for everyone, `/bank list|handle` for officers; new requests go
    to the log channel; the requester gets a DM on approve/fulfil/deny;
    max 10 open per member; only forward status changes. `BankRequest`
    model, migration `20260925005009_guild_bank_requests` applied to live
    DB. `src/services/bank.ts`, `src/commands/bank.ts`,
    `tests/bank.test.ts`.)*
17. [ ] **L — Web dashboard** (EPGP, loot, raid history) — held until the
    data model settles.
18. [ ] **M — WCL automatic report discovery** (poll guild reports every
    15 min) — after #12 proves which data is actually useful.

**P2 — later / optional**

19. [~] Profession cooldown tracking and crafting requests. *(Crafting
    requests done 2026-09-25: `/craft request|list|mine|claim|done|
    release|cancel`; request shows guild crafters with that profession;
    DMs on claim/done/cancel; claim is race-safe (verified on live DB with
    two simultaneous claims). `CraftRequest` model, migration
    `20260925095707_craft_requests`. Cooldown tracking still open — needs
    addon data.)*
20. [ ] Guild achievements, progression graphs, historical analytics.
21. [x] In-game GP bidding tied to the bot (see section A; L, needs a raid
    to test). *(Done 2026-09-25, addon v1.5.0 `Modules/Bidding.lua` + Loot
    tab: officer opens bidding (one raid-chat line), addon users bid from a
    popup showing their Discord PR, pugs whisper a number; sealed bids;
    highest wins, tie → higher PR → earliest; Award runs `/qg loot` +
    `/qg gp` so the GP has a ledger id and imports into Discord. Popups only
    accept an officer's bidding. `/qg sim bids` for testing. Verified in
    the Lua simulation (20 bidding checks). Not yet seen live.)*
22. [x] **S/M — In-game loot into Discord loot history.** *(Done
    2026-09-25: addon loot rows get a permanent id and the last boss
    killed; the companion exports them; `/import-apply` adds each once to
    `LootAward` (auction now optional, new unique `sourceRef`), linked to
    the Discord raid its in-game raid matched, so `/loot history` and raid
    reports include GP-bidding awards. Migration
    `20260925110000_addon_loot_history` (applied with `migrate deploy`
    because `migrate dev` needs an interactive prompt for the new unique
    column). Verified on live DB via `/testraid finish via_addon`.)*

**P3 — added 2026-09-26**

33. [x] **M — Character import instead of typing** *(Done 2026-09-26, addon
    v1.8.0.)* `/qg character` in game shows one `QG1|name|realm|CLASS|race|
    level|spec|professions` line (class/race as English tokens, so any client
    language works); `/character import code:` links or refreshes the character
    (professions too; never takes over another member's character). The
    addon export also carries the exporter's own `character` block, which
    `/import-apply` uses to refresh an already-linked character. Why not fully
    automatic: the companion has one guild-wide token and can't tell which
    Discord user a character belongs to. `src/services/character-import.ts`,
    `tests/character-import.test.ts`. See **#40** for the fully automatic
    version.
34. [x] **M — More setup channels, one tidy WoW section** *(Done 2026-09-26.)*
    `/setup` is now 7 steps: channels (announcements, raid signups, **raid
    logs**, officer log), **dungeon channels** (leaderboard, signups, runs),
    **extra channels** (loot and EP log, craft board, recruitment). A
    "Create the whole WoW section" button makes every missing channel under
    one "Quebec Gold" category; feeds only the bot posts in are read-only for
    members. New `/config` commands: `raid-log-channel`, `loot-channel`,
    `craft-channel`, `dungeon-leaderboard-channel`, `dungeon-signup-channel`.
    Raid reports and Warcraft Logs go to raid logs; loot awards and EP/GP
    changes to the loot log; craft requests to the craft board (bank requests
    stay in the officer log). Each falls back to the older channel when unset.
35. [x] **S — Auto-updating dungeon leaderboard** *(Done 2026-09-26.)* One
    message in the leaderboard channel, edited after every dungeon import
    and `/testraid dungeon`; re-posted if someone deletes it.
    `src/services/dungeon-leaderboard.ts`.
36. [x] **S — Commands register in every server** *(Done 2026-09-26.)* They
    were only registered for `DISCORD_GUILD_ID`, so a second server never
    saw `/setup`. Now registered on start for every guild the bot is in, and
    when it joins one.
37. [x] **S — Companion export carries the exporter's character** *(Done
    2026-09-26; part of #33.)*
41. [x] **S — Private raid readiness channel** *(Done 2026-09-26.)* `raid-readiness`
    (Guild Master, Officer, Raid Leader, Loot Leader, Class Leader only; created by
    /setup step 4 or set with `/config readiness-channel`). `/readiness raid`
    posts the guild board there; `/import-apply` refreshes it when gear checks
    arrive. `src/services/readiness-board.ts`. Enchant/flask checks are still
    open (G2, ID2, plus an enchant check in the addon).
42. [x] **M — Consumable scan** *(Built 2026-09-26, addon v1.9.0; Lua only syntax-checked, needs the in-game test in checklist section 9. Flask/elixir/food are matched by buff name (`Flask of`, `Elixir of`, `Well Fed`...); weapon enchants only for yourself; needs `/qg consumes` from an officer, out of combat and in range. Your own snapshot also records them and adds NO_FLASK / NO_FOOD warnings while you're in a raid group.)*
    Addon: each player's own snapshot records active flask/elixir/food/weapon
    buff; `/qg consumes` (officer) scans the whole group and prints who is
    missing what; results export to the bot (`ConsumableCheck`) and show as a
    "Consumables" section on the raid readiness board. Enchants are a
    separate later step.
43. [x] **L — Raid cores + roster channel + signup priority** *(Built 2026-09-26; checklist section 10. Priority = a core member takes the most recent non-core signup's slot in a full role; the bumped player is DM'd and goes to the front of the waitlist; waitlist promotion favours core members. Slots are not pre-reserved, by design, so a raid never sits half empty.)* (requested
    2026-09-26). A *raid core* is a named roster (e.g.
    "Tuesday MC core") with roles. **Multiple cores** per guild. A private/
    read-only **roster channel** shows each core's roster as one live message.
    Core members get **priority at signups for that core's raids**: their
    signup takes a slot before non-core players, and a non-core player can't
    bump a core member off the waitlist. `/core create|add|remove|list|post`,
    `/raid create core:<name>`.
44. [x] **M — Dungeon signups with the bot + temporary voice channel** *(Built 2026-09-26; checklist section 11; supersedes #39. The voice channel is private to the group, created at 5 players or on Start now, deleted after 5 empty minutes or on Close. Not yet linked to the run tracker.)*
    (requested 2026-09-26). `/dungeon
    group` posts a signup with Tank/Healer/DPS buttons in the dungeon signups
    channel; when 5 are in (or the leader presses Start) the bot creates a
    **temporary voice channel** for the group, moves nobody by force (it posts
    the link and, if members are already in voice, offers to move them), and
    deletes the channel when it's empty for a few minutes or the group is
    closed. Judged worthwhile: it's cheap, tidy, and dungeon groups are
    short-lived. Needs Manage Channels and (for moving) Move Members.
45. [x] **M — `/setup` organizes the whole server section** *(Built 2026-09-26; checklist section 0.)* (requested
    2026-09-26). Every channel is created in a fitting
    category (e.g. ⚜️ INFO, ⚔️ RAIDING, 🏰 DUNGEONS, 🔒 OFFICERS) with the
    right permissions (members read-only in feeds, officers/raid leaders only
    where private), re-runnable and never touching existing channels. Adds a
    "Organize existing" step that only *moves* channels the bot made.
46. [ ] **L — Public bot identity and CurseForge listing** (requested
    2026-09-26; **last, after the launch test**). Replace the "Quebec Gold"
    name with a neutral product identity so any guild can install it: pick a
    name/logo/tagline (check trademark and that "WoW"/"Warcraft" is used only
    descriptively), rename the addon folder, TOC title, `## SavedVariables`
    (with a migration from `QuebecGoldDB`), slash prefix (`/qg` stays as an
    alias), bot username and embed branding, docs, install page, GitHub repo
    and release, a per-guild "guild name" setting so the branding is the
    guild's own, CurseForge project page (screenshots, description,
    changelog, license file), Wago listing (M3). Decide multi-guild hosting
    vs self-host first: today the bot is one process per guild owner.
38. [ ] **S — Warcraft Logs in the launch test** — checklist section 8
    (account, client, "do Forever logs reach WCL", `/wcl report`).
39. [x] **M — Real dungeon signups** *(done as #44)*. The signup channel exists but nothing
    posts there yet. A "form a dungeon group" post with Tank/Healer/DPS
    buttons (reuse the raid signup embed) that the run tracker can match to
    a completed run.
40. [ ] **M — Fully automatic character import.** The officer's addon already
    receives every online guildmate's readiness digest over addon messages;
    extend it with class/race/level/spec so one officer export carries the
    whole online guild, and let `/import-apply` create **unlinked** characters
    that a member claims with one click (`/character claim`) or an officer
    assigns. Removes the paste step for everyone who's ever been online with
    the addon.

### GuildOS review (2026-09-26)

Reviewed <https://github.com/danielcosta42/guildos> (MIT; roster/attunement/
loot/recruitment-focused addon for TBC Anniversary and WoW Forever, one build
for both; no Discord, EPGP, bidding, calendar, dungeons or WCL). What it does
better than us, and what we do that it doesn't, drove this list. Pick from it;
none is started.

- **Where we are ahead:** the Discord bot, EPGP with an append-only ledger,
  GP bidding, loot history, raid signups with waitlist, dungeon challenge,
  calendar, module switches, backups, French, a real test path.
- **G1. [ ] S/M — Item tooltips:** show "GP cost / who wishlisted / your PR"
  on item tooltips (GuildOS does wishlist tooltips). Data is already in
  Standings.lua / wishlist; needs a `GameTooltip` post-hook via `Compat.lua`.
- **G2. [ ] M — Consumable check before pulls:** a `/qg consumes` scan of the
  group for flask/food/elixir/weapon buffs, feeding the readiness report
  (GuildOS scores this into attendance). Our attendance stays Present/Late/
  Absent; consumables would be a readiness signal, not a penalty.
- **G3. [ ] M — Trial member tracker:** trial period, sponsor, auto-expiry
  alert to officers. Fits next to `/application` (Discord) with an in-game
  reminder; a new `Trial` model.
- **G4. [ ] S/M — Officer notes in game,** synced between officers (we have
  `/tag` and member tags on Discord only). Reuse the officer message channel
  the module switches already use.
- **G5. [ ] M — Guild recipe browser:** we track profession *skill*; GuildOS
  keeps every known recipe. Needs a trade-skill window scan (guard
  `C_TradeSkillUI` in `Compat.lua`) and `/craft request` autocomplete from it.
  Ties into #19 cooldown tracking.
- **G6. [ ] M/L — Sortable roster panel** in game (level, class, ilvl,
  professions, attunements, attendance, last seen; search; online toggle).
  Our Standings tab shows EPGP only. Highest-visibility feature if the addon
  is ever listed publicly.
- **G7. [ ] L — Sync compression:** GuildOS uses LibSerialize + LibDeflate +
  ChatThrottleLib; our digests must fit 255 bytes. Worth it only if payloads
  outgrow that (would happen with #40 or recipes). Bundling libraries is a
  deliberate packaging change: decide before starting.
- **G8. [ ] S/M — In-game recruitment helpers:** welcome message for new
  guild joiners with the Discord invite link, and a periodic recruitment
  reminder (must be a hardware-click post; addons can't auto-send to channels).
  We already have the Discord-side recurring post.
- **G9. [ ] M — Account-wide alt linking for attunements:** officers link alts
  so one completion counts for all. We link characters to a Discord member,
  so this is mostly reading that link into the addon via Standings.lua.
- **G10. [x] S — Per-guild SavedVariables isolation** (guild name + realm)
  so one WoW install with alts in two guilds can't mix ledgers. Low risk,
  do it before a public release.
- **G11. [x] S — TBC Anniversary support:** GuildOS ships one build for
  Interface 20506 and 16001. Add `20506` to our TOC `## Interface:` and run
  the Compat checks; only worth it if guildmates play Anniversary.
- **G12. [ ] S — Public presence:** CurseForge and Wago listings (M3), a
  screenshot set, a Discord support link, MIT-style license file, changelog.
- **G13. [ ] M — That's My BiS (TMB) CSV import** into `/wishlist`, plus the
  received-loot column into loot history. Guilds that already use TMB won't
  retype wishlists.
- **Deliberately skipping:** hooking the J key to replace Blizzard's guild
  frame (fragile across clients), and rank-checkbox officer config (we use
  Discord roles, which is already how the bot decides).

### Eight more addons reviewed (2026-09-26)

Reviewed from their CurseForge pages, plus GitHub where a repo exists.
Repos found: Profession Master <https://github.com/Kurki/ProfessionMaster>,
Guild Paragon <https://github.com/Earthenmist/Guild-Paragon>, iRC: Guild Connect
<https://github.com/Crasling/iRCGuildConnect>, LibGuildRoster (its CurseForge
page names `Pimptasty/GuildRoster`, but that URL 404s, so it may be private or
renamed). **No public repo found:** vGambler, iddqd, GuildKit. Raidify's addon
has none, but its desktop companion is open source (MIT). Only the feature
lists were read for the ones without source; nothing was copied. Licenses vary
(several are All Rights Reserved), so these are ideas to build ourselves, never
code to lift.

**Profession Master** (guild crafters, cooldowns, leveling planner; Classic
through Forever). Overlaps our `/craft` and `/profession`.
- **PM1. [ ] M — Full recipe database per guild member** (what each person can
  craft, not just skill level), synced with a compressed relay so it doesn't
  spam raids. Feeds `/craft request` autocomplete and "who can make X". Same
  work as G5; do them together.
- **PM2. [ ] M — Profession cooldown tracking** (transmute, cloth, salt, etc.):
  addon reads cooldowns, exports them, and the bot pings the owner when ready
  and lists guild cooldowns. Finishes roadmap #19.
- **PM3. [ ] S — `!who <item>` style lookup in guild chat:** a member types
  it, the addon of any crafter replies (or the bot answers in Discord with
  `/craft who`). Small, very visible.
- **PM4. [ ] S/M — Missing recipes and shopping list:** "recipes you could still
  learn and where", plus a materials list for a crafting request. Optional;
  needs a static recipe source we'd have to maintain, so low priority.
- **Skip:** leveling planner, profit checker and auction scanning. They need
  live auction data and price sources we don't have and don't need.

**LibGuildRoster** (a library other addons use for reliable roster data).
- **LR1. [ ] M — Event-driven roster instead of polling:** build the roster at
  login, then keep it current from system chat messages (joined, left,
  promoted, kicked), so we don't call `GuildRoster()` on a timer. Our
  Compat layer already guards roster APIs; this reduces load and gives us a
  join/leave/promotion event stream for free.
- **LR2. [ ] S — Real officer permissions:** read what the guild master actually
  granted (`C_GuildInfo` / `GuildControlGetRankFlags`) instead of guessing
  officers from rank position. Fixes wrong officer detection for
  `/qg modules guild` and officer-only commands.
- **LR3. [ ] M — Alt groups from the game itself:** treat characters on the same
  account as one player. Ties into #40 and G9; helps auto-linking characters.
- **LR4. [ ] S — Connected-realm name handling** (`Name-Realm` normalisation),
  needed if Forever ever merges realms. We already normalise names in
  `Core.lua`; add tests for the connected-realm forms.
- **Skip:** sister-guild rosters and mailbox autocomplete. Only useful to
  multi-guild communities.

**vGambler** (roll-off gold gambling: lowest roller pays the highest). Same
idea as our Casino module, which is a superset (pot, blackjack, ledger).
- **VG1. [x] S — Player ban list in the Casino module** (`/qg casino ban|unban|
  bans`): host can exclude people; persists in the SavedVariables. vGambler has
  it, we don't.
- **VG2. [x] S — Session statistics** (`/qg casino stats`): games, biggest win,
  net per player for the session. We keep a ledger already; this is a view.
- **VG3. [ ] S — Default stake and a "1 to join" prompt line** matching
  vGambler's flow so players who know it feel at home. Only if guildmates ask.
- **Watch:** gambling on real gold can violate a realm's terms in some
  regions. Keep the "guild fun only" wording in the Casino README.

**Raidify** (raid roster from a web app, mass invite, group layout, assignments,
attendance, bench credit).
- **RF1. [ ] M — Mass invite from the signup list:** `/qg invite raid <id>`
  (officer) invites everyone signed up for a Discord raid, fuzzy-matching names,
  with a "whisper `inv` to be invited" option for late arrivals. Our signup
  data is already in Standings.lua-style exports; needs the raid roster sent
  to the addon (bot to addon, so via the companion's Standings file).
- **RF2. [ ] M/L — Group layout:** the bot lets the raid leader arrange groups
  (tanks/healers/DPS per group) in Discord or the in-game panel; the addon
  applies them with `SetRaidSubgroup`/`SwapRaidSubgroup` (guard the API; it can
  be protected during combat).
- **RF3. [ ] M — Assignments** (interrupts, soulstones, tranq rotations, CC) as
  a note synced between officers and answerable by whisper (`!assign`).
  Overlaps `/raid note`; start by syncing that note in game.
- **RF4. [x] S — Bench credit:** benched players keep full attendance. A
  "BENCHED" attendance status that counts as present for `/epgp leaderboard`
  and EP proposals. Small change in `raid-import` and the attendance rates.
- **RF5. [ ] S — Attendance without a button:** we already sample presence;
  make sure it starts on group invite/raid start automatically (verify in the
  checklist, section 2).
- **Skip for now:** combat-log interrupt/soulstone tracking (the combat log is
  blocked for addons since 12.0.0), and a separate web app.

**iddqd** (loot voting, ready check with consumables, attendance snapshots,
auto-marking, profession sync, gambling, plus a Discord bot and web dashboard).
The closest thing to us; it's a competitor to watch, not to copy.
- **ID1. [ ] M — Loot response voting** (BiS / Upgrade / Minor / Off-spec / PvP /
  Pass) in our bidding popup, so raiders declare need before bidding, and the
  officer sees responses next to PR. Fits `Bidding.lua` and loot history.
- **ID2. [ ] M — Ready check with consumables** (same as G2): flask/food/buffs
  shown on the ready-check reply, exported to `/readiness raid`.
- **ID3. [x] S — Attendance snapshots:** an officer button/`/qg snapshot` that
  records who's in the raid *now* with a label ("pre-pull", "after Ragnaros").
  Complements our automatic presence sampling; useful for disputes.
- **ID4. [ ] S/M — Auto-marking profiles** (`/qg mark <profile>`): set raid
  target icons on named mobs. Marking in combat is limited; low priority.
- **ID5. [ ] M — Permission model in the addon:** raid-leader-controlled access
  with assists, guild ranks, or both. We use officer detection; add "assistants
  can start/end raids" as a setting (ties to LR2).

**Guild Paragon** (roster, alt/main tagging, event log, recruitment queue, ban
list, backups, TSV export; Retail and Forever).
- **GP1. [ ] M — Guild event log** (joins, leaves, rank changes, level-ups, alt
  assignments, note changes), exported and shown in Discord as `/guildlog` and
  in the officer-log channel. Builds on LR1's event stream and
  `postToLogChannel`.
- **GP2. [ ] S — "Do Not Invite" / ban list shared by officers** with rejoin
  warnings (when a listed person joins the Discord or the guild, the officer
  log says so). We have `/mod` for Discord; this is the WoW side.
- **GP3. [ ] S — Alt/main tagging with nicknames and aliases,** shown in chat
  hints and `/who`. Our Discord link already gives main/alts; add an in-game
  read of it (same source as G9).
- **GP4. [x] S — TSV/CSV export** of roster, attendance and loot (`/export`),
  for officers who live in spreadsheets. We have backups; this is readable.
- **GP5. [ ] S — Backup and restore in the addon** (before risky operations
  like a season reset), with confirmation for destructive actions.
- **GP6. [ ] M — Recruitment queue:** track prospects the officers whisper,
  follow-up reminders, and stats. Our `/application` covers Discord
  applicants; this covers in-game prospects. Keep it manual (the addon
  can't auto-whisper).
- **GP7. [ ] S — "Officer-only sections hidden from members":** apply to our
  tools panel tabs so members never see officer-only buttons (they're refused
  already; hiding is polish).

**iRC: Guild Connect** (guild home page, member verification, guild bank
overview, shared professions, guild map, challenge-guild rules). It does not
bridge to IRC or Discord despite the name.
- **IR1. [ ] M — Guild bank overview:** the addon snapshots the guild bank
  character's inventory (guild bank tab data when open, or a designated bank
  alt's bags) and the bot lists what's in stock, so `/bank request` can say
  "in stock: 12". Needs the API guarded (`Compat.lua`).
- **IR2. [ ] S — Onboarding for new guild members in game:** a welcome whisper
  with the Discord invite and `/character import` instructions (same as G8).
- **IR3. [ ] M — Member verification:** prove a Discord member owns a WoW
  character with a one-time code typed in a guild note or `/qg verify <code>`
  (bot-issued). This is the safe way to do #40's auto-linking and stops people
  claiming someone else's character.
- **IR4. [x] S — Guild statistics view** (class/race distribution, level
  ranges, activity) in the weekly report. We have `/stats`; add the
  distribution numbers once the roster is exported.
- **Skip:** guild map, server-wide guild directory/leaderboard, racial chat
  styles, challenge-guild enforcement (race-locked, self-found rules).

**GuildKit** (guild-window toolkit: roster search, analytics, activity feed,
auto-invite phrase, ban list, purge tools; Retail/Classic/Forever).
- **GK1. [x] S — Auto-invite phrase** (`ginv`-style whisper triggers a guild
  invite) with optional level/class/race gates and an officer on/off switch.
  Pairs with the recruitment work in G8/GP6. Guild invites are protected in
  combat only; fine out of combat.
- **GK2. [x] M — Inactivity report and purge helper:** list members inactive for
  N days (from last-seen data we already export) with rank and note filters.
  **Read-only in Discord/addon output**; kicking stays a human action.
- **GK3. [ ] S — Activity feed with notification filters** (level-ups, joins,
  rank changes) as an in-game panel; same event stream as GP1.
- **GK4. [x] S — Composition charts** (class/level/rank/race/zone) in the addon
  and in `/stats`; same data as IR4.

**Common themes to prioritise**
1. **Roster events and real officer permissions (LR1, LR2)** unlock GP1, GK3,
   G8 and GP2. Best foundation to build first.
2. **Recipes, cooldowns and bank stock (PM1, PM2, IR1, G5)** all need addon
   data the companion doesn't carry yet; one shared "extra export" design.
3. **Verification (IR3)** is what makes fully automatic character linking (#40)
   safe.
4. **Loot responses and consumables (ID1, ID2, G2)** improve raid night the
   most and reuse the bidding module.
5. Anything using the combat log (interrupt tracking, soulstones) is blocked
   by the platform since 12.0.0; don't plan around it.

### Code-level review of the addons that have source (2026-09-26)

Read the actual code of GuildOS (`danielcosta42/guildos`, about 60 Lua modules),
Guild Paragon (`Earthenmist/Guild-Paragon`) and iRC: Guild Connect
(`Crasling/iRCGuildConnect`). **Not reachable:** the GitHub URLs for Profession
Master (`Kurki/ProfessionMaster`) and LibGuildRoster (`Pimptasty/GuildRoster`)
return 404 (private, renamed or removed), and vGambler, iddqd, GuildKit and
Raidify's addon publish no source; those were judged from their pages only
(see the earlier review). Licences are "none stated" or all rights reserved, so
everything below is an idea to build ourselves, never code to copy.

**Facts that matter for us right now**
- **Forever's names have no realm and carry a hyphen.** Both GuildOS and Guild
  Paragon special-case it (`IsForeverClient` returns the peer name as is; GuildOS
  builds Forever keys itself and tags exports `game = FOREVER`). Our addon takes
  the realm from `GetRealmName()` (new `/qg character`, consumable scan) and from
  the companion config. **Verify in game tonight** (checklist section 3) and
  centralise it (item X1).
- **GuildOS's consumable checker only exists on TBC Anniversary** because it
  matches buff *spell IDs* (a TBC list) and is switched off elsewhere. Ours
  matches buff *names*, so it should work on Forever, but it can't tell battle
  from guardian elixirs or see oils on other players. Keep names, add optional
  ID tables later.
- **Their sync is a versioned, compressed, idempotent protocol** (envelope with
  version, message id, entity revision, source; LibSerialize + LibDeflate +
  ChatThrottleLib; every point award has an `opId` applied once). Ours is
  plain pipe strings under 255 bytes with no version field.
- **Two of them test Lua outside the game** (iRC: standalone scripts with a mocked
  WoW API; GuildOS: an in-client `/gos selftest`). Our Lua checks lived in a
  scratch folder and were never committed.

**Recommended next (best value for effort)**
1. **X1: one place for player identity on Forever** (below) and a `/qg diag`
   line showing what `GetRealmName`/`UnitName` return. Prevents silent
   character-matching failures.
2. **X2: copy-paste export (`QGEXP1:` string)** so a member without the
   companion can send data: in-game box, then `/import code:`. GuildOS ships
   exactly this (`GOSCOMP1:` = compressed, print-safe, pasted into its site).
3. **X3: commit Lua tests** (mocked WoW API, run in CI with a Lua interpreter
   such as `fengari` from npm) plus an in-game `/qg selftest`.
4. **X4: versioned addon-message envelope** with a protocol number, so old and
   new addons can coexist after an update.
5. **X5: login digest** ("since your last login: new members, loot, raids").
6. **X6: read-only public API** (`QuebecGoldAPI`, versioned) so WeakAuras or
   other addons can read standings and readiness without touching saved data.

**From GuildOS** (`GO`)
- **GO1. [x] M: per-core rules** *(built 2026-09-27: `/core rules` with guild defaults for every core, per-core overrides for EP values, base GP, decay and loot mode, optional separate point pool with `core:` on `/epgp`; tests/core-rules.test.ts. Standings.lua shows the guild pool only.)*. Its Core Manager gives each raid core its own
  loot rules, attendance penalty weights and point pool. Our cores (#43) only
  give signup priority. Add per-core EPGP pool/decay, attendance rules and
  class-default roles (tank/healer/melee/ranged).
- **GO2. [x] M: points modes:** DKP, EPGP or **loot council** (points shown but
  not enforced). We are EPGP-only; council mode is a setting plus hiding the
  bid buttons.
- **GO3. [x] M: readiness aggregator:** one status per member (ready / warn /
  not ready / no data) from attunement + enchants + item level + consumables,
  sorted most-actionable first, optionally against a *target raid* ("not attuned
  for BWL"). We have gear + consumables; add attunements and sorting to
  `/readiness raid` and the readiness board.
- **GO4. [ ] S: attendance penalty for missing consumables** (100% base, minus
  a configurable step per issue), as an opt-in rule tied to GO1.
- **GO5. [x] M: enchant summary** (which equipped slots lack an enchant) in the
  snapshot and board; "four slots unenchanted" is more useful than an item level.
- **GO6. [ ] S: pug inspector:** on joining a group, classify members against
  our own data (Discord ban list from `/mod`, guild roster, alt links, notes).
  Read-only, no new sync.
- **GO7. [x] S: polls:** officers create a poll, members vote (in game and in
  Discord), one result. Simple and popular.
- **GO8. [ ] M: SoftRes import (softres.it / Gargul export)** into the wishlist and
  bidding popup. Guilds using soft reserves won't retype them (see also G13 TMB).
- **GO9. [x] S: backup/restore string** for the addon's SavedVariables ("copy
  this before a risky change"), complementing the bot's nightly database backup.
- **GO10. [ ] S: open crafting-query protocol** (a published addon prefix any
  addon may answer for "who can craft item X?"). Only worth it if other addons
  adopt it; low priority next to PM1.

**From Guild Paragon** (`GP`, adds to GP1 to GP7)
- **GP8. [x] S: public read-only API with a version number** and an explicit
  "no write methods" rule, because writes would bypass permission, sync and
  logging paths (= X6). Their `API.md` is a good template.
- **GP9. [ ] S: rate-limit full-state requests between peers** (they cap sessions
  with a request limit, back-off and lease). Matters once #40 sends more data.
- **GP10. [x] M: guild health dashboard for officers:** retention cohorts at 30, 60
  and 90 days, attention signals with severity (critical/warning/info), new-member
  watch. Fits the bot's `/stats` and weekly report better than the addon.
- **GP11. [ ] S: attribute guild events using the native guild log** (who invited or
  kicked whom) so the event log (GP1) names the actor.
- **GP12. [ ] M: import from Guild Roster Manager (GRM)** as a migration path for
  guilds switching to us (they import GRM data). Discord side: `/import` of a
  roster CSV/JSON into characters, alts and notes.
- **GP13. [ ] S: opt-in local performance recorder** (per-operation timings, bounded
  history, no gameplay payloads) so "the addon is slow" reports have numbers.
- **GP14. [ ] S: security policy file** (`SECURITY.md`) and contributor notes before
  a public release (= G12/#46).

**From iRC: Guild Connect** (`IR`, adds to IR1 to IR4)
- **IR5. [ ] M: chunked transfer with checksum and "newer wins" tie-break** for
  bigger data (guild bank snapshot, recipe lists): 170-byte chunks, a chunk cap,
  a digest to detect a stale copy, tie-break on save time then owner name.
  Required groundwork for IR1, PM1 and #40.
- **IR6. [ ] S: diagnostics ring buffer** (500 entries, slow-operation threshold in
  ms, opt-in event tracing). Our `/qg diag` keeps errors only; add timings.
- **IR7. [ ] M: identity store per guild:** characters, former members and
  "missing counts" (how many rosters a name has been absent from) to tell a
  departure from a temporary absence. Feeds GP1 and GK2.
- **IR8. [x] S: standalone Lua tests** (= X3): their tests load the addon file with
  a mocked `GetBuildInfo`, `UnitName`, `GetRealmName`, frames and `LibStub`, and
  `assert` the behaviour. The same technique works for Consumables.lua and Core.lua.

**From the ones without source** (recap, ranked)
- Profession Master: recipe database with a compressed relay (PM1), cooldowns
  (PM2), `!who` lookup (PM3).
- LibGuildRoster: roster from chat events plus real officer permissions (LR1, LR2).
- Raidify: mass invite and bench credit (RF1, RF4). Its desktop companion is
  open source (MIT); worth reading before we touch our own companion again.
- iddqd: loot response voting and attendance snapshots (ID1, ID3); it also has a
  Discord bot and dashboard, so it's the one to compare against feature by feature.
- GuildKit: auto-invite phrase (GK1), inactivity report (GK2).
- vGambler: ban list and session stats for the casino (VG1, VG2).

**Cross-cutting items (new)**
- **X1. [x] S: player identity on Forever:** a single `ns.compat.playerKey()` /
  `ns.compat.normalizeName()` that knows Forever (no realm, hyphenated names) and
  is used by the consumable scan, `/qg character`, roster, the companion and the
  bot's character matching. `/qg diag` prints the raw values.
- **X2. [x] M: `QGEXP1:` paste export + `/import code:`** (compressed, print-safe;
  needs either bundled LibDeflate or a small pure-Lua compressor, decision
  needed). Uses the existing import path, so no new trust model.
- **X3. [x] M: Lua test suite in the repo + CI.**
- **X4. [x] M: versioned message envelope** (`v`, `id`, addon version, payload
  version) with accept-old/send-new during transition.
- **X5. [x] S: login digest.**
- **X6. [x] S: `QuebecGoldAPI` read-only v1.**

---

## Status snapshot (2026-09-24, historical — see "Where we are" at the top)

- Part 1 (correctness audit): **all 12 items fixed and verified.** `tsc`
  clean, 22/22 tests passing, `eslint` clean. Only the manual end-to-end
  Discord+WoW-client test pass (see bottom of Part 1) is still outstanding.
- Part 2 (feature roadmap): research done. **Phases 8, 9, and 10 (full
  scope, including automatic guild-wide addon sync) implemented and
  verified** — `tsc` clean, 35/35 tests passing, `eslint` clean, all four
  migrations applied to the live Neon database. Also fixed a critical
  pre-existing bug in the Lua→JSON converter that would have broken the
  entire addon-import pipeline against real SavedVariables data — see
  Section A's decision-log entry. Phase 11 and the backlog are still just
  planned, not started.

---

## Part 1 — Correctness audit (completed 2026-09-24)

Full original writeup is in git history if the detail below isn't enough;
this is the condensed version now that everything's fixed.

### Critical fixes
- [x] **Readiness pipeline wired up.** `addon-import.ts apply()` now creates
  `InspectedCharacterSnapshot` rows for addon-exported readiness data
  (best-effort — an unmatched character is skipped, doesn't abort the whole
  import). Previously `/readiness` could never show anything but UNKNOWN.
- [x] **Addon EPGP now reaches the bot's EPGP ledger.** Added
  `addonEpgpTransactionSchema` + `epgpTransactions[]` to the addon contract
  (`src/integrations/addon.ts`); `companion/lua-export.mjs` detects
  `db.epgp` vs. legacy `db.dkp` and emits the right shape; `apply()` writes
  real `EpgpTransaction` rows. Previously everything landed in the legacy
  DKP table no matter what.
- [x] **Loot auction bid deadlock fixed.** `placeBid`/`closeAuction` in
  `src/services/loot.ts` no longer require a bidder to already hold GP —
  GP is a lifetime cost tracker (only grows when you win), not spendable
  currency. The old check meant nobody could ever place a first bid.
- [x] **Permission model now matches the docs.** `src/permissions.ts`:
  Officer inherits Guild Master; Raid Leader/DKP Officer/Loot
  Leader/Class Leader all inherit Officer + Guild Master. A Guild Master no
  longer needs to also hold every specific Discord role.
- [x] **Companion API fails closed.** `src/companion-api.ts`'s `authorized()`
  now denies all requests when no token is configured, instead of silently
  allowing everything outside production. A real 64-char token is set in
  `.env.local`.
- [x] **Prisma CLI can find `DATABASE_URL`.** Added `scripts/with-env.mjs`
  (loads `.env.local` then `.env` the same way the app does) and routed
  `prisma:generate`/`prisma:migrate` through it. Confirmed live against the
  Neon database.

### Secondary fixes
- [x] **EPGP decay wired up manually.** `/epgp decay` (officer-gated) applies
  the configured `epgpDecayPercent`. Went with manual trigger over a cron
  scheduler since the bot isn't guaranteed to run 24/7 — a silent scheduler
  miss during downtime would be worse than a manual command. Percent is now
  settable/viewable via `/config`. `epgpDecayIntervalHours` stays unused;
  revisit if the bot ever runs as an always-on service.
- [x] **`/raid boss` command added**, resolving a boss by name within a raid
  and calling the previously-unwired `raidService.setBossStatus()`.
- [x] **`companion/companion.config.json` gitignored** before it can ever
  leak a live upload token.

### Minor / addon fixes
- [x] **Two addon bugs found while wiring readiness** (only mattered once
  the pipeline was actually live): empty gear slots produced an
  empty-string `itemName` that failed the bot's validation and would have
  rejected the *entire* export; item name/id were raw WoW item-link markup
  instead of a parsed name/id. Both fixed in
  `addon/QuebecGold/QuebecGold.lua`.
- [x] **False NOT_READY for two-handed weapon users** — missing OffHand is
  now a WARNING, not an ERROR (can't reliably tell "2H equipped" from
  "forgot offhand" from the addon API alone).
- [x] **Slash-command internal name typo** fixed (`QUEBECCOLD` →
  `QUEBECGOLD`, cosmetic only).
- [x] **`/profile` shows EP/GP/PR as primary**, DKP explicitly labeled
  legacy; `/dkp`'s description now says it's superseded by `/epgp`.

### Verification
- [x] `npx tsc --noEmit` clean · `npx vitest run` 22/22 passing (added
  regression tests for the loot-bid deadlock and the new EPGP/readiness
  schemas) · `npx eslint .` clean. (2026-09-24)
- [~] **Live end-to-end test — in progress 2026-09-24 (first real run).**
  Findings so far, in case a session gets interrupted mid-test:
  - **Bot login required Server Members Intent to be manually enabled** in
    the Discord Developer Portal (Bot tab → Privileged Gateway Intents) —
    expected per the Phase 8 writeup, confirmed as a real hard blocker: the
    bot could not log in at all without it (`Error: Used disallowed
    intents`). Fixed by enabling it; bot now logs in successfully.
  - **Discord "Application Name" vs. bot "Username" are two independent
    fields.** Renaming the application in Developer Portal → General
    Information does not rename the bot's actual Discord username — that's
    a separate field on the Bot tab. Caused confusion when the bot logged
    in showing its old name after the app was renamed to "Thrall."
  - **Found a real WoW addon bug on first live run:** "QuebecGold has been
    blocked from an action only available to the Blizzard UI" popup on
    login. Leading suspect was the `OnUpdate`-based auto-sync ticker added
    in Phase 10 (per-frame polling is a common WoW "taint" source) — removed
    it entirely and moved the same debounced sync logic directly into real
    event handlers (`PLAYER_ENTERING_WORLD`, `UNIT_INVENTORY_CHANGED`,
    `GROUP_ROSTER_UPDATE`) instead. **Still occurred after that fix**,
    meaning the `OnUpdate` ticker either wasn't the (sole) cause or there's
    a second issue — not yet confirmed which, since the popup itself never
    names the actual blocked function.
  - **Built a diagnostics tool specifically to stop guessing at this
    class of bug** (`Core.lua`): hooks `ADDON_ACTION_BLOCKED`/
    `ADDON_ACTION_FORBIDDEN` (the events WoW fires with the *exact* addon
    and function name it refused to call — normally invisible unless
    something listens for them) and the global Lua error handler (filtered
    to errors mentioning this addon), logs both into
    `QuebecGoldDB.diagnostics` and prints immediately to chat, and exposes
    `/qg diag` to review the last 25 entries. **Next step once retested:**
    reproduce the popup with this build installed, read what `/qg diag` (or
    the immediate chat line) actually names as the blocked function, and
    fix that specifically instead of guessing again.
  - Not yet reached: the rest of the test script below (raid/EPGP/loot/
    companion-import flow) — blocked on getting the addon fully stable
    first.

Original suggested script, still the plan once the addon issue above is
resolved:
  - Two test Discord accounts, one with only "Officer", one with only
    "Raid Leader" — confirm the new permission inheritance behaves as
    intended in real Discord, not just in unit tests.
  - `/raid create` → `/raid signup` → `/raid start` → `/raid attendance` →
    `/raid boss` → `/raid end`.
  - `/epgp award-ep`, `/epgp award-gp`, `/epgp balance`, `/epgp decay`.
  - In-game: `/qg start`, `/qg attendance`, `/qg boss`, `/qg award`,
    `/qg gp`, `/qg inspect`, `/qg export`. Confirm exported item names are
    clean (not raw links) and a fully-geared 2H character shows
    PARTIAL/READY, not NOT_READY.
  - Point the companion watcher at a live SavedVariables file with a token
    matching `.env.local`, confirm upload, then `/import-apply` and check
    EPGP balances and `/readiness` both update.
  - `/loot auction` → zero-GP test account `/loot bid` → `/loot close` →
    confirm the award posts and GP increases.

---

## Part 2 — Feature roadmap: toward a complete Guild OS + Discord housekeeping bot

### Research (2026-09-24)

Goal was to benchmark Quebec Gold against the popular WoW guild-management
addons and against Carl-bot's Discord housekeeping feature set, to find
concrete gaps worth closing.

**"ForeverLootManager"** (the placeholder addon-source name used in this
repo's own tests) does not appear to be a real, publicly documented addon —
no listing on CurseForge/WowAce/WowInterface/Wago. The closest real match on
the *same server* is a guild-management addon built specifically for WoW
Forever, discussed on Barrens Chat, currently in beta and looking for guilds
to test it: automatic roster sync (gear/specs/professions/attunements, no
manual entry), attendance recorded from actual in-game presence rather than
signups (flags people who signed up but didn't show), loot history + loot
master with loot-council and wishlist support, enchant audit and buff/
cooldown coverage for officers, and an optional website + Discord bot so
signups/attendance show in both places. ([Barrens Chat thread](https://barrens.chat/viewtopic.php?t=13392&p=43128))
This is functionally the same product category as **Guild OS**, which has a
public TBC Anniversary build:

- **Guild OS** — replaces the default guild frame with a roster hub (Name,
  Level, Class, Race, iLvl, Professions, Attunements, Attendance%), synced
  guild-wide via a chunked addon-comms protocol (~5 min interval + manual
  sync). Officer toolkit: enchant audits, raid tools, attendance scoring,
  Gargul-style MS/OS loot master with wishlist awareness and
  attendance-weighted tiebreakers, loot history, trial tracking (configurable
  period, sponsor, status, eval notes), auto-recruit popup on an interval,
  alt linking, rank config. Has an actual `/guildos recruit ... discord ...
  welcome ...` command surface bridging in-game recruitment to Discord.
  ([CurseForge](https://www.curseforge.com/wow/addons/guild-os))
- **RCLootCouncil** (+ the **Merit** module) — the standard loot-council
  addon; Merit adds a transparent, math-based priority score (Audit +
  Attendance + iLvl Boost + Loot Penalties) specifically to kill "loot
  council fatigue" and perceived bias. Directly relevant to how this
  project's EPGP PR score could evolve.
  ([CurseForge](https://www.curseforge.com/wow/addons/rclootcouncil-merit))
- **Gargul** — GDKP/SoftRes/TMB (thatsmybis.com) integration, wishlist
  import with tooltip + roll integration, auto-loot routing (greens to DE,
  epics to ML), auto-invite/sort from a raid signup. No native Discord
  integration — addon-side only. ([CurseForge](https://www.curseforge.com/wow/addons/gargul))
- **Guilds of WoW** (addon + Discord bot combo) — the clearest addon+Discord
  precedent: Discord-side events with role caps (tank/healer/melee/ranged),
  auto-locking signups, attendance synced periodically between Discord and
  the addon, Warcraft-Logs auto-posted to event channels, Google Sheets
  export. ([guildsofwow.com](https://guildsofwow.com/))
- **Carl-bot** (Discord housekeeping benchmark, 349M+ members served) —
  welcome/farewell messages with variables, reaction roles (normal/unique/
  binding/reversed), automod, moderation (warn/mute/ban) with logging of
  message edits/deletes and member join/leave, custom commands/tags,
  starboard, leveling. ([docs.carl.gg](http://docs.carl.gg/), [feature overview](https://bforbloggers.com/carl-bot-features-commands/))

**Takeaway:** Quebec Gold's EPGP/raid/loot core is already ahead of a plain
spreadsheet (which is what several other Forever guilds are still using —
see the CODEX and Mk. Ultra spreadsheet threads on Barrens Chat) but is
behind Guild OS specifically on *automatic* data collection (roster/gear/
attunement sync without manual commands), attunement tracking, and a
loot-council alternative to pure GP-bidding. It has **zero** Carl-bot-style
general Discord housekeeping today — that's a fully new surface, not a gap
in the existing one.

### A. WoW addon upgrades

- [x] **P0 / M — Attunement tracking.** *(Phase 10, done 2026-09-24)*
  `/qg attune <key>` (self) and `/qg attune <player> <key>` (officer, append
  `clear`/`false`/`no` to unmark) in the addon, stored in `db.attunements`
  and included in exports. Bot side: new `CharacterAttunement` model
  (migration `20260924124828_phase_10_attunements`), `src/services/
  attunement.ts`, and `/attunement set`/`/attunement list` Discord commands
  (self-service, mirroring `/profession`'s existing pattern). Addon-imported
  attunements flow into the same table via `addon-import.ts apply()`
  (best-effort matching, same as readiness — an unlinked character doesn't
  block the rest of the import).
- [x] **P0 / M — Automatic roster/gear sync between guild members.** *(Phase
  10, done 2026-09-24 — completed in two passes, see decision log for why.)*
  Professions self-report automatically via `/qg inspect`
  (`GetProfessions`/`GetProfessionInfo`) into the existing `ProfessionSkill`
  table — no new command needed, `/profession list` and `/profile` already
  show addon-synced data. On top of that, per "as much sync as possible":
  `inspectReadiness()` now also broadcasts a compact digest (status,
  missing-gear count, lowest durability, professions) to the `GUILD` channel
  automatically on `PLAYER_ENTERING_WORLD`, on `UNIT_INVENTORY_CHANGED`
  (debounced 5s), and on `GROUP_ROSTER_UPDATE` while in a raid (throttled to
  once per 10 min) — see `maybeAutoSync()` in `Core.lua`. **Revised
  2026-09-24 during live testing:** this originally used a per-frame
  `OnUpdate` accumulator instead of these events directly; removed it after
  hitting a real "blocked from an action only available to the Blizzard UI"
  popup on first live run, since `OnUpdate` polling is a common source of
  WoW's taint bugs. Moved the exact same debounce logic into the real event
  handlers instead — see the live-test findings in Part 1's Verification
  section for the ongoing diagnosis (the popup recurred even after this
  fix, so it isn't confirmed as the sole cause yet). Every other online
  client's addon receives these and stores them in `db.peerRoster`, keyed by
  character; `/qg export` now includes `peerRoster`, and
  `companion/lua-export.mjs` folds it into synthesized readiness entries
  (real gear list from `/qg inspect` still only exists for the inspecting
  player — peer digests carry status/professions only, not item names).
  Spec auto-detection and item-level capture stay scoped out — the client
  genuinely lacks both APIs on this interface version.
  **Critical bug found and fixed while building this:** `evaluate()` in
  `companion/lua-export.mjs` treated every WoW-style bracketed-key array
  (`{ [1] = a, [2] = b }` — how the real SavedVariables writer always
  serializes array-like tables, never the compact `{ a, b }` form) as a
  numeric-keyed **object**, not an array, and treated every empty table as
  `{}` rather than `[]`. Since every array field in the addon's export
  (`items`, `findings`, `professions`, `consumables`, ledger entries) is
  exactly this shape, **the entire addon-import pipeline would have
  silently rejected or malformed every real SavedVariables export** —
  something no test in this repo had ever caught, because every prior test
  constructed JSON payloads directly in JS rather than round-tripping
  through the real Lua parser. Confirmed by hand: wrote a realistic fixture
  using the actual WoW bracketed-key syntax, ran it through
  `readAddonExport` before and after the fix, and validated the output
  against the bot's real zod schema end to end (`tests/lua-export.test.ts`
  now covers this permanently — array detection, peer-roster folding, and
  full schema validation, all against realistic Lua syntax rather than
  hand-built JS objects).
- [x] **P1 / M — Attendance from actual raid presence, not just manual
  marking.** *(Done 2026-09-24. Addon v1.3.0: `db.presence` records
  everyone seen in the group while a raid is active; `/qg attendance seen`
  marks them PRESENT without overwriting manual marks. Bot: the companion
  exports finished raids (marks + presence); `/import-apply` matches each to
  the Discord raid scheduled closest to its start (within 4h), records
  attendance without overwriting Discord-recorded rows, marks signed-up
  members never seen as ABSENT (only when presence was recorded), and
  reports no-shows and walk-ins. `src/services/raid-import.ts`,
  `tests/raid-import.test.ts`.)*
  Hook `GROUP_ROSTER_UPDATE` while a raid is active in the addon
  to auto-record who was actually in the raid group over time, and flag
  "signed up but didn't show" vs. "showed but didn't sign up" — the officer
  `/qg attendance` command stays as a manual override on top, not a
  replacement.
- [x] **P0 / S — Built-in diagnostics for the addon itself.** *(Added
  2026-09-24, unplanned — came out of live-testing the addon for the first
  time and hitting an unexplained blocked-action popup with no way to see
  which function caused it.)* `Core.lua` now hooks
  `ADDON_ACTION_BLOCKED`/`ADDON_ACTION_FORBIDDEN` (fire with the exact addon
  and function name WoW refused to call — otherwise invisible unless
  something listens for them) and the global Lua error handler (filtered to
  errors mentioning this addon), logs both to `QuebecGoldDB.diagnostics`
  (last 25, also included in `/qg export`), and prints immediately to chat.
  New `/qg diag` command reviews recent entries. This is a permanent
  addition, not a one-off debugging hack — it's the addon's only way to
  surface this class of bug without installing a separate error-display
  addon like BugSack.
- [x] **P2 / M — Minimap button with a quick-access menu.** *(Button
  confirmed live 2026-09-24. The first panel was a template text box and the
  user found it clunky, so v1.3.0 replaced it with a tabbed window (Raid,
  EPGP, Me, Casino, Tools) and a shared Player box that fills from your
  target, Me, or a clickable group list; presets for amounts/wagers/
  attunements; one-click casino (the addon rolls for you); two-click confirm
  on whole-group actions; officer buttons greyed out for other ranks. Still
  avoids dropdown menus, unit right-click menu hooks, and StaticPopups
  (common taint sources).)* Original notes: A draggable coin button on the
  minimap opens a plain tools panel: one-click actions plus a text box that
  pre-fills templates for commands needing arguments (refuses to run while
  `<placeholders>` remain). `/qg menu` and `/qg minimap show|hide|reset` as
  fallbacks if the button is lost. Built in a way meant to survive Mainline
  API churn: no dropdown-menu APIs, `BackdropTemplate` only when it exists,
  everything created inside `pcall` so a UI failure can never break the core
  addon. Original request text follows. Requested
  2026-09-24 ("we need an addon button in wow to quickly access the
  interface and use all the tools"). A small draggable minimap icon with a
  right-click dropdown covering the main `/qg` actions (inspect, attune,
  casino games, raid status, diag) so members don't need to remember slash
  command syntax. No external library needed (a hand-rolled draggable
  button is straightforward); deliberately not built yet — held off adding
  more addon UI/frame code while a live frame-related bug was still being
  chased in the same session. Pick this up once the addon is confirmed
  stable in real play.
- [~] **P2 / S — Wishlist / soft-reserve.** *(Bot side done 2026-09-24;
  in-game addon side not built.)* `/wishlist add|remove|list|item` on the
  bot (new `WishlistEntry` table, case/space-insensitive item matching,
  priority 1-3), and `/loot auction` now notes how many raiders wishlisted
  the item. Purely informational — doesn't change how loot is awarded.
  Remaining: an in-game `/qg wishlist` command and syncing addon wishlists
  through the import pipeline — addon work, untestable while the servers
  are down and the addon has an open bug.
- [ ] **P2 / M — Buff/cooldown coverage check.** Extend `/qg inspect`-style
  reporting to a raid-wide view: which raid buffs/consumable categories are
  covered vs. missing across the current roster. Officer-only, informational.
- [x] **P1 / S — Addon version check.** *(Done 2026-09-24, v1.3.0,
  `Modules/Sync.lua`; older clients are also whispered directly.)* Broadcast
  the addon version on login; clients print "a newer Quebec Gold is out"
  when a guildmate runs a higher version. Cheap, and it removes the most
  common support problem (members on stale builds).
- [x] **P1 / M — EPGP standings in game.** *(Done 2026-09-24, v1.3.0: bot
  `GET /api/v1/standings`, `companion/standings.mjs` writes `Standings.lua`
  every 15 min, `Modules/Sync.lua` shares it guild-wide in chunks, accepted
  only from officers; `/qg standings`, EPGP tab shows Discord numbers.)* Data
  only flows addon → bot today. The companion could write a generated
  `Standings.lua` into the addon folder (loaded on `/reload`) so
  `/qg standings` and the loot flow show the bot's real EP/GP/PR.
- [ ] **P1 / L — In-game GP bidding tied to the bot.** *(Suggested
  2026-09-24.)* Officer shift-clicks an item to open bidding, raiders bid
  from a popup, the winner's GP is recorded with a ledger id (so it imports
  cleanly). Replaces typing `/qg gp` by hand mid-raid.
- [~] **P2 / M — Casino debt settlement by trade.** *(Built 2026-09-24,
  v1.4.0, not yet seen live: trade money is read on accept and applied
  when the game reports "Trade complete", in both directions. Unverified
  whether Forever restricts any trade events; everything is pcall-guarded.)*
  Offer to clear a debt when a trade with that player completes with gold
  in it.

### B. Discord bot — EPGP / guild-manager upgrades

- [x] **P0 / S — Raid signup role caps + auto-lock.** *(Phase 9, done
  2026-09-24)* `/raid create`/`/raid edit` take optional `tanks`/`healers`/
  `dps` caps (stored on `Raid`); `/raid signup` now requires a `role` and
  `raidService.signup()` rejects once that role's cap is hit (excluding the
  requester's own existing slot, so re-signing up or switching role never
  falsely self-blocks). Auto-lock on `/raid start` turned out to already
  exist — `signup()` already rejected once `raid.status !== "PLANNED"` — so
  no new work was needed there, just test coverage confirming it.
  **New, beyond the original scope:** since the guild has a dedicated raid
  signup Discord channel, added `/config raid-channel` + a live-updating
  signup embed (`syncSignupEmbed` in `src/commands/raid.ts`) that posts once
  on `/raid create` and refreshes in place on every subsequent
  signup/cancel-signup/edit/start/end/cancel, showing status, start time,
  and per-role fill counts. Migration:
  `20260924121417_phase_9_raid_role_caps_and_signup_channel` (adds
  `tankLimit`/`healerLimit`/`dpsLimit`/`signupChannelId`/`signupMessageId`
  to `Raid`, `role` to `RaidSignup` defaulting to `DPS` for existing rows,
  `raidSignupChannelId` to `GuildSettings` — all additive, applied live).
- [x] **P1 / M — Merit-style transparent priority score.** *(Done
  2026-09-24.)* `/epgp leaderboard` now shows 30-day attendance (Present =
  1, Late = 0.5, from `/raid attendance` records on COMPLETED raids), and
  `/config merit enabled:true` orders it by PR x attendance instead of raw
  PR. Display only — the ledger is never touched. Deliberately simple and
  fully visible (formula is in the embed footer) rather than a hidden
  score. Readiness pass rate was *not* blended in: it would make the score
  depend on addon data that isn't reliably flowing yet. Caveat: attendance
  only counts what officers recorded, so members with no records show 0%.
- [x] **P2 / S — Scheduled recruitment auto-post.** *(Done 2026-09-24.)*
  `/config recruitment channel message interval_hours`, checked every 10
  minutes from `main.ts` while the bot is running (`runRecruitmentPosts` in
  `src/services/recruitment.ts`). Because the bot runs from a PC that isn't
  always on, a missed window posts on the next check — it never queues
  catch-up posts. Posts never ping anyone.

### C. Discord housekeeping (Carl-bot parity)

This is genuinely new surface area — none of it existed before Phase 8.
Ordered so each item either stands alone or builds on the previous one.

- [x] **P0 / S — Welcome & farewell messages.** *(Phase 8, done
  2026-09-24)* `/config welcome` / `/config farewell` set a channel +
  optional templated message (`{mention} {username} {guild}
  {membercount}`), posted from `src/services/housekeeping.ts` on
  `GuildMemberAdd`/`GuildMemberRemove` (wired in `src/main.ts`). Default
  welcome template prompts `/apply` or `/character add` directly, tying
  housekeeping into the existing recruitment flow instead of bolting it on.
  Requires the **Server Members Intent** privileged intent enabled in the
  Discord Developer Portal (documented in README) — the bot now requests
  `GatewayIntentBits.GuildMembers`.
- [x] **P0 / S — Auto-role on join + role sync with `/application`.**
  *(Phase 8, done 2026-09-24)* `/config roles` sets an applicant role
  (auto-assigned on join, in `handleMemberJoin`) and a member role
  (auto-assigned, with applicant role removed, when an officer runs
  `/application approve` — see `syncApprovedMemberRoles` called from
  `src/commands/application.ts`). Requires the bot's own Discord role to
  sit above both configured roles or Discord will silently refuse the role
  edit (documented in README); all role operations are wrapped so a
  misconfiguration logs a warning instead of crashing the handler.
  Migration: `20260924115156_phase_8_discord_housekeeping` (adds
  `welcomeChannelId`, `welcomeMessageTemplate`, `farewellChannelId`,
  `farewellMessageTemplate`, `applicantRoleId`, `memberRoleId` to
  `GuildSettings`, all nullable — additive, already applied to the live
  Neon database).
- [x] **P1 / M — Moderation basics + unified audit log.** *(Done
  2026-09-24.)* `/mod warn|timeout|kick|ban|history` (officers). Extended the
  existing `AuditAction` enum with `MODERATION_*` values, so moderation
  lands in the same `AuditLog` as EPGP/config/import actions; `history`
  reads it back per member. Refuses up front per Discord's role hierarchy
  (`hierarchyError`, unit-tested) and requires a reason. Bans work on users
  who already left. Uses slash commands rather than `/warn` etc. as
  top-level names, to keep the command list tidy.
- [x] **P1 / M — Reaction roles.** *(Done 2026-09-24, as buttons.)*
  `/selfroles` posts a panel of buttons that toggle roles. Chose buttons over
  emoji reactions: they need no extra gateway intents or partials, and the
  button's custom id carries the role so no database table is needed. Roles
  with moderation/management permissions, managed roles, and @everyone are
  refused (`selfRoleProblem`), re-checked on every press in case the role
  changed after the panel was posted.
- [~] **P2 / S — Message edit/delete + join/leave logging channel.**
  *(Partly done 2026-09-24.)* `/config log-channel` receives member
  joins/leaves and every `/mod` action. **Not built: message edit/delete
  logs** — Discord only includes message content for those events with the
  privileged Message Content intent, which would need another Developer
  Portal toggle and an intent request. Worth it only if the guild asks.
- [x] **P2 / S — Custom commands/tags.** *(Done 2026-09-24, as slash
  commands.)* `/tag show|list|set|delete`; officers write, everyone reads.
  Tag text is posted with mentions disabled. A `!prefix` command style would
  need the Message Content intent, so slash commands it is.
- [ ] **P3 / S — Starboard.** Fun/engagement feature, not core to guild
  management. Would need message-reaction intents. Backlog — do last, if at
  all.

### Open questions to resolve before implementation starts

These are product decisions, not technical ones — worth settling with the
guild before picking up Part 2 work:

1. **Replace Carl-bot entirely, or run alongside it?** Changes how much of
   section C is actually worth building. If Carl-bot stays for
   moderation/reaction-roles and Quebec Gold stays guild-management-only,
   most of section C can be dropped or deprioritized.
2. ~~How much automatic addon-comms sync is acceptable?~~ **Resolved
   2026-09-24: as much as possible.** See decision log.
3. **Attunements for which content?** WoW Forever's ruleset determines
   which attunement chains actually matter; the attunement list itself
   needs to come from the guild, not be guessed.

### Decision log

- **SUPERSEDED (2026-09-24): "this client lacks spec and item-level
  APIs."** That claim (below, and in the Phase 10 notes) assumed interface
  11200 meant a vanilla 1.12 client. It doesn't. Per Blizzard's WoW UI
  Discord statement (via [Wowhead](https://www.wowhead.com/news/wow-forever-will-have-addon-changes-from-midnight)),
  WoW Forever "shares Mainline WoW's UI architecture, including the vast
  majority of APIs available in 12.1.5", the Midnight addon disarmament
  (secret values, restrictions on computational addons) is active in
  Forever, and Classic-era addons generally need rebuilding for the new API.
  Consequences for this project: (1) the combat-log registration that caused
  the live popup was never going to work; (2) `GetAverageItemLevel` is now
  tried (guarded) in `/qg inspect`, so readiness reports may carry item
  level after all; (3) spec detection is worth re-checking once someone can
  test whether Forever exposes specialization APIs; (4) new addon features
  should be checked against the 12.x API-change list *before* being built,
  not after. The addon never used Classic-only APIs (it was modern-first
  with guarded legacy fallbacks), so no rewrite is needed. Still to do: set
  `## Interface:` in the `.toc` to Forever's real number. **Done:** it is
  `16001` (from `/dump select(4, GetBuildInfo())` in game); `.toc` and
  `validate-addon.mjs` updated, and the login "out of date" warning is gone.
- **"As much addon sync as possible," resolved 2026-09-24 — implemented
  same day.** User's direction superseded the earlier "event-triggered,
  not continuous" caution — see section A below for what shipped: a
  compact readiness/profession digest now auto-broadcasts to the whole
  online guild (not just the raid group) on login, on every gear change,
  and every 10 minutes while raiding, and every online client accumulates
  everyone else's digests into `db.peerRoster`. This means one officer's
  `/qg export` now carries a live readiness picture for the whole online
  guild, not just themselves — the actual Guild-OS-parity outcome, achieved
  without the chunked-message protocol Guild OS needs, because the digest
  (status/missing-count/durability/professions, no item list) fits in one
  unchunked addon message.
- **Loot council vs. GP auction, resolved 2026-09-24:** GP/EPGP auction
  only — no loot council mode. Removed the loot-council backlog items from
  sections A and B entirely (not deferred, dropped). `/loot auction` stays
  the one and only loot-distribution path.
- **Open question (formerly numbered 3), resolved 2026-09-24:** automate
  self-observation data
  only (gear, professions, attunement completion); keep everything that
  moves currency or an official record (EPGP, attendance's final record,
  loot awards, application decisions) manual, no exceptions. Reasoning: the
  addon's original "hints, not proof" caution exists for *inferring* facts
  about other players from ambient signals (combat log, loot chat), which
  is genuinely unreliable — it doesn't apply to a player's own gear/
  profession self-report, which is the same trust level as the existing
  manual `/qg inspect`, just automated. Scope trims that fell out of this,
  based on what the target client (interface 11200 = vanilla 1.12) can
  actually do: no spec auto-detection (no talent-spec API exists pre-MoP;
  `Character.spec` stays the existing manual free-text field) and no item
  level capture (`GetAverageItemLevel` doesn't exist on this client either
  — the addon already correctly never attempted this). Broadcasts should be
  event-triggered (login, gear change, entering a raid), not a continuous
  timer loop — avoids needing Guild OS's chunked-message engineering for a
  v1.

### Suggested phase order

- [x] **Phase 8:** Section C's two P0 items (welcome/farewell + auto-role/
  application sync) — done 2026-09-24. **Still needs a real Discord Server
  Members Intent toggle + a live join/leave/approve test** before trusting
  it in production; nothing in this session could exercise that.
- [x] **Phase 9:** Section B's P0 item (raid signup caps + auto-lock, plus
  the signup-channel embed) — done 2026-09-24. **Not yet manually tested in
  a real Discord raid signup channel** — verify the embed renders and
  updates correctly, and that role caps behave as expected with real
  concurrent signups, before relying on it for an actual raid.
- [x] **Phase 10:** Section A's two P0 items, full scope — done
  2026-09-24. Attunement tracking, profession auto-sync, and (per "as much
  sync as possible") automatic guild-wide readiness/profession digest
  broadcast + peer-roster accumulation. Also fixed the critical Lua-array
  decoding bug described in Section A. **Not yet manually tested against a
  real WoW client** — the Lua-side logic (event triggers, debounce timing,
  `SendAddonMessage` behavior under real raid load) has not been run in the
  actual game, only reasoned through and, for the companion-watcher half,
  verified against a realistic fixture.
- [~] **Phase 11:** Remaining P1/P2 items. **All bot-side items done
  2026-09-24** while the WoW servers were down (Merit-style score,
  moderation + unified audit log, self-role buttons, log channel, tags,
  wishlist bot-side, recruitment auto-post) — unit-tested but **not yet run
  against live Discord**, so the first real test still needs doing: `/mod`
  against a real member, a `/selfroles` panel press, a `/config recruitment`
  post, and `/tag`. **Still open, all addon-side and deliberately not
  started** (can't be exercised without a live client, and the addon has an
  unresolved live bug): attendance from raid presence, buff/cooldown
  coverage, the in-game half of the wishlist, and the minimap button. No
  loot council work — that's fully out of scope, not just deprioritized.
- [ ] **Backlog:** Starboard; message edit/delete logging (both need extra
  privileged/reaction intents); anything from the Warcraft Logs/dashboard
  discussion (held until it's confirmed WoW Forever logs upload to WCL).
