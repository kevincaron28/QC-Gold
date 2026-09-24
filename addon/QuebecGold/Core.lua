-- Quebec Gold is intentionally manual-first. Combat and loot events are hints, not proof.
local addonName, ns = ...
ns = ns or {}
QuebecGold = ns

local PREFIX = "QuebecGold"
local DB_VERSION = 3
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
  db.attunements = db.attunements or {}
  -- Diagnostics: blocked-action reports (ADDON_ACTION_BLOCKED/FORBIDDEN,
  -- which name the exact function WoW refused to let an addon call) and
  -- captured Lua errors that mention this addon. See /qg diag.
  db.diagnostics = db.diagnostics or {}
  -- Roster digests broadcast by other guildmates' clients (gear/profession
  -- summary only, not full detail) so one officer's export can carry the
  -- whole online guild's readiness picture, not just their own.
  db.peerRoster = db.peerRoster or {}
  db.loot = db.loot or {}
  db.events = db.events or {}
  db.exports = db.exports or {}
end

local function logEvent(kind, payload)
  table.insert(db.events, {
    at = now(), kind = kind, player = playerName(), data = payload
  })
end

-- Records a diagnostic entry (blocked action or captured Lua error) so it
-- survives past the moment it happened -- the in-game popup for a blocked
-- action disappears without saying which function was blocked, and a
-- regular Lua error can scroll off before anyone reads it. /qg diag prints
-- the last few of these.
local function logDiagnostic(kind, detail)
  if not db then return end
  db.diagnostics = db.diagnostics or {}
  table.insert(db.diagnostics, { at = now(), kind = kind, detail = detail })
  while #db.diagnostics > 25 do table.remove(db.diagnostics, 1) end
  message("|cffff5555[Diagnostic]|r " .. kind .. ": " .. detail .. " (see /qg diag)")
end

-- Captures every Lua error while this diagnostic build is installed --
-- intentionally unfiltered for now (not just errors mentioning this addon),
-- since the ADDON_ACTION_BLOCKED/FORBIDDEN hook below caught nothing on a
-- reproduction that definitely happened, meaning either this isn't a taint
-- error at all or the real error text doesn't name this addon. Chains to
-- whatever error handler was already set so this never suppresses another
-- addon's own error reporting.
local previousErrorHandler = geterrorhandler and geterrorhandler()
if seterrorhandler then
  seterrorhandler(function(err)
    logDiagnostic("LUA_ERROR", tostring(err))
    if previousErrorHandler then return previousErrorHandler(err) end
  end)
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

local function collectProfessions()
  -- GetProfessions() returns up to 6 slot indices (some may be nil), so index
  -- by count rather than ipairs, which would stop at the first hole.
  local result = {}
  if not GetProfessions or not GetProfessionInfo then return result end
  local indices = { GetProfessions() }
  local count = select("#", GetProfessions())
  for i = 1, count do
    local index = indices[i]
    if index then
      local name, _, skillLevel = GetProfessionInfo(index)
      if name then table.insert(result, { name = name, skillLevel = skillLevel or 0 }) end
    end
  end
  return result
end

