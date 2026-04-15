import { useRef } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { TaskBlock } from './TaskBlock'
import type { TaskBlock as TaskBlockType, Wordbank } from '@/types'

interface SortableTaskItemProps {
  id: string
  task: TaskBlockType
  index: number
  compact?: boolean
  wordbanks?: Wordbank[]
  onChange: (task: TaskBlockType) => void
  onDelete?: () => void
}

function SortableTaskItem({ id, task, index, compact, wordbanks, onChange, onDelete }: SortableTaskItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 10 : 'auto' as const,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <TaskBlock
        task={task}
        index={index}
        editable
        compact={compact}
        wordbanks={wordbanks}
        onChange={onChange}
        onDelete={onDelete}
        dragListeners={listeners}
      />
    </div>
  )
}

interface SortableTaskListProps {
  tasks: TaskBlockType[]
  compact?: boolean
  wordbanks?: Wordbank[]
  onTasksChange: (tasks: TaskBlockType[]) => void
  onUpdateTask: (index: number, task: TaskBlockType) => void
  onDeleteTask: (index: number) => void
}

let nextId = 0

export function SortableTaskList({
  tasks,
  compact,
  wordbanks,
  onTasksChange,
  onUpdateTask,
  onDeleteTask,
}: SortableTaskListProps) {
  // 用 ref 维护稳定的 id 映射，避免拖拽时 key 变化导致闪烁
  const idsRef = useRef<string[]>(tasks.map(() => `stask-${nextId++}`))

  // 确保 id 列表与 tasks 长度一致
  while (idsRef.current.length < tasks.length) {
    idsRef.current.push(`stask-${nextId++}`)
  }
  if (idsRef.current.length > tasks.length) {
    idsRef.current = idsRef.current.slice(0, tasks.length)
  }

  const ids = idsRef.current

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = ids.indexOf(active.id as string)
    const newIndex = ids.indexOf(over.id as string)

    if (oldIndex !== -1 && newIndex !== -1) {
      const newTasks = arrayMove(tasks, oldIndex, newIndex)
      idsRef.current = arrayMove(ids, oldIndex, newIndex)
      onTasksChange(newTasks)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className={compact ? "space-y-2" : "space-y-3"}>
          {tasks.map((task, idx) => (
            <SortableTaskItem
              key={ids[idx]}
              id={ids[idx]}
              task={task}
              index={idx}
              compact={compact}
              wordbanks={wordbanks}
              onChange={(updated) => onUpdateTask(idx, updated)}
              onDelete={tasks.length > 1 ? () => onDeleteTask(idx) : undefined}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
