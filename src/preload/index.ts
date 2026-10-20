import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { AppSettings, AppState, MovementType, UpdateStatus } from '../shared/types'

const api = {
  getState: (): Promise<AppState> => ipcRenderer.invoke('stock:get-state'),
  getBackupLocation: (): Promise<string> => ipcRenderer.invoke('backup:location'),
  openBackupFolder: (): Promise<void> => ipcRenderer.invoke('backup:open-folder'),
  addItem: (name: string): Promise<AppState> => ipcRenderer.invoke('stock:add-item', name),
  removeItem: (itemId: string): Promise<AppState> =>
    ipcRenderer.invoke('stock:remove-item', itemId),
  moveStock: (
    itemId: string,
    type: MovementType,
    amount: number,
    actor: string
  ): Promise<AppState> => ipcRenderer.invoke('stock:move', itemId, type, amount, actor),
  updateSettings: (settings: AppSettings): Promise<AppState> =>
    ipcRenderer.invoke('settings:update', settings),
  createBackup: (): Promise<string | null> => ipcRenderer.invoke('backup:create'),
  restoreBackup: (): Promise<AppState | null> => ipcRenderer.invoke('backup:restore'),
  checkForUpdates: (): Promise<void> => ipcRenderer.invoke('updates:check'),
  installUpdate: (): Promise<void> => ipcRenderer.invoke('updates:install'),
  onUpdateStatus: (callback: (status: UpdateStatus) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: UpdateStatus): void =>
      callback(status)
    ipcRenderer.on('updates:status', listener)
    return () => ipcRenderer.removeListener('updates:status', listener)
  }
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('electron', electronAPI)
  contextBridge.exposeInMainWorld('api', api)
} else {
  // @ts-ignore Electron provides the renderer globals in this non-isolated mode.
  window.electron = electronAPI
  // @ts-ignore Electron provides the renderer globals in this non-isolated mode.
  window.api = api
}
