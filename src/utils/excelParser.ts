import * as XLSX from 'xlsx'
import { parseFeedback } from './feedbackParser'
import type { TaskBlock } from '@/types'

// Excel 列名到系统字段的映射
const COLUMN_MAPPING: Record<string, string> = {
  '署名': 'student_name',
  '学生到课情况': 'attendance',
  '学员年级': 'grade',
  '学习时长': 'duration_hours',
  '助教老师': 'teacher_name',
  '今日主要学习内容': 'content',
  '今日词库主要学习内容': 'content',
  '词库': 'wordbank',
  '已学到词库的第几关': 'level',
  '清理九宫格多少个词': 'nine_grid_count',
  '是否完成学习任务': 'task_completed',
  '未完成学习任务原因': 'incomplete_reason',
  '学情反馈': 'detail_feedback',
  '备注': 'notes'
}

// 忽略的字段
const IGNORED_COLUMNS = [
  '请各位助教自查',
  '当日计划本',
  '课程体验',
  '评分',
  '昵称'
]

/**
 * 解析后的 Excel 行数据
 */
export interface ParsedExcelRow {
  student_name: string
  grade?: string
  duration_hours: number
  teacher_name?: string
  attendance: 'present' | 'absent' | 'late'
  task_completed: 'completed' | 'partial' | 'not_completed'
  incomplete_reason?: string
  detail_feedback?: string
  tasks: TaskBlock[]
  notes?: string
  wordbank?: string
  level?: string
  nine_grid_count?: number
  rawRow: Record<string, any>
}

/**
 * 解析结果
 */
export interface ParseResult {
  success: boolean
  data: ParsedExcelRow[]
  errors: string[]
  columnStatus: Record<string, 'recognized' | 'ignored' | 'unrecognized'>
}

/**
 * 识别列名
 */
function identifyColumn(colName: string): { field: string | null; status: 'recognized' | 'ignored' | 'unrecognized' } {
  const trimmedName = colName.trim()
  
  // 检查是否在忽略列表中
  for (const ignored of IGNORED_COLUMNS) {
    if (trimmedName.includes(ignored)) {
      return { field: null, status: 'ignored' }
    }
  }
  
  // 检查是否有映射
  for (const [key, field] of Object.entries(COLUMN_MAPPING)) {
    if (trimmedName.includes(key)) {
      return { field, status: 'recognized' }
    }
  }
  
  return { field: null, status: 'unrecognized' }
}

/**
 * 解析出勤状态
 */
function parseAttendance(value: any): 'present' | 'absent' | 'late' {
  if (!value) return 'present'
  const str = String(value).toLowerCase()
  if (str.includes('到') || str.includes('出勤') || str.includes('present')) {
    return 'present'
  }
  if (str.includes('缺') || str.includes('未到') || str.includes('absent')) {
    return 'absent'
  }
  if (str.includes('迟') || str.includes('late')) {
    return 'late'
  }
  return 'present'
}

/**
 * 解析任务完成状态
 */
function parseTaskCompleted(value: any): 'completed' | 'partial' | 'not_completed' {
  if (!value) return 'completed'
  const str = String(value).toLowerCase()
  if (str.includes('是') || str.includes('完成') || str.includes('yes')) {
    return 'completed'
  }
  if (str.includes('部分') || str.includes('未完成') || str.includes('否')) {
    return 'partial'
  }
  return 'completed'
}

/**
 * 解析课时时长
 */
function parseDuration(value: any): number {
  if (!value) return 1
  if (typeof value === 'number') return value
  const str = String(value)
  // 尝试提取数字
  const match = str.match(/(\d+(?:\.\d+)?)/)
  if (match) {
    return parseFloat(match[1])
  }
  return 1
}

/**
 * 解析 Excel 文件
 */
