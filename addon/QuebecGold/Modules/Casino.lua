-- Casino module: six /roll-driven minigames plus a persistent gold ledger.
--
-- Hard constraint that shapes everything below: no WoW addon API can move
-- gold between players. Every "payout" here is a tracked ledger entry (who
-- owes whom, or what the guild vault owes/is owed), settled by hand via
-- trade - never an automatic transfer. The safety features below (public
-- announcements, a persistent debt ledger, officer-assisted debt clearing)
-- exist to keep that manual settlement honest and disputable, not to
-- guarantee payment.
--
-- Group games (Difference Roll, Pot Sweepstakes, Elimination Deathroll) are
-- host-adjudicated: only the host's client parses and acts on participants'
-- /roll results, because WoW roll messages are only visible to players in
-- the same party/raid (or in local visual range) as the roller. The host
-- must be grouped with every participant for this to work. Solo house games
-- (Blackjack, Over/Under 50, Goblin Roulette) are self-adjudicated instead -
-- each player's own client resolves their own bet against their own roll,
-- so no host or grouping is required for those.
local addonName, ns = ...
ns = ns or {}

local CASINO_PREFIX = "QuebecGoldCasino"
local GOLD = 10000
local SILVER = 100

local casino = {
  session = nil,          -- active group game (see startDiff/startPot/startDeathroll)
  pendingSolo = {},        -- [playerName] = { kind = "OVERUNDER"|"ROULETTE", ... }
  blackjackHands = {}      -- [playerName] = { wager, playerCards, dealerCards, phase }
}
ns.casino = casino

local db
local combatLocked = false

-- ---------------------------------------------------------------------
-- Utility helpers
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

local function formatMoney(copper)
  copper = math.floor((copper or 0) + 0.5)
  local negative = copper < 0
  copper = math.abs(copper)
  local gold = math.floor(copper / GOLD)
  local silver = math.floor((copper % GOLD) / SILVER)
  local text = string.format("%dg %ds", gold, silver)
  return negative and ("-" .. text) or text
end

local function parseAmount(denomination, raw)
  local n = tonumber(raw)
  if not n or n <= 0 then return nil end
  if string.lower(denomination or "gold") == "silver" then return math.floor(n * SILVER) end
  return math.floor(n * GOLD)
end

local function countKeys(t)
  local n = 0
  for _ in pairs(t) do n = n + 1 end
  return n
end

local function registerPrefix()
  if C_ChatInfo and C_ChatInfo.RegisterAddonMessagePrefix then
    C_ChatInfo.RegisterAddonMessagePrefix(CASINO_PREFIX)
  elseif RegisterAddonMessagePrefix then
    RegisterAddonMessagePrefix(CASINO_PREFIX)
  end
end

local function groupChannel()
  if IsInRaid and IsInRaid() then return "RAID" end
  if GetNumRaidMembers and GetNumRaidMembers() > 0 then return "RAID" end
  if IsInGroup and IsInGroup() then return "PARTY" end
  if GetNumPartyMembers and GetNumPartyMembers() > 0 then return "PARTY" end
  return nil
end

local function sendCasino(text)
  local target = groupChannel() or "GUILD"
  if C_ChatInfo and C_ChatInfo.SendAddonMessage then
    C_ChatInfo.SendAddonMessage(CASINO_PREFIX, text, target)
  elseif SendAddonMessage then
    SendAddonMessage(CASINO_PREFIX, text, target)
  end
end

-- Public, human-readable announcement (game start/finish only - intermediate
-- state passes silently over the addon channel above, per spec, to avoid
-- cluttering /raid or /guild chat with anything but clean summaries).
local function announce(text)
  local channel = groupChannel()
  if channel and SendChatMessage then
    SendChatMessage(text, channel)
  end
  ns.message(text)
end

local function guardCombat()
  if combatLocked then
    ns.message("Casino games are disabled while in combat.")
    return true
  end
  return false
end

-- ---------------------------------------------------------------------
-- Ledger mutation (authoritative - records locally AND broadcasts so every
-- online client's own ledger copy stays consistent, the same
-- eventually-consistent pattern Core.lua uses for peer readiness sync).
-- ---------------------------------------------------------------------

