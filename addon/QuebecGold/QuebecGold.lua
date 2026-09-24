-- Quebec Gold is intentionally manual-first. Combat and loot events are hints, not proof.
local ADDON, QG = ...
QG = QG or {}
QuebecGold = QG

local PREFIX = "QuebecGold"
local DB_VERSION = 2
local db
local activeRaid

local function now()
  return date("!%Y-%m-%dT%H:%M:%SZ")
end

local function playerName()
  return UnitName("player") or "Unknown"
end

local function message(text)
  DEFAULT_CHAT_FRAME:AddMessage("|cffd4af37[QuebecGold]|r " .. tostring(text))
end

local function ensureDb()
  QuebecGoldDB = QuebecGoldDB or {}
  db = QuebecGoldDB
  db.version = DB_VERSION
  db.settings = db.settings or {
    officerRanks = { [0] = true, [1] = true },
    officers = {},
    announceChannel = "RAID",
    captureCombatHints = true,
    captureLoot = true
  }
  db.raids = db.raids or {}
  db.roster = db.roster or {}
  db.attendance = db.attendance or {}
  db.bosses = db.bosses or {}
  db.epgp = db.epgp or {}
  if db.dkp then
    for name, old in pairs(db.dkp) do
      db.epgp[name] = db.epgp[name] or { ep = 0, gp = 0, ledger = {} }
      for _, entry in pairs(old.ledger or {}) do
        table.insert(db.epgp[name].ledger, {
          epAmount = entry.amount, gpAmount = 0, type = "IMPORT",
          reason = "Legacy DKP: " .. tostring(entry.reason or "Imported"),
          at = entry.at, by = entry.by, raid = entry.raid
        })
      end
      db.epgp[name].ep = db.epgp[name].ep + (old.balance or 0)
    end
    db.dkp = nil
  end
  db.readiness = db.readiness or {}
  db.loot = db.loot or {}
  db.events = db.events or {}
  db.exports = db.exports or {}
end

local function logEvent(kind, payload)
  table.insert(db.events, {
    at = now(), kind = kind, player = playerName(), data = payload
  })
end

local function isOfficer()
  local name = playerName()
  if db.settings.officers[name] then return true end
  local _, _, rankIndex = GetGuildInfo("player")
  return rankIndex and db.settings.officerRanks[rankIndex] == true
end

local function requireOfficer()
  if not isOfficer() then
    message("Officer or guild-master rank is required for this command.")
    return false
  end
  return true
end

local function split(text)
  local result = {}
  for part in string.gmatch(text or "", "%S+") do table.insert(result, part) end
  return result
end

local function send(messageText, target)
  target = target or "RAID"
  if C_ChatInfo and C_ChatInfo.RegisterAddonMessagePrefix and C_ChatInfo.SendAddonMessage then
    C_ChatInfo.RegisterAddonMessagePrefix(PREFIX)
    C_ChatInfo.SendAddonMessage(PREFIX, messageText, target)
  elseif SendAddonMessage then
    if RegisterAddonMessagePrefix then RegisterAddonMessagePrefix(PREFIX) end
    SendAddonMessage(PREFIX, messageText, target)
  end
end

local function raidStart(title)
  activeRaid = {
    id = tostring(time()) .. "-" .. playerName(),
    title = title or "Raid",
    startedAt = now(), endedAt = nil, startedBy = playerName()
  }
  table.insert(db.raids, activeRaid)
  logEvent("RAID_START", { id = activeRaid.id, title = activeRaid.title })
  send("RAID_START|" .. activeRaid.id .. "|" .. activeRaid.title)
  message("Started raid: " .. activeRaid.title)
end

local function raidEnd()
  if not activeRaid then message("No active raid."); return end
  activeRaid.endedAt = now()
  logEvent("RAID_END", { id = activeRaid.id })
  send("RAID_END|" .. activeRaid.id)
  message("Ended raid: " .. activeRaid.title)
  activeRaid = nil
end

local function setAttendance(name, status)
  if not activeRaid then message("Start a raid first."); return end
  name = name or playerName()
  status = string.upper(status or "PRESENT")
  if status ~= "PRESENT" and status ~= "ABSENT" and status ~= "LATE" then
    message("Status must be PRESENT, ABSENT, or LATE."); return
  end
  db.attendance[activeRaid.id] = db.attendance[activeRaid.id] or {}
  db.attendance[activeRaid.id][name] = { status = status, at = now(), by = playerName() }
  db.roster[name] = db.roster[name] or { firstSeen = now() }
  logEvent("ATTENDANCE", { raid = activeRaid.id, name = name, status = status })
  send("ATTENDANCE|" .. activeRaid.id .. "|" .. name .. "|" .. status)
  message(name .. " marked " .. status .. ".")
