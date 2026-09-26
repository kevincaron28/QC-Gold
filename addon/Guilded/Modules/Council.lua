-- Loot council: response voting. An officer opens an item; raiders answer with
-- how much they want it, and the officers decide.
--
--   * Raiders with the addon get a popup with four buttons: BiS, Upgrade,
--     Off-spec, Pass. It also sends what they wear in that slot, so the council
--     can see how big the upgrade is. The answer goes to the officer as a
--     private addon message.
--   * Anyone else whispers the officer one word: bis, upgrade, os or pass.
--   * Answers are ranked BiS, then Upgrade, then Off-spec; inside each group the
--     higher PR comes first, then whoever answered first. Players whose
--     wishlist (from Discord) names the item are marked. This is a guide: the
--     officer awards to whoever the council picks.
--   * Nothing is recorded until the officer awards. Award runs the normal
--     /guilded loot command (and /guilded gp when a price is given), so it lands in
--     the ledger and loot history like any other award.
--
-- Chat: one raid-chat line to open, one to announce the winner. Answers stay private.
local addonName, ns = ...
ns = ns or {}

local PREFIX = "GuildedLC"
local DEFAULT_SECONDS = 60
local MAX_GP = 100000

local council = { current = nil, incoming = nil }
ns.council = council

local popup

local function L(text) return ns.L and ns.L(text) or text end

-- Answers, best first. Pass is kept but never ranked.
local TIERS = {
  bis = { rank = 1, label = "BiS", chat = "BiS" },
  up = { rank = 2, label = "Upgrade", chat = "Upgrade" },
  os = { rank = 3, label = "Off-spec", chat = "Off-spec" },
  pass = { rank = 9, label = "Pass", chat = "Pass" }
}
local TIER_ORDER = { "bis", "up", "os", "pass" }
local WORDS = {
  bis = "bis", upgrade = "up", up = "up", os = "os", offspec = "os", ["off-spec"] = "os", pass = "pass"
}
council.TIERS = TIERS

-- ---------------------------------------------------------------------
-- Messaging
-- ---------------------------------------------------------------------

local function groupChannel()
  if IsInRaid and IsInRaid() then return "RAID" end
  if IsInGroup and IsInGroup() then return "PARTY" end
  -- A running test raid (/guilded sim start) lets an officer try it alone.
  local raid = ns.getActiveRaid and ns.getActiveRaid()
  if raid and raid.test then return "TEST" end
  return nil
end

local function sendAddon(text, channel, target)
  if channel == "TEST" then return end
  pcall(function()
    text = string.sub(text, 1, 255)
    if C_ChatInfo and C_ChatInfo.SendAddonMessage then
      C_ChatInfo.SendAddonMessage(PREFIX, text, channel, target)
    elseif SendAddonMessage then
      SendAddonMessage(PREFIX, text, channel, target)
    end
  end)
end

local function sendChat(text, channel, target)
  if channel == "TEST" then return end
  pcall(function()
    if C_ChatInfo and C_ChatInfo.SendChatMessage then
      C_ChatInfo.SendChatMessage(text, channel, nil, target)
    elseif SendChatMessage then
      SendChatMessage(text, channel, nil, target)
    end
  end)
end

local function announce(text)
  ns.message(text)
  local channel = groupChannel()
  if channel then sendChat("[Guilded] " .. text, channel) end
end

local function changed()
  if ns.onCouncilChange then pcall(ns.onCouncilChange) end
end

local function plainItem(item)
  return string.match(item or "", "%[(.-)%]") or item
end

local function clock()
  return GetTime and GetTime() or time()
end

-- ---------------------------------------------------------------------
-- What the player wears in the slot of an item (sent with the answer)
-- ---------------------------------------------------------------------

