import type { StudentWordbankProgress, Wordbank } from '@/types'
import { generateId, ipcQuery, ipcQueryOne, ipcTransaction } from './utils'
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

  /**
   * 批量更新进度（用于批量导入课堂记录时同步进度，避免 N+1 查询）
   * @param updates 需要更新的进度数据数组
   * @param wordbanks 预加载的词库列表
   * @param existingProgressMap 预加载的现有进度 Map<student_id, StudentWordbankProgress[]>
   */
  async batchUpsert(
    updates: Array<{
      student_id: string
      wordbank_id: string
      current_level: number
      last_nine_grid_level?: number
    }>,
    wordbanks: Wordbank[],
    existingProgressMap: Map<string, StudentWordbankProgress[]>
  ): Promise<void> {
    if (updates.length === 0) return

    const wordbankMap = new Map(wordbanks.map(w => [w.id, w]))
    const now = new Date().toISOString()
    
    // 按 (student_id, wordbank_id) 去重，只保留最新的进度
    const uniqueUpdates = new Map<string, typeof updates[0]>()
    for (const update of updates) {
      const key = `${update.student_id}|${update.wordbank_id}`
      const existing = uniqueUpdates.get(key)
      // 保留 current_level 更大的，或者有 last_nine_grid_level 的
      if (!existing || update.current_level > existing.current_level) {
        uniqueUpdates.set(key, update)
      } else if (update.last_nine_grid_level && !existing.last_nine_grid_level) {
        uniqueUpdates.set(key, { ...existing, last_nine_grid_level: update.last_nine_grid_level })
      }
    }

    // 收集所有需要执行的语句
    const statements: Array<{ sql: string; params: unknown[] }> = []

    for (const update of uniqueUpdates.values()) {
      const existingProgress = existingProgressMap.get(update.student_id) || []
      const existing = existingProgress.find(p => p.wordbank_id === update.wordbank_id)
      const wordbank = wordbankMap.get(update.wordbank_id)

      if (existing) {
        // 只有新关数大于当前关数才更新
        if (update.current_level > existing.current_level || update.last_nine_grid_level) {
          statements.push({
            sql: `UPDATE student_wordbank_progress SET current_level = ?, last_nine_grid_level = ?, updated_at = ? WHERE id = ?`,
            params: [
              Math.max(update.current_level, existing.current_level),
              update.last_nine_grid_level || existing.last_nine_grid_level,
              now,
              existing.id
            ]
          })
        }
      } else {
        // 插入新记录
        const id = generateId()
        statements.push({
          sql: `INSERT INTO student_wordbank_progress (id, student_id, wordbank_id, wordbank_label, current_level, total_levels_override, last_nine_grid_level, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          params: [id, update.student_id, update.wordbank_id, wordbank?.name || '未知词库', update.current_level, null, update.last_nine_grid_level || 0, 'active', null, now, now]
        })
      }
    }

    // 使用事务一次性执行所有语句，减少 IPC 往返次数
    if (statements.length > 0) {
      await ipcTransaction(statements)
    }
  },
  
  async delete(studentId: string, wordbankId: string): Promise<void> {
    await ipcQuery(`DELETE FROM student_wordbank_progress WHERE student_id = ? AND wordbank_id = ?`, [studentId, wordbankId])
  },

  // 获取所有词库进度（用于导出）
  async getAll(): Promise<StudentWordbankProgress[]> {
    return ipcQuery<StudentWordbankProgress[]>(
      `SELECT * FROM student_wordbank_progress`
    )
  },

  /**
   * 批量获取多个学员的词库进度（避免 N+1 查询）
   * @param studentIds 学员 ID 数组
   * @returns Map<student_id, StudentWordbankProgress[]>
   */
  async getAllForStudents(studentIds: string[]): Promise<Map<string, StudentWordbankProgress[]>> {
    if (studentIds.length === 0) return new Map()
    
    const placeholders = studentIds.map(() => '?').join(',')
    const rows = await ipcQuery<StudentWordbankProgress[]>(
      `SELECT * FROM student_wordbank_progress WHERE student_id IN (${placeholders})`,
      studentIds
    )
    
    const result = new Map<string, StudentWordbankProgress[]>()
    for (const row of rows) {
      if (!result.has(row.student_id)) {
        result.set(row.student_id, [])
      }
      result.get(row.student_id)!.push(row)
    }
    
    return result
  }
}
