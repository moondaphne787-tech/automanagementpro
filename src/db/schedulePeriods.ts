import { ipcQuery, generateId } from './utils'

export interface SchedulePeriod {
  id: string
  name: string
  start_date: string
  end_date: string
  sort_order: number
  created_at: string
}

export type SchedulePeriodCreate = Pick<SchedulePeriod, 'name' | 'start_date' | 'end_date'>

export const schedulePeriodDb = {
  /** 获取所有时段，按 sort_order 排序 */
  async getAll(): Promise<SchedulePeriod[]> {
    return ipcQuery<SchedulePeriod[]>(
      `SELECT * FROM schedule_periods ORDER BY sort_order ASC, start_date ASC`
    )
  },

  /** 获取指定日期所属的时段（如果有多个重叠则取最早创建的） */
  async getByDate(date: string): Promise<SchedulePeriod | undefined> {
    const rows = await ipcQuery<SchedulePeriod[]>(
      `SELECT * FROM schedule_periods WHERE ? >= start_date AND ? <= end_date ORDER BY sort_order ASC, created_at ASC LIMIT 1`,
      [date, date]
    )
    return rows[0]
  },

  /** 创建时段 */
  async create(data: SchedulePeriodCreate): Promise<SchedulePeriod> {
    const id = generateId()
    await ipcQuery(
      `INSERT INTO schedule_periods (id, name, start_date, end_date) VALUES (?, ?, ?, ?)`,
      [id, data.name, data.start_date, data.end_date]
    )
    return { id, name: data.name, start_date: data.start_date, end_date: data.end_date, sort_order: 0, created_at: new Date().toISOString() }
  },

  /** 更新时段 */
  async update(id: string, data: Partial<SchedulePeriodCreate & { sort_order: number }>): Promise<void> {
    const fields: string[] = []
    const params: unknown[] = []
    if (data.name !== undefined) { fields.push('name = ?'); params.push(data.name) }
    if (data.start_date !== undefined) { fields.push('start_date = ?'); params.push(data.start_date) }
    if (data.end_date !== undefined) { fields.push('end_date = ?'); params.push(data.end_date) }
    if (data.sort_order !== undefined) { fields.push('sort_order = ?'); params.push(data.sort_order) }
    if (fields.length === 0) return
    params.push(id)
    await ipcQuery(`UPDATE schedule_periods SET ${fields.join(', ')} WHERE id = ?`, params)
  },

  /** 删除时段 */
  async delete(id: string): Promise<void> {
    await ipcQuery(`DELETE FROM schedule_periods WHERE id = ?`, [id])
  },
}
