import { X, GripVertical } from 'lucide-react'
import { TASK_TYPE_LABELS } from '@/types'
import type { TaskBlock as TaskBlockType, TaskType, Wordbank } from '@/types'
import { cn } from '@/lib/utils'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

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

// 需要词库和关数的任务类型
const WORDBANK_TASK_TYPES: TaskType[] = ['vocab_new', 'vocab_review', 'nine_grid']

interface TaskBlockProps {
  task: TaskBlockType
  index: number
  editable?: boolean
  onChange?: (task: TaskBlockType) => void
  onDelete?: () => void
  className?: string
  // 词库列表，用于限制关数
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
  const needsWordbank = WORDBANK_TASK_TYPES.includes(task.type)
  
  // 获取当前选中词库的总关数
  const getWordbankMaxLevel = (wordbankLabel: string | undefined): number => {
    if (!wordbankLabel) return 999 // 默认最大值
    const wordbank = wordbanks.find(w => w.name === wordbankLabel)
    return wordbank?.total_levels || 999
  }
  
  // 词库选项（从传入的 wordbanks 生成）
  const wordbankOptions = wordbanks.length > 0 
    ? wordbanks.map(w => ({ value: w.name, label: w.name }))
    : [
        { value: '小学考纲', label: '小学考纲' },
        { value: '小学进阶', label: '小学进阶' },
        { value: '初中考纲', label: '初中考纲' },
        { value: '初中进阶', label: '初中进阶' },
        { value: '高中考纲', label: '高中考纲' },
        { value: '高中进阶', label: '高中进阶' },
        { value: '大学四级', label: '大学四级' },
        { value: '七上', label: '七上' },
        { value: '七下', label: '七下' },
        { value: '八上', label: '八上' },
        { value: '八下', label: '八下' },
        { value: '六上', label: '六上' },
        { value: '六下', label: '六下' },
        { value: '五上', label: '五上' },
        { value: '五下', label: '五下' },
        { value: '四上', label: '四上' },
        { value: '四下', label: '四下' },
        { value: '三上', label: '三上' },
        { value: '三下', label: '三下' },
        { value: '中考考纲', label: '中考考纲' },
        { value: '高考考纲', label: '高考考纲' },
        { value: 'KET', label: 'KET' },
        { value: 'PET', label: 'PET' },
      ]
  
  const maxLevel = getWordbankMaxLevel(task.wordbank_label)
  
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
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">任务类型</label>
            <Select
              value={task.type}
              options={TASK_TYPE_OPTIONS}
              onChange={(e) => {
                const newType = e.target.value as TaskType
                const updated: TaskBlockType = { ...task, type: newType }
                // 如果不需要词库，清空词库相关字段
                if (!WORDBANK_TASK_TYPES.includes(newType)) {
                  delete updated.wordbank_label
                  delete updated.level_from
                  delete updated.level_to
                  delete updated.level_reached
                }
                onChange?.(updated)
              }}
            />
          </div>
          
          {needsWordbank && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">词库</label>
              <Select
                value={task.wordbank_label || ''}
                options={[{ value: '', label: '选择词库' }, ...wordbankOptions]}
                onChange={(e) => {
                  const newLabel = e.target.value || undefined
                  // 切换词库时，如果当前关数超过新词库的总关数，需要重置
                  const newMaxLevel = getWordbankMaxLevel(newLabel)
                  const updated: TaskBlockType = { ...task, wordbank_label: newLabel }
                  if (task.level_from && task.level_from > newMaxLevel) {
                    delete updated.level_from
                  }
                  if (task.level_to && task.level_to > newMaxLevel) {
                    delete updated.level_to
                  }
                  onChange?.(updated)
                }}
              />
            </div>
          )}
        </div>
        
        {needsWordbank && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                起始关 {maxLevel < 999 && <span className="text-primary">(最大 {maxLevel})</span>}
              </label>
              <Input
                type="number"
                min={1}
                max={maxLevel}
                value={task.level_from || ''}
                onChange={(e) => {
                  let value = parseInt(e.target.value) || undefined
                  // 限制不超过最大关数
                  if (value && value > maxLevel) {
                    value = maxLevel
                  }
                  onChange?.({ 
                    ...task, 
                    level_from: value,
                    level_reached: task.level_to ? parseInt(e.target.value) : undefined
                  })
                }}
                placeholder="起始关数"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                结束关 {maxLevel < 999 && <span className="text-primary">(最大 {maxLevel})</span>}
              </label>
              <Input
                type="number"
                min={task.level_from || 1}
                max={maxLevel}
                value={task.level_to || ''}
                onChange={(e) => {
                  let levelTo = parseInt(e.target.value) || undefined
                  // 限制不超过最大关数
                  if (levelTo && levelTo > maxLevel) {
                    levelTo = maxLevel
                  }
                  onChange?.({ 
                    ...task, 
                    level_to: levelTo,
                    level_reached: levelTo
                  })
                }}
                placeholder="结束关数"
              />
            </div>
          </div>
        )}
        
        {!needsWordbank && (
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">内容描述</label>
            <Input
              value={task.content || ''}
              onChange={(e) => {
                onChange?.({ ...task, content: e.target.value })
              }}
              placeholder="输入任务内容描述"
            />
          </div>
        )}
      </div>
    )
  }
  
  // 只读模式
  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-2 rounded-lg border",
      getTypeColor(task.type),
      className
    )}>
      <span className="text-xs font-medium">{TASK_TYPE_LABELS[task.type]}</span>
      
      {needsWordbank && task.wordbank_label && (
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
      
      {!needsWordbank && task.content && (
        <>
          <span className="text-xs opacity-60">·</span>
          <span className="text-xs truncate max-w-[200px]">{task.content}</span>
        </>
      )}
    </div>
  )
}

// 创建空任务
export function createEmptyTask(): TaskBlockType {
  return {
    type: 'vocab_new'
  }
}