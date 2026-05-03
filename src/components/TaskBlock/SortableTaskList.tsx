import { ChevronUp, ChevronDown } from 'lucide-react'
import { TaskBlock } from './TaskBlock'
import type { TaskBlock as TaskBlockType, Wordbank } from '@/types'

interface SortableTaskListProps {
  tasks: TaskBlockType[]
  compact?: boolean
  wordbanks?: Wordbank[]
  onTasksChange: (tasks: TaskBlockType[]) => void
  onUpdateTask: (index: number, task: TaskBlockType) => void
  onDeleteTask: (index: number) => void
}

export function SortableTaskList({
  tasks,
  compact,
  wordbanks,
  onTasksChange,
  onUpdateTask,
  onDeleteTask,
}: SortableTaskListProps) {
  const handleMoveUp = (index: number) => {
    if (index <= 0) return
    const newTasks = [...tasks]
    ;[newTasks[index - 1], newTasks[index]] = [newTasks[index], newTasks[index - 1]]
    onTasksChange(newTasks)
  }

  const handleMoveDown = (index: number) => {
    if (index >= tasks.length - 1) return
    const newTasks = [...tasks]
    ;[newTasks[index], newTasks[index + 1]] = [newTasks[index + 1], newTasks[index]]
    onTasksChange(newTasks)
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {tasks.map((task, idx) => (
        <div key={idx} className="flex items-start gap-1">
          <div className="flex flex-col gap-0.5 pt-1 shrink-0">
            <button
              onClick={() => handleMoveUp(idx)}
              disabled={idx === 0}
              className="p-0.5 rounded hover:bg-muted disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronUp className="w-3 h-3" />
            </button>
            <button
              onClick={() => handleMoveDown(idx)}
              disabled={idx === tasks.length - 1}
              className="p-0.5 rounded hover:bg-muted disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <TaskBlock
              task={task}
              index={idx}
              editable
              compact={compact}
              wordbanks={wordbanks}
              onChange={(updated) => onUpdateTask(idx, updated)}
              onDelete={tasks.length > 1 ? () => onDeleteTask(idx) : undefined}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
