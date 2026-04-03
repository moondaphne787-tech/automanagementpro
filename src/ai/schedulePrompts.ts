import type { Student, Teacher, TeacherAvailability, StudentSchedulePreference, Billing, DayOfWeek } from '@/types'
import { DAY_LABELS } from '@/types'
import { getWeekStartFromDate, timeToMinutes } from '@/lib/utils'

// 排课日期类型描述
const SCHEDULE_TYPE_DESCRIPTIONS = {
  regular_weekend: '常规周末排课（周六/周日白天 8:00-18:00）',
  friday_evening: '周五晚上排课（18:00-21:00）',
  holiday: '假期排课（非周末白天时段）',
  custom: '自定义日期排课'
}

// AI排课系统提示词
export const AI_SCHEDULE_SYSTEM_PROMPT = `你是一位排课助手，为学员安排一对一课程。

排课时间说明：
- 常规周末：周六/周日白天 8:00-18:00
- 周五晚上：18:00-21:00（学期内正常排课）
- 假期排课：工作日白天（如周三、周五等放假时的白天时段）
- 特殊时段：如周六晚上 18:00-20:00 等特殊需求

约束条件：
1. 每位老师同一时段只能带一名学生（纯一对一）
2. 课程时长必须完整包含在老师可用时段内
3. 时段匹配和师生程度匹配同等重要，综合权衡
4. 优先安排时段完全匹配的组合
5. 考虑学生的程度等级与老师的适合程度
6. 注意区分不同日期类型的时间范围（白天/晚上）

输出必须是合法 JSON 数组，格式：
[{
  "student_id": "uuid",
  "teacher_id": "uuid",
  "date": "2026-03-21",
  "start_time": "09:00",
  "end_time": "11:00",
  "duration_hours": 2,
  "match_reason": "时段完全匹配，老师适合该程度"
}]

无法匹配时使用此格式：
{
  "student_id": "uuid",
  "unmatched": true,
  "reason": "无可用时段重叠"
}

注意：
- 只输出 JSON，不要输出任何其他文字
- 确保所有安排都符合一对一原则
- 如果某个学生无法匹配，单独列出原因`

// 排课日期配置类型
export interface ScheduleDateConfig {
  date: string
  type: 'regular_weekend' | 'friday_evening' | 'holiday' | 'custom'
  label: string  // 如 "周六"、"周五晚上"、"周三（假期）"
  timeRange?: { start: string; end: string }  // 可选的时间范围限制
}

// 构建AI排课的用户输入（支持多日期）
export function buildSchedulePromptInput(params: {
  students: Array<Student & { billing?: Billing | null; preferences: StudentSchedulePreference[] }>
  teachers: Array<Teacher & { availabilities: TeacherAvailability[] }>
  targetDates: ScheduleDateConfig[]  // 支持多个日期
  extraInstructions?: string
}): string {
  const { students, teachers, targetDates, extraInstructions } = params

  // 获取所有目标日期的周一（用于匹配特定周时段）
  const weekStarts = new Set<string>()
  targetDates.forEach(d => {
    weekStarts.add(getWeekStartFromDate(d.date))
  })

  // 构建学生数据
  const studentsData = students.map(s => {
    const prefs = s.preferences.map(p => ({
      day: DAY_LABELS[p.day_of_week],
      start: p.preferred_start,
      end: p.preferred_end
    }))
    
    return {
      id: s.id,
      name: s.name,
      grade: s.grade || '未知年级',
      level: s.level,
      remaining_hours: s.billing?.remaining_hours || 0,
      preferences: prefs
    }
  })

  // 构建老师数据
  const teachersData = teachers.map(t => {
    // 分离通用时段和特定周时段
    const generalAvailabilities: TeacherAvailability[] = []
    const weekSpecificAvailabilities: TeacherAvailability[] = []
    
    t.availabilities.forEach(a => {
      if (!a.week_start) {
        // 通用时段
        generalAvailabilities.push(a)
      } else if (weekStarts.has(a.week_start)) {
        // 当前目标周的特定时段
        weekSpecificAvailabilities.push(a)
      }
    })
    
    // 优先使用特定周时段，如果没有则使用通用时段
    const effectiveAvailabilities = weekSpecificAvailabilities.length > 0 
      ? weekSpecificAvailabilities 
      : generalAvailabilities
    
    const avail = effectiveAvailabilities.map(a => ({
      day: DAY_LABELS[a.day_of_week],
      start: a.start_time,
      end: a.end_time,
      is_week_specific: !!a.week_start
    }))
    
    return {
      id: t.id,
      name: t.name,
      training_stage: t.training_stage,
      oral_level: t.oral_level,
      suitable_grades: t.suitable_grades,
      suitable_levels: t.suitable_levels,
      availability: avail,
      has_week_specific: weekSpecificAvailabilities.length > 0
    }
  })

  // 构建目标日期信息
  const targetDatesInfo = targetDates.map(d => ({
    date: d.date,
    label: d.label,
    type: d.type,
    description: SCHEDULE_TYPE_DESCRIPTIONS[d.type],
    time_range: d.timeRange
  }))

  const prompt = {
    target_dates: targetDatesInfo,
    students: studentsData,
    teachers: teachersData,
    extra_instructions: extraInstructions || '无特殊要求'
  }

  return JSON.stringify(prompt, null, 2)
}

