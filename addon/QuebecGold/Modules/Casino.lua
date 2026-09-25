-- Casino: officer-hosted /roll games that anyone in the group can play,
-- with or without the addon.
--
-- How it works:
--   * Only officers run games. The officer's client is the table: it posts
--     the announcements in party/raid chat, reads players' /roll results and
--     chat replies, and keeps the ledger.
--   * Players (guildies or pugs, addon or not) join a group game by typing 1
--     in party/raid chat, and play by typing /roll. In blackjack they type
--     "stand" to stay.
--   * No addon can move gold. Every result is a ledger entry (who owes whom),
--     paid by trade. Trades with the officer settle ledger debts automatically.
--
-- Chat volume: each game posts one line to open, one to call the roll, and
-- one result (deathroll: one per round; blackjack: one per card). Joins are
-- never announced one by one. Lines queued close together are merged into a
-- single chat message and sends are spaced out, so the table never floods
-- chat or trips the server's chat throttle.
--
-- Wagers accept gold and silver: 10 or 10g (gold), 50s (silver), 1g50s.
local addonName, ns = ...
ns = ns or {}

local CASINO_PREFIX = "QuebecGoldCasino"
local GOLD = 10000
local SILVER = 100
local MAX_WAGER = 100000 * GOLD
local CHAT_MAX = 240
local CHAT_GAP_SECONDS = 1.5

local JOIN_WORDS = { ["1"] = true, ["join"] = true, ["in"] = true }
local LEAVE_WORDS = { ["leave"] = true, ["out"] = true }
local STAND_WORDS = { ["stand"] = true, ["stay"] = true }
local GROUP_CHAT_EVENTS = {
  "CHAT_MSG_PARTY", "CHAT_MSG_PARTY_LEADER", "CHAT_MSG_RAID", "CHAT_MSG_RAID_LEADER",
  "CHAT_MSG_INSTANCE_CHAT", "CHAT_MSG_INSTANCE_CHAT_LEADER"
}

local casino = {
  session = nil,   -- the group game this officer is hosting
  houseBets = {}   -- [player] = one-on-one game vs the house (this officer)
}
ns.casino = casino

local db
local combatLocked = false

-- ---------------------------------------------------------------------
-- Money
-- ---------------------------------------------------------------------

-- "10" or "10g" = gold, "50s" = silver, "1g50s", "1.5g". Returns copper.
local function parseMoney(text)
  if text == nil then return nil end
  text = string.lower((string.gsub(tostring(text), "%s+", "")))
  if text == "" then return nil end
  local copper, found = 0, false
  local rest = string.gsub(text, "(%d+%.?%d*)([gs])", function(number, unit)
    copper = copper + math.floor(tonumber(number) * (unit == "g" and GOLD or SILVER) + 0.5)
    found = true
    return ""
  end)
  if rest ~= "" then
    local number = tonumber(rest)
    if found or not number then return nil end
    copper = math.floor(number * GOLD + 0.5)
  end
  if copper < SILVER or copper > MAX_WAGER then return nil end
  return copper
end

local function formatMoney(copper)
  copper = math.floor((copper or 0) + 0.5)
  local negative = copper < 0
  copper = math.abs(copper)
  local gold = math.floor(copper / GOLD)
  local silver = math.floor((copper % GOLD) / SILVER)
  local text
  if gold > 0 and silver > 0 then text = gold .. "g " .. silver .. "s"
  elseif gold > 0 then text = gold .. "g"
  else text = silver .. "s" end
  return negative and ("-" .. text) or text
end

-- ---------------------------------------------------------------------
-- Chat output: queued, merged, and paced
-- ---------------------------------------------------------------------

local function groupChannel()
  if IsInRaid and IsInRaid() then return "RAID" end
  if IsInGroup and IsInGroup() then return "PARTY" end
  return nil
end

local function clock()
  return GetTime and GetTime() or time()
end

local queue = {}
local flushScheduled = false
local lastChatAt = 0

local function sendChat(text, channel)
  pcall(function()
    if C_ChatInfo and C_ChatInfo.SendChatMessage then
      C_ChatInfo.SendChatMessage(text, channel)
    elseif SendChatMessage then
      SendChatMessage(text, channel)
    end
  end)