end

local function bossKill(name)
  if not activeRaid then message("Start a raid first."); return end
  name = name or "Unknown boss"
  db.bosses[activeRaid.id] = db.bosses[activeRaid.id] or {}
  table.insert(db.bosses[activeRaid.id], { name = name, at = now(), by = playerName() })
  logEvent("BOSS_KILL", { raid = activeRaid.id, boss = name })
  send("BOSS_KILL|" .. activeRaid.id .. "|" .. name)
  message("Recorded boss kill: " .. name)
end

local function changeEpgp(name, amount, reason, kind, epAmount, gpAmount)
  amount = tonumber(amount)
  if not name or not amount or amount == 0 then
    message("Usage: /qg " .. string.lower(kind) .. " <player> <amount> <reason>"); return
  end
  if kind == "DEDUCTION" then amount = -math.abs(amount) else amount = math.abs(amount) end
  db.epgp[name] = db.epgp[name] or { ep = 0, gp = 0, ledger = {} }
  epAmount = epAmount or 0
  gpAmount = gpAmount or 0
  db.epgp[name].ep = db.epgp[name].ep + epAmount
  db.epgp[name].gp = db.epgp[name].gp + gpAmount
  table.insert(db.epgp[name].ledger, {
    epAmount = epAmount, gpAmount = gpAmount, type = kind, reason = reason or "Manual adjustment",
    at = now(), by = playerName(), raid = activeRaid and activeRaid.id
  })
  logEvent(kind, { name = name, epAmount = epAmount, gpAmount = gpAmount, reason = reason })
  send("EPGP|" .. name .. "|" .. epAmount .. "|" .. gpAmount .. "|" .. (reason or "Manual adjustment"))
  message(string.format("%s EP %d, GP %d (%s), PR %.3f.", name, db.epgp[name].ep,
    db.epgp[name].gp, reason or "Manual adjustment",
    db.epgp[name].gp > 0 and db.epgp[name].ep / db.epgp[name].gp or 0))
end

local function inspectReadiness()
  local snapshot = { character = playerName(), inspectedAt = now(), items = {}, consumables = {}, findings = {} }
  local slots = {
    { 1, "Head" }, { 3, "Shoulder" }, { 5, "Chest" }, { 6, "Waist" },
    { 7, "Legs" }, { 8, "Feet" }, { 9, "Wrist" }, { 10, "Hands" },
    { 16, "MainHand" }, { 17, "OffHand" }
  }
  local missing = 0
  for _, slot in ipairs(slots) do
    local link = GetInventoryItemLink("player", slot[1])
    local row = { slot = slot[2], itemName = link or "", itemId = link }
    if link then
      local current, maximum = GetInventoryItemDurability and GetInventoryItemDurability(slot[1])
      if current and maximum and maximum > 0 then row.durability = math.floor(current / maximum * 100) end
    else
      missing = missing + 1
      table.insert(snapshot.findings, { code = "MISSING_" .. string.upper(slot[2]), severity = "ERROR", message = "Missing " .. slot[2] .. " equipment." })
    end
    table.insert(snapshot.items, row)
  end
  if missing == 0 then
    table.insert(snapshot.findings, { code = "GEAR_PRESENT", severity = "INFO", message = "Required gear slots are populated." })
  end
  snapshot.status = #snapshot.findings == 0 and "READY" or missing > 0 and "NOT_READY" or "PARTIAL"
  db.readiness[playerName()] = snapshot
  logEvent("READINESS", snapshot)
  send("READINESS|" .. playerName() .. "|" .. snapshot.status)
  message("Readiness captured: " .. snapshot.status .. ".")
end

local function recordLoot(name, item, cost)
  if not name or not item then message("Usage: /qg loot <player> <item> [cost]"); return end
  local row = { player = name, item = item, cost = tonumber(cost) or 0,
    at = now(), by = playerName(), raid = activeRaid and activeRaid.id }
  table.insert(db.loot, row)
  logEvent("LOOT", row)
  send("LOOT|" .. name .. "|" .. item .. "|" .. row.cost)
  message("Recorded loot: " .. item .. " -> " .. name .. ".")
end

