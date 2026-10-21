# Stock Management

A local-first Electron stock manager with English and Thai interfaces.

## Features

- Stock starts without a location; add one from the location cards before creating item types. Each location has independent quantities and shares the same item types, and locations can be renamed.
- Create and delete stock item names; search with partial and typo-tolerant matching.
- Record whole-unit stock additions and removals with timestamp and the configured username.
- Sort and filter inventory, jump from an item name in the list to its search result, and paginate inventory and history.
- Save data locally, create and load SQLite backups, and configure automatic backup frequency and retention.
- Check GitHub releases for application updates.

Stock data and app settings are stored in `%APPDATA%\MaOrder\stock-data.sqlite` on Windows. The settings screen displays the data format version (currently 1.0); supported lower versions are migrated on database initialization, while a newer unsupported version is left untouched and requires a newer app. The SQLite `app_settings` table stores the language, default username, and automatic-backup options. The `backup_metadata` table stores the data format version and timestamp of the latest successful manual or automatic backup. Existing stock data is migrated from the previous application data location when possible. Automatic SQLite backups are saved in `%APPDATA%\MaOrder\backup`; the scheduler checks once per second and compares the saved backup timestamp with the configured interval, so restarting the app or saving settings does not reset the elapsed time. If no backup timestamp exists yet, the first automatic backup runs immediately when automatic backups are enabled. Older automatic backups are removed according to the configured retention period. Automatic and manual backup filenames include a timestamp. Manual backups can be saved to or loaded from a chosen SQLite file, and the settings screen can open the backup folder in Explorer.

## Development

```bash
npm install
npm run dev
```

## Build and publish updates

The app version shown in Settings comes from `package.json` (currently `1.0.0`). To publish a Windows update:

1. Bump the version, for example `npm version patch` (this changes `package.json` and `package-lock.json` and creates a Git tag; push the commit and tag).
2. Set `GH_TOKEN` to a GitHub token with permission to create releases and upload assets to `Jibhong/ma-order`. In PowerShell:

   ```powershell
   $env:GH_TOKEN = "YOUR_GITHUB_TOKEN"
   ```

3. Build the app and publish the installer/update metadata:

   ```powershell
   npm run build
   npx electron-builder --win --publish always
   ```

4. If electron-builder creates a draft release, review its assets and publish it. Keep the generated installer, `.blockmap`, and `latest.yml` assets attached to the release; the updater uses the metadata and installer assets to find and install the update.
5. Install and open the new version, then use **Check for updates** in the installed older app. Update checks do not work in development mode.

For a manually prepared GitHub release, use the exact `v`-prefixed tag matching the bumped package version (for example, `v1.0.1`) and upload the updater-compatible assets produced by electron-builder. A release containing only source code or a setup installer without `latest.yml` will not provide the required auto-update metadata.

```bash
npm run build:win
npm run build:mac
npm run build:linux
```

The updater checks GitHub Releases from [Jibhong/ma-order](https://github.com/Jibhong/ma-order). macOS and Linux builds should likewise be built and published from their supported platform environment.