end

local scheduleFlush

local function flush()
  flushScheduled = false
  if #queue == 0 then return end
  local line = table.remove(queue, 1)
  -- Merge whatever else is waiting into the same chat line when it fits.
  while queue[1] and string.len(line) + 3 + string.len(queue[1]) <= CHAT_MAX do
    line = line .. " | " .. table.remove(queue, 1)
  end
  local channel = groupChannel()
  if channel then sendChat("[QG] " .. line, channel) end
  lastChatAt = clock()
  if #queue > 0 then scheduleFlush() end
end

scheduleFlush = function()
  if flushScheduled then return end
  flushScheduled = true
  local wait = math.max(0.2, CHAT_GAP_SECONDS - (clock() - lastChatAt))
  if C_Timer and C_Timer.After then C_Timer.After(wait, flush) else flush() end
end

-- Public line in party/raid chat (also echoed to the officer's chat frame).
local function announce(text)
  ns.message(text)
  table.insert(queue, string.sub(text, 1, CHAT_MAX))
  scheduleFlush()
end

-- Private line for the hosting officer only.
local function tell(text)
  ns.message(text)
end

local function sendAddon(text)
  pcall(function()
    local channel = "GUILD"
    if C_ChatInfo and C_ChatInfo.SendAddonMessage then
      C_ChatInfo.SendAddonMessage(CASINO_PREFIX, string.sub(text, 1, 255), channel)
    elseif SendAddonMessage then
      SendAddonMessage(CASINO_PREFIX, string.sub(text, 1, 255), channel)
    end
  end)
end

-- ---------------------------------------------------------------------
-- Ledger
-- ---------------------------------------------------------------------

local function ensureDb()
  QuebecGoldCasinoDB = QuebecGoldCasinoDB or {}
  db = QuebecGoldCasinoDB
  db.guildCut = db.guildCut or 0.05
  db.vault = db.vault or 0
  db.ledger = db.ledger or {}
end

local function ensureLedger(name)
  db.ledger[name] = db.ledger[name] or { won = 0, lost = 0, debts = {}, history = {} }
  return db.ledger[name]
end

local function pushHistory(name, entry)
  local ledger = ensureLedger(name)
  table.insert(ledger.history, entry)
  while #ledger.history > 50 do table.remove(ledger.history, 1) end
end

-- Records that `payer` owes `payee`. Other officers' clients keep a copy.
local function addDebt(payer, payee, amount, reason, mirrored)
  if payer == payee or amount <= 0 then return end
  local payerLedger = ensureLedger(payer)
  payerLedger.lost = payerLedger.lost + amount
  payerLedger.debts[payee] = (payerLedger.debts[payee] or 0) + amount
  local payeeLedger = ensureLedger(payee)
  payeeLedger.won = payeeLedger.won + amount
  if mirrored then return end
  pushHistory(payer, { at = ns.now(), type = "LOSS", amount = amount, counterparty = payee, reason = reason })
  pushHistory(payee, { at = ns.now(), type = "WIN", amount = amount, counterparty = payer, reason = reason })
  sendAddon(string.format("DEBT|%s|%s|%d|%s", payer, payee, amount, reason))
end

local function reduceDebt(debtor, creditor, amount, reason, mirrored)
  local ledger = db.ledger[debtor]
  local owed = ledger and ledger.debts[creditor] or 0
  if owed <= 0 or amount <= 0 then return 0 end
  local paid = math.min(owed, amount)
  ledger.debts[creditor] = owed - paid
  if not mirrored then
    pushHistory(debtor, { at = ns.now(), type = "SETTLED", amount = paid, counterparty = creditor, reason = reason })
    sendAddon(string.format("CLEAR|%s|%s|%d", debtor, creditor, paid))
  end
  return paid
end

-- ---------------------------------------------------------------------
-- Guards
-- ---------------------------------------------------------------------

local function isHostOfficer()
  if not ns.isOfficer() then
    ns.message("Only officers can run casino games.")
    return false
  end
  return true
end

local function canHost()
  if not isHostOfficer() then return false end
  if combatLocked then tell("Casino games are paused while you are in combat."); return false end
  if not groupChannel() then
    tell("Form a party or raid first: players must be grouped with you so you can see their chat and rolls.")
    return false
  end
  return true
end

local function countKeys(t)
  local n = 0
  for _ in pairs(t) do n = n + 1 end
  return n
end

local function sortedNames(set)
  local names = {}
  for name in pairs(set) do table.insert(names, name) end
  table.sort(names)
  return names
end

-- ---------------------------------------------------------------------
-- Group games: Pot, Elimination Deathroll, Difference Roll
-- ---------------------------------------------------------------------

local GAME_NAMES = { POT = "Pot Sweepstakes", DEATHROLL = "Elimination Deathroll", DIFF = "Difference Roll" }

local function startGroupGame(game, moneyText)
  if not canHost() then return end
  if casino.session then tell("A group game is already running. Roll, or cancel it first."); return end
  local wager = parseMoney(moneyText)
  if not wager then tell("Enter a wager like 10g, 50s, or 1g50s."); return end
  local session = { game = game, host = ns.playerName(), phase = "JOINING", wager = wager, players = {}, rolls = {} }
  if game == "DIFF" then
    -- The wager is the roll ceiling, counted in gold or in silver.
    session.unit = (wager % GOLD == 0) and GOLD or SILVER
    session.maxRoll = math.floor(wager / session.unit)
    if session.maxRoll < 2 or session.maxRoll > 100000 then tell("Difference Roll needs a wager of at least 2 (2g or 2s)."); return end
    announce(string.format("Difference Roll up to %s! Lowest roll pays the highest the difference. Type 1 to join.", formatMoney(wager)))
  elseif game == "POT" then
    session.maxRoll = 100
    announce(string.format("Pot Sweepstakes! Entry %s, highest roll takes the pot (%d%% guild cut). Type 1 to join.",
      formatMoney(wager), math.floor(db.guildCut * 100)))
  else
    session.maxRoll = 1000
    session.round = 1
    session.eliminated = {}
    announce(string.format("Elimination Deathroll! Every loser pays the last survivor %s. Type 1 to join.", formatMoney(wager)))
  end
  casino.session = session
end

local function addPlayer(name, byHost)
  local session = casino.session
  if not session or session.phase ~= "JOINING" or not name then return end
  if session.players[name] then return end
  session.players[name] = true
  tell(string.format("%s joined %s (%d player%s).", name, GAME_NAMES[session.game], countKeys(session.players),
    countKeys(session.players) == 1 and "" or "s"))
  if byHost and ns.onCasinoChange then ns.onCasinoChange() end
end

local function removePlayer(name)
  local session = casino.session
  if not session or session.phase ~= "JOINING" or not session.players[name] then return end
  session.players[name] = nil
  tell(name .. " left the game.")
end

local function waitingOn()
  local session = casino.session
  local names = {}
  for _, name in ipairs(sortedNames(session.players)) do
    if not session.rolls[name] then table.insert(names, name) end
  end
  return names
end

local function callRoll(prefix)
  local session = casino.session
  session.phase = "ROLLING"
  session.rolls = {}
  local names = sortedNames(session.players)
  announce(string.format("%s/roll %d now: %s", prefix or "", session.maxRoll, table.concat(names, ", ")))
end

local function beginRolling()
  local session = casino.session
  if not isHostOfficer() then return end
  if not session then tell("No group game is open."); return end
  if session.phase ~= "JOINING" then tell("Already rolling. Use Remind to nudge players."); return end
  if countKeys(session.players) < 2 then tell("Need at least 2 players. Players type 1 in chat, or add them with the Player box."); return end
  -- Everyone who paid in, kept even if a tie narrows the players to a roll-off.
  session.entrants = sortedNames(session.players)
  callRoll()
end

local function remind()
  local session = casino.session
  if not session or session.phase ~= "ROLLING" then tell("Nobody is being waited on."); return end
  announce(string.format("Waiting on %s: /roll %d", table.concat(waitingOn(), ", "), session.maxRoll))
end

local function resolveDiff(session)
  local highName, highVal, lowName, lowVal
  for _, name in ipairs(sortedNames(session.rolls)) do
    local value = session.rolls[name]
    if not highVal or value > highVal then highName, highVal = name, value end
    if not lowVal or value < lowVal then lowName, lowVal = name, value end
  end
  if highVal == lowVal then
    announce(string.format("Difference Roll: everyone tied at %d. No payout.", highVal))
  else
    local amount = (highVal - lowVal) * session.unit
    addDebt(lowName, highName, amount, "Difference Roll")
    announce(string.format("Difference Roll: %s (%d) pays %s (%d) %s.", lowName, lowVal, highName, highVal, formatMoney(amount)))
  end
  casino.session = nil
end

local function resolvePot(session)
  local best, winners = nil, {}
  for name, value in pairs(session.rolls) do
    if not best or value > best then best, winners = value, { name }
    elseif value == best then table.insert(winners, name) end
  end
  if #winners > 1 then
    table.sort(winners)
    session.players = {}
    for _, name in ipairs(winners) do session.players[name] = true end
    callRoll(string.format("Tie at %d! Roll-off: ", best))
    return
  end
  local entrants = session.entrants
  local winner = winners[1]
  local pot = session.wager * #entrants
  local cut = math.floor(pot * db.guildCut)
  local payout = pot - cut
  db.vault = db.vault + cut
  -- Entry fees are owed to the hosting officer, who pays the winner.
  for _, name in ipairs(entrants) do addDebt(name, session.host, session.wager, "Pot entry") end
  addDebt(session.host, winner, payout, "Pot Sweepstakes win")
  announce(string.format("Pot Sweepstakes: %s wins %s (pot %s, guild cut %s). Settle up by trade with %s.",
    winner, formatMoney(payout), formatMoney(pot), formatMoney(cut), session.host))
  casino.session = nil
end

local function resolveDeathroll(session)
  local low, lows = nil, {}
  for name, value in pairs(session.rolls) do
    if not low or value < low then low, lows = value, { name }
    elseif value == low then table.insert(lows, name) end
  end
  table.sort(lows)
  local out = lows[math.random(#lows)]
  table.insert(session.eliminated, out)
  session.players[out] = nil
  local tieNote = #lows > 1 and " (tie, picked at random)" or ""
  if countKeys(session.players) <= 1 then
    local survivor = next(session.players)
    for _, loser in ipairs(session.eliminated) do addDebt(loser, survivor, session.wager, "Elimination Deathroll") end
    announce(string.format("Deathroll: %s is out%s. %s survives! Each of %d losers owes %s %s.",
      out, tieNote, survivor, #session.eliminated, survivor, formatMoney(session.wager)))
    casino.session = nil
    return
  end
  session.round = session.round + 1
  session.maxRoll = math.max(low, 2)
  -- Elimination and the next roll call share one chat line.
  callRoll(string.format("Round %d - %s is out%s. ", session.round, out, tieNote))
end

local function onGroupRoll(name, value, maxRoll)
  local session = casino.session
  if not session or session.phase ~= "ROLLING" or not session.players[name] then return end
  if maxRoll ~= session.maxRoll or session.rolls[name] then return end
  session.rolls[name] = value
  if #waitingOn() > 0 then return end
  if session.game == "DIFF" then resolveDiff(session)
  elseif session.game == "POT" then resolvePot(session)
  else resolveDeathroll(session) end
end

local function cancelGroupGame()
  if not isHostOfficer() then return end
  if not casino.session then tell("No group game to cancel."); return end
  announce(GAME_NAMES[casino.session.game] .. " cancelled. No payouts.")
  casino.session = nil
end

-- ---------------------------------------------------------------------
-- House games: one player vs the hosting officer
-- ---------------------------------------------------------------------

local ROULETTE_RED = {
  [1] = true, [3] = true, [5] = true, [7] = true, [9] = true, [12] = true, [14] = true, [16] = true, [18] = true,
  [19] = true, [21] = true, [23] = true, [25] = true, [27] = true, [30] = true, [32] = true, [34] = true, [36] = true
}

local function cardName(roll)
  if roll == 1 then return "A" end
  if roll == 11 then return "J" end
  if roll == 12 then return "Q" end
  if roll == 13 then return "K" end
  return tostring(roll)
end

local function handTotal(cards)
  local total, aces = 0, 0
  for _, card in ipairs(cards) do
    if card == 1 then total, aces = total + 11, aces + 1
    elseif card >= 10 then total = total + 10
    else total = total + card end
  end
  while total > 21 and aces > 0 do total, aces = total - 10, aces - 1 end
  return total
end

local function handText(cards)
  local names = {}
  for _, card in ipairs(cards) do table.insert(names, cardName(card)) end
  return table.concat(names, "+")
end

-- Settles a house game: the player owes the officer, or the officer owes
-- the player. The vault tally tracks the house's running result.
local function settleHouse(player, won, amount, reason)
  local host = ns.playerName()
  if won then
    db.vault = db.vault - amount
    addDebt(host, player, amount, reason)
  else
    db.vault = db.vault + amount
    addDebt(player, host, amount, reason)
  end
  casino.houseBets[player] = nil
end

local function startHouseGame(kind, player, args)
  if not canHost() then return end
  player = ns.normalizeName(player)
  if not player then tell("Pick the player first (target them or use the Player box)."); return end
  if casino.houseBets[player] then tell(player .. " already has a game going. Finish or cancel it first."); return end
  if kind == "BLACKJACK" then
    local wager = parseMoney(args[1])
    if not wager then tell("Enter a wager like 10g, 50s, or 1g50s."); return end
    local dealer = { math.random(1, 13) }
    casino.houseBets[player] = { kind = kind, wager = wager, cards = {}, dealer = dealer }
    announce(string.format("Blackjack %s for %s. Dealer shows %s. %s: /roll 13 to draw, type stand to stay.",
      formatMoney(wager), player, cardName(dealer[1]), player))
  elseif kind == "OVERUNDER" then
    local choice = string.lower(args[1] or "")
    local wager = parseMoney(args[2])
    if (choice ~= "over" and choice ~= "under") or not wager then tell("Usage: overunder <player> <over|under> <wager>"); return end
    casino.houseBets[player] = { kind = kind, wager = wager, choice = choice }
    announce(string.format("Over/Under 50: %s bets %s on %s. /roll 100 (exactly 50 = house wins).", player, formatMoney(wager), choice))
  else
    local bet = string.lower(args[1] or "")
    local number = tonumber(bet)
    if bet == "straight" then number = tonumber(args[2]); table.remove(args, 1) end
    local wager = parseMoney(args[2])
    local valid = bet == "red" or bet == "black" or bet == "even" or bet == "odd" or (number and number >= 1 and number <= 36)
    if not valid or not wager then tell("Usage: roulette <player> <red|black|even|odd|1-36> <wager>"); return end
    casino.houseBets[player] = { kind = kind, wager = wager, bet = number and "number" or bet, number = number }
    announce(string.format("Roulette: %s bets %s on %s. /roll 38 (37 = 0, 38 = 00).", player, formatMoney(wager),
      number and tostring(number) or bet))
  end
end

local function finishBlackjack(player, bet)
  while handTotal(bet.dealer) < 17 do table.insert(bet.dealer, math.random(1, 13)) end
  local mine, dealer = handTotal(bet.cards), handTotal(bet.dealer)
  local head = string.format("Blackjack: %s %d vs dealer %d (%s)", player, mine, dealer, handText(bet.dealer))
  if dealer > 21 or mine > dealer then
    settleHouse(player, true, bet.wager, "Blackjack")
    announce(head .. string.format(" - %s wins %s.", player, formatMoney(bet.wager)))
  elseif mine < dealer then
    settleHouse(player, false, bet.wager, "Blackjack")
    announce(head .. string.format(" - house wins %s.", formatMoney(bet.wager)))
  else
    casino.houseBets[player] = nil
    announce(head .. " - push, no payout.")
  end
end

local function onHouseRoll(player, value, maxRoll)
  local bet = casino.houseBets[player]
  if not bet then return end
  if bet.kind == "BLACKJACK" and maxRoll == 13 then
    table.insert(bet.cards, value)
    local total = handTotal(bet.cards)
    if total > 21 then
      settleHouse(player, false, bet.wager, "Blackjack bust")
      announce(string.format("Blackjack: %s busts with %s = %d - house wins %s.", player, handText(bet.cards), total, formatMoney(bet.wager)))
    elseif total == 21 then
      finishBlackjack(player, bet)
    else
      announce(string.format("%s: %s = %d. /roll 13 or type stand.", player, handText(bet.cards), total))
    end
  elseif bet.kind == "OVERUNDER" and maxRoll == 100 then
    local won = value ~= 50 and ((value > 50) == (bet.choice == "over"))
    settleHouse(player, won, bet.wager, "Over/Under 50")
    announce(string.format("Over/Under: %s rolled %d - %s %s.", player, value, won and "wins" or "loses", formatMoney(bet.wager)))
  elseif bet.kind == "ROULETTE" and maxRoll == 38 then
    local label = value == 37 and "0" or value == 38 and "00" or tostring(value)
    local color = (value >= 37) and "green" or (ROULETTE_RED[value] and "red" or "black")
    local won, payout
    if bet.bet == "number" then
      won, payout = value == bet.number, bet.wager * 35
    elseif bet.bet == "red" or bet.bet == "black" then
      won, payout = color == bet.bet, bet.wager
    else
      won, payout = value <= 36 and ((value % 2 == 0) == (bet.bet == "even")), bet.wager
    end
    settleHouse(player, won, won and payout or bet.wager, "Roulette")
    announce(string.format("Roulette: %s (%s) - %s %s %s.", label, color, player, won and "wins" or "loses",
      formatMoney(won and payout or bet.wager)))
  end
end

local function stand(player)
  local bet = casino.houseBets[player]
  if not bet or bet.kind ~= "BLACKJACK" then return end
  if #bet.cards == 0 then tell(player .. " needs to draw a card (/roll 13) before standing."); return end
  finishBlackjack(player, bet)
end

local function cancelHouseGame(player)
  if not isHostOfficer() then return end
  player = ns.normalizeName(player)
  if not player or not casino.houseBets[player] then tell("That player has no game going."); return end
  casino.houseBets[player] = nil
  tell(player .. "'s game cancelled, no payout.")
end

-- ---------------------------------------------------------------------
-- Status (for the tools window), ledger, trade settlement
-- ---------------------------------------------------------------------

-- Short description of what this officer's table is doing right now.
function casino.statusText()
  local lines = {}
  local session = casino.session
  if session then
    local players = sortedNames(session.players)
    if session.phase == "JOINING" then
      table.insert(lines, string.format("%s (%s): %d joined - %s", GAME_NAMES[session.game], formatMoney(session.wager),
        #players, #players > 0 and table.concat(players, ", ") or "waiting for players to type 1"))
    else
      table.insert(lines, string.format("%s: waiting on %s", GAME_NAMES[session.game], table.concat(waitingOn(), ", ")))
    end
  end
  for player, bet in pairs(casino.houseBets) do
    table.insert(lines, string.format("%s: %s %s", player, string.lower(bet.kind), formatMoney(bet.wager)))
  end
  return #lines > 0 and table.concat(lines, "\n") or "No games running."
end

local function showLedger(args)
  local target = ns.normalizeName(args[1])
  if not target then
    local owedToMe, iOwe = {}, {}
    local me = ns.playerName()
    for name, ledger in pairs(db.ledger) do
      if (ledger.debts[me] or 0) > 0 then table.insert(owedToMe, name .. " " .. formatMoney(ledger.debts[me])) end
    end
    for name, amount in pairs((db.ledger[me] or { debts = {} }).debts) do
      if amount > 0 then table.insert(iOwe, name .. " " .. formatMoney(amount)) end
    end
    table.sort(owedToMe)
    table.sort(iOwe)
    tell("Owed to you: " .. (#owedToMe > 0 and table.concat(owedToMe, ", ") or "nothing"))
    tell("You owe: " .. (#iOwe > 0 and table.concat(iOwe, ", ") or "nothing"))
    tell("House result (guild cut + house games): " .. formatMoney(db.vault))
    return
  end
  local ledger = db.ledger[target]
  if not ledger then tell(target .. " has no casino history."); return end
  tell(string.format("%s - won %s, lost %s, net %s", target, formatMoney(ledger.won), formatMoney(ledger.lost), formatMoney(ledger.won - ledger.lost)))
  for creditor, amount in pairs(ledger.debts) do
    if amount > 0 then tell("  owes " .. creditor .. " " .. formatMoney(amount)) end
  end
end

local function clearDebt(debtor, creditor)
  debtor = ns.normalizeName(debtor)
  creditor = ns.normalizeName(creditor) or ns.playerName()
  if not debtor then tell("Usage: /qg casino debt clear <player> [owed-to]"); return end
  local paid = reduceDebt(debtor, creditor, math.huge, "Cleared by " .. ns.playerName())
  if paid > 0 then tell(string.format("Cleared %s's debt of %s to %s.", debtor, formatMoney(paid), creditor))
  else tell(debtor .. " owes " .. creditor .. " nothing on record.") end
end

-- Trades with the officer settle casino debts automatically: gold received
-- from someone pays down what they owe you, gold given pays down what you
-- owe them. The amounts are read when both sides accept, and applied only
-- when the game reports the trade completed.
local trade = {}

local function snapshotTrade()
  if GetPlayerTradeMoney and GetTargetTradeMoney then
    trade.given = GetPlayerTradeMoney() or 0
    trade.received = GetTargetTradeMoney() or 0
  end
end

local function settleTrade()
  local partner = trade.partner
  if not partner or not db then return end
  local me = ns.playerName()
  local fromThem = reduceDebt(partner, me, trade.received or 0, "Paid by trade")
  local fromMe = reduceDebt(me, partner, trade.given or 0, "Paid by trade")
  if fromThem > 0 then
    tell(string.format("Trade: %s paid %s toward their casino debt (%s left).", partner, formatMoney(fromThem),
      formatMoney(db.ledger[partner].debts[me] or 0)))
  end
  if fromMe > 0 then
    tell(string.format("Trade: you paid %s %s of casino winnings (%s left).", partner, formatMoney(fromMe),
      formatMoney(db.ledger[me].debts[partner] or 0)))
  end
end

-- ---------------------------------------------------------------------
-- Commands (officers only)
-- ---------------------------------------------------------------------

local function showHelp()
  tell("Group games (players type 1 in chat to join): /qg casino pot|deathroll|diff <wager>")
  tell("  then: roll | remind | cancel | add <player> | remove <player>")
  tell("House games: /qg casino blackjack <player> <wager> | overunder <player> <over|under> <wager>")
  tell("  roulette <player> <red|black|even|odd|1-36> <wager> | stand <player> | cancel <player>")
  tell("/qg casino status | ledger [player] | debt clear <player> [owed-to]. Wagers: 10g, 50s, 1g50s.")
end

local function casinoCommand(args)
  if not isHostOfficer() then return end
  local action = string.lower(args[1] or "")
  table.remove(args, 1)
  if action == "pot" then startGroupGame("POT", args[1])
  elseif action == "deathroll" then startGroupGame("DEATHROLL", args[1])
  elseif action == "diff" then startGroupGame("DIFF", args[1])
  elseif action == "add" then addPlayer(ns.normalizeName(args[1]), true)
  elseif action == "remove" then removePlayer(ns.normalizeName(args[1]))
  elseif action == "roll" then beginRolling()
  elseif action == "remind" then remind()
  elseif action == "cancel" then
    if args[1] then cancelHouseGame(args[1]) else cancelGroupGame() end
  elseif action == "blackjack" then local player = table.remove(args, 1); startHouseGame("BLACKJACK", player, args)
  elseif action == "overunder" then local player = table.remove(args, 1); startHouseGame("OVERUNDER", player, args)
  elseif action == "roulette" then local player = table.remove(args, 1); startHouseGame("ROULETTE", player, args)
  elseif action == "stand" then stand(ns.normalizeName(args[1]))
  elseif action == "status" then tell(casino.statusText())
  elseif action == "ledger" then showLedger(args)
  elseif action == "debt" and string.lower(args[1] or "") == "clear" then clearDebt(args[2], args[3])
  else showHelp() end
  if ns.onCasinoChange then ns.onCasinoChange() end
end

ns.commandHandlers = ns.commandHandlers or {}
ns.commandHandlers["casino"] = casinoCommand
ns.commandHelp = ns.commandHelp or {}
table.insert(ns.commandHelp, { officer = true, text = "/qg casino - officer-run casino (players join by typing 1 and /roll)" })
casino.parseMoney = parseMoney
casino.formatMoney = formatMoney

-- ---------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------

local function hosting()
  return casino.session ~= nil or next(casino.houseBets) ~= nil
end

local function onEvent(_, event, ...)
  if event == "PLAYER_LOGIN" then
    ensureDb()
    if C_ChatInfo and C_ChatInfo.RegisterAddonMessagePrefix then
      C_ChatInfo.RegisterAddonMessagePrefix(CASINO_PREFIX)
    elseif RegisterAddonMessagePrefix then
      RegisterAddonMessagePrefix(CASINO_PREFIX)
    end
  elseif event == "PLAYER_REGEN_DISABLED" then
    combatLocked = true
  elseif event == "PLAYER_REGEN_ENABLED" then
    combatLocked = false
  elseif event == "CHAT_MSG_SYSTEM" then
    if not hosting() then return end
    local text = ...
    local roller, value, minValue, maxValue = ns.parseRoll(text)
    if not roller or minValue ~= 1 then return end
    onGroupRoll(roller, value, maxValue)
    onHouseRoll(roller, value, maxValue)
    if ns.onCasinoChange then ns.onCasinoChange() end
  elseif event == "CHAT_MSG_ADDON" then
    local prefix, text, _, sender = ...
    if ns.isSecret(prefix) or ns.isSecret(text) or ns.isSecret(sender) or prefix ~= CASINO_PREFIX then return end
    sender = ns.normalizeName(sender)
    -- Only other officers' tables are mirrored into this ledger.
    if not sender or sender == ns.playerName() or not ns.isOfficerName(sender) then return end
    local kind = string.match(text, "^(%u+)|")
    if kind == "DEBT" then
      local payer, payee, amount = string.match(text, "^DEBT|([^|]+)|([^|]+)|(%d+)|")
      if payer then addDebt(payer, payee, tonumber(amount), nil, true) end
    elseif kind == "CLEAR" then
      local debtor, creditor, amount = string.match(text, "^CLEAR|([^|]+)|([^|]+)|(%d+)$")
      if debtor then reduceDebt(debtor, creditor, tonumber(amount), nil, true) end
    end
  elseif event == "TRADE_SHOW" then
    trade = { partner = ns.normalizeName(UnitName("NPC")) }
  elseif event == "TRADE_MONEY_CHANGED" or event == "TRADE_ACCEPT_UPDATE" then
    snapshotTrade()
  elseif event == "UI_INFO_MESSAGE" then
    local _, text = ...
    if not ns.isSecret(text) and ERR_TRADE_COMPLETE and text == ERR_TRADE_COMPLETE then
      settleTrade()
      trade = {}
      if ns.onCasinoChange then ns.onCasinoChange() end
    end
  else
    -- Party/raid chat: joining group games and standing in blackjack.
    if not hosting() then return end
    local text, sender = ...
    if ns.isSecret(text) or ns.isSecret(sender) then return end
    local word = string.lower(string.match(text or "", "^%s*(.-)%s*$") or "")
    local name = ns.normalizeName(sender)
    if not name then return end
    if JOIN_WORDS[word] then addPlayer(name)
    elseif LEAVE_WORDS[word] then removePlayer(name)
    elseif STAND_WORDS[word] then stand(name) end
    if ns.onCasinoChange then ns.onCasinoChange() end
  end
end

local frame = CreateFrame("Frame")
for _, event in ipairs({ "PLAYER_LOGIN", "PLAYER_REGEN_DISABLED", "PLAYER_REGEN_ENABLED", "CHAT_MSG_SYSTEM",
  "CHAT_MSG_ADDON", "TRADE_SHOW", "TRADE_MONEY_CHANGED", "TRADE_ACCEPT_UPDATE", "UI_INFO_MESSAGE" }) do
  frame:RegisterEvent(event)
end
for _, event in ipairs(GROUP_CHAT_EVENTS) do frame:RegisterEvent(event) end
frame:SetScript("OnEvent", function(...)
  local ok, err = pcall(onEvent, ...)
  if not ok then ns.message("Casino error: " .. tostring(err)) end
end)
