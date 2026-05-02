import { useState, useEffect, useCallback, useRef } from 'react'
import { Edit, Trash2, Plus, Calendar, FileText, Columns, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { TaskBlock } from '@/components/TaskBlock/TaskBlock'
import { ClassRecordForm } from '@/components/ClassRecord/ClassRecordForm'
import { useAppStore } from '@/store/appStore'
import { classRecordDb } from '@/db'
import { extractFeedbackBeforeNotes } from '@/utils/feedbackParser'
import { cn } from '@/lib/utils'
import type { ClassRecord, LessonPlan, TaskCompletedType, PerformanceType, TaskType } from '@/types'
import { TASK_TYPE_LABELS } from '@/types'

function getThisMonthRange() {
  const now = new Date()
  return {
    startDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
    endDate: new Date().toISOString().split('T')[0]
  }
}

function getLast3MonthsRange() {
  const end = new Date()
  const start = new Date()
  start.setMonth(start.getMonth() - 3)
  return { startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] }
}

const STATUS_CONFIG: Record<TaskCompletedType, { label: string; cls: string }> = {
  completed:     { label: '✓ 全部完成', cls: 'text-green-600' },
  partial:       { label: '◐ 部分完成', cls: 'text-yellow-600' },
  not_completed: { label: '✗ 未完成',   cls: 'text-red-600' },
}

const PERF_CONFIG: Record<PerformanceType, { label: string; cls: string }> = {
  excellent:        { label: '优秀', cls: 'text-green-600' },
  good:             { label: '良好', cls: 'text-blue-600' },
  needs_improvement:{ label: '待提高', cls: 'text-orange-600' },
}

const ATTEND_CONFIG = {
  present: { label: '到课', cls: 'bg-green-500/10 text-green-600' },
  late:    { label: '迟到', cls: 'bg-yellow-500/10 text-yellow-600' },
  absent:  { label: '缺课', cls: 'bg-red-500/10 text-red-600' },
}

const TASK_TYPE_COLORS: Record<string, string> = {
  vocab_new:     'bg-blue-500/10 text-blue-600',
  vocab_review:  'bg-green-500/10 text-green-600',
  textbook:      'bg-purple-500/10 text-purple-600',
  reading:       'bg-cyan-500/10 text-cyan-600',
  phonics:       'bg-pink-500/10 text-pink-600',
  exercise:      'bg-yellow-500/10 text-yellow-600',
  picture_book:  'bg-indigo-500/10 text-indigo-600',
  other:         'bg-gray-500/10 text-gray-600',
}