// 获取一周日期配置（周一到周日）
export function getWeekDateConfigs(date: Date = new Date()): ScheduleDateConfig[] {
  const configs: ScheduleDateConfig[] = []
  
  // 获取本周一
  const monday = new Date(date)
  const day = date.getDay()
  if (day === 0) {
    // 今天是周日，周一是前6天
    monday.setDate(date.getDate() - 6)
  } else if (day !== 1) {
    // 不是周一，找到本周一
    monday.setDate(date.getDate() - (day - 1))
  }
  
  // 生成周一到周日的配置
  const dayNames: (DayOfWeek)[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  const dayLabels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    
    const isWeekend = i >= 5 // 周六、周日
    
    configs.push({
      date: d.toISOString().split('T')[0],
      type: isWeekend ? 'regular_weekend' : 'custom',
      label: dayLabels[i],
      timeRange: { start: '08:00', end: '18:00' }
    })
  }
  
  return configs
}

// 获取含周五晚的周末日期配置（周五晚+周六+周日）
export function getWeekendWithFridayConfigs(date: Date = new Date()): ScheduleDateConfig[] {
  const configs: ScheduleDateConfig[] = []
  
  // 获取本周五
  const friday = new Date(date)
  const day = date.getDay()
  if (day === 0) {
    // 今天是周日，周五是前两天
    friday.setDate(date.getDate() - 2)
  } else if (day === 6) {
    // 今天是周六，周五是昨天
    friday.setDate(date.getDate() - 1)
  } else if (day !== 5) {
    // 不是周五，找到本周五
    friday.setDate(date.getDate() + (5 - day))
  }
  
  const saturday = new Date(friday)
  saturday.setDate(friday.getDate() + 1)
  
  const sunday = new Date(saturday)
  sunday.setDate(saturday.getDate() + 1)
  
  // 周五晚上
  configs.push({
    date: friday.toISOString().split('T')[0],
    type: 'friday_evening',
    label: '周五晚上',
    timeRange: { start: '18:00', end: '21:00' }
  })
  
  // 周六白天
  configs.push({
    date: saturday.toISOString().split('T')[0],
    type: 'regular_weekend',
    label: '周六',
    timeRange: { start: '08:00', end: '18:00' }
  })
  
  // 周日白天
  configs.push({
    date: sunday.toISOString().split('T')[0],
    type: 'regular_weekend',
    label: '周日',
    timeRange: { start: '08:00', end: '18:00' }
  })
  
  return configs
}


// AI排课响应类型
export interface AIScheduleResult {
  student_id: string
  teacher_id?: string
  date: string
  start_time: string
  end_time: string
  duration_hours: number
  match_reason?: string
  unmatched?: boolean
  reason?: string
}

// 解析AI排课响应
export function parseAIScheduleResponse(response: string): AIScheduleResult[] | null {
  try {
    // 清理响应
    let cleaned = response.trim()
    
    // 移除可能的思维标签
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '')
    cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    
    // 处理 markdown 代码块
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlockMatch) {
      cleaned = codeBlockMatch[1].trim()
    }
    
    // 查找 JSON 数组
    const firstBracket = cleaned.indexOf('[')
    const lastBracket = cleaned.lastIndexOf(']')
    
    if (firstBracket !== -1 && lastBracket !== -1 && firstBracket < lastBracket) {
      cleaned = cleaned.substring(firstBracket, lastBracket + 1)
    } else {
      // 可能是单个对象或者错误格式
      const firstBrace = cleaned.indexOf('{')
      const lastBrace = cleaned.lastIndexOf('}')
      if (firstBrace !== -1 && lastBrace !== -1) {
        // 单个对象，包装成数组
        cleaned = `[${cleaned.substring(firstBrace, lastBrace + 1)}]`
      }
    }
    
    const parsed = JSON.parse(cleaned)
    
    if (!Array.isArray(parsed)) {
      return [parsed]
    }
    
    return parsed
  } catch (error) {
    console.error('Failed to parse AI schedule response:', error)
    return null
  }
}

// 验证排课结果的冲突
export function validateScheduleResults(
  results: AIScheduleResult[]
): { valid: AIScheduleResult[]; conflicts: AIScheduleResult[] } {
  const valid: AIScheduleResult[] = []
  const conflicts: AIScheduleResult[] = []
  
  // 按老师+日期+时间分组
  const teacherSlots = new Map<string, AIScheduleResult[]>()
  
  for (const result of results) {
    if (result.unmatched || !result.teacher_id) {
      valid.push(result)
      continue
    }
    
    const key = `${result.teacher_id}_${result.date}`
    const existing = teacherSlots.get(key) || []
    
    // 检查时间重叠
    let hasConflict = false
    for (const existingResult of existing) {
      if (isTimeOverlap(
        existingResult.start_time,
        existingResult.end_time,
        result.start_time,
        result.end_time
      )) {
        hasConflict = true
        break
      }
    }
    
    if (hasConflict) {
      conflicts.push(result)
    } else {
      existing.push(result)
      teacherSlots.set(key, existing)
      valid.push(result)
    }
  }
  
  return { valid, conflicts }
}

// 检查时间是否重叠
function isTimeOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  const s1 = timeToMinutes(start1)
  const e1 = timeToMinutes(end1)
  const s2 = timeToMinutes(start2)
  const e2 = timeToMinutes(end2)
  
  return (s1 < e2 && s2 < e1)
}

