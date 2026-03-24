import type { StudentWordbankProgress } from '@/types'
import { generateId, ipcQuery, ipcQueryOne } from './utils'
import { wordbankDb } from './wordbanks'

// 进度操作
export const progressDb = {
  async getByStudentId(studentId: string): Promise<StudentWordbankProgress[]> {
    return ipcQuery<StudentWordbankProgress[]>(
      `SELECT * FROM student_wordbank_progress WHERE student_id = ? ORDER BY created_at`,
      [studentId]
    )
  },
  
  async upsert(data: {
    student_id: string
    wordbank_id: string
    current_level: number
    total_levels_override?: number
    last_nine_grid_level?: number
    status?: 'active' | 'completed' | 'paused'
    notes?: string
  }): Promise<void> {
    const wordbanks = await wordbankDb.getAll()
    const wordbank = wordbanks.find(w => w.id === data.wordbank_id)
    const existing = await ipcQueryOne<StudentWordbankProgress>(
      `SELECT * FROM student_wordbank_progress WHERE student_id = ? AND wordbank_id = ?`,
      [data.student_id, data.wordbank_id]
    )
    
    if (existing) {
      await ipcQuery(
        `UPDATE student_wordbank_progress SET current_level = ?, total_levels_override = ?, last_nine_grid_level = ?, status = ?, notes = ?, updated_at = ? WHERE id = ?`,
        [data.current_level, data.total_levels_override || null, data.last_nine_grid_level || existing.last_nine_grid_level, data.status || 'active', data.notes || null, new Date().toISOString(), existing.id]
      )
    } else {
      const id = generateId()
      const now = new Date().toISOString()
      await ipcQuery(
        `INSERT INTO student_wordbank_progress (id, student_id, wordbank_id, wordbank_label, current_level, total_levels_override, last_nine_grid_level, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, data.student_id, data.wordbank_id, wordbank?.name || '未知词库', data.current_level, data.total_levels_override || null, data.last_nine_grid_level || 0, data.status || 'active', data.notes || null, now, now]
      )
    }
  },
  
  async delete(studentId: string, wordbankId: string): Promise<void> {
    await ipcQuery(`DELETE FROM student_wordbank_progress WHERE student_id = ? AND wordbank_id = ?`, [studentId, wordbankId])
  }
}