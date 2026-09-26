# Guilded addon modules

Modules loaded after `Core.lua` (and `Compat.lua`, `Locale.lua`),
sharing its namespace (`local addonName, ns = ...`). Core.lua exposes
`ns.playerName`, `ns.normalizeName`, `ns.isSecret`, `ns.now`,
`ns.message`, `ns.send`, `ns.isOfficer`, `ns.isOfficerName`,
`ns.runCommand`, `ns.getSettings`, `ns.getDb`, `ns.getActiveRaid`,
`ns.groupMembers`, `ns.logDiagnostic`, and a `ns.commandHandlers` table
that modules register into to add `/guilded <action> ...` subcommands. Help
lines go in `ns.commandHelp` (a string, or `{ officer = true, text = ... }`).

## Addon message protocol

Every message is `KIND|field|field|...` on the module's own prefix. Receivers
must **ignore kinds they don't know and fields past the ones they read**, and
new optional fields are only ever **appended**, marked with a tag (like
`F:` in the readiness digest) so an empty field before them can't shift the
rest. That is what lets an older addon run next to a newer one. `/guilded peers`
lists who runs which version. Anything that would break older readers gets a
new `KIND`, never a changed one.

## Rules every module follows

- **Own channel.** Each module has its own addon-message prefix (16
  characters max, checked by `validate-addon.mjs`) and its own event frame,
  with the handler wrapped in `pcall`. One module failing never stops
  another.
- **Only call other modules through `ns`, guarded** (`ns.bidding and
  ns.bidding.current`), so a module that is missing or switched off is just
  skipped.
- **Module switches.** Optional modules are listed in `ns.MODULES` in
  Core.lua with the `/guilded` commands they own. Players switch them with
  `/guilded modules on|off <module>`; officers for the whole guild with
  `/guilded modules guild on|off <module>` (shared by Sync.lua). Saved settings
  only exist from `PLAYER_LOGIN`, so a module always loads and must stay
  dormant while off: its event handler (and any ticker) starts with
  `if ns.moduleActive and not ns.moduleActive("<key>") then return end`.
  Core already blocks the module's commands and help lines, and the window
  hides its tab and widgets (`module =` on a tab, `forModule(...)` on a
  widget). Adding a module = add it to `ns.MODULES`, add the file to the
  TOC and to `addonFiles` in `validate-addon.mjs`, gate its handler.

| Module | Switch | Prefix | What it does |
| --- | --- | --- | --- |
| Games.lua | `games` | (none) | Fun roll games: high roll, deathroll, duel. No gold |
| Bidding.lua | `bidding` | GuildedBid | In-game GP bidding on loot |
| Dungeon.lua | `dungeon` | GuildedDgn | Dungeon run tracking for the Dungeon Challenge |
| Calendar.lua | `calendar` | (none) | `/guilded calendar check` |
| AutoInvite.lua | `autoinvite` | (none) | Officers: `/guilded autoinvite on [phrase]`, guild invite for whoever whispers the phrase (rate limited) |
| SyncNow.lua | `syncnow` | (none) | `/guilded sync`, `/guilded sync auto`: save now / auto-save at safe moments so the companion uploads sooner |
| Backup.lua | `backup` | (none) | `/guilded backup` and `/guilded restore [undo]`: this guild's saved data as one `QGBKP1:` code |
| API.lua | always on | (none) | `GuildedAPI` read-only v1 for other addons and WeakAuras (see the file header) |
| Digest.lua | `digest` | (none) | Login digest: "since your last login" from saved data; `/guilded digest [on/off]` |
| Consumables.lua | `consumables` | (none) | `/guilded consumes`: who in the group lacks a flask/elixir or food; your own buffs go into your readiness snapshot |
| Sim.lua | `sim` | (none) | Test raid / dungeon run for officers |
| Sync.lua | always on | GuildedSync | Version check, standings, guild module switches |
| Minimap.lua | always on | (none) | Minimap button and tools window |

## Games.lua

Fun `/roll` games with no gold, no ledger and nothing owed: `/guilded games highroll|deathroll|duel`. Anyone can run one; the client is the referee, reading the group's rolls and posting short merged lines in party/raid chat. Players join a group game by typing `1`. There is no saved data and no addon-message prefix.

## Bidding.lua

Officer-run GP bidding: `/guilded bid start <min GP> <item> [seconds]` opens it
for the raid (addon users get a popup, pugs whisper a number), highest PR
breaks ties, then the earliest bid. `award` records the loot and GP through
Core's own commands.

## Dungeon.lua

Records 5-player dungeon runs (`DETECTED -> STARTING -> ACTIVE -> COMPLETED /
ABANDONED / INVALID`), one recorder per group, deaths reported by each
player's own addon, saved in `GuildedDB.dungeon.runs` until the bot
confirms them (`GuildedDungeonAccepted` in Standings.lua). Every WoW API
call goes through `Compat.lua`. `/guilded dungeon status|start|complete|abandon|check`.

## Calendar.lua

`/guilded calendar check`: reports whether this client's guild calendar can be
read, which decides whether calendar sync gets built. Read-only.

## Sim.lua

Officer test tools: `/guilded sim start|end|bids|clear` (fake raid) and
`/guilded sim dungeon [minutes]` (fake dungeon run). Everything is marked as
test data and removed by `/guilded sim clear`.

## Sync.lua

Version check (everyone announces their version at login; older clients are
told a newer one exists), guild-wide sharing of the bot's EPGP standings
from `Standings.lua` (accepted only from officers), and the guild module
switches (`MODS` / `MODSREQ`: newest officer setting wins).
`/guilded standings`, `/guilded version`.

## Minimap.lua

Minimap button and the tabbed tools window. Tabs and officer tools are
shown per rank and per module switch (re-checked each time the window
opens and whenever a switch changes). The Tools tab lists every module
with its switches.
