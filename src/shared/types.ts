export type Language = 'en' | 'th'
export type MovementType = 'add' | 'remove'

export interface StockItem {
  id: string
  name: string
  quantity: number
  createdAt: string
}

export interface StockMovement {
  id: string
  itemId: string
  itemName: string
  type: MovementType
  amount: number
  actor: string
  timestamp: string
}

export interface AppSettings {
  language: Language
  defaultUserName: string
  autoBackupEnabled: boolean
  backupIntervalHours: number
  backupRetentionDays: number
}

export interface AppState {
  items: StockItem[]
  movements: StockMovement[]
  settings: AppSettings
}

export type UpdateStatus =
  | { status: 'checking' }
  | { status: 'available'; version: string }
  | { status: 'not-available' }
  | { status: 'downloading'; percent: number }
  | { status: 'downloaded'; version: string }
  | { status: 'error'; message: string }
