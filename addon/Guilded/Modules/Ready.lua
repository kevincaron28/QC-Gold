-- Who is ready for the raid, and who is not.
--
-- For everyone in your raid or party it combines
--   * the readiness that each player's addon shared (gear, enchants, durability, flask, food),
--   * a live look at their buffs (flask or elixir, and food), which is fresher, and
--   * "no data" for players with no addon and hidden buffs.
-- The window's Ready page shows it; /guilded ready prints it. Officers can ask every
-- addon in the group to check itself again (a ready check) and post the result to raid chat.
--
-- Flask and food only count while you are in a raid group, like the gear check itself.
local addonName, ns = ...
ns = ns or {}

local module = {}
ns.ready = module

local STALE_SECONDS = 30 * 60
local ASK_COOLDOWN_SECONDS = 20
local MAX_POST_CHARS = 240

-- Worst first, so the page starts with what needs attention.
local ORDER = { NOT_READY = 1, PARTIAL = 2, NODATA = 3, READY = 4 }
module.ORDER = ORDER
module.LABEL = { NOT_READY = "Not ready", PARTIAL = "Issues", NODATA = "No data", READY = "Ready" }

local function L(text) return ns.L and ns.L(text) or text end
local function db() return ns.getDb and ns.getDb() end

-- ---------------------------------------------------------------------
-- Time: the addon keeps ISO timestamps ("2026-09-26T12:00:00Z"); this turns one into seconds.
-- ---------------------------------------------------------------------

local function daysFromCivil(y, m, d)
  if m <= 2 then y = y - 1 end
  local era = math.floor(y / 400)
  local yoe = y - era * 400
  local mp = (m + 9) % 12
  local doy = math.floor((153 * mp + 2) / 5) + d - 1
  local doe = yoe * 365 + math.floor(yoe / 4) - math.floor(yoe / 100) + doy
  return era * 146097 + doe - 719468
end

function module.epoch(iso)
  local y, mo, d, h, mi, s = string.match(iso or "", "^(%d+)-(%d+)-(%d+)T(%d+):(%d+):(%d+)Z$")
  if not y then return nil end
  return daysFromCivil(tonumber(y), tonumber(mo), tonumber(d)) * 86400 + tonumber(h) * 3600 + tonumber(mi) * 60 + tonumber(s)
end

local function nowEpoch()
  if GetServerTime then
    local ok, value = pcall(GetServerTime)
    if ok and type(value) == "number" then return value end
  end
  return time and time() or 0
end

-- ---------------------------------------------------------------------
-- What each player shared
-- ---------------------------------------------------------------------

-- The same shape as a guildmate's digest: { status, missing, minDurability, flags, at }.
local function ownEntry()
  local d = db()
  local snapshot = d and d.readiness and d.readiness[ns.playerName()]
  if not snapshot then return nil end
  local flags, missing, minDurability = {}, 0, 100
  local enchants
  for _, finding in ipairs(snapshot.findings or {}) do
    if finding.code == "NO_FLASK" then table.insert(flags, "NOFLASK")
    elseif finding.code == "NO_FOOD" then table.insert(flags, "NOFOOD")
    elseif finding.code == "MISSING_ENCHANTS" then
      enchants = string.match(finding.message or "", "Missing enchants: (.-)%.$") or ""
      table.insert(flags, "ENCH:" .. (string.gsub(enchants, ", ", "+")))
    elseif finding.code == "LOW_DURABILITY" then
      minDurability = tonumber(string.match(finding.message or "", "(%d+)%%")) or minDurability
    elseif finding.severity == "ERROR" then missing = missing + 1 end
  end
  return { status = snapshot.status, missing = missing, minDurability = minDurability, flags = table.concat(flags, ","), at = module.epoch(snapshot.inspectedAt) }
end

local function peerEntry(name)
  local d = db()
  local peer = d and d.peerRoster and d.peerRoster[name]
  if not peer then return nil end
  return {
    status = peer.status, missing = tonumber(peer.missing) or 0, minDurability = tonumber(peer.minDurability) or 100,
    flags = peer.flags or "", at = peer.seenAt or module.epoch(peer.updatedAt)
  }
