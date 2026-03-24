import type { LearningPhase } from '@/types'
import { generateId, ipcQuery, ipcQueryOne } from './utils'

// 学习阶段操作
export const learningPhaseDb = {
  async create(data: {
    student_id: string
    phase_name?: string
    phase_type?: 'semester' | 'summer' | 'winter'
    start_date?: string
    end_date?: string
    goal?: string
    vocab_start?: number
    vocab_end?: number
    summary?: string
  }): Promise<LearningPhase> {
    const id = generateId()
    const now = new Date().toISOString()
    
    await ipcQuery(
      `INSERT INTO learning_phases (id, student_id, phase_name, phase_type, start_date, end_date, goal, vocab_start, vocab_end, summary, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.student_id, data.phase_name || null, data.phase_type || 'semester', data.start_date || null, data.end_date || null, data.goal || null, data.vocab_start ?? null, data.vocab_end ?? null, data.summary || null, now]
    )
    
    const result = await this.getById(id)
    if (!result) throw new Error('Failed to create learning phase')
    return result
  },
  
  async getById(id: string): Promise<LearningPhase | undefined> {
    return ipcQueryOne<LearningPhase>(`SELECT * FROM learning_phases WHERE id = ?`, [id])
  },
  
  async getByStudentId(studentId: string): Promise<LearningPhase[]> {
    return ipcQuery<LearningPhase[]>(
      `SELECT * FROM learning_phases WHERE student_id = ? ORDER BY start_date DESC`,
      [studentId]
    )
  },
  
  async getCurrentPhase(studentId: string): Promise<LearningPhase | undefined> {
    const today = new Date().toISOString().split('T')[0]
    return ipcQueryOne<LearningPhase>(
      `SELECT * FROM learning_phases WHERE student_id = ? AND start_date <= ? AND (end_date IS NULL OR end_date >= ?) ORDER BY start_date DESC LIMIT 1`,
      [studentId, today, today]
    )
  },
  
  async update(id: string, data: Partial<LearningPhase>): Promise<LearningPhase | undefined> {
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
      await ipcQuery(`UPDATE learning_phases SET ${fields.join(', ')} WHERE id = ?`, values)
    }
    
    return this.getById(id)
  },
  
  async delete(id: string): Promise<void> {
    await ipcQuery(`DELETE FROM learning_phases WHERE id = ?`, [id])
  }
}