-- Member-facing text in English and French. English text is the key;
-- French comes from FR below (accents written as byte escapes so this file
-- stays plain ASCII). Language: /qg lang en|fr|auto; "auto" (default)
-- follows the game client (frFR = French). Officer-only screens stay English.
-- To add a translation, add a line to FR below.
local addonName, ns = ...
ns = ns or {}

local FR = {
  ["Me"] = "Moi",
  ["Standings"] = "Classement",
  ["Dungeons"] = "Donjons",
  ["Status"] = "Statut",
  ["Start now"] = "D959marrer",
  ["Complete"] = "Termin959",
  ["Abandon"] = "Abandonner",
  ["Check"] = "V959rifier",
  ["Recent runs"] = "Donjons r959cents",
  ["Bosses"] = "Boss",
  ["Deaths %d"] = "Morts %d",
  ["waiting for the first pull"] = "en attente du premier pull",
  ["No dungeon run in progress. Enter a dungeon: the timer starts on the first pull and stops on the last boss."] = "Aucun donjon en cours. Entrez dans un donjon : le chrono part au premier pull et s'arr95xte au dernier boss.",
  ["on Discord"] = "sur Discord",
  ["waiting to sync"] = "en attente d'envoi",
  ["None yet."] = "Aucun pour l'instant.",
  ["Dungeon points - %s (from Discord)"] = "Points de donjon - %s (de Discord)",
  ["Dungeon points"] = "Points de donjon",
  ["No points yet. They come from Discord after an officer imports the runs."] = "Aucun point pour l'instant. Ils viennent de Discord apr958s l'import par un officier.",
  ["Tools"] = "Outils",
  ["Loot"] = "Butin",
  ["Player"] = "Joueur",
  ["Target"] = "Cible",
  ["Group..."] = "Groupe...",
  ["Pick a player"] = "Choisir un joueur",
  ["Nobody else found"] = "Personne d'autre",
  ["Left-click: open the tools window"] = "Clic gauche : ouvrir la fen\195\170tre",
  ["Right-click: check my gear"] = "Clic droit : v\195\169rifier mon \195\169quipement",
  ["Drag: move this button"] = "Glisser : d\195\169placer ce bouton",
  ["Check my gear"] = "V\195\169rifier mon \195\169quipement",
  ["Attunements"] = "Acc\195\168s de raid",
  ["Mark done"] = "Fait",
  ["Clear"] = "Effacer",
  ["Last check: %s%s\n%s"] = "Derni\195\168re v\195\169rification : %s%s\n%s",
  ["   Item level %s"] = "   Niveau d'objet %s",
  ["Nothing missing."] = "Rien ne manque.",
  ["No gear check yet."] = "Aucune v\195\169rification pour l'instant.",
  ["You have done: %s"] = "Vous avez fait : %s",
  ["%s has done: %s"] = "%s a fait : %s",
  ["none recorded"] = "rien d'enregistr\195\169",
  ["\n(Officers: Mark done applies to the selected player.)"] = "\n(Officiers : Fait s'applique au joueur choisi.)",
  ["No standings yet."] = "Pas encore de classement.",
  ["They come from the Discord bot through an officer's addon. Check back after the next raid."] = "Il vient du bot Discord par l'addon d'un officier. Revenez apr\195\168s le prochain raid.",
  ["%s: no standings (character not linked on Discord?)"] = "%s : pas de classement (personnage non li\195\169 sur Discord ?)",
  ["Top by PR (from Discord, %s):"] = "Meilleurs PR (Discord, %s) :",
  ["Diagnostics"] = "Diagnostic",
  ["Raid status"] = "\195\137tat du raid",
  ["All commands"] = "Commandes",
  ["Addon version"] = "Version",
  ["Hide minimap button"] = "Cacher le bouton",
  ["Minimap button hidden? Type /qg minimap show.\n\nSomething wrong? Press Diagnostics and send a screenshot to an officer."] = "Bouton de la minicarte cach\195\169 ? Tapez /qg minimap show.\n\nUn probl\195\168me ? Appuyez sur Diagnostic et envoyez une capture d'\195\169cran \195\160 un officier.",
  ["Quebec Gold - GP bidding"] = "Quebec Gold - Ench\195\168res GP",
  ["Bid"] = "Miser",
  ["Pass"] = "Passer",
  ["Min %d GP   -   %ds left"] = "Min %d GP   -   %ds restantes",
  ["   -   your PR %.2f"] = "   -   votre PR %.2f",
  ["Your bid: %d GP"] = "Votre mise : %d GP",
  ["You won %s for %s GP."] = "Vous remportez %s pour %s GP.",
  ["Bidding on %s: min %d GP, %ds. Whisper me a number (e.g. 25) or use the Quebec Gold popup."] = "Ench\195\168res sur %s : min %d GP, %ds. Chuchotez-moi un nombre (ex. 25) ou utilisez la fen\195\170tre Quebec Gold.",
  ["%s goes to %s for %d GP."] = "%s va \195\160 %s pour %d GP.",
  ["No bids on %s."] = "Aucune mise sur %s.",
  ["Bidding on %s cancelled."] = "Ench\195\168res sur %s annul\195\169es.",
  ["Bid of %d GP received for %s."] = "Mise de %d GP re\195\167ue pour %s.",
  ["Minimum bid is %d GP."] = "La mise minimum est de %d GP.",
  ["Language: English. /reload to update the window."] = "Langue : anglais. /reload pour mettre la fen\195\170tre \195\160 jour.",
  ["Language: French. /reload to update the window."] = "Langue : fran\195\167ais. /reload pour mettre la fen\195\170tre \195\160 jour.",
  ["Language follows your game client. /reload to update the window."] = "La langue suit votre client de jeu. /reload pour mettre la fen\195\170tre \195\160 jour.",
}

local function language()
  local settings = ns.getSettings and ns.getSettings()
  local chosen = settings and settings.language
  if chosen == "fr" or chosen == "en" then return chosen end
  if GetLocale and GetLocale() == "frFR" then return "fr" end
  return "en"
end
ns.language = language

-- ns.L("English text") -> text in the player's language (English if no
-- translation exists).
function ns.L(text)
  if language() == "fr" and FR[text] then return FR[text] end
  return text
end

ns.commandHandlers = ns.commandHandlers or {}
ns.commandHandlers["lang"] = function(args)
  local settings = ns.getSettings and ns.getSettings()
  if not settings then return end
  local choice = string.lower(args[1] or "")
  if choice == "fr" or choice == "french" or choice == "francais" then
    settings.language = "fr"
    ns.message(ns.L("Language: French. /reload to update the window."))
  elseif choice == "en" or choice == "english" or choice == "anglais" then
    settings.language = "en"
    ns.message(ns.L("Language: English. /reload to update the window."))
  elseif choice == "auto" then
    settings.language = nil
    ns.message(ns.L("Language follows your game client. /reload to update the window."))
  else
    ns.message("/qg lang en | fr | auto   (now: " .. language() .. ")")
  end
end
ns.commandHelp = ns.commandHelp or {}
table.insert(ns.commandHelp, "/qg lang en|fr|auto - language / langue")