end

-- ---------------------------------------------------------------------
-- The group
-- ---------------------------------------------------------------------

local function groupUnits()
  local units = {}
  local inRaid = IsInRaid and IsInRaid() or false
  local inGroup = inRaid or (IsInGroup and IsInGroup()) or false
  if inRaid then
    for i = 1, (GetNumGroupMembers and GetNumGroupMembers() or 0) do table.insert(units, "raid" .. i) end
  elseif inGroup then
    table.insert(units, "player")
    for i = 1, 4 do table.insert(units, "party" .. i) end
  else
    table.insert(units, "player")
  end
  return units, inRaid, inGroup
end

local function unitName(unit)
  local name = UnitName and UnitName(unit)
  if not name or (ns.isSecret and ns.isSecret(name)) then return nil end
  return ns.normalizeName and ns.normalizeName(name) or name
end

-- One player's row: { name, status, reasons = { text }, source, stale }.
function module.assess(name, unit, inRaid, entry, live, connected)
  local reasons, seen = {}, {}
  local problems = 0
  -- A problem makes the player "Issues"; a note (old data) is only shown.
  local function add(text, note)
    if seen[text] then return end
    seen[text] = true
    table.insert(reasons, text)
    if not note then problems = problems + 1 end
  end
  local row = { name = name, unit = unit, reasons = reasons, source = "none" }
  if connected == false then
    row.status = "NODATA"
    add(L("offline"), true)
    return row
  end
  local liveKnown = live and live.readable and inRaid
  local hardProblem = false
  if entry then
    row.source = "addon"
    if entry.status == "NOT_READY" then hardProblem = true end
    if (entry.missing or 0) > 0 then add(string.format(L("%d empty slot(s)"), entry.missing)) end
    for flag in string.gmatch(entry.flags or "", "[^,]+") do
      -- Fresh buffs from the live look replace what the addon shared earlier.
      if flag == "NOFLASK" and not liveKnown then add(L("no flask"))
      elseif flag == "NOFOOD" and not liveKnown then add(L("no food"))
      else
        local slots = string.match(flag, "^ENCH:(.*)$")
        if slots and slots ~= "" then add(L("no enchant") .. ": " .. (string.gsub(slots, "%+", ", "))) end
      end
    end
    if (entry.minDurability or 100) < 20 then add(string.format(L("durability %d%%"), entry.minDurability)) end
  end
  if liveKnown then
    row.source = entry and "addon+live" or "live"
    local consumables = ns.consumables
    if consumables and consumables.hasElixirOrFlask and not consumables.hasElixirOrFlask(live) then add(L("no flask")) end
    if not live.food then add(L("no food")) end
  end
  -- Old data is only a note, shown last.
  if entry and entry.at and nowEpoch() - entry.at > STALE_SECONDS then
    row.stale = true
    add(string.format(L("data %d min old"), math.floor((nowEpoch() - entry.at) / 60)), true)
  end
  if hardProblem or (entry and (entry.missing or 0) > 0) then row.status = "NOT_READY"
  elseif problems > 0 then row.status = "PARTIAL"
  elseif entry or liveKnown then row.status = "READY"
  else
    row.status = "NODATA"
    add(L("no addon data"), true)
  end
  return row
end

