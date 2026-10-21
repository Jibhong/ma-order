import { ElectronAPI } from "@electron-toolkit/preload"
import type { AppSettings, AppState, MovementType, UpdateStatus } from "../shared/types"

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      getState: () => Promise<AppState>
      getBackupLocation: () => Promise<string>
      openBackupFolder: () => Promise<void>
      addItem: (name: string) => Promise<AppState>
      addLocation: (name: string) => Promise<AppState>
      renameLocation: (locationId: string, name: string) => Promise<AppState>
      removeItem: (itemId: string) => Promise<AppState>
      moveStock: (
        itemId: string,
        type: MovementType,
        amount: number,
        actor: string,
      ) => Promise<AppState>
      updateSettings: (settings: AppSettings) => Promise<AppState>
      createBackup: () => Promise<string | null>
      restoreBackup: () => Promise<AppState | null>
      checkForUpdates: () => Promise<void>
      installUpdate: () => Promise<void>
      onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void
    }
  }
}
