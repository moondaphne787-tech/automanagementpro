import * as XLSX from 'xlsx'
import type { Student, Billing, Wordbank, LevelType, StudentStatus, StudentType, GradeType } from '@/types'

// 程度等级映射
const LEVEL_MAPPING: Record<string, LevelType> = {
  '薄弱': 'weak',
  '基础薄弱': 'weak',
  '较好': 'medium',
  '基础较好': 'medium',
  '中等': 'medium',
  '优秀': 'advanced',
  '非常优秀': 'advanced',
}

// 反向映射
const LEVEL_REVERSE_MAPPING: Record<LevelType, string> = {
  weak: '薄弱',
  medium: '较好',
  advanced: '优秀',
}

// 学员类型映射
const STUDENT_TYPE_MAPPING: Record<string, StudentType> = {
  '正式': 'formal',
  '正式学员': 'formal',
  '体验': 'trial',
  '体验生': 'trial',
}

// 学员类型反向映射
const STUDENT_TYPE_REVERSE_MAPPING: Record<StudentType, string> = {
  formal: '正式学员',
  trial: '体验生',
}

// 学员状态映射
const STATUS_MAPPING: Record<string, StudentStatus> = {
  '在读': 'active',
  '活跃': 'active',
  '暂停': 'paused',
  '结课': 'graduated',
  '毕业': 'graduated',
}

// 学员状态反向映射
const STATUS_REVERSE_MAPPING: Record<StudentStatus, string> = {
  active: '在读',
  paused: '暂停',
  graduated: '结课',
}

// 年级选项
const GRADE_OPTIONS: GradeType[] = [
  '三年级', '四年级', '五年级', '六年级',
  '初一', '初二', '初三',
  '高一', '高二', '高三',
  '大学'
]

/**
 * 学员导入数据
 */
export interface StudentImportData {
  // 基本信息
  student_no: string
  name: string
  school: string
  grade: string
  account: string
  enroll_date: string
  student_type: StudentType
  status: StudentStatus
  level: LevelType
  initial_score: number | null
  initial_vocab: number | null
  phonics_progress: string
  phonics_completed: boolean
  ipa_completed: boolean
  notes: string
  // 课时信息
  total_hours: number
  used_hours: number
}

/**
 * 词库进度导入数据
 */
export interface ProgressImportData {
  student_name: string
  wordbank_name: string
  current_level: number
  total_levels: number | null
  status: 'active' | 'completed' | 'paused'
}

/**
 * 解析后的学员数据（带状态）
 */
export interface ParsedStudentRow {
  index: number
  rawData: Record<string, any>
  data: Partial<StudentImportData>
  status: 'success' | 'warning' | 'error'
  issues: string[]
  matchedStudentId?: string
  duplicateAction?: 'skip' | 'update' | 'keep_both'
}

/**
 * 解析后的词库进度数据
 */
export interface ParsedProgressRow {
  index: number
  rawData: Record<string, any>
  data: Partial<ProgressImportData>
  studentIndex?: number // 关联的学员行索引
  status: 'success' | 'warning' | 'error'
  issues: string[]
  wordbankMatched?: boolean
  wordbankId?: string
}

/**
 * 导入预览结果
 */
export interface StudentImportPreview {
  students: ParsedStudentRow[]
  progress: ParsedProgressRow[]
  columnStatus: Record<string, 'recognized' | 'ignored' | 'unrecognized'>
  summary: {
    total: number
    success: number
    warning: number
    error: number
    progressTotal: number
    progressSuccess: number
  }
}

/**
 * 生成学员导入模板
 */
