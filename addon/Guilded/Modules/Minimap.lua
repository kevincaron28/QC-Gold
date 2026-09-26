-- Minimap button and the Guilded tools window.
--
-- Each rank sees only what it can use:
--   officers: Raid, EPGP, Loot, Games, Me, Standings, Dungeons, Tools
--   members:  Me, Standings, Tools (officer-only tools hidden)
-- Rank is re-checked every time the window opens, so a promotion shows up
-- without a reload.
--
-- One shared Player box sits at the top. Targeting a player fills it in
-- automatically, Me / Group... fill it on demand (Group... lists your
-- raid/party, or online guildmates when solo). Every button runs the
-- matching /guilded command, so permissions and validation stay in one place.
--
-- Deliberately avoided: dropdown-menu APIs, hooks into Blizzard's
-- right-click unit menus, and StaticPopup dialogs - the usual ways an addon
-- taints Blizzard UI and triggers "blocked from an action" popups.
-- Everything is created inside pcall so a UI problem can never break the
-- core addon.
local addonName, ns = ...
ns = ns or {}

local ICON = "Interface\\Icons\\INV_Misc_Coin_01"
local DEFAULT_ANGLE = math.rad(220)
local RADIUS_PAD = 5
local PANEL_WIDTH = 790
local PANEL_HEIGHT = 540
-- A sidebar of tabs on the left (grouped, like most modern addons), the page on the right.
local SIDEBAR_WIDTH = 160
local CONTENT_X = SIDEBAR_WIDTH + 26
local PAGE_WIDTH = PANEL_WIDTH - CONTENT_X - 22
local ATTUNEMENT_PRESETS = { "Molten Core", "Onyxia", "Blackwing Lair", "Naxxramas" }

local button, panel

-- Player-facing text goes through ns.L (Locale.lua) for English/French.
local function L(text) return ns.L and ns.L(text) or text end
local built = false
local ui = { tabs = {}, officerOnly = {}, currentTab = nil }
-- Read-only view of the window state, for tests (tests/lua/window.test.ts).
ns.windowState = function() return ui end

local function settings()
  return ns.getSettings and ns.getSettings()
end

-- ---------------------------------------------------------------------
-- Small widget helpers
-- ---------------------------------------------------------------------

local function at(widget, parent, x, y)
  widget:ClearAllPoints()
  widget:SetPoint("TOPLEFT", parent, "TOPLEFT", x, y)
  return widget
end

local function newButton(parent, text, width, onClick, height)
  local b = CreateFrame("Button", nil, parent, "UIPanelButtonTemplate")
  b:SetWidth(width or 110)
  b:SetHeight(height or 22)
  b:SetText(text)
  if onClick then b:SetScript("OnClick", onClick) end
  return b
end

-- Hidden entirely for members (not just greyed out).
local function officerOnly(widget)
  table.insert(ui.officerOnly, widget)
  return widget
end

-- Widgets that belong to an optional module (/guilded modules): shown only while
-- it is on (and, with officer = true, only to officers).
local function forModule(key, widget, officer)
  ui.moduleWidgets = ui.moduleWidgets or {}
  table.insert(ui.moduleWidgets, { key = key, widget = widget, officer = officer })
  return widget
end

local function moduleOn(key)
  return not ns.moduleActive or ns.moduleActive(key)
end

local function newEdit(parent, width, numeric)
  local e = CreateFrame("EditBox", nil, parent, "InputBoxTemplate")
  e:SetWidth(width)
  e:SetHeight(20)
  e:SetAutoFocus(false)
  if numeric then e:SetNumeric(true) end
  e:SetScript("OnEscapePressed", function(self) self:ClearFocus() end)
  e:SetScript("OnEnterPressed", function(self) self:ClearFocus() end)
  return e
end

local function newLabel(parent, text, font)
  local l = parent:CreateFontString(nil, "OVERLAY", font or "GameFontNormal")
  l:SetJustifyH("LEFT")
  l:SetJustifyV("TOP")
  l:SetText(text or "")
  return l
end

local function atan2(y, x)
  if math.atan2 then return math.atan2(y, x) end
  return math.atan(y, x)
end

-- Big actions (whole-group awards, ending a raid) need a second click
-- within 3 seconds instead of a popup dialog.
local function confirmClick(b, label, action)
  b:SetScript("OnClick", function(self)
    if self.armed or not C_Timer then
      self.armed = false
      self:SetText(label)
      action()
      return
    end
    self.armed = true
    self:SetText("Click again to confirm")
    C_Timer.After(3, function()
      if self.armed then
        self.armed = false
        self:SetText(label)
      end
    end)
  end)
end

-- ---------------------------------------------------------------------
-- Actions
-- ---------------------------------------------------------------------

local refresh

local function run(text)
  if not ns.runCommand then return end
  ns.runCommand(text)
  if refresh then refresh() end
end

local function selectedPlayer()
  local text = ui.playerBox and ui.playerBox:GetText() or ""
  return ns.normalizeName and ns.normalizeName(text)
end

local function needPlayer()
  local name = selectedPlayer()
  if not name then ns.message("Pick a player first: target them, or use Me / Group... next to Player.") end
  return name
end

local function amount()
  local n = tonumber(ui.amountBox and ui.amountBox:GetText() or "")
  if not n or n <= 0 then ns.message("Enter an amount first.") end
  return n and n > 0 and n or nil
end

local function reasonText()
  local text = ui.reasonBox and ui.reasonBox:GetText() or ""
  return (string.gsub(text, '"', ""))
end

local function setPlayer(name)
  if ui.playerBox and name and name ~= "" then
    ui.playerBox:SetText(name)
    if refresh then refresh() end
  end
end

local function fillFromTarget()
  if UnitExists("target") and UnitIsPlayer("target") then
    setPlayer((UnitName("target")))
  else
    ns.message("Target a player first.")
  end
end

-- ---------------------------------------------------------------------
-- Player picker: clickable list of raid/party members (or online guild)
-- ---------------------------------------------------------------------

local picker
local pickerButtons = {}

local function pickerNames()
  local names = ns.groupMembers and ns.groupMembers() or {}
  if #names <= 1 and GetNumGuildMembers and GetGuildRosterInfo then
    local seen = {}
    for _, name in ipairs(names) do seen[name] = true end
    for i = 1, GetNumGuildMembers() do
      local rosterName, _, _, _, _, _, _, _, online = GetGuildRosterInfo(i)
      local name = ns.normalizeName(rosterName)
      if online and name and not seen[name] then
        seen[name] = true
        table.insert(names, name)
      end
      if #names >= 40 then break end
    end
  end
  table.sort(names)
  return names
