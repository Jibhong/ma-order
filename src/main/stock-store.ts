import { app } from 'electron'
import { backup, DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync } from 'fs'
import { dirname, join } from 'path'
import type { AppSettings, AppState, MovementType, StockItem, StockMovement } from '../shared/types'

const defaultSettings: AppSettings = {
  language: 'en',
  defaultUserName: 'User',
  autoBackupEnabled: true,
  backupIntervalHours: 24,
  backupRetentionDays: 30
}

let database: DatabaseSync | undefined

export function getDatabasePath(): string {
  return join(app.getPath('userData'), 'stock-data.sqlite')
}

export function getBackupDirectory(): string {
  return join(app.getPath('userData'), 'backup')
}

export function formatBackupTimestamp(date: Date): string {
  const pad = (value: number, length = 2): string => String(value).padStart(length, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}-${pad(date.getMilliseconds(), 3)}`
}

export async function migrateDatabaseLocation(sourcePath: string): Promise<void> {
  const destinationPath = getDatabasePath()
  if (!existsSync(sourcePath) || sourcePath.toLowerCase() === destinationPath.toLowerCase()) return
  if (existsSync(destinationPath)) return

  mkdirSync(dirname(destinationPath), { recursive: true })
  const source = new DatabaseSync(sourcePath, { readOnly: true })
  try {
    await backup(source, destinationPath)
  } finally {
    source.close()
  }
}

function getDatabase(): DatabaseSync {
  if (database) return database
  const file = getDatabasePath()
  mkdirSync(dirname(file), { recursive: true })
  database = new DatabaseSync(file)
  database.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
  database.exec(`
    CREATE TABLE IF NOT EXISTS stock_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0 AND quantity = CAST(quantity AS INTEGER)),
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS stock_movements (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      item_name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('add', 'remove')),
      amount INTEGER NOT NULL CHECK (amount > 0 AND amount = CAST(amount AS INTEGER)),
      actor TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS stock_movements_timestamp_idx
      ON stock_movements (timestamp DESC);
    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      language TEXT NOT NULL CHECK (language IN ('en', 'th')),
      default_user_name TEXT NOT NULL DEFAULT 'User',
      auto_backup_enabled INTEGER NOT NULL CHECK (auto_backup_enabled IN (0, 1)),
      backup_interval_hours INTEGER NOT NULL CHECK (backup_interval_hours BETWEEN 1 AND 8760),
      backup_retention_days INTEGER NOT NULL CHECK (backup_retention_days BETWEEN 1 AND 3650)
    );
    CREATE TABLE IF NOT EXISTS backup_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  const settingsColumns = database.prepare('PRAGMA table_info(app_settings)').all() as {
    name: string
  }[]
  if (!settingsColumns.some((column) => column.name === 'default_user_name')) {
    database.exec(
      "ALTER TABLE app_settings ADD COLUMN default_user_name TEXT NOT NULL DEFAULT 'User'"
    )
  }

  if (database.prepare('PRAGMA user_version').get()?.user_version !== 3) {
    database.exec(`
      BEGIN IMMEDIATE;
      CREATE TABLE stock_items_integer (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL COLLATE NOCASE UNIQUE,
        quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0 AND quantity = CAST(quantity AS INTEGER)),
        created_at TEXT NOT NULL
      );
      INSERT INTO stock_items_integer (id, name, quantity, created_at)
        SELECT id, name, CAST(ROUND(quantity) AS INTEGER), created_at FROM stock_items;
      DROP TABLE stock_items;
      ALTER TABLE stock_items_integer RENAME TO stock_items;
      CREATE TABLE stock_movements_integer (
        id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL,
        item_name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('add', 'remove')),
        amount INTEGER NOT NULL CHECK (amount > 0 AND amount = CAST(amount AS INTEGER)),
        actor TEXT NOT NULL,
        timestamp TEXT NOT NULL
      );
      INSERT INTO stock_movements_integer (id, item_id, item_name, type, amount, actor, timestamp)
        SELECT id, item_id, item_name, type, MAX(1, CAST(ROUND(amount) AS INTEGER)), actor, timestamp
        FROM stock_movements;
      DROP TABLE stock_movements;
      ALTER TABLE stock_movements_integer RENAME TO stock_movements;
      CREATE INDEX IF NOT EXISTS stock_movements_timestamp_idx
        ON stock_movements (timestamp DESC);
      PRAGMA user_version = 3;
      COMMIT;
    `)
  }

  if (!database.prepare('SELECT 1 FROM app_settings WHERE id = 1').get()) {
    const legacyFile = join(app.getPath('userData'), 'stock-data.json')
    const legacyState = existsSync(legacyFile)
      ? validateState(JSON.parse(readFileSync(legacyFile, 'utf8')) as unknown, true)
      : { items: [], movements: [], settings: defaultSettings }
    writeState(legacyState)
  }

  return database
}

