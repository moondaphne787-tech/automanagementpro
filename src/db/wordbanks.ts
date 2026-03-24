import type { Wordbank } from '@/types'
import { generateId, ipcQuery, ipcQueryOne } from './utils'

// 词库操作
export const wordbankDb = {
  async getAll(): Promise<Wordbank[]> {
    return ipcQuery<Wordbank[]>(`SELECT * FROM wordbanks ORDER BY sort_order`)
  },
  
  async create(data: Omit<Wordbank, 'id'>): Promise<Wordbank> {
    const id = generateId()
    await ipcQuery(
      `INSERT INTO wordbanks (id, name, total_levels, nine_grid_interval, category, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, data.name, data.total_levels, data.nine_grid_interval, data.category, data.sort_order]
    )
    const result = await ipcQueryOne<Wordbank>(`SELECT * FROM wordbanks WHERE id = ?`, [id])
    return result!
  },
  
  async update(id: string, data: Partial<Wordbank>): Promise<Wordbank | undefined> {
    const fields: string[] = []
    const values: unknown[] = []
    
    for (const [key, value] of Object.entries(data)) {
      if (key !== 'id' && key !== 'created_at') {
        fields.push(`${key} = ?`)
        values.push(value)
      }
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