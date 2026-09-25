# Quebec Gold addon modules

Optional modules loaded after `Core.lua`, sharing its namespace
(`local addonName, ns = ...`). Core.lua exposes `ns.playerName`,
`ns.normalizeName`, `ns.isSecret`, `ns.now`, `ns.message`, `ns.send`,
`ns.isOfficer`, `ns.isOfficerName`, `ns.runCommand`, `ns.getSettings`, and a
`ns.commandHandlers` table
that modules register into to add `/qg <action> ...` subcommands.

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

## Sync.lua

Version check (everyone announces their version at login; older clients are
told a newer one exists) and guild-wide sharing of the bot's EPGP standings
from `Standings.lua` (accepted only from officers). `/qg standings`,
`/qg version`.

## Minimap.lua

Minimap button and the tabbed tools window. Tabs and officer tools are
shown per rank (re-checked each time the window opens).
