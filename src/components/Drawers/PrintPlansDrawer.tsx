import { useState, useEffect, useMemo } from 'react'
import { FileDown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DrawerShell } from '@/components/ui/drawer-shell'
import { useAppStore } from '@/store/appStore'
import { lessonPlanDb } from '@/db'
import { parseTasks } from '@/db/utils'
import { TASK_TYPE_LABELS } from '@/types'
import type { Student, LessonPlan, TaskBlock as TaskBlockType } from '@/types'
import { StudentSelectionGrid, StudentWithPlan } from './PrintPlans/StudentSelectionGrid'
import { PrintSettingsPanel } from './PrintPlans/PrintSettingsPanel'
import { PrintPreview } from './PrintPlans/PrintPreview'

type PrintPlansDrawerProps =
  | { fullPage: true }
  | { fullPage?: false; open: boolean; onClose: () => void }

export function PrintPlansDrawer(props: PrintPlansDrawerProps) {
  const fullPage = 'fullPage' in props ? props.fullPage : false
  const open = 'open' in props ? props.open : true
  const onClose = 'onClose' in props ? props.onClose : () => {}
  const students = useAppStore(s => s.students)
  const loadStudents = useAppStore(s => s.loadStudents)

  const [studentsWithPlans, setStudentsWithPlans] = useState<StudentWithPlan[]>([])
  const [filterGrade, setFilterGrade] = useState<string>('all')
  const [searchName, setSearchName] = useState('')
  const [layout, setLayout] = useState<number>(2)
  const [plansPerStudent, setPlansPerStudent] = useState<number>(2)
  const [showAssistantTips, setShowAssistantTips] = useState(false)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (open) {
      loadStudents()
    }
  }, [open])

  useEffect(() => {
    if (open && students.length > 0) loadPlansForStudents()
  }, [open, students])

  const loadPlansForStudents = async () => {
    setLoading(true)
    const activeStudents = students.filter(s => s.status === 'active')
    const results: StudentWithPlan[] = await Promise.all(
      activeStudents.map(async (student) => {
        const plans = await lessonPlanDb.getByStudentId(student.id)
        return { student, plans: plans.slice(0, 4), selected: false }
      })
    )
    setStudentsWithPlans(results)
    setLoading(false)
  }

  const filteredStudents = useMemo(() => {
    return studentsWithPlans.filter(item => {
      if (filterGrade !== 'all' && item.student.grade !== filterGrade) return false
      if (searchName && !item.student.name.includes(searchName)) return false
      return true
    })
  }, [studentsWithPlans, filterGrade, searchName])

  const selectedStudents = useMemo(() => studentsWithPlans.filter(item => item.selected), [studentsWithPlans])

  const toggleStudent = (studentId: string) => {
    setStudentsWithPlans(prev => prev.map(item =>
      item.student.id === studentId ? { ...item, selected: !item.selected } : item
    ))
  }

  const toggleSelectAll = () => {
    const allSelected = filteredStudents.every(item => item.selected)
    const filteredIds = new Set(filteredStudents.map(item => item.student.id))
    setStudentsWithPlans(prev => prev.map(item =>
      filteredIds.has(item.student.id) ? { ...item, selected: !allSelected } : item
    ))
  }

  const grades = useMemo(() => {
    const gradeSet = new Set(students.filter(s => s.status === 'active').map(s => s.grade).filter(Boolean))
    return Array.from(gradeSet).sort()
  }, [students])

  // 快速导出（原有网格布局）
  const handleQuickExport = async () => {
    if (selectedStudents.length === 0) return
    setExporting(true)
    try {
      const cards: string[] = []
      selectedStudents.forEach(item => {
        if (item.plans.length === 0) {
          cards.push(generateGridCard(item.student, null))
        } else {
          item.plans.slice(0, plansPerStudent).forEach(plan => {
            cards.push(generateGridCard(item.student, plan))
          })
        }
      })
      const cols = layout
      const perPage = cols * 5
      const html = generateGridHTML(cards, cols, perPage)
      openPrintWindow(html)
    } catch (error) {
      toast.error('导出失败：' + (error as Error).message)
    } finally {
      setExporting(false)
    }
  }

  const openPrintWindow = (html: string) => {
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.onload = () => printWindow.print()
    }
  }

  // 网格布局 HTML 生成（保留原有逻辑）
  const generateGridCard = (student: Student, plan: LessonPlan | null): string => {
    if (!plan) {
      return `<div class="plan-card"><div class="card-header"><span class="student-name">${student.name}</span></div><div class="no-plan">暂无计划</div></div>`
    }
    const tasks = parseTasks(plan.tasks)
    const tasksHtml = tasks.map((task: TaskBlockType, i: number) => {
      const typeLabel = TASK_TYPE_LABELS[task.type] || task.type
      let content = ''
      if (task.content) content = task.content
      else if (['vocab_new', 'vocab_review'].includes(task.type) && task.wordbank_label) {
        content = task.wordbank_label
        if (task.level_from && task.level_to) content += ` 第${task.level_from}-${task.level_to}关`
      }
      const taskText = content ? `${typeLabel}：${content}` : typeLabel
      return `<div class="task-line"><span class="task-no">${i + 1}.</span><span class="task-content">${taskText}</span></div>`
    }).join('')
    return `<div class="plan-card"><div class="card-header"><span class="student-name">${student.name} ${student.grade || ''}</span><span class="plan-date">Period ______: ${plan.plan_date || '未定'}</span></div><div class="tasks">${tasksHtml}</div>${showAssistantTips && plan.notes ? `<div style="font-size:9px;color:#666;margin-top:4px;padding-top:4px;border-top:1px dashed #ddd">提示：${plan.notes}</div>` : ''}</div>`
  }

  const generateGridHTML = (cards: string[], cols: number, perPage: number): string => {
    const pages: string[] = []
    for (let i = 0; i < cards.length; i += perPage) {
      const pageCards = cards.slice(i, i + perPage)
      while (pageCards.length < perPage) pageCards.push('<div class="plan-card"></div>')
      pages.push(`<div class="page">${pageCards.join('')}</div>`)
    }
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>课程计划打印</title><style>*{margin:0;padding:0;box-sizing:border-box}@page{size:A4;margin:4mm}body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;font-size:15px;line-height:1.6;background:white}.page{width:210mm;padding:2mm;page-break-after:always;display:grid;grid-template-columns:repeat(${cols},1fr);gap:4mm}.page:last-child{page-break-after:auto}.plan-card{border:2px solid #333;border-radius:6px;padding:14px 16px;page-break-inside:avoid;overflow:hidden;font-size:15px;min-height:80px}.card-header{display:flex;justify-content:space-between;align-items:center;padding-bottom:8px;border-bottom:1px solid #ddd;margin-bottom:8px}.student-name{font-size:14px;font-weight:600}.plan-date{font-size:18px;color:#666}.task-line{display:flex;align-items:flex-start;gap:4px;font-size:15px;line-height:1.6;margin-bottom:4px}.task-no{min-width:18px;font-weight:500}.task-content{flex:1}.no-plan{color:#999;text-align:center;padding:20px;font-size:12px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>${pages.join('')}</body></html>`
  }

  const handleClose = () => {
    setStudentsWithPlans(prev => prev.map(item => ({ ...item, selected: false })))
    setSearchName('')
    setFilterGrade('all')
    onClose()
  }

  // 内容区域（fullPage 和 drawer 共用）
  const settingsContent = (
    <>
      <div className="flex-1 overflow-auto">
        <StudentSelectionGrid
          filteredStudents={filteredStudents}
          loading={loading}
          grades={grades}
          filterGrade={filterGrade}
          searchName={searchName}
          selectedCount={selectedStudents.length}
          selectedWithPlansCount={selectedStudents.filter(s => s.plans.length > 0).length}
          onFilterGradeChange={setFilterGrade}
          onSearchNameChange={setSearchName}
          onToggleStudent={toggleStudent}
          onToggleSelectAll={toggleSelectAll}
        />
        <PrintSettingsPanel
          layout={layout}
          plansPerStudent={plansPerStudent}
          showAssistantTips={showAssistantTips}
          onLayoutChange={setLayout}
          onPlansPerStudentChange={setPlansPerStudent}
          onShowAssistantTipsChange={setShowAssistantTips}
        />
        <PrintPreview
          selectedStudents={selectedStudents}
          layout={layout}
          plansPerStudent={plansPerStudent}
        />
      </div>
      <div className="h-16 border-t flex items-center justify-between px-6 shrink-0">
        <Button variant="outline" onClick={handleClose}>取消</Button>
        <div className="flex items-center gap-2">
          <Button onClick={handleQuickExport} disabled={selectedStudents.length === 0 || exporting}>
            {exporting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />导出中...</> : <><FileDown className="w-4 h-4 mr-2" />快速导出 ({selectedStudents.filter(s => s.plans.length > 0).length} 份)</>}
          </Button>
        </div>
      </div>
    </>
  )

  return (
    <DrawerShell
      open={open}
      fullPage={fullPage}
      title="批量导出课程计划"
      icon={<FileDown className="w-5 h-5 text-primary" />}
      width="w-[700px]"
      onClose={handleClose}
    >
      {settingsContent}
    </DrawerShell>
  )
}
