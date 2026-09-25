-- Guild-wide sync that isn't raid data:
--
-- 1. Version check. Every client says its addon version to the guild at
--    login; anyone running an older build is told a newer one exists.
--
-- 2. EPGP standings from the Discord bot. The officer PC's companion writes
--    Standings.lua (global QuebecGoldStandings) into this addon folder. A
--    client that has fresher standings than its saved copy adopts them and
--    shares them with the guild in small chunks, so members who don't run
--    the companion still get /qg standings. Only standings sent by an
--    officer are accepted.
local addonName, ns = ...
ns = ns or {}

local PREFIX = "QuebecGoldSync"
local CHUNK_BYTES = 220
local STARTUP_DELAY_SECONDS = 20
local SHARE_COOLDOWN_SECONDS = 60

local myVersion = "0"
local warnedNewer = false
local repliedTo = {}
local lastShareAt = 0
local incoming -- { updatedAt, total, parts = { [i] = text } }

local function getMetadata(field)
  if C_AddOns and C_AddOns.GetAddOnMetadata then return C_AddOns.GetAddOnMetadata(addonName, field) end
  if GetAddOnMetadata then return GetAddOnMetadata(addonName, field) end
  return nil
end

-- "1.10.0" > "1.9.2": compare each number, not the text.
local function versionNewer(a, b)
  local pa, pb = {}, {}
  for n in string.gmatch(a or "", "%d+") do table.insert(pa, tonumber(n)) end
  for n in string.gmatch(b or "", "%d+") do table.insert(pb, tonumber(n)) end
  for i = 1, math.max(#pa, #pb) do
    local x, y = pa[i] or 0, pb[i] or 0
    if x ~= y then return x > y end
  end
  return false
end

local function send(text, channel, target)
  pcall(function()
    if C_ChatInfo and C_ChatInfo.SendAddonMessage then
      C_ChatInfo.SendAddonMessage(PREFIX, text, channel, target)
    elseif SendAddonMessage then
      SendAddonMessage(PREFIX, text, channel, target)
    end
  end)
end

local function db()
  return ns.getDb and ns.getDb()
end

local function standings()
  local d = db()
  return d and d.standings
end

-- Normalized lookup: name -> { ep, gp, pr }
local function lookup(name)
  local s = standings()
  name = ns.normalizeName(name)
  if not s or not name then return nil end
  return s.players[name]
end

local function after(seconds, fn)
  if C_Timer and C_Timer.After then C_Timer.After(seconds, fn) else fn() end
end

-- ---------------------------------------------------------------------
-- Standings sharing
-- ---------------------------------------------------------------------

-- PR = EP / (GP + base GP), the same rule the bot uses.
local function priority(ep, gp, baseGp)
  local denominator = gp + math.max(0, baseGp or 0)
  return denominator > 0 and ep / denominator or 0
end

local function encodePlayers(players)
  local entries = {}
  for name, row in pairs(players) do
    table.insert(entries, string.format("%s:%d:%d", name, row.ep or 0, row.gp or 0))
  end
  table.sort(entries)
  return entries
end

local function shareStandings()
  local s = standings()
  if not s or not s.updatedAt then return end
  if time() - lastShareAt < SHARE_COOLDOWN_SECONDS then return end
  lastShareAt = time()
  local chunks, current = {}, ""
  for _, entry in ipairs(encodePlayers(s.players)) do
    if current ~= "" and string.len(current) + string.len(entry) + 1 > CHUNK_BYTES then
      table.insert(chunks, current)
      current = ""
    end
    current = current == "" and entry or (current .. ";" .. entry)
  end
  if current ~= "" then table.insert(chunks, current) end
  -- One chunk per second stays well inside the client's addon-message throttle.
  for i, chunk in ipairs(chunks) do
    after(i - 1, function()
      send(string.format("STAND|%s|%d|%d|%d|%s", s.updatedAt, s.baseGp or 0, i, #chunks, chunk), "GUILD")
    end)
  end
end

local function receiveChunk(text, sender)
  local updatedAt, baseGp, index, total, payload = string.match(text, "^STAND|([^|]+)|(%d+)|(%d+)|(%d+)|(.*)$")
  index, total, baseGp = tonumber(index), tonumber(total), tonumber(baseGp)
  if not updatedAt or not index or not total or total < 1 or total > 50 then return end
  if not ns.isOfficerName(sender) then return end
  local s = standings()
  if s and s.updatedAt and s.updatedAt >= updatedAt then return end
  if not incoming or incoming.updatedAt ~= updatedAt then
    incoming = { updatedAt = updatedAt, baseGp = baseGp, total = total, parts = {}, received = 0 }
  end
  if not incoming.parts[index] then
    incoming.parts[index] = payload
    incoming.received = incoming.received + 1
  end
  if incoming.received < incoming.total then return end
  local players = {}
  for i = 1, incoming.total do
    for name, ep, gp in string.gmatch(incoming.parts[i] or "", "([^:;]+):(%-?%d+):(%-?%d+)") do
      ep, gp = tonumber(ep), tonumber(gp)
      players[name] = { ep = ep, gp = gp, pr = priority(ep, gp, incoming.baseGp) }
    end
  end
  local d = db()
  if d then d.standings = { updatedAt = updatedAt, baseGp = incoming.baseGp, players = players, from = sender } end
  incoming = nil
end

-- Adopt the companion-written Standings.lua if it is newer than the saved copy.
local function adoptFileStandings()
  local file = QuebecGoldStandings
  local d = db()
  if not d or type(file) ~= "table" or type(file.updatedAt) ~= "string" then return false end
  if d.standings and d.standings.updatedAt and d.standings.updatedAt >= file.updatedAt then return false end
  local players = {}
  local baseGp = tonumber(file.baseGp) or 0
  for _, row in ipairs(file.players or {}) do
    local name = ns.normalizeName(row.name)
    if name then
      local ep, gp = tonumber(row.ep) or 0, tonumber(row.gp) or 0
      players[name] = { ep = ep, gp = gp, pr = priority(ep, gp, baseGp) }
    end
  end
  d.standings = { updatedAt = file.updatedAt, baseGp = baseGp, players = players, from = "companion" }
  return true
end

-- ---------------------------------------------------------------------
-- /qg standings [player]
-- ---------------------------------------------------------------------

local function showStandings(args)
  local s = standings()
  if not s or not s.updatedAt then
    ns.message("No Discord standings yet. They arrive from an officer running the companion.")
    return
  end
  if args[1] then
    local row = lookup(args[1])
    if row then
      ns.message(string.format("%s: EP %d, GP %d, PR %.2f (Discord, %s)", ns.normalizeName(args[1]), row.ep, row.gp, row.pr, s.updatedAt))
    else
      ns.message(ns.normalizeName(args[1]) .. " has no Discord standings (character not linked with /character add?).")
    end
    return
  end
  local rows = {}
  for name, row in pairs(s.players) do table.insert(rows, { name = name, row = row }) end
  table.sort(rows, function(a, b) return a.row.pr > b.row.pr end)
  ns.message(string.format("EPGP standings from Discord (%s):", s.updatedAt))
  for i = 1, math.min(10, #rows) do
    local r = rows[i]
    ns.message(string.format("%d. %s  PR %.2f  (EP %d / GP %d)", i, r.name, r.row.pr, r.row.ep, r.row.gp))
  end
  if #rows > 10 then ns.message("/qg standings <player> for anyone else.") end
end

ns.commandHandlers = ns.commandHandlers or {}
ns.commandHandlers["standings"] = showStandings
ns.commandHandlers["version"] = function() ns.message("Quebec Gold version " .. myVersion .. ".") end
ns.getStanding = lookup
ns.getStandingsUpdatedAt = function()
  local s = standings()
  return s and s.updatedAt
end

-- ---------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------

local started = false

local function onEvent(_, event, ...)
  if event == "PLAYER_ENTERING_WORLD" then
    if started then return end
    started = true
    myVersion = getMetadata("Version") or "0"
    if C_ChatInfo and C_ChatInfo.RegisterAddonMessagePrefix then
      C_ChatInfo.RegisterAddonMessagePrefix(PREFIX)
    elseif RegisterAddonMessagePrefix then
      RegisterAddonMessagePrefix(PREFIX)
    end
    local adopted = adoptFileStandings()
    -- Wait for the guild channel to be ready before talking on it.
    after(STARTUP_DELAY_SECONDS, function()
      send("VERSION|" .. myVersion, "GUILD")
      local s = standings()
      send("STANDREQ|" .. ((s and s.updatedAt) or "0"), "GUILD")
      if adopted and ns.isOfficer() then shareStandings() end
    end)
  elseif event == "CHAT_MSG_ADDON" then
    local prefix, text, channel, sender = ...
    if ns.isSecret(prefix) or ns.isSecret(text) or ns.isSecret(sender) or prefix ~= PREFIX then return end
    sender = ns.normalizeName(sender)
    if not sender or sender == ns.playerName() then return end
    local kind = string.match(text, "^(%u+)|")
    if kind == "VERSION" then
      local theirs = string.match(text, "^VERSION|(.+)$")
      if versionNewer(theirs, myVersion) and not warnedNewer then
        warnedNewer = true
        ns.message("A newer Quebec Gold (" .. theirs .. ") is out - you have " .. myVersion .. ". Grab it from the guild's download link.")
      elseif versionNewer(myVersion, theirs) and channel == "GUILD" and not repliedTo[sender] then
        -- Tell the outdated player directly, once per session.
        repliedTo[sender] = true
        send("VERSION|" .. myVersion, "WHISPER", sender)
      end
    elseif kind == "STANDREQ" then
      local theirs = string.match(text, "^STANDREQ|(.+)$") or "0"
      local s = standings()
      if ns.isOfficer() and s and s.updatedAt and s.updatedAt > theirs then shareStandings() end
    elseif kind == "STAND" then
      receiveChunk(text, sender)
    end
  end
end

local frame = CreateFrame("Frame")
frame:RegisterEvent("PLAYER_ENTERING_WORLD")
frame:RegisterEvent("CHAT_MSG_ADDON")
frame:SetScript("OnEvent", function(...)
  local ok, err = pcall(onEvent, ...)
  if not ok then ns.message("Sync error: " .. tostring(err)) end
end)
