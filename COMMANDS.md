# Quebec Gold command reference

Quick lookup for the in-game addon (`/qg ...`) and the Discord bot (`/...`).
**Who** means who is allowed to run it: *Everyone*, *Officer* (in game: guild
rank 0/1 unless changed with `/qg officer`; on Discord: the Officer or Guild
Master role, or Administrator), or the specific Discord role named.

## In game: `/qg`

**Easiest way: click the gold coin on the minimap** (or type `/qg menu`).
Each rank only sees what it can use: members get **Me, Standings, Tools**;
officers also get **Raid, EPGP, Loot, Casino** and the officer tools. A **Player**
box sits at the top. Target someone and their name fills in automatically, or use
**Me** or **Group...** (a clickable list of your raid/party). Buttons that
affect everyone (whole-group EP, end raid) need a second click to confirm.
Right-click the coin to check your gear. Everything below also works as a
typed command. Names are case-insensitive (`bob` = `Bob`).

### Everyone

| Command | What it does |
| --- | --- |
| `/qg help` | List commands |
| `/qg inspect` | Check your gear, durability, professions, and item level. Shows READY / PARTIAL / NOT_READY and names empty slots. Also shares a summary with the guild |
| `/qg status` | Show the active raid, if any |
| `/qg roster` | List characters the addon knows about |
| `/qg attune <key>` | Mark your own attunement done, e.g. `/qg attune Onyxia Key` |
| `/qg attune <key> clear` | Mark it not done |
| `/qg diag` | Show recent addon errors / blocked actions (send this when reporting a bug) |
| `/qg menu` | Open the tools window |
| `/qg calendar check` | Checks whether the in-game guild calendar can be synced (send the result to an officer) |
| `/qg lang en` / `fr` / `auto` | Language of your window and bid popup (auto = same as your game client) |
| `/qg standings [player]` | EPGP standings from Discord (top 10, or one player) |
| `/qg dungeon status` | The dungeon run being recorded: state, timer, bosses, deaths |
| `/qg dungeon start` / `complete` / `abandon` | Fix a run by hand when detection missed it (group leader, officer, or solo) |
| `/qg dungeon check` | Checks which dungeon features work on this client (send the result to an officer) |
| `/qg version` | Your addon version. You're also told automatically when a guildmate has a newer one |
| `/qg minimap show` / `hide` / `reset` | Control the minimap button |
| `/qg officer list` | Show which ranks count as officers, and whether you do |

### Officers: raid and EPGP

| Command | What it does |
| --- | --- |
| `/qg start <title>` | Start a raid, e.g. `/qg start Molten Core` (survives /reload) |
| `/qg attendance <player> [PRESENT\|LATE\|ABSENT]` | Record attendance (default PRESENT) |
| `/qg attendance seen` | Mark PRESENT everyone who was in the raid group at any point since `/qg start` (tracked automatically; keeps anything already marked) |
| `/qg attendance group [status]` | Mark everyone in the group right now |
| `/qg boss <name>` | Record a boss kill |
| `/qg award <player> <amount> [reason]` | Give EP |
| `/qg award group <amount> [reason]` | Give EP to everyone in the group |
| `/qg gp <player> <amount> [reason]` | Charge GP for an item |
| `/qg deduct <player> <amount> [reason]` | Remove EP |
| `/qg loot <player> <item> [cost]` | Record who got an item (shift-click links work) |
| `/qg attune <player> <key> [clear]` | Set someone else's attunement, e.g. `/qg attune Bob "Onyxia Key"` |
| `/qg end` | End the raid |
| `/qg export` | Mark a sync point, then `/reload` so the game saves, then run the companion |

### Officers: GP bidding (Loot tab)

Shift-click the item into the Loot tab, set the minimum GP and time, press
**Open bidding**. Raiders with the addon get a popup (with their PR) and bid
from it; anyone else whispers you a number, like `25`. Bids are sealed. At
the end the highest bid wins (tie: higher PR, then first to bid). Press
**Award winner** to record the loot and GP. Chat gets one line to open and
one for the winner.

