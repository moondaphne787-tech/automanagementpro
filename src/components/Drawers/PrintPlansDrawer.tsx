import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, FileDown, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useAppStore } from '@/store/appStore'
import { lessonPlanDb } from '@/db'
import { cn } from '@/lib/utils'
import { TASK_TYPE_LABELS } from '@/types'
import type { Student, LessonPlan, TaskBlock as TaskBlockType } from '@/types'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

interface PrintPlansDrawerProps {
  open: boolean
  onClose: () => void
}

interface StudentWithPlan {
  student: Student
  plan: LessonPlan | null
  selected: boolean
}

// 每张纸排数选项
const LAYOUT_OPTIONS = [
  { value: '2', label: '每张 2 个' },
  { value: '4', label: '每张 4 个' },
  { value: '6', label: '每张 6 个' },
  { value: '10', label: '每张 10 个' },
]

export function PrintPlansDrawer({ open, onClose }: PrintPlansDrawerProps) {
  const { students, loadStudents } = useAppStore()
  
  const [studentsWithPlans, setStudentsWithPlans] = useState<StudentWithPlan[]>([])
  const [filterGrade, setFilterGrade] = useState<string>('all')
  const [searchName, setSearchName] = useState('')
  const [layout, setLayout] = useState<number>(4)
  const [showAssistantTips, setShowAssistantTips] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  
  // 加载学员及其课程计划
  useEffect(() => {
    if (open) {
      loadStudents()
    }
  }, [open])
  
  // 当学员列表加载后，获取他们的课程计划
  useEffect(() => {
    if (open && students.length > 0) {
      loadPlansForStudents()
    }
  }, [open, students])
  
  const loadPlansForStudents = async () => {
    setLoading(true)
    const activeStudents = students.filter(s => s.status === 'active')
    
    const results: StudentWithPlan[] = await Promise.all(
      activeStudents.map(async (student) => {
        const plans = await lessonPlanDb.getByStudentId(student.id)
        const latestPlan = plans.length > 0 ? plans[0] : null
        return {
          student,
          plan: latestPlan,
          selected: false
        }
      })
    )
    
    setStudentsWithPlans(results)
    setLoading(false)
  }
  
  // 过滤学员列表
  const filteredStudents = useMemo(() => {
    return studentsWithPlans.filter(item => {
      if (filterGrade !== 'all' && item.student.grade !== filterGrade) return false
      if (searchName && !item.student.name.includes(searchName)) return false
      return true
    })
  }, [studentsWithPlans, filterGrade, searchName])
  
  // 选中的学员
  const selectedStudents = useMemo(() => {
    return filteredStudents.filter(item => item.selected)
  }, [filteredStudents])
  
  // 切换学员选择
  const toggleStudent = (studentId: string) => {
    setStudentsWithPlans(prev => prev.map(item => 
      item.student.id === studentId ? { ...item, selected: !item.selected } : item
    ))
  }
  
  // 全选/取消全选
  const toggleSelectAll = () => {
    const allSelected = filteredStudents.every(item => item.selected)
    const filteredIds = new Set(filteredStudents.map(item => item.student.id))
    
    setStudentsWithPlans(prev => prev.map(item => 
      filteredIds.has(item.student.id) ? { ...item, selected: !allSelected } : item
    ))
  }
  
  // 按年级全选
  const selectByGrade = (grade: string) => {
    setStudentsWithPlans(prev => {
      const gradeIds = new Set(
        prev.filter(item => item.student.grade === grade).map(item => item.student.id)
      )
      return prev.map(item => 
        gradeIds.has(item.student.id) ? { ...item, selected: true } : item
      )
    })
  }
  
  // 获取布局参数
  const getLayoutParams = (perPage: number) => {
    switch (perPage) {
      case 2: return { cols: 1, rows: 2 }
      case 4: return { cols: 2, rows: 2 }
      case 6: return { cols: 3, rows: 2 }
      case 10: return { cols: 2, rows: 5 }
      default: return { cols: 2, rows: 2 }
    }
  }
  
  // 生成打印HTML
  const generatePrintHTML = (): string => {
    const cards = selectedStudents.map(item => generatePlanCard(item))
    const { cols, rows } = getLayoutParams(layout)
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>课程计划打印</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    @page {
      size: A4;
      margin: 5mm;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 12px;
      line-height: 1.4;
      background: white;
    }
    
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 5mm;
      page-break-after: always;
      display: grid;
      grid-template-columns: repeat(${cols}, 1fr);
      grid-template-rows: repeat(${rows}, 1fr);
      gap: 0;
    }
    
    .page:last-child {
      page-break-after: auto;
    }
    
    .card {
      border: 1px dashed #999;
      padding: 8px;
      display: flex;
      flex-direction: column;
      position: relative;
    }
    
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 6px;
      border-bottom: 1px solid #eee;
      margin-bottom: 6px;
    }
    
    .student-name {
      font-size: 16px;
      font-weight: 600;
    }
    
    .student-info {
      font-size: 11px;
      color: #666;
    }
    
    .plan-date {
      font-size: 11px;
      color: #888;
    }
    
    .tasks-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    
    .task-item {
      display: flex;
      align-items: flex-start;
      gap: 4px;
      padding: 4px 0;
      font-size: 12px;
    }
    
    .task-number {
      font-weight: 500;
      color: #374151;
      min-width: 16px;
    }
    
    .task-type {
      font-size: 11px;
      color: #666;
      margin-right: 4px;
    }
    
    .task-content {
      flex: 1;
      color: #1f2937;
    }
    
    .section-title {
      font-size: 11px;
      font-weight: 500;
      color: #555;
      margin-top: 6px;
      padding-top: 4px;
      border-top: 1px dashed #ddd;
    }
    
    .section-content {
      font-size: 11px;
      color: #666;
      margin-top: 2px;
    }
    
    .no-plan {
      color: #999;
      text-align: center;
      padding: 20px;
    }
    
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  ${generatePages(cards, layout)}
</body>
</html>
    `
  }
  
  // 生成单个计划卡片HTML
  const generatePlanCard = (item: StudentWithPlan): string => {
    const { student, plan } = item
    
    if (!plan) {
      return `
        <div class="card">
          <div class="card-header">
            <div>
              <div class="student-name">${student.name}</div>
              <div class="student-info">${student.grade || '-'}</div>
            </div>
          </div>
          <div class="no-plan">暂无课程计划</div>
        </div>
      `
    }
    
    const tasks = typeof plan.tasks === 'string' ? JSON.parse(plan.tasks) : plan.tasks
    
    const tasksHTML = tasks.map((task: TaskBlockType, index: number) => {
      const typeLabel = TASK_TYPE_LABELS[task.type] || task.type
      
      let content = ''
      if (['vocab_new', 'vocab_review', 'nine_grid'].includes(task.type)) {
        if (task.wordbank_label) {
          content = task.wordbank_label
          if (task.level_from && task.level_to) {
            content += ` 第${task.level_from}-${task.level_to}关`
          }
        }
      } else {
        content = task.content || ''
      }
      
      return `
        <div class="task-item">
          <span class="task-number">${index + 1}.</span>
          <span class="task-type">${typeLabel}</span>
          <span class="task-content">${content}</span>
        </div>
      `
    }).join('')
    
    let assistantTipsHTML = ''
    if (showAssistantTips && plan.notes) {
      assistantTipsHTML = `
        <div class="section-title">助教提示</div>
        <div class="section-content">${plan.notes}</div>
      `
    }
    
    return `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="student-name">${student.name}</div>
            <div class="student-info">${student.grade || '-'}</div>
          </div>
          <div class="plan-date">${plan.plan_date || ''}</div>
        </div>
        <div class="tasks-container">
          ${tasksHTML}
          ${assistantTipsHTML}
        </div>
      </div>
    `
  }
  
  // 生成分页
  const generatePages = (cards: string[], perPage: number): string => {
    const pages: string[] = []
    for (let i = 0; i < cards.length; i += perPage) {
      const pageCards = cards.slice(i, i + perPage)
      pages.push(`<div class="page">${pageCards.join('')}</div>`)
    }
    return pages.join('')
  }
  
  // 导出 PDF
  const handleExportPDF = async () => {
    if (selectedStudents.length === 0) return
    
    setExporting(true)
    
    try {
      // 创建临时容器
      const container = document.createElement('div')
      container.style.position = 'absolute'
      container.style.left = '-9999px'
      container.style.top = '0'
      container.style.width = '210mm'
      container.innerHTML = generatePrintHTML()
      document.body.appendChild(container)
      
      // 使用 html2canvas 截图
      const pages = container.querySelectorAll('.page')
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })
      
      const pageWidth = 210
      const pageHeight = 297
      
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i] as HTMLElement
        
        const canvas = await html2canvas(page, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        })
        
        if (i > 0) {
          doc.addPage()
        }
        
        const imgData = canvas.toDataURL('image/png')
        doc.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight)
      }
      
      // 清理临时容器
      document.body.removeChild(container)
      
      // 保存文件
      const fileName = `课程计划_批量导出_${new Date().toISOString().split('T')[0]}.pdf`
      doc.save(fileName)
    } catch (error) {
      console.error('Export PDF error:', error)
      alert('导出PDF失败：' + (error as Error).message)
    } finally {
      setExporting(false)
    }
  }
  
  // 关闭并重置
  const handleClose = () => {
    setStudentsWithPlans(prev => prev.map(item => ({ ...item, selected: false })))
    setSearchName('')
    setFilterGrade('all')
    onClose()
  }
  
  // 获取所有年级
  const grades = useMemo(() => {
    const gradeSet = new Set(students.filter(s => s.status === 'active').map(s => s.grade).filter(Boolean))
    return Array.from(gradeSet).sort()
  }, [students])
  
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={handleClose}
          />
          
          {/* 抽屉面板 */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-[800px] bg-background border-l shadow-xl z-50 flex flex-col"
          >
            {/* 头部 */}
            <div className="h-16 border-b flex items-center justify-between px-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FileDown className="w-5 h-5 text-primary" />
                批量导出课程计划
              </h2>
              <Button variant="ghost" size="icon" onClick={handleClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            {/* 内容区域 */}
            <div className="flex-1 overflow-auto">
              {/* 学员选择区 */}
              <div className="p-6 border-b">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium">选择学员</h3>
                  <div className="flex gap-2">
                    <Input
                      value={searchName}
                      onChange={(e) => setSearchName(e.target.value)}
                      placeholder="搜索姓名..."
                      className="w-32"
                    />
                    <Select
                      value={filterGrade}
                      options={[
                        { value: 'all', label: '全部年级' },
                        ...grades.map(g => ({ value: g!, label: g! }))
                      ]}
                      onChange={(e) => setFilterGrade(e.target.value)}
                      className="w-28"
                    />
                  </div>
                </div>
                
                {/* 全选按钮 */}
                <div className="flex items-center gap-4 mb-3">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={toggleSelectAll}
                  >
                    {filteredStudents.every(item => item.selected) ? '取消全选' : '全选'}
                  </Button>
                  {grades.map(grade => (
                    <Button
                      key={grade}
                      variant="ghost"
                      size="sm"
                      onClick={() => selectByGrade(grade!)}
                    >
                      {grade}
                    </Button>
                  ))}
                </div>
                
                {/* 学员列表 */}
                <div className="grid grid-cols-5 gap-2 max-h-48 overflow-auto">
                  {loading ? (
                    <div className="col-span-5 flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    filteredStudents.map(item => (
                      <button
                        key={item.student.id}
                        onClick={() => toggleStudent(item.student.id)}
                        className={cn(
                          "px-3 py-2 rounded-lg text-sm text-left transition-colors relative",
                          item.selected 
                            ? "bg-primary/10 text-primary border border-primary/30" 
                            : "bg-muted hover:bg-muted/80",
                          !item.plan && "opacity-60"
                        )}
                      >
                        {item.selected && (
                          <Check className="w-3 h-3 absolute top-1 right-1 text-primary" />
                        )}
                        {item.student.name}
                        <span className="text-xs text-muted-foreground ml-1">
                          {item.student.grade}
                        </span>
                        {!item.plan && (
                          <span className="text-xs text-yellow-600 block">无计划</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
                
                {selectedStudents.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-3">
                    已选择 <span className="text-primary font-medium">{selectedStudents.length}</span> 名学员
                    （{selectedStudents.filter(s => s.plan).length} 人有计划）
                  </p>
                )}
              </div>
              
              {/* 打印设置 */}
              <div className="p-6 border-b space-y-4">
                <h3 className="font-medium">打印设置</h3>
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">每张纸排数</label>
                    <Select
                      value={layout.toString()}
                      options={LAYOUT_OPTIONS}
                      onChange={(e) => setLayout(parseInt(e.target.value))}
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <label className="text-sm text-muted-foreground mb-2 block">显示选项</label>
                    <div className="flex gap-6">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showAssistantTips}
                          onChange={(e) => setShowAssistantTips(e.target.checked)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">显示助教提示</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showNotes}
                          onChange={(e) => setShowNotes(e.target.checked)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">显示备注</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* 预览区域 */}
              <div className="p-6">
                <h3 className="font-medium mb-4">预览效果</h3>
                
                {selectedStudents.length === 0 ? (
                  <div className="bg-muted/50 rounded-lg p-8 text-center text-muted-foreground">
                    请选择学员以预览打印效果
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* 模拟 A4 纸张预览 */}
                    <div className="bg-white border rounded-lg shadow-sm mx-auto" 
                         style={{ 
                           width: '100%', 
                           maxWidth: '595px',
                           aspectRatio: '210/297',
                           padding: '10px',
                           display: 'grid',
                           gridTemplateColumns: layout === 2 ? '1fr' : layout === 10 ? '1fr 1fr' : layout === 4 ? '1fr 1fr' : '1fr 1fr 1fr',
                           gridTemplateRows: layout === 2 ? '1fr' : layout === 10 ? 'repeat(5, 1fr)' : '1fr 1fr',
                           gap: '2px'
                         }}>
                      {selectedStudents.slice(0, layout).map(item => (
                        <div 
                          key={item.student.id}
                          className="border border-dashed border-gray-400 p-2 overflow-hidden text-[8px]"
                        >
                          <div className="flex justify-between items-center border-b border-gray-200 pb-1 mb-1">
                            <div>
                              <span className="font-semibold text-[10px]">{item.student.name}</span>
                              <span className="text-gray-500 ml-1">{item.student.grade}</span>
                            </div>
                            <span className="text-gray-400">{item.plan?.plan_date || ''}</span>
                          </div>
                          
                          {item.plan ? (
                            <div className="space-y-1">
                              {(typeof item.plan.tasks === 'string' ? JSON.parse(item.plan.tasks) : item.plan.tasks).slice(0, 4).map((task: TaskBlockType, idx: number) => {
                                const typeLabel = TASK_TYPE_LABELS[task.type] || task.type
                                
                                // 构建完整任务内容
                                let taskContent = ''
                                if (['vocab_new', 'vocab_review', 'nine_grid'].includes(task.type)) {
                                  if (task.wordbank_label) {
                                    taskContent = task.wordbank_label
                                    if (task.level_from && task.level_to) {
                                      taskContent += ` ${task.level_from}-${task.level_to}关`
                                    }
                                  }
                                } else {
                                  taskContent = task.content || ''
                                }
                                
                                return (
                                  <div key={idx} className="flex items-start gap-1">
                                    <span className="text-[7px] font-medium shrink-0">{idx + 1}.</span>
                                    <span className="text-[7px] text-gray-600 shrink-0">{typeLabel}</span>
                                    <span className="text-[7px] leading-tight">{taskContent}</span>
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <div className="text-gray-400 text-center">暂无计划</div>
                          )}
                        </div>
                      ))}
                    </div>
                    
                    {selectedStudents.length > layout && (
                      <p className="text-sm text-muted-foreground text-center">
                        共 {Math.ceil(selectedStudents.length / layout)} 页，显示第 1 页预览
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {/* 底部操作栏 */}
            <div className="h-16 border-t flex items-center justify-between px-6">
              <Button variant="outline" onClick={handleClose}>
                取消
              </Button>
              <Button
                onClick={handleExportPDF}
                disabled={selectedStudents.length === 0 || exporting}
              >
                {exporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    导出中...
                  </>
                ) : (
                  <>
                    <FileDown className="w-4 h-4 mr-2" />
                    导出 PDF ({selectedStudents.filter(s => s.plan).length} 份)
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}