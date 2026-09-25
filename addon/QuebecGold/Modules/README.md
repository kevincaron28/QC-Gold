# Quebec Gold addon modules

Modules loaded after `Core.lua` (and `Compat.lua`, `Locale.lua`),
sharing its namespace (`local addonName, ns = ...`). Core.lua exposes
`ns.playerName`, `ns.normalizeName`, `ns.isSecret`, `ns.now`,
`ns.message`, `ns.send`, `ns.isOfficer`, `ns.isOfficerName`,
`ns.runCommand`, `ns.getSettings`, `ns.getDb`, `ns.getActiveRaid`,
`ns.groupMembers`, `ns.logDiagnostic`, and a `ns.commandHandlers` table
that modules register into to add `/qg <action> ...` subcommands. Help
lines go in `ns.commandHelp` (a string, or `{ officer = true, text = ... }`).

## Addon message protocol

Every message is `KIND|field|field|...` on the module's own prefix. Receivers
must **ignore kinds they don't know and fields past the ones they read**, and
new optional fields are only ever **appended**, marked with a tag (like
`F:` in the readiness digest) so an empty field before them can't shift the
rest. That is what lets an older addon run next to a newer one. `/qg peers`
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
  Core.lua with the `/qg` commands they own. Players switch them with
  `/qg modules on|off <module>`; officers for the whole guild with
  `/qg modules guild on|off <module>` (shared by Sync.lua). Saved settings
  only exist from `PLAYER_LOGIN`, so a module always loads and must stay
  dormant while off: its event handler (and any ticker) starts with
  `if ns.moduleActive and not ns.moduleActive("<key>") then return end`.
  Core already blocks the module's commands and help lines, and the window
  hides its tab and widgets (`module =` on a tab, `forModule(...)` on a
  widget). Adding a module = add it to `ns.MODULES`, add the file to the
  TOC and to `addonFiles` in `validate-addon.mjs`, gate its handler.

| Module | Switch | Prefix | What it does |
| --- | --- | --- | --- |
| Casino.lua | `casino` | QuebecGoldCasino | Officer-hosted /roll games |
| Bidding.lua | `bidding` | QuebecGoldBid | In-game GP bidding on loot |
| Dungeon.lua | `dungeon` | QuebecGoldDgn | Dungeon run tracking for the Dungeon Challenge |
| Calendar.lua | `calendar` | (none) | `/qg calendar check` |
| Backup.lua | `backup` | (none) | `/qg backup` and `/qg restore [undo]`: this guild's saved data as one `QGBKP1:` code |
| API.lua | always on | (none) | `QuebecGoldAPI` read-only v1 for other addons and WeakAuras (see the file header) |
| Digest.lua | `digest` | (none) | Login digest: "since your last login" from saved data; `/qg digest [on/off]` |
| Consumables.lua | `consumables` | (none) | `/qg consumes`: who in the group lacks a flask/elixir or food; your own buffs go into your readiness snapshot |
| Sim.lua | `sim` | (none) | Test raid / dungeon run for officers |
| Sync.lua | always on | QuebecGoldSync | Version check, standings, guild module switches |
| Minimap.lua | always on | (none) | Minimap button and tools window |

## Casino.lua

Officer-hosted `/roll` games (Pot Sweepstakes, Elimination Deathroll,
Difference Roll, and one-on-one Blackjack, Over/Under 50, Roulette against
the officer) plus a gold ledger, under `/qg casino ...`. Only officers can
run it. The officer's client is the table: it posts announcements in
party/raid chat and reads players' chat and `/roll` results, so anyone in
the group can play, including pugs without the addon (type 1 to join,
`/roll`, type stand in blackjack). Wagers accept gold and silver (`10g`,
`50s`, `1g50s`).

Chat volume is kept low: announcements go through a queue that merges lines
arriving together into one message and spaces sends out; joins are never
announced individually; a deathroll elimination and the next roll call
share one line.

Uses its own SavedVariables (`QuebecGoldCasinoDB`) and addon prefix
(`QuebecGoldCasino`), separate from EPGP. No addon can move gold: every
result is a ledger entry (who owes whom). Pot entries are owed to the
hosting officer, who owes the winner; house games are between the player
and the officer. Completed trades with the officer pay those debts down
automatically. Other officers' clients keep a mirrored copy of the ledger;
mirrored entries are only accepted from officers.

Roll messages are matched using the client's own `RANDOM_ROLL_RESULT` text
(parsing lives in Core.lua as `ns.parseRoll`), so French and other language
clients work.

## Bidding.lua

Officer-run GP bidding: `/qg bid start <min GP> <item> [seconds]` opens it
for the raid (addon users get a popup, pugs whisper a number), highest PR
breaks ties, then the earliest bid. `award` records the loot and GP through
Core's own commands.

## Dungeon.lua

Records 5-player dungeon runs (`DETECTED -> STARTING -> ACTIVE -> COMPLETED /
ABANDONED / INVALID`), one recorder per group, deaths reported by each
player's own addon, saved in `QuebecGoldDB.dungeon.runs` until the bot
confirms them (`QuebecGoldDungeonAccepted` in Standings.lua). Every WoW API
call goes through `Compat.lua`. `/qg dungeon status|start|complete|abandon|check`.

## Calendar.lua

`/qg calendar check`: reports whether this client's guild calendar can be
read, which decides whether calendar sync gets built. Read-only.

## Sim.lua

Officer test tools: `/qg sim start|end|bids|clear` (fake raid) and
`/qg sim dungeon [minutes]` (fake dungeon run). Everything is marked as
test data and removed by `/qg sim clear`.

## Sync.lua

Version check (everyone announces their version at login; older clients are
told a newer one exists), guild-wide sharing of the bot's EPGP standings
from `Standings.lua` (accepted only from officers), and the guild module
switches (`MODS` / `MODSREQ`: newest officer setting wins).
`/qg standings`, `/qg version`.

## Minimap.lua

Minimap button and the tabbed tools window. Tabs and officer tools are
shown per rank and per module switch (re-checked each time the window
opens and whenever a switch changes). The Tools tab lists every module
with its switches.
