-- /qg calendar check: does WoW Forever's in-game calendar work for addons?
--
-- Before building calendar sync we need to know three things about this
-- client: whether the calendar API exists, whether this character may create
-- events, and whether guild events are visible to addons. This command
-- checks all three, lists guild events for the next 14 days, prints the
-- result, and saves it in QuebecGoldDB.calendarCheck (so it rides along in
-- the next export). It only reads; it never creates or changes events.
local addonName, ns = ...
ns = ns or {}

local DAYS_AHEAD = 14
local WAIT_SECONDS = 3

local waiting = false

local function has(name)
  return C_Calendar ~= nil and type(C_Calendar[name]) == "function"
end

-- Calendar day in `days` from `today` ({ year, month, monthDay }).
local function addDays(today, days)
  local t = time({ year = today.year, month = today.month, day = today.monthDay, hour = 12 }) + days * 86400
  local d = date("*t", t)
  return { year = d.year, month = d.month, monthDay = d.day }
end

local function scan()
  local result = {
    checkedAt = ns.now(),
    apiPresent = C_Calendar ~= nil,
    functions = {},
    canAddEvent = nil,
    eventsByType = {},
    guildEvents = {},
    errors = {}
  }
  for _, name in ipairs({ "OpenCalendar", "SetAbsMonth", "GetNumDayEvents", "GetDayEvent", "CanAddEvent",
    "CreateGuildSignUpEvent", "CreateGuildAnnouncementEvent", "OpenEvent", "GetEventInfo", "EventGetInvite", "GetNumInvites" }) do
    result.functions[name] = has(name)
  end
  if not result.apiPresent then return result end

  local ok, err = pcall(function()
    if has("CanAddEvent") then result.canAddEvent = C_Calendar.CanAddEvent() and true or false end
    local now = C_DateAndTime and C_DateAndTime.GetCurrentCalendarTime and C_DateAndTime.GetCurrentCalendarTime()
    if not now then
      local d = date("*t")
      now = { year = d.year, month = d.month, monthDay = d.day }
    end
    if has("SetAbsMonth") then C_Calendar.SetAbsMonth(now.month, now.year) end
    for offset = 0, DAYS_AHEAD - 1 do
      local day = addDays(now, offset)
      local monthOffset = (day.year - now.year) * 12 + (day.month - now.month)
      local count = C_Calendar.GetNumDayEvents(monthOffset, day.monthDay) or 0
      for index = 1, count do
        local event = C_Calendar.GetDayEvent(monthOffset, day.monthDay, index)
        if event then
          local kind = tostring(event.calendarType or "UNKNOWN")
          result.eventsByType[kind] = (result.eventsByType[kind] or 0) + 1
          if kind == "GUILD_EVENT" or kind == "GUILD_ANNOUNCEMENT" then
            local start = event.startTime or {}
            table.insert(result.guildEvents, {
              title = tostring(event.title or "?"),
              kind = kind,
              date = string.format("%04d-%02d-%02d %02d:%02d", start.year or day.year, start.month or day.month,
                start.monthDay or day.monthDay, start.hour or 0, start.minute or 0),
              myStatus = event.inviteStatus
            })
          end
        end
      end
    end
  end)
  if not ok then table.insert(result.errors, tostring(err)) end
  return result
end

local function report(result)
  local db = ns.getDb and ns.getDb()
  if db then db.calendarCheck = result end
  if not result.apiPresent then
    ns.message("Calendar check: this client has NO calendar API for addons. Calendar sync isn't possible here.")
    return
  end
  local missing = {}
  for name, present in pairs(result.functions) do
    if not present then table.insert(missing, name) end
  end
  table.sort(missing)
  ns.message("Calendar check: calendar API found." .. (#missing > 0 and (" Missing: " .. table.concat(missing, ", ")) or " All needed functions are present."))
  ns.message("Can this character create events: " .. (result.canAddEvent == nil and "unknown" or (result.canAddEvent and "yes" or "no")))
  local kinds = {}
  for kind, count in pairs(result.eventsByType) do table.insert(kinds, kind .. " " .. count) end
  table.sort(kinds)
  ns.message(string.format("Next %d days: %s.", DAYS_AHEAD, #kinds > 0 and table.concat(kinds, ", ") or "no events at all"))
  if #result.guildEvents > 0 then
    for i = 1, math.min(8, #result.guildEvents) do
      local event = result.guildEvents[i]
      ns.message(string.format("  Guild event: %s - %s", event.date, event.title))
    end
  else
    ns.message("No guild events found. To test fully, have an officer create a test guild event in the calendar, then run this again.")
  end
  if #result.errors > 0 then ns.message("Errors: " .. table.concat(result.errors, " | ")) end
  ns.message("Saved. Send a screenshot of these lines (or /qg export) so we know what to build.")
end

-- The calendar loads asynchronously: ask for it, then scan once the game
-- says it's ready (or after a few seconds, whichever comes first).
local frame = CreateFrame("Frame")
frame:SetScript("OnEvent", function(self)
  if not waiting then return end
  waiting = false
  self:UnregisterEvent("CALENDAR_UPDATE_EVENT_LIST")
  local ok, err = pcall(function() report(scan()) end)
  if not ok then ns.message("Calendar check failed: " .. tostring(err)) end
end)

local function check()
  if C_Calendar == nil then
    report(scan())
    return
  end
  waiting = true
  frame:RegisterEvent("CALENDAR_UPDATE_EVENT_LIST")
  ns.message("Checking the in-game calendar...")
  pcall(function() if has("OpenCalendar") then C_Calendar.OpenCalendar() end end)
  if C_Timer and C_Timer.After then
    C_Timer.After(WAIT_SECONDS, function()
      if waiting then frame:GetScript("OnEvent")(frame) end
    end)
  end
end

ns.commandHandlers = ns.commandHandlers or {}
ns.commandHandlers["calendar"] = function(args)
  local action = string.lower(args[1] or "check")
  if action == "check" then check() else ns.message("/qg calendar check") end
end
ns.commandHelp = ns.commandHelp or {}
table.insert(ns.commandHelp, "/qg calendar check - can this game client's calendar be synced?")
