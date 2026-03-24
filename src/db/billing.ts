import type { Billing } from '@/types'
import { ipcQuery, ipcQueryOne } from './utils'

// 课时操作
export const billingDb = {
  async getByStudentId(studentId: string): Promise<Billing | undefined> {
    const billing = await ipcQueryOne<Billing>(`SELECT *, total_hours - used_hours as remaining_hours FROM billing WHERE student_id = ?`, [studentId])
    return billing
  },
  
  async update(studentId: string, data: Partial<Billing>): Promise<Billing | undefined> {
    const fields: string[] = []
    const values: unknown[] = []
    
    for (const [key, value] of Object.entries(data)) {
      if (key !== 'id' && key !== 'student_id' && key !== 'created_at' && key !== 'remaining_hours') {
        fields.push(`${key} = ?`)
        values.push(value)
      }
    }
    
    if (fields.length > 0) {
      fields.push('updated_at = ?')
      values.push(new Date().toISOString())
      values.push(studentId)
      
      await ipcQuery(`UPDATE billing SET ${fields.join(', ')} WHERE student_id = ?`, values)
    }
    
    return this.getByStudentId(studentId)
  },
  
  async addHours(studentId: string, hours: number): Promise<Billing | undefined> {
    const billing = await this.getByStudentId(studentId)
    if (!billing) return undefined
    
    return this.update(studentId, {
      total_hours: billing.total_hours + hours,
      last_payment_date: new Date().toISOString().split('T')[0]
    })
  }
}