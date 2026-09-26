# CurseForge copy-paste sheet: Guilded 3.3.0

Each block below is one field. Copy the block, paste it in.

---

## Project name
```
Guilded
```

## Summary (one line)
```
Raid attendance, EPGP, loot bidding, pre-raid gear checks and fun roll games for WoW Forever guilds, with an optional Discord bot.
```

## Category
Raid & Instance (secondary: Guild, Miscellaneous)

## Logo
`docs/branding/guilded-logo-400.png` (400x400). Full size: `docs/branding/guilded-logo.png`.

## File to upload
`dist/Guilded-v3.3.0.zip` (top folder inside is `Guilded`). Release type: **Beta** for the first day, then **Release**.
Game versions: the WoW Forever / Classic entries closest to interface 16001 and 20506.

## License
Select **Custom License**, name it:
```
PolyForm Noncommercial 1.0.0
```
Then paste the full text of the `LICENSE` file in the project root (the first line is the
Required Notice, the rest is the official text). Optional link:
https://polyformproject.org/licenses/noncommercial/1.0.0

## Description (Markdown)
```markdown
# Guilded: the raid toolkit for WoW Forever guilds

Everything an officer needs to run a raid, inside the game, with no setup. Add the
free Discord bot when you want signups and reports outside the game too.

## In game
- **Raid tools:** start and end a raid, attendance with bench credit, boss kills, notes.
- **EPGP and loot:** award EP and GP, live GP bidding with a popup for raiders (whisper
  bids work for people without the addon), standings with priority (PR).
- **Ready page** (officers and raid leaders): see at a glance who in your raid is ready and who is not, and why (flask, food, enchants, gear, durability), with a one-click ready check.
- **Gear check before the raid:** empty slots, missing enchants, flasks, food and
  attunements, with a one-line readiness status for every raider.
- **Roll games:** high roll, deathroll, 1v1 duels. No gold, no wagers, no debts.
- **Mass invite:** `/guilded invite raid` invites everyone who signed up on Discord.
- **A friendly window:** click the gold coin on the minimap. The Home page shows your
  standing, what is going on, and whether your data reached Discord.
- **Item tooltips:** who wishlisted an item, what it usually costs in GP and your priority, right on the tooltip.
- **A Guilded chat tab** (optional) keeps the addon's messages out of raid chat.
- **Safe by design:** backups, per-guild saved data, French translation, and every
  module can be switched off.

## Optional Discord bot (self-hosted, free)
Signups with roles and waitlist, raid cores with priority, weekly raids, dungeon
challenge and leaderboard, craft board, readiness board, polls, Warcraft Logs and
weekly reports. A small Windows companion app (tray icon) uploads your data after
each `/reload`.

## Getting started
1. Install and log in. Type `/guilded` (or `/gd`) for the command list, or click the coin.
2. Officers: open the Raid page and start a raid.
3. Want Discord? Follow the bot guide on the project page.

## Good to know
Made for WoW Forever (interface 16001 and 20506). Free for noncommercial use under the
PolyForm Noncommercial license. Not affiliated with or endorsed by Blizzard Entertainment.
```

## Changelog (paste for the file upload)
```markdown
## 3.3.0

**In game**
- **Ready page** in the Guilded window (and `/guilded ready`): everyone in your raid or party, worst first, coloured Ready / Issues / Not ready / No data, with the reason (no flask, no food, missing enchants, empty gear slots, low durability, old data, offline, no addon). It combines what each player's addon shared with a live look at their buffs, and updates by itself while the page is open. It is **for officers and group leaders only** (guild officers, and the leader or an assistant of the current raid or party); other members do not see the page and `/guilded ready` tells them so.
- **Ready check:** "Ask everyone to check" (`/guilded ready ask`) makes every addon in the group look at itself again and answer within seconds; "Post to group chat" tells the group who needs attention. Addons answer a request only when it comes from an officer, the group leader or an assistant, through raid or party chat, never in combat, and at most every 20 seconds.

## 3.2.0

**In game**
- **Guilded chat tab** (optional): `/guilded chat tab` opens a chat tab named Guilded and sends the addon's own lines there (bid results, sync status, command answers), keeping raid chat readable. `/guilded chat off` goes back. Messages to the raid, party and whispers are not affected.
- Item tooltips speak French on a French client.

**Discord bot**

**Français / French**
- `/setup start` now starts with a language choice (English / Français). In French the whole setup guide and its checklist are French, and it creates a French server: categories (Guilde, Raids, Donjons, Artisanat, Officiers), channels (`guilded-annonces`, `inscriptions-raid`, `cores-de-raid`, `rapports-raid`, `butin`, `inscriptions-donjon`, `classement-donjons`, `donjons-termines`, `tableau-artisanat`, `journal-officiers`, `preparation-raid`) with French topics, and French permission roles (Maître de guilde, Officier, Chef de raid, Officier DKP, Chef du butin, Chef de classe). Both spellings of a role or channel are recognized, so an existing English server keeps working and can be mixed.
- French for what members see in channels: the raid signup post, the core roster, the craft board (tags, posts, buttons, forms, direct messages), dungeon groups, polls and the Warcraft Logs card, plus the announcements and reminders that were already translated.
- Still English for now: officers' own screens and replies (core wizard and editor, EP proposals, readiness board, most command replies), and the slash command descriptions.

## 3.1.0

**In game**
- **Item tooltips:** an item wanted by someone on the guild's wishlists (or awarded before) shows who wants it, what it usually costs in GP and your own priority (PR and rank). It comes from the bot and is shared with the guild like the standings; turn it off with `/guilded modules off tooltip`.

**Discord bot**

- **Warcraft Logs, automatic:** `/setup config wcl-guild guild:<page link>` makes the bot find the guild's new public reports itself, post them in the raid logs channel and attach each to the raid it matches by time.
- **Officer check** (`/raid wcl check`, also sent to the officer log for every new report): players in the log but not credited or the reverse, characters not linked to a Discord member, EP not awarded yet, who came to boss pulls without a flask or food, and deaths. No damage or parse numbers.

## 3.0.2

**In game**
- The game is never reloaded on its own any more. Auto-reload is off for everyone (opt in with `/guilded sync auto on`); officers get a small banner with a Send to Discord button, and logging out also saves.
- `/guilded modules on <module>` now confirms.

**Discord bot**
- Raid signup posts list the players in every role with the count and FULL, mark core members (⭐) and the bench (🪑), and show which core members have not signed up yet.
- New `/core edit`: add or move players, change roles, use a bench of replacements, remove players and rename a core from one message. `/core add` has a `bench` option.
- Fixed the "invalid string length" error on step 3 of `/core setup`.
- Craft board: members can talk inside a request post and press its buttons but not start posts; officers fix an older board with `/craft permissions`.
- The addon-import notice goes to the private officer log.
```
