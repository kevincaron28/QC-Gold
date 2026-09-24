# Quebec Gold WoW addon

This is a self-contained, library-free WoW Classic/Vanilla-style addon for interface
`11200`. It maintains an officer-controlled raid, attendance, boss, EPGP, loot, and
event journal in the `QuebecGoldDB` SavedVariables table.

## Install

Copy the `QuebecGold` directory into the game's `Interface\AddOns` directory:

```text
World of Warcraft\Interface\AddOns\QuebecGold\
```

Enable **Load out of date AddOns** if the client requests it. The addon does not
require the Quebec Gold Discord bot or any external library.

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

`/qg status`, `/qg roster`, and `/qg help` are available to everyone. Change
`QuebecGoldDB.settings.officerRanks` or add names to
`QuebecGoldDB.settings.officers` in the SavedVariables file if your guild uses a
different rank layout. SavedVariables are written on logout/reload.

## Detection and communication

Login and guild roster updates are captured. Loot chat and combat-log events are
stored as **hints** where supported; they are not treated as authoritative boss
kills, attendance, or loot awards. Officers should use the manual commands.

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
about combat log and loot chat. Any other online client with this addon
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

Exports are Lua data, not strict JSON. The `source`, `exportedAt`, `roster`,
`raids`, `attendance`, `bosses`, `epgp`, `readiness`, `attunements`,
`peerRoster`, `loot`, and `events` fields are intended for careful officer
review or conversion by a companion tool. The companion API accepts only a
separate normalized JSON contract with `source`, `exportedAt`, and non-zero
`transactions`; it does not automatically infer transactions from these
SavedVariables.
