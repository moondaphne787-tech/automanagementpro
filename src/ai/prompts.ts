import type { Student, StudentWordbankProgress, ClassRecord, Wordbank, TaskBlock } from '@/types'

// 系统提示词 - 包含李教授教学大纲规则
export const SYSTEM_PROMPT = `你是一位专业的青少年英语教学顾问，熟悉以下词库体系：
书本课文单词 → 小学考纲 → 小学进阶 → 初中考纲 → 初中进阶 → 高中考纲 → 高中进阶 → 大学四级

教学规则：
- 每次课安排2-4个任务，不超过4个
- 小学考纲/小学进阶：每学习10关安排一次九宫格清理
- 初中考纲/初中进阶：每学习20关安排一次九宫格清理
- 词汇量达到约1600词（初中考纲学完）后可加入阅读训练
- 语音训练阶段：自然拼读共104页，之后学国际音标，再拼读单词训练约10节课

请根据学员数据生成下一次课程计划。
输出格式必须是合法 JSON，结构如下：
{
  "tasks": [
    {"type": "vocab_new", "wordbank_label": "词库名", "level_from": X, "level_to": Y},
    {"type": "textbook", "content": "具体内容描述"},
    ...
  ],
  "notes": "助教提示（简短）",
  "reason": "本次计划的简要说明（给教务参考）"
}

type 可选值：phonics / vocab_new / vocab_review / nine_grid / textbook / reading / picture_book / exercise

重要规则：
1. 必须返回纯 JSON 格式，不要包含任何其他文字或 markdown 标记
2. 不要使用代码块包裹
3. 确保所有字段名称使用双引号
4. 确保数字类型的值不加引号`

// 构建学员数据的用户输入
export function buildUserInput(params: {
  student: Student
  wordbankProgress: StudentWordbankProgress[]
  wordbanks: Wordbank[]
  recentRecords: ClassRecord[]
  lastPlanSummary: string | null
  extraInstruction?: string
}): string {
  const { student, wordbankProgress, wordbanks, recentRecords, lastPlanSummary, extraInstruction } = params

  // 构建词库进度数据
  const wordbankData = wordbankProgress.map(progress => {
    const wordbank = wordbanks.find(w => w.id === progress.wordbank_id)
    return {
      name: progress.wordbank_label,
      current_level: progress.current_level,
      total_levels: progress.total_levels_override || wordbank?.total_levels || 60,
      last_nine_grid_level: progress.last_nine_grid_level,
      nine_grid_interval: wordbank?.nine_grid_interval || 10,
      status: progress.status
    }
  })

  // 构建最近课堂记录摘要
  const recentRecordsSummary = recentRecords.slice(0, 3).map(record => ({
    date: record.class_date,
    tasks: record.tasks.map(t => ({
      type: t.type,
      wordbank_label: t.wordbank_label,
      level_from: t.level_from,
      level_to: t.level_to
    })),
    issues: record.issues
  }))

  // 构建语音进度描述
  let phonicsProgressDesc = '未开始'
  if (student.phonics_completed) {
    phonicsProgressDesc = '已完成'
  } else if (student.phonics_progress) {
    phonicsProgressDesc = student.phonics_progress
  }

  const studentData = {
    student: {
      name: student.name,
      grade: student.grade,
      level: student.level,
      phonics_progress: phonicsProgressDesc,
      phonics_completed: student.phonics_completed,
      ipa_completed: student.ipa_completed
    },
    wordbank_progress: wordbankData,
    recent_records: recentRecordsSummary,
    last_plan_summary: lastPlanSummary,
    extra_instruction: extraInstruction
  }

  return JSON.stringify(studentData, null, 2)
}

