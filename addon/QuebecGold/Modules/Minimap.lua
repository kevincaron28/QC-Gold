-- Minimap button and the Quebec Gold tools window.
--
-- Each rank sees only what it can use:
--   officers: Raid, EPGP, Casino, Me, Standings, Tools
--   members:  Me, Standings, Tools (officer-only tools hidden)
-- Rank is re-checked every time the window opens, so a promotion shows up
-- without a reload.
--
-- One shared Player box sits at the top. Targeting a player fills it in
-- automatically, Me / Group... fill it on demand (Group... lists your
-- raid/party, or online guildmates when solo). Every button runs the
-- matching /qg command, so permissions and validation stay in one place.
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
local PANEL_WIDTH = 480
local PANEL_HEIGHT = 470
local ATTUNEMENT_PRESETS = { "Molten Core", "Onyxia", "Blackwing Lair", "Naxxramas" }

local button, panel
local built = false
local ui = { tabs = {}, officerOnly = {}, currentTab = nil }

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

local function newButton(parent, text, width, onClick)
  local b = CreateFrame("Button", nil, parent, "UIPanelButtonTemplate")
  b:SetWidth(width or 110)
  b:SetHeight(22)
  b:SetText(text)
  if onClick then b:SetScript("OnClick", onClick) end
  return b
end

-- Hidden entirely for members (not just greyed out).
local function officerOnly(widget)
  table.insert(ui.officerOnly, widget)
  return widget
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