| Command | What it does |
| --- | --- |
| `/qg bid start <min GP> <item> [seconds]` | Open bidding (default 30 s) |
| `/qg bid close` | Stop early and show the leader |
| `/qg bid award` | Give it to the winner at their bid (records loot + GP) |
| `/qg bid cancel` | Cancel, nothing recorded |
| `/qg bid status` | Current bids |

### Officers: test raid (no raids are out yet)

| Command | What it does |
| --- | --- |
| `/qg sim start` | Start a `[TEST]` raid with fake raiders (Testalpha, Testbravo, ...) in the group |
| `/qg sim bids` | Fake raiders bid on the open item |
| `/qg sim end` | Kill 3 test bosses, mark attendance, give a test item, end it |
| `/qg sim clear` | Remove every test raid and the EP/GP it recorded |

### Guild master only

| Command | What it does |
| --- | --- |
| `/qg officer rank <index> on\|off` | Make a guild rank count as officer (0 = GM, 1 = next rank...) |
| `/qg officer add\|remove <name>` | Make one person an addon officer |

### Casino (officers run it; anyone in the group can play)

Officers host from the **Casino** tab (or `/qg casino`). Players, including
pugs without the addon, just use chat: type **1** in party/raid chat to join
a group game, **/roll** when told, and **stand** in blackjack. You must be in
a party or raid with them. Wagers take gold and silver: `10g`, `50s`,
`1g50s` (a plain number means gold). The addon keeps a ledger of who owes
whom; gold moves by trade, and **trading with the officer pays debts down
automatically**.

Chat stays quiet: one line to open a game, one to call the roll, one result
(deathroll: one line per round, blackjack: one per card). Joins are not
announced, and lines that land together are merged into one message.

| Command (officers) | What it does |
| --- | --- |
| `/qg casino pot <wager>` | Pot Sweepstakes: everyone pays the entry to you, highest roll wins the pot (5% guild cut) |
| `/qg casino deathroll <wager>` | Elimination Deathroll: lowest roll each round is out; every loser pays the survivor |
| `/qg casino diff <wager>` | Difference Roll: wager is the roll ceiling (`100g` = /roll 100 in gold, `50s` = /roll 50 in silver); lowest pays highest the difference |
| `/qg casino roll` | Close joining and call the roll |
| `/qg casino remind` | Re-post who still needs to roll |
| `/qg casino add <player>` / `remove <player>` | Add or remove someone yourself |
| `/qg casino cancel` | Cancel the group game, no payouts |
| `/qg casino blackjack <player> <wager>` | Blackjack vs you. They `/roll 13` per card and type `stand` |
| `/qg casino overunder <player> <over\|under> <wager>` | They `/roll 100`. Exactly 50 = house wins |
| `/qg casino roulette <player> <red\|black\|even\|odd\|1-36> <wager>` | They `/roll 38` (37 = 0, 38 = 00). A number pays 35 to 1 |
| `/qg casino stand <player>` / `cancel <player>` | Stand for them / cancel their game |
| `/qg casino status` | What's running and who you're waiting on |
| `/qg casino ledger [player]` | Who owes you, who you owe, the house result |
| `/qg casino debt clear <player> [owed-to]` | Mark a debt paid by hand |

Casino games can't be started while you're in combat.

## Discord bot

Tips: wherever a command asks for a raid, auction, request, or entry, **start
typing its name and pick it from the list** (no IDs to copy). Raid signup
posts have buttons, so members rarely need `/raid signup`. Member-facing
messages follow the language chosen in `/setup` (English or French).

### Everyone on Discord

