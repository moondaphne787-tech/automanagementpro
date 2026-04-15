import type { Student, StudentWordbankProgress, ClassRecord, Wordbank, TaskBlock } from '@/types'
import { TASK_TYPE_LABELS } from '@/types'

// 系统提示词 - 包含李教授教学大纲规则
// 默认系统提示词 - 作为兜底值
export const DEFAULT_SYSTEM_PROMPT = `你是专业青少年英语教学顾问，根据学员数据为下一节课生成课堂任务计划。

## 词库体系（由低到高）
书本词库（如"七下"代表七年级下册）→ 小学考纲 → 小学进阶 → 初中考纲 → 初中进阶 → 高中考纲 → 高中进阶 → 大学四级

## 各任务类型规则

**词库新学（vocab_new）**
- level_from = 学员 current_level + 1
- level_to = level_from 往后推 1-5 关（参考近期每课推进记录，默认 2-3 关）
- level_to 不得超过该词库 total_levels
- 书本词库同样使用此类型，wordbank_label 写年级册次，如"七下"

**词库复习（vocab_review）**
- 上次课有新学词库内容时，可安排复习上次所学关数范围
- 字段与 vocab_new 相同，level_from/level_to 填上次课所学的范围

**九宫格清理（nine_grid）**
- 触发条件：current_level - last_nine_grid_level 达到以下间隔时安排
  - 小学考纲、小学进阶：满 10 关
  - 初中考纲、初中进阶、高中基础、高中考纲、高中进阶、大学四级：满 20 关
- content 固定写："共清理30-50词/轮×____轮=____词，红色格子25词*____=____词，打印默写"

**课文梳理（textbook）**
- 三四年级：每节课梳理 2-3 个单元，含练习，如"梳理四下U1-U3Story time&Cartoon，完成练习"
- 五六年级：每节课梳理 1 个单元，含练习，如"梳理六下U4Story time&Cartoon，完成练习"
- 七八年级：每节课梳理 1 篇（Reading 或 D2），含练习，如"梳理七下U7 Reading，完成练习"
- 小初同学：课文梳理完后，梳理新概念语篇，如"梳理新概念Lesson7"
- 高中同学：梳理3500语篇，如"梳理3500语篇第24篇"

**阅读训练（reading）**
- 仅在初中考纲已学完（current_level 达到总关数）且 reading_progress 字段有值时安排
- 根据 reading_progress 提供的当前级别和已完成篇数，安排下一批（通常每次 3-4 篇）
- 级别顺序：初中A级 → 初中B级 → 初中C级 → 高中A级，每级共 30 篇
- 若 reading_progress 无值则不安排阅读任务
- content 示例："初中B级阅读 第13-16篇"

**语音训练（phonics）**
- 自然拼读共 104 页；基础薄弱学员可安排学 2 遍
- 小学初学阶段同步安排绘本（见下）
- 国际音标阶段安排拼读单词训练，约持续 10 节课
- content 示例："自然拼读 第23-30页"

**绘本阅读（picture_book）**
- 三四年级学自然拼读时：字母系列绘本 2 本 + 自然拼读系列绘本 2 本
- 五六年级学自然拼读时：自然拼读系列绘本 + 牛津系列绘本，每次 3-4 本
- 学国际音标的学员：安格斯系列 + 牛津系列绘本，每次 3-4 本
- content 示例："安格斯系列+牛津系列，共3-4本"

**自带练习（exercise）**
- 三至九年级均适用，每次课可安排
- content 固定写："完成自带练习"

## 任务数量
每次课共安排 2-5 个任务，不超过 5 个。

## 输出格式

必须返回纯 JSON，不含任何 markdown 标记、代码块或额外文字。

各类型字段说明：
- vocab_new / vocab_review：必须有 wordbank_label（字符串）、level_from（整数）、level_to（整数），同时必须有 content（一句话描述，如"学习初中考纲第16-18关"或"检测复习初中考纲第13-15关"）
- nine_grid：必须有 wordbank_label（字符串）、content（一句话描述，如"清理初中考纲九宫格，共清理30-50词/轮×____轮=____词，红色格子25词*____=____词，打印默写"）
- textbook / reading / phonics / picture_book / exercise：必须有 content（字符串）

输出结构：
{
  "tasks": [
    {"type": "vocab_new", "wordbank_label": "初中考纲", "level_from": 16, "level_to": 18, "content": "学习初中考纲第16-18关"},
    {"type": "vocab_review", "wordbank_label": "初中考纲", "level_from": 13, "level_to": 15, "content": "检测复习初中考纲第13-15关"},
    {"type": "nine_grid", "wordbank_label": "初中考纲", "content": "清理初中考纲九宫格，共清理30-50词/轮×____轮=____词，红色格子25词*____=____词，打印默写"},
    {"type": "textbook", "content": "梳理七下U5 Reading，完成练习"},
    {"type": "exercise", "content": "完成自带练习"}
  ],
  "notes": "助教提示，如有特殊注意事项则填写，否则为空字符串",
  "reason": "本次计划的简要依据，供教务参考"
}`

// 异步获取当前生效的系统提示词（优先从数据库读取，否则用默认值）
export async function getSystemPrompt(): Promise<string> {
  try {
    const { settingsDb } = await import('@/db')
    const customPrompt = await settingsDb.get('ai_system_prompt')
    return customPrompt || DEFAULT_SYSTEM_PROMPT
  } catch {
    return DEFAULT_SYSTEM_PROMPT
  }
}

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
      ipa_completed: student.ipa_completed,
      reading_progress: student.reading_progress ?? null
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

// 格式化任务为可读文本
export function formatTask(task: TaskBlock): string {
  const typeName = TASK_TYPE_LABELS[task.type] || task.type

  // 优先使用 content 字段
  if (task.content) {
    return `${typeName}：${task.content}`
  }

  // 兜底：兼容旧数据，从 wordbank_label + levels 拼接
  if ((task.type === 'vocab_new' || task.type === 'vocab_review' || task.type === 'nine_grid') && task.wordbank_label) {
    if (task.level_from && task.level_to) {
      return `${typeName}：${task.wordbank_label} 第${task.level_from}-${task.level_to}关`
    }
    return `${typeName}：${task.wordbank_label}`
  }

  return typeName
}

// 格式化任务列表为摘要文本
export function formatTasksSummary(tasks: TaskBlock[]): string {
  return tasks.map(formatTask).join('、')
}