-- Casino wager from the Gold and Silver boxes, as "10g50s".
local function wager()
  local gold = tonumber(ui.goldBox and ui.goldBox:GetText() or "") or 0
  local silver = tonumber(ui.silverBox and ui.silverBox:GetText() or "") or 0
  if gold <= 0 and silver <= 0 then
    ns.message("Enter a wager in the Gold and/or Silver box first.")
    return nil
  end
  return (gold > 0 and (gold .. "g") or "") .. (silver > 0 and (silver .. "s") or "")
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
    picker = CreateFrame("Frame", "QuebecGoldPlayerPicker", panel, BackdropTemplateMixin and "BackdropTemplate" or nil)
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
    picker.title = at(newLabel(picker, "Pick a player"), picker, 18, -16)
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
  picker.title:SetText(#names > 1 and "Pick a player" or "Nobody else found")
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

  at(newLabel(page, "Item (shift-click an item while this box is selected)"), page, 0, -198)
  ui.itemBox = at(newEdit(page, 380), page, 6, -216)
  at(newButton(page, "Give item + charge Amount as GP", 260, function()
    local name, n = needPlayer(), amount()
    local item = ui.itemBox:GetText()
    if item == "" then ns.message("Put the item in the Item box first."); return end
    if name and n then
      run("loot " .. name .. " " .. item .. " " .. n)
      run("gp " .. name .. " " .. n .. " " .. item)
      ui.itemBox:SetText("")
    end
  end), page, 0, -244)
end

local function buildCasinoPage(page)
  -- Wager: gold and silver.
  at(newLabel(page, "Wager"), page, 0, -4)
  ui.goldBox = at(newEdit(page, 44, true), page, 56, 0)
  at(newLabel(page, "g", "GameFontHighlight"), page, 104, -4)
  ui.silverBox = at(newEdit(page, 34, true), page, 122, 0)
  at(newLabel(page, "s", "GameFontHighlight"), page, 160, -4)
  local x = 178
  for _, preset in ipairs({ { "1g", 1, 0 }, { "5g", 5, 0 }, { "10g", 10, 0 }, { "50g", 50, 0 }, { "10s", 0, 10 }, { "50s", 0, 50 } }) do
    at(newButton(page, preset[1], 44, function()
      ui.goldBox:SetText(preset[2] > 0 and tostring(preset[2]) or "")
      ui.silverBox:SetText(preset[3] > 0 and tostring(preset[3]) or "")
    end), page, x, 0)
    x = x + 46
  end

  at(newLabel(page, "Group game - players type 1 in party/raid chat to join, then /roll", "GameFontNormalSmall"), page, 0, -32)
  local function host(game)
    return function()
      local w = wager()
      if w then run("casino " .. game .. " " .. w) end
    end
  end
  at(newButton(page, "Host Pot", 100, host("pot")), page, 0, -48)
  at(newButton(page, "Host Deathroll", 118, host("deathroll")), page, 104, -48)
  at(newButton(page, "Host Difference", 124, host("diff")), page, 226, -48)
  at(newButton(page, "Call the roll", 104, function() run("casino roll") end), page, 0, -76)
  at(newButton(page, "Remind", 76, function() run("casino remind") end), page, 108, -76)
  at(newButton(page, "Add player", 96, function()
    local name = needPlayer()
    if name then run("casino add " .. name) end
  end), page, 188, -76)
  local cancelGroup = at(newButton(page, "Cancel game", 100), page, 288, -76)
  confirmClick(cancelGroup, "Cancel game", function() run("casino cancel") end)

  at(newLabel(page, "One player vs you (the selected Player)", "GameFontNormalSmall"), page, 0, -108)
  local function house(command)
    return function()
      local name, w = needPlayer(), wager()
      if name and w then run("casino " .. string.format(command, name, w)) end
    end
  end
  at(newButton(page, "Blackjack", 90, house("blackjack %s %s")), page, 0, -124)
  at(newButton(page, "Stand for them", 112, function()
    local name = needPlayer()
    if name then run("casino stand " .. name) end
  end), page, 94, -124)
  at(newButton(page, "Over 50", 80, house("overunder %s over %s")), page, 210, -124)
  at(newButton(page, "Under 50", 84, house("overunder %s under %s")), page, 294, -124)
  x = 0
  for _, bet in ipairs({ "Red", "Black", "Even", "Odd" }) do
    at(newButton(page, bet, 62, house("roulette %s " .. string.lower(bet) .. " %s")), page, x, -152)
    x = x + 66
  end
  ui.straightBox = at(newEdit(page, 32, true), page, 272, -152)
  at(newButton(page, "Number", 74, function()
    local number = tonumber(ui.straightBox:GetText())
    if not number or number < 1 or number > 36 then ns.message("Type a number from 1 to 36 first."); return end
    house("roulette %s " .. number .. " %s")()
  end), page, 310, -152)
  at(newButton(page, "Cancel their game", 136, function()
    local name = needPlayer()
    if name then run("casino cancel " .. name) end
  end), page, 0, -180)

  at(newButton(page, "Ledger", 80, function() run("casino ledger") end), page, 140, -180)
  at(newButton(page, "Clear their debt", 124, function()
    local name = needPlayer()
    if name then run("casino debt clear " .. name) end
  end), page, 224, -180)

  ui.casinoStatus = at(newLabel(page, "", "GameFontHighlightSmall"), page, 0, -212)
  ui.casinoStatus:SetWidth(PANEL_WIDTH - 44)
  at(newLabel(page, "Gold moves by trade. Trades with you pay down casino debts automatically.", "GameFontDisableSmall"), page, 0, -268)
end

local function buildMePage(page)
  at(newButton(page, "Check my gear", 140, function() run("inspect") end), page, 0, 0)
  ui.gearInfo = at(newLabel(page, "", "GameFontHighlightSmall"), page, 0, -30)
  ui.gearInfo:SetWidth(PANEL_WIDTH - 44)

  at(newLabel(page, "Attunements"), page, 0, -100)
  local x = 0
  for _, preset in ipairs(ATTUNEMENT_PRESETS) do
    at(newButton(page, preset, 104, function() ui.attuneBox:SetText(preset) end), page, x, -120)
    x = x + 108
  end
  ui.attuneBox = at(newEdit(page, 200), page, 6, -152)
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
  at(newButton(page, "Mark done", 90, function() attune(false) end), page, 214, -152)
  at(newButton(page, "Clear", 70, function() attune(true) end), page, 308, -152)
  ui.attuneInfo = at(newLabel(page, "", "GameFontHighlightSmall"), page, 0, -184)
  ui.attuneInfo:SetWidth(PANEL_WIDTH - 44)
end

local function buildStandingsPage(page)
  ui.standingsPlayer = at(newLabel(page, "", "GameFontHighlight"), page, 0, 0)
  ui.standingsPlayer:SetWidth(PANEL_WIDTH - 44)
  ui.standingsList = at(newLabel(page, "", "GameFontHighlightSmall"), page, 0, -28)
  ui.standingsList:SetWidth(PANEL_WIDTH - 44)
end

local function buildToolsPage(page)
  local everyone = {
    { "Diagnostics", "diag" }, { "Raid status", "status" }, { "All commands", "help" }, { "Addon version", "version" }
  }
  for i, item in ipairs(everyone) do
    at(newButton(page, item[1], 136, function() run(item[2]) end), page, ((i - 1) % 3) * 142, -math.floor((i - 1) / 3) * 28)
  end
  at(newButton(page, "Hide minimap button", 180, function() run("minimap hide") end), page, 0, -64)

  officerOnly(at(newLabel(page, "Officer", "GameFontNormalSmall"), page, 0, -100))
  officerOnly(at(newButton(page, "Export data", 136, function() run("export") end), page, 0, -116))
  officerOnly(at(newButton(page, "Officer setup", 136, function() run("officer list") end), page, 142, -116))
  officerOnly(at(newButton(page, "Casino help", 136, function() run("casino") end), page, 284, -116))

  local help = at(newLabel(page,
    "Minimap button hidden? Type /qg minimap show.\n\n" ..
    "Something wrong? Press Diagnostics and send a screenshot to an officer.", "GameFontHighlightSmall"), page, 0, -156)
  help:SetWidth(PANEL_WIDTH - 44)
  ui.exportHelp = officerOnly(at(newLabel(page,
    "Export: press it, then /reload so the game saves; the companion uploads it to Discord.", "GameFontHighlightSmall"), page, 0, -210))
  ui.exportHelp:SetWidth(PANEL_WIDTH - 44)
end

local TAB_DEFS = {
  { name = "Raid", officer = true, build = buildRaidPage },
  { name = "EPGP", officer = true, build = buildEpgpPage },
  { name = "Casino", officer = true, build = buildCasinoPage },
  { name = "Me", build = buildMePage },
  { name = "Standings", build = buildStandingsPage },
  { name = "Tools", build = buildToolsPage }
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

local function layoutTabs(officer)
  local x = 18
  local firstVisible
  for i, tab in ipairs(ui.tabs) do
    local visible = officer or not tab.officer
    if visible then
      at(tab.button, panel, x, -40)
      tab.button:Show()
      x = x + 74
      firstVisible = firstVisible or i
    else
      tab.button:Hide()
      tab.page:Hide()
    end
  end
  local current = ui.tabs[ui.currentTab or 0]
  if not current or (current.officer and not officer) then selectTab(firstVisible) end
end

refresh = function()
  if not panel or not panel:IsShown() then return end
  local db = ns.getDb and ns.getDb()
  if not db then return end
  local officer = ns.isOfficer()
  if ui.lastOfficer ~= officer then
    ui.lastOfficer = officer
    for _, widget in ipairs(ui.officerOnly) do
      if officer then widget:Show() else widget:Hide() end
    end
    layoutTabs(officer)
  end

  local me = ns.playerName()
  local name = selectedPlayer()

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

    ui.casinoStatus:SetText(ns.casino and ns.casino.statusText and ns.casino.statusText() or "")
  end

  local snapshot = db.readiness[me]
  if snapshot then
    local problems = {}
    for _, finding in ipairs(snapshot.findings or {}) do
      if finding.severity ~= "INFO" then table.insert(problems, finding.message) end
    end
    ui.gearInfo:SetText(string.format("Last check: %s%s\n%s", snapshot.status or "?",
      snapshot.itemLevel and ("   Item level " .. snapshot.itemLevel) or "",
      #problems > 0 and table.concat(problems, "\n") or "Nothing missing."))
  else
    ui.gearInfo:SetText("No gear check yet.")
  end

  local attuneTarget = (officer and name) or me
  local done = {}
  for key, entry in pairs(db.attunements[attuneTarget] or {}) do
    if entry.completed then table.insert(done, key) end
  end
  table.sort(done)
  ui.attuneInfo:SetText((attuneTarget == me and "You have" or (attuneTarget .. " has")) .. " done: " ..
    (#done > 0 and table.concat(done, ", ") or "none recorded") ..
    (officer and "\n(Officers: Mark done applies to the selected player.)" or ""))

  local updatedAt = ns.getStandingsUpdatedAt and ns.getStandingsUpdatedAt()
  if not updatedAt then
    ui.standingsPlayer:SetText("No standings yet.")
    ui.standingsList:SetText("They come from the Discord bot through an officer's addon. Check back after the next raid.")
  else
    local row = name and ns.getStanding(name)
    ui.standingsPlayer:SetText(row and string.format("%s:  EP %d   GP %d   PR %.2f", name, row.ep, row.gp, row.pr)
      or ((name or "?") .. ": no standings (character not linked on Discord?)"))
    local lines = { "Top by PR (from Discord, " .. updatedAt .. "):" }
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
  local s = settings()
  if s then s.panelTab = ui.tabs[index].name end
  if picker then picker:Hide() end
  refresh()
end

-- ---------------------------------------------------------------------
-- Window
-- ---------------------------------------------------------------------

local function buildPanel()
  panel = CreateFrame("Frame", "QuebecGoldPanel", UIParent, BackdropTemplateMixin and "BackdropTemplate" or nil)
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

  local title = newLabel(panel, "Quebec Gold", "GameFontNormalLarge")
  title:SetPoint("TOP", panel, "TOP", 0, -16)
  local close = CreateFrame("Button", nil, panel, "UIPanelCloseButton")
  close:SetPoint("TOPRIGHT", panel, "TOPRIGHT", -4, -4)

  -- Shared player field.
  at(newLabel(panel, "Player"), panel, 22, -76)
  ui.playerBox = at(newEdit(panel, 130), panel, 76, -72)
  ui.playerBox:SetScript("OnTextChanged", function() refresh() end)
  at(newButton(panel, "Target", 70, fillFromTarget), panel, 214, -72)
  at(newButton(panel, "Me", 50, function() setPlayer(ns.playerName()) end), panel, 288, -72)
  at(newButton(panel, "Group...", 84, showPicker), panel, 342, -72)

  for i, def in ipairs(TAB_DEFS) do
    local page = CreateFrame("Frame", nil, panel)
    page:SetPoint("TOPLEFT", panel, "TOPLEFT", 22, -110)
    page:SetPoint("BOTTOMRIGHT", panel, "BOTTOMRIGHT", -18, 40)
    def.build(page)
    page:Hide()
    local tabButton = newButton(panel, def.name, 72, function() selectTab(i) end)
    ui.tabs[i] = { name = def.name, officer = def.officer, page = page, button = tabButton }
  end

  -- Latest addon message, so results show here instead of only in chat.
  ui.status = newLabel(panel, "", "GameFontHighlightSmall")
  ui.status:SetPoint("BOTTOMLEFT", panel, "BOTTOMLEFT", 22, 18)
  ui.status:SetWidth(PANEL_WIDTH - 44)
  ui.status:SetHeight(24)
  ns.onMessage = function(text)
    if ui.status then ui.status:SetText(text) end
  end
  ns.onCasinoChange = function() refresh() end

  -- Targeting a player while the window is open fills the Player field.
  panel:RegisterEvent("PLAYER_TARGET_CHANGED")
  panel:SetScript("OnEvent", function()
    if UnitExists("target") and UnitIsPlayer("target") and not ui.playerBox:HasFocus() then
      setPlayer((UnitName("target")))
    end
  end)
  panel:SetScript("OnShow", function()
    ui.lastOfficer = nil -- re-check rank every time the window opens
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
  if UISpecialFrames then table.insert(UISpecialFrames, "QuebecGoldPanel") end

  local s = settings()
  for i, tab in ipairs(ui.tabs) do
    if s and s.panelTab == tab.name then ui.currentTab = i end
  end
  panel:Hide()
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
  button = CreateFrame("Button", "QuebecGoldMinimapButton", Minimap)
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
    GameTooltip:AddLine("Quebec Gold")
    GameTooltip:AddLine("Left-click: open the tools window", 1, 1, 1)
    GameTooltip:AddLine("Right-click: check my gear", 1, 1, 1)
    GameTooltip:AddLine("Drag: move this button", 1, 1, 1)
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

-- /qg minimap show|hide|reset  and  /qg menu
ns.commandHandlers = ns.commandHandlers or {}
ns.commandHandlers["menu"] = function() togglePanel() end
ns.commandHandlers["minimap"] = function(args)
  local action = string.lower(args[1] or "")
  local s = settings()
  if not button or not s then ns.message("The minimap button is not ready yet."); return end
  if action == "hide" then
    s.minimapHidden = true
    button:Hide()
    ns.message("Minimap button hidden. /qg minimap show brings it back.")
  elseif action == "show" then
    s.minimapHidden = false
    button:Show()
  elseif action == "reset" then
    s.minimapHidden = false
    s.minimapAngle = DEFAULT_ANGLE
    place(DEFAULT_ANGLE)
    button:Show()
  else
    ns.message("/qg minimap show | hide | reset   (or /qg menu to open the tools window)")
  end
end
ns.commandHelp = ns.commandHelp or {}
table.insert(ns.commandHelp, "/qg minimap show|hide|reset - the minimap button")

-- Wait until the world has loaded so Core.lua's saved settings exist.
local frame = CreateFrame("Frame")
frame:RegisterEvent("PLAYER_ENTERING_WORLD")
frame:SetScript("OnEvent", function()
  local ok, err = pcall(init)
  if not ok then ns.message("Minimap button failed to load: " .. tostring(err)) end
end)
