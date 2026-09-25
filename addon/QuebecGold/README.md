# Quebec Gold WoW addon

This is a self-contained, library-free addon for WoW Forever (interface
`16001`, which uses the modern Mainline addon API and its Midnight-era
restrictions). It maintains an officer-controlled raid, attendance, boss, EPGP, loot, and
event journal in the `QuebecGoldDB` SavedVariables table.

## Install

Copy the `QuebecGold` directory into the game's `Interface\AddOns` directory:

```text
World of Warcraft\Interface\AddOns\QuebecGold\
```

Enable **Load out of date AddOns** if the client requests it. The addon does not
require the Quebec Gold Discord bot or any external library.

## Modules: use only what you want

It is one addon (one download, one saved file). The optional parts can be
switched off:

| Module | What it does |
| --- | --- |
| `casino` | Officer-hosted /roll games for gold |
| `bidding` | In-game GP bidding on loot |
| `dungeon` | Dungeon run tracking for the Dungeon Challenge |
| `calendar` | Guild calendar check |
| `sim` | Test raid / dungeon run for officers |

Raids, attendance, EPGP, loot, the gear check, standings and the version
check are the core and always run.

- `/qg modules` lists them and whether each is on.
- `/qg modules off casino` turns one off just for you;
  `/qg modules on casino` turns it back on.
- Officers: `/qg modules guild off casino` turns it off for the whole guild.
  It's shared with everyone online and with members when they next log in;
  a member can't turn a guild-off module back on.
- The **Tools** tab of the window has the same switches.

Turning something off works immediately (its tab, buttons, commands and
chat listening go away). Turning something back on that was off when you
logged in needs a `/reload`.

## Minimap button and tools panel

A gold coin button sits on the minimap edge. Left-click opens the tools
window, right-click checks your gear, drag moves it. Each rank sees only
what it can use: members get Me, Standings, Dungeons, and Tools; officers
also get Raid, EPGP, Loot, Casino, and the officer tools (rank is re-checked
each time the window opens). Tabs for switched-off modules are hidden. A shared **Player** box sits at the top: targeting a
player fills it in, and **Me** / **Group...** (clickable raid/party list, or
online guildmates when solo) fill it on demand. Amounts, wagers, and
attunements have preset buttons; shift-click an item into the EPGP tab's
Item box to award loot. Whole-group actions and ending a raid need a second
click to confirm. Every button runs the same `/qg` command you could type,
so the permission checks are the same. The casino is officer-run from the
Casino tab; players join from chat (see `Modules/README.md`). `/qg menu` opens the window from chat, and
`/qg minimap show|hide|reset` controls the button.

## Standings, version check, and attendance

- **Attendance from raid presence:** while a raid is active, everyone who is
  in the raid group at any point is recorded (`QuebecGoldDB.presence`).
  `/qg attendance seen` (or the Raid tab button) marks them all PRESENT
  without overwriting anything already marked by hand.
- **Standings:** the companion writes `Standings.lua` (the bot's EP/GP per
  linked character) into this folder. After a `/reload` an officer's client
  shares it with the guild over the `QuebecGoldSync` addon channel; members
  only accept standings sent by an officer. `/qg standings [player]`.
- **Version check:** each client announces its version at login, and anyone
  running an older build gets told a newer one exists.

## In-game use

After login, an officer (guild rank 0 or 1 by default) can use:

```text
/qg start Molten Core
/qg attendance Player PRESENT
/qg boss Ragnaros
/qg award Player 10 Raid attendance
/qg gp Player 25 Tier item
/qg deduct Player 5 Mistake
/qg loot Player [Tier Item] 25
/qg inspect
/qg character
/qg share
/qg consumes
/qg consumes me
/qg enchants
/qg snapshot pre-pull
/qg digest
/qg peers
/qg attune Onyxia Key
/qg attune Player "Onyxia Key"
/qg attune Player "Onyxia Key" clear
/qg end
/qg export
```

