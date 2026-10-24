# Deployment

The backend invite permission default is `268487680`, which grants View Channel, Send Messages, Embed Links, Attach Files, and Manage Roles. It does not request Administrator. Set `BOT_PERMISSIONS` only if you need a different invite permission integer.

The bot uses Manage Roles to repair denied posting access by creating or reusing a `DexBotX` role, assigning it to the bot, and adding a permission overwrite on the affected channel. Server-level role permissions do not override channel-specific denies. After changing invite permissions for an existing bot installation, re-invite the bot so Discord grants the updated permission.
