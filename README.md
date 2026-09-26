# Quebec Gold Bot

Production-oriented Discord guild management bot for Quebec Gold, a World of Warcraft: Forever guild.

The bot is intentionally split into two boundaries:

- **Quebec Gold** owns guild profiles, raids, signups, applications, permissions, announcements, and audit history.
- **QuebecGold** is the in-game EPGP/readiness authority. The addon exports data through a validated companion import adapter.

Every in-game and Discord command, and who can run it, is listed in [COMMANDS.md](COMMANDS.md).

## Development status

Phase 1 provides:

- TypeScript/Discord.js application shell
- PostgreSQL/Prisma data model and migration workflow
- Environment validation
- Discord role-based authorization service
- Append-only EPGP ledger model with EP, GP, PR, decay, and reversal support
- Audit log model and service boundary
- Validated addon import contract
- Health command and command-registration entry points

Phase 2 adds:

- Persistent guild settings for attendance, boss, bid, and auction rules
- Member bootstrap from Discord guild context
- `/profile`
- `/character add`, `/character import` and `/character list`
- `/profession set` and `/profession list`
- `/config view` and officer-only `/config set`
- Explicit command error handling

Phase 3 adds:

- Raid, signup, boss status, and attendance records
- Raid Leader commands for `/raid create`, `edit`, `cancel`, `start`, `end`, and `attendance`
- Member commands for `/raid signup`, `cancel-signup`, `status`, and `roster`
- Attendance records designed to be referenced by a later DKP integration

Phase 4 adds:

- `/loot auction`, `/loot bid`, `/loot close`, and `/loot history` with atomic DKP settlement and loot awards
- `/apply` recruitment submissions and officer-only `/application list`, `view`, `approve`, `reject`, and `trial`

Phase 5 adds:

- Validated `.json` addon upload through `/import`
- SHA-256 duplicate protection for addon exports
- Preview/record-only import behavior so addon data cannot silently change DKP
- Runtime protection against duplicate Discord command registration

Phase 6 adds:

- A purpose-built `addon/QuebecGold` WoW addon baseline
- A local companion upload API at `POST /api/v1/addon-imports`
- A Windows-friendly file watcher under `companion/`
- Bearer-token protection for companion uploads

Phase 7 adds:

- EPGP commands: `/epgp balance`, `history`, `leaderboard`, `award-ep`, and `award-gp`
- GP-based loot settlement while preserving historical DKP records
- Addon gear-slot, durability, and readiness snapshot capture
- Officer readiness commands: `/readiness me`, `member`, and `raid`
- Readiness findings with `READY`, `PARTIAL`, `NOT_READY`, and `UNKNOWN` states
- Addon export support for EPGP and readiness payloads

Phase 8 adds:

- Welcome and farewell messages on member join/leave (`/config welcome`, `/config farewell`), with a templated message supporting `{mention}`, `{username}`, `{guild}`, and `{membercount}`
- Automatic role assignment: an "applicant" role on join, and a "member" role auto-assigned (with the applicant role removed) when an officer runs `/application approve` (`/config roles`)

Phase 9 adds:

- Tank/Healer/DPS role caps on `/raid create` and `/raid edit`; `/raid signup` now requires a role and is rejected once that role's cap is reached
- A live-updating raid signup embed posted to a configured channel (`/config raid-channel`), showing status, start time, and role fill counts — refreshed automatically on create/signup/cancel-signup/start/end/cancel

Phase 10 adds:

- `/attunement set` and `/attunement list` for self-service attunement tracking per character
- The addon's `/qg inspect` now also captures known professions and skill levels; `/qg attune` records attunement completion in-game (self or officer-for-other)
- The addon import pipeline now applies profession and attunement data from an addon export into the same `/profession` and `/attunement` records the Discord commands use — no separate view is needed for addon-synced data
- The addon now auto-broadcasts a compact readiness/profession digest to the whole online guild (login, gear changes, every 10 min while raiding), which every other online client accumulates into its own `peerRoster` table — one officer's `/qg export` can carry a readiness picture for the whole online guild, not just themselves. See `addon/QuebecGold/README.md` for details.
- Fixed a critical bug in `companion/lua-export.mjs`'s Lua decoder that would have broken every real addon import: it read WoW's actual array serialization (`{ [1] = a, [2] = b }`) as an object instead of an array, and empty tables as `{}` instead of `[]`

