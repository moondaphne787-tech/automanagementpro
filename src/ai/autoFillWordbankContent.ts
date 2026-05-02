import type { TaskBlock, ClassRecord, StudentWordbankProgress } from '@/types'

/** 根据上次课堂记录和词库进度，自动填充 AI 生成任务的词库相关内容 */
export function autoFillWordbankContent(
  tasks: TaskBlock[],
  lastRecord: ClassRecord | null,
  wordbankProgress: StudentWordbankProgress[]
): TaskBlock[] {
  let filled = tasks
  if (lastRecord) {
    const lastVocabNew = lastRecord.tasks.find(t => t.type === 'vocab_new')
    if (lastVocabNew) {
      const lastLabel = lastVocabNew.wordbank_label
      const lastFrom = lastVocabNew.level_from
      const lastTo = lastVocabNew.level_to
      if (lastLabel && lastFrom && lastTo) {
        const span = lastTo - lastFrom + 1
        const progressItem = wordbankProgress.find(p => p.wordbank_label === lastLabel)
        const totalLevels = progressItem?.total_levels_override || 60

        filled = filled.map(task => {
          if (task.type === 'vocab_review' && !task.content) {
            return {
              ...task,
              content: `检测复习${lastLabel}第${lastFrom}-${lastTo}关`,
              wordbank_label: task.wordbank_label || lastLabel,
              level_from: task.level_from || lastFrom,
              level_to: task.level_to || lastTo
            }
          }
          if (task.type === 'vocab_new' && !task.content) {
            const nextFrom = lastTo + 1
            const nextTo = Math.min(lastTo + span, totalLevels)
            if (nextFrom <= totalLevels) {
              return {
                ...task,
                content: `学习${lastLabel}第${nextFrom}-${nextTo}关`,
                wordbank_label: task.wordbank_label || lastLabel,
                level_from: task.level_from || nextFrom,
                level_to: task.level_to || nextTo
              }
            }
          }
          return task
        })
      }
    }
  }

  return filled.map(task => {
    if (task.content) return task
    if (task.type === 'vocab_new' && task.wordbank_label && task.level_from && task.level_to) {
      return { ...task, content: `学习${task.wordbank_label}第${task.level_from}-${task.level_to}关` }
    }
    if (task.type === 'vocab_review' && task.wordbank_label && task.level_from && task.level_to) {
      return { ...task, content: `检测复习${task.wordbank_label}第${task.level_from}-${task.level_to}关` }
    }
    return task
  })
}