local SLOTS = {
  INVTYPE_HEAD = { 1 }, INVTYPE_NECK = { 2 }, INVTYPE_SHOULDER = { 3 }, INVTYPE_CLOAK = { 15 },
  INVTYPE_CHEST = { 5 }, INVTYPE_ROBE = { 5 }, INVTYPE_WRIST = { 9 }, INVTYPE_HAND = { 10 },
  INVTYPE_WAIST = { 6 }, INVTYPE_LEGS = { 7 }, INVTYPE_FEET = { 8 }, INVTYPE_FINGER = { 11, 12 },
  INVTYPE_TRINKET = { 13, 14 }, INVTYPE_WEAPON = { 16, 17 }, INVTYPE_2HWEAPON = { 16 },
  INVTYPE_WEAPONMAINHAND = { 16 }, INVTYPE_WEAPONOFFHAND = { 17 }, INVTYPE_SHIELD = { 17 },
  INVTYPE_HOLDABLE = { 17 }, INVTYPE_RANGED = { 18 }, INVTYPE_RANGEDRIGHT = { 18 },
  INVTYPE_THROWN = { 18 }, INVTYPE_RELIC = { 18 }
}

-- "Name (ilvl); Name (ilvl)" for what is worn where `item` would go, or "".
local function equippedFor(item)
  local text = ""
  pcall(function()
    if not (GetItemInfoInstant and GetInventoryItemLink) then return end
    local _, _, _, equipLoc = GetItemInfoInstant(item)
    local slots = SLOTS[equipLoc]
    if not slots then return end
    local parts = {}
    for _, slot in ipairs(slots) do
      local link = GetInventoryItemLink("player", slot)
      if link then
        local name, _, _, level = GetItemInfo(link)
        name = string.gsub(name or plainItem(link) or "?", "[|;]", "")
        table.insert(parts, level and string.format("%s (%d)", name, level) or name)
      end
    end
    text = table.concat(parts, "; ")
  end)
  return text
end
council.equippedFor = equippedFor

-- ---------------------------------------------------------------------
-- Officer side
-- ---------------------------------------------------------------------

local function prFor(name)
  local standing = ns.getStanding and ns.getStanding(name)
  return standing and standing.pr or 0
end

-- True when the player's Discord wishlist names this item.
local function wishlisted(name, item)
  if not (ns.getItemInsight and name) then return false end
  local key = ns.tooltip and ns.tooltip.itemKey and ns.tooltip.itemKey(plainItem(item))
  local info = key and ns.getItemInsight(key)
  if not (info and info.wish) then return false end
  for _, entry in ipairs(info.wish) do
    if entry[1] == name then return true end
  end
  return false
end

-- Answers that count, best first: tier, then PR, then earliest.
local function rankedResponses(session)
  local list = {}
  for name, r in pairs(session.responses) do
    if r.tier ~= "pass" then
      table.insert(list, {
        name = name, tier = r.tier, at = r.at, gear = r.gear, pr = prFor(name),
        wish = wishlisted(name, session.item)
      })
    end
  end
  table.sort(list, function(a, b)
    local ra, rb = TIERS[a.tier].rank, TIERS[b.tier].rank
    if ra ~= rb then return ra < rb end
    if a.pr ~= b.pr then return a.pr > b.pr end
    return a.at < b.at
  end)
  return list
end
council.ranked = function() return council.current and rankedResponses(council.current) or {} end

local function passCount(session)
  local n = 0
  for _, r in pairs(session.responses) do
    if r.tier == "pass" then n = n + 1 end
  end
  return n
end

