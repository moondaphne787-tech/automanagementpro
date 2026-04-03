import type { Wordbank } from '@/types'
import { generateId, ipcQuery, ipcQueryOne, isAllowedField, WORDBANK_UPDATABLE_FIELDS } from './utils'

// 词库操作
export const wordbankDb = {
  async getAll(): Promise<Wordbank[]> {
    return ipcQuery<Wordbank[]>(`SELECT * FROM wordbanks ORDER BY sort_order`)
  },
  
  async getByName(name: string): Promise<Wordbank | undefined> {
    return ipcQueryOne<Wordbank>(`SELECT * FROM wordbanks WHERE name = ?`, [name])
  },
  
  async create(data: Omit<Wordbank, 'id'>): Promise<Wordbank> {
    const id = generateId()
    await ipcQuery(
      `INSERT INTO wordbanks (id, name, total_levels, nine_grid_interval, category, sort_order, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, data.name, data.total_levels, data.nine_grid_interval, data.category, data.sort_order, data.notes ?? null]
    )
    const result = await ipcQueryOne<Wordbank>(`SELECT * FROM wordbanks WHERE id = ?`, [id])
    return result!
  },
  
  /**
   * 创建词库，如果名称已存在则更新现有记录（UPSERT）
   * 用于自动创建场景，防止重复插入导致 UNIQUE 约束错误
   */
  async upsert(data: Omit<Wordbank, 'id'>): Promise<Wordbank> {
    // 先检查是否存在同名词库
    const existing = await ipcQueryOne<Wordbank>(
      `SELECT * FROM wordbanks WHERE name = ?`,
      [data.name]
    )
    
    if (existing) {
      // 已存在，更新记录
      await ipcQuery(
        `UPDATE wordbanks SET total_levels = ?, nine_grid_interval = ?, category = ?, sort_order = ?, notes = ? WHERE id = ?`,
        [data.total_levels, data.nine_grid_interval, data.category, data.sort_order, data.notes || null, existing.id]
      )
      const result = await ipcQueryOne<Wordbank>(`SELECT * FROM wordbanks WHERE id = ?`, [existing.id])
      return result!
    } else {
      // 不存在，创建新记录
      return this.create(data)
    }
  },
  
  async update(id: string, data: Partial<Wordbank>): Promise<Wordbank | undefined> {
    const fields: string[] = []
    const values: unknown[] = []
    
    for (const [key, value] of Object.entries(data)) {
      if (!isAllowedField(key, WORDBANK_UPDATABLE_FIELDS)) continue
      fields.push(`${key} = ?`)
      values.push(value)
    }
    
    if (fields.length > 0) {
      values.push(id)
      await ipcQuery(`UPDATE wordbanks SET ${fields.join(', ')} WHERE id = ?`, values)
    }
    
    return ipcQueryOne<Wordbank>(`SELECT * FROM wordbanks WHERE id = ?`, [id])
  },
  
  async delete(id: string): Promise<void> {
    await ipcQuery(`DELETE FROM wordbanks WHERE id = ?`, [id])
  }
}