end

local function showPicker()
  if not picker then
    picker = CreateFrame("Frame", "GuildedPlayerPicker", panel, BackdropTemplateMixin and "BackdropTemplate" or nil)
    picker:SetFrameStrata("DIALOG")
    picker:SetFrameLevel(panel:GetFrameLevel() + 20)
    picker:SetPoint("TOPLEFT", panel, "TOPRIGHT", -4, 0)
    picker:EnableMouse(true)
    if picker.SetBackdrop then
      picker:SetBackdrop({
        bgFile = "Interface\\DialogFrame\\UI-DialogBox-Background",
        edgeFile = "Interface\\DialogFrame\\UI-DialogBox-Border",
        tile = true, tileSize = 32, edgeSize = 32,
        insets = { left = 11, right = 12, top = 12, bottom = 11 }
      })
    end
    picker.title = at(newLabel(picker, L("Pick a player")), picker, 18, -16)
    local close = CreateFrame("Button", nil, picker, "UIPanelCloseButton")
    close:SetPoint("TOPRIGHT", picker, "TOPRIGHT", -4, -4)
  end
  for _, b in ipairs(pickerButtons) do b:Hide() end
  local names = pickerNames()
  for i, name in ipairs(names) do
    local b = pickerButtons[i]
    if not b then
      b = newButton(picker, "", 104)
      pickerButtons[i] = b
    end
    at(b, picker, 16 + ((i - 1) % 2) * 108, -40 - math.floor((i - 1) / 2) * 24)
    b:SetText(name)
    b:SetScript("OnClick", function() setPlayer(name); picker:Hide() end)
    b:Show()
  end
  picker.title:SetText(#names > 1 and L("Pick a player") or L("Nobody else found"))
  picker:SetWidth(248)
  picker:SetHeight(60 + math.ceil(math.max(#names, 1) / 2) * 24)
  picker:Show()
end

-- ---------------------------------------------------------------------
-- Tab pages
-- ---------------------------------------------------------------------

local function buildRaidPage(page)
  ui.raidInfo = at(newLabel(page, "", "GameFontHighlight"), page, 0, 0)

  at(newLabel(page, "Raid name"), page, 0, -32)
  ui.raidName = at(newEdit(page, 170), page, 86, -28)
  at(newButton(page, "Start raid", 90, function()
    local title = ui.raidName:GetText()
    run("start " .. (title ~= "" and title or "Raid"))
  end), page, 266, -28)
  local endButton = at(newButton(page, "End raid", 80), page, 360, -28)
  confirmClick(endButton, "End raid", function() run("end") end)

  at(newLabel(page, "Boss"), page, 0, -66)
  ui.bossName = at(newEdit(page, 170), page, 86, -62)
  at(newButton(page, "Target", 90, function()
    if UnitExists("target") then ui.bossName:SetText((UnitName("target"))) else ns.message("Target the boss first.") end
  end), page, 266, -62)
  at(newButton(page, "Record kill", 80, function()
    local boss = ui.bossName:GetText()
    if boss == "" then ns.message("Type or target the boss first."); return end
    run("boss " .. boss)
  end), page, 360, -62)

  at(newLabel(page, "Attendance for the selected player"), page, 0, -104)
  local x = 0
  for _, status in ipairs({ "Present", "Late", "Absent" }) do
    at(newButton(page, status, 90, function()
      local name = needPlayer()
      if name then run("attendance " .. name .. " " .. string.upper(status)) end
    end), page, x, -124)
    x = x + 96
  end
  -- "Seen" = everyone who was in the raid group at any point since Start
  -- raid (recorded automatically); players already marked keep their status.
  local seenButton = at(newButton(page, "Mark everyone seen present", 220), page, 0, -158)
  confirmClick(seenButton, "Mark everyone seen present", function() run("attendance seen") end)
end

local function buildEpgpPage(page)
  ui.epgpInfo = at(newLabel(page, "", "GameFontHighlightSmall"), page, 0, 0)

  at(newLabel(page, "Amount"), page, 0, -62)
  ui.amountBox = at(newEdit(page, 60, true), page, 66, -58)
  local x = 136
  for _, preset in ipairs({ 5, 10, 25, 50, 100 }) do
    at(newButton(page, tostring(preset), 44, function() ui.amountBox:SetText(tostring(preset)) end), page, x, -58)
    x = x + 48
  end

  at(newLabel(page, "Reason"), page, 0, -94)
  ui.reasonBox = at(newEdit(page, 310), page, 66, -90)

  local function epgp(action)
    local name, n = needPlayer(), amount()
    if name and n then run(action .. " " .. name .. " " .. n .. " " .. reasonText()) end
  end
  at(newButton(page, "Award EP", 120, function() epgp("award") end), page, 0, -126)
  at(newButton(page, "Charge GP", 120, function() epgp("gp") end), page, 126, -126)
  at(newButton(page, "Deduct EP", 120, function() epgp("deduct") end), page, 252, -126)
  local groupButton = at(newButton(page, "Award EP to whole group", 220), page, 0, -158)
  confirmClick(groupButton, "Award EP to whole group", function()
    local n = amount()
    if n then run("award group " .. n .. " " .. reasonText()) end
  end)

  at(newLabel(page, "Loot and GP bidding are on the Loot tab.", "GameFontDisableSmall"), page, 0, -198)
end

-- Loot: GP bidding on an item, or giving it directly at a set price.
local function buildLootPage(page)
  at(newLabel(page, "Item (click the box, then shift-click the item)"), page, 0, 0)
  ui.itemBox = at(newEdit(page, 400), page, 6, -18)

  at(newLabel(page, "Min GP"), page, 0, -52)
  ui.minGpBox = at(newEdit(page, 50, true), page, 60, -48)
  ui.minGpBox:SetText("10")
  local x = 120
  for _, preset in ipairs({ 10, 25, 50, 100 }) do
    at(newButton(page, tostring(preset), 44, function() ui.minGpBox:SetText(tostring(preset)) end), page, x, -48)
    x = x + 48
  end
  forModule("bidding", at(newLabel(page, "Time"), page, 0, -84))
  ui.bidSeconds = 30
  ui.secondsButtons = {}
  x = 60
  for _, seconds in ipairs({ 20, 30, 60 }) do
    local b = forModule("bidding", at(newButton(page, seconds .. "s", 50, function()
      ui.bidSeconds = seconds
      for s, button in pairs(ui.secondsButtons) do
        if s == seconds then button:LockHighlight() else button:UnlockHighlight() end
      end
    end), page, x, -80))
    ui.secondsButtons[seconds] = b
    x = x + 54
  end
  ui.secondsButtons[30]:LockHighlight()

  local function item()
    local text = ui.itemBox:GetText()
    if text == "" then ns.message("Put the item in the Item box first (shift-click it).") end
    return text ~= "" and text or nil
  end
  local function minGp()
    local n = tonumber(ui.minGpBox:GetText())
    if not n then ns.message("Enter a minimum GP.") end
    return n
  end

  forModule("bidding", at(newButton(page, "Open bidding", 110, function()
    local link, n = item(), minGp()
    if link and n then run("bid start " .. n .. " " .. link .. " " .. ui.bidSeconds) end
  end), page, 0, -114))
  forModule("bidding", at(newButton(page, "Close now", 90, function() run("bid close") end), page, 114, -114))
  forModule("bidding", at(newButton(page, "Award winner", 110, function()
    run("bid award")
    ui.itemBox:SetText("")
  end), page, 208, -114))
  local cancel = forModule("bidding", at(newButton(page, "Cancel", 80), page, 322, -114))
  confirmClick(cancel, "Cancel", function() run("bid cancel") end)

  ui.bidStatus = forModule("bidding", at(newLabel(page, "", "GameFontHighlightSmall"), page, 0, -146))
  ui.bidStatus:SetWidth(PAGE_WIDTH)

  at(newLabel(page, "No bidding: give it to the selected Player for Min GP", "GameFontNormalSmall"), page, 0, -262)
  at(newButton(page, "Give directly", 110, function()
    local name, link, n = needPlayer(), item(), minGp()
    if name and link and n then
      local plain = string.match(link, "%[(.-)%]") or link
      run("loot " .. name .. " " .. plain .. " " .. n)
      if n > 0 then run("gp " .. name .. " " .. n .. " " .. plain) end
      ui.itemBox:SetText("")
    end
  end), page, 0, -278)
  forModule("bidding", at(newLabel(page, "Pugs without the addon bid by whispering you a number.", "GameFontDisableSmall"), page, 116, -283))
end

local function buildGamesPage(page)
  at(newLabel(page, "Fun roll games. No gold, nothing owed. Players type 1 in party/raid chat to join, then /roll.", "GameFontNormalSmall"), page, 0, -4)
  at(newButton(page, "High roll", 100, function() run("games highroll") end), page, 0, -28)
  at(newButton(page, "Deathroll", 100, function() run("games deathroll") end), page, 104, -28)
  at(newButton(page, "Call the roll", 110, function() run("games roll") end), page, 208, -28)
  at(newButton(page, "Remind", 76, function() run("games remind") end), page, 0, -56)
  at(newButton(page, "Add player", 96, function()
    local name = needPlayer()
    if name then run("games add " .. name) end
  end), page, 80, -56)
  local cancelGame = at(newButton(page, "Cancel game", 100), page, 180, -56)
  confirmClick(cancelGame, "Cancel game", function() run("games cancel") end)

  at(newLabel(page, "Duel: you and the selected Player, classic deathroll (roll the last number, first to roll 1 loses)", "GameFontNormalSmall"), page, 0, -92)
  at(newButton(page, "Start duel", 100, function()
    local name = needPlayer()
    if name then run("games duel " .. name) end
  end), page, 0, -112)

  ui.gamesStatus = at(newLabel(page, "", "GameFontHighlightSmall"), page, 0, -150)
  ui.gamesStatus:SetWidth(PAGE_WIDTH)
end

local function buildMePage(page)
  at(newButton(page, L("Check my gear"), 180, function() run("inspect") end), page, 0, 0)
  ui.gearInfo = at(newLabel(page, "", "GameFontHighlightSmall"), page, 0, -30)
  ui.gearInfo:SetWidth(PAGE_WIDTH)

  local attuneBlock = CreateFrame("Frame", nil, page)
  attuneBlock:SetWidth(PAGE_WIDTH)
  attuneBlock:SetHeight(120)
  attuneBlock:SetPoint("TOPLEFT", ui.gearInfo, "BOTTOMLEFT", 0, -14)
  at(newLabel(attuneBlock, L("Attunements")), attuneBlock, 0, 0)
  local x = 0
  for _, preset in ipairs(ATTUNEMENT_PRESETS) do
    at(newButton(attuneBlock, preset, 104, function() ui.attuneBox:SetText(preset) end), attuneBlock, x, -20)
    x = x + 108
  end
  ui.attuneBox = at(newEdit(attuneBlock, 200), attuneBlock, 6, -52)
  local function attune(clear)
    local key = string.gsub(ui.attuneBox:GetText(), '"', "")
    if key == "" then ns.message("Pick or type an attunement first."); return end
    local target = selectedPlayer()
    if ns.isOfficer() and target and target ~= ns.playerName() then
      run('attune ' .. target .. ' "' .. key .. '"' .. (clear and " clear" or ""))
    else
      run('attune "' .. key .. '"' .. (clear and " clear" or ""))
    end
  end
  at(newButton(attuneBlock, L("Mark done"), 90, function() attune(false) end), attuneBlock, 214, -52)
  at(newButton(attuneBlock, L("Clear"), 70, function() attune(true) end), attuneBlock, 308, -52)
  ui.attuneInfo = at(newLabel(attuneBlock, "", "GameFontHighlightSmall"), attuneBlock, 0, -84)
  ui.attuneInfo:SetWidth(PAGE_WIDTH)
end

local function buildStandingsPage(page)
  ui.standingsPlayer = at(newLabel(page, "", "GameFontHighlight"), page, 0, 0)
  ui.standingsPlayer:SetWidth(PAGE_WIDTH)
  ui.standingsList = at(newLabel(page, "", "GameFontHighlightSmall"), page, 0, -28)
  ui.standingsList:SetWidth(PAGE_WIDTH)
end

local function buildToolsPage(page)
  local everyone = {
    { "Diagnostics", "diag" }, { "Raid status", "status" }, { "All commands", "help" }, { "Addon version", "version" }
  }
  for i, item in ipairs(everyone) do
    at(newButton(page, L(item[1]), 136, function() run(item[2]) end), page, ((i - 1) % 3) * 142, -math.floor((i - 1) / 3) * 28)
  end
  at(newButton(page, L("Hide minimap button"), 180, function() run("minimap hide") end), page, 0, -64)

  officerOnly(at(newLabel(page, "Officer", "GameFontNormalSmall"), page, 0, -100))
  officerOnly(at(newButton(page, "Export data", 136, function() run("export") end), page, 0, -116))
  officerOnly(at(newButton(page, "Officer setup", 136, function() run("officer list") end), page, 142, -116))
  forModule("games", at(newButton(page, "Games help", 136, function() run("games") end), page, 284, -116), true)
  ui.exportHelp = officerOnly(at(newLabel(page,
    "Export: press it, then /reload so the game saves; the companion uploads it to Discord.", "GameFontHighlightSmall"), page, 0, -142))
  ui.exportHelp:SetWidth(PAGE_WIDTH)

  -- Optional modules: your own switch, and (officers) the guild-wide one.
  at(newLabel(page, L("Modules"), "GameFontNormal"), page, 0, -164)
  ui.moduleRows = {}
  for i, module in ipairs(ns.MODULES or {}) do
    local y = -182 - (i - 1) * 22
    local row = { key = module.key }
    row.label = at(newLabel(page, "", "GameFontHighlightSmall"), page, 0, y - 4)
    row.label:SetWidth(330)
    row.mine = at(newButton(page, "", 86, function()
      local s = ns.getSettings and ns.getSettings()
      local mineOff = s and s.modules and s.modules[module.key] == false
      run("modules " .. (mineOff and "on " or "off ") .. module.key)
    end), page, 334, y)
    row.guild = officerOnly(at(newButton(page, "", 110, function()
      local s = ns.getSettings and ns.getSettings()
      local guildOff = s and s.guildModules and s.guildModules.off and s.guildModules.off[module.key]
      run("modules guild " .. (guildOff and "on " or "off ") .. module.key)
    end), page, 424, y))
    ui.moduleRows[i] = row
  end

  local help = at(newLabel(page,
    L("Minimap button hidden? /guilded minimap show. Problem? Press Diagnostics and send a screenshot to an officer."),
    "GameFontHighlightSmall"), page, 0, -300)
  help:SetWidth(PAGE_WIDTH)
end

-- Dungeon challenge: the run being recorded, recent runs, and the
-- season's points from Discord (roadmap D9). Start/complete/abandon check
-- permissions themselves (group leader, officer, or solo).
local function buildDungeonPage(page)
  ui.dgnCurrent = at(newLabel(page, "", "GameFontHighlight"), page, 0, 0)
  ui.dgnCurrent:SetWidth(PAGE_WIDTH)
  at(newButton(page, L("Status"), 90, function() run("dungeon status") end), page, 0, -44)
  at(newButton(page, L("Start now"), 90, function() run("dungeon start") end), page, 94, -44)
  local complete = at(newButton(page, L("Complete"), 90), page, 188, -44)
  confirmClick(complete, L("Complete"), function() run("dungeon complete") end)
  local abandon = at(newButton(page, L("Abandon"), 90), page, 282, -44)
  confirmClick(abandon, L("Abandon"), function() run("dungeon abandon") end)
  at(newButton(page, L("Check"), 90, function() run("dungeon check") end), page, 376, -44)

  at(newLabel(page, L("Recent runs"), "GameFontNormal"), page, 0, -80)
  ui.dgnRuns = at(newLabel(page, "", "GameFontHighlightSmall"), page, 0, -98)
  ui.dgnRuns:SetWidth(PAGE_WIDTH)
  ui.dgnBoardTitle = at(newLabel(page, "", "GameFontNormal"), page, 0, -196)
  ui.dgnBoard = at(newLabel(page, "", "GameFontHighlightSmall"), page, 0, -214)
  ui.dgnBoard:SetWidth(PAGE_WIDTH)
end

-- The Home page: what is going on right now, your standing and gear, whether
-- your data has reached Discord, and the few things worth pressing first.
local STATUS_WORD = { READY = "Ready", PARTIAL = "Partly ready", NOT_READY = "Not ready" }
local function statusWord(status) return L(STATUS_WORD[status] or tostring(status or "?")) end

local function heading(page, text, y)
  return at(newLabel(page, text, "GameFontNormal"), page, 0, y)
end

local function buildHomePage(page)
  ui.homeGreeting = at(newLabel(page, "", "GameFontNormalLarge"), page, 0, 0)
  ui.homeGreeting:SetWidth(PAGE_WIDTH)

  heading(page, L("Right now"), -36)
  ui.homeNow = at(newLabel(page, "", "GameFontHighlight"), page, 0, -54)
  ui.homeNow:SetWidth(PAGE_WIDTH)

  heading(page, L("Your standing (from Discord)"), -112)
  ui.homeStanding = at(newLabel(page, "", "GameFontHighlight"), page, 0, -130)
  ui.homeStanding:SetWidth(PAGE_WIDTH)

  heading(page, L("Your gear check"), -184)
  ui.homeGear = at(newLabel(page, "", "GameFontHighlight"), page, 0, -202)
  ui.homeGear:SetWidth(PAGE_WIDTH)

  heading(page, L("Sending your data to Discord"), -260)
  ui.homeSync = at(newLabel(page, "", "GameFontHighlight"), page, 0, -278)
  ui.homeSync:SetWidth(PAGE_WIDTH)

  at(newButton(page, L("Check my gear"), 170, function() run("inspect") end, 30), page, 0, -322)
  at(newButton(page, L("Send to Discord now"), 190, function()
    if ns.syncNow and ns.syncNow.reloadNow then ns.syncNow.reloadNow() else run("sync") end
  end, 30), page, 178, -322)
  at(newButton(page, L("Standings"), 130, function() ui.selectTabByName("Standings") end, 30), page, 376, -322)
  officerOnly(at(newButton(page, L("Run a raid"), 170, function() ui.selectTabByName("Raid") end, 30), page, 0, -360))
  officerOnly(at(newButton(page, L("Give loot"), 190, function() ui.selectTabByName("Loot") end, 30), page, 178, -360))
  at(newLabel(page, L("Everything here is also a chat command: /guilded help lists them."), "GameFontDisableSmall"), page, 0, -402)
end

-- Sidebar order: pages are grouped under these headings.
local GROUPS = { "Overview", "Raid night", "Fun and runs", "System" }
local TAB_DEFS = {
  { name = "Home", hint = "what is going on, and your data", group = "Overview", build = buildHomePage },
  { name = "Me", hint = "your gear check and attunements", group = "Overview", usesPlayer = true, build = buildMePage },
  { name = "Standings", hint = "EP, GP and PR from Discord", group = "Overview", usesPlayer = true, build = buildStandingsPage },
  { name = "Raid", hint = "run a raid: start, bosses, attendance", group = "Raid night", officer = true, usesPlayer = true, build = buildRaidPage },
  { name = "EPGP", hint = "award EP and GP", group = "Raid night", officer = true, usesPlayer = true, build = buildEpgpPage },
  { name = "Loot", hint = "bids and loot", group = "Raid night", officer = true, usesPlayer = true, build = buildLootPage },
  { name = "Dungeons", hint = "the run being recorded, points", group = "Fun and runs", module = "dungeon", build = buildDungeonPage },
  { name = "Games", hint = "fun roll games", group = "Fun and runs", module = "games", usesPlayer = true, build = buildGamesPage },
  { name = "Tools", hint = "switch parts on or off, diagnostics", group = "System", build = buildToolsPage }
}

-- ---------------------------------------------------------------------
-- Refresh: rank-based visibility plus current state in the labels
-- ---------------------------------------------------------------------

local function standingsRows()
  local db = ns.getDb and ns.getDb()
  local rows = {}
  for name, row in pairs(db and db.standings and db.standings.players or {}) do
    table.insert(rows, { name = name, row = row })
  end
  table.sort(rows, function(a, b) return a.row.pr > b.row.pr end)
  return rows
end

local selectTab

local function clock(seconds)
  seconds = math.max(0, math.floor(seconds or 0))
  return string.format("%d:%02d", math.floor(seconds / 60), seconds % 60)
end

local function refreshDungeons(db)
  if not ui.dgnCurrent then return end
  local d = db.dungeon or {}
  local run = d.current
  if run then
    local kills, deaths, tracked = 0, 0, false
    for _, encounter in ipairs(run.encounters or {}) do if encounter.success then kills = kills + 1 end end
    for _, player in pairs(run.players or {}) do
      if type(player.deaths) == "number" then deaths = deaths + player.deaths; tracked = true end
    end
    local now = GetServerTime and GetServerTime() or time()
    local timer = run.startedAt and clock(now - run.startedAt) or L("waiting for the first pull")
    ui.dgnCurrent:SetText(string.format("%s - %s - %s\n%s %d%s   %s", run.name or "?", run.state or "?", timer,
      L("Bosses"), kills, run.bossCount and ("/" .. run.bossCount) or "",
      tracked and string.format(L("Deaths %d"), deaths) or ""))
    -- Keep the timer moving while this tab is open.
    if run.state == "ACTIVE" and ui.tabs[ui.currentTab or 0] and ui.tabs[ui.currentTab].name == "Dungeons"
      and not ui.dgnTickPending and C_Timer then
      ui.dgnTickPending = true
      C_Timer.After(1, function() ui.dgnTickPending = false; refresh() end)
    end
  else
    ui.dgnCurrent:SetText(L("No dungeon run in progress. Enter a dungeon: the timer starts on the first pull and stops on the last boss."))
  end

  local runs = {}
  for _, stored in pairs(d.runs or {}) do table.insert(runs, stored) end
  table.sort(runs, function(a, b) return (a.endedAt or a.detectedAt or 0) > (b.endedAt or b.detectedAt or 0) end)
  local lines = {}
  for i = 1, math.min(6, #runs) do
    local r = runs[i]
    local shown = r.state == "COMPLETED" and r.durationSec and clock(r.durationSec) or string.lower(r.state or "?")
    table.insert(lines, string.format("%s  %s  %s", r.name or "?", shown, r.synced and L("on Discord") or L("waiting to sync")))
  end
  ui.dgnRuns:SetText(#lines > 0 and table.concat(lines, "\n") or L("None yet."))

  local board = GuildedDungeonBoard
  if type(board) == "table" and type(board.rows) == "table" and #board.rows > 0 then
    ui.dgnBoardTitle:SetText(string.format(L("Dungeon points - %s (from Discord)"), tostring(board.season or "")))
    local rows = {}
    for i, row in ipairs(board.rows) do
      if i > 8 then break end
      table.insert(rows, string.format("%2d. %-14s %d", i, tostring(row.name), tonumber(row.points) or 0))
    end
    ui.dgnBoard:SetText(table.concat(rows, "\n"))
  else
    ui.dgnBoardTitle:SetText(L("Dungeon points"))
    ui.dgnBoard:SetText(L("No points yet. They come from Discord after an officer imports the runs."))
  end
end

local function layoutTabs(officer)
  local y = -62
  local firstVisible
  ui.groupLabels = ui.groupLabels or {}
  for _, label in pairs(ui.groupLabels) do label:Hide() end
  for _, group in ipairs(GROUPS) do
    local any = false
    for _, tab in ipairs(ui.tabs) do
      if tab.group == group and (officer or not tab.officer) and (not tab.module or moduleOn(tab.module)) then any = true end
    end
    if any then
      local label = ui.groupLabels[group]
      if not label then
        label = newLabel(panel, "", "GameFontNormalSmall")
        ui.groupLabels[group] = label
      end
      label:SetText(string.upper(L(group)))
      at(label, panel, 24, y)
      label:Show()
      y = y - 16
      for i, tab in ipairs(ui.tabs) do
        if tab.group == group then
          local visible = (officer or not tab.officer) and (not tab.module or moduleOn(tab.module))
          tab.visible = visible
          if visible then
            at(tab.button, panel, 20, y)
            tab.button:Show()
            y = y - 28
            firstVisible = firstVisible or i
          else
            tab.button:Hide()
            tab.page:Hide()
          end
        end
      end
      y = y - 8
    end
  end
  local current = ui.tabs[ui.currentTab or 0]
  if not current or not current.visible then selectTab(firstVisible) end
end

local function moduleSignature()
  local parts = {}
  for _, module in ipairs(ns.MODULES or {}) do table.insert(parts, moduleOn(module.key) and "1" or "0") end
  return table.concat(parts)
end

-- Tools tab rows: "Roll games - on", your switch, and the guild switch.
local function refreshModuleRows()
  local s = ns.getSettings and ns.getSettings() or {}
  for _, row in ipairs(ui.moduleRows or {}) do
    local guildOff = s.guildModules and s.guildModules.off and s.guildModules.off[row.key]
    local mineOff = s.modules and s.modules[row.key] == false
    local state
    if guildOff then state = L("off for the whole guild")
    elseif mineOff then state = L("off (your choice)")
    elseif not moduleOn(row.key) then state = L("on after /reload")
    else state = L("on") end
    row.label:SetText(L(ns.moduleName(row.key)) .. " - " .. state)
    row.mine:SetText(mineOff and L("Turn on") or L("Turn off"))
    row.guild:SetText(guildOff and "Guild: on" or "Guild: off")
  end
end

-- Home page text: plain-language state, and the Discord-sync line.
local function refreshHome(db, officer, me)
  if not ui.homeGreeting then return end
  ui.homeGreeting:SetText(string.format("%s   |cff999999%s|r", me, officer and L("Officer") or L("Member")))

  local now = {}
  local raid = ns.getActiveRaid and ns.getActiveRaid()
  table.insert(now, raid and string.format(L("Raid running: %s (%d seen in your group)"), raid.title, ns.getPresenceCount and ns.getPresenceCount() or 0)
    or L("No raid is running."))
  local run = db.dungeon and db.dungeon.current
  if run then table.insert(now, string.format(L("Dungeon run: %s (%s)"), run.name or "?", string.lower(run.state or "?"))) end
  local gameText = moduleOn("games") and ns.games and ns.games.statusText and ns.games.statusText() or ""
  if gameText ~= "" and gameText ~= "No games running." then table.insert(now, gameText) end
  local bidText = moduleOn("bidding") and ns.bidding and ns.bidding.statusText and ns.bidding.statusText() or ""
  if bidText ~= "" then table.insert(now, bidText) end
  ui.homeNow:SetText(table.concat(now, "\n"))

  local row = ns.getStanding and ns.getStanding(me)
  ui.homeStanding:SetText(row and string.format("EP %d    GP %d    PR %.2f", row.ep, row.gp, row.pr)
    or (ns.standingProblemText and ns.standingProblemText(me)) or L("No standing yet."))

  local snapshot = db.readiness and db.readiness[me]
  if snapshot then
    local problems = 0
    for _, finding in ipairs(snapshot.findings or {}) do if finding.severity ~= "INFO" then problems = problems + 1 end end
    ui.homeGear:SetText(problems == 0 and string.format(L("%s: nothing missing."), statusWord(snapshot.status))
      or string.format(L("%s: %d thing(s) to fix (see Me)."), statusWord(snapshot.status), problems))
  else
    ui.homeGear:SetText(L("No gear check yet. Press Check my gear."))
  end

  ui.homeSync:SetText(ns.syncNow and ns.syncNow.statusLine and ns.syncNow.statusLine()
    or L("Your data reaches Discord after you /reload or log out (an officer's companion sends it)."))
  if ui.sidebarSync then
    ui.sidebarSync:SetText(ns.syncNow and ns.syncNow.isDirty and ns.syncNow.isDirty() and L("Unsent changes") or L("All saved"))
  end
end

refresh = function()
  if not panel or not panel:IsShown() then return end
  local db = ns.getDb and ns.getDb()
  if not db then return end
  local officer = ns.isOfficer()
  local modules = moduleSignature()
  if ui.lastOfficer ~= officer or ui.lastModules ~= modules then
    ui.lastOfficer = officer
    ui.lastModules = modules
    for _, widget in ipairs(ui.officerOnly) do
      if officer then widget:Show() else widget:Hide() end
    end
    for _, entry in ipairs(ui.moduleWidgets or {}) do
      if moduleOn(entry.key) and (officer or not entry.officer) then entry.widget:Show() else entry.widget:Hide() end
    end
    layoutTabs(officer)
  end
  refreshModuleRows()

  local me = ns.playerName()
  local name = selectedPlayer()
  refreshHome(db, officer, me)

  if officer then
    local raid = ns.getActiveRaid and ns.getActiveRaid()
    ui.raidInfo:SetText(raid and string.format("Active raid: |cffffffff%s|r (started %s, %d seen in group)", raid.title,
      raid.startedAt, ns.getPresenceCount and ns.getPresenceCount() or 0) or "No active raid.")

    local account = name and db.epgp[name]
    local discord = name and ns.getStanding and ns.getStanding(name)
    if not name then
      ui.epgpInfo:SetText("Pick a player at the top (target them, or Me / Group...).")
    else
      -- Discord = the bot's official totals; "this PC" = entries recorded
      -- here that may not have been imported yet.
      local lines = { name }
      table.insert(lines, discord and string.format("Discord:  EP %d   GP %d   PR %.2f", discord.ep, discord.gp, discord.pr)
        or "Discord:  no standings yet")
      if account then table.insert(lines, string.format("Recorded on this PC:  EP %d   GP %d", account.ep, account.gp)) end
      ui.epgpInfo:SetText(table.concat(lines, "\n"))
    end

    ui.gamesStatus:SetText(moduleOn("games") and ns.games and ns.games.statusText and ns.games.statusText() or "")
    ui.bidStatus:SetText(moduleOn("bidding") and ns.bidding and ns.bidding.statusText and ns.bidding.statusText() or "")
    -- Keep the bid countdown moving while bidding is open.
    local auction = moduleOn("bidding") and ns.bidding and ns.bidding.current
    if auction and auction.open and not ui.bidTickPending and C_Timer then
      ui.bidTickPending = true
      C_Timer.After(1, function() ui.bidTickPending = false; refresh() end)
    end
  end

  local snapshot = db.readiness[me]
  if snapshot then
    local problems = {}
    for _, finding in ipairs(snapshot.findings or {}) do
      if finding.severity ~= "INFO" then table.insert(problems, finding.message) end
    end
    ui.gearInfo:SetText(string.format(L("Last check: %s%s\n%s"), snapshot.status or "?",
      snapshot.itemLevel and string.format(L("   Item level %s"), snapshot.itemLevel) or "",
      #problems > 0 and table.concat(problems, "\n") or L("Nothing missing.")))
  else
    ui.gearInfo:SetText(L("No gear check yet."))
  end

  local attuneTarget = (officer and name) or me
  local done = {}
  for key, entry in pairs(db.attunements[attuneTarget] or {}) do
    if entry.completed then table.insert(done, key) end
  end
  table.sort(done)
  local doneText = #done > 0 and table.concat(done, ", ") or L("none recorded")
  ui.attuneInfo:SetText((attuneTarget == me and string.format(L("You have done: %s"), doneText)
    or string.format(L("%s has done: %s"), attuneTarget, doneText)) ..
    (officer and L("\n(Officers: Mark done applies to the selected player.)") or ""))

  refreshDungeons(db)

  local updatedAt = ns.getStandingsUpdatedAt and ns.getStandingsUpdatedAt()
  if not updatedAt then
    ui.standingsPlayer:SetText(L("No standings yet."))
    ui.standingsList:SetText(L("They come from the Discord bot through an officer's addon. Check back after the next raid."))
  else
    local row = name and ns.getStanding and ns.getStanding(name)
    ui.standingsPlayer:SetText(row and string.format("%s:  EP %d   GP %d   PR %.2f", name, row.ep, row.gp, row.pr)
      or (ns.standingProblemText and ns.standingProblemText(name))
      or string.format(L("%s: no standings (character not linked on Discord?)"), name or "?"))
    local lines = { string.format(L("Top by PR (from Discord, %s):"), updatedAt) }
    local rows = standingsRows()
    for i = 1, math.min(15, #rows) do
      local r = rows[i]
      table.insert(lines, string.format("%2d. %-14s PR %.2f   EP %d / GP %d", i, r.name, r.row.pr, r.row.ep, r.row.gp))
    end
    ui.standingsList:SetText(table.concat(lines, "\n"))
  end
end

selectTab = function(index)
  if not index or not ui.tabs[index] then return end
  ui.currentTab = index
  for i, tab in ipairs(ui.tabs) do
    if i == index then tab.page:Show(); tab.button:LockHighlight() else tab.page:Hide(); tab.button:UnlockHighlight() end
  end
  if ui.pageTitle then
    ui.pageTitle:SetText(L(ui.tabs[index].name) .. (ui.tabs[index].hint and ("   |cff999999" .. L(ui.tabs[index].hint) .. "|r") or ""))
  end
  -- The Player field only matters on pages that act on a player.
  for _, widget in ipairs(ui.playerRow or {}) do
    if ui.tabs[index].usesPlayer then widget:Show() else widget:Hide() end
  end
  local s = settings()
  if s then s.panelTab = ui.tabs[index].name end
  if picker then picker:Hide() end
  refresh()
end

-- ---------------------------------------------------------------------
-- Window
-- ---------------------------------------------------------------------

local function buildPanel()
  panel = CreateFrame("Frame", "GuildedPanel", UIParent, BackdropTemplateMixin and "BackdropTemplate" or nil)
  panel:SetWidth(PANEL_WIDTH)
  panel:SetHeight(PANEL_HEIGHT)
  panel:SetFrameStrata("DIALOG")
  panel:SetPoint("CENTER")
  panel:SetMovable(true)
  panel:SetClampedToScreen(true)
  panel:EnableMouse(true)
  panel:RegisterForDrag("LeftButton")
  panel:SetScript("OnDragStart", panel.StartMoving)
  panel:SetScript("OnDragStop", panel.StopMovingOrSizing)
  if panel.SetBackdrop then
    panel:SetBackdrop({
      bgFile = "Interface\\DialogFrame\\UI-DialogBox-Background",
      edgeFile = "Interface\\DialogFrame\\UI-DialogBox-Border",
      tile = true, tileSize = 32, edgeSize = 32,
      insets = { left = 11, right = 12, top = 12, bottom = 11 }
    })
  end

  -- Which page this is, and what it is for.
  ui.pageTitle = newLabel(panel, "", "GameFontNormal")
  ui.pageTitle:SetPoint("TOPLEFT", panel, "TOPLEFT", CONTENT_X, -16)

  -- Sidebar background, title and rank line.
  local sidebar = panel:CreateTexture(nil, "BACKGROUND")
  sidebar:SetPoint("TOPLEFT", panel, "TOPLEFT", 14, -14)
  sidebar:SetPoint("BOTTOMLEFT", panel, "BOTTOMLEFT", 14, 14)
  sidebar:SetWidth(SIDEBAR_WIDTH)
  if sidebar.SetColorTexture then sidebar:SetColorTexture(0, 0, 0, 0.35) end
  local title = newLabel(panel, "Guilded", "GameFontNormalLarge")
  title:SetPoint("TOPLEFT", panel, "TOPLEFT", 24, -20)
  local close = CreateFrame("Button", nil, panel, "UIPanelCloseButton")
  close:SetPoint("TOPRIGHT", panel, "TOPRIGHT", -4, -4)

  -- Sidebar footer: one button that gets your data to Discord, and whether anything is waiting.
  ui.sidebarSync = newLabel(panel, "", "GameFontHighlightSmall")
  ui.sidebarSync:SetPoint("BOTTOMLEFT", panel, "BOTTOMLEFT", 24, 70)
  local sendButton = newButton(panel, L("Send to Discord"), 132, function()
    if ns.syncNow and ns.syncNow.reloadNow then ns.syncNow.reloadNow() else run("sync") end
  end, 26)
  sendButton:SetPoint("BOTTOMLEFT", panel, "BOTTOMLEFT", 22, 40)

  -- Shared player field (shown only on pages that act on a player).
  ui.playerRow = {}
  local function playerWidget(widget) table.insert(ui.playerRow, widget) return widget end
  playerWidget(at(newLabel(panel, L("Player")), panel, CONTENT_X, -32))
  ui.playerBox = playerWidget(at(newEdit(panel, 150), panel, CONTENT_X + 54, -28))
  ui.playerBox:SetScript("OnTextChanged", function() refresh() end)
  playerWidget(at(newButton(panel, L("Target"), 70, fillFromTarget), panel, CONTENT_X + 212, -28))
  playerWidget(at(newButton(panel, L("Me"), 50, function() setPlayer(ns.playerName()) end), panel, CONTENT_X + 286, -28))
  playerWidget(at(newButton(panel, L("Group..."), 84, showPicker), panel, CONTENT_X + 340, -28))

  for i, def in ipairs(TAB_DEFS) do
    local page = CreateFrame("Frame", nil, panel)
    page:SetPoint("TOPLEFT", panel, "TOPLEFT", CONTENT_X, -66)
    page:SetPoint("BOTTOMRIGHT", panel, "BOTTOMRIGHT", -22, 44)
    def.build(page)
    page:Hide()
    local tabButton = newButton(panel, L(def.name), 132, function() selectTab(i) end, 24)
    ui.tabs[i] = { name = def.name, hint = def.hint, group = def.group, officer = def.officer, module = def.module, usesPlayer = def.usesPlayer, page = page, button = tabButton }
    tabButton:SetScript("OnEnter", function(self)
      if not GameTooltip then return end
      GameTooltip:SetOwner(self, "ANCHOR_RIGHT")
      GameTooltip:AddLine(L(def.name))
      if def.hint then GameTooltip:AddLine(L(def.hint), 1, 1, 1) end
      GameTooltip:Show()
    end)
    tabButton:SetScript("OnLeave", function() if GameTooltip then GameTooltip:Hide() end end)
  end

  -- Latest addon message, so results show here instead of only in chat.
  ui.status = newLabel(panel, "", "GameFontHighlightSmall")
  ui.status:SetPoint("BOTTOMLEFT", panel, "BOTTOMLEFT", CONTENT_X, 18)
  ui.status:SetWidth(PAGE_WIDTH)
  ui.status:SetHeight(24)
  ns.onMessage = function(text)
    if ui.status then ui.status:SetText(text) end
  end
  ns.onGamesChange = function() refresh() end
  ns.onBiddingChange = function() refresh() end
  ns.onDungeonChange = function() refresh() end
  ns.onModulesChange = function() refresh() end

  -- Targeting a player while the window is open fills the Player field.
  panel:RegisterEvent("PLAYER_TARGET_CHANGED")
  panel:SetScript("OnEvent", function()
    if UnitExists("target") and UnitIsPlayer("target") and not ui.playerBox:HasFocus() then
      setPlayer((UnitName("target")))
    end
  end)
  panel:SetScript("OnShow", function()
    ui.lastOfficer = nil -- re-check rank and modules every time the window opens
    if UnitExists("target") and UnitIsPlayer("target") then
      setPlayer((UnitName("target")))
    elseif ui.playerBox:GetText() == "" then
      setPlayer(ns.playerName())
    end
    refresh()
  end)

  -- Shift-clicking an item normally inserts its link into chat; also put it
  -- in our Item box when that box is selected. hooksecurefunc runs after the
  -- original and never replaces it, so it cannot taint Blizzard's code.
  if hooksecurefunc and ChatEdit_InsertLink then
    hooksecurefunc("ChatEdit_InsertLink", function(link)
      if ui.itemBox and ui.itemBox:HasFocus() and link then ui.itemBox:Insert(link) end
    end)
  end

  -- Escape closes the window like other dialogs.
  if UISpecialFrames then table.insert(UISpecialFrames, "GuildedPanel") end

  local s = settings()
  ui.currentTab = 1
  for i, tab in ipairs(ui.tabs) do
    if s and s.panelTab == tab.name then ui.currentTab = i end
  end
  panel:Hide()
end

function ui.selectTabByName(name)
  for i, tab in ipairs(ui.tabs) do
    if tab.name == name and tab.visible then selectTab(i) return end
  end
end

local function togglePanel()
  local ok, err = pcall(function()
    if not panel then buildPanel() end
    if panel:IsShown() then
      panel:Hide()
    else
      panel:Show()
      if ui.currentTab then selectTab(ui.currentTab) end
    end
  end)
  if not ok then ns.message("Tools window failed to open: " .. tostring(err)) end
end

-- ---------------------------------------------------------------------
-- Minimap button
-- ---------------------------------------------------------------------

local function place(angle)
  local radius = (Minimap:GetWidth() / 2) + RADIUS_PAD
  button:ClearAllPoints()
  button:SetPoint("CENTER", Minimap, "CENTER", math.cos(angle) * radius, math.sin(angle) * radius)
end

local function cursorAngle()
  local mx, my = Minimap:GetCenter()
  local cx, cy = GetCursorPosition()
  local scale = Minimap:GetEffectiveScale()
  return atan2(cy / scale - my, cx / scale - mx)
end

local function buildButton()
  button = CreateFrame("Button", "GuildedMinimapButton", Minimap)
  button:SetWidth(32)
  button:SetHeight(32)
  button:SetFrameStrata("MEDIUM")
  button:SetFrameLevel(8)

  local icon = button:CreateTexture(nil, "ARTWORK")
  icon:SetTexture(ICON)
  icon:SetWidth(20)
  icon:SetHeight(20)
  icon:SetPoint("TOPLEFT", button, "TOPLEFT", 7, -5)

  local border = button:CreateTexture(nil, "OVERLAY")
  border:SetTexture("Interface\\Minimap\\MiniMap-TrackingBorder")
  border:SetWidth(53)
  border:SetHeight(53)
  border:SetPoint("TOPLEFT", button, "TOPLEFT", 0, 0)

  button:SetHighlightTexture("Interface\\Minimap\\UI-Minimap-ZoomButton-Highlight")
  button:RegisterForClicks("LeftButtonUp", "RightButtonUp")
  button:RegisterForDrag("LeftButton")
  button:SetScript("OnClick", function(_, mouseButton)
    if mouseButton == "RightButton" then run("inspect") else togglePanel() end
  end)
  button:SetScript("OnEnter", function(self)
    GameTooltip:SetOwner(self, "ANCHOR_LEFT")
    GameTooltip:AddLine("Guilded")
    GameTooltip:AddLine(L("Left-click: open the tools window"), 1, 1, 1)
    GameTooltip:AddLine(L("Right-click: check my gear"), 1, 1, 1)
    GameTooltip:AddLine(L("Drag: move this button"), 1, 1, 1)
    GameTooltip:Show()
  end)
  button:SetScript("OnLeave", function() GameTooltip:Hide() end)
  button:SetScript("OnDragStart", function(self)
    self:SetScript("OnUpdate", function()
      local angle = cursorAngle()
      place(angle)
      local s = settings()
      if s then s.minimapAngle = angle end
    end)
  end)
  button:SetScript("OnDragStop", function(self) self:SetScript("OnUpdate", nil) end)
end

local function init()
  if built then return end
  built = true
  buildButton()
  local s = settings()
  place((s and s.minimapAngle) or DEFAULT_ANGLE)
  if s and s.minimapHidden then button:Hide() end
end

-- /guilded minimap show|hide|reset  and  /guilded menu
ns.commandHandlers = ns.commandHandlers or {}
ns.commandHandlers["menu"] = function() togglePanel() end
ns.commandHandlers["minimap"] = function(args)
  local action = string.lower(args[1] or "")
  local s = settings()
  if not button or not s then ns.message("The minimap button is not ready yet."); return end
  if action == "hide" then
    s.minimapHidden = true
    button:Hide()
    ns.message("Minimap button hidden. /guilded minimap show brings it back.")
  elseif action == "show" then
    s.minimapHidden = false
    button:Show()
  elseif action == "reset" then
    s.minimapHidden = false
    s.minimapAngle = DEFAULT_ANGLE
    place(DEFAULT_ANGLE)
    button:Show()
  else
    ns.message("/guilded minimap show | hide | reset   (or /guilded menu to open the tools window)")
  end
end
ns.commandHelp = ns.commandHelp or {}
table.insert(ns.commandHelp, "/guilded minimap show|hide|reset - the minimap button")

-- Wait until the world has loaded so Core.lua's saved settings exist.
local frame = CreateFrame("Frame")
frame:RegisterEvent("PLAYER_ENTERING_WORLD")
frame:SetScript("OnEvent", function()
  local ok, err = pcall(init)
  if not ok then ns.message("Minimap button failed to load: " .. tostring(err)) end
end)
