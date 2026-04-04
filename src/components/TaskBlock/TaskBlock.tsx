import { X, GripVertical } from 'lucide-react'
import { useState, useEffect } from 'react'
import { TASK_TYPE_LABELS } from '@/types'
import type { TaskBlock as TaskBlockType, TaskType, Wordbank } from '@/types'
import { cn } from '@/lib/utils'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { settingsDb } from '@/db'

// 任务类型选项
const TASK_TYPE_OPTIONS = [
  { value: 'phonics', label: '语音训练' },
  { value: 'vocab_new', label: '词库学习（新词）' },
  { value: 'vocab_review', label: '词库复习' },
  { value: 'nine_grid', label: '九宫格清理' },
  { value: 'textbook', label: '课文梳理' },
  { value: 'reading', label: '阅读训练' },
  { value: 'picture_book', label: '绘本阅读' },
  { value: 'exercise', label: '专项练习' },
  { value: 'other', label: '其他' },
]

interface TaskBlockProps {
  task: TaskBlockType
  index: number
  editable?: boolean
  onChange?: (task: TaskBlockType) => void
  onDelete?: () => void
  className?: string
  wordbanks?: Wordbank[]
}

export function TaskBlock({ 
  task, 
  index, 
  editable = false, 
  onChange, 
  onDelete,
  className,
  wordbanks = []
}: TaskBlockProps) {
  const [defaultText, setDefaultText] = useState('')

  // 加载该任务类型的默认文本
  useEffect(() => {
    if (editable) {
      settingsDb.get(`task_default_${task.type}`).then(val => {
        setDefaultText(val || '')
      })
    }
  }, [task.type, editable])

  // 当任务类型切换时，如果 content 为空且有默认文本，自动填充
  useEffect(() => {
    if (editable && defaultText && !task.content) {
      onChange?.({ ...task, content: defaultText })
    }
  }, [defaultText])
  
  // 获取任务类型颜色
  const getTypeColor = (type: TaskType) => {
    switch (type) {
      case 'vocab_new':
        return 'bg-blue-500/10 text-blue-600 border-blue-200'
      case 'vocab_review':
        return 'bg-green-500/10 text-green-600 border-green-200'
      case 'nine_grid':
        return 'bg-orange-500/10 text-orange-600 border-orange-200'
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
  
  if (editable) {
    return (
      <div className={cn(
        "border rounded-lg p-3 bg-card space-y-3",
        className
      )}>
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
          <span className="text-sm font-medium">任务 {index + 1}</span>
          <div className="flex-1" />
          {onDelete && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDelete}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">任务类型</label>
          <Select
            value={task.type}
            options={TASK_TYPE_OPTIONS}
            onChange={(e) => {
              const newType = e.target.value as TaskType
              const updated: TaskBlockType = { ...task, type: newType }
              // 清空旧字段
              delete updated.wordbank_label
              delete updated.level_from
              delete updated.level_to
              delete updated.level_reached
              // content 保留，让 useEffect 处理默认文本
              updated.content = ''
              onChange?.(updated)
            }}
          />
        </div>
        
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            任务内容
            {defaultText && (
              <span className="text-primary ml-1">(已有默认模板)</span>
            )}
          </label>
          <textarea
            value={task.content || ''}
            onChange={(e) => {
              onChange?.({ ...task, content: e.target.value })
            }}
            placeholder={defaultText || '输入任务内容描述'}
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y min-h-[60px]"
          />
        </div>
      </div>
    )
  }
  
  // 只读模式
  return (
    <div className={cn(
      "flex items-start gap-2 px-3 py-2 rounded-lg border",
      getTypeColor(task.type),
      className
    )}>
      <span className="text-xs font-medium whitespace-nowrap">{TASK_TYPE_LABELS[task.type]}</span>
      
      {task.content && (
        <>
          <span className="text-xs opacity-60">·</span>
          <span className="text-xs whitespace-pre-wrap">{task.content}</span>
        </>
      )}

      {/* 兼容旧数据：如果有 wordbank_label 和 level 信息，也显示 */}
      {!task.content && task.wordbank_label && (
        <>
          <span className="text-xs opacity-60">·</span>
          <span className="text-xs">{task.wordbank_label}</span>
          {task.level_from && task.level_to && (
            <>
              <span className="text-xs opacity-60">·</span>
              <span className="text-xs">第{task.level_from}-{task.level_to}关</span>
            </>
          )}
        </>
      )}
    </div>
  )
}

// 创建空任务
export function createEmptyTask(): TaskBlockType {
  return {
    type: 'vocab_new',
    content: ''
  }
}
