import type { ExamScore } from '@/types'
import { generateId, ipcQuery, ipcQueryOne } from './utils'

// 考试成绩操作
export const examScoreDb = {
  async create(data: {
    student_id: string
    exam_date: string
    exam_name?: string
    exam_type?: 'school_exam' | 'placement' | 'mock'
    score?: number
    full_score?: number
    notes?: string
  }): Promise<ExamScore> {
    const id = generateId()
    
    await ipcQuery(
      `INSERT INTO exam_scores (id, student_id, exam_date, exam_name, exam_type, score, full_score, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.student_id, data.exam_date, data.exam_name || null, data.exam_type || 'school_exam', data.score ?? null, data.full_score || 100, data.notes || null]
    )
    
    const result = await this.getById(id)
    if (!result) throw new Error('Failed to create exam score')
    return result
  },
  
  async getById(id: string): Promise<ExamScore | undefined> {
    return ipcQueryOne<ExamScore>(`SELECT * FROM exam_scores WHERE id = ?`, [id])
  },
  
  async getByStudentId(studentId: string): Promise<ExamScore[]> {
    return ipcQuery<ExamScore[]>(
      `SELECT * FROM exam_scores WHERE student_id = ? ORDER BY exam_date DESC`,
      [studentId]
    )
  },
  
  async update(id: string, data: Partial<ExamScore>): Promise<ExamScore | undefined> {
    const fields: string[] = []
    const values: unknown[] = []
    
    for (const [key, value] of Object.entries(data)) {
      if (key !== 'id') {
        fields.push(`${key} = ?`)
        values.push(value)
      }
    }
    
    if (fields.length > 0) {
      values.push(id)
      await ipcQuery(`UPDATE exam_scores SET ${fields.join(', ')} WHERE id = ?`, values)
    }
    
    return this.getById(id)
  },
  
  async delete(id: string): Promise<void> {
    await ipcQuery(`DELETE FROM exam_scores WHERE id = ?`, [id])
  },
  
  // 批量获取多个学员的考试成绩（解决 N+1 查询问题）
  async getAllForStudents(studentIds: string[]): Promise<Map<string, ExamScore[]>> {
    if (studentIds.length === 0) return new Map()
    
    const placeholders = studentIds.map(() => '?').join(',')
    const scores = await ipcQuery<ExamScore[]>(
      `SELECT * FROM exam_scores WHERE student_id IN (${placeholders}) ORDER BY exam_date DESC`,
      studentIds
    )
    
    const result = new Map<string, ExamScore[]>()
    for (const score of scores) {
      if (!result.has(score.student_id)) {
        result.set(score.student_id, [])
      }
      result.get(score.student_id)!.push(score)
    }
    
    return result
  }
}
