# Quebec Gold addon modules

Optional modules loaded after `Core.lua`, sharing its namespace
(`local addonName, ns = ...`). Core.lua exposes `ns.playerName`, `ns.now`,
`ns.message`, `ns.send`, `ns.isOfficer`, and a `ns.commandHandlers` table
that modules register into to add `/qg <action> ...` subcommands.

## Casino.lua

Six `/roll`-driven gambling minigames (Difference Roll, Pot Sweepstakes,
Elimination Deathroll, Blackjack, Over/Under 50, Goblin Roulette) plus a
persistent gold ledger, under `/qg casino ...`. Uses its own SavedVariables
table (`QuebecGoldCasinoDB`) and its own addon message prefix
(`QuebecGoldCasino`), separate from the guild-management data in
`QuebecGoldDB` - this is a purely recreational, peer-to-peer/house-banked
gold side-game, deliberately kept out of the EPGP/DKP ledger entirely.

**Important limits, not bugs:** no WoW addon can transfer gold between
players. Every result here is a ledger entry (`/qg casino ledger`) -
someone still has to pay by trade. Group games (Difference Roll, Pot
Sweepstakes, Elimination Deathroll) need a host who is grouped with every
participant, because `/roll` results are only visible within party/raid or
local range; only the host's client adjudicates those. Solo games
(Blackjack, Over/Under 50, Goblin Roulette) need no host - each player's
own client resolves their own bet.

See the commands in-game with `/qg casino` (no arguments) for full usage.
