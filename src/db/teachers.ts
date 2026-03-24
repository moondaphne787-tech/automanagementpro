import type { Teacher } from '@/types'
import { generateId, ipcQuery, ipcQueryOne } from './utils'

// 助教操作
export const teacherDb = {
  async create(data: {
    name: string
    phone?: string
    university?: string
    major?: string
    enroll_date?: string
    status?: 'active' | 'inactive'
    vocab_level?: string
    oral_level?: 'basic' | 'intermediate' | 'advanced'
    teaching_style?: string
    suitable_grades?: string
    suitable_levels?: string[]
    training_stage?: 'probation' | 'intern' | 'formal'
    teacher_types?: ('regular' | 'vacation')[]
    total_teaching_hours?: number
    notes?: string
  }): Promise<Teacher> {
    const id = generateId()
    const now = new Date().toISOString()
    
    await ipcQuery(
      `INSERT INTO teachers (id, name, phone, university, major, enroll_date, status, vocab_level, oral_level, teaching_style, suitable_grades, suitable_levels, training_stage, teacher_types, total_teaching_hours, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.name, data.phone || null, data.university || null, data.major || null, data.enroll_date || null, data.status || 'active', data.vocab_level || null, data.oral_level || 'intermediate', data.teaching_style || null, data.suitable_grades || null, data.suitable_levels ? JSON.stringify(data.suitable_levels) : null, data.training_stage || 'probation', data.teacher_types ? JSON.stringify(data.teacher_types) : '[]', data.total_teaching_hours || 0, data.notes || null, now]
    )
    
    const result = await this.getById(id)
    if (!result) throw new Error('Failed to create teacher')
    return result
  },
  
  async getById(id: string): Promise<Teacher | undefined> {
    const teacher = await ipcQueryOne<any>(`SELECT * FROM teachers WHERE id = ?`, [id])
    if (teacher) {
      teacher.suitable_levels = teacher.suitable_levels ? JSON.parse(teacher.suitable_levels) : null
      teacher.teacher_types = teacher.teacher_types ? JSON.parse(teacher.teacher_types) : []
      teacher.total_teaching_hours = teacher.total_teaching_hours || 0
      teacher.training_stage = teacher.training_stage || 'probation'
    }
    return teacher as Teacher | undefined
  },
  
  async getAll(): Promise<Teacher[]> {
    const teachers = await ipcQuery<any[]>(`SELECT * FROM teachers ORDER BY created_at DESC`)
    return teachers.map(teacher => {
      teacher.suitable_levels = teacher.suitable_levels ? JSON.parse(teacher.suitable_levels) : null
      teacher.teacher_types = teacher.teacher_types ? JSON.parse(teacher.teacher_types) : []
      teacher.total_teaching_hours = teacher.total_teaching_hours || 0
      teacher.training_stage = teacher.training_stage || 'probation'
      return teacher as Teacher
    })
  },
  
  async getActive(): Promise<Teacher[]> {
    const teachers = await ipcQuery<any[]>(`SELECT * FROM teachers WHERE status = 'active' ORDER BY name`)
    return teachers.map(teacher => {
      teacher.suitable_levels = teacher.suitable_levels ? JSON.parse(teacher.suitable_levels) : null
      teacher.teacher_types = teacher.teacher_types ? JSON.parse(teacher.teacher_types) : []
      teacher.total_teaching_hours = teacher.total_teaching_hours || 0
      teacher.training_stage = teacher.training_stage || 'probation'
      return teacher as Teacher
    })
  },
  
  async update(id: string, data: Partial<Teacher>): Promise<Teacher | undefined> {
    const fields: string[] = []
    const values: unknown[] = []
    
    for (const [key, value] of Object.entries(data)) {
      if (key === 'suitable_levels' || key === 'teacher_types') {
        fields.push(`${key} = ?`)
        values.push(value ? JSON.stringify(value) : (key === 'teacher_types' ? '[]' : null))
      } else if (key !== 'id' && key !== 'created_at') {
        fields.push(`${key} = ?`)
        values.push(value)
      }
    }
    
    if (fields.length > 0) {
      values.push(id)
      await ipcQuery(`UPDATE teachers SET ${fields.join(', ')} WHERE id = ?`, values)
    }
    
    return this.getById(id)
  },
  
  async delete(id: string): Promise<void> {
    await ipcQuery(`DELETE FROM teachers WHERE id = ?`, [id])
  },
  
  // 累加教学时长
  async addTeachingHours(teacherId: string, hours: number): Promise<Teacher | undefined> {
    const teacher = await this.getById(teacherId)
    if (!teacher) return undefined
    
    return this.update(teacherId, {
      total_teaching_hours: teacher.total_teaching_hours + hours
    })
  },
  
  // 检查培训阶段升级
  async checkTrainingStageUpgrade(teacherId: string): Promise<{ upgraded: boolean; newStage?: string; message?: string }> {
    const teacher = await this.getById(teacherId)
    if (!teacher) return { upgraded: false }
    
    const hours = teacher.total_teaching_hours
    
    // 实训期满2小时 → 提醒升级实习期
    if (teacher.training_stage === 'probation' && hours >= 2) {
      return {
        upgraded: true,
        newStage: 'intern',
        message: `${teacher.name} 已累计教学 ${hours} 小时，建议从实训期升级为实习期`
      }
    }
    
    // 实习期满10小时 → 提醒升级正式助教
    if (teacher.training_stage === 'intern' && hours >= 10) {
      return {
        upgraded: true,
        newStage: 'formal',
        message: `${teacher.name} 已累计教学 ${hours} 小时，建议从实习期升级为正式助教`
      }
    }
    
    return { upgraded: false }
  },
  
  // 获取所有需要升级提醒的助教
  async getUpgradeReminders(): Promise<{ teacher: Teacher; newStage: string; message: string }[]> {
    const teachers = await this.getActive()
    const reminders: { teacher: Teacher; newStage: string; message: string }[] = []
    
    for (const teacher of teachers) {
      const result = await this.checkTrainingStageUpgrade(teacher.id)
      if (result.upgraded && result.newStage && result.message) {
        reminders.push({
          teacher,
          newStage: result.newStage,
          message: result.message
        })
      }
    }
    
    return reminders
  }
}