import { useState, useEffect, useMemo } from 'react'
import { BookOpen, FileText, GraduationCap, CheckSquare, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { classRecordDb, examScoreDb, vocabTestDb, lessonPlanDb, readingCheckinDb } from '@/db'
import { TASK_TYPE_LABELS } from '@/types'
import type { ClassRecord, LessonPlan } from '@/types'

interface TimelineEvent {
  id: string
  type: 'class' | 'exam' | 'vocab_test' | 'checkin'
  date: string
  title: string
  subtitle?: string
  details?: React.ReactNode
}

function getMonthGroup(date: string): string {
  const parts = date.split('-')
  return `${parts[0]}年${parseInt(parts[1], 10)}月`
}

const TYPE_CONFIG = {
  class: { icon: BookOpen, color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-200' },
  exam: { icon: FileText, color: 'text-purple-600', bg: 'bg-purple-100', border: 'border-purple-200' },
  vocab_test: { icon: GraduationCap, color: 'text-green-600', bg: 'bg-green-100', border: 'border-green-200' },
  checkin: { icon: CheckSquare, color: 'text-amber-600', bg: 'bg-amber-100', border: 'border-amber-200' },
}

interface TimelineFilter {
  class: boolean
  exam: boolean
  vocab_test: boolean
  checkin: boolean
}

interface StudentTimelineProps {
  studentId: string
}

export function StudentTimeline({ studentId }: StudentTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<TimelineFilter>({
    class: true,
    exam: true,
    vocab_test: true,
    checkin: true,
  })

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    Promise.all([
      classRecordDb.getWithPlan(studentId),
      examScoreDb.getByStudentId(studentId),
      vocabTestDb.getByStudentId(studentId),
      readingCheckinDb.getByStudentId(studentId),
      lessonPlanDb.getByStudentId(studentId),
    ]).then(([records, exams, vocabTests, checkins, plans]) => {
      if (cancelled) return

      const allEvents: TimelineEvent[] = []

      // 课堂记录
      for (const r of records) {
        allEvents.push({
          id: `class-${r.id}`,
          type: 'class',
          date: r.class_date,
          title: `课堂记录`,
          subtitle: `${r.duration_hours}h · ${r.teacher_name || ''}`,
          details: (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1">
                {r.tasks.map((t, i) => (
                  <span key={i} className={cn("text-xs px-1.5 py-0.5 rounded border")}>
                    <span className="font-medium">{TASK_TYPE_LABELS[t.type]}</span>
                    {t.content && <span> · {t.content}</span>}
                  </span>
                ))}
              </div>
              {(r as ClassRecord & { plan?: LessonPlan }).plan && (
                <div className="text-xs text-muted-foreground border-t pt-1">
                  对应计划：{(r as ClassRecord & { plan?: LessonPlan }).plan!.plan_date}
                </div>
              )}
              {r.detail_feedback && (
                <p className="text-xs text-muted-foreground">反馈：{r.detail_feedback.slice(0, 100)}</p>
              )}
            </div>
          ),
        })
      }

      // 考试成绩
      for (const e of exams) {
        allEvents.push({
          id: `exam-${e.id}`,
          type: 'exam',
          date: e.exam_date,
          title: e.exam_name || '考试',
          subtitle: e.score !== null ? `${e.score}/${e.full_score}` : `满分${e.full_score}`,
          details: e.notes ? <p className="text-xs text-muted-foreground">{e.notes}</p> : undefined,
        })
      }

      // 词汇量测试
      for (const v of vocabTests) {
        allEvents.push({
          id: `vocab-${v.id}`,
          type: 'vocab_test',
          date: v.test_date,
          title: '词汇量测试',
          subtitle: `${v.vocab_count} 词`,
          details: v.notes ? <p className="text-xs text-muted-foreground">{v.notes}</p> : undefined,
        })
      }

      // 朗读打卡
      for (const c of checkins) {
        allEvents.push({
          id: `checkin-${c.id}`,
          type: 'checkin',
          date: c.checked_date,
          title: '朗读打卡',
          subtitle: undefined,
        })
      }

      // 按日期降序排列
      allEvents.sort((a, b) => b.date.localeCompare(a.date))
      setEvents(allEvents)
      setLoading(false)
    }).catch(() => setLoading(false))

    return () => { cancelled = true }
  }, [studentId])

  // 过滤后按月份分组
  const groupedEvents = useMemo(() => {
    const filtered = events.filter(e => filter[e.type])
    const groups: Record<string, TimelineEvent[]> = {}
    for (const event of filtered) {
      const key = getMonthGroup(event.date)
      if (!groups[key]) groups[key] = []
      groups[key].push(event)
    }
    return groups
  }, [events, filter])

  const filterOptions: { key: keyof TimelineFilter; label: string; color: string }[] = [
    { key: 'class', label: '课堂记录', color: 'bg-blue-100 text-blue-700' },
    { key: 'exam', label: '考试成绩', color: 'bg-purple-100 text-purple-700' },
    { key: 'vocab_test', label: '词汇测试', color: 'bg-green-100 text-green-700' },
    { key: 'checkin', label: '朗读打卡', color: 'bg-amber-100 text-amber-700' },
  ]

  return (
    <div className="space-y-4">
      {/* 过滤条 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">显示：</span>
        {filterOptions.map(opt => (
          <button
            key={opt.key}
            className={cn(
              'px-2.5 py-1 text-xs rounded-full border transition-colors',
              filter[opt.key]
                ? `${opt.color} border-transparent`
                : 'text-muted-foreground border-input hover:bg-muted'
            )}
            onClick={() => setFilter(prev => ({ ...prev, [opt.key]: !prev[opt.key] }))}
          >
            {opt.label}
          </button>
        ))}
        <span className="text-xs text-muted-foreground ml-auto">
          共 {Object.values(groupedEvents).reduce((sum, g) => sum + g.length, 0)} 条记录
        </span>
      </div>

      {/* 时间线 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : Object.keys(groupedEvents).length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <GraduationCap className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>暂无学习记录</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedEvents).map(([month, monthEvents]) => (
            <div key={month}>
              {/* 月份标题 */}
              <h3 className="text-sm font-medium text-muted-foreground mb-3 sticky top-0 bg-background pb-1 z-10">
                {month}
              </h3>

              {/* 该月的事件 */}
              <div className="relative pl-8 space-y-0">
                {/* 垂直时间线 */}
                <div className="absolute left-3.5 top-2 bottom-2 w-px bg-border" />

                {monthEvents.map(event => {
                  const config = TYPE_CONFIG[event.type]
                  const Icon = config.icon
                  const isExpanded = expandedId === event.id

                  return (
                    <div key={event.id} className="relative pb-4 last:pb-0">
                      {/* 时间线节点 */}
                      <div className={cn(
                        "absolute -left-5 top-1 w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-background",
                        config.bg
                      )}>
                        <Icon className={cn("w-3 h-3", config.color)} />
                      </div>

                      {/* 事件卡片 */}
                      <div
                        className={cn(
                          "border rounded-lg p-3 cursor-pointer transition-colors hover:bg-muted/30",
                          event.details && isExpanded && config.border
                        )}
                        onClick={() => {
                          if (event.details) {
                            setExpandedId(isExpanded ? null : event.id)
                          }
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{event.title}</span>
                              {event.subtitle && (
                                <span className="text-xs text-muted-foreground">{event.subtitle}</span>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">{event.date}</span>
                          </div>
                          {event.details && (
                            <div className="shrink-0 mt-0.5">
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                              )}
                            </div>
                          )}
                        </div>

                        {/* 展开的详情 */}
                        {isExpanded && event.details && (
                          <div className="mt-2 pt-2 border-t text-sm">
                            {event.details}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
