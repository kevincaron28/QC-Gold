# Quebec Gold — Roadmap

Living roadmap for the Quebec Gold Discord bot + WoW addon. Update this file
as work happens so a fresh session (or a future you) can resume from it
alone. Two parts: **Part 1** is the correctness audit that's now done, kept
as a historical record. **Part 2** is the forward-looking feature roadmap
toward a full Guild-OS-style manager with Discord housekeeping built in.

Legend: `[ ]` not started · `[~]` in progress · `[x]` done · **P0/P1/P2** =
priority (P0 = do first) · **S/M/L** = rough size

---

## ⏸ Paused here — resume next session (2026-09-24)

Live-testing the bot + addon for the first time today. Session paused
mid-troubleshoot to be picked up again later. **Read this before doing
anything else:**

- **Bot is confirmed working**: online in Discord, `/health` replies,
  Server Members Intent enabled, companion API running. Nothing to redo
  here.
- **Addon is confirmed loading** (`[QuebecGold] Loaded.` on login, `/qg
  help` works), but has an **unresolved live bug**: a "QuebecGold has been
  blocked from an action only available to the Blizzard UI" popup occurs,
  cause not yet identified.
  - First fix attempt: removed the `OnUpdate`-based auto-sync ticker
    (suspected taint source), moved the same logic into real event
    handlers. **Did not resolve it** — popup still occurs.
  - Built diagnostics into the addon itself to pin this down precisely:
    hooks `ADDON_ACTION_BLOCKED`/`ADDON_ACTION_FORBIDDEN` (fire with the
    exact addon + function name WoW blocked) and the global Lua error
    handler, logged to `/qg diag`. **First version of this caught nothing**
    on a confirmed reproduction — widened it (unfiltered Lua error capture,
    added a `UI_ERROR_MESSAGE` fallback listener) since the narrow version
    may have missed the actual signal.
  - **Not yet confirmed**: whether the widened diagnostics build (latest
    `Core.lua`, zip rebuilt via `npm run addon:zip` but not yet re-uploaded
    to the GitHub release) catches anything on the next reproduction.
  - **Still needed regardless of `/qg diag` results**: the exact moment the
    popup occurs (login? moving? a specific command?) — not pinned down
    yet, would narrow this dramatically.
  - **Fallback if `/qg diag` stays empty again**: WoW's own
    `/console scriptErrors 1` shows a full Lua stack-trace popup for any
    script error, independent of whatever this addon's own hooks catch —
    reach for this next if the custom diagnostics don't produce a lead.
- **Live test script is otherwise un-started past this point** — see
  `LUNCH_TEST_CHECKLIST.md` for the exact checklist and current checkbox
  state (raid signups, housekeeping, casino are all still untested).
- **Not committed**: the widened-diagnostics change to `Core.lua` and the
  rebuilt `dist/QuebecGold-v1.1.0.zip` are sitting uncommitted locally.
  Nobody has asked for a commit since the last one (`576eff4`).
- **Added while the WoW servers were down (2026-09-24):** all the bot-side
  roadmap items — see Phase 11 in the phase list below. New migration
  `20260924211657_bot_tools_tags_wishlist_moderation_merit_recruitment`
  already applied to the live Neon database (additive only). 58 tests,
  `tsc` and `eslint` clean. None of it has run against live Discord yet.

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
- [ ] **P1 / M — Attendance from actual raid presence, not just manual
  marking.** Hook `GROUP_ROSTER_UPDATE` while a raid is active in the addon
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
- [ ] **P2 / M — Minimap button with a quick-access menu.** Requested
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