export function generateStudentImportTemplate(wordbanks: Wordbank[]): void {
  // Sheet1: 学员基本信息
  const studentHeaders = [
    '学号', '姓名', '学校', '年级', '账号', '入学日期', '学员类型', '状态', '程度等级',
    '入学测评分数', '入学词汇量', '自然拼读进度', '自然拼读完成', '国际音标完成', '备注',
    '购买课时', '已用课时'
  ]
  
  const studentExample = [
    'S001', '张三', '某某小学', '三年级', 'zhangsan', '2024-01-15', '正式学员', '在读', '较好',
    85, 500, '已完成1-10关', '否', '否', '备注信息',
    20, 5
  ]
  
  const studentSheetData = [
    studentHeaders,
    studentExample.map(v => ({ v, t: 's', s: { font: { color: { rgb: '808080' } } } })),
    // 空行供填写
  ]
  
  // 创建学员信息工作表
  const studentSheet = XLSX.utils.aoa_to_sheet([
    studentHeaders,
    studentExample
  ])
  
  // 设置列宽
  studentSheet['!cols'] = [
    { wch: 10 }, // 学号
    { wch: 10 }, // 姓名
    { wch: 15 }, // 学校
    { wch: 10 }, // 年级
    { wch: 12 }, // 账号
    { wch: 12 }, // 入学日期
    { wch: 10 }, // 学员类型
    { wch: 8 },  // 状态
    { wch: 10 }, // 程度等级
    { wch: 12 }, // 入学测评分数
    { wch: 12 }, // 入学词汇量
    { wch: 15 }, // 自然拼读进度
    { wch: 12 }, // 自然拼读完成
    { wch: 12 }, // 国际音标完成
    { wch: 20 }, // 备注
    { wch: 10 }, // 购买课时
    { wch: 10 }, // 已用课时
  ]
  
  // Sheet2: 词库进度
  const progressHeaders = ['姓名', '词库名称', '当前关数', '总关数', '状态']
  const progressExample = ['张三', '小学考纲', 15, 60, '进行中']
  
  const progressSheet = XLSX.utils.aoa_to_sheet([
    progressHeaders,
    progressExample
  ])
  
  progressSheet['!cols'] = [
    { wch: 10 }, // 姓名
    { wch: 15 }, // 词库名称
    { wch: 10 }, // 当前关数
    { wch: 10 }, // 总关数
    { wch: 10 }, // 状态
  ]
  
  // 创建工作簿
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, studentSheet, '学员基本信息')
  XLSX.utils.book_append_sheet(workbook, progressSheet, '词库进度')
  
  // 下载文件
  XLSX.writeFile(workbook, '学员导入模板.xlsx')
}

/**
 * 解析学员导入 Excel 文件
 */
export async function parseStudentImportFile(
  file: File,
  existingStudents: Array<{ id: string; name: string; grade: string | null }>,
  wordbanks: Wordbank[]
): Promise<StudentImportPreview> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        
        // 解析 Sheet1: 学员基本信息
        const studentSheetName = workbook.SheetNames.find(name => 
          name.includes('学员') || name === workbook.SheetNames[0]
        ) || workbook.SheetNames[0]
        
        const studentSheet = workbook.Sheets[studentSheetName]
        const studentRows = XLSX.utils.sheet_to_json(studentSheet, { defval: '' }) as Record<string, any>[]
        
        // 解析 Sheet2: 词库进度（如果存在）
        let progressRows: Record<string, any>[] = []
        const progressSheetName = workbook.SheetNames.find(name => name.includes('词库'))
        if (progressSheetName) {
          const progressSheet = workbook.Sheets[progressSheetName]
          progressRows = XLSX.utils.sheet_to_json(progressSheet, { defval: '' }) as Record<string, any>[]
        }
        
        // 解析学员数据
        const parsedStudents: ParsedStudentRow[] = []
        const columnStatus: Record<string, 'recognized' | 'ignored' | 'unrecognized'> = {}
        
        // 识别列
        if (studentRows.length > 0) {
          const headers = Object.keys(studentRows[0])
          headers.forEach(header => {
            columnStatus[header] = recognizeStudentColumn(header) ? 'recognized' : 'unrecognized'
          })
        }
        
        // 解析每一行学员数据
        studentRows.forEach((row, index) => {
          const result = parseStudentRow(row, index, existingStudents)
          parsedStudents.push(result)
        })
        
        // 解析词库进度数据
        const parsedProgress: ParsedProgressRow[] = []
        progressRows.forEach((row, index) => {
          const result = parseProgressRow(row, index, wordbanks, parsedStudents)
          parsedProgress.push(result)
        })
        
        // 统计摘要
        const summary = {
          total: parsedStudents.length,
          success: parsedStudents.filter(s => s.status === 'success').length,
          warning: parsedStudents.filter(s => s.status === 'warning').length,
          error: parsedStudents.filter(s => s.status === 'error').length,
          progressTotal: parsedProgress.length,
          progressSuccess: parsedProgress.filter(p => p.status === 'success' || p.status === 'warning').length,
        }
        
        resolve({
          students: parsedStudents,
          progress: parsedProgress,
          columnStatus,
          summary
        })
        
      } catch (error) {
        reject(new Error(`解析文件失败: ${error instanceof Error ? error.message : '未知错误'}`))
      }
    }
    
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsArrayBuffer(file)
  })
}

/**
 * 识别学员列名
 */
function recognizeStudentColumn(colName: string): boolean {
  const recognizedColumns = [
    '学号', '姓名', '学校', '年级', '账号', '入学日期', '学员类型', '状态', '程度等级',
    '入学测评分数', '入学词汇量', '自然拼读进度', '自然拼读完成', '国际音标完成', '备注',
    '购买课时', '已用课时'
  ]
  return recognizedColumns.some(col => colName.includes(col))
}

