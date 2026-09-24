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
/qg end
/qg export
```

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

Exports are Lua data, not strict JSON. The `source`, `exportedAt`, `roster`,
`raids`, `attendance`, `bosses`, `epgp`, `readiness`, `loot`, and `events` fields are intended
for careful officer review or conversion by a companion tool. The companion API
accepts only a separate normalized JSON contract with `source`, `exportedAt`,
and non-zero `transactions`; it does not automatically infer transactions from
these SavedVariables.
