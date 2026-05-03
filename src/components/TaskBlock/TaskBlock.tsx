import type { TaskBlock as TaskBlockType, Wordbank } from '@/types'
import { TaskBlockView } from './TaskBlockView'
import { TaskBlockEditor } from './TaskBlockEditor'

interface TaskBlockProps {
  task: TaskBlockType
  index: number
  editable?: boolean
  compact?: boolean
  onChange?: (task: TaskBlockType) => void
  onDelete?: () => void
  className?: string
  wordbanks?: Wordbank[]
  dragListeners?: Record<string, unknown>
}

export function TaskBlock({
  task,
  index,
  editable = false,
  compact = false,
  onChange,
  onDelete,
  className,
  wordbanks = [],
  dragListeners
}: TaskBlockProps) {
  if (editable) {
    return (
      <TaskBlockEditor
        task={task}
        index={index}
        compact={compact}
        onChange={onChange}
        onDelete={onDelete}
        className={className}
        wordbanks={wordbanks}
        dragListeners={dragListeners}
      />
    )
  }

  return <TaskBlockView task={task} className={className} />
}

export function createEmptyTask(): TaskBlockType {
  return {
    type: 'vocab_new',
    content: ''
  }
}
