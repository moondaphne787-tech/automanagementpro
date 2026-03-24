import type { Student, Billing, TrialConversion } from '@/types'
import { generateId, ipcQuery, ipcQueryOne } from './utils'
import { studentDb } from './students'

// 体验生成交记录操作
export const trialConversionDb = {
  async create(data: {
    student_id: string
    trial_date?: string
    conversion_date?: string
    converted?: boolean
    commission_note?: string
    notes?: string
  }): Promise<TrialConversion> {
    const id = generateId()
    const now = new Date().toISOString()
    
    await ipcQuery(
      `INSERT INTO trial_conversions (id, student_id, trial_date, conversion_date, converted, commission_note, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.student_id, data.trial_date || null, data.conversion_date || null, data.converted ? 1 : 0, data.commission_note || null, data.notes || null, now]
    )
    
    const result = await this.getById(id)
    if (!result) throw new Error('Failed to create trial conversion')
    return result
  },
  
  async getById(id: string): Promise<TrialConversion | undefined> {
    const record = await ipcQueryOne<any>(`SELECT * FROM trial_conversions WHERE id = ?`, [id])
    if (record) {
      record.converted = !!record.converted
    }
    return record as TrialConversion | undefined
  },
  
  async getByStudentId(studentId: string): Promise<TrialConversion | undefined> {
    const record = await ipcQueryOne<any>(
      `SELECT * FROM trial_conversions WHERE student_id = ?`,
      [studentId]
    )
    if (record) {
      record.converted = !!record.converted
    }
    return record as TrialConversion | undefined
  },
  
  async update(id: string, data: Partial<TrialConversion>): Promise<TrialConversion | undefined> {
    const fields: string[] = []
    const values: unknown[] = []
    
    for (const [key, value] of Object.entries(data)) {
      if (key === 'converted') {
        fields.push(`${key} = ?`)
        values.push(value ? 1 : 0)
      } else if (key !== 'id' && key !== 'created_at') {
        fields.push(`${key} = ?`)
        values.push(value)
      }
    }
    
    if (fields.length > 0) {
      values.push(id)
      await ipcQuery(`UPDATE trial_conversions SET ${fields.join(', ')} WHERE id = ?`, values)
    }
    
    return this.getById(id)
  },
  
  async delete(id: string): Promise<void> {
    await ipcQuery(`DELETE FROM trial_conversions WHERE id = ?`, [id])
  },
  
  // 获取所有体验生（带学员信息）
  async getAllTrialStudents(): Promise<(Student & { conversion: TrialConversion | null, billing: Billing | null })[]> {
    const results = await ipcQuery<any[]>(`
      SELECT s.*, 
             tc.id as conversion_id, tc.trial_date, tc.conversion_date, tc.converted, tc.commission_note as tc_commission_note, tc.notes as tc_notes, tc.created_at as tc_created_at,
             b.id as billing_id, b.total_hours, b.used_hours, b.warning_threshold
      FROM students s
      LEFT JOIN trial_conversions tc ON s.id = tc.student_id
      LEFT JOIN billing b ON s.id = b.student_id
      WHERE s.student_type = 'trial'
      ORDER BY s.created_at DESC
    `)
    
    return results.map((row: any) => ({
      id: row.id,
      student_no: row.student_no,
      name: row.name,
      school: row.school,
      grade: row.grade,
      account: row.account,
      enroll_date: row.enroll_date,
      student_type: row.student_type,
      status: row.status,
      level: row.level,
      initial_score: row.initial_score,
      initial_vocab: row.initial_vocab,
      phonics_progress: row.phonics_progress,
      phonics_completed: !!row.phonics_completed,
      ipa_completed: !!row.ipa_completed,
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
      conversion: row.conversion_id ? {
        id: row.conversion_id,
        student_id: row.id,
        trial_date: row.trial_date,
        conversion_date: row.conversion_date,
        converted: !!row.converted,
        commission_note: row.tc_commission_note,
        notes: row.tc_notes,
        created_at: row.tc_created_at
      } : null,
      billing: row.billing_id ? {
        id: row.billing_id,
        student_id: row.id,
        total_hours: row.total_hours || 0,
        used_hours: row.used_hours || 0,
        remaining_hours: (row.total_hours || 0) - (row.used_hours || 0),
        warning_threshold: row.warning_threshold || 3,
        last_payment_date: null,
        notes: null,
        created_at: row.created_at,
        updated_at: row.updated_at
      } : null
    }))
  },
  
  // 获取月度成交统计
  async getMonthlyConversions(year: number, month: number): Promise<{
    total: number
    converted: number
    pending: number
    conversions: (TrialConversion & { student: Student })[]
  }> {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`
    
    const results = await ipcQuery<any[]>(`
      SELECT tc.*, s.id as student_id, s.student_no, s.name, s.school, s.grade, s.account, s.enroll_date, s.student_type, s.status, s.level, s.initial_score, s.initial_vocab, s.phonics_progress, s.phonics_completed, s.ipa_completed, s.notes, s.created_at as student_created_at, s.updated_at
      FROM trial_conversions tc
      JOIN students s ON tc.student_id = s.id
      WHERE tc.trial_date >= ? AND tc.trial_date < ?
      ORDER BY tc.trial_date DESC
    `, [startDate, endDate])
    
    const conversions = results.map((row: any) => ({
      id: row.id,
      student_id: row.student_id,
      trial_date: row.trial_date,
      conversion_date: row.conversion_date,
      converted: !!row.converted,
      commission_note: row.commission_note,
      notes: row.notes,
      created_at: row.created_at,
      student: {
        id: row.student_id,
        student_no: row.student_no,
        name: row.name,
        school: row.school,
        grade: row.grade,
        account: row.account,
        enroll_date: row.enroll_date,
        student_type: row.student_type,
        status: row.status,
        level: row.level,
        initial_score: row.initial_score,
        initial_vocab: row.initial_vocab,
        phonics_progress: row.phonics_progress,
        phonics_completed: !!row.phonics_completed,
        ipa_completed: !!row.ipa_completed,
        notes: row.notes,
        created_at: row.student_created_at,
        updated_at: row.updated_at
      }
    }))
    
    const converted = conversions.filter(c => c.converted).length
    
    return {
      total: conversions.length,
      converted,
      pending: conversions.length - converted,
      conversions
    }
  },
  
  // 获取年度月度统计数据
  async getYearlyStats(year: number): Promise<{ month: number; total: number; converted: number }[]> {
    const stats: { month: number; total: number; converted: number }[] = []
    
    for (let month = 1; month <= 12; month++) {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const endDate = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`
      
      const result = await ipcQueryOne<{ total: number; converted: number }>(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN converted = 1 THEN 1 ELSE 0 END) as converted
        FROM trial_conversions
        WHERE trial_date >= ? AND trial_date < ?
      `, [startDate, endDate])
      
      stats.push({
        month,
        total: result?.total || 0,
        converted: result?.converted || 0
      })
    }
    
    return stats
  },
  
  // 标记成交（自动转正式学员）
  async markConverted(studentId: string, conversionDate: string, commissionNote?: string): Promise<{ student: Student; conversion: TrialConversion }> {
    // 更新学员类型为正式学员
    await ipcQuery(
      `UPDATE students SET student_type = 'formal', status = 'active', updated_at = ? WHERE id = ?`,
      [new Date().toISOString(), studentId]
    )
    
    // 查找或创建成交记录
    let conversion = await this.getByStudentId(studentId)
    
    if (conversion) {
      conversion = await this.update(conversion.id, {
        converted: true,
        conversion_date: conversionDate,
        commission_note: commissionNote
      })
    } else {
      conversion = await this.create({
        student_id: studentId,
        converted: true,
        conversion_date: conversionDate,
        commission_note: commissionNote
      })
    }
    
    const student = await studentDb.getById(studentId)
    if (!student || !conversion) throw new Error('Failed to mark conversion')
    
    return { student, conversion }
  }
}