/**
 * 解析学员行数据
 */
function parseStudentRow(
  row: Record<string, any>,
  index: number,
  existingStudents: Array<{ id: string; name: string; grade: string | null }>
): ParsedStudentRow {
  const issues: string[] = []
  const data: Partial<StudentImportData> = {}
  
  // 提取基本字段
  data.student_no = extractValue(row, ['学号'])?.toString() || ''
  data.name = extractValue(row, ['姓名'])?.toString() || ''
  data.school = extractValue(row, ['学校'])?.toString() || ''
  data.grade = extractValue(row, ['年级'])?.toString() || ''
  data.account = extractValue(row, ['账号'])?.toString() || ''
  const enrollDateValue = extractValue(row, ['入学日期'])
  data.enroll_date = excelDateToString(enrollDateValue) || ''
  
  // 学员类型
  const studentTypeStr = extractValue(row, ['学员类型'])?.toString() || ''
  data.student_type = STUDENT_TYPE_MAPPING[studentTypeStr] || 'formal'
  
  // 状态
  const statusStr = extractValue(row, ['状态'])?.toString() || ''
  data.status = STATUS_MAPPING[statusStr] || 'active'
  
  // 程度等级
  const levelStr = extractValue(row, ['程度等级'])?.toString() || ''
  data.level = LEVEL_MAPPING[levelStr] || 'medium'
  
  // 数值字段
  const scoreValue = extractValue(row, ['入学测评分数', '测评分数'])
  data.initial_score = scoreValue ? Number(scoreValue) || null : null
  
  const vocabValue = extractValue(row, ['入学词汇量', '词汇量'])
  data.initial_vocab = vocabValue ? Number(vocabValue) || null : null
  
  // 文本字段
  data.phonics_progress = extractValue(row, ['自然拼读进度'])?.toString() || ''
  
  // 布尔字段
  const phonicsCompletedStr = extractValue(row, ['自然拼读完成'])?.toString() || ''
  data.phonics_completed = parseBoolean(phonicsCompletedStr)
  
  const ipaCompletedStr = extractValue(row, ['国际音标完成'])?.toString() || ''
  data.ipa_completed = parseBoolean(ipaCompletedStr)
  
  data.notes = extractValue(row, ['备注'])?.toString() || ''
  
  // 课时信息
  const totalHoursValue = extractValue(row, ['购买课时', '总课时'])
  data.total_hours = totalHoursValue ? Number(totalHoursValue) || 0 : 0
  
  const usedHoursValue = extractValue(row, ['已用课时', '已上课时'])
  data.used_hours = usedHoursValue ? Number(usedHoursValue) || 0 : 0
  
  // 验证必填字段
  if (!data.name) {
    issues.push('姓名为必填项')
  }
  if (!data.grade) {
    issues.push('年级为必填项')
  }
  
  // 检查年级是否有效
  if (data.grade && !GRADE_OPTIONS.includes(data.grade as GradeType)) {
    issues.push(`年级"${data.grade}"不在可选范围内`)
  }
  
  // 检查重复学员（同名同年级）
  let matchedStudentId: string | undefined
  if (data.name && data.grade) {
    const duplicate = existingStudents.find(s => 
      s.name === data.name && s.grade === data.grade
    )
    if (duplicate) {
      matchedStudentId = duplicate.id
      issues.push(`数据库中已存在同名同年级学员（ID: ${duplicate.id}）`)
    }
  }
  
  // 确定状态
  let status: 'success' | 'warning' | 'error' = 'success'
  if (!data.name || !data.grade) {
    status = 'error'
  } else if (issues.length > 0) {
    status = 'warning'
  }
  
  return {
    index,
    rawData: row,
    data,
    status,
    issues,
    matchedStudentId,
    duplicateAction: matchedStudentId ? 'skip' : undefined
  }
}

/**
 * 解析词库进度行数据
 */