local function closeSession(id)
  local session = council.current
  if not session or session.id ~= id or not session.open then return end
  session.open = false
  sendAddon("CLOSE|" .. session.id, session.channel)
  local ranked = rankedResponses(session)
  if #ranked == 0 then
    announce(string.format(L("Nobody wants %s."), session.item))
    council.current = nil
  else
    ns.message(string.format("Council closed: %d want %s. Look at the list, then award: /guilded council award <player> [GP].",
      #ranked, plainItem(session.item)))
  end
  changed()
end

local function openSession(args)
  if not ns.isOfficer() then ns.message("Only officers can run the loot council."); return end
  if council.current then ns.message("The council is already looking at " .. council.current.item .. ". Award or cancel it first."); return end
  local channel = groupChannel()
  if not channel then ns.message("Be in a raid or party to run the loot council (or start a test raid: /guilded sim start)."); return end
  local last = #args
  local seconds = DEFAULT_SECONDS
  if last >= 2 and tonumber(args[last]) then
    seconds = math.max(15, math.min(600, math.floor(tonumber(args[last]))))
    last = last - 1
  end
  local item = table.concat(args, " ", 1, last)
  if item == "" then ns.message("Usage: /guilded council start <item or shift-click link> [seconds]"); return end
  local id = string.format("%d%03d", time(), math.random(0, 999))
  council.current = {
    id = id, item = item, seconds = seconds, endsAt = clock() + seconds,
    responses = {}, open = true, channel = channel
  }
  sendAddon(string.format("OPEN|%s|%d|%s", id, seconds, item), channel)
  announce(string.format(L("Loot council on %s: answer in the Guilded popup, or whisper me bis, upgrade, os or pass (%ds)."), item, seconds))
  if C_Timer and C_Timer.After then C_Timer.After(seconds, function() closeSession(id) end) end
  changed()
end

-- Records an answer. `reply`: "addon" (private addon message), "whisper" (chat
-- whisper, for players without the addon), or nil (simulated).
local function addResponse(name, tier, gear, replyTo, reply)
  local session = council.current
  if not session or not session.open or not name or not TIERS[tier] then return end
  session.responses[name] = { tier = tier, at = clock(), gear = gear ~= "" and gear or nil }
  if reply == "addon" then sendAddon("ACK|" .. session.id .. "|" .. tier, "WHISPER", replyTo)
  elseif reply == "whisper" then
    sendChat("[Guilded] " .. string.format(L("Got it: %s for %s."), TIERS[tier].chat, plainItem(session.item)), "WHISPER", replyTo)
  end
  changed()
end
council.addResponse = addResponse

local function awardSession(args)
  local session = council.current
  if not session then ns.message("No loot council to award."); return end
  if session.open then closeSession(session.id) end
  session = council.current
  if not session then return end
  local name = args[1] and ns.normalizeName and ns.normalizeName(args[1])
  local ranked = rankedResponses(session)
  if not name then
    if not ranked[1] then ns.message("Say who gets it: /guilded council award <player> [GP]."); return end
    name = ranked[1].name
  end
  local gp = math.floor(tonumber(args[2]) or 0)
  if gp < 0 or gp > MAX_GP then ns.message("That GP is out of range."); return end
  local item = plainItem(session.item)
  ns.runCommand("loot " .. name .. " " .. item .. " " .. gp)
  if gp > 0 then ns.runCommand("gp " .. name .. " " .. gp .. " Council: " .. item) end
  sendAddon(string.format("AWARD|%s|%s", session.id, name), session.channel)
  announce(string.format(L("%s goes to %s."), session.item, name))
  council.current = nil
  changed()
end

local function cancelSession()
  local session = council.current
  if not session then ns.message("No loot council to cancel."); return end
  sendAddon("CLOSE|" .. session.id, session.channel)
  announce(string.format(L("Loot council on %s cancelled."), session.item))
  council.current = nil
  changed()
end

-- Short description for the window.
function council.statusText()
  local session = council.current
  if not session then return "No loot council running." end
  local ranked = rankedResponses(session)
  local left = math.max(0, math.floor(session.endsAt - clock()))
  local lines = { string.format("%s - %s", plainItem(session.item),
    session.open and (left .. "s left") or "closed, waiting for Award") }
  for i = 1, math.min(10, #ranked) do
    local r = ranked[i]
    local extra = {}
    if r.wish then table.insert(extra, "wishlist") end
    if r.gear then table.insert(extra, "wears " .. r.gear) end
    table.insert(lines, string.format("%d. %s  %s  (PR %.2f)%s", i, r.name, TIERS[r.tier].label, r.pr,
      #extra > 0 and ("  - " .. table.concat(extra, ", ")) or ""))
  end
  if #ranked == 0 then table.insert(lines, "No answers yet.") end
  local passes = passCount(session)
  if passes > 0 then table.insert(lines, string.format("%d passed.", passes)) end
  return table.concat(lines, "\n")
end

-- /guilded sim council: fake raiders answer the open item (test raids).
ns.simulateCouncil = function()
  local session = council.current
  if not session or not session.open then ns.message("Open the loot council first (/guilded council start ...)."); return end
  local names = ns.SIM_NAMES or {}
  local pick = { "bis", "up", "os", "up", "pass" }
  for i = 1, math.min(#pick, #names) do
    addResponse(names[i], pick[i], i == 2 and "Old Sword (60)" or "", nil, nil)
  end
  ns.message("Added fake answers. Close or wait for the timer, then Award.")
end

-- ---------------------------------------------------------------------
-- Raider side: the popup
-- ---------------------------------------------------------------------

local function hidePopup()
  if popup then popup:Hide() end
end

local function updatePopup()
  local incoming = council.incoming
  if not popup or not incoming then return end
  local left = math.max(0, math.floor(incoming.endsAt - clock()))
  popup.item:SetText(incoming.item)
  popup.info:SetText(string.format(L("%ds left"), left))
  popup.mine:SetText(incoming.mine and string.format(L("Your answer: %s"), L(TIERS[incoming.mine].label)) or "")
  if left <= 0 then hidePopup() end
end

local function respond(tier)
  local incoming = council.incoming
  if not incoming or not TIERS[tier] then return end
  local gear = tier == "pass" and "" or equippedFor(incoming.item)
  sendAddon(string.format("RESP|%s|%s|%s", incoming.id, tier, gear), "WHISPER", incoming.officer)
  -- Sent to the officer; the answer shows as accepted when the ACK comes back.
  if tier == "pass" then incoming.mine = "pass"; updatePopup(); hidePopup() end
end

local function buildPopup()
  popup = CreateFrame("Frame", "GuildedCouncilPopup", UIParent, BackdropTemplateMixin and "BackdropTemplate" or nil)
  popup:SetWidth(360)
  popup:SetHeight(140)
  popup:SetPoint("TOP", UIParent, "TOP", 0, -140)
  popup:SetFrameStrata("DIALOG")
  popup:SetMovable(true)
  popup:EnableMouse(true)
  popup:RegisterForDrag("LeftButton")
  popup:SetScript("OnDragStart", popup.StartMoving)
  popup:SetScript("OnDragStop", popup.StopMovingOrSizing)
  if popup.SetBackdrop then
    popup:SetBackdrop({
      bgFile = "Interface\\DialogFrame\\UI-DialogBox-Background",
      edgeFile = "Interface\\DialogFrame\\UI-DialogBox-Border",
      tile = true, tileSize = 32, edgeSize = 32,
      insets = { left = 11, right = 12, top = 12, bottom = 11 }
    })
  end
  local title = popup:CreateFontString(nil, "OVERLAY", "GameFontNormal")
  title:SetPoint("TOP", popup, "TOP", 0, -14)
  title:SetText(L("Guilded - loot council"))
  popup.item = popup:CreateFontString(nil, "OVERLAY", "GameFontHighlight")
  popup.item:SetPoint("TOP", popup, "TOP", 0, -34)
  popup.info = popup:CreateFontString(nil, "OVERLAY", "GameFontHighlightSmall")
  popup.info:SetPoint("TOP", popup, "TOP", 0, -54)

  local x = 22
  for _, tier in ipairs(TIER_ORDER) do
    local button = CreateFrame("Button", nil, popup, "UIPanelButtonTemplate")
    button:SetWidth(76)
    button:SetHeight(22)
    button:SetPoint("TOPLEFT", popup, "TOPLEFT", x, -78)
    button:SetText(L(TIERS[tier].label))
    button:SetScript("OnClick", function() respond(tier) end)
    x = x + 80
  end

  popup.mine = popup:CreateFontString(nil, "OVERLAY", "GameFontHighlightSmall")
  popup.mine:SetPoint("TOP", popup, "TOP", 0, -110)
  popup:Hide()
end

local ticker

local function showPopup()
  local ok, err = pcall(function()
    if not popup then buildPopup() end
    updatePopup()
    popup:Show()
  end)
  if not ok then ns.message("Council popup failed: " .. tostring(err)) return end
  if ticker then ticker:Cancel() end
  if C_Timer and C_Timer.NewTicker then
    ticker = C_Timer.NewTicker(1, function()
      if not popup or not popup:IsShown() then if ticker then ticker:Cancel() end return end
      updatePopup()
    end)
  end
end

-- ---------------------------------------------------------------------
-- Commands and events
-- ---------------------------------------------------------------------

ns.commandHandlers = ns.commandHandlers or {}
ns.commandHandlers["council"] = function(args)
  local action = string.lower(args[1] or "")
  table.remove(args, 1)
  local officerActions = { start = true, close = true, award = true, cancel = true }
  if officerActions[action] and not ns.isOfficer() then
    ns.message("Only officers can run the loot council.")
    return
  end
  if action == "start" then openSession(args)
  elseif action == "close" then
    if council.current then closeSession(council.current.id) end
  elseif action == "award" then awardSession(args)
  elseif action == "cancel" then cancelSession()
  elseif action == "status" then ns.message(council.statusText())
  elseif WORDS[action] then
    -- A member answering from the keyboard, e.g. /guilded council bis
    if council.incoming then respond(WORDS[action]) else ns.message("No loot council is open for you.") end
  else
    ns.message("/guilded council start <item> [seconds] | close | award [player] [GP] | cancel | status  -  members: bis | upgrade | os | pass")
  end
end
ns.commandHandlers["lc"] = ns.commandHandlers["council"]
ns.commandHelp = ns.commandHelp or {}
table.insert(ns.commandHelp, { officer = true, text = "/guilded council start <item> [seconds] | close | award [player] [GP] | cancel | status - loot council answers" })

local function onEvent(_, event, ...)
  if event == "PLAYER_LOGIN" then
    if C_ChatInfo and C_ChatInfo.RegisterAddonMessagePrefix then
      C_ChatInfo.RegisterAddonMessagePrefix(PREFIX)
    elseif RegisterAddonMessagePrefix then
      RegisterAddonMessagePrefix(PREFIX)
    end
  elseif event == "CHAT_MSG_WHISPER" then
    -- Players without the addon answer by whispering one word.
    if not council.current or not council.current.open then return end
    local text, sender = ...
    if ns.isSecret(text) or ns.isSecret(sender) then return end
    local word = string.match(string.lower(text or ""), "^%s*([%a%-]+)%s*$")
    local tier = word and WORDS[word]
    if tier then addResponse(ns.normalizeName(sender), tier, "", sender, "whisper") end
  elseif event == "CHAT_MSG_ADDON" then
    local prefix, text, _, sender = ...
    if ns.isSecret(prefix) or ns.isSecret(text) or ns.isSecret(sender) or prefix ~= PREFIX then return end
    local name = ns.normalizeName(sender)
    if not name or name == ns.playerName() then return end
    local kind = string.match(text, "^(%u+)|")
    if kind == "RESP" then
      local id, tier, gear = string.match(text, "^RESP|([^|]+)|(%a+)|?(.*)$")
      if council.current and council.current.id == id then addResponse(name, tier, gear or "", sender, "addon") end
    elseif kind == "OPEN" then
      -- Only an officer can open the council for the raid.
      if not ns.isOfficerName(name) then return end
      local id, seconds, item = string.match(text, "^OPEN|([^|]+)|(%d+)|(.+)$")
      if not id then return end
      council.incoming = { id = id, item = item, endsAt = clock() + tonumber(seconds), officer = sender }
      showPopup()
    elseif kind == "ACK" then
      local id, tier = string.match(text, "^ACK|([^|]+)|(%a+)$")
      local incoming = council.incoming
      if incoming and incoming.id == id and TIERS[tier] then
        incoming.mine = tier
        updatePopup()
      end
    elseif kind == "CLOSE" then
      local id = string.match(text, "^CLOSE|(.+)$")
      if council.incoming and council.incoming.id == id then hidePopup() end
    elseif kind == "AWARD" then
      local id, winner = string.match(text, "^AWARD|([^|]+)|(.+)$")
      if council.incoming and council.incoming.id == id then
        hidePopup()
        if winner == ns.playerName() then ns.message(string.format(L("You got %s."), council.incoming.item)) end
        council.incoming = nil
      end
    end
  end
end

local frame = CreateFrame("Frame")
frame:RegisterEvent("PLAYER_LOGIN")
frame:RegisterEvent("CHAT_MSG_WHISPER")
frame:RegisterEvent("CHAT_MSG_ADDON")
frame:SetScript("OnEvent", function(...)
  if ns.moduleActive and not ns.moduleActive("council") then return end -- /guilded modules
  local ok, err = pcall(onEvent, ...)
  if not ok then ns.message("Loot council error: " .. tostring(err)) end
end)
