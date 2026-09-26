-- Consumable scan: who has a flask/elixir and food up, before the pull.
--
--   /guilded consumes          scan everyone in your group and print who is missing what
--   /guilded consumes me       show your own active consumables
--
-- Reads buffs only (never uses or changes anything). Names are matched with
-- the plain-text patterns below, so a new flask or food works without an
-- update as long as its buff is called "Flask of ...", "Elixir of ...",
-- "Well Fed", and so on. Add more patterns to PATTERNS if a guild's
-- consumable has an unusual name. Weapon enchants (oils, stones) can only be
-- read for yourself.
--
-- The last group scan is saved in GuildedDB.consumeScan and rides along
-- in the next export, so the Discord bot can show it next to gear readiness.
local addonName, ns = ...
ns = ns or {}

-- Category -> lowercase name fragments (plain matches, no patterns).
local PATTERNS = {
  flask = { "flask of", "flask:", "phial of" },
  elixir = { "elixir of", "elixir:", "greater arcane elixir", "major troll's blood", "mageblood", "spirit of zanza", "juju " },
  food = { "well fed", "well-fed", "hearty well fed", "nightfin soup", "tender wolf steak", "smoked desert dumplings", "grilled squid", "sagefish delight" }
}

local MAX_AURAS = 60
local module = {}
ns.consumables = module

local function isSecret(value)
  return ns.isSecret and ns.isSecret(value)
end

-- Name of the buff at `index` on `unit`, or nil. Handles both the modern
-- aura API and the old UnitBuff, and skips secret values.
local function buffName(unit, index)
  if C_UnitAuras and C_UnitAuras.GetAuraDataByIndex then
    local ok, data = pcall(C_UnitAuras.GetAuraDataByIndex, unit, index, "HELPFUL")
    if ok and type(data) == "table" and not isSecret(data.name) then return data.name end
    if ok and data == nil then return nil end
  end
  if UnitBuff then
    local ok, name = pcall(UnitBuff, unit, index)
    if ok and type(name) == "string" and not isSecret(name) then return name end
  end
  return nil
end

local function classify(name)
  local lower = string.lower(name)
  for category, fragments in pairs(PATTERNS) do
    for _, fragment in ipairs(fragments) do
      if string.find(lower, fragment, 1, true) then return category end
    end
  end
  return nil
end
module.classify = classify

-- What consumables `unit` has active. Returns { flask=, elixirs={}, food=,
-- weapon=, readable= } (readable is false when the game hid the auras).
function module.scanUnit(unit)
  local result = { elixirs = {}, readable = false }
  for index = 1, MAX_AURAS do
    local name = buffName(unit, index)
    if not name then break end
    result.readable = true
    local category = classify(name)
    if category == "flask" then result.flask = result.flask or name
    elseif category == "elixir" then table.insert(result.elixirs, name)
    elseif category == "food" then result.food = result.food or name end
  end
  if unit == "player" and GetWeaponEnchantInfo then
    local ok, hasMain = pcall(GetWeaponEnchantInfo)
    if ok and hasMain then result.weapon = "Weapon enchant" end
  end
  return result
end

-- A flask covers both elixir slots; otherwise an elixir counts.
local function hasElixirOrFlask(result)
  return result.flask ~= nil or #result.elixirs > 0
end
module.hasElixirOrFlask = hasElixirOrFlask

-- Rows for your own readiness snapshot (the addon's existing export format).
function module.ownRows()
  local result = module.scanUnit("player")
  local rows = {}
  if result.flask then table.insert(rows, { name = result.flask, quantity = 1, category = "FLASK" }) end
  for _, name in ipairs(result.elixirs) do table.insert(rows, { name = name, quantity = 1, category = "ELIXIR" }) end
  if result.food then table.insert(rows, { name = result.food, quantity = 1, category = "FOOD" }) end
  if result.weapon then table.insert(rows, { name = result.weapon, quantity = 1, category = "WEAPON" }) end
  return rows, result
end

local function unitList()
  local units = { "player" }
  if IsInRaid and IsInRaid() then
    local count = GetNumGroupMembers and GetNumGroupMembers() or 0
    for i = 1, count do table.insert(units, "raid" .. i) end
  else
    for i = 1, 4 do table.insert(units, "party" .. i) end
  end
  return units
end

local function unitLabel(unit)
  local name, realm = UnitName(unit)
  if not name or isSecret(name) then return nil end
  if unit ~= "player" and UnitIsUnit and UnitIsUnit(unit, "player") then return nil end
  if not realm or realm == "" then
    realm = ns.compat and ns.compat.identity and ns.compat.identity().realm or (GetRealmName and GetRealmName()) or ""
  end
  return name, realm
end

local function listOrNone(names)
  if #names == 0 then return "none" end
  table.sort(names)
  return table.concat(names, ", ")
end

local function groupScan()
  local players, noFlask, noFood, hidden = {}, {}, {}, {}
  local seen = {}
  for _, unit in ipairs(unitList()) do
    if unit == "player" or (UnitExists and UnitExists(unit)) then
      local name, realm = unitLabel(unit)
      if name and not seen[name] then
        seen[name] = true
        local result = module.scanUnit(unit)
        if unit ~= "player" and UnitIsConnected and not UnitIsConnected(unit) then
          -- Offline members can't be read; skip them without blaming them.
        elseif not result.readable then
          table.insert(hidden, name)
        else
          table.insert(players, {
            character = name, realm = realm,
            flask = result.flask, elixirs = result.elixirs, food = result.food, weapon = result.weapon,
            covered = hasElixirOrFlask(result)
          })
          if not hasElixirOrFlask(result) then table.insert(noFlask, name) end
          if not result.food then table.insert(noFood, name) end
        end
      end
    end
  end
  return players, noFlask, noFood, hidden
end

local function report()
  local players, noFlask, noFood, hidden = groupScan()
  local db = ns.getDb and ns.getDb()
  if db then
    local raid = ns.getActiveRaid and ns.getActiveRaid()
    db.consumeScan = { at = ns.now(), by = ns.playerName(), raid = raid and raid.title or nil, players = players }
  end
  ns.message(string.format("Consumable scan: %d player(s) checked.", #players))
  ns.message("No flask or elixir: " .. listOrNone(noFlask))
  ns.message("No food buff: " .. listOrNone(noFood))
  if #hidden > 0 then ns.message("Could not read buffs (out of range or hidden by the game): " .. listOrNone(hidden)) end
  if #players == 0 then ns.message("Nobody could be read. Try again out of combat and in range.") end
end

local function mine()
  local rows, result = module.ownRows()
  if not result.readable then ns.message("Could not read your buffs right now.") return end
  local parts = {}
  for _, row in ipairs(rows) do table.insert(parts, string.lower(row.category) .. ": " .. row.name) end
  ns.message("Your consumables: " .. (#parts > 0 and table.concat(parts, ", ") or "none active"))
end

ns.commandHandlers = ns.commandHandlers or {}
ns.commandHandlers["consumes"] = function(args)
  if ns.moduleActive and not ns.moduleActive("consumables") then return end
  local action = string.lower(args[1] or "")
  if action == "me" then mine()
  elseif action == "" or action == "scan" then
    if ns.isOfficer and not ns.isOfficer() then
      ns.message("Only officers can scan the group. Use /guilded consumes me for your own.")
      return
    end
    report()
  else ns.message("/guilded consumes [scan] | me") end
end
ns.commandHelp = ns.commandHelp or {}
table.insert(ns.commandHelp, { officer = true, text = "/guilded consumes - who in your group is missing a flask/elixir or food (also /guilded consumes me)" })
