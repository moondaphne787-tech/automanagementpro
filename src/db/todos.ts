import type { TodoRow } from './utils'
import { generateId, ipcQuery, ipcQueryOne, mapTodo, isAllowedField, TODO_UPDATABLE_FIELDS } from './utils'
import type { Todo } from '@/types'

// 向后兼容：re-export Todo 类型
export type { Todo } from '@/types'

export const todoDb = {
  async getAll(): Promise<Todo[]> {
    // 使用 JOIN 查询从 students 表获取最新的学员姓名，避免数据不一致
    const rows = await ipcQuery<TodoRow[]>(
      `SELECT t.*, s.name as student_name 
       FROM todos t 
       LEFT JOIN students s ON t.student_id = s.id 
       ORDER BY t.completed ASC, t.sort_order DESC, t.created_at DESC`
    )
    return rows.map(mapTodo)
  },

  async getActive(): Promise<Todo[]> {
    // 使用 JOIN 查询从 students 表获取最新的学员姓名
    const rows = await ipcQuery<TodoRow[]>(
      `SELECT t.*, s.name as student_name 
       FROM todos t 
       LEFT JOIN students s ON t.student_id = s.id 
       WHERE t.completed = 0 
       ORDER BY t.sort_order DESC, t.created_at DESC`
    )
    return rows.map(mapTodo)
  },

  async getCompleted(): Promise<Todo[]> {
    // 使用 JOIN 查询从 students 表获取最新的学员姓名
    const rows = await ipcQuery<TodoRow[]>(
      `SELECT t.*, s.name as student_name 
       FROM todos t 
       LEFT JOIN students s ON t.student_id = s.id 
       WHERE t.completed = 1 
       ORDER BY t.completed_at DESC`
    )
    return rows.map(mapTodo)
  },

  async getById(id: string): Promise<Todo | undefined> {
    // 使用 JOIN 查询从 students 表获取最新的学员姓名
    const row = await ipcQueryOne<TodoRow>(
      `SELECT t.*, s.name as student_name 
       FROM todos t 
       LEFT JOIN students s ON t.student_id = s.id 
       WHERE t.id = ?`, 
      [id]
    )
    return row ? mapTodo(row) : undefined
  },

  async create(data: Omit<Todo, 'id' | 'created_at' | 'completed' | 'completed_at' | 'student_name'>): Promise<Todo> {
    const id = generateId()
    // 不存储 student_name，通过 JOIN 查询从 students 表获取，避免数据不一致
    await ipcQuery(
      `INSERT INTO todos (id, content, student_id, due_date, sort_order)
       VALUES (?, ?, ?, ?, ?)`,
      [id, data.content, data.student_id ?? null, data.due_date ?? null, data.sort_order ?? 0]
    )
    // 使用 getById 获取完整数据（包含通过 JOIN 查询的 student_name）
    return this.getById(id) as Promise<Todo>
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
      if (!isAllowedField(key, TODO_UPDATABLE_FIELDS)) continue
      if (key === 'completed') {
        fields.push(`${key} = ?`)
        values.push(value ? 1 : 0)
      } else {
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