/** 单条记录行（紧凑 + 可展开） */
function RecordRow({
  record,
  expanded,
  onToggle,
  onEdit,
  onDelete,
}: {
  record: ClassRecord & { plan?: LessonPlan }
  expanded: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const status = STATUS_CONFIG[record.task_completed]
  const perf = PERF_CONFIG[record.performance]
  const attend = ATTEND_CONFIG[record.attendance]

  return (
    <div className={cn('border rounded-lg overflow-hidden transition-colors', expanded && 'border-primary/30')}>
      {/* 紧凑行 — 点击展开，垂直卡片布局 */}
      <div
        className="px-3 py-2.5 cursor-pointer hover:bg-muted/40 select-none group"
        onClick={onToggle}
      >
        {/* 第一行：日期 */}
        <div className="flex items-center mb-2">
          <span className="text-sm font-medium flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            {record.class_date}
          </span>
        </div>

        {/* 第二行：学习内容 — 卡片主体，完整显示 */}
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {record.tasks.map((task, i) => (
            <span
              key={i}
              className={cn(
                "inline-flex items-center gap-1.5 text-xs rounded-md px-2 py-1",
                TASK_TYPE_COLORS[task.type]
              )}
            >
              <span className="font-medium shrink-0">{TASK_TYPE_LABELS[task.type]}</span>
              {task.content ? (
                <span>{task.content}</span>
              ) : task.wordbank_label ? (
                <span>
                  {task.wordbank_label}{task.level_from ? ` 第${task.level_from}-${task.level_to}关` : ''}
                </span>
              ) : null}
            </span>
          ))}
        </div>

        {/* 第三行：出勤 + 完成状态 + 时长 + 助教 + 操作按钮 */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <span className={cn('px-1.5 py-0.5 rounded', attend.cls)}>{attend.label}</span>
            <span className={status.cls}>{status.label}</span>
            <span className="text-muted-foreground">{record.duration_hours}h</span>
            {record.teacher_name && <span className="text-muted-foreground">{record.teacher_name}</span>}
          </div>
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <button
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="编辑"
              onClick={onEdit}
            >
              <Edit className="w-3.5 h-3.5" />
            </button>
            <button
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
              title="删除"
              onClick={onDelete}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <span className="text-muted-foreground ml-1">
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </span>
          </div>
        </div>
      </div>

      {/* 展开详情 */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t bg-muted/20 space-y-3">
          {/* 计划 vs 实际 */}
          {record.plan ? (
            <div className="border rounded-lg overflow-hidden">
              <div className="grid grid-cols-2 divide-x">
                <div className="bg-blue-50/50 p-2.5">
                  <div className="flex items-center gap-1.5 mb-1.5 text-blue-700">
                    <Columns className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">原定计划</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {record.plan.tasks.map((task, idx) => (
                      <span key={idx} className="text-xs bg-white border border-blue-200 px-1.5 py-0.5 rounded">
                        {task.wordbank_label || task.content || task.type}
                        {task.level_from && task.level_to && ` 第${task.level_from}-${task.level_to}关`}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="bg-green-50/50 p-2.5">
                  <div className="flex items-center gap-1.5 mb-1.5 text-green-700">
                    <FileText className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">实际完成</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {record.tasks.map((task, idx) => (
                      <span key={idx} className="text-xs bg-white border border-green-200 px-1.5 py-0.5 rounded">
                        {task.wordbank_label || task.content || task.type}
                        {task.level_reached && ` → 第${task.level_reached}关`}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="border-t px-2 py-1.5 bg-muted/30 flex items-center gap-3 text-xs">
                <span className={status.cls}>{status.label}</span>
                <span className={perf.cls}>{perf.label}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {record.tasks.map((task, i) => <TaskBlock key={i} task={task} index={i} />)}
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className={status.cls}>{status.label}</span>
                <span className={perf.cls}>{perf.label}</span>
              </div>
            </div>
          )}

          {/* 备注 */}
          {record.issues && (
            <p className="text-xs text-muted-foreground">问题：{record.issues}</p>
          )}

          {/* 反馈原文 */}
          {record.detail_feedback && (
            <div className="p-2.5 bg-muted/50 rounded-lg border">
              <p className="text-xs text-muted-foreground mb-1 font-medium">学情反馈原文</p>
              <pre className="text-xs whitespace-pre-wrap font-sans text-foreground leading-relaxed">
                {extractFeedbackBeforeNotes(record.detail_feedback)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface RecordsTabProps {
  studentId: string
}

export function RecordsTab({ studentId }: RecordsTabProps) {
  const wordbanks = useAppStore(s => s.wordbanks)
  const createClassRecord = useAppStore(s => s.createClassRecord)
  const updateClassRecord = useAppStore(s => s.updateClassRecord)
  const deleteClassRecord = useAppStore(s => s.deleteClassRecord)

  const [showRecordForm, setShowRecordForm] = useState(false)
  const [editingRecord, setEditingRecord] = useState<ClassRecord | null>(null)
  const [recordsWithPlan, setRecordsWithPlan] = useState<(ClassRecord & { plan?: LessonPlan })[]>([])
  const [recordFilter, setRecordFilter] = useState<{ startDate: string; endDate: string }>(getLast3MonthsRange())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // totalCount 只在 studentId 变化时查询一次，不随筛选条件变化
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const totalCountLoadedRef = useRef(false)

  const loadRecords = useCallback(async (filter: { startDate: string; endDate: string }) => {
    setLoading(true)
    try {
      const hasFilter = filter.startDate || filter.endDate
      const records = await classRecordDb.getWithPlan(studentId, {
        startDate: hasFilter ? filter.startDate : undefined,
        endDate: hasFilter ? filter.endDate : undefined
      })
      setRecordsWithPlan(records)
    } finally {
      setLoading(false)
    }
  }, [studentId])

  // 首次加载：同时获取总数（只查一次）
  useEffect(() => {
    totalCountLoadedRef.current = false
    setTotalCount(null)
    loadRecords(recordFilter)
    classRecordDb.getWithPlan(studentId).then(all => {
      if (!totalCountLoadedRef.current) {
        setTotalCount(all.length)
        totalCountLoadedRef.current = true
      }
    })
  }, [studentId])

  // 筛选条件变化时重新加载
  useEffect(() => {
    if (totalCountLoadedRef.current) {
      loadRecords(recordFilter)
    }
  }, [recordFilter.startDate, recordFilter.endDate])

  const handleCreateRecord = async (data: any) => {
    await createClassRecord(data)
    setShowRecordForm(false)
    setTotalCount(prev => (prev ?? 0) + 1)
    await loadRecords(recordFilter)
  }

  const handleUpdateRecord = async (data: any) => {
    if (!editingRecord) return
    await updateClassRecord(editingRecord.id, data)
    setEditingRecord(null)
    await loadRecords(recordFilter)
  }

  const handleDeleteRecord = async (recordId: string) => {
    await deleteClassRecord(recordId)
    setTotalCount(prev => (prev !== null ? prev - 1 : null))
    await loadRecords(recordFilter)
  }

  return (
    <div className="space-y-4">
      {showRecordForm ? (
        <ClassRecordForm studentId={studentId} wordbanks={wordbanks} onSave={handleCreateRecord} onCancel={() => setShowRecordForm(false)} />
      ) : editingRecord ? (
        <ClassRecordForm studentId={studentId} wordbanks={wordbanks} onSave={handleUpdateRecord} onCancel={() => setEditingRecord(null)} initialData={editingRecord} />
      ) : (
        <>
          {/* 顶部操作栏 */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <DatePicker value={recordFilter.startDate} onChange={v => setRecordFilter(p => ({ ...p, startDate: v }))} placeholder="起始日期" />
              <span className="text-muted-foreground text-sm">—</span>
              <DatePicker value={recordFilter.endDate} onChange={v => setRecordFilter(p => ({ ...p, endDate: v }))} placeholder="结束日期" />
            </div>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={() => setRecordFilter(getThisMonthRange())}>本月</Button>
              <Button variant="outline" size="sm" onClick={() => setRecordFilter(getLast3MonthsRange())}>近3月</Button>
              <Button variant="ghost" size="sm" onClick={() => setRecordFilter({ startDate: '', endDate: '' })}>全部</Button>
            </div>
            {totalCount !== null && totalCount > 50 && (
              <span className="text-xs text-muted-foreground ml-auto">共 {totalCount} 条，当前显示 {recordsWithPlan.length} 条</span>
            )}
            <Button size="sm" className="ml-auto" onClick={() => setShowRecordForm(true)}>
              <Plus className="w-4 h-4 mr-1" />新建记录
            </Button>
          </div>

          {/* 列表 */}
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : recordsWithPlan.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
              {totalCount === 0 ? <p>暂无课堂记录</p> : <p>当前日期范围内无记录</p>}
            </div>
          ) : (
            <div className="space-y-1.5">
              {recordsWithPlan.map(record => (
                <RecordRow
                  key={record.id}
                  record={record}
                  expanded={expandedId === record.id}
                  onToggle={() => setExpandedId(expandedId === record.id ? null : record.id)}
                  onEdit={() => setEditingRecord(record)}
                  onDelete={async () => {
                    const confirmed = await confirmDialog({ title: '删除课堂记录', message: '确定删除此课堂记录？此操作不可恢复。', confirmText: '删除', variant: 'danger' })
                    if (confirmed) await handleDeleteRecord(record.id)
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
