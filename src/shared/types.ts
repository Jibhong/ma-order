export type Language = "en" | "th"
export type MovementType = "add" | "remove" | "set"
export type StockMovementType = Exclude<MovementType, "set">

export interface StockItem {
  id: string
  locationId: string
  name: string
  quantity: number
  createdAt: string
}

export interface StockMovement {
  id: string
  locationId: string
  itemId: string
  itemName: string
  type: StockMovementType
  amount: number
  actor: string
  timestamp: string
}

export interface StockLocation {
  id: string
  name: string
}

export interface AppSettings {
  language: Language
  defaultUserName: string
  autoBackupEnabled: boolean
  backupIntervalHours: number
  backupRetentionDays: number
}

export interface AppState {
  dataVersion: string
  locations: StockLocation[]
  items: StockItem[]
  movements: StockMovement[]
  settings: AppSettings
}

export type UpdateStatus =
  | { status: "checking" }
  | { status: "available"; version: string }
  | { status: "not-available" }
  | { status: "downloading"; percent: number }
  | { status: "downloaded"; version: string }
  | { status: "error"; message: string }
