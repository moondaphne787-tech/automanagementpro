import * as XLSX from 'xlsx'
import { studentDb, classRecordDb, lessonPlanDb, teacherDb, examScoreDb, learningPhaseDb, progressDb, wordbankDb, billingDb } from '@/db'
import { parseTasks } from '@/db/utils'
import type { TaskBlock } from '@/types'

/**
 * 导出数据到 Excel 文件
 * 将主要数据表导出为多 Sheet 的 Excel 文件
 */
export async function exportToExcel(): Promise<void> {
  try {
    // 创建工作簿
    const workbook = XLSX.utils.book_new()
    
    // 1. 导出学员信息
    await exportStudents(workbook)
    
    // 2. 导出课堂记录
    await exportClassRecords(workbook)
    
    // 3. 导出课程计划
    await exportLessonPlans(workbook)
    
    // 4. 导出助教信息
    await exportTeachers(workbook)
    
    // 5. 导出考试成绩
    await exportExamScores(workbook)
    
    // 6. 导出学习阶段
    await exportLearningPhases(workbook)
    
    // 7. 导出词库进度
    await exportProgress(workbook)
    
    // 8. 导出词库配置
    await exportWordbanks(workbook)
    
    // 生成文件名（带时间戳）
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const filename = `EduManager_导出数据_${timestamp}.xlsx`
    
    // 在 Electron 环境中使用系统对话框保存
    if (window.electronAPI) {
      const result = await window.electronAPI.showSaveDialog({
        title: '保存导出数据',
        defaultPath: filename,
        filters: [{ name: 'Excel 文件', extensions: ['xlsx'] }]
      })
      
      if (!result || result.canceled || !result.filePath) {
        return // 用户取消
      }
      
      // 写入文件
      const xlsxData = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([xlsxData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      
      // 在 Electron 中，我们需要通过 IPC 保存文件
      // 由于没有直接的 API，我们使用下载方式
      downloadBlob(blob, result.filePath)
      alert(`导出成功！\n文件已保存到：${result.filePath}`)
    } else {
      // 浏览器环境，使用下载
      const xlsxData = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([xlsxData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      downloadBlob(blob, filename)
      alert('导出成功！')
    }
  } catch (error) {
    console.error('导出失败：', error)
    throw error
  }
}

/**
 * 下载 Blob 文件
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * 导出学员信息
 */
async function exportStudents(workbook: XLSX.WorkBook): Promise<void> {
  const students = await studentDb.getAllWithBilling(
    { status: 'all', student_type: 'all', level: 'all', grade: 'all', search: '', day_of_week: 'all' },
    { field: 'student_no', direction: 'asc' }
  )
  
  const data = students.map(s => ({
    '学员编号': s.student_no || '',
    '姓名': s.name,
    '学校': s.school || '',
    '年级': s.grade || '',
    '账号': s.account || '',
    '入学日期': s.enroll_date || '',
    '学员类型': s.student_type === 'formal' ? '正式学员' : '体验生',
    '状态': s.status === 'active' ? '在读' : s.status === 'paused' ? '暂停' : '结课',
    '程度等级': s.level === 'weak' ? '基础薄弱' : s.level === 'medium' ? '基础较好' : '非常优秀',
    '初始分数': s.initial_score || '',
    '初始词汇量': s.initial_vocab || '',
    '自然拼读进度': s.phonics_progress || '',
    '自然拼读完成': s.phonics_completed ? '是' : '否',
    '国际音标完成': s.ipa_completed ? '是' : '否',
    '总课时': s.billing?.total_hours || 0,
    '已用课时': s.billing?.used_hours || 0,
    '剩余课时': s.billing?.remaining_hours || 0,
    '课时预警阈值': s.billing?.warning_threshold || 3,
    '最近缴费日期': s.billing?.last_payment_date || '',
    '备注': s.notes || '',
    '创建时间': s.created_at,
    '更新时间': s.updated_at
  }))
  
  const worksheet = XLSX.utils.json_to_sheet(data)
  setColumnWidths(worksheet, data)
  XLSX.utils.book_append_sheet(workbook, worksheet, '学员信息')
}

/**
 * 导出课堂记录
 */
async function exportClassRecords(workbook: XLSX.WorkBook): Promise<void> {
  // 获取所有课堂记录
  const allRecords = await getAllClassRecords()
  
  const data = allRecords.map(r => {
    const tasks = parseTasks(r.tasks)
    
    return {
      '学员ID': r.student_id,
      '上课日期': r.class_date,
      '课时时长(小时)': r.duration_hours,
      '助教': r.teacher_name || '',
      '出勤状态': r.attendance === 'present' ? '到课' : r.attendance === 'absent' ? '缺课' : '迟到',
      '任务详情': formatTasks(tasks),
      '任务完成状态': r.task_completed === 'completed' ? '完成' : r.task_completed === 'partial' ? '部分完成' : '未完成',
      '未完成原因': r.incomplete_reason || '',
      '课堂表现': r.performance === 'excellent' ? '优秀' : r.performance === 'good' ? '良好' : '需改进',
      '学情反馈': r.detail_feedback || '',
      '亮点': r.highlights || '',
      '问题': r.issues || '',
      '是否打卡': r.checkin_completed ? '是' : '否',
      '创建时间': r.created_at
    }
  })
  
  const worksheet = XLSX.utils.json_to_sheet(data)
  setColumnWidths(worksheet, data)
  XLSX.utils.book_append_sheet(workbook, worksheet, '课堂记录')
}

/**
 * 导出课程计划
 */
async function exportLessonPlans(workbook: XLSX.WorkBook): Promise<void> {
  const allPlans = await getAllLessonPlans()
  
  const data = allPlans.map(p => {
    const tasks = parseTasks(p.tasks)
    
    return {
      '学员ID': p.student_id,
      '计划日期': p.plan_date || '',
      '任务详情': formatTasks(tasks),
      '备注': p.notes || '',
      'AI生成': p.generated_by_ai ? '是' : '否',
      '创建时间': p.created_at
    }
  })
  
  const worksheet = XLSX.utils.json_to_sheet(data)
  setColumnWidths(worksheet, data)
  XLSX.utils.book_append_sheet(workbook, worksheet, '课程计划')
}

/**
 * 导出助教信息
 */
async function exportTeachers(workbook: XLSX.WorkBook): Promise<void> {
  const teachers = await teacherDb.getAll()
  
  const data = teachers.map(t => ({
    '姓名': t.name,
    '电话': t.phone || '',
    '学校': t.university || '',
    '专业': t.major || '',
    '入职日期': t.enroll_date || '',
    '状态': t.status === 'active' ? '在职' : '离职',
    '词汇水平': t.vocab_level || '',
    '口语水平': t.oral_level === 'basic' ? '基础' : t.oral_level === 'intermediate' ? '中级' : '高级',
    '教学风格': t.teaching_style || '',
    '适合年级': t.suitable_grades || '',
    '适合程度': (t.suitable_levels || []).join(', '),
    '培训阶段': t.training_stage === 'probation' ? '实训期' : t.training_stage === 'intern' ? '实习期' : '正式助教',
    '助教类型': (t.teacher_types || []).map(type => type === 'regular' ? '平时助教' : '寒暑假助教').join(', '),
    '总授课时长': t.total_teaching_hours,
    '备注': t.notes || '',
    '创建时间': t.created_at
  }))
  
  const worksheet = XLSX.utils.json_to_sheet(data)
  setColumnWidths(worksheet, data)
  XLSX.utils.book_append_sheet(workbook, worksheet, '助教信息')
}

/**
 * 导出考试成绩
 */
async function exportExamScores(workbook: XLSX.WorkBook): Promise<void> {
  const allScores = await getAllExamScores()
  
  const data = allScores.map(e => ({
    '学员ID': e.student_id,
    '考试日期': e.exam_date,
    '考试名称': e.exam_name || '',
    '考试类型': e.exam_type === 'school_exam' ? '学校考试' : e.exam_type === 'placement' ? '分班考试' : '模拟考试',
    '得分': e.score || '',
    '满分': e.full_score,
    '备注': e.notes || ''
  }))
  
  const worksheet = XLSX.utils.json_to_sheet(data)
  setColumnWidths(worksheet, data)
  XLSX.utils.book_append_sheet(workbook, worksheet, '考试成绩')
}

/**
 * 导出学习阶段
 */
async function exportLearningPhases(workbook: XLSX.WorkBook): Promise<void> {
  const allPhases = await getAllLearningPhases()
  
  const data = allPhases.map(p => ({
    '学员ID': p.student_id,
    '阶段名称': p.phase_name || '',
    '阶段类型': p.phase_type === 'semester' ? '学期' : p.phase_type === 'summer' ? '暑假' : '寒假',
    '开始日期': p.start_date || '',
    '结束日期': p.end_date || '',
    '目标': p.goal || '',
    '起始词汇量': p.vocab_start || '',
    '结束词汇量': p.vocab_end || '',
    '总结': p.summary || '',
    '创建时间': p.created_at
  }))
  
  const worksheet = XLSX.utils.json_to_sheet(data)
  setColumnWidths(worksheet, data)
  XLSX.utils.book_append_sheet(workbook, worksheet, '学习阶段')
}

/**
 * 导出词库进度
 */
async function exportProgress(workbook: XLSX.WorkBook): Promise<void> {
  const allProgress = await getAllProgress()
  
  const data = allProgress.map(p => ({
    '学员ID': p.student_id,
    '词库ID': p.wordbank_id,
    '词库名称': p.wordbank_label,
    '当前关卡': p.current_level,
    '自定义总关卡': p.total_levels_override || '',
    '上次九宫格关卡': p.last_nine_grid_level,
    '状态': p.status === 'active' ? '进行中' : p.status === 'completed' ? '已完成' : '暂停',
    '开始日期': p.started_date || '',
    '完成日期': p.completed_date || '',
    '来源': p.source === 'manual' ? '手动' : p.source === 'imported' ? '导入' : '同步',
    '备注': p.notes || ''
  }))
  
  const worksheet = XLSX.utils.json_to_sheet(data)
  setColumnWidths(worksheet, data)
  XLSX.utils.book_append_sheet(workbook, worksheet, '词库进度')
}

/**
 * 导出词库配置
 */
async function exportWordbanks(workbook: XLSX.WorkBook): Promise<void> {
  const wordbanks = await wordbankDb.getAll()
  
  const data = wordbanks.map(w => ({
    '词库名称': w.name,
    '总关卡数': w.total_levels,
    '九宫格间隔': w.nine_grid_interval,
    '分类': getCategoryLabel(w.category),
    '排序': w.sort_order,
    '备注': w.notes || ''
  }))
  
  const worksheet = XLSX.utils.json_to_sheet(data)
  setColumnWidths(worksheet, data)
  XLSX.utils.book_append_sheet(workbook, worksheet, '词库配置')
}

/**
 * 获取分类标签
 */
function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    'textbook': '教材词库',
    'primary_exam': '小学考纲',
    'primary_advanced': '小学提高',
    'junior_exam': '初中考纲',
    'junior_advanced': '初中提高',
    'senior_exam': '高中考纲',
    'senior_advanced': '高中提高',
    'college_cet4': '大学四级'
  }
  return labels[category] || category
}

/**
 * 格式化任务列表
 */
function formatTasks(tasks: TaskBlock[]): string {
  if (!tasks || tasks.length === 0) return ''
  
  return tasks.map((task, index) => {
    const typeLabels: Record<string, string> = {
      'phonics': '语音训练',
      'vocab_new': '词库学习（新词）',
      'vocab_review': '词库复习',
      'nine_grid': '九宫格清理',
      'textbook': '课文梳理',
      'reading': '阅读训练',
      'picture_book': '绘本阅读',
      'exercise': '专项练习',
      'other': '其他'
    }
    
    let content = `${index + 1}. ${typeLabels[task.type] || task.type}`
    
    if (['vocab_new', 'vocab_review', 'nine_grid'].includes(task.type)) {
      if (task.wordbank_label) {
        content += ` - ${task.wordbank_label}`
      }
      if (task.level_from && task.level_to) {
        content += ` 第${task.level_from}-${task.level_to}关`
      }
    } else if (task.content) {
      content += ` - ${task.content}`
    }
    
    return content
  }).join('\n')
}

/**
 * 设置列宽
 */
function setColumnWidths(worksheet: XLSX.WorkSheet, data: Record<string, unknown>[]): void {
  if (data.length === 0) return
  
  const columns = Object.keys(data[0])
  const colWidths = columns.map(col => {
    // 计算列宽：取标题长度和内容最大长度的较大值
    let maxWidth = col.length
    
    for (const row of data) {
      const value = String(row[col] || '')
      // 考虑换行符，取最长的一行
      const lines = value.split('\n')
      const maxLineLength = Math.max(...lines.map(line => line.length))
      maxWidth = Math.max(maxWidth, maxLineLength)
    }
    
    // 限制最大宽度，并转换为字符宽度
    return { wch: Math.min(maxWidth + 2, 50) }
  })
  
  worksheet['!cols'] = colWidths
}

/**
 * 获取所有课堂记录
 */
async function getAllClassRecords(): Promise<any[]> {
  const sql = `SELECT * FROM class_records ORDER BY class_date DESC`
  const { ipcQuery } = await import('@/db/utils')
  const records = await ipcQuery<any[]>(sql, [])
  
  return records.map(r => ({
    ...r,
    tasks: typeof r.tasks === 'string' ? r.tasks : JSON.stringify(r.tasks || []),
    checkin_completed: !!r.checkin_completed
  }))
}

/**
 * 获取所有课程计划
 */
async function getAllLessonPlans(): Promise<any[]> {
  const sql = `SELECT * FROM lesson_plans ORDER BY plan_date DESC`
  const { ipcQuery } = await import('@/db/utils')
  return ipcQuery<any[]>(sql, [])
}

/**
 * 获取所有考试成绩
 */
async function getAllExamScores(): Promise<any[]> {
  const sql = `SELECT * FROM exam_scores ORDER BY exam_date DESC`
  const { ipcQuery } = await import('@/db/utils')
  return ipcQuery<any[]>(sql, [])
}

/**
 * 获取所有学习阶段
 */
async function getAllLearningPhases(): Promise<any[]> {
  const sql = `SELECT * FROM learning_phases ORDER BY created_at DESC`
  const { ipcQuery } = await import('@/db/utils')
  return ipcQuery<any[]>(sql, [])
}

/**
 * 获取所有词库进度
 */
async function getAllProgress(): Promise<any[]> {
  const sql = `SELECT * FROM student_wordbank_progress`
  const { ipcQuery } = await import('@/db/utils')
  return ipcQuery<any[]>(sql, [])
}