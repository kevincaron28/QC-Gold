# Quebec Gold Companion

This lightweight companion watches a normalized addon export file and sends new exports to the bot. It runs on the same Windows computer as WoW and the bot.

## One-time setup

1. Copy `companion.config.example.json` to `companion.config.json`.
2. Put the same `COMPANION_UPLOAD_TOKEN` in the bot `.env` and the companion config.
3. Start the bot.
4. Run `node companion/watcher.mjs`.

The watcher can read the addon's Lua SavedVariables directly. It also accepts
a normalized JSON export matching the bot import contract:

```json
{
  "source": "QuebecGold",
  "exportedAt": "2026-09-24T00:00:00.000Z",
  "transactions": [
    {
      "character": "Player",
      "realm": "Realm",
      "amount": 10,
      "type": "AWARD",
      "reason": "Raid attendance"
    }
  ]
}
```

For a Lua file, the watcher converts the addon's append-only DKP ledger into
normalized transactions. Set `realm` in the companion config because the WoW
SavedVariables file does not reliably contain a realm identifier.
