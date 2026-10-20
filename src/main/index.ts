import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'
import { autoUpdater } from 'electron-updater'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import type { AppSettings, UpdateStatus } from '../shared/types'
import {
  addItem,
  createAutomaticBackup,
  formatBackupTimestamp,
  getBackupSettings,
  getBackupDirectory,
  getLastBackupTimestamp,
  getState,
  migrateDatabaseLocation,
  moveStock,
  removeItem,
  restoreDatabaseBackup,
  saveManualBackup,
  updateSettings
} from './stock-store'

let backupTimer: ReturnType<typeof setTimeout> | undefined
let backupRetryAfter = 0
const backupCheckInterval = 1000
const backupRetryInterval = 60_000

function sendUpdateStatus(status: UpdateStatus): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('updates:status', status)
  }
}

function scheduleAutomaticBackup(): void {
  const checkForDueBackup = async (): Promise<void> => {
    try {
      const settings = getBackupSettings()
      if (settings.autoBackupEnabled) {
        const lastBackupAt = getLastBackupTimestamp()
        const intervalMilliseconds = settings.backupIntervalHours * 60 * 60 * 1000
        if (
          Date.now() >= backupRetryAfter &&
          (lastBackupAt === null || Date.now() >= lastBackupAt + intervalMilliseconds)
        ) {
          await createAutomaticBackup()
          backupRetryAfter = 0
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('Automatic backup failed:', error)
      backupRetryAfter = Date.now() + backupRetryInterval
      dialog.showErrorBox(
        'Automatic backup failed',
        `Could not save the automatic backup to:\n${getBackupDirectory()}\n\n${message}`
      )
    }
    backupTimer = setTimeout(() => void checkForDueBackup(), backupCheckInterval)
  }
  void checkForDueBackup()
}

function registerHandlers(): void {
  ipcMain.handle('stock:get-state', () => getState())
  ipcMain.handle('backup:location', () => getBackupDirectory())
  ipcMain.handle('backup:open-folder', async () => {
    const directory = getBackupDirectory()
    mkdirSync(directory, { recursive: true })
    const result = await shell.openPath(directory)
    if (result) throw new Error(`Could not open backup folder: ${result}`)
  })
  ipcMain.handle('stock:add-item', (_event, name: string) => addItem(name))
  ipcMain.handle('stock:remove-item', (_event, itemId: string) => removeItem(itemId))
  ipcMain.handle(
    'stock:move',
    (_event, itemId: string, type: 'add' | 'remove', amount: number, actor: string) =>
      moveStock(itemId, type, amount, actor)
  )
  ipcMain.handle('settings:update', (_event, settings: AppSettings) => {
    const state = updateSettings(settings)
    return state
  })
  ipcMain.handle('backup:create', async () => {
    mkdirSync(getBackupDirectory(), { recursive: true })
    const result = await dialog.showSaveDialog({
      title: 'Save stock backup',
      defaultPath: join(
        getBackupDirectory(),
        `stock-backup-${formatBackupTimestamp(new Date())}.sqlite`
      ),
      filters: [{ name: 'SQLite stock backup', extensions: ['sqlite', 'db'] }]
    })
    if (result.canceled || !result.filePath) return null
    await saveManualBackup(result.filePath)
    return result.filePath
  })
  ipcMain.handle('backup:restore', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Load stock backup',
      properties: ['openFile'],
      filters: [{ name: 'SQLite stock backup', extensions: ['sqlite', 'db'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const state = restoreDatabaseBackup(result.filePaths[0])
    return state
  })
  ipcMain.handle('updates:check', async () => {
    if (is.dev)
      throw new Error('GitHub updates can be checked in an installed app, not development mode.')
    await autoUpdater.checkForUpdates()
  })
  ipcMain.handle('updates:install', () => autoUpdater.quitAndInstall(false, true))
}

function configureUpdater(): void {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('checking-for-update', () => sendUpdateStatus({ status: 'checking' }))
  autoUpdater.on('update-available', (info) => {
    sendUpdateStatus({ status: 'available', version: info.version })
    void autoUpdater.downloadUpdate().catch((error: unknown) => {
      sendUpdateStatus({
        status: 'error',
        message: error instanceof Error ? error.message : String(error)
      })
    })
  })
  autoUpdater.on('update-not-available', () => sendUpdateStatus({ status: 'not-available' }))
  autoUpdater.on('download-progress', (progress) =>
    sendUpdateStatus({ status: 'downloading', percent: Math.round(progress.percent) })
  )
  autoUpdater.on('update-downloaded', (info) =>
    sendUpdateStatus({ status: 'downloaded', version: info.version })
  )
  autoUpdater.on('error', (error) => sendUpdateStatus({ status: 'error', message: error.message }))
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 720,
    minHeight: 560,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  const previousUserDataPath = app.getPath('userData')
  const maOrderDataPath = join(app.getPath('appData'), 'MaOrder')
  app.setPath('userData', maOrderDataPath)
  try {
    mkdirSync(maOrderDataPath, { recursive: true })
    await migrateDatabaseLocation(join(previousUserDataPath, 'stock-data.sqlite'))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    dialog.showErrorBox(
      'Stock data could not be opened',
      `Could not move stock data to:\n${maOrderDataPath}\n\n${message}`
    )
    app.quit()
    return
  }

  electronApp.setAppUserModelId('com.jibhong.maorder')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  registerHandlers()
  configureUpdater()
  scheduleAutomaticBackup()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  if (backupTimer) clearTimeout(backupTimer)
})