local function applyDebt(payer, payee, amount, reason)
  local payerLedger = ensureLedger(payer)
  payerLedger.lost = payerLedger.lost + amount
  payerLedger.debts[payee] = (payerLedger.debts[payee] or 0) + amount
  pushHistory(payer, { at = ns.now(), type = "LOSS", amount = amount, counterparty = payee, reason = reason })

  local payeeLedger = ensureLedger(payee)
  payeeLedger.won = payeeLedger.won + amount
  pushHistory(payee, { at = ns.now(), type = "WIN", amount = amount, counterparty = payer, reason = reason })

  sendCasino(string.format("DEBT|%s|%s|%d|%s", payer, payee, amount, reason))
end

-- won=true: the player wins `amount` out of the guild vault. won=false: the
-- player loses `amount` into it. The vault balance is a tracked tally, not a
-- real bankroll - see the file header.
local function applyHouseResult(name, amount, won, reason)
  local ledger = ensureLedger(name)
  if won then
    ledger.won = ledger.won + amount
    db.vault = db.vault - amount
  else
    ledger.lost = ledger.lost + amount
    db.vault = db.vault + amount
  end
  pushHistory(name, { at = ns.now(), type = won and "WIN" or "LOSS", amount = amount, counterparty = "House", reason = reason })
  sendCasino(string.format("HOUSE|%s|%d|%s|%s", name, amount, won and "WIN" or "LOSS", reason))
end

-- Non-authoritative mirror applied when receiving another client's broadcast
-- of a result it already resolved. Does not re-broadcast or duplicate
-- history - the originating client already logged that.
local function applyMirroredDebt(payer, payee, amount)
  local payerLedger = ensureLedger(payer)
  payerLedger.lost = payerLedger.lost + amount
  payerLedger.debts[payee] = (payerLedger.debts[payee] or 0) + amount
  local payeeLedger = ensureLedger(payee)
  payeeLedger.won = payeeLedger.won + amount
end

local function applyMirroredHouse(name, amount, result)
  local ledger = ensureLedger(name)
  if result == "WIN" then
    ledger.won = ledger.won + amount
    db.vault = db.vault - amount
  else
    ledger.lost = ledger.lost + amount
    db.vault = db.vault + amount
  end
end

-- ---------------------------------------------------------------------
-- Roll parsing
-- ---------------------------------------------------------------------

local function parseRoll(text)
  local roller, value, minValue, maxValue = string.match(text, "^(.-) rolls (%d+) %((%d+)%-(%d+)%)$")
  if not roller then return nil end
  roller = string.match(roller, "^([^%-]+)") or roller
  return roller, tonumber(value), tonumber(minValue), tonumber(maxValue)
end

-- ---------------------------------------------------------------------
-- Group games: Difference Roll, Pot Sweepstakes, Elimination Deathroll
-- ---------------------------------------------------------------------

local function startDiff(args)
  if guardCombat() then return end
  if casino.session then ns.message("A casino game is already active."); return end
  local denomination = string.lower(args[1] or "")
  if denomination ~= "gold" and denomination ~= "silver" then
    ns.message("Usage: /qg casino diff <gold|silver> <maxWager>"); return
  end
  local maxWager = tonumber(args[2])
  if not maxWager or maxWager <= 0 then
    ns.message("Usage: /qg casino diff <gold|silver> <maxWager>"); return
  end
  casino.session = {
    game = "DIFF", host = ns.playerName(), phase = "JOINING",
    denomination = denomination, maxRoll = math.floor(maxWager),
    participants = { [ns.playerName()] = true }, rolls = {}
  }
  announce(string.format("Difference Roll started by %s! Max wager: %d %s. /qg casino join to enter, then the host runs /qg casino roll.",
    ns.playerName(), math.floor(maxWager), denomination))
end

local function startPot(args)
  if guardCombat() then return end
  if casino.session then ns.message("A casino game is already active."); return end
  local amount = parseAmount("gold", args[1])
  if not amount then ns.message("Usage: /qg casino pot <entryFeeGold>"); return end
  casino.session = {
    game = "POT", host = ns.playerName(), phase = "JOINING",
    entryFee = amount, maxRoll = 100,
    participants = { [ns.playerName()] = true }, rolls = {}
  }
  announce(string.format("Pot Sweepstakes started by %s! Entry fee: %s. /qg casino join to enter, then the host runs /qg casino roll.",
    ns.playerName(), formatMoney(amount)))
