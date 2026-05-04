import { useEffect, useState, useMemo, useCallback } from 'react'
import { FileDown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/appStore'
import { classRecordDb, progressDb } from '@/db'
import { growthNoteDb } from '@/db/growthNotes'
import { GrowthTimeline } from './GrowthTimeline'
import type { TimelineEvent } from './GrowthTimeline'
import { NoteForm } from './NoteForm'
import { generateGrowthReportHTML } from '@/utils/growthReport'
import type { Student, ClassRecord, StudentWordbankProgress, Wordbank } from '@/types'

function deriveAutoEvents(
  student: Student,
  classRecords: ClassRecord[],
  progress: StudentWordbankProgress[],
  wordbanks: Wordbank[]
): TimelineEvent[] {
  const events: TimelineEvent[] = []
  const idCounter = { n: 0 }
  const nextId = () => `auto-${++idCounter.n}`

  // 1. 词库里程碑：每完成 10 关记录一次
  progress.forEach(p => {
    const checkpoints = [10, 20, 30, 40, 50, 60]
    checkpoints.forEach(n => {
      if (p.current_level >= n) {
        // 从课堂记录反查最近一次涉及该词库的日期
        const relatedRecords = classRecords.filter(r =>
          r.tasks.some(t => t.wordbank_label === p.wordbank_label)
        )
        const date = relatedRecords.length > 0
          ? relatedRecords[relatedRecords.length - 1].class_date
          : classRecords[0]?.class_date || ''
        events.push({
          id: nextId(),
          date,
          type: 'wordbank_milestone',
          icon: '📚',
          label: `${p.wordbank_label} 完成第${n}关`,
        })
      }
    })
  })

  // 2. 语音训练完成
  if (student.phonics_completed) {
    events.push({
      id: nextId(),
      date: classRecords[0]?.class_date || '',
      type: 'phonics',
      icon: '🔤',
      label: '完成自然拼读学习',
    })
  }
  if (student.ipa_completed) {
    events.push({
      id: nextId(),
      date: classRecords[0]?.class_date || '',
      type: 'ipa',
      icon: '🎵',
      label: '完成国际音标学习',
    })
  }

  // 3. 阅读进度晋级：reading_progress 格式 "初中B级,12"
  if (student.reading_progress) {
    events.push({
      id: nextId(),
      date: classRecords[0]?.class_date || '',
      type: 'reading_level',
      icon: '📖',
      label: `阅读训练：${student.reading_progress}`,
    })
  }

  // 4. 按月汇总课时
  const monthlyMap = new Map<string, { count: number; lastDate: string }>()
  classRecords.forEach(r => {
    const month = r.class_date.substring(0, 7)
    const existing = monthlyMap.get(month)
    if (existing) {
      existing.count++
      if (r.class_date > existing.lastDate) existing.lastDate = r.class_date
    } else {
      monthlyMap.set(month, { count: 1, lastDate: r.class_date })
    }
  })
  monthlyMap.forEach((info, month) => {
    if (info.count > 0) {
      events.push({
        id: nextId(),
        date: info.lastDate,
        type: 'monthly_summary',
        icon: '📊',
        label: `${month} 月共上课 ${info.count} 节`,
      })
    }
  })

  return events.sort((a, b) => a.date.localeCompare(b.date))
}

export function GrowthPanel({ studentId }: { studentId: string }) {
  const currentStudent = useAppStore(s => s.currentStudent)
  const classRecords = useAppStore(s => s.classRecords)
  const loadClassRecords = useAppStore(s => s.loadClassRecords)
  const wordbanks = useAppStore(s => s.wordbanks)

  const [progress, setProgress] = useState<StudentWordbankProgress[]>([])
  const [notes, setNotes] = useState<Awaited<ReturnType<typeof growthNoteDb.getByStudentId>>>([])
  const [exporting, setExporting] = useState(false)

  const loadData = useCallback(async () => {
    if (!studentId) return
    loadClassRecords(studentId)
    const [p, n] = await Promise.all([
      progressDb.getByStudentId(studentId),
      growthNoteDb.getByStudentId(studentId),
    ])
    setProgress(p)
    setNotes(n)
  }, [studentId, loadClassRecords])

  useEffect(() => {
    loadData()
  }, [loadData])

  const autoEvents = useMemo(() => {
    if (!currentStudent) return []
    return deriveAutoEvents(currentStudent, classRecords, progress, wordbanks)
  }, [currentStudent, classRecords, progress, wordbanks])

  const allEvents = useMemo((): TimelineEvent[] => {
    const manual: TimelineEvent[] = notes.map(n => ({
      id: `note-${n.id}`,
      date: n.note_date,
      type: 'manual_note',
      label: CATEGORY_LABELS[n.category] || n.category,
      icon: '📝',
      category: n.category,
      content: n.content,
      isManual: true,
      noteId: n.id,
    }))
    return [...autoEvents, ...manual].sort((a, b) => b.date.localeCompare(a.date))
  }, [autoEvents, notes])

  const handleSaveNote = async (data: { student_id: string; note_date: string; category: string; content: string }) => {
    try {
      await growthNoteDb.create({
        student_id: data.student_id,
        note_date: data.note_date,
        category: data.category as 'semester_summary' | 'attitude' | 'parent_comm' | 'highlight',
        content: data.content,
      })
      const updated = await growthNoteDb.getByStudentId(studentId)
      setNotes(updated)
      toast.success('成长记录已添加')
    } catch {
      toast.error('保存失败')
    }
  }

  const handleEditNote = async (id: string, data: { note_date: string; category: string; content: string }) => {
    try {
      await growthNoteDb.update(id, data)
      const updated = await growthNoteDb.getByStudentId(studentId)
      setNotes(updated)
      toast.success('已更新')
    } catch {
      toast.error('更新失败')
    }
  }

  const handleDeleteNote = async (id: string) => {
    try {
      await growthNoteDb.delete(id)
      setNotes(prev => prev.filter(n => n.id !== id))
      toast.success('已删除')
    } catch {
      toast.error('删除失败')
    }
  }

  const handleExportReport = async () => {
    if (!currentStudent) return
    setExporting(true)
    try {
      const html = generateGrowthReportHTML({
        student: currentStudent,
        classRecords,
        progress,
        wordbanks,
        notes,
      })
      const w = window.open('', '_blank')
      if (w) {
        w.document.write(html)
        w.document.close()
        w.onload = () => w.print()
      }
    } catch (e) {
      toast.error('生成报告失败：' + (e as Error).message)
    } finally {
      setExporting(false)
    }
  }

  if (!currentStudent) return null

  return (
    <div className="space-y-4">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">成长时间线</h3>
        <Button variant="outline" size="sm" disabled={exporting} onClick={handleExportReport}>
          {exporting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileDown className="w-4 h-4 mr-1" />}
          生成家长报告
        </Button>
      </div>

      {/* 手动记录表单 */}
      <NoteForm studentId={studentId} onSave={handleSaveNote} />

      {/* 时间线 */}
      <GrowthTimeline
        events={allEvents}
        onEditNote={handleEditNote}
        onDeleteNote={handleDeleteNote}
      />
    </div>
  )
}

const CATEGORY_LABELS: Record<string, string> = {
  semester_summary: '学期总结',
  attitude: '学习态度观察',
  parent_comm: '家长沟通记录',
  highlight: '特别亮点',
}