// 解析 AI 返回的 JSON
export function parseAIResponse(response: string): {
  tasks: TaskBlock[]
  notes: string
  reason: string
} | null {
  try {
    // 基本验证
    if (!response || typeof response !== 'string') {
      console.error('[parseAIResponse] 响应为空或类型错误')
      return null
    }

    // 清理响应内容
    let cleaned = response.trim()
    
    // 移除 DeepSeek 思考过程标签 <think>...</think>
    // 注意：正则中 <think> 需要转义
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '')
    
    // 移除可能的 <thinking>...</thinking> 标签
    cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    
    cleaned = cleaned.trim()

    // 处理 markdown 代码块标记
    // 匹配 ```json ... ``` 或 ``` ... ``` 格式
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlockMatch) {
      cleaned = codeBlockMatch[1].trim()
    }

    // 如果响应中包含 JSON 对象，尝试提取
    // 查找第一个 { 和最后一个 } 之间的内容
    const firstBrace = cleaned.indexOf('{')
    const lastBrace = cleaned.lastIndexOf('}')
    
    if (firstBrace === -1 || lastBrace === -1 || firstBrace > lastBrace) {
      console.error('[parseAIResponse] 未找到有效的 JSON 对象，原始响应:', response.substring(0, 500))
      return null
    }
    
    cleaned = cleaned.substring(firstBrace, lastBrace + 1)

    // 尝试解析 JSON
    let parsed
    try {
      parsed = JSON.parse(cleaned)
    } catch (parseError) {
      console.error('[parseAIResponse] JSON 解析失败:', parseError)
      console.error('[parseAIResponse] 尝试解析的内容:', cleaned.substring(0, 500))
      
      // 尝试修复常见的 JSON 格式问题
      // 1. 移除注释
      let fixed = cleaned.replace(/\/\/[^\n]*/g, '')
      // 2. 修复尾随逗号
      fixed = fixed.replace(/,(\s*[}\]])/g, '$1')
      // 3. 尝试重新解析
      try {
        parsed = JSON.parse(fixed)
      } catch (e) {
        console.error('[parseAIResponse] 修复后仍然解析失败:', e)
        return null
      }
    }
    
    // 验证必需字段
    if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
      console.error('[parseAIResponse] 缺少 tasks 字段或格式错误:', parsed)
      return null
    }

    // 验证并规范化 tasks 数组
    const validTasks: TaskBlock[] = []
    for (const task of parsed.tasks) {
      if (task && typeof task === 'object' && task.type) {
        validTasks.push(task as TaskBlock)
      }
    }

    if (validTasks.length === 0) {
      console.error('[parseAIResponse] 没有有效的任务项')
      return null
    }

    return {
      tasks: validTasks,
      notes: parsed.notes || '',
      reason: parsed.reason || ''
    }
  } catch (error) {
    console.error('[parseAIResponse] 解析过程发生异常:', error)
    return null
  }
}

// 任务类型的中文名称映射
export const TASK_TYPE_NAMES: Record<string, string> = {
  phonics: '语音训练',
  vocab_new: '词库学习',
  vocab_review: '词库复习',
  nine_grid: '九宫格清理',
  textbook: '课文梳理',
  reading: '阅读训练',
  picture_book: '绘本阅读',
  exercise: '专项练习',
  other: '其他'
}

// 格式化任务为可读文本
export function formatTask(task: TaskBlock): string {
  const typeName = TASK_TYPE_NAMES[task.type] || task.type
  
  if ((task.type === 'vocab_new' || task.type === 'vocab_review') && task.wordbank_label) {
    if (task.level_from && task.level_to) {
      return `${typeName}：${task.wordbank_label} 第${task.level_from}-${task.level_to}关`
    }
    return `${typeName}：${task.wordbank_label}`
  }
  
  if (task.type === 'nine_grid' && task.wordbank_label) {
    return `${typeName}：${task.wordbank_label}`
  }
  
  if (task.content) {
    return `${typeName}：${task.content}`
  }
  
  return typeName
}

// 格式化任务列表为摘要文本
export function formatTasksSummary(tasks: TaskBlock[]): string {
  return tasks.map(formatTask).join('、')
}