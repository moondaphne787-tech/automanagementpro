import { useState } from 'react'
import { Plus, Check, Trash2, User, Calendar } from 'lucide-react'
import { todoDb, Todo } from '../../db/todos'
import { AddTodoModal } from './AddTodoModal'
import { useNavigate } from 'react-router-dom'

interface TodoPanelProps {
  todos: Todo[]
  loading: boolean
  onRefresh: () => void
}

export function TodoPanel({ todos, loading, onRefresh }: TodoPanelProps) {
  const [showAddModal, setShowAddModal] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const navigate = useNavigate()

  const activeTodos = todos.filter(t => !t.completed)
  const completedTodos = todos.filter(t => t.completed)

  const handleToggle = async (todo: Todo) => {
    await todoDb.toggleComplete(todo.id, !todo.completed)
    onRefresh()
  }

  const handleDelete = async (id: string) => {
    await todoDb.delete(id)
    onRefresh()
  }

  const isOverdue = (todo: Todo) =>
    todo.due_date && todo.due_date < new Date().toISOString().split('T')[0]

  return (
    <div className="rounded-xl border border-border bg-card flex flex-col min-h-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">待办清单</h3>
          {activeTodos.length > 0 && (
            <span className="text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 font-medium">
              {activeTodos.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          新增
        </button>
      </div>

      <div className="flex-1 overflow-y-auto max-h-64">
        {loading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-8 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : activeTodos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Check className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-xs">暂无待办，状态良好</p>
          </div>
        ) : (
          <ul className="p-2 space-y-1">
            {activeTodos.map(todo => (
              <TodoItemRow
                key={todo.id}
                todo={todo}
                isOverdue={!!isOverdue(todo)}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onNavigate={navigate}
              />
            ))}
          </ul>
        )}
      </div>

      {completedTodos.length > 0 && (
        <div className="border-t border-border">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="w-full px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors text-left"
          >
            {showCompleted ? '▾' : '▸'} 已完成 ({completedTodos.length})
          </button>
          {showCompleted && (
            <ul className="px-2 pb-2 space-y-1">
              {completedTodos.map(todo => (
                <TodoItemRow
                  key={todo.id}
                  todo={todo}
                  isOverdue={false}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  onNavigate={navigate}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      {showAddModal && (
        <AddTodoModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => { setShowAddModal(false); onRefresh() }}
        />
      )}
    </div>
  )
}

function TodoItemRow({
  todo, isOverdue, onToggle, onDelete, onNavigate
}: {
  todo: Todo
  isOverdue: boolean
  onToggle: (t: Todo) => void
  onDelete: (id: string) => void
  onNavigate: (path: string) => void
}) {
  const handleStudentClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (todo.student_id) {
      onNavigate(`/students/${todo.student_id}`)
    }
  }

  return (
    <li className={`
      flex items-start gap-2 px-2 py-1.5 rounded-lg group
      hover:bg-muted/50 transition-colors
      ${todo.completed ? 'opacity-50' : ''}
      ${isOverdue ? 'bg-red-50/50 dark:bg-red-950/20' : ''}
    `}>
      <button
        onClick={() => onToggle(todo)}
        className={`
          mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center
          transition-colors
          ${todo.completed
            ? 'bg-primary border-primary'
            : 'border-border hover:border-primary'
          }
        `}
      >
        {todo.completed && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
      </button>

      <div className="flex-1 min-w-0">
        <span className={`text-xs ${todo.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
          {todo.content}
        </span>
        <div className="flex items-center gap-2 mt-0.5">
          {todo.student_name && (
            <button
              onClick={handleStudentClick}
              className="text-[10px] text-muted-foreground flex items-center gap-0.5 hover:text-primary transition-colors"
            >
              <User className="w-2.5 h-2.5" />
              {todo.student_name}
            </button>
          )}
          {todo.due_date && (
            <span className={`text-[10px] flex items-center gap-0.5 ${isOverdue ? 'text-red-500' : 'text-muted-foreground'}`}>
              <Calendar className="w-2.5 h-2.5" />
              {todo.due_date}
              {isOverdue && ' 已过期'}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={() => onDelete(todo.id)}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all flex-shrink-0 mt-0.5"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </li>
  )
}