`/qg attune <key>` records an attunement as complete for your own character.
Officers can record one for someone else with `/qg attune <player> <key>`.
Append `clear`, `false`, or `no` to mark an attunement incomplete instead
(e.g. `/qg attune Onyxia Key clear`). `/qg inspect` also now captures your
known professions and skill levels (via the client's own profession API)
alongside gear - this is self-reported data, the same trust level as the
rest of `/qg inspect`, not something inferred about other players.

`/qg status`, `/qg roster`, `/qg inspect`, `/qg diag`, and `/qg help` are
available to everyone. If your guild's officer ranks are not rank index 0
and 1, the guild master can change it in game: `/qg officer rank 2 on`, or
`/qg officer add <name>` for one person (`/qg officer list` shows the current
setup). SavedVariables are written on logout/reload.

An active raid survives `/reload` and disconnects; `/qg end` closes it.
Player names are normalized ("bob", "Bob-Realm" -> "Bob"), so the same
character never ends up with two ledgers. `/qg inspect` reports READY, PARTIAL
(e.g. no off-hand with a two-hander, or durability under 20%), or NOT_READY,
and names the empty slots it counted.

Every EPGP ledger entry gets a permanent id. Each export carries the whole
ledger, and the bot uses those ids to skip entries it already imported, so
importing every week never double-counts.

## Detection and communication

Login and guild roster updates are captured. Loot chat is stored as a **hint**;
it is not treated as an authoritative loot award. The combat log is not
captured at all: since patch 12.0.0 addons cannot register combat log events,
and WoW Forever inherits that restriction. Boss kills and attendance are
manual, so officers use the manual commands.

When the client provides `RegisterAddonMessagePrefix`, the addon registers
`QuebecGold` and broadcasts manual raid, attendance, boss, EPGP, and loot changes
through `SendAddonMessage` to the raid. Messages are informational; every client
keeps its own SavedVariables.

### Automatic readiness sync

A compact readiness digest (status, missing-gear count, lowest equipped
durability, professions and skill levels - no item names, enchants, or
consumables) is broadcast to the **guild** chat channel automatically:

- On login/zoning in (`PLAYER_ENTERING_WORLD`)
- On any gear change (`UNIT_INVENTORY_CHANGED`)
- Every 10 minutes while in a raid group

This is self-reported data - the same trust level as running `/qg inspect`
yourself, just automatic - not something inferred about other players, so it
doesn't conflict with the "hints, not proof" rule above, which is specifically
about loot chat. Any other online client with this addon
receives these digests and stores them in `QuebecGoldDB.peerRoster`, keyed by
character name. This means **one officer's `/qg export`, run while others are
online, carries a live readiness/profession summary for the whole online
guild** - individual members don't each need to run `/qg inspect` and export
for their data to reach the bot. A full `/qg inspect` (with item names,
enchants, consumables) still only exists in the inspecting player's own
`QuebecGoldDB.readiness` and export, not in peer digests.

Broadcasts use the `GUILD` channel (not `RAID`) so they reach everyone online,
not just your current raid group. `/qg inspect` run manually broadcasts the
same way.

Exports are the SavedVariables file itself. The companion
(`companion/lua-export.mjs` in the bot repository) reads it and sends the
bot a normalized JSON export: EPGP ledger entries (with their permanent ids),
readiness and peer digests, attunements, finished raids with attendance and
presence, loot, and dungeon runs. An officer reviews and applies it with
`/import-apply`; entries already imported are skipped.


## Version 2.0 additions

- **`/qg share`** builds one code (`QGEXP1:...`) with your character, your last gear check, active consumables and attunements, in a box you copy. In Discord, `/character sync code:<paste>` applies it. Nothing to install besides the addon; it only ever describes your own character.
- **Enchant check.** `/qg inspect` reads the enchant id in each equipped item link and warns `Missing enchants: Chest, Legs.` for Chest, Legs, Feet, Wrist, Hands and Main Hand from level 60. `/qg enchants off` or `/qg enchants level 70` changes it for you.
- **Reason flags.** The guild digest now carries `F:NOFLASK,NOFOOD,ENCH:Chest+Legs` so an officer's export shows *why* someone is PARTIAL.
- **Login digest** (`/qg digest`): new members, EPGP changes, finished raids and loot since your last login, from saved data only.
- **`QuebecGoldAPI`** (see `Modules/API.lua`): read-only version 1 for WeakAuras and other addons.
- **Casino:** `/qg casino ban|unban|bans|resetbans` and `/qg casino stats`.
- **Player identity.** `/qg diag` now prints what this client returns for name and realm. WoW Forever has no real realms, so the addon never assumes one.

## Version 2.1 additions

- **One saved-data set per WoW guild.** If a WoW install has characters in two guilds, the addon keeps each guild's ledger, roster, raids and settings apart: the data of the guild you are not playing in is parked and comes back when you play there. The guild is only known a moment after login, so a "Guild changed" line (and a `/reload` suggestion) appears the first time you switch. `/qg diag` shows which guild the data belongs to. The companion skips an upload whose data belongs to another guild if you set `"wowGuild": "Guild Name-Realm"` in `companion.config.json` (the exact text `/qg diag` shows).
- **`/qg backup` and `/qg restore`.** A backup is one copyable code with this guild's saved data; restoring needs two presses (it shows what the backup holds first) and `/qg restore undo` reverses it. Codes are checked (checksum), read by a plain parser that never runs code, and refused if they come from another guild.

## Version 2.2 additions

- **`/qg autoinvite`** (officers): players whisper a phrase (default `ginv`) and get a guild invite. Off by default, rate limited (one invite per name per hour, 15 per hour), never in combat, skips known guild members.
- **TBC Anniversary:** the TOC now lists interface `20506` next to Forever's `16001`, so the same download loads on both. Anniversary-specific behaviour is untested.
