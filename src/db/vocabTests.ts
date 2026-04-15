import type { VocabTest } from '@/types'
import { generateId, ipcQuery, ipcQueryOne, isAllowedField, VOCAB_TEST_UPDATABLE_FIELDS } from './utils'

export const vocabTestDb = {
  async create(data: {
    student_id: string
    test_date: string
    vocab_count: number
    test_source?: string
    notes?: string
  }): Promise<VocabTest> {
    const id = generateId()

    await ipcQuery(
      `INSERT INTO vocab_tests (id, student_id, test_date, vocab_count, test_source, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, data.student_id, data.test_date, data.vocab_count, data.test_source || null, data.notes || null]
    )

    const result = await this.getById(id)
    if (!result) throw new Error('Failed to create vocab test')
    return result
  },

  async getById(id: string): Promise<VocabTest | undefined> {
    return ipcQueryOne<VocabTest>(`SELECT * FROM vocab_tests WHERE id = ?`, [id])
  },

  async getByStudentId(studentId: string): Promise<VocabTest[]> {
    return ipcQuery<VocabTest[]>(
      `SELECT * FROM vocab_tests WHERE student_id = ? ORDER BY test_date DESC`,
      [studentId]
    )
  },

  async update(id: string, data: Partial<VocabTest>): Promise<VocabTest | undefined> {
    const fields: string[] = []
    const values: unknown[] = []

    for (const [key, value] of Object.entries(data)) {
      if (!isAllowedField(key, VOCAB_TEST_UPDATABLE_FIELDS)) continue
      fields.push(`${key} = ?`)
      values.push(value)
    }

    if (fields.length > 0) {
      values.push(id)
      await ipcQuery(`UPDATE vocab_tests SET ${fields.join(', ')} WHERE id = ?`, values)
    }

    return this.getById(id)
  },

  async delete(id: string): Promise<void> {
    await ipcQuery(`DELETE FROM vocab_tests WHERE id = ?`, [id])
  }
}