Not part of the roadmap, but added the same day: the WoW addon was restructured from a single `QuebecGold.lua` file into `Core.lua` + `Modules/`, and a `Modules/Casino.lua` module was added with six `/roll`-driven gambling minigames and their own gold ledger (`/qg casino ...`) — entirely separate from the EPGP/DKP system by design. See `addon/QuebecGold/Modules/README.md`.

Phase 11 adds (bot-side only, no addon changes):

- `/mod warn|timeout|kick|ban|history` (officers): enforces Discord's role hierarchy up front, requires a reason, and writes every action to the same audit log as EPGP/config changes so there's one unified trail
- `/config log-channel`: member join/leave and every moderation action are posted to a log channel (no pings)
- `/selfroles`: officers post a panel of buttons members press to toggle roles. Roles with moderation/management permissions are refused, and re-checked on every press
- `/tag show|list|set|delete`: saved text snippets (raid rules, consumable lists); tag text never pings anyone
- `/wishlist add|remove|list|item`: per-character item wishlists with priority; `/wishlist item` shows who wants something, and `/loot auction` notes how many raiders wishlisted the item
- `/epgp leaderboard` now shows 30-day attendance (Present = 1, Late = 0.5); `/config merit enabled:true` orders it by PR x attendance instead of raw PR (display only, the ledger is never touched)

Dungeon Challenge (addon v1.7.0+, roadmap D1–D10):

- The addon records dungeon runs (state machine, one recorder per group, peer-reported deaths, survives reloads and missing APIs through `Compat.lua`) and exports them with the rest of the SavedVariables
- `/import-apply` validates every run on the server (protocol, 1–5 players, 3 min–4 h, no future timestamps), drops duplicates by run id and by near-duplicate reports, stores it, and gives configurable points with a weekly repeat share; one post per import lists runs, records and achievements
- `/dungeon leaderboard|records|player|history|season` for everyone; `/dungeon-admin invalidate|award|audit|config|target|season-start` for officers, every change an append-only point transaction plus an audit entry
- Permanent achievements (First Blood, No One Dies, Speed Demon, Record Breaker, Guild Squad, Dungeon Master, Season Champion), revoked with the run that earned them if it is invalidated
- In game: a Dungeons tab (live run, recent runs and their sync state, season top 10 from Discord); `/testraid dungeon` and `/qg sim dungeon` for testing, removed by `/testraid cleanup`

Version 2.1 (addon and bot): per-core point rules (guild defaults, per-core overrides, optional separate point pools, per-core loot mode), one saved-data set per WoW guild in the addon, and `/qg backup` / `/qg restore`.

Version 2.0.0 (addon and bot):

