import { ipcQuery, ipcQueryOne } from './utils'

// 设置操作
export const settingsDb = {
  async get(key: string): Promise<string | null> {
    const result = await ipcQueryOne<{ value: string }>(`SELECT value FROM settings WHERE key = ?`, [key])
    return result?.value || null
  },
  
  async set(key: string, value: string): Promise<void> {
    await ipcQuery(
      `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
      [key, value]
    )
  }
}