end

local function startDeathroll(args)
  if guardCombat() then return end
  if casino.session then ns.message("A casino game is already active."); return end
  local amount = parseAmount("gold", args[1])
  if not amount then ns.message("Usage: /qg casino deathroll <baseWagerGold>"); return end
  casino.session = {
    game = "DEATHROLL", host = ns.playerName(), phase = "JOINING",
    wager = amount, maxRoll = 10000, round = 1,
    participants = { [ns.playerName()] = true }, rolls = {}, eliminated = {}
  }
  announce(string.format("Elimination Deathroll started by %s! Base wager: %s. /qg casino join to enter, then the host runs /qg casino roll.",
    ns.playerName(), formatMoney(amount)))
end

local function joinSession()
  local session = casino.session
  if not session then ns.message("No casino game is open to join."); return end
  if session.phase ~= "JOINING" then ns.message("This game is no longer accepting joins."); return end
  session.participants[ns.playerName()] = true
  ns.message("Joined the " .. session.game .. " game.")
end

local function beginRolling()
  local session = casino.session
  if not session then ns.message("No casino game is open."); return end
  if ns.playerName() ~= session.host then ns.message("Only the host can start rolling."); return end
  if session.phase ~= "JOINING" then ns.message("This game is already rolling."); return end
  session.phase = "ROLLING"
  session.rolls = {}
  if session.game == "POT" then
    session.pot = session.entryFee * countKeys(session.participants)
  end
  announce(string.format("Roll now! /roll %d (%d player(s))", session.maxRoll, countKeys(session.participants)))
end

local function cancelSession()
  local session = casino.session
  if not session then ns.message("No active casino game."); return end
  if ns.playerName() ~= session.host and not ns.isOfficer() then
    ns.message("Only the host or an officer can cancel this game."); return
  end
  announce("Casino game cancelled by " .. ns.playerName() .. ". No payouts.")
  casino.session = nil
end

local function resolveDiff()
  local session = casino.session
  local highName, highVal, lowName, lowVal
  for name, val in pairs(session.rolls) do
    if not highVal or val > highVal then highName, highVal = name, val end
    if not lowVal or val < lowVal then lowName, lowVal = name, val end
  end
  if highName == lowName then
    announce("Difference Roll: only one roll recorded. No payout.")
    casino.session = nil
    return
  end
  if highVal == lowVal then
    announce(string.format("Difference Roll: tied at %d. No payout.", highVal))
    casino.session = nil
    return
  end
  local amount = parseAmount(session.denomination, highVal - lowVal)
  applyDebt(lowName, highName, amount, "Difference Roll")
  announce(string.format("Difference Roll: %s (%d) pays %s (%d) %s.", lowName, lowVal, highName, highVal, formatMoney(amount)))
  casino.session = nil
end

local function resolvePot()
  local session = casino.session
  local highVal
  local highNames = {}
  for name, val in pairs(session.rolls) do
    if not highVal or val > highVal then
      highVal, highNames = val, { name }
    elseif val == highVal then
      table.insert(highNames, name)
    end
  end
  if #highNames > 1 then
    announce(string.format("Pot Sweepstakes: tie at %d between %s - roll-off! /roll 100", highVal, table.concat(highNames, ", ")))
    session.participants = {}
    for _, name in ipairs(highNames) do session.participants[name] = true end
    session.rolls = {}
    session.phase = "ROLLING"
    session.maxRoll = 100
    return
  end
  local winner = highNames[1]
  local cut = math.floor(session.pot * db.guildCut)
  local payout = session.pot - cut
  db.vault = db.vault + cut
  -- The host is the presumed real-world collector of everyone's entry fee,
  -- so the payout is recorded as a debt from host to winner unless the host
  -- won their own pot, in which case they already hold the money.
  if winner == session.host then
    local ledger = ensureLedger(winner)
    ledger.won = ledger.won + payout
    pushHistory(winner, { at = ns.now(), type = "WIN", amount = payout, counterparty = "Pot", reason = "Pot Sweepstakes" })
    sendCasino(string.format("HOUSE|%s|%d|WIN|%s", winner, payout, "Pot Sweepstakes"))
  else
    applyDebt(session.host, winner, payout, "Pot Sweepstakes")
  end
  announce(string.format("Pot Sweepstakes: %s wins %s (guild cut %d%%: %s)!", winner, formatMoney(payout), math.floor(db.guildCut * 100), formatMoney(cut)))
  casino.session = nil
