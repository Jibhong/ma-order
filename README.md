# Stock Management

A local-first Electron stock manager with English and Thai interfaces.

## Features

- Create and delete stock item names; search with partial and typo-tolerant matching.
- Record whole-unit stock additions and removals with timestamp and the configured username.
- Sort and filter inventory, jump from an item name in the list to its search result, and paginate inventory and history.
- Save data locally, create and load SQLite backups, and configure automatic backup frequency and retention.
- Check GitHub releases for application updates.

Stock data and app settings are stored in `%APPDATA%\MaOrder\stock-data.sqlite` on Windows. The SQLite `app_settings` table stores the language, default username, and automatic-backup options. The `backup_metadata` table stores the timestamp of the latest successful manual or automatic backup. Existing stock data is migrated from the previous application data location when possible. Automatic SQLite backups are saved in `%APPDATA%\MaOrder\backup`; the scheduler checks once per second and compares the saved backup timestamp with the configured interval, so restarting the app or saving settings does not reset the elapsed time. If no backup timestamp exists yet, the first automatic backup runs immediately when automatic backups are enabled. Older automatic backups are removed according to the configured retention period. Automatic and manual backup filenames include a timestamp. Manual backups can be saved to or loaded from a chosen SQLite file, and the settings screen can open the backup folder in Explorer.

## Development

```bash
npm install
npm run dev
```

## Build and publish updates

```bash
npm run build:win
npm run build:mac
npm run build:linux
```

The updater checks releases from [Jibhong/ma-order](https://github.com/Jibhong/ma-order). To publish updater-compatible installers, configure `GH_TOKEN` with repository release permission and use electron-builder's GitHub publishing option, for example:

```bash
npx electron-builder --win --publish always
```

Publish a new GitHub release with a version newer than the installed app. Electron-builder uploads the installer and update metadata that the in-app updater needs. Update checks work in packaged applications, not in development mode.