local function exportData()
  local key = now()
  db.exports[key] = {
    source = "QuebecGold", exportedAt = key, version = db.version,
    roster = db.roster, raids = db.raids, attendance = db.attendance,
    bosses = db.bosses, epgp = db.epgp, readiness = db.readiness, loot = db.loot, events = db.events
  }
  message("Export saved in QuebecGoldDB.exports[" .. key .. "]. Copy it from SavedVariables.")
end

local function showHelp()
  message("/qg start [title] | end | attendance <name> [status] | boss <name>")
  message("/qg award <name> <amount> [reason] | gp <name> <amount> [reason] | deduct <name> <amount> [reason]")
  message("/qg loot <name> <item> [cost] | inspect | export | status | roster")
end

local function command(text)
  local args = split(text)
  local action = string.lower(args[1] or "help")
  if action == "help" then showHelp(); return end
  if action == "status" then
    message(activeRaid and ("Active raid: " .. activeRaid.title) or "No active raid.")
    return
  end
  if action == "roster" then
    for name in pairs(db.roster) do message(name) end
    return
  end
  if action == "start" then if requireOfficer() then raidStart(table.concat(args, " ", 2)) end
  elseif action == "end" then if requireOfficer() then raidEnd() end
  elseif action == "attendance" then if requireOfficer() then setAttendance(args[2], args[3]) end
  elseif action == "boss" then if requireOfficer() then bossKill(table.concat(args, " ", 2)) end
  elseif action == "award" then if requireOfficer() then changeEpgp(args[2], args[3], table.concat(args, " ", 4), "EP_AWARD", math.abs(tonumber(args[3]) or 0), 0) end
  elseif action == "gp" then if requireOfficer() then changeEpgp(args[2], args[3], table.concat(args, " ", 4), "GP_AWARD", 0, math.abs(tonumber(args[3]) or 0)) end
  elseif action == "deduct" then if requireOfficer() then changeEpgp(args[2], args[3], table.concat(args, " ", 4), "ADJUSTMENT", -(math.abs(tonumber(args[3]) or 0)), 0) end
  elseif action == "loot" then if requireOfficer() then recordLoot(args[2], args[3], args[4]) end
  elseif action == "inspect" then inspectReadiness()
  elseif action == "export" then if requireOfficer() then exportData() end
  else showHelp() end
end

local function onEvent(_, event, ...)
  if event == "PLAYER_LOGIN" then
    ensureDb()
    message("Loaded. Automatic combat/loot capture is advisory; use officer commands.")
    if C_ChatInfo and C_ChatInfo.RegisterAddonMessagePrefix then
      C_ChatInfo.RegisterAddonMessagePrefix(PREFIX)
    elseif RegisterAddonMessagePrefix then
      RegisterAddonMessagePrefix(PREFIX)
    end
  elseif not db then
    ensureDb()
  elseif event == "GUILD_ROSTER_UPDATE" then
    local count = GetNumGuildMembers and GetNumGuildMembers() or 0
    db.lastRosterUpdate = now()
    for i = 1, count do
      local name = GetGuildRosterInfo(i)
      if name then db.roster[name] = db.roster[name] or { firstSeen = now() } end
    end
  elseif event == "CHAT_MSG_LOOT" and db.settings.captureLoot then
    logEvent("LOOT_HINT", { text = ... })
  elseif event == "COMBAT_LOG_EVENT_UNFILTERED" and db.settings.captureCombatHints then
    local timestamp, subEvent, _, sourceName, _, _, _, destName = ...
    if subEvent == "UNIT_DIED" or subEvent == "PARTY_KILL" then
      logEvent("COMBAT_HINT", { at = timestamp, event = subEvent, source = sourceName, target = destName })
    end
  elseif event == "CHAT_MSG_ADDON" then
    local prefix, text, channel, sender = ...
    if prefix == PREFIX and sender ~= playerName() then
      logEvent("ADDON_MESSAGE", { text = text, channel = channel, sender = sender })
    end
  end
end

local frame = CreateFrame("Frame")
frame:RegisterEvent("PLAYER_LOGIN")
frame:RegisterEvent("GUILD_ROSTER_UPDATE")
frame:RegisterEvent("CHAT_MSG_LOOT")
frame:RegisterEvent("COMBAT_LOG_EVENT_UNFILTERED")
frame:RegisterEvent("CHAT_MSG_ADDON")
frame:SetScript("OnEvent", onEvent)

SLASH_QUEBECCOLD1 = "/qg"
SlashCmdList["QUEBECCOLD"] = command
