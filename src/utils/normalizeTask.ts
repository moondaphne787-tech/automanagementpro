import type { TaskBlock } from '@/types'

/**
 * 将可能存在遗留字段的 task 标准化为统一格式。
 * 旧数据格式：vocab_new/vocab_review 使用 wordbank_label + level_from/level_to 表示任务内容
 * 新数据格式：所有类型统一使用 content 字段
 * 此工具函数将旧格式转换为新格式，使消费者只需读取 task.content。
 */
export function normalizeTask(task: TaskBlock): TaskBlock {
  if (task.content) return task

  const { wordbank_label, level_from, level_to } = task

  if ((task.type === 'vocab_new' || task.type === 'vocab_review') && wordbank_label && level_from && level_to) {
    const prefix = task.type === 'vocab_new' ? '学习' : '检测复习'
    return { ...task, content: `${prefix}${wordbank_label}第${level_from}-${level_to}关` }
  }

  if (wordbank_label) {
    return { ...task, content: wordbank_label }
  }

  return task
}