local function inspectReadiness(silent, target)
  local professions = collectProfessions()
  local snapshot = { character = playerName(), inspectedAt = now(), items = {}, consumables = {}, professions = professions, findings = {} }
  local slots = {
    { 1, "Head" }, { 3, "Shoulder" }, { 5, "Chest" }, { 6, "Waist" },
    { 7, "Legs" }, { 8, "Feet" }, { 9, "Wrist" }, { 10, "Hands" },
    { 16, "MainHand" }, { 17, "OffHand" }
  }
  local missing = 0
  local minDurability = 100
  for _, slot in ipairs(slots) do
    local link = GetInventoryItemLink("player", slot[1])
    if link then
      -- Item links look like |cAARRGGBB|Hitem:ID:...|h[Name]|h|r; pull the
      -- readable name and numeric id out instead of exporting the raw link.
      local itemName = string.match(link, "%[(.-)%]") or link
      local itemId = string.match(link, "item:(%d+)")
      local row = { slot = slot[2], itemName = itemName, itemId = itemId }
      local current, maximum = GetInventoryItemDurability and GetInventoryItemDurability(slot[1])
      if current and maximum and maximum > 0 then
        row.durability = math.floor(current / maximum * 100)
        if row.durability < minDurability then minDurability = row.durability end
      end
      table.insert(snapshot.items, row)
    elseif slot[2] == "OffHand" then
      -- Two-handed weapons (and some specs) legitimately leave OffHand empty;
      -- that can't be told apart from "forgot to equip" without deeper
      -- tooltip parsing, so treat it as a soft warning, not a hard failure.
      table.insert(snapshot.findings, { code = "MISSING_OFFHAND", severity = "WARNING", message = "No off-hand item equipped (expected when using a two-handed weapon)." })
    else
      missing = missing + 1
      table.insert(snapshot.findings, { code = "MISSING_" .. string.upper(slot[2]), severity = "ERROR", message = "Missing " .. slot[2] .. " equipment." })
    end
  end
  if missing == 0 then
    table.insert(snapshot.findings, { code = "GEAR_PRESENT", severity = "INFO", message = "Required gear slots are populated." })
  end
  snapshot.status = #snapshot.findings == 0 and "READY" or missing > 0 and "NOT_READY" or "PARTIAL"
  db.readiness[playerName()] = snapshot
  logEvent("READINESS", snapshot)

  local profParts = {}
  for _, profession in ipairs(professions) do
    table.insert(profParts, profession.name .. ":" .. profession.skillLevel)
  end
  -- Compact digest only (no item list/enchants/consumables) so this fits in
  -- a single addon message with no chunking. Broadcast to GUILD by default
  -- so it reaches everyone online, not just the current raid group.
  send(string.format("READINESS|%s|%s|%d|%d|%s", playerName(), snapshot.status, missing, minDurability, table.concat(profParts, ",")), target or "GUILD")
  if not silent then
    message("Readiness captured: " .. snapshot.status .. ".")
  end
end

local function setAttunement(name, key, completed)
  if not key then message("Usage: /qg attune <key> | /qg attune <player> <key> [clear]"); return end
  db.attunements[name] = db.attunements[name] or {}
  db.attunements[name][key] = { completed = completed, at = now(), by = playerName() }
  logEvent("ATTUNEMENT", { name = name, key = key, completed = completed })
  send("ATTUNEMENT|" .. name .. "|" .. key .. "|" .. tostring(completed))
  message(name .. " attunement " .. (completed and "completed" or "cleared") .. ": " .. key .. ".")
end

-- Automatic sync: re-run inspectReadiness (silently, broadcasting to GUILD)
-- on login, on gear changes, and when the raid roster changes, instead of
-- requiring everyone to run /qg inspect manually. Deliberately event-driven
-- only (no OnUpdate ticker): a per-frame polling script is one of the most
-- common sources of WoW's "taint" bugs, where code running outside a normal
-- event handler contaminates whatever the game engine runs immediately
-- after it, and an unrelated Blizzard UI action gets blocked and blamed on
-- this addon. Every trigger below fires from a real Blizzard event instead.
local lastAutoSyncAt = 0
local AUTO_SYNC_DEBOUNCE_SECONDS = 5
local AUTO_SYNC_RAID_INTERVAL_SECONDS = 600

local function inRaidGroup()
  if IsInRaid then return IsInRaid() end
  if GetNumRaidMembers then return GetNumRaidMembers() > 0 end
  return false
end

local function maybeAutoSync(minInterval)
  local nowTime = time()
  if (nowTime - lastAutoSyncAt) < minInterval then return end
  lastAutoSyncAt = nowTime
  inspectReadiness(true, "GUILD")
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
    bosses = db.bosses, epgp = db.epgp, readiness = db.readiness,
    attunements = db.attunements, peerRoster = db.peerRoster,
    diagnostics = db.diagnostics, loot = db.loot, events = db.events
  }
  message("Export saved in QuebecGoldDB.exports[" .. key .. "]. Copy it from SavedVariables.")
end

local function showHelp()
  message("/qg start [title] | end | attendance <name> [status] | boss <name>")
  message("/qg award <name> <amount> [reason] | gp <name> <amount> [reason] | deduct <name> <amount> [reason]")
  message("/qg loot <name> <item> [cost] | inspect | export | status | roster")
  message("/qg attune <key> [clear] | attune <player> <key> [clear]")
  message("/qg diag - show recent blocked-action reports and captured Lua errors")
  message("Readiness (gear/profession summary) auto-syncs to the guild on login, gear changes, and every 10 min while raiding.")
  if next(ns.commandHelp or {}) then
    for _, line in pairs(ns.commandHelp) do message(line) end
  end
end