end

local function resolveDeathroll()
  local session = casino.session
  local lowVal
  for _, val in pairs(session.rolls) do
    if not lowVal or val < lowVal then lowVal = val end
  end
  local lowNames = {}
  for name, val in pairs(session.rolls) do
    if val == lowVal then table.insert(lowNames, name) end
  end
  -- A multi-way tie at the floor value would otherwise deadlock the game
  -- (everyone would keep re-rolling an ever-shrinking max forever); break it
  -- by eliminating exactly one of the tied players at random each round.
  local lowName = lowNames[math.random(#lowNames)]
  if #lowNames > 1 then
    announce(string.format("Elimination Deathroll: %d players tied at the lowest roll (%d) - %s is eliminated by random tie-break.", #lowNames, lowVal, lowName))
  end
  table.insert(session.eliminated, lowName)
  session.participants[lowName] = nil
  announce(string.format("Elimination Deathroll: %s rolled the lowest (%d) and is eliminated!", lowName, lowVal))

  local remaining = countKeys(session.participants)
  if remaining <= 1 then
    local survivor
    for name in pairs(session.participants) do survivor = name end
    if not survivor then
      announce("Elimination Deathroll: no survivor could be determined. No payouts.")
    else
      for _, loser in ipairs(session.eliminated) do
        applyDebt(loser, survivor, session.wager, "Elimination Deathroll")
      end
      announce(string.format("Elimination Deathroll: %s is the last survivor and wins %s from each of %d player(s)!",
        survivor, formatMoney(session.wager), #session.eliminated))
    end
    casino.session = nil
    return
  end

  session.maxRoll = lowVal
  session.rolls = {}
  session.phase = "ROLLING"
  session.round = session.round + 1
  announce(string.format("Round %d: %d players remain. Roll now! /roll %d", session.round, remaining, lowVal))
end

local function resolveSession()
  local session = casino.session
  if session.game == "DIFF" then resolveDiff()
  elseif session.game == "POT" then resolvePot()
  elseif session.game == "DEATHROLL" then resolveDeathroll()
  end
end

local function handleSessionRoll(name, value, minValue, maxValue)
  local session = casino.session
  if not session or session.phase ~= "ROLLING" then return end
  if not session.participants[name] then return end
  if maxValue ~= session.maxRoll or minValue ~= (session.game == "DEATHROLL" and 1 or 1) then return end
  if session.rolls[name] then return end
  session.rolls[name] = value
  if countKeys(session.rolls) >= countKeys(session.participants) then
    resolveSession()
  end
end

-- ---------------------------------------------------------------------
-- Solo house games: Blackjack, Over/Under 50, Goblin Roulette
-- ---------------------------------------------------------------------

local function cardLabel(roll)
  if roll == 1 then return "Ace" end
  if roll == 11 then return "Jack" end
  if roll == 12 then return "Queen" end
  if roll == 13 then return "King" end
  return tostring(roll)
end

-- Returns (value, isAce). Aces count as 11 initially; handTotal() downgrades
-- them to 1 as needed to avoid busting, same as real blackjack.
local function cardValue(roll)
  if roll == 1 then return 11, true end
  if roll >= 11 then return 10, false end
  return roll, false
end

local function handTotal(cards)
  local total, aces = 0, 0
  for _, card in ipairs(cards) do
    local value, isAce = cardValue(card)
    total = total + value
    if isAce then aces = aces + 1 end
  end
  while total > 21 and aces > 0 do
    total = total - 10
    aces = aces - 1
  end
  return total
end

local function startBlackjack(args)
  if guardCombat() then return end
  local name = ns.playerName()
  if casino.blackjackHands[name] then
    ns.message("You already have an active blackjack hand. Roll /roll 13 to hit, or /qg casino stand."); return
  end
  local amount = parseAmount("gold", args[1])
  if not amount then ns.message("Usage: /qg casino blackjack <goldWager>"); return end
  casino.blackjackHands[name] = { wager = amount, playerCards = {}, dealerCards = { math.random(1, 13) }, phase = "PLAYER" }
  ns.message(string.format("Blackjack started, wager %s. Roll /roll 13 to draw your first card.", formatMoney(amount)))
end

local function handleBlackjackRoll(name, value)
  local hand = casino.blackjackHands[name]
  if not hand or hand.phase ~= "PLAYER" then return end
  table.insert(hand.playerCards, value)
  local total = handTotal(hand.playerCards)
  if total > 21 then
    applyHouseResult(name, hand.wager, false, "Blackjack bust")
    ns.message(string.format("You drew a %s - bust at %d! You lose %s.", cardLabel(value), total, formatMoney(hand.wager)))
    casino.blackjackHands[name] = nil
    return
  end
  ns.message(string.format("You drew a %s (total %d). Roll /roll 13 to hit again, or /qg casino stand.", cardLabel(value), total))
end

local function blackjackStand()
  local name = ns.playerName()
  local hand = casino.blackjackHands[name]
  if not hand or hand.phase ~= "PLAYER" then ns.message("You have no active blackjack hand."); return end
  hand.phase = "DEALER"
  -- The dealer has no addon to /roll with, so its draws are simulated
  -- locally via math.random using the same 1-13 card mapping, following
  -- standard house rules: hit on 16, stand on 17.
  while handTotal(hand.dealerCards) < 17 do
    table.insert(hand.dealerCards, math.random(1, 13))
  end
  local playerTotal = handTotal(hand.playerCards)
  local dealerTotal = handTotal(hand.dealerCards)
  if dealerTotal > 21 or playerTotal > dealerTotal then
    applyHouseResult(name, hand.wager, true, "Blackjack win")
    ns.message(string.format("Dealer has %d. You win with %d! You win %s.", dealerTotal, playerTotal, formatMoney(hand.wager)))
  elseif playerTotal < dealerTotal then
    applyHouseResult(name, hand.wager, false, "Blackjack loss")
    ns.message(string.format("Dealer has %d, beating your %d. You lose %s.", dealerTotal, playerTotal, formatMoney(hand.wager)))
  else
    ns.message(string.format("Push! Both you and the dealer have %d. No change.", playerTotal))
  end
  casino.blackjackHands[name] = nil
end

local function startOverUnder(args)
  if guardCombat() then return end
  local name = ns.playerName()
  if casino.pendingSolo[name] then ns.message("You already have a pending casino bet."); return end
  local choice = string.lower(args[1] or "")
  if choice ~= "over" and choice ~= "under" then
    ns.message("Usage: /qg casino overunder <over|under> <goldWager>"); return
  end
  local amount = parseAmount("gold", args[2])
  if not amount then ns.message("Usage: /qg casino overunder <over|under> <goldWager>"); return end
  casino.pendingSolo[name] = { kind = "OVERUNDER", choice = choice, wager = amount }
  ns.message(string.format("Over/Under 50 - bet %s on %s. Roll /roll 100 now.", formatMoney(amount), choice))
end

local function handleOverUnderRoll(name, value)
  local bet = casino.pendingSolo[name]
  casino.pendingSolo[name] = nil
  if value == 50 then
    applyHouseResult(name, bet.wager, false, "Over/Under 50 - exact 50, house edge")
    ns.message(string.format("Rolled exactly 50 - house edge! You lose %s to the guild vault.", formatMoney(bet.wager)))
    return
  end
  local won = (value > 50 and bet.choice == "over") or (value < 50 and bet.choice == "under")
  applyHouseResult(name, bet.wager, won, "Over/Under 50")
  if won then
    ns.message(string.format("Rolled %d - you win %s!", value, formatMoney(bet.wager)))
  else
    ns.message(string.format("Rolled %d - you lose %s.", value, formatMoney(bet.wager)))
  end
end

local ROULETTE_RED = {
  [1] = true, [3] = true, [5] = true, [7] = true, [9] = true, [12] = true, [14] = true, [16] = true, [18] = true,
  [19] = true, [21] = true, [23] = true, [25] = true, [27] = true, [30] = true, [32] = true, [34] = true, [36] = true
}

local function rouletteColor(number)
  if number == 37 or number == 38 then return "GREEN" end
  return ROULETTE_RED[number] and "RED" or "BLACK"
end

local function startRoulette(args)
  if guardCombat() then return end
  local name = ns.playerName()
  if casino.pendingSolo[name] then ns.message("You already have a pending casino bet."); return end
  local betType = string.lower(args[1] or "")
  local number, wagerRaw
  if betType == "straight" then
    number = tonumber(args[2])
    wagerRaw = args[3]
    if not number or number < 1 or number > 36 then
      ns.message("Usage: /qg casino roulette straight <1-36> <goldWager>"); return
    end
  elseif betType == "red" or betType == "black" or betType == "even" or betType == "odd" then
    wagerRaw = args[2]
  else
    ns.message("Usage: /qg casino roulette <straight <1-36>|red|black|even|odd> <goldWager>"); return
  end
  local amount = parseAmount("gold", wagerRaw)
  if not amount then ns.message("Invalid wager."); return end
  casino.pendingSolo[name] = { kind = "ROULETTE", betType = betType, number = number, wager = amount }
  local label = betType == "straight" and ("straight on " .. number) or betType
  ns.message(string.format("Goblin Roulette - %s bet %s. Roll /roll 38 now.", label, formatMoney(amount)))
end

local function handleRouletteRoll(name, value)
  local bet = casino.pendingSolo[name]
  casino.pendingSolo[name] = nil
  local color = rouletteColor(value)
  local label = value == 37 and "0" or (value == 38 and "00" or tostring(value))
  local won, payout
  if bet.betType == "straight" then
    won = (value == bet.number)
    payout = bet.wager * 35
  elseif bet.betType == "red" or bet.betType == "black" then
    won = (color == string.upper(bet.betType))
    payout = bet.wager
  else -- even / odd; 0 and 00 are neither and always lose
    won = color ~= "GREEN" and ((bet.betType == "even") == (value % 2 == 0))
    payout = bet.wager
  end
  if won then
    applyHouseResult(name, payout, true, "Goblin Roulette win")
    ns.message(string.format("Ball lands on %s (%s)! You win %s!", label, color, formatMoney(payout)))
  else
    applyHouseResult(name, bet.wager, false, "Goblin Roulette loss")
    ns.message(string.format("Ball lands on %s (%s). You lose %s.", label, color, formatMoney(bet.wager)))
  end
end

-- ---------------------------------------------------------------------
-- Ledger / debt commands
-- ---------------------------------------------------------------------

local function showLedger(args)
  local target = args[1] or ns.playerName()
  local ledger = db.ledger[target]
  if not ledger then
    ns.message(target .. " has no casino history. Guild vault balance: " .. formatMoney(db.vault))
    return
  end
  ns.message(string.format("%s - Won: %s | Lost: %s | Net: %s", target, formatMoney(ledger.won), formatMoney(ledger.lost), formatMoney(ledger.won - ledger.lost)))
  local any = false
  for owedTo, amount in pairs(ledger.debts) do
    if amount and amount > 0 then
      ns.message(string.format("  Owes %s: %s", owedTo, formatMoney(amount)))
      any = true
    end
  end
  if not any then ns.message("  No outstanding debts.") end
  ns.message("Guild vault balance: " .. formatMoney(db.vault))
end

local function clearDebt(debtor, creditor)
  creditor = creditor or ns.playerName()
  if not debtor then ns.message("Usage: /qg casino debt clear <player> [owed-to, default you]"); return end
  local ledger = db.ledger[debtor]
  local amount = ledger and ledger.debts[creditor]
  if not amount or amount <= 0 then
    ns.message(debtor .. " owes " .. creditor .. " nothing on record."); return
  end
  if creditor ~= ns.playerName() and not ns.isOfficer() then
    ns.message("Only the creditor or an officer can clear this debt."); return
  end
  ledger.debts[creditor] = 0
  pushHistory(debtor, { at = ns.now(), type = "SETTLED", amount = amount, counterparty = creditor, reason = "Debt cleared" })
  sendCasino(string.format("CLEAR|%s|%s|%d", debtor, creditor, amount))
  ns.message(string.format("Cleared %s's debt of %s to %s.", debtor, formatMoney(amount), creditor))
end

-- ---------------------------------------------------------------------
-- Command router (registered into Core.lua's extension point)
-- ---------------------------------------------------------------------

local function casinoCommand(args)
  local action = string.lower(args[1] or "")
  table.remove(args, 1)
  if action == "diff" then startDiff(args)
  elseif action == "pot" then startPot(args)
  elseif action == "deathroll" then startDeathroll(args)
  elseif action == "blackjack" then startBlackjack(args)
  elseif action == "overunder" then startOverUnder(args)
  elseif action == "roulette" then startRoulette(args)
  elseif action == "join" then joinSession()
  elseif action == "roll" then beginRolling()
  elseif action == "cancel" then cancelSession()
  elseif action == "hit" then ns.message("Roll /roll 13 to hit.")
  elseif action == "stand" then blackjackStand()
  elseif action == "ledger" then showLedger(args)
  elseif action == "debt" then
    if string.lower(args[1] or "") == "clear" then clearDebt(args[2], args[3])
    else ns.message("Usage: /qg casino debt clear <player> [owed-to]") end
  else
    ns.message("/qg casino diff <gold|silver> <maxWager> | pot <entryFee> | deathroll <wager> | blackjack <wager>")
    ns.message("/qg casino overunder <over|under> <wager> | roulette <straight N|red|black|even|odd> <wager>")
    ns.message("/qg casino join | roll | cancel | stand | ledger [player] | debt clear <player> [owed-to]")
  end
end

ns.commandHandlers = ns.commandHandlers or {}
ns.commandHandlers["casino"] = casinoCommand
ns.commandHelp = ns.commandHelp or {}
table.insert(ns.commandHelp, "/qg casino diff|pot|deathroll|blackjack|overunder|roulette|join|roll|cancel|stand|ledger|debt")

-- ---------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------

local frame = CreateFrame("Frame")
frame:RegisterEvent("PLAYER_LOGIN")
frame:RegisterEvent("PLAYER_REGEN_DISABLED")
frame:RegisterEvent("PLAYER_REGEN_ENABLED")
frame:RegisterEvent("CHAT_MSG_SYSTEM")
frame:RegisterEvent("CHAT_MSG_ADDON")

frame:SetScript("OnEvent", function(_, event, ...)
  if event == "PLAYER_LOGIN" then
    ensureDb()
    registerPrefix()
  elseif event == "PLAYER_REGEN_DISABLED" then
    -- Freezes all new game starts/joins/rolls until combat ends; see
    -- guardCombat(). There's no visible UI window to hide (this module is
    -- chat/slash-command driven), so "disabling casino UI" manifests as
    -- blocking these actions rather than hiding a frame.
    combatLocked = true
  elseif event == "PLAYER_REGEN_ENABLED" then
    combatLocked = false
  elseif event == "CHAT_MSG_SYSTEM" then
    local text = ...
    local roller, value, minValue, maxValue = parseRoll(text)
    if not roller then return end
    if casino.session and ns.playerName() == casino.session.host then
      handleSessionRoll(roller, value, minValue, maxValue)
    end
    if roller == ns.playerName() then
      if minValue == 1 and maxValue == 13 then handleBlackjackRoll(roller, value)
      elseif minValue == 1 and maxValue == 100 and casino.pendingSolo[roller] and casino.pendingSolo[roller].kind == "OVERUNDER" then
        handleOverUnderRoll(roller, value)
      elseif minValue == 1 and maxValue == 38 and casino.pendingSolo[roller] and casino.pendingSolo[roller].kind == "ROULETTE" then
        handleRouletteRoll(roller, value)
      end
    end
  elseif event == "CHAT_MSG_ADDON" then
    local prefix, text, _, sender = ...
    if prefix ~= CASINO_PREFIX or sender == ns.playerName() then return end
    local kind = string.match(text, "^(%u+)|")
    if kind == "DEBT" then
      local _, payer, payee, amount = string.match(text, "^(%u+)|([^|]+)|([^|]+)|(%d+)|")
      if payer then applyMirroredDebt(payer, payee, tonumber(amount)) end
    elseif kind == "HOUSE" then
      local _, name, amount, result = string.match(text, "^(%u+)|([^|]+)|(%d+)|([^|]+)|")
      if name then applyMirroredHouse(name, tonumber(amount), result) end
    elseif kind == "CLEAR" then
      local _, debtor, creditor, amount = string.match(text, "^(%u+)|([^|]+)|([^|]+)|(%d+)$")
      if debtor then
        local ledger = ensureLedger(debtor)
        ledger.debts[creditor] = math.max(0, (ledger.debts[creditor] or 0) - (tonumber(amount) or 0))
      end
    end
  end
end)
