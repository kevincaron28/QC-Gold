-- Test raid for officers: WoW Forever has no raids yet, so this plays a
-- fake one through the real addon commands (start, attendance, boss kills,
-- loot, end) with made-up raiders. The names match the bot's /testraid, so
-- exporting this raid and running the companion lines up with a Discord
-- test raid started around the same time.
--
-- Everything is marked test = true and /qg sim clear removes it, including
-- any EP/GP it recorded, so it never reaches a real export by accident.
local addonName, ns = ...
ns = ns or {}

local SIM_NAMES = { "Testalpha", "Testbravo", "Testcharlie", "Testdelta", "Testecho", "Testfoxtrot",
  "Testgolf", "Testhotel", "Testindia", "Testjuliet" }
local SIM_BOSSES = { "Test Boss One", "Test Boss Two", "Test Boss Three" }
ns.SIM_NAMES = SIM_NAMES

local function db() return ns.getDb and ns.getDb() end

local function simStart()
  local raid = ns.getActiveRaid and ns.getActiveRaid()
  if raid then ns.message("A raid is already active (" .. raid.title .. "). /qg end it first."); return end
  ns.runCommand("start [TEST] Simulated raid")
  raid = ns.getActiveRaid()
  if not raid then return end
  raid.test = true
  -- Everyone "was in the group" except Testindia (the no-show).
  local d = db()
  d.presence[raid.id] = d.presence[raid.id] or {}
  for _, name in ipairs(SIM_NAMES) do
    if name ~= "Testindia" then d.presence[raid.id][name] = { firstSeen = ns.now(), lastSeen = ns.now(), test = true } end
  end
  ns.runCommand("attendance Testbravo LATE")
  ns.message("Test raid started with " .. (#SIM_NAMES - 1) .. " fake raiders in the group. Try the Raid and EPGP tabs, then /qg sim end.")
end

local function simEnd()
  local raid = ns.getActiveRaid and ns.getActiveRaid()
  if not raid or not raid.test then ns.message("No test raid running. /qg sim start first."); return end
  for _, boss in ipairs(SIM_BOSSES) do ns.runCommand("boss " .. boss) end
  ns.runCommand("attendance seen")
  ns.runCommand("loot Testcharlie [Test Helm of Testing] 30")
  ns.runCommand("gp Testcharlie 30 Test Helm of Testing")
  ns.runCommand("end")
  ns.message("Test raid ended. /reload to save it; the companion will send it to Discord. /qg sim clear removes it.")
end

-- Removes every test raid and everything recorded during one.
local function simClear()
  local d = db()
  if not d then return end
  if ns.getActiveRaid and ns.getActiveRaid() and ns.getActiveRaid().test then ns.runCommand("end") end
  local testIds = {}
  for i = #d.raids, 1, -1 do
    local raid = d.raids[i]
    if raid.test then
      testIds[raid.id] = true
      table.remove(d.raids, i)
    end
  end
  local removedEntries = 0
  for id in pairs(testIds) do
    d.attendance[id] = nil
    d.presence[id] = nil
    d.bosses[id] = nil
  end
  for i = #d.loot, 1, -1 do
    if d.loot[i].raid and testIds[d.loot[i].raid] then table.remove(d.loot, i) end
  end
  for _, account in pairs(d.epgp) do
    for i = #account.ledger, 1, -1 do
      local entry = account.ledger[i]
      if entry.raid and testIds[entry.raid] then
        account.ep = account.ep - (entry.epAmount or 0)
        account.gp = account.gp - (entry.gpAmount or 0)
        table.remove(account.ledger, i)
        removedEntries = removedEntries + 1
      end
    end
  end
  -- Fake raiders with nothing left are dropped entirely.
  for _, name in ipairs(SIM_NAMES) do
    local account = d.epgp[name]
    if account and #account.ledger == 0 then d.epgp[name] = nil end
    d.roster[name] = nil
  end
  local count = 0
  for _ in pairs(testIds) do count = count + 1 end
  ns.message(string.format("Removed %d test raid(s) and %d EP/GP entr%s.", count, removedEntries, removedEntries == 1 and "y" or "ies"))
end

ns.simBidders = function() return SIM_NAMES end

ns.commandHandlers = ns.commandHandlers or {}
ns.commandHandlers["sim"] = function(args)
  if not ns.isOfficer() then ns.message("Only officers can run test raids."); return end
  local action = string.lower(args[1] or "")
  if action == "start" then simStart()
  elseif action == "end" then simEnd()
  elseif action == "clear" then simClear()
  elseif action == "bids" then
    if ns.simulateBids then ns.simulateBids() else ns.message("GP bidding is not loaded.") end
  else
    ns.message("/qg sim start | end | bids (fake bids on open bidding) | clear")
  end
end
ns.commandHelp = ns.commandHelp or {}
table.insert(ns.commandHelp, { officer = true, text = "/qg sim start|end|bids|clear - test raid with fake raiders" })
