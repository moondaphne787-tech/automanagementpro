import type { TaskBlock } from '@/types'
import { TASK_TYPE_LABELS } from '@/types'

export function formatTask(task: TaskBlock): string {
  const typeName = TASK_TYPE_LABELS[task.type] || task.type

  // 优先使用 content 字段
  if (task.content) {
    return `${typeName}：${task.content}`
  }

  // 兜底：兼容旧数据，从 wordbank_label + levels 拼接
  if ((task.type === 'vocab_new' || task.type === 'vocab_review') && task.wordbank_label) {
    if (task.level_from && task.level_to) {
      return `${typeName}：${task.wordbank_label} 第${task.level_from}-${task.level_to}关`
    }
    return `${typeName}：${task.wordbank_label}`
  }

  return typeName
}

export function formatTasksSummary(tasks: TaskBlock[]): string {
  return tasks.map(formatTask).join('、')
}
