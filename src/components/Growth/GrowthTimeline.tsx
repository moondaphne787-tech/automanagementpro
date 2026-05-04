import { useState } from 'react'
import { Pencil, Trash2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { confirmDialog } from '@/components/ui/confirm-dialog'

export interface TimelineEvent {
  id: string
  date: string
  type: 'wordbank_milestone' | 'phonics' | 'ipa' | 'reading_level' | 'monthly_summary' | 'manual_note'
  label: string
  icon?: string
  category?: string
  content?: string
  isManual?: boolean
  noteId?: string
}

const CATEGORY_LABELS: Record<string, string> = {
  semester_summary: '学期总结',
  attitude: '学习态度观察',
  parent_comm: '家长沟通记录',
  highlight: '特别亮点',
}

const TYPE_ICONS: Record<string, string> = {
  wordbank_milestone: '📚',
  phonics: '🔤',
  ipa: '🎵',
  reading_level: '📖',
  monthly_summary: '📊',
  manual_note: '📝',
}

interface GrowthTimelineProps {
  events: TimelineEvent[]
  onEditNote?: (id: string, data: { note_date: string; category: string; content: string }) => Promise<void>
  onDeleteNote?: (id: string) => Promise<void>
}

export function GrowthTimeline({ events, onEditNote, onDeleteNote }: GrowthTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
        暂无成长记录
      </div>
    )
  }

  // Group events by month
  const grouped = events.reduce<Record<string, TimelineEvent[]>>((acc, e) => {
    const month = e.date ? e.date.substring(0, 7) : 'unknown'
    ;(acc[month] ??= []).push(e)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {Object.entries(grouped)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([month, monthEvents]) => (
          <div key={month}>
            <div className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <span className="bg-muted px-2 py-0.5 rounded">{month}</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="space-y-3 pl-2">
              {monthEvents.map(event => (
                <EventItem
                  key={event.id}
                  event={event}
                  onEditNote={onEditNote}
                  onDeleteNote={onDeleteNote}
                />
              ))}
            </div>
          </div>
        ))}
    </div>
  )
}

interface EventItemProps {
  event: TimelineEvent
  onEditNote?: (id: string, data: { note_date: string; category: string; content: string }) => Promise<void>
  onDeleteNote?: (id: string) => Promise<void>
}

function EventItem({ event, onEditNote, onDeleteNote }: EventItemProps) {
  const [editing, setEditing] = useState(false)
  const [editDate, setEditDate] = useState(event.date)
  const [editCategory, setEditCategory] = useState(event.category || 'highlight')
  const [editContent, setEditContent] = useState(event.content || '')
  const [saving, setSaving] = useState(false)

  if (editing && event.isManual && onEditNote) {
    return (
      <div className="border rounded-lg p-3 bg-card space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">日期</label>
            <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="h-8 text-xs" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">分类</label>
            <select
              value={editCategory}
              onChange={e => setEditCategory(e.target.value)}
              className="h-8 w-full text-xs rounded-md border border-input bg-transparent px-2"
            >
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>
        <textarea
          value={editContent}
          onChange={e => setEditContent(e.target.value)}
          className="w-full min-h-[60px] rounded-md border border-input bg-transparent p-2 text-xs"
          placeholder="记录内容..."
        />
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
            <X className="w-3 h-3 mr-1" />取消
          </Button>
          <Button variant="default" size="sm" disabled={saving} onClick={async () => {
            setSaving(true)
            await onEditNote(event.noteId!, { note_date: editDate, category: editCategory, content: editContent })
            setSaving(false)
            setEditing(false)
          }}>
            <Check className="w-3 h-3 mr-1" />保存
          </Button>
        </div>
      </div>
    )
  }

  const icon = event.icon || TYPE_ICONS[event.type] || '📌'

  return (
    <div className={cn(
      "flex gap-3 p-3 rounded-lg border transition-colors",
      event.isManual ? "bg-card hover:bg-muted/30" : "bg-muted/20"
    )}>
      <span className="text-lg flex-shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium">{event.label}</p>
            {event.content && (
              <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{event.content}</p>
            )}
          </div>
          {event.isManual && event.noteId && onEditNote && onDeleteNote && (
            <div className="flex gap-0.5 flex-shrink-0">
              <button
                onClick={() => { setEditDate(event.date); setEditCategory(event.category || 'highlight'); setEditContent(event.content || ''); setEditing(true) }}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                onClick={async () => {
                  const ok = await confirmDialog({ title: '删除记录', message: '确定删除这条成长记录？', confirmText: '删除', variant: 'danger' })
                  if (ok) await onDeleteNote(event.noteId!)
                }}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-muted-foreground">{event.date}</span>
          {event.isManual && event.category && (
            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
              {CATEGORY_LABELS[event.category] || event.category}
            </span>
          )}
          {!event.isManual && (
            <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">自动</span>
          )}
        </div>
      </div>
    </div>
  )
}
