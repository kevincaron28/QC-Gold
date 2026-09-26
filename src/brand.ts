// The product's identity in one place. Everything the bot says about itself
// (embed titles, channel topics, audit reasons) reads from here, so renaming
// it for a public release (roadmap #46) is a change to this file, not a hunt.
// The in-game slash prefix (/guilded) and the addon's saved-variable names are
// separate and are handled by the addon rename.
export const BRAND = {
  // Product name used in sentences and titles.
  name: "Guilded",
  // "<name> Bot" as shown for the bot user.
  botName: "Guilded Bot",
  // Emoji shown in embed titles.
  emoji: "⚜️",
  // Embed accent colour.
  color: 0xd4af37,
  // Prefix for channels the bot creates (e.g. guilded-announcements).
  channelPrefix: "guilded"
} as const;