export function parseExcelFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        
        // 获取第一个工作表
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        
        // 转换为 JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as Record<string, any>[]
        
        if (jsonData.length === 0) {
          resolve({
            success: false,
            data: [],
            errors: ['Excel 文件为空或格式不正确'],
            columnStatus: {}
          })
          return
        }
        
        // 识别列状态
        const headers = Object.keys(jsonData[0])
        const columnStatus: Record<string, 'recognized' | 'ignored' | 'unrecognized'> = {}
        
        for (const header of headers) {
          const { status } = identifyColumn(header)
          columnStatus[header] = status
        }
        
        // 解析每一行
        const parsedData: ParsedExcelRow[] = []
        const errors: string[] = []
        
        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i]
          
          try {
            // 提取学员姓名
            let studentName = ''
            for (const [key, field] of Object.entries(COLUMN_MAPPING)) {
              if (field === 'student_name' && row[key] !== undefined) {
                studentName = String(row[key]).trim()
                break
              }
            }
            
            if (!studentName) {
              errors.push(`第 ${i + 2} 行：缺少学员姓名`)
              continue
            }
            
            // 提取其他字段
            let duration_hours = 1
            let teacher_name = ''
            let attendance: 'present' | 'absent' | 'late' = 'present'
            let task_completed: 'completed' | 'partial' | 'not_completed' = 'completed'
            let incomplete_reason = ''
            let detail_feedback = ''
            let notes = ''
            let grade = ''
            let wordbank = ''
            let level = ''
            let nine_grid_count = 0
            
            for (const [excelCol, systemField] of Object.entries(COLUMN_MAPPING)) {
              const value = row[excelCol]
              if (value === undefined || value === '') continue
              
              switch (systemField) {
                case 'duration_hours':
                  duration_hours = parseDuration(value)
                  break
                case 'teacher_name':
                  teacher_name = String(value).trim()
                  break
                case 'attendance':
                  attendance = parseAttendance(value)
                  break
                case 'task_completed':
                  task_completed = parseTaskCompleted(value)
                  break
                case 'incomplete_reason':
                  incomplete_reason = String(value).trim()
                  break
                case 'detail_feedback':
                  detail_feedback = String(value).trim()
                  break
                case 'notes':
                  notes = String(value).trim()
                  break
                case 'grade':
                  grade = String(value).trim()
                  break
                case 'wordbank':
                  wordbank = String(value).trim()
                  break
                case 'level':
                  level = String(value).trim()
                  break
              }
            }
            
            // 解析学情反馈，提取任务块
            const tasks = parseFeedback(detail_feedback)
            
            parsedData.push({
              student_name: studentName,
              grade,
              duration_hours,
              teacher_name,
              attendance,
              task_completed,
              incomplete_reason,
              detail_feedback,
              tasks,
              notes,
              wordbank,
              level,
              nine_grid_count,
              rawRow: row
            })
            
          } catch (error) {
            errors.push(`第 ${i + 2} 行解析失败：${error}`)
          }
        }
        
        resolve({
          success: parsedData.length > 0,
          data: parsedData,
          errors,
          columnStatus
        })
        
      } catch (error) {
        reject(new Error(`解析 Excel 文件失败：${error}`))
      }
    }
    
    reader.onerror = () => {
      reject(new Error('读取文件失败'))
    }
    
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Excel 导入预览数据
 */
export interface ImportPreviewItem {
  student_name: string
  student_id?: string
  matched: boolean
  tasks: TaskBlock[]
  duration_hours: number
  teacher_name?: string
  attendance: 'present' | 'absent' | 'late'
  task_completed: 'completed' | 'partial' | 'not_completed'
  detail_feedback?: string
  issues?: string
}

/**
 * 创建导入预览
 */
export function createImportPreview(
  parsedData: ParsedExcelRow[],
  existingStudents: Array<{ id: string; name: string; grade?: string | null }>
): ImportPreviewItem[] {
  return parsedData.map(row => {
    // 尝试匹配学员
    const matchedStudent = existingStudents.find(s => 
      s.name === row.student_name || 
      s.name.includes(row.student_name) ||
      row.student_name.includes(s.name)
    )
    
    // 检查是否有解析问题
    const issues: string[] = []
    if (row.tasks.length === 0) {
      issues.push('未能从学情反馈中解析出任务')
    }
    if (!row.detail_feedback) {
      issues.push('缺少学情反馈')
    }
    
    return {
      student_name: row.student_name,
      student_id: matchedStudent?.id,
      matched: !!matchedStudent,
      tasks: row.tasks,
      duration_hours: row.duration_hours,
      teacher_name: row.teacher_name,
      attendance: row.attendance,
      task_completed: row.task_completed,
      detail_feedback: row.detail_feedback,
      issues: issues.length > 0 ? issues.join('；') : undefined
    }
  })
}