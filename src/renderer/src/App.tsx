import { useEffect, useMemo, useRef, useState } from "react"
import type { SubmitEvent } from "react"
import type {
  AppSettings,
  AppState,
  MovementType,
  StockItem,
  StockLocation,
  StockMovement,
  UpdateStatus,
} from "../../shared/types"

import Fuse from "fuse.js"
import { version as appVersion } from "../../../package.json"

const translations = {
  en: {
    title: "Stock management",
    subtitle: "Keep your inventory and stock activity in one place.",
    search: "Search items or enter a new item name",
    addItem: "Add item",
    addNewItemPrompt: "This will add a new item.",
    existingItemPrompt: "Item found. Choose a stock action.",
    similarItems: "Similar item names",
    username: "Username",
    rename: "Rename",
    renameUsername: "Rename username",
    usernameUpdated: "Username updated.",
    renameHint: "Enter a name to use for stock movements.",
    sort: "Sort",
    nameAscending: "Name: A to Z",
    nameDescending: "Name: Z to A",
    quantityAscending: "Quantity: low to high",
    quantityDescending: "Quantity: high to low",
    newest: "Recently added",
    filter: "Filter",
    allStock: "All stock",
    inStock: "In stock",
    outOfStock: "Out of stock",
    showRows: "Show",
    previous: "Previous",
    next: "Next",
    page: "Page {current} of {total}",
    quantityFilter: "Quantity",
    comparator: "Compare",
    browseBackup: "Load backup",
    openBackupFolder: "Open backup folder",
    itemName: "Item name",
    stock: "Stock",
    locations: "Stock locations",
    addLocation: "Add new location",
    locationName: "Location name",
    locationCreated: "Location added.",
    renameLocation: "Rename location",
    locationRenamed: "Location renamed.",
    dataVersion: "Data version",
    appVersion: "App version",
    noLocations: "Add a stock location before creating item types or recording stock.",
    items: "Items",
    totalUnits: "Total units",
    inventory: "Inventory",
    name: "Name",
    quantity: "Quantity",
    actions: "Actions",
    addStock: "Add stock",
    removeStock: "Remove stock",
    delete: "Delete",
    noItems: "No matching stock items.",
    activity: "Recent activity",
    item: "Item",
    action: "Action",
    amount: "Amount",
    who: "Recorded by",
    when: "Timestamp",
    noActivity: "No stock activity recorded yet.",
    settings: "Backup settings",
    autoBackup: "Enable automatic backups",
    every: "Run every",
    hours: "hours",
    keep: "Keep backups for",
    days: "days",
    saveSettings: "Save settings",
    backupNow: "Create backup",
    loadBackup: "Load backup",
    checkUpdates: "Check for updates",
    installUpdate: "Restart to install update",
    loading: "Loading stock data...",
    add: "Add",
    remove: "Remove",
    setStock: "Set quantity",
    setQuantity: "New quantity",
    startingQuantity: "Starting quantity",
    resultingQuantity: "Resulting quantity",
    difference: "Difference",
    addItemTitle: "Add a stock item",
    moveTitle: "Record stock movement",
    person: "Your name",
    cancel: "Cancel",
    save: "Save",
    language: "Language",
    english: "English",
    thai: "ไทย",
    loadingUpdate: "Checking for updates...",
    noUpdate: "You are using the latest version.",
    updateReady: "Version {version} is downloading.",
    downloadProgress: "Downloading update: {percent}%",
    updateDownloaded: "Version {version} is ready to install.",
    updateError: "Update error: {message}",
    backupCreated: "Backup saved to {path}",
    automaticBackupLocation: "Automatic backups are saved here:",
    backupLoaded: "Backup loaded successfully.",
    confirmDelete: "Delete “{name}” from your stock list? Its activity history will be kept.",
    confirmRestore: "Loading a backup replaces your current stock data. Continue?",
    loadError: "Could not load stock data: {message}",
    required: "Please complete all required fields.",
  },
  th: {
    title: "จัดการสต็อกสินค้า",
    subtitle: "จัดการสินค้าคงคลังและประวัติการเคลื่อนไหวในที่เดียว",
    search: "ค้นหาสินค้าหรือพิมพ์ชื่อสินค้าใหม่",
    addItem: "เพิ่มสินค้า",
    addNewItemPrompt: "รายการนี้จะถูกเพิ่มเป็นสินค้าใหม่",
    existingItemPrompt: "พบสินค้าแล้ว เลือกรายการสต็อก",
    similarItems: "ชื่อสินค้าใกล้เคียง",
    username: "ชื่อผู้ใช้",
    rename: "เปลี่ยนชื่อ",
    renameUsername: "เปลี่ยนชื่อผู้ใช้",
    usernameUpdated: "เปลี่ยนชื่อผู้ใช้แล้ว",
    renameHint: "ตั้งชื่อสำหรับบันทึกการเคลื่อนไหวของสต็อก",
    sort: "เรียงลำดับ",
    nameAscending: "ชื่อ: ก-ฮ",
    nameDescending: "ชื่อ: ฮ-ก",
    quantityAscending: "จำนวน: น้อยไปมาก",
    quantityDescending: "จำนวน: มากไปน้อย",
    newest: "เพิ่มล่าสุด",
    filter: "ตัวกรอง",
    allStock: "สินค้าทั้งหมด",
    inStock: "มีสินค้า",
    outOfStock: "สินค้าหมด",
    showRows: "แสดง",
    previous: "ก่อนหน้า",
    next: "ถัดไป",
    page: "หน้า {current} จาก {total}",
    quantityFilter: "จำนวน",
    comparator: "เงื่อนไข",
    browseBackup: "โหลดข้อมูลสำรอง",
    openBackupFolder: "เปิดโฟลเดอร์สำรอง",
    itemName: "ชื่อสินค้า",
    stock: "สต็อก",
    locations: "สถานที่จัดเก็บสต็อก",
    addLocation: "เพิ่มสถานที่ใหม่",
    locationName: "ชื่อสถานที่",
    locationCreated: "เพิ่มสถานที่แล้ว",
    renameLocation: "เปลี่ยนชื่อสถานที่",
    locationRenamed: "เปลี่ยนชื่อสถานที่แล้ว",
    dataVersion: "เวอร์ชันข้อมูล",
    appVersion: "เวอร์ชันแอป",
    noLocations: "เพิ่มสถานที่จัดเก็บก่อนสร้างชนิดสินค้าหรือบันทึกสต็อก",
    items: "รายการสินค้า",
    totalUnits: "จำนวนรวม",
    inventory: "สินค้าคงคลัง",
    name: "ชื่อ",
    quantity: "จำนวน",
    actions: "จัดการ",
    addStock: "เพิ่มสต็อก",
    removeStock: "นำออก",
    delete: "ลบ",
    noItems: "ไม่พบสินค้า",
    activity: "ประวัติล่าสุด",
    item: "สินค้า",
    action: "รายการ",
    amount: "จำนวน",
    who: "บันทึกโดย",
    when: "วันและเวลา",
    noActivity: "ยังไม่มีประวัติการเคลื่อนไหว",
    settings: "ตั้งค่าการสำรองข้อมูล",
    autoBackup: "เปิดการสำรองข้อมูลอัตโนมัติ",
    every: "สำรองทุก",
    hours: "ชั่วโมง",
    keep: "เก็บข้อมูลสำรองไว้",
    days: "วัน",
    saveSettings: "บันทึกการตั้งค่า",
    backupNow: "สำรองข้อมูล",
    loadBackup: "โหลดข้อมูลสำรอง",
    checkUpdates: "ตรวจสอบการอัปเดต",
    installUpdate: "เริ่มใหม่เพื่อติดตั้ง",
    loading: "กำลังโหลดข้อมูลสต็อก...",
    add: "เพิ่ม",
    remove: "นำออก",
    setStock: "กำหนดจำนวน",
    setQuantity: "จำนวนใหม่",
    startingQuantity: "จำนวนเดิม",
    resultingQuantity: "จำนวนหลังเปลี่ยน",
    difference: "ส่วนต่าง",
    addItemTitle: "เพิ่มสินค้าใหม่",
    moveTitle: "บันทึกการเคลื่อนไหว",
    person: "ชื่อผู้บันทึก",
    cancel: "ยกเลิก",
    save: "บันทึก",
    language: "ภาษา",
    english: "English",
    thai: "ไทย",
    loadingUpdate: "กำลังตรวจสอบการอัปเดต...",
    noUpdate: "คุณใช้เวอร์ชันล่าสุดแล้ว",
    updateReady: "กำลังดาวน์โหลดเวอร์ชัน {version}",
    downloadProgress: "กำลังดาวน์โหลด: {percent}%",
    updateDownloaded: "เวอร์ชัน {version} พร้อมติดตั้งแล้ว",
    updateError: "เกิดข้อผิดพลาดในการอัปเดต: {message}",
    backupCreated: "บันทึกข้อมูลสำรองแล้วที่ {path}",
    automaticBackupLocation: "ข้อมูลสำรองอัตโนมัติจะบันทึกไว้ที่:",
    backupLoaded: "โหลดข้อมูลสำรองเรียบร้อยแล้ว",
    confirmDelete: "ลบ “{name}” ออกจากรายการสินค้าใช่ไหม? ประวัติจะยังคงอยู่",
    confirmRestore: "การโหลดข้อมูลสำรองจะแทนที่ข้อมูลปัจจุบัน ดำเนินการต่อหรือไม่?",
    loadError: "โหลดข้อมูลสต็อกไม่ได้: {message}",
    required: "กรุณากรอกข้อมูลให้ครบ",
  },
} as const

