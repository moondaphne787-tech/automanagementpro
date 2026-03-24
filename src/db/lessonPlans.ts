import type { LessonPlan } from '@/types'
import { generateId, ipcQuery, ipcQueryOne } from './utils'

// 课程计划操作
export const lessonPlanDb = {
  // 获取过期未执行计划
  async getExpiredPlans(studentId: string): Promise<LessonPlan[]> {
    const today = new Date().toISOString().split('T')[0]
    
    // 查找过期且未被执行的计划（没有对应的课堂记录关联）
    const plans = await ipcQuery<any[]>(
      `SELECT lp.* FROM lesson_plans lp
       WHERE lp.student_id = ? 
       AND lp.plan_date IS NOT NULL 
       AND lp.plan_date < ?
       AND NOT EXISTS (
         SELECT 1 FROM class_records cr WHERE cr.student_id = lp.student_id AND cr.class_date = lp.plan_date
       )
       ORDER BY lp.plan_date DESC`,
      [studentId, today]
    )
    
    return plans.map(plan => {
      plan.tasks = JSON.parse(plan.tasks || '[]')
      plan.generated_by_ai = !!plan.generated_by_ai
      return plan as LessonPlan
    })
  },
  
  // 批量获取多个学员的过期计划数量
  async getExpiredPlansCount(studentIds: string[]): Promise<Map<string, number>> {
    const result = new Map<string, number>()
    if (studentIds.length === 0) return result
    
    const today = new Date().toISOString().split('T')[0]
    const placeholders = studentIds.map(() => '?').join(',')
    
    const counts = await ipcQuery<{ student_id: string; count: number }[]>(
      `SELECT lp.student_id, COUNT(*) as count FROM lesson_plans lp
       WHERE lp.student_id IN (${placeholders})
       AND lp.plan_date IS NOT NULL 
       AND lp.plan_date < ?
       AND NOT EXISTS (
         SELECT 1 FROM class_records cr WHERE cr.student_id = lp.student_id AND cr.class_date = lp.plan_date
       )
       GROUP BY lp.student_id`,
      [...studentIds, today]
    )
    
    counts.forEach(item => {
      result.set(item.student_id, item.count)
    })
    
    return result
  },

  async create(data: {
    student_id: string
    phase_id?: string
    plan_date?: string
    tasks: unknown[]
    notes?: string
    ai_reason?: string
    generated_by_ai?: boolean
  }): Promise<LessonPlan> {
    const id = generateId()
    const now = new Date().toISOString()
    
    await ipcQuery(
      `INSERT INTO lesson_plans (id, student_id, phase_id, plan_date, tasks, notes, ai_reason, generated_by_ai, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, 
        data.student_id, 
        data.phase_id || null,
        data.plan_date || null,
        JSON.stringify(data.tasks),
        data.notes || null,
        data.ai_reason || null,
        data.generated_by_ai ? 1 : 0,
        now
      ]
    )
    
    const result = await this.getById(id)
    if (!result) throw new Error('Failed to create lesson plan')
    return result
  },
  
  async getById(id: string): Promise<LessonPlan | undefined> {
    const plan = await ipcQueryOne<any>(`SELECT * FROM lesson_plans WHERE id = ?`, [id])
    if (plan) {
      plan.tasks = JSON.parse(plan.tasks || '[]')
      plan.generated_by_ai = !!plan.generated_by_ai
    }
    return plan as LessonPlan | undefined
  },
  
  async getByStudentId(studentId: string): Promise<LessonPlan[]> {
    const plans = await ipcQuery<any[]>(
      `SELECT * FROM lesson_plans WHERE student_id = ? ORDER BY plan_date DESC, created_at DESC`,
      [studentId]
    )
    return plans.map(plan => {
      plan.tasks = JSON.parse(plan.tasks || '[]')
      plan.generated_by_ai = !!plan.generated_by_ai
      return plan as LessonPlan
    })
  },
  
  async update(id: string, data: Partial<LessonPlan>): Promise<LessonPlan | undefined> {
    const fields: string[] = []
    const values: unknown[] = []
    
    for (const [key, value] of Object.entries(data)) {
      if (key === 'tasks') {
        fields.push(`${key} = ?`)
        values.push(JSON.stringify(value))
      } else if (key === 'generated_by_ai') {
        fields.push(`${key} = ?`)
        values.push(value ? 1 : 0)
      } else if (key !== 'id' && key !== 'created_at') {
        fields.push(`${key} = ?`)
        values.push(value)
      }
    }
    
    if (fields.length > 0) {
      values.push(id)
      await ipcQuery(`UPDATE lesson_plans SET ${fields.join(', ')} WHERE id = ?`, values)
    }
    
    return this.getById(id)
  },
  
  async delete(id: string): Promise<void> {
    await ipcQuery(`DELETE FROM lesson_plans WHERE id = ?`, [id])
  },
  
  async getLastPlanSummary(studentId: string): Promise<string | null> {
    const plan = await ipcQueryOne<any>(
      `SELECT tasks, notes FROM lesson_plans WHERE student_id = ? ORDER BY created_at DESC LIMIT 1`,
      [studentId]
    )
    if (!plan) return null
    
    const tasks = JSON.parse(plan.tasks || '[]')
    if (tasks.length === 0) return null
    
    const taskSummary = tasks.map((t: any) => {
      if (t.wordbank_label && t.level_from && t.level_to) {
        return `${t.wordbank_label}第${t.level_from}-${t.level_to}关`
      }
      return t.content || t.type
    }).join(' + ')
    
    return `上次计划：${taskSummary}`
  }
}