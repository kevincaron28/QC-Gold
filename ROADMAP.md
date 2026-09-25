# Quebec Gold — Roadmap

Living roadmap for the Quebec Gold Discord bot + WoW addon. Update this file
as work happens so a fresh session (or a future you) can resume from it
alone. Two parts: **Part 1** is the correctness audit that's now done, kept
as a historical record. **Part 2** is the forward-looking feature roadmap
toward a full Guild-OS-style manager with Discord housekeeping built in.

Legend: `[ ]` not started · `[~]` in progress · `[x]` done · **P0/P1/P2** =
priority (P0 = do first) · **S/M/L** = rough size

---

## ⏸ Where we are — resume here (updated 2026-09-24, evening)

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

> **Resume here (2026-09-25, committed):** everything in P0, P1 #13-16,
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
D6. [ ] **S — Announcements**: completed runs, new personal and guild
    records in a dungeon channel (/setup + `/config`).
D7. [ ] **M — Admin + audit**: `/dungeon invalidate`, `award`, `remove`,
    `force-complete`, `audit`, `config`, `season start|end`, all logged.
D8. [ ] **M — Achievements**: First Blood, No One Dies, Speed Demon
    (target time), Record Breaker, Dungeon Master (all dungeons), Guild
    Squad, Season Champion — rules in config, permanent.
D9. [ ] **S — In-game view**: a Dungeons tab (current run, timer,
    Start / Complete / Abandon buttons, recent runs, your points).
D10. [ ] **S — Test path**: `/qg sim dungeon` and `/testraid`-style bot
    fixtures that play a full run (including reload, duplicate
    submission, disconnect) so this can be tested before release.

**P1 — second wave**

12. [ ] **M — Warcraft Logs, manual import first**: `/wcl <report url>`
    pulls the report through WCL API v2 (GraphQL, client-credentials
    auth, keys only in the bot's `.env`, never in the addon), stores a
    compact summary (zone, duration, bosses killed/wipes, deaths, player
    list) linked to the raid, posts a raid report embed, and links to WCL
    for detail. **Blocked on:** WCL API client id/secret from the user, and
    confirming WoW Forever logs upload to WCL at all. No DPS leaderboard /
    "raid score" by design.
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

---

## Status snapshot (2026-09-24)

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