| Command | What it does |
| --- | --- |
| `/help` | The commands you can use (shows more for officers and leaders) |
| `/health` | Is the bot online? |
| `/profile` | Your profile: characters (race, class, professions, last seen), EP/GP/PR |
| `/who <character>` | Look anyone up: main and alts, professions, EP/GP/PR, 30-day attendance, last seen |
| `/character add <name> <realm> <class> <main> [spec] [level] [race]` / `/character list` | Link your WoW characters (needed before imports can match you) |
| `/apply` | Submit a guild application |
| `/raid signup <raid> <role> [availability]` | Sign up (Tank, Healer, DPS). `availability:Maybe` doesn't take a slot. If your role is full you go on the **waitlist** and get a DM when a slot opens |
| `/raid cancel-signup <raid>` | Drop out (the next waitlisted player moves up) |
| `/raid status <raid>` / `/raid roster <raid>` | Raid info and roster |
| `/raid progress` | Guild boss progression: first kill, number of kills, latest kill |
| `/epgp balance` / `history` / `leaderboard` | Your EP, GP, PR, and the leaderboard |
| `/dkp balance` / `history` / `leaderboard` | Legacy DKP |
| `/loot bid <auction> <amount>` | Bid GP on an auction |
| `/loot history` | Awarded loot: item, boss/raid, winner, GP, GP before → after, who awarded it, date |
| `/readiness me` | Your latest gear check from the addon |
| `/attunement set` / `list` | Your characters' attunements |
| `/profession set` / `list` | Your characters' professions |
| `/profession who <profession>` | Everyone with that profession, highest skill first (partial names work: `alch`) |
| `/profession coverage` | How many have each profession, and who's highest |
| `/wishlist add` / `remove` / `list` / `item` | Your wanted items; `item` shows who wants something |
| `/tag show <name>` / `/tag list` | Post a saved answer |
| `/raid report <raid>` | Post a raid summary: duration, raiders, bosses, EP awarded, loot and GP spent |
| `/stats [days]` | Guild activity (default last 7 days): raids, boss kills, EP, loot, new members, applications, most raids attended |
| `/bank request <item> [quantity] [note]` | Ask the guild bank for something; you get a DM when it's handled |
| `/bank mine` / `/bank cancel <id>` | Your requests / cancel an open one |
| `/craft request <item> [profession] [quantity] [materials] [note]` | Ask a guild crafter to make something; shows who has that profession |
| `/craft list [profession]` / `/craft claim <id>` | Crafters: see open requests and take one |
| `/craft done <id>` / `release <id>` / `mine` / `cancel <id>` | Finish, give back, see yours, or cancel. The requester gets DMs |

### Dungeon challenge

Run a dungeon with the addon installed (one person in the group is enough;
more is better for death tracking). It is recorded automatically: the timer
starts on the first pull and stops on the last boss. An officer imports it
like everything else (`/import-apply`) and points are given out:
completion 50, no deaths 25 (1 death 15, 2 deaths 5), first clear of that
dungeon 25, personal record 15, guild record 25, full guild group 20.
The same dungeon more than once a week is worth 50%, then 0% (resets
Tuesday). Runs under 3 minutes, over 4 hours, or with more than 5 players
are not counted.

| Command | What it does |
| --- | --- |
| `/dungeon leaderboard [period] [dungeon]` | Most points this week, this season (default) or all time; optionally one dungeon |
| `/dungeon records [dungeon]` | Fastest clear of every dungeon, or the top 5 times of one |
| `/dungeon player [member | character]` | Points, runs, best times and recent runs (default: you) |
| `/dungeon history [member]` | Last 10 runs, including ones that did not count and why |
| `/dungeon season` | Current season and its top 5 |

### Raid Leaders (and Officers)

