/**
 * 任务类型预设模板数据库存取层
 *
 * 每种任务类型可以有多个预设内容模板，用户在编辑任务时可快速选择
 */

import { ipcQuery, ipcQueryOne, generateId } from './utils'

export interface TaskPreset {
  id: string
  task_type: string
  label: string
  content: string
  sort_order: number
  created_at: string
}

export type TaskPresetCreate = Pick<TaskPreset, 'task_type' | 'label' | 'content'>

export const taskPresetDb = {
  /** 获取某类型的所有预设，按 sort_order 排序 */
  async getByType(taskType: string): Promise<TaskPreset[]> {
    return ipcQuery<TaskPreset[]>(
      `SELECT * FROM task_presets WHERE task_type = ? ORDER BY sort_order ASC, created_at ASC`,
      [taskType]
    )
  },

  /** 获取所有预设 */
  async getAll(): Promise<TaskPreset[]> {
    return ipcQuery<TaskPreset[]>(
      `SELECT * FROM task_presets ORDER BY task_type, sort_order ASC`
    )
  },

  /** 创建预设 */
  async create(data: TaskPresetCreate): Promise<TaskPreset> {
    const id = generateId()
    await ipcQuery(
      `INSERT INTO task_presets (id, task_type, label, content) VALUES (?, ?, ?, ?)`,
      [id, data.task_type, data.label, data.content]
    )
    return { ...data, id, sort_order: 0, created_at: new Date().toISOString() }
  },

  /** 更新预设 */
  async update(id: string, data: Partial<TaskPresetCreate>): Promise<void> {
    const fields: string[] = []
    const params: unknown[] = []
    if (data.label !== undefined) { fields.push('label = ?'); params.push(data.label) }
    if (data.content !== undefined) { fields.push('content = ?'); params.push(data.content) }
    if (data.task_type !== undefined) { fields.push('task_type = ?'); params.push(data.task_type) }
    if (fields.length === 0) return
    params.push(id)
    await ipcQuery(
      `UPDATE task_presets SET ${fields.join(', ')} WHERE id = ?`,
      params
    )
  },

  /** 删除预设 */
  async delete(id: string): Promise<void> {
    await ipcQuery(`DELETE FROM task_presets WHERE id = ?`, [id])
  },
}