- **Addon:** enchant check (which slots lack an enchant; reason flags travel in the guild digest), consumable scan, `/qg share` (one paste to Discord's `/character sync`, no companion needed), login digest, `/qg peers`, attendance snapshots, casino ban list and stats, and a read-only `QuebecGoldAPI` for other addons. The addon's real Lua files now run in the test suite against a mocked game (`tests/lua/`, fengari).
- **Bot:** readiness board sorted most actionable first with an optional attunement target, `/inactive`, `/export` (CSV), `/guildhealth` (composition, retention), `/poll`, loot council mode with `/loot award`, a BENCHED attendance status (attendance EP, full credit), realm-tolerant character matching (Forever has no real realms), one `BRAND` constant for the product name.

Character import and Warcraft Logs (addon v1.8.0):

- `/qg character` in game shows one line (name, realm, class, race, level, spec, professions); `/character import code:<line>` links or refreshes the character from it, no typing. The addon export also carries your own character block, which `/import-apply` uses to keep an already-linked character current
- `/wcl report url:<link> [raid:<id>] [post:false]` (officers) pulls a Warcraft Logs report through the v2 API (zone, duration, bosses killed and wipes, player list; no per-player performance numbers), saves it, posts it to the raid logs channel, and links it to a Discord raid so that raid's report shows the log link. `/wcl list` shows recent ones. Needs `WCL_CLIENT_ID` / `WCL_CLIENT_SECRET` in `.env.local` (create a client at warcraftlogs.com/api/clients); without them `/wcl` explains how to set it up
- `/dungeon group <title>`: a 5-player signup post with Tank/Healer/DPS buttons; when full or started, the bot makes a private temporary voice channel for the group and deletes it when empty. `/core ...`: named raid rosters (several allowed) whose members get priority at signups for raids created with `core:`, shown live in a raid-roster channel. `/qg consumes` (addon v1.9.0) and the readiness board's Consumables section show who lacks a flask or food
- New channel settings (`/setup` or `/config`): `readiness-channel` (private to Guild Master, Officer, Raid Leader, Loot Leader, Class Leader: the raid readiness board, updated after each addon import and on `/readiness raid`), `raid-log-channel`, `loot-channel`, `craft-channel`, `dungeon-leaderboard-channel` (one message the bot edits after every dungeon import), `dungeon-signup-channel`

Addon modules (roadmap M1–M3): the addon stays **one** download. Casino, GP bidding, Dungeons, Calendar and the test tools can be switched off per player (`/qg modules off casino`) or for the whole guild by an officer (`/qg modules guild off casino`, shared in game); raids, EPGP, loot, the gear check and standings always run. See `addon/QuebecGold/README.md`. Splitting it into separate CurseForge addons was considered and rejected: every part depends on the same core and talks to the others, so separate downloads would add version mismatches without giving guilds anything the switches don't.

Deliberately not built: message edit/delete logging (needs the privileged Message Content intent) and a starboard (needs message-reaction intents). Reaction roles were implemented as buttons instead, which need no extra intents. `/mod` needs the bot to have Kick Members, Ban Members, and Moderate Members (the current Administrator invite already covers this).

## Requirements

- Node.js 22+
- npm 10+
- PostgreSQL 16+
- A Discord application with a bot token and `applications.commands` scope
- **Server Members Intent** enabled for the bot application in the [Discord Developer Portal](https://discord.com/developers/applications) (Bot → Privileged Gateway Intents). The bot requests the `GuildMembers` intent for welcome/farewell messages and auto-roles; without this enabled in the portal, `client.login` will fail with "Used disallowed intents".
- The bot's own Discord role must sit above both the applicant and member roles in the server's role list, or role assignment will silently fail (Discord permission rules, not something the bot can override).

## Setup

```powershell
npm install
Copy-Item .env.example .env
# Set DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID, and DATABASE_URL
# (optional: WCL_CLIENT_ID and WCL_CLIENT_SECRET to turn on /wcl)
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run dev
```

After later schema changes, create a named migration with:

```powershell
npm run prisma:migrate -- --name phase-2-guild-members
```

For the current complete schema, use:

```powershell
npm run prisma:migrate -- --name complete-guild-management
```

For local PostgreSQL:

```powershell
docker compose up -d postgres
```

Commands are registered against `DISCORD_GUILD_ID` in development. A production deployment should use the global registration path once command definitions stabilize.

### First run in Discord: `/setup`

Once the bot is online, a server admin runs **`/setup`**. It's a private,
click-through guide (buttons and menus, no typing) in seven steps: permission
roles (can create them and give you Guild Master), channels (announcements,
raid signups, raid logs, and a private officer log), raid team channels
(raid roster, private raid readiness, loot log, craft board), dungeon and
dungeon channels (leaderboard, signups, runs), an optional
welcome message, optional auto-roles, and EPGP values / raid reminders /
weekly report. "Create the whole WoW section" makes every missing channel
at once, sorted into categories (Guild, Raiding, Dungeons, Crafting,
Officers) with the right permissions: feeds and signup channels are
read-only for members (signups use buttons), the officer log and readiness
channels are hidden from everyone but leadership. "Tidy my channels into
categories" on the last screen moves and re-permissions channels the bot
made earlier (only ones still using its standard names). It ends with a checklist that says exactly how to fix anything still
missing, and can post a pinned-ready "getting started" guide for members.
Re-running it is safe; `/setup status:true` shows only the checklist.

When the bot starts, its console window also prints whether setup is
finished for each server, and when it's added to a new server it posts a
note in the system channel asking an admin to run `/setup`.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Run the bot with tsx |
| `npm run build` | Type-check and compile |
| `npm test` | Run unit tests |
| `npm run lint` | Run ESLint |
| `npm run prisma:generate` | Generate the Prisma client |
| `npm run prisma:migrate -- --name <name>` | Create/apply a migration |

## Phase 2 command examples

```text
/profile
/character add name:Kevin realm:WoW-Forever class:Priest spec:Shadow main:true
/character list
/profession set character:Kevin profession:Alchemy skill:300
/profession list
/config view
/config set setting:attendanceDkp value:10
/raid create title:"Molten Core" time:"2026-10-01T19:00:00Z" bosses:"Lucifron,Magmadar" tanks:2 healers:6 dps:32
/raid signup raid:<raid-id> role:DPS
/raid roster raid:<raid-id>
/raid attendance raid:<raid-id> player:@Kevin status:PRESENT
/raid boss raid:<raid-id> name:"Lucifron" status:KILLED
/config raid-channel channel:#raid-signups
/attunement set character:Kevin name:"Onyxia Key" completed:true
/attunement list character:Kevin
/epgp balance
/epgp leaderboard
/epgp award-ep player:@Kevin amount:10 reason:"Raid attendance"
/epgp decay
/config set setting:"EPGP decay percent (0-100)" value:10
/config welcome channel:#welcome message:"Welcome {mention} to {guild}! Run /apply to get started."
/config farewell channel:#member-log
/config roles applicant:@Applicant member:@Member
/config log-channel channel:#mod-log
/config merit enabled:true
/mod timeout player:@Someone duration:30m reason:"Spamming"
/mod history player:@Someone
/selfroles title:"Pick your roles" role1:@Tank role2:@Healer role3:@DPS
/tag set name:consumables content:"Flask, food buff, and potions for every boss."
/tag show name:consumables
/wishlist add character:Kevin item:"Thunderfury, Blessed Blade of the Windseeker" priority:1
/wishlist item item:"Thunderfury, Blessed Blade of the Windseeker"
/loot history
/apply character:Kevin class:Priest spec:Shadow experience:"MC and BWL" availability:"Saturday evenings"
/application list status:PENDING
/import file:<addon-export.json>
```

`/config set` requires the `Officer`, `Guild Master`, or Discord Administrator permission. Guild Master and Officer roles inherit every specialized role's permissions (Raid Leader, DKP Officer, Loot Leader, Class Leader), so a Guild Master never needs to also hold those specific Discord roles.

`/import` validates and records an addon export for officer review; it intentionally does not apply anything automatically. A separate officer-only `/import-apply <id>` records the DKP transactions, EPGP transactions, and readiness snapshots in the reviewed export — nothing is applied until that command runs. The addon export format must match the normalized JSON contract in `src/integrations/addon.ts`.

## EPGP and raid readiness

EP is effort points earned from attendance and boss participation. GP is gear points spent on loot. Priority Rating is calculated as `EP / GP`; members with zero GP have a PR of zero until the guild establishes a normalization policy.

The addon can capture observable equipment slots and durability with `/qg inspect`. It cannot reliably determine optimal enchants or every consumable on every WoW Forever client without a guild rule set and client API support. Those checks must be represented as `UNKNOWN` rather than treated as failures. The readiness database accepts configurable findings so class leaders can later define class/spec-specific enchant and consumable rules.

Readiness visibility is restricted to the member’s own report or users with Guild Master, Raid Leader, Loot Leader, or Class Leader roles.

## Companion app

The bot starts a local-only companion API on port `8787`.

**Easiest setup:** double-click `start-companion.bat`. The first time, it runs
`npm run companion:setup`, which finds your WoW folder, account, and realm,
creates the upload token, and writes it to both `.env.local` and
`companion/companion.config.json` (restart the bot afterwards so it picks up
a new token). After that the same shortcut just starts the watcher, and
restarts it if it stops.

Manual setup, if you prefer: put `COMPANION_UPLOAD_TOKEN=<long random token>`
in `.env.local`, copy `companion/companion.config.example.json` to
`companion/companion.config.json` with the same token, and run
`npm run companion:watch`.

The bot's own shortcut (`start-bot.bat`) first runs `npm run db:update`
(applies any missing database migrations and regenerates the Prisma client;
it refuses to start the bot if that fails), opens the companion in its own
window, then restarts the bot automatically if it crashes, and the bot saves a daily database backup to `backups/`
(last 14 days kept).

The API binds to `127.0.0.1` only. It records validated imports but does not apply DKP, EPGP, or readiness data without officer review via `/import-apply`. If `COMPANION_UPLOAD_TOKEN` is not set, the companion API rejects every request rather than allowing them through — always set a real token before running the watcher.

Never commit `.env`, `.env.local`, or `companion/companion.config.json`; use `.env.example` as the documented configuration surface. All three are already gitignored.

## Local hosting with Neon

The bot can run entirely on your Windows PC while Neon hosts PostgreSQL. No local
PostgreSQL installation is required.

1. Keep the Neon-generated `.env.local` in the project root. The application loads
   `.env.local` automatically and uses its `DATABASE_URL` connection.
2. Add `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, and `DISCORD_GUILD_ID` to `.env.local`.
3. Set a random `COMPANION_UPLOAD_TOKEN` with at least 32 characters.
4. Install dependencies and generate the client:

```powershell
npm.cmd install
npm.cmd run prisma:generate
```

5. Start the bot and local companion API:

```powershell
npm.cmd run start:local
```

6. In a second PowerShell window, copy the companion example and fill in the
   SavedVariables path, guild ID, and the same upload token:

```powershell
Copy-Item companion\companion.config.example.json companion\companion.config.json
npm.cmd run companion:watch
```

The local API listens only on `127.0.0.1:8787`, so it is not exposed to the
internet and does not require port forwarding. Keep the PC awake while the bot
is needed. The Neon database remains online even when the bot is stopped.

## Releasing the addon to guild members

(A public CurseForge listing is planned as roadmap item M3: one project, packaged from `addon/QuebecGold/` without `validate-addon.mjs`. Until then, releases go through GitHub as below.)

Guild members install the WoW addon from a zip attached to a
[GitHub release](https://github.com/kevincaron28/QC-Gold/releases), linked
from a shareable install/update page (published as a Claude artifact —
check your artifacts gallery for "Quebec Gold Add-on", or ask to have it
republished). The release and the page are **not** updated automatically by
committing or pushing — do this by hand.

**End-of-session checklist, whenever a session touched anything under
`addon/QuebecGold/`:**

1. Bump `## Version:` in `addon/QuebecGold/QuebecGold.toc` if this is a
   version worth shipping to guildies (not every internal commit needs a
   new release).
2. Run `npm run addon:zip` — builds `dist/QuebecGold-v<version>.zip` from
   the current addon source (already excludes the dev-only
   `validate-addon.mjs`; regenerates the version number from the `.toc`
   automatically, so it can't drift out of sync).
3. Commit and push as usual.
4. Publish a new [GitHub release](https://github.com/kevincaron28/QC-Gold/releases/new)
   tagged `v<version>` with `dist/QuebecGold-v<version>.zip` attached.
5. Update the install page artifact: new version number, new download URL
   (`https://github.com/kevincaron28/QC-Gold/releases/download/v<version>/QuebecGold-v<version>.zip`),
   republish to the same artifact URL so guildies' existing link keeps
   working.

`dist/` is gitignored — the zip itself never goes into the repo, only the
release asset.

## When the game's realm name changes (beta to release)

The addon keys its saved data by guild name plus realm. If only the realm text changes (for example "Classic Beta PvP" becomes something else), the addon **keeps your data** and just renames the key (it says so in chat). The bot matches characters by name, so a different realm spelling still matches when the name is unique. The only place to update by hand is `companion/companion.config.json`: change `"realm"` (and `"wowGuild"` if you set it) to the new realm text shown by `/qg diag`.

## Running the bot in the cloud

See `docs/DEPLOY_ORACLE.md` (Oracle Cloud Always Free, with a systemd unit, Caddy HTTPS and a setup script in `deploy/`). The companion stays on an officer's PC (`scripts/install-companion-autostart.bat` starts it with Windows) and uploads to the cloud bot.