| Command | What it does |
| --- | --- |
| `/raid create <title> <time> [description] [bosses] [tanks] [healers] [dps]` | Create a raid. Time like `friday 8pm`, `tonight 20:00`, `vendredi 20h`, `2026-10-03 20:00` (your server's timezone). Posts the signup message with Tank / Healer / DPS / Maybe / Can't come buttons |
| `/raid edit` / `cancel` / `start` | Manage the raid (raising a cap moves waitlisted players in) |
| `/raid end <raid>` | End the raid and see the **proposed EP** with Approve / Cancel buttons |
| `/raid award-ep <raid>` | Show the proposed EP again (e.g. after `/import-apply` added attendance) |
| `/raid boss <raid> <name> <Killed\|Pending>` | Boss status |
| `/raid attendance <raid> <player> <status> [notes]` | Record attendance |
| `/raid note <raid> <text> [boss]` | Officer note (general, per boss, what to improve); shown in `/raid status` to raid leaders |
| `/readiness member <player>` / `/readiness raid` | Check other people's readiness (also Guild Master, Loot Leader, Class Leader) |

Proposed EP = attendance EP (present or late) + boss kills × boss EP + a
full-clear bonus, all from `/config set`. Only EPGP officers can press
Approve, and a raid can never be paid twice.

### DKP Officers (and Officers)

| Command | What it does |
| --- | --- |
| `/epgp award-ep <player> <amount> <reason>` | Give EP |
| `/epgp award-gp <player> <amount> <reason>` | Charge GP |
| `/epgp history player:<member>` | Anyone's history, with entry IDs |
| `/epgp reverse <entry> <reason>` | Undo a mistaken entry (adds the opposite entry; both stay in history) |
| `/epgp decay` | Apply the weekly EPGP decay |
| `/dkp add` / `/dkp remove` | Legacy DKP |

### Officers

| Command | What it does |
| --- | --- |
| `/setup` | **Start here.** Guided setup: roles, channels, welcome, EPGP values. `/setup status:true` shows the checklist |
| `/testraid start [raiders] [starts_in] [realm]` | Fake `[TEST]` raid with fake raiders signed up (hits role caps, Maybe, waitlist) |
| `/testraid finish <raid> [via_addon]` | Play it: attendance (late, no-show, walk-in), boss kills, loot, end, EP proposal. `via_addon` sends attendance through `/import-apply` instead |
| `/testraid cleanup` | Delete every test raid and fake raider with their EPGP and loot. Real data is untouched |
| `/loot auction <item> <minimum> <increment> <duration> [boss] [raid]` / `/loot close <auction>` | Run a GP auction (boss/raid show up in loot history) |
| `/import <file>` then `/import-apply <id>` | Preview then apply an addon export. Entries already imported are skipped; in-game raids fill Discord attendance and list no-shows and walk-ins |
| `/application list` / `view` / `approve` / `reject` / `trial` | Handle applications |
| `/mod warn` / `timeout` / `kick` / `ban` / `history` | Moderation (logged) |
| `/tag set` / `/tag delete` | Manage saved answers |
| `/selfroles <title> <role1> [role2..5]` | Post a role button panel |
| `/config view` | Show settings |
| `/config set <setting> <value>` | Attendance / late / boss-kill EP, auction defaults, decay %, **base GP**, raid reminder minutes, full-clear bonus |
| `/config notify-channel` | Where raid started/ended, boss kills, loot awards, EPGP changes, and raid reports are announced |
| `/config weekly-report <true\|false>` | Post `/stats` for the week in the notify channel every 7 days |
| `/bank list [status]` / `/bank handle <id> <Approve\|Fulfilled\|Deny> [reply]` | Guild bank queue (new requests also appear in the log channel) |
| `/config welcome [channel] [message] [send_to] [role_prompt] [preview]` | Welcome message: in a channel, by DM, or both; role buttons are picked in `/setup` step 3. `preview:true` sends it to you |
| `/config farewell` | Leave message |
| `/config timezone <zone>` | Timezone for typed raid times (also in `/setup`) |
| `/config roles` | Auto-assigned applicant/member roles |
| `/config raid-channel` | Where raid signup embeds and raid reminders go |
| `/config log-channel` | Where join/leave/moderation logs go |
| `/config merit <true\|false>` | Rank the leaderboard by PR x attendance |
| `/config recruitment` | Recurring recruitment post |

**Base GP:** PR = EP / (GP + base GP). With base GP 100, someone with 50 EP
and 0 GP has PR 0.5 instead of an undefined or huge number. The addon uses
the same formula.

**Raid reminders:** signed-up players are pinged in the raid's signup
channel once, `raidReminderMinutes` before start (default 60, 0 = off).

## Getting addon data into Discord

1. In game (officer): `/qg export`, then `/reload`.
2. Keep the companion running on your PC (`npm run companion:watch`). When the game
   saves, it uploads automatically and prints the `/import-apply` line to use.
3. On Discord: `/import-apply <id>` with the id the companion printed.

The companion also writes the bot's EPGP standings into the addon folder
every 15 minutes. After a `/reload`, your client shares them with online
guildmates, so everyone gets `/qg standings` and the Discord numbers in the
EPGP tab.

Readiness from everyone who was online with the addon rides along in your
export, so members don't need to export anything themselves.
