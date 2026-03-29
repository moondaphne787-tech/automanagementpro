import type { Teacher, TeacherAvailability, StudentSchedulePreference, ScheduledClass, DayOfWeek, Student } from '@/types'
import { generateId, ipcQuery, ipcQueryOne } from './utils'

// 老师可用时段操作
export const teacherAvailabilityDb = {
  async create(data: {
    teacher_id: string
    week_start?: string
    day_of_week: DayOfWeek
    start_time?: string
    end_time?: string
    notes?: string
  }): Promise<TeacherAvailability> {
    const id = generateId()
    
    await ipcQuery(
      `INSERT INTO teacher_availability (id, teacher_id, week_start, day_of_week, start_time, end_time, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, data.teacher_id, data.week_start || null, data.day_of_week, data.start_time || null, data.end_time || null, data.notes || null]
    )
    
    const result = await this.getById(id)
    if (!result) throw new Error('Failed to create teacher availability')
    return result
  },
  
  async getById(id: string): Promise<TeacherAvailability | undefined> {
    return ipcQueryOne<TeacherAvailability>(`SELECT * FROM teacher_availability WHERE id = ?`, [id])
  },
  
  async getByTeacherId(teacherId: string): Promise<TeacherAvailability[]> {
    return ipcQuery<TeacherAvailability[]>(
      `SELECT * FROM teacher_availability WHERE teacher_id = ? ORDER BY day_of_week, start_time`,
      [teacherId]
    )
  },
  
  async getByWeek(weekStart: string): Promise<TeacherAvailability[]> {
    return ipcQuery<TeacherAvailability[]>(
      `SELECT * FROM teacher_availability WHERE week_start = ? OR week_start IS NULL ORDER BY day_of_week, start_time`,
      [weekStart]
    )
  },
  
  async update(id: string, data: Partial<TeacherAvailability>): Promise<TeacherAvailability | undefined> {
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
      await ipcQuery(`UPDATE teacher_availability SET ${fields.join(', ')} WHERE id = ?`, values)
    }
    
    return this.getById(id)
  },
  
  async delete(id: string): Promise<void> {
    await ipcQuery(`DELETE FROM teacher_availability WHERE id = ?`, [id])
  },
  
  async deleteByTeacher(teacherId: string): Promise<void> {
    await ipcQuery(`DELETE FROM teacher_availability WHERE teacher_id = ?`, [teacherId])
  }
}

// 学生固定时段偏好操作
export const studentSchedulePreferenceDb = {
  async create(data: {
    student_id: string
    day_of_week: DayOfWeek
    preferred_start?: string
    preferred_end?: string
    semester?: string
    notes?: string
  }): Promise<StudentSchedulePreference> {
    const id = generateId()
    
    await ipcQuery(
      `INSERT INTO student_schedule_preferences (id, student_id, day_of_week, preferred_start, preferred_end, semester, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, data.student_id, data.day_of_week, data.preferred_start || null, data.preferred_end || null, data.semester || null, data.notes || null]
    )
    
    const result = await this.getById(id)
    if (!result) throw new Error('Failed to create student schedule preference')
    return result
  },
  
  async getById(id: string): Promise<StudentSchedulePreference | undefined> {
    return ipcQueryOne<StudentSchedulePreference>(`SELECT * FROM student_schedule_preferences WHERE id = ?`, [id])
  },
  
  async getByStudentId(studentId: string): Promise<StudentSchedulePreference[]> {
    return ipcQuery<StudentSchedulePreference[]>(
      `SELECT * FROM student_schedule_preferences WHERE student_id = ? ORDER BY day_of_week, preferred_start`,
      [studentId]
    )
  },
  
  // 获取所有学员的时段偏好（带学员信息）
  async getAllWithStudents(): Promise<(StudentSchedulePreference & { student: Student })[]> {
    const results = await ipcQuery<any[]>(`
      SELECT ssp.*, s.id as student_id, s.name as student_name, s.grade, s.level, s.status, s.student_type
      FROM student_schedule_preferences ssp
      LEFT JOIN students s ON ssp.student_id = s.id
      WHERE s.status = 'active'
      ORDER BY ssp.day_of_week, ssp.preferred_start, s.name
    `)
    
    return results.map(row => ({
      id: row.id,
      student_id: row.student_id,
      day_of_week: row.day_of_week,
      preferred_start: row.preferred_start,
      preferred_end: row.preferred_end,
      semester: row.semester,
      notes: row.notes,
      student: {
        id: row.student_id,
        name: row.student_name,
        grade: row.grade,
        level: row.level,
        status: row.status,
        student_type: row.student_type
      } as Student
    }))
  },
  
  // 批量创建时段偏好（用于从排课历史复制）
  async batchCreate(preferences: Array<{
    student_id: string
    day_of_week: DayOfWeek
    preferred_start?: string
    preferred_end?: string
    notes?: string
  }>): Promise<{ success: number; failed: number }> {
    let success = 0
    let failed = 0
    
    for (const pref of preferences) {
      try {
        await this.create(pref)
        success++
      } catch (error) {
        console.error('Failed to create preference:', error)
        failed++
      }
    }
    
    return { success, failed }
  },
  
  async update(id: string, data: Partial<StudentSchedulePreference>): Promise<StudentSchedulePreference | undefined> {
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
      await ipcQuery(`UPDATE student_schedule_preferences SET ${fields.join(', ')} WHERE id = ?`, values)
    }
    
    return this.getById(id)
  },
  
  async delete(id: string): Promise<void> {
    await ipcQuery(`DELETE FROM student_schedule_preferences WHERE id = ?`, [id])
  },
  
  async deleteByStudent(studentId: string): Promise<void> {
    await ipcQuery(`DELETE FROM student_schedule_preferences WHERE student_id = ?`, [studentId])
  }
}

