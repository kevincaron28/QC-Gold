# Security

## Reporting a problem

Please report security problems privately (a Discord message to the guild
owner, or a private GitHub security advisory) instead of a public issue. Include
what you did, what you expected and what happened. Expect a reply within a few
days.

## What to know when you run it

- The **addon** sends nothing over the internet. It talks to other players
  through the game's addon channel and writes a saved file on your computer.
- The **companion app** reads that saved file and sends it to *your* bot with a
  secret token. Keep the token private; anyone with it can send data to your bot.
  Change `COMPANION_UPLOAD_TOKEN` (bot) and the token in the companion to rotate it.
- The **bot** only listens for the companion on the address you configure. Put it
  behind HTTPS if it is reachable from the internet (see docs/DEPLOY_ORACLE.md).
  Repeated wrong tokens are throttled.
- Never share your `.env` / `.env.local` (Discord bot token, database address).
- Officer-only actions are checked on the bot with Discord roles, not by the
  addon, so a modified addon cannot award points.
