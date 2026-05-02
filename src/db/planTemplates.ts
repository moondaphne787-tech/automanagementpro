import { ipcQuery, generateId } from './utils'

export interface PlanTemplate {
  id: string
  name: string
  category: string | null
  tasks: string
  notes: string | null
  sort_order: number
  created_at: string
}

export type PlanTemplateCreate = Pick<PlanTemplate, 'name' | 'category' | 'tasks' | 'notes'>

export const planTemplateDb = {
  /** 获取所有模板，按 sort_order 排序 */
  async getAll(): Promise<PlanTemplate[]> {
    return ipcQuery<PlanTemplate[]>(
      `SELECT * FROM plan_templates ORDER BY sort_order ASC, created_at ASC`
    )
  },

  /** 按分类获取模板 */
  async getByCategory(category: string): Promise<PlanTemplate[]> {
    return ipcQuery<PlanTemplate[]>(
      `SELECT * FROM plan_templates WHERE category = ? ORDER BY sort_order ASC, created_at ASC`,
      [category]
    )
  },

  /** 获取所有可用分类 */
  async getCategories(): Promise<string[]> {
    const rows = await ipcQuery<{ category: string }[]>(
      `SELECT DISTINCT category FROM plan_templates WHERE category IS NOT NULL ORDER BY category ASC`
    )
    return rows.map(r => r.category)
  },

  /** 创建模板 */
  async create(data: PlanTemplateCreate): Promise<PlanTemplate> {
    const id = generateId()
    await ipcQuery(
      `INSERT INTO plan_templates (id, name, category, tasks, notes) VALUES (?, ?, ?, ?, ?)`,
      [id, data.name, data.category ?? null, data.tasks, data.notes ?? null]
    )
    return { id, name: data.name, category: data.category ?? null, tasks: data.tasks, notes: data.notes ?? null, sort_order: 0, created_at: new Date().toISOString() }
  },

  /** 更新模板 */
  async update(id: string, data: Partial<PlanTemplateCreate & { sort_order: number }>): Promise<void> {
    const fields: string[] = []
    const params: unknown[] = []
    if (data.name !== undefined) { fields.push('name = ?'); params.push(data.name) }
    if (data.category !== undefined) { fields.push('category = ?'); params.push(data.category) }
    if (data.tasks !== undefined) { fields.push('tasks = ?'); params.push(data.tasks) }
    if (data.notes !== undefined) { fields.push('notes = ?'); params.push(data.notes) }
    if (data.sort_order !== undefined) { fields.push('sort_order = ?'); params.push(data.sort_order) }
    if (fields.length === 0) return
    params.push(id)
    await ipcQuery(
      `UPDATE plan_templates SET ${fields.join(', ')} WHERE id = ?`,
      params
    )
  },

  /** 删除模板 */
  async delete(id: string): Promise<void> {
    await ipcQuery(`DELETE FROM plan_templates WHERE id = ?`, [id])
  },
}
