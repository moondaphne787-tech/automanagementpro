import type { TaskBlock, TaskType } from '@/types'

// 词库关键词列表（与词库配置表同步）
const WORDBANK_KEYWORDS = [
  '初中考纲', '初中进阶', '小学考纲', '小学进阶', 
  '高中考纲', '高中进阶', '大学四级',
  '七上', '七下', '八上', '八下', 
  '六上', '六下', '五上', '五下',
  '四上', '四下', '三上', '三下',
  '中考考纲', '高考考纲', 'KET', 'PET'
]

// 任务类型关键词映射
const TASK_TYPE_PATTERNS: Array<{
  type: TaskType
  patterns: RegExp[]
  priority: number
}> = [
  {
    type: 'vocab_review',
    patterns: [
      /复习检测/i,
      /复习.*词库/i,
    ],
    priority: 1
  },
  {
    type: 'vocab_new',
    patterns: [
      /学习.*词库/i,
      /学习.*关/i,
      /新词/i,
    ],
    priority: 2
  },
  {
    type: 'nine_grid',
    patterns: [
      /九宫格/i,
      /清理/i,
    ],
    priority: 3
  },
  {
    type: 'textbook',
    patterns: [
      /梳理/i,
      /课文/i,
      /Reading/i,
      /挖空/i,
      /翻译/i,
      /语篇/i,
    ],
    priority: 4
  },
  {
    type: 'reading',
    patterns: [
      /阅读/i,
      /新概念/i,
    ],
    priority: 5
  },
  {
    type: 'phonics',
    patterns: [
      /自然拼读/i,
      /国际音标/i,
      /拼读/i,
    ],
    priority: 6
  },
  {
    type: 'exercise',
    patterns: [
      /练习/i,
      /试卷/i,
      /习题/i,
      /语法/i,
      /真题/i,
    ],
    priority: 7
  },
  {
    type: 'picture_book',
    patterns: [
      /绘本/i,
    ],
    priority: 8
  },
]

/**
 * 从任务描述中提取词库名称
 */
function extractWordbank(text: string): string | undefined {
  for (const keyword of WORDBANK_KEYWORDS) {
    if (text.includes(keyword)) {
      return keyword
    }
  }
  return undefined
}

/**
 * 从任务描述中提取关数范围
 */
function extractLevels(text: string): { level_from?: number; level_to?: number } {
  // 匹配范围：第7-8关 或 第7到第8关 等
  const rangeMatch = text.match(/第?\s*(\d+)\s*[-—~～至到]\s*第?\s*(\d+)\s*关/)
  if (rangeMatch) {
    return {
      level_from: parseInt(rangeMatch[1]),
      level_to: parseInt(rangeMatch[2])
    }
  }
  
  // 匹配单个关数：第7关
  const singleMatch = text.match(/第?\s*(\d+)\s*关/)
  if (singleMatch) {
    const level = parseInt(singleMatch[1])
    return {
      level_from: level,
      level_to: level
    }
  }
  
  return {}
}

/**
 * 判断任务类型
 */
function detectTaskType(text: string): TaskType {
  for (const { type, patterns } of TASK_TYPE_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return type
      }
    }
  }
  return 'other'
}

/**
 * 解析单个任务行
 */
function parseTaskLine(line: string): TaskBlock | null {
  const trimmedLine = line.trim()
  if (!trimmedLine) return null
  
  const type = detectTaskType(trimmedLine)
  const wordbank_label = extractWordbank(trimmedLine)
  const levels = extractLevels(trimmedLine)
  
  const task: TaskBlock = {
    type,
    content: trimmedLine
  }
  
  if (wordbank_label) {
    task.wordbank_label = wordbank_label
  }
  
  if (levels.level_from !== undefined) {
    task.level_from = levels.level_from
  }
  
  if (levels.level_to !== undefined) {
    task.level_to = levels.level_to
    task.level_reached = levels.level_to
  }
  
  return task
}

/**
 * 从学情反馈长文本中提取「学习内容」区块
 */
function extractLearningContent(text: string): string | null {
  // 匹配「学习内容」区块
  const match = text.match(/学习内容[：:]\s*\n([\s\S]*?)(?=\n共学习|\n生词|\n学习状态|\n注意|\n学习任务|$)/)
  if (match) {
    return match[1].trim()
  }
  return null
}

/**
 * 解析学情反馈长文本，提取任务块列表
 */
export function parseFeedback(feedback: string): TaskBlock[] {
  if (!feedback) return []
  
  const tasks: TaskBlock[] = []
  
  // 首先尝试提取「学习内容」区块
  const learningContent = extractLearningContent(feedback)
  
  if (learningContent) {
    // 按行分割，提取编号列表项
    const lines = learningContent.split('\n')
    
    for (const line of lines) {
      // 匹配编号列表：1. xxx 或 1、xxx 等
      const numberedMatch = line.match(/^\d+[.、．]\s*(.+)/)
      if (numberedMatch) {
        const task = parseTaskLine(numberedMatch[1])
        if (task) {
          tasks.push(task)
        }
      }
    }
  }
  
  // 如果没有从「学习内容」区块提取到任务，尝试从整个文本提取
  if (tasks.length === 0) {
    const lines = feedback.split('\n')
    
    for (const line of lines) {
      const numberedMatch = line.match(/^\d+[.、．]\s*(.+)/)
      if (numberedMatch) {
        const task = parseTaskLine(numberedMatch[1])
        if (task && task.type !== 'other') {
          tasks.push(task)
        }
      }
    }
  }
  
  return tasks
}

/**
 * 解析结果类型
 */
export interface ParsedFeedback {
  tasks: TaskBlock[]
  success: boolean
  hasUnrecognized: boolean
  rawContent: string
}

/**
 * 解析学情反馈并返回详细结果
 */
export function parseFeedbackDetailed(feedback: string): ParsedFeedback {
  const tasks = parseFeedback(feedback)
  const hasUnrecognized = tasks.some(t => t.type === 'other')
  
  return {
    tasks,
    success: tasks.length > 0,
    hasUnrecognized,
    rawContent: feedback
  }
}

/**
 * 批量解析学情反馈
 */
export function batchParseFeedback(feedbacks: string[]): ParsedFeedback[] {
  return feedbacks.map(feedback => parseFeedbackDetailed(feedback))
}

/**
 * 格式化任务块为显示文本
 */
export function formatTaskBlock(task: TaskBlock): string {
  if (task.wordbank_label && task.level_from && task.level_to) {
    const typeLabel = task.type === 'vocab_new' ? '学习' : 
                      task.type === 'vocab_review' ? '复习' : 
                      task.type === 'nine_grid' ? '清理九宫格' : ''
    return `${task.wordbank_label}第${task.level_from}-${task.level_to}关${typeLabel ? ' - ' + typeLabel : ''}`
  }
  
  return task.content || task.type
}