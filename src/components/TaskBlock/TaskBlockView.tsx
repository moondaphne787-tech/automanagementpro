import { TASK_TYPE_LABELS } from '@/types'
import type { TaskBlock as TaskBlockType } from '@/types'
import { cn } from '@/lib/utils'
import { normalizeTask } from '@/utils/normalizeTask'

function getTypeColor(type: TaskBlockType['type']) {
  switch (type) {
    case 'vocab_new':
      return 'bg-blue-500/10 text-blue-600 border-blue-200'
    case 'vocab_review':
      return 'bg-green-500/10 text-green-600 border-green-200'
    case 'textbook':
      return 'bg-purple-500/10 text-purple-600 border-purple-200'
    case 'reading':
      return 'bg-cyan-500/10 text-cyan-600 border-cyan-200'
    case 'phonics':
      return 'bg-pink-500/10 text-pink-600 border-pink-200'
    case 'exercise':
      return 'bg-yellow-500/10 text-yellow-600 border-yellow-200'
    case 'picture_book':
      return 'bg-indigo-500/10 text-indigo-600 border-indigo-200'
    default:
      return 'bg-gray-500/10 text-gray-600 border-gray-200'
  }
}

interface TaskBlockViewProps {
  task: TaskBlockType
  className?: string
}

export function TaskBlockView({ task, className }: TaskBlockViewProps) {
  const normalized = normalizeTask(task)
  return (
    <div className={cn(
      "flex items-start gap-2 px-3 py-2 rounded-lg border",
      getTypeColor(task.type),
      className
    )}>
      <span className="text-xs font-medium whitespace-nowrap">{TASK_TYPE_LABELS[task.type]}</span>

      {normalized.content && (
        <>
          <span className="text-xs opacity-60">·</span>
          <span className="text-xs whitespace-pre-wrap">{normalized.content}</span>
        </>
      )}
    </div>
  )
}
