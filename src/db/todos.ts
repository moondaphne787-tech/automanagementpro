import { generateId, ipcQuery, ipcQueryOne } from './utils'

export interface Todo {
  id: string
  content: string
  student_id?: string
  student_name?: string
  due_date?: string
  completed: boolean
  completed_at?: string
  created_at: string
  sort_order: number
}

export const todoDb = {
  async getAll(): Promise<Todo[]> {
    const rows = await ipcQuery<any[]>(
      `SELECT * FROM todos ORDER BY completed ASC, sort_order DESC, created_at DESC`
    )
    return rows.map(r => ({ ...r, completed: !!r.completed }))
  },

  async getActive(): Promise<Todo[]> {
    const rows = await ipcQuery<any[]>(
      `SELECT * FROM todos WHERE completed = 0 ORDER BY sort_order DESC, created_at DESC`
    )
    return rows.map(r => ({ ...r, completed: false }))
  },

  async getCompleted(): Promise<Todo[]> {
    const rows = await ipcQuery<any[]>(
      `SELECT * FROM todos WHERE completed = 1 ORDER BY completed_at DESC`
    )
    return rows.map(r => ({ ...r, completed: true }))
  },

  async getById(id: string): Promise<Todo | undefined> {
    const row = await ipcQueryOne<any>(`SELECT * FROM todos WHERE id = ?`, [id])
    if (row) {
      return { ...row, completed: !!row.completed }
    }
    return undefined
  },

  async create(data: Omit<Todo, 'id' | 'created_at' | 'completed' | 'completed_at'>): Promise<Todo> {
    const id = generateId()
    await ipcQuery(
      `INSERT INTO todos (id, content, student_id, student_name, due_date, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, data.content, data.student_id ?? null, data.student_name ?? null, data.due_date ?? null, data.sort_order ?? 0]
    )
    const rows = await ipcQuery<any[]>(`SELECT * FROM todos WHERE id = ?`, [id])
    return { ...rows[0], completed: false }
  },

  async toggleComplete(id: string, completed: boolean): Promise<void> {
    await ipcQuery(
      `UPDATE todos SET completed = ?, completed_at = ? WHERE id = ?`,
      [completed ? 1 : 0, completed ? new Date().toISOString() : null, id]
    )
  },

  async update(id: string, data: Partial<Omit<Todo, 'id' | 'created_at'>>): Promise<Todo | undefined> {
    const fields: string[] = []
    const values: unknown[] = []
    
    for (const [key, value] of Object.entries(data)) {
      if (key === 'completed') {
        fields.push(`${key} = ?`)
        values.push(value ? 1 : 0)
      } else if (key !== 'id' && key !== 'created_at') {
        fields.push(`${key} = ?`)
        values.push(value)
      }
    }
    
    if (fields.length > 0) {
      values.push(id)
      await ipcQuery(`UPDATE todos SET ${fields.join(', ')} WHERE id = ?`, values)
    }
    
    return this.getById(id)
  },

  async delete(id: string): Promise<void> {
    await ipcQuery(`DELETE FROM todos WHERE id = ?`, [id])
  },

  async deleteCompletedOlderThan(days: number): Promise<void> {
    const cutoff = new Date(Date.now() - days * 86400000).toISOString()
    await ipcQuery(
      `DELETE FROM todos WHERE completed = 1 AND completed_at < ?`,
      [cutoff]
    )
  },

  async clearCompleted(): Promise<void> {
    await ipcQuery(`DELETE FROM todos WHERE completed = 1`)
  }
}