function validateState(value: unknown, normalizeLegacy = false): AppState {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid backup: expected a stock data object.')
  }
  const state = value as Partial<AppState>
  if (!Array.isArray(state.items) || !Array.isArray(state.movements) || !state.settings) {
    throw new Error('Invalid backup: items, movements, and settings are required.')
  }
  if (
    !state.items.every(
      (item) =>
        item !== null &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        item.name.trim().length > 0 &&
        Number.isInteger(normalizeLegacy ? Math.round(item.quantity) : item.quantity) &&
        item.quantity >= 0 &&
        typeof item.createdAt === 'string'
    )
  ) {
    throw new Error('Invalid backup: one or more stock items are malformed.')
  }
  if (
    !state.movements.every(
      (movement) =>
        movement !== null &&
        typeof movement === 'object' &&
        typeof movement.id === 'string' &&
        typeof movement.itemId === 'string' &&
        typeof movement.itemName === 'string' &&
        (movement.type === 'add' || movement.type === 'remove') &&
        Number.isInteger(normalizeLegacy ? Math.round(movement.amount) : movement.amount) &&
        movement.amount > 0 &&
        typeof movement.actor === 'string' &&
        movement.actor.trim().length > 0 &&
        typeof movement.timestamp === 'string'
    )
  ) {
    throw new Error('Invalid backup: one or more stock movements are malformed.')
  }
  const settings = state.settings
  if (
    (settings.language !== 'en' && settings.language !== 'th') ||
    (settings.defaultUserName !== undefined &&
      (typeof settings.defaultUserName !== 'string' || !settings.defaultUserName.trim())) ||
    typeof settings.autoBackupEnabled !== 'boolean' ||
    !Number.isInteger(settings.backupIntervalHours) ||
    settings.backupIntervalHours < 1 ||
    settings.backupIntervalHours > 8760 ||
    !Number.isInteger(settings.backupRetentionDays) ||
    settings.backupRetentionDays < 1 ||
    settings.backupRetentionDays > 3650
  ) {
    throw new Error('Invalid backup: backup or language settings are malformed.')
  }
  return {
    items: state.items.map((item) => ({
      ...item,
      quantity: normalizeLegacy ? Math.round(item.quantity) : item.quantity
    })),
    movements: state.movements.map((movement) => ({
      ...movement,
      amount: normalizeLegacy ? Math.max(1, Math.round(movement.amount)) : movement.amount
    })),
    settings: {
      ...defaultSettings,
      ...settings,
      defaultUserName:
        typeof settings.defaultUserName === 'string' && settings.defaultUserName.trim()
          ? settings.defaultUserName.trim()
          : defaultSettings.defaultUserName
    }
  }
}

function mapItem(row: {
  id: string
  name: string
  quantity: number
  created_at: string
}): StockItem {
  return { id: row.id, name: row.name, quantity: row.quantity, createdAt: row.created_at }
}

function mapMovement(row: {
  id: string
  item_id: string
  item_name: string
  type: MovementType
  amount: number
  actor: string
  timestamp: string
}): StockMovement {
  return {
    id: row.id,
    itemId: row.item_id,
    itemName: row.item_name,
    type: row.type,
    amount: row.amount,
    actor: row.actor,
    timestamp: row.timestamp
  }
}

export function getState(): AppState {
  const db = getDatabase()
  const items = db
    .prepare('SELECT id, name, quantity, created_at FROM stock_items ORDER BY name COLLATE NOCASE')
    .all() as { id: string; name: string; quantity: number; created_at: string }[]
  const movements = db
    .prepare(
      'SELECT id, item_id, item_name, type, amount, actor, timestamp FROM stock_movements ORDER BY timestamp DESC, rowid DESC'
    )
    .all() as {
    id: string
    item_id: string
    item_name: string
    type: MovementType
    amount: number
    actor: string
    timestamp: string
  }[]
  const settings = db
    .prepare(
      'SELECT language, default_user_name, auto_backup_enabled, backup_interval_hours, backup_retention_days FROM app_settings WHERE id = 1'
    )
    .get() as
    | {
        language: 'en' | 'th'
        default_user_name: string
        auto_backup_enabled: number
        backup_interval_hours: number
        backup_retention_days: number
      }
    | undefined
  if (!settings) throw new Error('Stock database is missing application settings.')
  return {
    items: items.map(mapItem),
    movements: movements.map(mapMovement),
    settings: {
      language: settings.language,
      defaultUserName: settings.default_user_name,
      autoBackupEnabled: settings.auto_backup_enabled === 1,
      backupIntervalHours: settings.backup_interval_hours,
      backupRetentionDays: settings.backup_retention_days
    }
  }
}