function distance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let row = 1; row <= left.length; row++) {
    let diagonal = previous[0]
    previous[0] = row
    for (let column = 1; column <= right.length; column++) {
      const above = previous[column]
      previous[column] = Math.min(
        previous[column] + 1,
        previous[column - 1] + 1,
        diagonal + (left[row - 1] === right[column - 1] ? 0 : 1),
      )
      diagonal = above
    }
  }
  return previous[right.length]
}

function matchesSearch(name: string, query: string, additionalValues: string[] = []): boolean {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return true
  const normalizedName = name.toLocaleLowerCase()
  const words = normalizedName.split(/\s+/)
  const additional = additionalValues.map((value) => value.toLocaleLowerCase())
  return terms.some(
    (term) =>
      additional.some((value) => value.includes(term)) ||
      words.some(
        (word) =>
          word.includes(term) || distance(word, term) <= Math.max(1, Math.floor(term.length / 3)),
      ),
  )
}

function formatDate(value: string, language: "en" | "th"): string {
  return new Intl.DateTimeFormat(language === "th" ? "th-TH" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function App(): React.JSX.Element {
  const [state, setState] = useState<AppState | null>(null)
  const [selectedLocationId, setSelectedLocationId] = useState("")
  const [locationName, setLocationName] = useState("")
  const [locationDialogOpen, setLocationDialogOpen] = useState(false)
  const [locationToRename, setLocationToRename] = useState<StockLocation | null>(null)
  const [query, setQuery] = useState("")
  const [movement, setMovement] = useState<{ item: StockItem; type: MovementType } | null>(null)
  const [amount, setAmount] = useState("")
  const [actor, setActor] = useState("")
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null)
  const [settingsDraft, setSettingsDraft] = useState<AppSettings | null>(null)
  const [backupLocation, setBackupLocation] = useState("")
  const [busy, setBusy] = useState(false)
  const [renameDraft, setRenameDraft] = useState("")
  const [renameOpen, setRenameOpen] = useState(false)
  const [sortMode, setSortMode] = useState<
    "name-asc" | "name-desc" | "quantity-asc" | "quantity-desc"
  >("name-asc")
  const [stockFilter, setStockFilter] = useState("all")
  const [quantityComparator, setQuantityComparator] = useState(">")
  const [quantityTarget, setQuantityTarget] = useState("")
  const [itemPage, setItemPage] = useState(0)
  const [historyPage, setHistoryPage] = useState(0)
  const [itemPageSize, setItemPageSize] = useState(10)
  const [historyPageSize, setHistoryPageSize] = useState(10)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const amountInputRef = useRef<HTMLInputElement>(null)
  const language = state?.settings.language ?? "en"
  const text = translations[language]
  const activeLocationId = state?.locations.some((location) => location.id === selectedLocationId)
    ? selectedLocationId
    : (state?.locations[0]?.id ?? "")
  const activeLocation = state?.locations.find((location) => location.id === activeLocationId)

  useEffect(() => {
    window.api
      .getState()
      .then((loaded) => {
        setState(loaded)
        setSettingsDraft(loaded.settings)
        setRenameDraft(loaded.settings.defaultUserName)
      })
      .catch((reason: unknown) => setError(errorMessage(reason)))
  }, [])

  useEffect(() => {
    window.api
      .getBackupLocation()
      .then(setBackupLocation)
      .catch((reason: unknown) => setError(errorMessage(reason)))
  }, [])

  useEffect(() => {
    if (movement) amountInputRef.current?.focus()
  }, [movement])

  useEffect(() => {
    const unsubscribe = window.api.onUpdateStatus(setUpdateStatus)
    return unsubscribe
  }, [])

  const activeItems = useMemo(
    () => (state?.items ?? []).filter((item) => item.locationId === activeLocationId),
    [activeLocationId, state?.items],
  )
  const filteredItems = useMemo(() => {
    const items = (state?.items ?? []).filter(
      (item) =>
        item.locationId === activeLocationId &&
        matchesSearch(item.name, query, [String(item.quantity)]) &&
        (!quantityTarget ||
          (Number.isInteger(Number(quantityTarget)) &&
            (quantityComparator === ">"
              ? item.quantity > Number(quantityTarget)
              : quantityComparator === "<"
                ? item.quantity < Number(quantityTarget)
                : item.quantity === Number(quantityTarget)))) &&
        (stockFilter === "all" ||
          (stockFilter === "in-stock" && item.quantity > 0) ||
          (stockFilter === "out-of-stock" && item.quantity === 0)),
    )
    return items.sort((left, right) => {
      switch (sortMode) {
        case "name-desc":
          return right.name.localeCompare(left.name)
        case "quantity-asc":
          return left.quantity - right.quantity || left.name.localeCompare(right.name)
        case "quantity-desc":
          return right.quantity - left.quantity || left.name.localeCompare(right.name)
        default:
          return left.name.localeCompare(right.name)
      }
    })
  }, [
    activeLocationId,
    query,
    quantityComparator,
    quantityTarget,
    sortMode,
    state?.items,
    stockFilter,
  ])
  const filteredMovements = useMemo(
    () =>
      (state?.movements ?? []).filter(
        (entry) =>
          entry.locationId === activeLocationId &&
          (matchesSearch(entry.itemName, query) ||
            query
              .trim()
              .toLocaleLowerCase()
              .split(/\s+/)
              .some(
                (term) =>
                  entry.actor.toLocaleLowerCase().includes(term) ||
                  String(entry.amount).includes(term),
              )),
      ),
    [activeLocationId, query, state?.movements],
  )
  const exactItem = activeItems.find(
    (item) => item.name.trim().toLocaleLowerCase() === query.trim().toLocaleLowerCase(),
  )

  const canon = (s: string): string =>
    s.toLowerCase().replace(/[^\p{L}\p{M}]/gu, "") + s.replace(/[^\p{N}]/gu, "")
  const fuse = useMemo(
    () =>
      new Fuse(
        activeItems.map((item) => ({ item, key: canon(item.name) })),
        { keys: ["key"], threshold: 1, ignoreLocation: true },
      ),
    [activeItems],
  )
  const searchMatches = query.trim()
    ? fuse.search(canon(query)).map((r) => r.item.item)
    : activeItems
  const similarItems = query.trim() && !exactItem ? searchMatches.slice(0, 10) : []
  const totalUnits = activeItems.reduce((total, item) => total + item.quantity, 0)
  const visibleItemPage = Math.min(
    itemPage,
    Math.max(0, Math.ceil(filteredItems.length / itemPageSize) - 1),
  )
  const visibleHistoryPage = Math.min(
    historyPage,
    Math.max(0, Math.ceil(filteredMovements.length / historyPageSize) - 1),
  )
  const pageItems = filteredItems.slice(
    visibleItemPage * itemPageSize,
    (visibleItemPage + 1) * itemPageSize,
  )
  const pageMovements = filteredMovements.slice(
    visibleHistoryPage * historyPageSize,
    (visibleHistoryPage + 1) * historyPageSize,
  )
  const itemPageCount = Math.max(1, Math.ceil(filteredItems.length / itemPageSize))
  const historyPageCount = Math.max(1, Math.ceil(filteredMovements.length / historyPageSize))
  const movementBase = movement?.item.quantity ?? 0
  const movementInput = amount === "" ? 0 : Number(amount)
  const movementDifference =
    movement?.type === "set"
      ? movementInput - movementBase
      : movement?.type === "remove"
        ? -movementInput
        : movementInput
  const movementResult =
    movement?.type === "set" ? movementInput : movementBase + movementDifference
  const movementAction =
    movement?.type === "set" ? (movementDifference < 0 ? "remove" : "add") : movement?.type

  function format(template: string, values: Record<string, string>): string {
    return template.replace(/\{(\w+)\}/g, (_match, key: string) => values[key] ?? "")
  }

  function clearMessages(): void {
    setNotice("")
    setError("")
  }

  function showError(reason: unknown): void {
    setError(errorMessage(reason))
    setNotice("")
  }

  async function submitNewItem(): Promise<void> {
    const names = query.split(/\s+/).filter(Boolean)
    if (names.length === 0) return
    if (!activeLocationId) {
      setError(text.noLocations)
      setLocationDialogOpen(true)
      return
    }
    clearMessages()
    setBusy(true)
    try {
      let next
      for (const name of names) {
        next = await window.api.addItem(name)
      }
      if (next) setState(next)
      setQuery("")
      searchInputRef.current?.focus()
    } catch (reason) {
      showError(reason)
    } finally {
      setBusy(false)
    }
  }

  async function submitNewLocation(event: SubmitEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!locationName.trim()) {
      setError(text.required)
      return
    }
    clearMessages()
    setBusy(true)
    try {
      const updated = await window.api.addLocation(locationName)
      const newLocation = updated.locations.find(
        (location) => location.name.toLocaleLowerCase() === locationName.trim().toLocaleLowerCase(),
      )
      if (!newLocation) throw new Error("The new stock location was not returned.")
      setState(updated)
      setSelectedLocationId(newLocation.id)
      setLocationName("")
      setLocationDialogOpen(false)
      setQuery("")
      setItemPage(0)
      setHistoryPage(0)
      setNotice(text.locationCreated)
    } catch (reason) {
      showError(reason)
    } finally {
      setBusy(false)
    }
  }

  async function submitRenameLocation(event: SubmitEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!locationToRename || !locationName.trim()) {
      setError(text.required)
      return
    }
    clearMessages()
    setBusy(true)
    try {
      setState(await window.api.renameLocation(locationToRename.id, locationName))
      setLocationToRename(null)
      setLocationName("")
      setNotice(text.locationRenamed)
    } catch (reason) {
      showError(reason)
    } finally {
      setBusy(false)
    }
  }

  async function submitMovement(event: SubmitEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!movement || !amount || !actor.trim()) {
      setError(text.required)
      return
    }
    clearMessages()
    setBusy(true)
    try {
      const updated = await window.api.moveStock(
        movement.item.id,
        movement.type,
        Number(amount),
        actor,
      )
      setState(updated)
      setMovement(null)
      setAmount("")
      setActor(updated.settings.defaultUserName)
      setQuery("")
      setItemPage(0)
      setHistoryPage(0)
      searchInputRef.current?.focus()
    } catch (reason) {
      showError(reason)
    } finally {
      setBusy(false)
    }
  }

  async function deleteItem(item: StockItem): Promise<void> {
    if (!window.confirm(format(text.confirmDelete, { name: item.name }))) return
    clearMessages()
    try {
      setState(await window.api.removeItem(item.id))
    } catch (reason) {
      showError(reason)
    }
  }

  async function saveSettings(event: SubmitEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!settingsDraft) return
    clearMessages()
    try {
      const updated = await window.api.updateSettings(settingsDraft)
      setState(updated)
      setSettingsDraft(updated.settings)
      setNotice(text.saveSettings)
    } catch (reason) {
      showError(reason)
    }
  }

  async function changeLanguage(nextLanguage: "en" | "th"): Promise<void> {
    if (!state) return
    clearMessages()
    try {
      const updated = await window.api.updateSettings({ ...state.settings, language: nextLanguage })
      setState(updated)
      setSettingsDraft(updated.settings)
    } catch (reason) {
      showError(reason)
    }
  }

  async function renameUser(): Promise<void> {
    if (!state || !renameDraft.trim()) {
      setError(text.required)
      return
    }
    clearMessages()
    try {
      const updated = await window.api.updateSettings({
        ...state.settings,
        defaultUserName: renameDraft.trim(),
      })
      setState(updated)
      setSettingsDraft(updated.settings)
      setRenameDraft(updated.settings.defaultUserName)
      setRenameOpen(false)
      setNotice(text.usernameUpdated)
    } catch (reason) {
      showError(reason)
    }
  }

  function openMovement(item: StockItem, type: MovementType): void {
    setMovement({ item, type })
    setAmount("")
    setActor(state?.settings.defaultUserName ?? "")
  }

  async function createBackup(): Promise<void> {
    clearMessages()
    try {
      const path = await window.api.createBackup()
      if (path) {
        setNotice(format(text.backupCreated, { path }))
      }
    } catch (reason) {
      showError(reason)
    }
  }

  async function restoreBackup(): Promise<void> {
    if (!window.confirm(text.confirmRestore)) return
    clearMessages()
    try {
      const restored = await window.api.restoreBackup()
      if (restored) {
        setState(restored)
        setSettingsDraft(restored.settings)
        setRenameDraft(restored.settings.defaultUserName)
        setNotice(text.backupLoaded)
      }
    } catch (reason) {
      showError(reason)
    }
  }

  async function openBackupFolder(): Promise<void> {
    try {
      await window.api.openBackupFolder()
    } catch (reason) {
      showError(reason)
    }
  }

  async function checkUpdates(): Promise<void> {
    setUpdateStatus({ status: "checking" })
    try {
      await window.api.checkForUpdates()
    } catch (reason) {
      setUpdateStatus({ status: "error", message: errorMessage(reason) })
    }
  }

  function updateMessage(status: UpdateStatus): string {
    switch (status.status) {
      case "checking":
        return text.loadingUpdate
      case "available":
        return format(text.updateReady, { version: status.version })
      case "not-available":
        return text.noUpdate
      case "downloading":
        return format(text.downloadProgress, { percent: String(status.percent) })
      case "downloaded":
        return format(text.updateDownloaded, { version: status.version })
      case "error":
        return format(text.updateError, { message: status.message })
    }
  }

  if (!state) {
    return (
      <main className="app-shell">
        <div className="banner error-banner">{error || text.loading}</div>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">{text.stock}</p>
          <h1>{text.title}</h1>
          <p className="subtitle">{text.subtitle}</p>
        </div>
        <div className="topbar-actions">
          <label className="language-label" htmlFor="language-select">
            {text.language}
          </label>
          <select
            id="language-select"
            value={language}
            onChange={(event) => void changeLanguage(event.target.value as "en" | "th")}
          >
            <option value="en">{text.english}</option>
            <option value="th">{text.thai}</option>
          </select>
          <span className="username-display">
            {text.username}: {state.settings.defaultUserName}
          </span>
          <button
            className="button secondary"
            onClick={() => {
              setRenameDraft(state.settings.defaultUserName)
              setRenameOpen(true)
            }}
          >
            {text.rename}
          </button>
          <button className="button secondary" onClick={() => void checkUpdates()}>
            {text.checkUpdates}
          </button>
        </div>
      </header>

      {(error || notice) && (
        <div className={`banner ${error ? "error-banner" : "success-banner"}`} role="status">
          {error || notice}
        </div>
      )}
      {updateStatus && (
        <div
          className={`banner ${updateStatus.status === "error" ? "error-banner" : "info-banner"}`}
          role="status"
        >
          <span>{updateMessage(updateStatus)}</span>
          {updateStatus.status === "downloaded" && (
            <button className="button small" onClick={() => void window.api.installUpdate()}>
              {text.installUpdate}
            </button>
          )}
        </div>
      )}

      <section className="location-section" aria-label={text.locations}>
        <h2>{text.locations}</h2>
        <div className={`location-tabs ${state.locations.length === 0 ? "empty" : ""}`}>
          {state.locations.length === 0 && <p className="muted">{text.noLocations}</p>}
          {state.locations.map((location) => {
            const itemCount = state.items.filter((item) => item.locationId === location.id).length
            const unitCount = state.items
              .filter((item) => item.locationId === location.id)
              .reduce((total, item) => total + item.quantity, 0)
            return (
              <div
                key={location.id}
                className={`location-card ${location.id === activeLocationId ? "active" : ""}`}
              >
                <button
                  type="button"
                  className="location-select"
                  aria-pressed={location.id === activeLocationId}
                  onClick={() => {
                    setSelectedLocationId(location.id)
                    setQuery("")
                    setItemPage(0)
                    setHistoryPage(0)
                  }}
                >
                  <strong>{location.name}</strong>
                  <span>
                    {itemCount} {text.items.toLocaleLowerCase()} · {unitCount}{" "}
                    {text.totalUnits.toLocaleLowerCase()}
                  </span>
                </button>
                <button
                  type="button"
                  className="location-rename"
                  aria-label={`${text.renameLocation}: ${location.name}`}
                  onClick={() => {
                    setLocationName(location.name)
                    setLocationToRename(location)
                  }}
                >
                  {text.rename}
                </button>
              </div>
            )
          })}
          <button
            type="button"
            className="location-card location-add-card"
            onClick={() => setLocationDialogOpen(true)}
          >
            <strong aria-hidden="true">+</strong>
            <span>{text.addLocation}</span>
          </button>
        </div>
      </section>

      <section className="summary-grid" aria-label={text.stock}>
        <div className="summary-card">
          <span>{text.items}</span>
          <strong>{activeItems.length}</strong>
        </div>
        <div className="summary-card">
          <span>{text.totalUnits}</span>
          <strong>{totalUnits}</strong>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>{text.inventory}</h2>
            <span className="muted">
              {activeLocation?.name} · {activeItems.length} {text.items.toLocaleLowerCase()}
            </span>
          </div>
        </div>

        <div className={`inventory-toolbar ${query.trim() && !exactItem ? "is-new-item" : ""}`}>
          <input
            ref={searchInputRef}
            className="inventory-input"
            disabled={!activeLocationId}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setItemPage(0)
              setHistoryPage(0)
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault()
                setQuery("")
                setItemPage(0)
                setHistoryPage(0)
                setQuantityTarget("")
              } else if (event.key === "\\") {
                event.preventDefault()
                if (exactItem) openMovement(exactItem, "remove")
                else if (searchMatches.length === 1) openMovement(searchMatches[0], "remove")
              } else if (event.key === "]") {
                event.preventDefault()
                if (exactItem) openMovement(exactItem, "set")
                else if (searchMatches.length === 1) openMovement(searchMatches[0], "set")
              } else if (event.key === "Enter" && query.trim()) {
                event.preventDefault()
                if (exactItem) openMovement(exactItem, "add")
                else if (searchMatches.length === 1) openMovement(searchMatches[0], "add")
                else if (searchMatches.length === 0) void submitNewItem()
                else setQuery(searchMatches[0].name)
              }
            }}
            placeholder={text.search}
            aria-label={text.search}
          />
          <span className="inventory-feedback" aria-live="polite">
            {!activeLocationId
              ? text.noLocations
              : query.trim()
                ? exactItem
                  ? text.existingItemPrompt
                  : text.addNewItemPrompt
                : ""}
          </span>
          {exactItem ? (
            <div className="toolbar-actions">
              <button className="button primary" onClick={() => openMovement(exactItem, "add")}>
                {text.addStock}
              </button>
              <button
                className="button secondary"
                onClick={() => openMovement(exactItem, "remove")}
              >
                {text.removeStock}
              </button>
            </div>
          ) : query.trim() ? (
            <button
              className="button primary add-new-button"
              disabled={busy}
              onClick={() => void submitNewItem()}
            >
              {text.addItem}
            </button>
          ) : null}
        </div>
        {similarItems.length > 0 && (
          <div className="similar-items">
            <span>{text.similarItems}:</span>
            {similarItems.map((item) => (
              <button key={item.id} type="button" onClick={() => setQuery(item.name)}>
                {item.name}
              </button>
            ))}
          </div>
        )}

        <div className="list-controls">
          <label>
            {text.filter}
            <select
              value={stockFilter}
              onChange={(event) => {
                setStockFilter(event.target.value)
                setItemPage(0)
              }}
            >
              <option value="all">{text.allStock}</option>
              <option value="in-stock">{text.inStock}</option>
              <option value="out-of-stock">{text.outOfStock}</option>
            </select>
          </label>
          <label>
            {text.quantityFilter}
            <select
              aria-label={text.comparator}
              value={quantityComparator}
              onChange={(event) => {
                setQuantityComparator(event.target.value)
                setItemPage(0)
              }}
            >
              <option value=">">&gt;</option>
              <option value="<">&lt;</option>
              <option value="=">=</option>
            </select>
            <input
              className="quantity-filter-input"
              type="number"
              min="0"
              step="1"
              value={quantityTarget}
              onChange={(event) => {
                setQuantityTarget(event.target.value)
                setItemPage(0)
              }}
              aria-label={text.quantityFilter}
            />
          </label>
        </div>

        <div className="table-wrap">
          <table className="stock-table">
            <thead>
              <tr>
                <th>
                  <button
                    className="column-sort"
                    onClick={() => {
                      setSortMode(sortMode === "name-asc" ? "name-desc" : "name-asc")
                      setItemPage(0)
                    }}
                  >
                    {text.name}
                    <span aria-hidden="true">
                      {sortMode.startsWith("name-") ? (sortMode === "name-asc" ? "↑" : "↓") : "↕"}
                    </span>
                  </button>
                </th>
                <th>
                  <button
                    className="column-sort"
                    onClick={() => {
                      setSortMode(sortMode === "quantity-asc" ? "quantity-desc" : "quantity-asc")
                      setItemPage(0)
                    }}
                  >
                    {text.quantity}
                    <span aria-hidden="true">
                      {sortMode.startsWith("quantity-")
                        ? sortMode === "quantity-asc"
                          ? "↑"
                          : "↓"
                        : "↕"}
                    </span>
                  </button>
                </th>
                <th>{text.actions}</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td className="empty-cell" colSpan={3}>
                    {text.noItems}
                  </td>
                </tr>
              ) : (
                pageItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <button
                        className="item-name item-name-button"
                        onClick={() => {
                          setQuery(item.name)
                          setItemPage(0)
                          setHistoryPage(0)
                          searchInputRef.current?.focus()
                        }}
                      >
                        {item.name}
                      </button>
                    </td>
                    <td>
                      <span
                        className={`quantity-badge ${item.quantity === 0 ? "zero" : ""}`}
                        aria-label={`${text.setStock}: ${item.name}`}
                        onClick={() => openMovement(item, "set")}
                      >
                        {item.quantity}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="button small primary"
                          onClick={() => openMovement(item, "add")}
                        >
                          {text.addStock}
                        </button>
                        <button
                          className="button small secondary"
                          onClick={() => openMovement(item, "remove")}
                        >
                          {text.removeStock}
                        </button>
                        <button
                          className="button small danger-quiet"
                          onClick={() => void deleteItem(item)}
                        >
                          {text.delete}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="table-pagination">
          <label>
            {text.showRows}
            <select
              value={itemPageSize}
              onChange={(event) => {
                setItemPageSize(Number(event.target.value))
                setItemPage(0)
              }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </label>
          <span>
            {format(text.page, {
              current: String(visibleItemPage + 1),
              total: String(itemPageCount),
            })}
          </span>
          <div>
            <button
              className="button secondary small"
              disabled={itemPage === 0}
              onClick={() => setItemPage((page) => Math.max(0, page - 1))}
            >
              {text.previous}
            </button>
            <button
              className="button secondary small"
              disabled={visibleItemPage + 1 >= itemPageCount}
              onClick={() => setItemPage((page) => Math.min(itemPageCount - 1, page + 1))}
            >
              {text.next}
            </button>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>{text.activity}</h2>
        </div>
        <div className="table-wrap">
          <table className="stock-table activity-table">
            <thead>
              <tr>
                <th>{text.item}</th>
                <th>{text.action}</th>
                <th>{text.amount}</th>
                <th>{text.who}</th>
                <th>{text.when}</th>
              </tr>
            </thead>
            <tbody>
              {filteredMovements.length === 0 ? (
                <tr>
                  <td className="empty-cell" colSpan={5}>
                    {text.noActivity}
                  </td>
                </tr>
              ) : (
                pageMovements.map((entry: StockMovement) => (
                  <tr key={entry.id}>
                    <td className="item-name">{entry.itemName}</td>
                    <td>
                      <span className={`movement-tag ${entry.type}`}>
                        {entry.type === "add" ? text.add : text.remove}
                      </span>
                    </td>
                    <td>{entry.amount}</td>
                    <td>{entry.actor}</td>
                    <td className="date-cell">{formatDate(entry.timestamp, language)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="table-pagination">
          <label>
            {text.showRows}
            <select
              value={historyPageSize}
              onChange={(event) => {
                setHistoryPageSize(Number(event.target.value))
                setHistoryPage(0)
              }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </label>
          <span>
            {format(text.page, {
              current: String(visibleHistoryPage + 1),
              total: String(historyPageCount),
            })}
          </span>
          <div>
            <button
              className="button secondary small"
              disabled={historyPage === 0}
              onClick={() => setHistoryPage((page) => Math.max(0, page - 1))}
            >
              {text.previous}
            </button>
            <button
              className="button secondary small"
              disabled={visibleHistoryPage + 1 >= historyPageCount}
              onClick={() => setHistoryPage((page) => Math.min(historyPageCount - 1, page + 1))}
            >
              {text.next}
            </button>
          </div>
        </div>
      </section>

      {settingsDraft && (
        <section className="panel settings-panel">
          <div className="section-heading">
            <div>
              <h2>{text.settings}</h2>
              <span className="muted">
                {text.appVersion}: {appVersion}
              </span>
              <span className="muted">
                {text.dataVersion}: {state.dataVersion}
              </span>
            </div>
          </div>
          <form onSubmit={(event) => void saveSettings(event)}>
            <p className="backup-location">
              {text.automaticBackupLocation} <code>{backupLocation || "..."}</code>
            </p>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={settingsDraft.autoBackupEnabled}
                onChange={(event) =>
                  setSettingsDraft({ ...settingsDraft, autoBackupEnabled: event.target.checked })
                }
              />
              {text.autoBackup}
            </label>
            <div className="backup-fields">
              <label>
                {text.every}
                <input
                  type="number"
                  min={1}
                  max={8760}
                  value={settingsDraft.backupIntervalHours}
                  onChange={(event) =>
                    setSettingsDraft({
                      ...settingsDraft,
                      backupIntervalHours: Number(event.target.value),
                    })
                  }
                  required
                />
                {text.hours}
              </label>
              <label>
                {text.keep}
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={settingsDraft.backupRetentionDays}
                  onChange={(event) =>
                    setSettingsDraft({
                      ...settingsDraft,
                      backupRetentionDays: Number(event.target.value),
                    })
                  }
                  required
                />
                {text.days}
              </label>
            </div>
            <div className="settings-actions">
              <button className="button primary" type="submit">
                {text.saveSettings}
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={() => void createBackup()}
              >
                {text.backupNow}
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={() => void restoreBackup()}
              >
                {text.browseBackup}
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={() => void openBackupFolder()}
              >
                {text.openBackupFolder}
              </button>
            </div>
          </form>
        </section>
      )}

      {locationDialogOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setLocationDialogOpen(false)
          }}
        >
          <form className="modal" onSubmit={(event) => void submitNewLocation(event)}>
            <h2>{text.addLocation}</h2>
            <label>
              {text.locationName}
              <input
                autoFocus
                value={locationName}
                onChange={(event) => setLocationName(event.target.value)}
                required
              />
            </label>
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setLocationDialogOpen(false)
                  setLocationName("")
                }}
              >
                {text.cancel}
              </button>
              <button className="button primary" disabled={busy}>
                {text.addLocation}
              </button>
            </div>
          </form>
        </div>
      )}

      {locationToRename && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setLocationToRename(null)
          }}
        >
          <form className="modal" onSubmit={(event) => void submitRenameLocation(event)}>
            <h2>{text.renameLocation}</h2>
            <label>
              {text.locationName}
              <input
                autoFocus
                value={locationName}
                onChange={(event) => setLocationName(event.target.value)}
                required
              />
            </label>
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setLocationToRename(null)
                  setLocationName("")
                }}
              >
                {text.cancel}
              </button>
              <button className="button primary" disabled={busy}>
                {text.rename}
              </button>
            </div>
          </form>
        </div>
      )}

      {movement && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setMovement(null)
              searchInputRef.current?.focus()
            }
          }}
        >
          <form
            className={`modal movement-modal movement-${movementAction}`}
            onSubmit={(event) => void submitMovement(event)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault()
                setQuery("")
                setItemPage(0)
                setHistoryPage(0)
                setQuantityTarget("")
                setMovement(null)
                searchInputRef.current?.focus()
              }
            }}
          >
            <h2>{text.moveTitle}</h2>
            <p className="muted">{movement.item.name}</p>
            <div className="movement-equation">
              <div className="equation-value">
                <span className="equation-caption">{text.startingQuantity}</span>
                <span>{movementBase}</span>
              </div>
              <span className="equation-operator equation-sign" aria-hidden="true">
                {movementDifference < 0 ? "−" : "+"}
              </span>
              <label className="equation-value equation-delta">
                <span className="equation-caption">
                  {movement.type === "set" ? text.difference : text.amount}
                </span>
                {movement.type === "set" ? (
                  <span>{Math.abs(movementDifference)}</span>
                ) : (
                  <input
                    ref={amountInputRef}
                    type="number"
                    min="1"
                    step="1"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    required
                    autoFocus
                    aria-label={text.amount}
                  />
                )}
              </label>
              <span className="equation-operator" aria-hidden="true">
                =
              </span>
              <label className="equation-value">
                <span className="equation-caption">{text.resultingQuantity}</span>
                {movement.type === "set" ? (
                  <input
                    ref={amountInputRef}
                    type="number"
                    min="0"
                    step="1"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    required
                    autoFocus
                    aria-label={text.setQuantity}
                  />
                ) : (
                  <span>{movementResult}</span>
                )}
              </label>
            </div>
            <label>
              {text.person}
              <input value={actor} onChange={(event) => setActor(event.target.value)} required />
            </label>
            <div className="modal-actions">
              <button type="button" className="button secondary" onClick={() => setMovement(null)}>
                {text.cancel}
              </button>
              <button className="button primary movement-save" disabled={busy}>
                {text.save}
              </button>
            </div>
          </form>
        </div>
      )}
      {renameOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setRenameOpen(false)
          }}
        >
          <form
            className="modal"
            onSubmit={(event) => {
              event.preventDefault()
              void renameUser()
            }}
          >
            <h2>{text.renameUsername}</h2>
            <p className="muted">{text.renameHint}</p>
            <label>
              {text.username}
              <input
                value={renameDraft}
                onChange={(event) => setRenameDraft(event.target.value)}
                required
                autoFocus
              />
            </label>
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setRenameOpen(false)}
              >
                {text.cancel}
              </button>
              <button className="button primary">{text.rename}</button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}

export default App