-- Everyone in the group, worst first.
function module.collect()
  local units, inRaid, inGroup = groupUnits()
  local rows, counts, seen = {}, { NOT_READY = 0, PARTIAL = 0, NODATA = 0, READY = 0 }, {}
  local me = ns.playerName and ns.playerName()
  for _, unit in ipairs(units) do
    if unit == "player" or not UnitExists or UnitExists(unit) then
      local name = unitName(unit)
      if name and not seen[name] then
        seen[name] = true
        local entry = (name == me) and ownEntry() or peerEntry(name)
        local live
        if ns.consumables and ns.consumables.scanUnit then
          local ok, result = pcall(ns.consumables.scanUnit, unit)
          if ok then live = result end
        end
        local connected = (unit == "player") or not UnitIsConnected or UnitIsConnected(unit)
        local row = module.assess(name, unit, inRaid, entry, live, connected)
        table.insert(rows, row)
        counts[row.status] = counts[row.status] + 1
      end
    end
  end
  table.sort(rows, function(a, b)
    if a.status ~= b.status then return ORDER[a.status] < ORDER[b.status] end
    return a.name < b.name
  end)
  return { rows = rows, counts = counts, inRaid = inRaid, inGroup = inGroup, total = #rows }
end

function module.summary(result)
  local c = result.counts
  return string.format(L("%d ready, %d with issues, %d not ready, %d no data"), c.READY, c.PARTIAL, c.NOT_READY, c.NODATA)
end

-- ---------------------------------------------------------------------
-- Ready check: ask every addon in the group to look at itself again
-- ---------------------------------------------------------------------

local lastAskAt = 0

function module.groupChannel()
  if IsInRaid and IsInRaid() then return "RAID" end
  if IsInGroup and IsInGroup() then return "PARTY" end
  return nil
end

function module.ask()
  local channel = module.groupChannel()
  if not channel then
    ns.message(L("Join a raid or party first."))
    return false
  end
  local now = nowEpoch()
  if now - lastAskAt < ASK_COOLDOWN_SECONDS then
    ns.message(string.format(L("Just asked; wait %d seconds."), ASK_COOLDOWN_SECONDS - (now - lastAskAt)))
    return false
  end
  lastAskAt = now
  if ns.send then ns.send("READYREQ|" .. now, channel) end
  ns.message(L("Ready check sent. Addons answer within a few seconds; the Ready page updates by itself."))
  return true
end

-- The result as raid or party chat lines: the summary, then who has a problem.
function module.postLines(result)
  local lines = { "[Guilded] " .. module.summary(result) }
  local current = ""
  for _, row in ipairs(result.rows) do
    if row.status == "NOT_READY" or row.status == "PARTIAL" then
      local piece = row.name .. " (" .. table.concat(row.reasons, ", ") .. ")"
      local candidate = current == "" and piece or (current .. "; " .. piece)
      if current ~= "" and #candidate + 12 > MAX_POST_CHARS then
        table.insert(lines, "[Guilded] " .. current)
        current = piece
      else
        current = candidate
      end
    end
  end
  if current ~= "" then table.insert(lines, "[Guilded] " .. current) end
  return lines
end

function module.post()
  if ns.isOfficer and not ns.isOfficer() then
    ns.message(L("Only officers post the ready check to the group."))
    return
  end
  local channel = module.groupChannel()
  if not channel then ns.message(L("Join a raid or party first.")) return end
  for _, line in ipairs(module.postLines(module.collect())) do
    pcall(function()
      if C_ChatInfo and C_ChatInfo.SendChatMessage then C_ChatInfo.SendChatMessage(line, channel)
      elseif SendChatMessage then SendChatMessage(line, channel) end
    end)
  end
end

-- ---------------------------------------------------------------------
-- /guilded ready [ask | post]
-- ---------------------------------------------------------------------

ns.commandHandlers = ns.commandHandlers or {}
ns.commandHandlers["ready"] = function(args)
  local action = string.lower(args[1] or "")
  if action == "ask" or action == "check" then module.ask() return end
  if action == "post" then module.post() return end
  local result = module.collect()
  ns.message((result.inGroup and "" or (L("Not in a group: showing only you.") .. " ")) .. module.summary(result))
  local shown = 0
  for _, row in ipairs(result.rows) do
    if row.status ~= "READY" and shown < 12 then
      shown = shown + 1
      ns.message(string.format("  %s: %s%s", row.name, L(module.LABEL[row.status]), #row.reasons > 0 and (" - " .. table.concat(row.reasons, ", ")) or ""))
    end
  end
end
ns.commandHelp = ns.commandHelp or {}
table.insert(ns.commandHelp, "/guilded ready [ask|post] - who in your group is ready (ask = ask every addon to re-check, post = officers: tell the group)")
