# Quebec Gold Bot

Production-oriented Discord guild management bot for Quebec Gold, a World of Warcraft: Forever guild.

The bot is intentionally split into two boundaries:

- **Quebec Gold** owns guild profiles, raids, signups, applications, permissions, announcements, and audit history.
- **QuebecGold** is the in-game EPGP/readiness authority. The addon exports data through a validated companion import adapter.

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
- `/character add` and `/character list`
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

## Requirements

- Node.js 22+
- npm 10+
- PostgreSQL 16+
- A Discord application with a bot token and `applications.commands` scope

## Setup

```powershell
npm install
Copy-Item .env.example .env
# Set DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID, and DATABASE_URL
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
/raid create title:"Molten Core" time:"2026-10-01T19:00:00Z" bosses:"Lucifron,Magmadar"
/raid signup raid:<raid-id>
/raid roster raid:<raid-id>
/raid attendance raid:<raid-id> player:@Kevin status:PRESENT
/epgp balance
/epgp leaderboard
/epgp award-ep player:@Kevin amount:10 reason:"Raid attendance"
/loot history
/apply character:Kevin class:Priest spec:Shadow experience:"MC and BWL" availability:"Saturday evenings"
/application list status:PENDING
/import file:<addon-export.json>
```

`/config set` requires the `Officer`, `Guild Master`, or Discord Administrator permission.

`/import` validates and records an addon export for officer review; it intentionally does not apply EPGP transactions or readiness snapshots automatically. The addon export format must match the normalized JSON contract in `src/integrations/addon.ts`.

## EPGP and raid readiness

EP is effort points earned from attendance and boss participation. GP is gear points spent on loot. Priority Rating is calculated as `EP / GP`; members with zero GP have a PR of zero until the guild establishes a normalization policy.

The addon can capture observable equipment slots and durability with `/qg inspect`. It cannot reliably determine optimal enchants or every consumable on every WoW Forever client without a guild rule set and client API support. Those checks must be represented as `UNKNOWN` rather than treated as failures. The readiness database accepts configurable findings so class leaders can later define class/spec-specific enchant and consumable rules.

Readiness visibility is restricted to the member’s own report or users with Guild Master, Raid Leader, Loot Leader, or Class Leader roles.

## Companion app

The bot starts a local-only companion API on port `8787`. Set a random token in `.env`:

```env
COMPANION_UPLOAD_TOKEN=use-a-long-random-token-here
```

Then copy `companion/companion.config.example.json` to `companion/companion.config.json`, fill in the values, and run:

```powershell
node companion/watcher.mjs
```

The API binds to `127.0.0.1` only. It records validated imports but does not apply EPGP or readiness data without officer review.

Never commit `.env`; use `.env.example` as the documented configuration surface.

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