// 课表操作
export const scheduledClassDb = {
  async create(data: {
    student_id: string
    teacher_id?: string
    class_date: string
    start_time?: string
    end_time?: string
    duration_hours?: number
    status?: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled'
    rescheduled_from_id?: string
    cancel_reason?: string
    notes?: string
  }): Promise<ScheduledClass> {
    const id = generateId()
    const now = new Date().toISOString()
    
    await ipcQuery(
      `INSERT INTO scheduled_classes (id, student_id, teacher_id, class_date, start_time, end_time, duration_hours, status, rescheduled_from_id, cancel_reason, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.student_id, data.teacher_id || null, data.class_date, data.start_time || null, data.end_time || null, data.duration_hours || 1, data.status || 'scheduled', data.rescheduled_from_id || null, data.cancel_reason || null, data.notes || null, now]
    )
    
    const result = await this.getById(id)
    if (!result) throw new Error('Failed to create scheduled class')
    return result
  },
  
  async getById(id: string): Promise<ScheduledClass | undefined> {
    return ipcQueryOne<ScheduledClass>(`SELECT * FROM scheduled_classes WHERE id = ?`, [id])
  },
  
  async getByDate(date: string): Promise<(ScheduledClass & { student?: Student; teacher?: Teacher })[]> {
    const results = await ipcQuery<any[]>(`
      SELECT sc.*, s.name as student_name, s.grade, s.level, t.name as teacher_name
      FROM scheduled_classes sc
      LEFT JOIN students s ON sc.student_id = s.id
      LEFT JOIN teachers t ON sc.teacher_id = t.id
      WHERE sc.class_date = ?
      ORDER BY sc.start_time
    `, [date])
    
    return results.map(row => ({
      id: row.id,
      student_id: row.student_id,
      teacher_id: row.teacher_id,
      class_date: row.class_date,
      start_time: row.start_time,
      end_time: row.end_time,
      duration_hours: row.duration_hours,
      status: row.status,
      rescheduled_from_id: row.rescheduled_from_id,
      cancel_reason: row.cancel_reason,
      notes: row.notes,
      created_at: row.created_at,
      student: {
        id: row.student_id,
        name: row.student_name,
        grade: row.grade,
        level: row.level
      } as Student,
      teacher: row.teacher_id ? {
        id: row.teacher_id,
        name: row.teacher_name
      } as Teacher : undefined
    }))
  },
  
  async getByWeek(startDate: string, endDate: string): Promise<(ScheduledClass & { student?: Student; teacher?: Teacher })[]> {
    const results = await ipcQuery<any[]>(`
      SELECT sc.*, s.name as student_name, s.grade, s.level, t.name as teacher_name
      FROM scheduled_classes sc
      LEFT JOIN students s ON sc.student_id = s.id
      LEFT JOIN teachers t ON sc.teacher_id = t.id
      WHERE sc.class_date >= ? AND sc.class_date <= ?
      ORDER BY sc.class_date, sc.start_time
    `, [startDate, endDate])
    
    return results.map(row => ({
      id: row.id,
      student_id: row.student_id,
      teacher_id: row.teacher_id,
      class_date: row.class_date,
      start_time: row.start_time,
      end_time: row.end_time,
      duration_hours: row.duration_hours,
      status: row.status,
      rescheduled_from_id: row.rescheduled_from_id,
      cancel_reason: row.cancel_reason,
      notes: row.notes,
      created_at: row.created_at,
      student: {
        id: row.student_id,
        name: row.student_name,
        grade: row.grade,
        level: row.level
      } as Student,
      teacher: row.teacher_id ? {
        id: row.teacher_id,
        name: row.teacher_name
      } as Teacher : undefined
    }))
  },
  
  async getByStudentId(studentId: string): Promise<ScheduledClass[]> {
    return ipcQuery<ScheduledClass[]>(
      `SELECT * FROM scheduled_classes WHERE student_id = ? ORDER BY class_date DESC, start_time`,
      [studentId]
    )
  },
  
  async getByTeacherId(teacherId: string): Promise<ScheduledClass[]> {
    return ipcQuery<ScheduledClass[]>(
      `SELECT * FROM scheduled_classes WHERE teacher_id = ? ORDER BY class_date DESC, start_time`,
      [teacherId]
    )
  },
  
  async update(id: string, data: Partial<ScheduledClass>): Promise<ScheduledClass | undefined> {
    const fields: string[] = []
    const values: unknown[] = []
    
    for (const [key, value] of Object.entries(data)) {
      if (key !== 'id' && key !== 'created_at') {
        fields.push(`${key} = ?`)
        values.push(value)
      }
    }
    
    if (fields.length > 0) {
      values.push(id)
      await ipcQuery(`UPDATE scheduled_classes SET ${fields.join(', ')} WHERE id = ?`, values)
    }
    
    return this.getById(id)
  },
  
  async delete(id: string): Promise<void> {
    await ipcQuery(`DELETE FROM scheduled_classes WHERE id = ?`, [id])
  },
  
  // 检查时段冲突
  async checkConflict(teacherId: string, date: string, startTime: string, endTime: string, excludeId?: string): Promise<ScheduledClass | null> {
    let sql = `
      SELECT * FROM scheduled_classes 
      WHERE teacher_id = ? AND class_date = ? AND status != 'cancelled'
      AND ((start_time <= ? AND end_time > ?) OR (start_time < ? AND end_time >= ?) OR (start_time >= ? AND end_time <= ?))
    `
    const params: unknown[] = [teacherId, date, startTime, startTime, endTime, endTime, startTime, endTime]
    
    if (excludeId) {
      sql += ` AND id != ?`
      params.push(excludeId)
    }
    
    const result = await ipcQueryOne<ScheduledClass>(sql, params)
    return result || null
  },
  
  // 批量创建排课
  async batchCreate(classes: Array<{
    student_id: string
    teacher_id?: string
    class_date: string
    start_time?: string
    end_time?: string
    duration_hours?: number
    notes?: string
  }>): Promise<{ success: number; failed: number; conflicts: string[] }> {
    let success = 0
    let failed = 0
    const conflicts: string[] = []
    
    for (const cls of classes) {
      try {
        // 检查冲突
        if (cls.teacher_id && cls.start_time && cls.end_time) {
          const conflict = await this.checkConflict(cls.teacher_id, cls.class_date, cls.start_time, cls.end_time)
          if (conflict) {
            conflicts.push(`${cls.class_date} ${cls.start_time}-${cls.end_time}`)
            failed++
            continue
          }
        }
        
        await this.create(cls)
        success++
      } catch (error) {
        console.error('Failed to create scheduled class:', error)
        failed++
      }
    }
    
    return { success, failed, conflicts }
  },
  
  // 调课
  async reschedule(id: string, newDate: string, newStartTime?: string, newEndTime?: string, newTeacherId?: string): Promise<ScheduledClass> {
    const original = await this.getById(id)
    if (!original) throw new Error('Scheduled class not found')
    
    // 创建新记录（状态为 scheduled，表示新的有效排课）
    const newClass = await this.create({
      student_id: original.student_id,
      teacher_id: newTeacherId || original.teacher_id || undefined,
      class_date: newDate,
      start_time: newStartTime || original.start_time || undefined,
      end_time: newEndTime || original.end_time || undefined,
      duration_hours: original.duration_hours,
      status: 'scheduled',
      rescheduled_from_id: id,
      notes: `调课自 ${original.class_date}`
    })
    
    // 更新原记录状态为 rescheduled，表示已被调走
    await this.update(id, { status: 'rescheduled', cancel_reason: `已调课至 ${newDate} ${newStartTime || ''}` })
    
    return newClass
  },
  
  // 取消课程
  async cancel(id: string, reason?: string): Promise<ScheduledClass | undefined> {
    return this.update(id, {
      status: 'cancelled',
      cancel_reason: reason || null
    })
  }
}