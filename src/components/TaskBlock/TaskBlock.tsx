import { X, GripVertical, ChevronsUpDown, ChevronDown, Settings, Edit, Trash2 } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { TASK_TYPE_LABELS } from '@/types'
import type { TaskBlock as TaskBlockType, TaskType, Wordbank } from '@/types'
import { cn } from '@/lib/utils'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { settingsDb, taskPresetDb } from '@/db'
import type { TaskPreset } from '@/db/taskPresets'

// 任务类型选项
const TASK_TYPE_OPTIONS = [
  { value: 'phonics', label: '语音训练' },
  { value: 'vocab_new', label: '词库学习（新词）' },
  { value: 'vocab_review', label: '词库复习' },
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
  compact?: boolean
  onChange?: (task: TaskBlockType) => void
  onDelete?: () => void
  className?: string
  wordbanks?: Wordbank[]
  /** dnd-kit 拖拽监听器，传入后 GripVertical 图标变为真正的拖拽手柄 */
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
  const [defaultText, setDefaultText] = useState('')
  const [expanded, setExpanded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

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

  // === 预设模板功能 ===
  const [presets, setPresets] = useState<TaskPreset[]>([])
  const [showPresets, setShowPresets] = useState(false)
  const presetsRef = useRef<HTMLDivElement>(null)

  // 加载预设并切换下拉显示
  const togglePresets = async () => {
    if (showPresets) {
      setShowPresets(false)
      return
    }
    try {
      const list = await taskPresetDb.getByType(task.type)
      setPresets(list)
      setShowPresets(true)
    } catch { /* 静默失败 */ }
  }

  const applyPreset = (preset: TaskPreset) => {
    onChange?.({ ...task, content: preset.content })
    setShowPresets(false)
  }

  // 点击外部关闭预设下拉
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (presetsRef.current && !presetsRef.current.contains(e.target as Node)) {
        setShowPresets(false)
      }
    }
    if (showPresets) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showPresets])

  // === 管理预设对话框 ===
  const [showManage, setShowManage] = useState(false)
  const [manageType, setManageType] = useState<TaskPreset[]>([])
  const [editLabel, setEditLabel] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editId, setEditId] = useState<string | null>(null)

  const openManage = async () => {
    setShowPresets(false)
    try {
      const list = await taskPresetDb.getByType(task.type)
      setManageType(list)
      setShowManage(true)
      setEditId(null)
      setEditLabel('')
      setEditContent('')
    } catch { /* 静默失败 */ }
  }

  const handleSavePreset = async () => {
    if (!editLabel.trim() || !editContent.trim()) return
    try {
      if (editId) {
        await taskPresetDb.update(editId, { label: editLabel.trim(), content: editContent.trim() })
      } else {
        await taskPresetDb.create({ task_type: task.type, label: editLabel.trim(), content: editContent.trim() })
      }
      const list = await taskPresetDb.getByType(task.type)
      setManageType(list)
      setEditId(null)
      setEditLabel('')
      setEditContent('')
    } catch { /* 静默失败 */ }
  }

  const handleDeletePreset = async (id: string) => {
    try {
      await taskPresetDb.delete(id)
      setManageType(prev => prev.filter(p => p.id !== id))
    } catch { /* 静默失败 */ }
  }
  
  // === 预设管理对话框 ===
  const PresetManagementDialog = () => (
    <Dialog open={showManage} onOpenChange={setShowManage}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>管理预设模板</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {/* 新增/编辑表单 */}
          <div className="space-y-2">
            <Input
              placeholder="预设名称（如：新词5个）"
              value={editLabel}
              onChange={e => setEditLabel(e.target.value)}
            />
            <textarea
              placeholder="预设内容"
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <Button size="sm" onClick={handleSavePreset}>
              {editId ? '更新' : '添加'}
            </Button>
          </div>
          {/* 已有预设列表 */}
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {manageType.map(p => (
              <div key={p.id} className="flex items-center justify-between border rounded px-2 py-1.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{p.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.content}</p>
                </div>
                <div className="flex gap-1 shrink-0 ml-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => {
                      setEditId(p.id)
                      setEditLabel(p.label)
                      setEditContent(p.content)
                    }}
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive"
                    onClick={() => handleDeletePreset(p.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowManage(false)}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  // 获取任务类型颜色
  const getTypeColor = (type: TaskType) => {
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
  
  // 类型切换处理（compact 和标准模式共用）
  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as TaskType
    const updated: TaskBlockType = { ...task, type: newType }
    delete updated.wordbank_label
    delete updated.level_from
    delete updated.level_to
    delete updated.level_reached
    updated.content = ''
    onChange?.(updated)
  }

  // 紧凑编辑模式：一行搞定类型+内容+删除
  if (editable && compact) {
    return (
      <>
        <div className={cn("space-y-1", className)}>
          <div className="flex items-center gap-1.5">
            <GripVertical
              className="w-3.5 h-3.5 text-muted-foreground cursor-grab shrink-0 touch-none"
              {...(dragListeners || {})}
            />
            <Select
              value={task.type}
              options={TASK_TYPE_OPTIONS}
              onChange={handleTypeChange}
              className="w-[120px] h-8 text-xs shrink-0"
            />
            {!expanded ? (
              <input
                ref={inputRef}
                type="text"
                value={task.content || ''}
                onChange={(e) => onChange?.({ ...task, content: e.target.value })}
                placeholder={defaultText || '任务内容'}
                className="flex-1 min-w-0 h-8 rounded-md border border-input bg-transparent px-2 py-1 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            ) : (
              <div className="flex-1" />
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={() => setExpanded(!expanded)}
              title={expanded ? '收起' : '展开多行输入'}
            >
              <ChevronsUpDown className="w-3.5 h-3.5" />
            </Button>
            {onDelete && (
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onDelete}>
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
            {/* 预设模板下拉 */}
            <div className="relative" ref={presetsRef}>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={togglePresets}
                title="预设模板"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </Button>
              {showPresets && (
                <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-md border bg-popover shadow-md">
                  <div className="p-1">
                    {presets.length === 0 ? (
                      <p className="px-2 py-1.5 text-xs text-muted-foreground">暂无预设</p>
                    ) : (
                      presets.map(p => (
                        <button
                          key={p.id}
                          className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent"
                          onClick={() => applyPreset(p)}
                        >
                          <span className="font-medium">{p.label}</span>
                        </button>
                      ))
                    )}
                    <div className="border-t mt-1 pt-1">
                      <button
                        className="w-full text-left px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded hover:bg-accent"
                        onClick={openManage}
                      >
                        <Settings className="w-3 h-3 inline mr-1" />
                        管理预设
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          {expanded && (
            <textarea
              value={task.content || ''}
              onChange={(e) => onChange?.({ ...task, content: e.target.value })}
              placeholder={defaultText || '输入任务内容描述'}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y ml-5"
              style={{ width: 'calc(100% - 20px)', marginLeft: 20 }}
            />
          )}
        </div>
        <PresetManagementDialog />
      </>
    )
  }

  // 标准编辑模式
  if (editable) {
    return (
      <>
        <div className={cn(
          "border rounded-lg p-3 bg-card space-y-3",
          className
        )}>
          <div className="flex items-center gap-2">
            <GripVertical
              className="w-4 h-4 text-muted-foreground cursor-grab touch-none"
              {...(dragListeners || {})}
            />
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
              onChange={handleTypeChange}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-muted-foreground">
                任务内容
                {defaultText && (
                  <span className="text-primary ml-1">(已有默认模板)</span>
                )}
              </label>
              <div className="relative" ref={presetsRef}>
                <button
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                  onClick={togglePresets}
                >
                  <ChevronDown className="w-3 h-3" />
                  预设
                </button>
                {showPresets && (
                  <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-md border bg-popover shadow-md">
                    <div className="p-1">
                      {presets.length === 0 ? (
                        <p className="px-2 py-1.5 text-xs text-muted-foreground">暂无预设</p>
                      ) : (
                        presets.map(p => (
                          <button
                            key={p.id}
                            className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent"
                            onClick={() => applyPreset(p)}
                          >
                            <span className="font-medium">{p.label}</span>
                          </button>
                        ))
                      )}
                      <div className="border-t mt-1 pt-1">
                        <button
                          className="w-full text-left px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded hover:bg-accent"
                          onClick={openManage}
                        >
                          <Settings className="w-3 h-3 inline mr-1" />
                          管理预设
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
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
        <PresetManagementDialog />
      </>
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