function parseProgressRow(
  row: Record<string, any>,
  index: number,
  wordbanks: Wordbank[],
  parsedStudents: ParsedStudentRow[]
): ParsedProgressRow {
  const issues: string[] = []
  const data: Partial<ProgressImportData> = {}
  
  // 提取字段
  data.student_name = extractValue(row, ['姓名'])?.toString() || ''
  data.wordbank_name = extractValue(row, ['词库名称', '词库'])?.toString() || ''
  
  const currentLevelValue = extractValue(row, ['当前关数', '关数', '已学关数'])
  data.current_level = currentLevelValue ? Number(currentLevelValue) || 0 : 0
  
  const totalLevelsValue = extractValue(row, ['总关数', '总关卡'])
  data.total_levels = totalLevelsValue ? Number(totalLevelsValue) || null : null
  
  const statusStr = extractValue(row, ['状态'])?.toString() || ''
  data.status = parseProgressStatus(statusStr)
  
  // 查找关联的学员
  let studentIndex: number | undefined
  let wordbankMatched = false
  let wordbankId: string | undefined
  
  if (data.student_name) {
    studentIndex = parsedStudents.findIndex(s => s.data.name === data.student_name)
    if (studentIndex === -1) {
      issues.push(`未找到对应学员"${data.student_name}"`)
    }
  } else {
    issues.push('姓名为空')
  }
  
  // 模糊匹配词库
  if (data.wordbank_name) {
    const matchedWordbank = findWordbank(data.wordbank_name, wordbanks)
    if (matchedWordbank) {
      wordbankMatched = true
      wordbankId = matchedWordbank.id
    } else {
      issues.push(`未找到匹配的词库"${data.wordbank_name}"`)
    }
  } else {
    issues.push('词库名称为空')
  }
  
  // 确定状态
  let status: 'success' | 'warning' | 'error' = 'success'
  if (!data.student_name || !data.wordbank_name || studentIndex === -1) {
    status = 'error'
  } else if (!wordbankMatched || issues.length > 0) {
    status = 'warning'
  }
  
  return {
    index,
    rawData: row,
    data,
    studentIndex,
    status,
    issues,
    wordbankMatched,
    wordbankId
  }
}

/**
 * 从行数据中提取值
 */
function extractValue(row: Record<string, any>, possibleKeys: string[]): any {
  for (const key of possibleKeys) {
    // 精确匹配
    if (row[key] !== undefined && row[key] !== '') {
      return row[key]
    }
    // 模糊匹配
    for (const rowKey of Object.keys(row)) {
      if (rowKey.includes(key) && row[rowKey] !== undefined && row[rowKey] !== '') {
        return row[rowKey]
      }
    }
  }
  return undefined
}

/**
 * 将 Excel 日期序列号转换为日期字符串
 * Excel 日期是从 1900-01-01 开始的天数（但有 bug，把 1900 当作闰年）
 */
function excelDateToString(value: any): string | null {
  if (!value) return null
  
  // 如果已经是字符串格式，尝试解析
  if (typeof value === 'string') {
    // 检查是否是 YYYY/MM/DD 或 YYYY-MM-DD 格式
    const dateMatch = value.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)
    if (dateMatch) {
      const [, year, month, day] = dateMatch
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    }
    return value
  }
  
  // 如果是数字，当作 Excel 日期序列号处理
  if (typeof value === 'number') {
    // Excel 日期序列号：从 1899-12-30 开始（因为 Excel 有 1900 年闰年 bug）
    // 序列号 1 = 1900-01-01
    const excelEpoch = new Date(1899, 11, 30) // 1899-12-30
    const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000)
    
    if (isNaN(date.getTime())) return null
    
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    
    return `${year}-${month}-${day}`
  }
  
  return null
}

/**
 * 解析布尔值
 */
function parseBoolean(value: string): boolean {
  if (!value) return false
  const lower = value.toLowerCase()
  return lower === '是' || lower === 'true' || lower === '1' || lower === 'yes' || lower === '完成' || lower === '已完成'
}

/**
 * 解析进度状态
 */
function parseProgressStatus(value: string): 'active' | 'completed' | 'paused' {
  if (!value) return 'active'
  const lower = value.toLowerCase()
  if (lower.includes('完成') || lower.includes('结束') || lower === 'completed') {
    return 'completed'
  }
  if (lower.includes('暂停') || lower.includes('停') || lower === 'paused') {
    return 'paused'
  }
  return 'active'
}

/**
 * 模糊匹配词库
 */
function findWordbank(name: string, wordbanks: Wordbank[]): Wordbank | undefined {
  // 精确匹配
  const exact = wordbanks.find(w => w.name === name)
  if (exact) return exact
  
  // 包含匹配
  const contains = wordbanks.find(w => 
    w.name.includes(name) || name.includes(w.name)
  )
  if (contains) return contains
  
  // 模糊匹配（去掉年份等前缀）
  const cleanName = name.replace(/^\d{4}/, '').trim()
  return wordbanks.find(w => 
    w.name.includes(cleanName) || cleanName.includes(w.name)
  )
}

/**
 * 导入结果
 */
export interface ImportResult {
  success: boolean
  importedCount: number
  skippedCount: number
  progressCount: number
  errors: string[]
}

/**
 * 生成学员 ID
 */
function generateStudentId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}