import { ipcQuery, ipcQueryOne, generateId } from './utils'

export interface GrowthNote {
  id: string
  student_id: string
  note_date: string
  category: 'semester_summary' | 'attitude' | 'parent_comm' | 'highlight'
  content: string
  created_at: string
}

export const growthNoteDb = {
  async create(data: {
    student_id: string
    note_date: string
    category: 'semester_summary' | 'attitude' | 'parent_comm' | 'highlight'
    content: string
  }): Promise<GrowthNote> {
    const id = generateId()
    const now = new Date().toISOString()
    await ipcQuery(
      `INSERT INTO student_growth_notes (id, student_id, note_date, category, content, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, data.student_id, data.note_date, data.category, data.content, now]
    )
    const result = await this.getById(id)
    if (!result) throw new Error('Failed to create growth note')
    return result
  },

  async getById(id: string): Promise<GrowthNote | undefined> {
    return ipcQueryOne<GrowthNote>(`SELECT * FROM student_growth_notes WHERE id = ?`, [id])
  },

  async getByStudentId(studentId: string): Promise<GrowthNote[]> {
    return ipcQuery<GrowthNote[]>(
      `SELECT * FROM student_growth_notes WHERE student_id = ? ORDER BY note_date DESC, created_at DESC`,
      [studentId]
    )
  },

  async update(id: string, data: { note_date?: string; category?: string; content?: string }): Promise<void> {
    const sets: string[] = []
    const params: unknown[] = []
    if (data.note_date !== undefined) { sets.push('note_date = ?'); params.push(data.note_date) }
    if (data.category !== undefined) { sets.push('category = ?'); params.push(data.category) }
    if (data.content !== undefined) { sets.push('content = ?'); params.push(data.content) }
    if (sets.length === 0) return
    params.push(id)
    await ipcQuery(`UPDATE student_growth_notes SET ${sets.join(', ')} WHERE id = ?`, params)
  },

  async delete(id: string): Promise<void> {
    await ipcQuery(`DELETE FROM student_growth_notes WHERE id = ?`, [id])
  },
}