function writeState(state: AppState): void {
  const db = getDatabase()
  db.exec('BEGIN IMMEDIATE')
  try {
    db.prepare('DELETE FROM stock_items').run()
    db.prepare('DELETE FROM stock_movements').run()
    const insertItem = db.prepare(
      'INSERT INTO stock_items (id, name, quantity, created_at) VALUES (?, ?, ?, ?)'
    )
    for (const item of state.items) {
      insertItem.run(item.id, item.name.trim(), item.quantity, item.createdAt)
    }
    const insertMovement = db.prepare(
      'INSERT INTO stock_movements (id, item_id, item_name, type, amount, actor, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    for (const movement of state.movements) {
      insertMovement.run(
        movement.id,
        movement.itemId,
        movement.itemName,
        movement.type,
        movement.amount,
        movement.actor,
        movement.timestamp
      )
    }
    db.prepare(
      `
      INSERT INTO app_settings (id, language, default_user_name, auto_backup_enabled, backup_interval_hours, backup_retention_days)
      VALUES (1, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        language = excluded.language,
        default_user_name = excluded.default_user_name,
        auto_backup_enabled = excluded.auto_backup_enabled,
        backup_interval_hours = excluded.backup_interval_hours,
        backup_retention_days = excluded.backup_retention_days
    `
    ).run(
      state.settings.language,
      state.settings.defaultUserName,
      state.settings.autoBackupEnabled ? 1 : 0,
      state.settings.backupIntervalHours,
      state.settings.backupRetentionDays
    )
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export function addItem(name: string): AppState {
  const normalizedName = name.trim()
  if (!normalizedName) throw new Error('Item name is required.')
  const item: StockItem = {
    id: randomUUID(),
    name: normalizedName,
    quantity: 0,
    createdAt: new Date().toISOString()
  }
  try {
    getDatabase()
      .prepare('INSERT INTO stock_items (id, name, quantity, created_at) VALUES (?, ?, 0, ?)')
      .run(item.id, item.name, item.createdAt)
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      throw new Error('An item with this name already exists.', { cause: error })
    }
    throw error
  }
  return getState()
}

export function removeItem(itemId: string): AppState {
  const result = getDatabase().prepare('DELETE FROM stock_items WHERE id = ?').run(itemId)
  if (result.changes === 0) throw new Error('Item not found.')
  return getState()
}

export function moveStock(
  itemId: string,
  type: MovementType,
  amount: number,
  actor: string
): AppState {
  const normalizedActor = actor.trim()
  if (!Number.isInteger(amount) || amount <= 0)
    throw new Error('Amount must be a whole number greater than zero.')
  if (type !== 'add' && type !== 'remove') throw new Error('Unsupported stock movement.')
  if (!normalizedActor) throw new Error('Please enter who is recording this stock change.')

  const db = getDatabase()
  const update = (): void => {
    db.exec('BEGIN IMMEDIATE')
    try {
      const item = db
        .prepare('SELECT id, name, quantity, created_at FROM stock_items WHERE id = ?')
        .get(itemId) as
        { id: string; name: string; quantity: number; created_at: string } | undefined
      if (!item) throw new Error('Item not found.')
      if (type === 'remove' && amount > item.quantity) {
        throw new Error('Cannot remove more than the available stock.')
      }
      const timestamp = new Date().toISOString()
      db.prepare('UPDATE stock_items SET quantity = quantity + ? WHERE id = ?').run(
        type === 'add' ? amount : -amount,
        itemId
      )
      db.prepare(
        'INSERT INTO stock_movements (id, item_id, item_name, type, amount, actor, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(randomUUID(), itemId, item.name, type, amount, normalizedActor, timestamp)
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }
  update()
  return getState()
}

export function updateSettings(settings: AppSettings): AppState {
  if (settings.language !== 'en' && settings.language !== 'th')
    throw new Error('Unsupported language.')
  if (typeof settings.defaultUserName !== 'string' || !settings.defaultUserName.trim())
    throw new Error('Default user name is required.')
  if (
    !Number.isInteger(settings.backupIntervalHours) ||
    settings.backupIntervalHours < 1 ||
    settings.backupIntervalHours > 8760
  ) {
    throw new Error('Backup interval must be between 1 and 8760 hours.')
  }
  if (
    !Number.isInteger(settings.backupRetentionDays) ||
    settings.backupRetentionDays < 1 ||
    settings.backupRetentionDays > 3650
  ) {
    throw new Error('Backup retention must be between 1 and 3650 days.')
  }
  const state = getState()
  state.settings = settings
  writeState(state)
  return getState()
}

export function restoreState(value: unknown, normalizeLegacy = false): AppState {
  const state = validateState(value, normalizeLegacy)
  writeState(state)
  return getState()
}

export async function createAutomaticBackup(): Promise<string> {
  const directory = getBackupDirectory()
  mkdirSync(directory, { recursive: true })
  const filename = `auto-stock-backup-${formatBackupTimestamp(new Date())}.sqlite`
  const path = join(directory, filename)
  await createBackupSnapshot(path)
  pruneBackups(getState().settings.backupRetentionDays)
  return path
}

export function getLastBackupTimestamp(): number | null {
  const row = getDatabase()
    .prepare("SELECT value FROM backup_metadata WHERE key = 'last_backup_at'")
    .get() as { value: string } | undefined
  if (!row) return null
  const timestamp = Number(row.value)
  if (!Number.isSafeInteger(timestamp) || timestamp < 0) {
    throw new Error('The saved last-backup timestamp is invalid.')
  }
  return timestamp
}

function setLastBackupTimestamp(timestamp: number | null): void {
  const db = getDatabase()
  if (timestamp === null) {
    db.prepare("DELETE FROM backup_metadata WHERE key = 'last_backup_at'").run()
    return
  }
  db.prepare(
    `INSERT INTO backup_metadata (key, value) VALUES ('last_backup_at', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(String(timestamp))
}

async function createBackupSnapshot(path: string): Promise<void> {
  const previousTimestamp = getLastBackupTimestamp()
  setLastBackupTimestamp(Date.now())
  try {
    await backup(getDatabase(), path)
  } catch (error) {
    setLastBackupTimestamp(previousTimestamp)
    throw error
  }
}

function pruneBackups(retentionDays: number): void {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000
  for (const filename of readdirSync(getBackupDirectory())) {
    if (!filename.startsWith('auto-stock-backup-') || !filename.endsWith('.sqlite')) continue
    const path = join(getBackupDirectory(), filename)
    if (statSync(path).mtimeMs < cutoff) unlinkSync(path)
  }
}

export function getBackupSettings(): Pick<
  AppSettings,
  'autoBackupEnabled' | 'backupIntervalHours' | 'backupRetentionDays'
> {
  const { autoBackupEnabled, backupIntervalHours, backupRetentionDays } = getState().settings
  return { autoBackupEnabled, backupIntervalHours, backupRetentionDays }
}

export async function saveManualBackup(path: string): Promise<void> {
  mkdirSync(dirname(path), { recursive: true })
  await createBackupSnapshot(path)
}

export function restoreDatabaseBackup(path: string): AppState {
  const backupDatabase = new DatabaseSync(path, { readOnly: true })
  try {
    const items = backupDatabase
      .prepare(
        'SELECT id, name, quantity, created_at FROM stock_items ORDER BY name COLLATE NOCASE'
      )
      .all() as { id: string; name: string; quantity: number; created_at: string }[]
    const movements = backupDatabase
      .prepare(
        'SELECT id, item_id, item_name, type, amount, actor, timestamp FROM stock_movements ORDER BY timestamp DESC, rowid DESC'
      )
      .all() as {
      id: string
      item_id: string
      item_name: string
      type: MovementType
      amount: number
      actor: string
      timestamp: string
    }[]
    const settingsColumns = backupDatabase.prepare('PRAGMA table_info(app_settings)').all() as {
      name: string
    }[]
    const hasDefaultUserName = settingsColumns.some((column) => column.name === 'default_user_name')
    const settings = backupDatabase
      .prepare(
        `SELECT language, ${hasDefaultUserName ? 'default_user_name' : "'User' AS default_user_name"}, auto_backup_enabled, backup_interval_hours, backup_retention_days FROM app_settings WHERE id = 1`
      )
      .get() as
      | {
          language: 'en' | 'th'
          default_user_name: string
          auto_backup_enabled: number
          backup_interval_hours: number
          backup_retention_days: number
        }
      | undefined
    if (!settings) throw new Error('This SQLite file is not a valid stock backup.')
    return restoreState(
      {
        items: items.map(mapItem),
        movements: movements.map(mapMovement),
        settings: {
          language: settings.language,
          defaultUserName: settings.default_user_name || 'User',
          autoBackupEnabled: settings.auto_backup_enabled === 1,
          backupIntervalHours: settings.backup_interval_hours,
          backupRetentionDays: settings.backup_retention_days
        }
      },
      true
    )
  } finally {
    backupDatabase.close()
  }
}
