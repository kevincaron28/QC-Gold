-- Getting your data to Discord sooner.
--
-- The game only writes the addon's saved file when you /reload or log out,
-- and the companion can only read that file. So "send to Discord" means "save
-- now", which is a UI reload. This module makes that easy and regular:
--
--   /qg sync              save now (reloads the UI) so the companion uploads
--   /qg sync auto on|off [minutes]   reload by itself at SAFE moments
--   /qg sync status
--
-- Safe moment = out of combat, not inside an instance, data actually changed
-- since the last reload, changes quiet for 90 seconds, and at least
-- `minutes` (default 10) since the last reload. Officers (the people who run
-- the companion) get auto on by default; everyone else gets a banner with a
-- button instead (a click may reload, an addon on its own timer may not).
local addonName, ns = ...
ns = ns or {}

local CHECK_SECONDS = 60
local SETTLE_SECONDS = 90
local DEFAULT_MINUTES = 10
local BANNER_REPEAT_SECONDS = 20 * 60
local COUNTDOWN_SECONDS = 5

local module = {}
ns.syncNow = module

local dirtyAt        -- when unsaved data first appeared (this session)
local lastReloadAt   -- session start
local bannerShownAt
local pending = false
local banner

local function clock() return time and time() or 0 end

local function state()
  local db = ns.getDb and ns.getDb()
  if not db then return nil end
  db.syncNow = db.syncNow or { minutes = DEFAULT_MINUTES }
  return db.syncNow
end

local function officer()
  return ns.isOfficer and ns.isOfficer() or false
end

-- nil = follow the default (on for officers).
local function autoEnabled()
  local s = state()
  if not s then return false end
  if s.auto == nil then return officer() end
  return s.auto
end

-- Called by Core whenever something worth saving happens.
function module.mark()
  dirtyAt = dirtyAt or clock()
end

function module.isDirty() return dirtyAt ~= nil end

local function inCombat()
  if InCombatLockdown and InCombatLockdown() then return true end
  if UnitAffectingCombat and UnitAffectingCombat("player") then return true end
  return false
end

local function inInstance()
  if not IsInInstance then return false end
  local ok, inside = pcall(IsInInstance)
  return ok and inside and true or false
end

function module.safeMoment()
  return not inCombat() and not inInstance()
end

function module.reloadNow()
  if not ReloadUI then
    ns.message("Type /reload to save your data for the companion.")
    return false
  end
  local ok = pcall(ReloadUI)
  if not ok then ns.message("The game would not reload from here. Type /reload.") end
  return ok
end

local function hideBanner()
  if banner then banner:Hide() end
end

local function showBanner()
  bannerShownAt = clock()
  if not banner then
    banner = CreateFrame("Frame", "QuebecGoldSyncBanner", UIParent)
    banner:SetSize(320, 56)
    banner:SetPoint("TOP", 0, -120)
    banner:SetFrameStrata("HIGH")
    local background = banner:CreateTexture(nil, "BACKGROUND")
    background:SetAllPoints()
    background:SetColorTexture(0, 0, 0, 0.8)
    local text = banner:CreateFontString(nil, "OVERLAY", "GameFontNormal")
    text:SetPoint("TOPLEFT", 10, -8)
    text:SetText("Quebec Gold: new data is waiting to go to Discord.")
    local send = CreateFrame("Button", nil, banner, "UIPanelButtonTemplate")
    send:SetSize(140, 22)
    send:SetPoint("BOTTOMLEFT", 10, 6)
    send:SetText("Send to Discord")
    send:SetScript("OnClick", function() hideBanner() module.reloadNow() end)
    local later = CreateFrame("Button", nil, banner, "UIPanelButtonTemplate")
    later:SetSize(90, 22)
    later:SetPoint("BOTTOMRIGHT", -10, 6)
    later:SetText("Later")
    later:SetScript("OnClick", hideBanner)
  end
  banner:Show()
end

-- One check, once a minute.
function module.tick()
  if ns.moduleActive and not ns.moduleActive("syncnow") then return end
  local s = state()
  if not s or not dirtyAt or pending then return end
  local now = clock()
  if now - dirtyAt < SETTLE_SECONDS then return end
  if now - (lastReloadAt or now) < (s.minutes or DEFAULT_MINUTES) * 60 then return end
  if not module.safeMoment() then return end
  if autoEnabled() then
    pending = true
    ns.message(string.format("Saving your data for Discord: reloading in %d seconds. (/qg sync auto off to stop this.)", COUNTDOWN_SECONDS))
    local function go()
      pending = false
      if module.safeMoment() then module.reloadNow() end
    end
    if C_Timer and C_Timer.After then C_Timer.After(COUNTDOWN_SECONDS, go) else go() end
  elseif officer() and (not bannerShownAt or now - bannerShownAt >= BANNER_REPEAT_SECONDS) then
    showBanner()
  end
end

-- One plain-language sentence for the Home page.
function module.statusLine()
  local s = state()
  local auto = s and autoEnabled()
  if dirtyAt then
    local minutes = math.floor((clock() - dirtyAt) / 60)
    return string.format("Changes are waiting (%s). %s", minutes <= 0 and "just now" or (minutes .. " min"),
      auto and "The addon will save them by itself at a safe moment; or press Send to Discord now." or "Press Send to Discord now: it saves and the companion uploads.")
  end
  return "Everything is saved. " .. (auto and "New changes are saved automatically at safe moments." or "After changes, press Send to Discord now.")
end

local frame = CreateFrame("Frame")
frame:RegisterEvent("PLAYER_LOGIN")
frame:SetScript("OnEvent", function()
  lastReloadAt = clock()
  if C_Timer and C_Timer.NewTicker then
    C_Timer.NewTicker(CHECK_SECONDS, function()
      local ok, err = pcall(module.tick)
      if not ok and ns.logDiagnostic then ns.logDiagnostic("LUA_ERROR", "syncnow: " .. tostring(err)) end
    end)
  end
end)

ns.commandHandlers = ns.commandHandlers or {}
ns.commandHandlers["sync"] = function(args)
  if ns.moduleActive and not ns.moduleActive("syncnow") then return end
  local action = string.lower(args[1] or "")
  local s = state()
  if action == "" or action == "now" then
    ns.message("Saving now so the companion can send your data to Discord...")
    module.reloadNow()
  elseif action == "auto" then
    local sub = string.lower(args[2] or "")
    if sub == "on" then s.auto = true elseif sub == "off" then s.auto = false end
    local minutes = tonumber(args[3] or (tonumber(sub) and sub))
    if minutes and minutes >= 2 and minutes <= 240 then s.minutes = math.floor(minutes) end
    ns.message(string.format("Auto-save for Discord is %s (at most every %d minutes, only out of combat and outside instances).",
      autoEnabled() and "on" or "off", s.minutes or DEFAULT_MINUTES))
  else
    local waiting = dirtyAt and ("changes waiting since " .. math.floor((clock() - dirtyAt) / 60) .. " min") or "nothing waiting"
    ns.message(string.format("Sync to Discord: %s. Auto-save %s every %d min (%s). /qg sync = save now.", waiting,
      autoEnabled() and "on" or "off", s.minutes or DEFAULT_MINUTES, officer() and "officer default: on" or "you: banner only"))
  end
end
ns.commandHelp = ns.commandHelp or {}
table.insert(ns.commandHelp, "/qg sync | sync auto on/off [min] | sync status - save now so the companion sends your data to Discord")