-- Extension point for modules loaded after Core.lua (see Modules/Casino.lua):
-- ns.commandHandlers["casino"] = function(args) ... end registers /qg casino ...
-- ns.commandHelp["casino"] = "/qg casino ..." adds a line to /qg help.
ns.commandHandlers = ns.commandHandlers or {}
ns.commandHelp = ns.commandHelp or {}

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
  elseif action == "attune" then
    local completed = true
    local last = string.lower(args[#args] or "")
    if last == "false" or last == "clear" or last == "no" then
      completed = false
      table.remove(args, #args)
    end
    if args[3] then
      if requireOfficer() then setAttunement(args[2], args[3], completed) end
    else
      setAttunement(playerName(), args[2], completed)
    end
  elseif action == "inspect" then inspectReadiness()
  elseif action == "export" then if requireOfficer() then exportData() end
  elseif action == "diag" then
    local entries = db.diagnostics or {}
    if #entries == 0 then
      message("No diagnostics recorded this session.")
    else
      message(string.format("Last %d diagnostic(s):", math.min(5, #entries)))
      for i = math.max(1, #entries - 4), #entries do
        local entry = entries[i]
        message(entry.at .. " [" .. entry.kind .. "] " .. entry.detail)
      end
    end
  elseif ns.commandHandlers[action] then
    -- args[1] is the action itself; hand the module the remaining tokens.
    table.remove(args, 1)
    ns.commandHandlers[action](args)
  else showHelp() end
end

local function handlePeerReadiness(text, sender)
  local parts = {}
  for part in string.gmatch(text, "[^|]+") do table.insert(parts, part) end
  if parts[1] ~= "READINESS" or not parts[2] then return end
  db.peerRoster[parts[2]] = {
    status = parts[3] or "UNKNOWN",
    missing = tonumber(parts[4]) or 0,
    minDurability = tonumber(parts[5]) or 100,
    professions = parts[6] or "",
    updatedAt = now(),
    reportedBy = sender
  }
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
  elseif event == "PLAYER_ENTERING_WORLD" then
    maybeAutoSync(AUTO_SYNC_DEBOUNCE_SECONDS)
  elseif event == "UNIT_INVENTORY_CHANGED" then
    local unit = ...
    if unit == "player" then maybeAutoSync(AUTO_SYNC_DEBOUNCE_SECONDS) end
  elseif event == "GROUP_ROSTER_UPDATE" then
    if inRaidGroup() then maybeAutoSync(AUTO_SYNC_RAID_INTERVAL_SECONDS) end
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
      handlePeerReadiness(text, sender)
    end
  elseif event == "ADDON_ACTION_BLOCKED" or event == "ADDON_ACTION_FORBIDDEN" then
    -- Fires with the exact addon and function name WoW refused to let run --
    -- this is the precise diagnostic the "blocked from an action only
    -- available to the Blizzard UI" popup itself doesn't show you.
    local blockedAddon, blockedFunction = ...
    logDiagnostic(event, string.format("%s tried to call %s", tostring(blockedAddon), tostring(blockedFunction)))
  elseif event == "UI_ERROR_MESSAGE" then
    -- Fallback net in case the blocked-action popup surfaces as a generic UI
    -- error toast instead of ADDON_ACTION_BLOCKED/FORBIDDEN -- log it only
    -- when it looks relevant, since this event also fires constantly for
    -- ordinary gameplay ("not enough mana", etc.).
    local errorType, errorText = ...
    local text = tostring(errorText or errorType or "")
    if string.find(string.lower(text), "block") or string.find(string.lower(text), "forbidden") or string.find(string.lower(text), "addon") then
      logDiagnostic("UI_ERROR_MESSAGE", text)
    end
  end
end

local frame = CreateFrame("Frame")
frame:RegisterEvent("PLAYER_LOGIN")
frame:RegisterEvent("PLAYER_ENTERING_WORLD")
frame:RegisterEvent("UNIT_INVENTORY_CHANGED")
frame:RegisterEvent("GROUP_ROSTER_UPDATE")
frame:RegisterEvent("GUILD_ROSTER_UPDATE")
frame:RegisterEvent("CHAT_MSG_LOOT")
frame:RegisterEvent("COMBAT_LOG_EVENT_UNFILTERED")
frame:RegisterEvent("CHAT_MSG_ADDON")
frame:RegisterEvent("ADDON_ACTION_BLOCKED")
frame:RegisterEvent("ADDON_ACTION_FORBIDDEN")
frame:RegisterEvent("UI_ERROR_MESSAGE")
frame:SetScript("OnEvent", onEvent)

SLASH_QUEBECGOLD1 = "/qg"
SlashCmdList["QUEBECGOLD"] = command

-- Shared namespace API for modules (see Modules/Casino.lua).
ns.playerName = playerName
ns.now = now
ns.message = message
ns.send = send
ns.isOfficer = isOfficer
