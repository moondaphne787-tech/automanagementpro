import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, FileDown, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useAppStore } from '@/store/appStore'
import { lessonPlanDb } from '@/db'
import { parseTasks } from '@/db/utils'
import { cn } from '@/lib/utils'
import { TASK_TYPE_LABELS } from '@/types'
import type { Student, LessonPlan, TaskBlock as TaskBlockType } from '@/types'

interface PrintPlansDrawerProps {
  open: boolean
  onClose: () => void
}

interface StudentWithPlan {
  student: Student
  plans: LessonPlan[]   // 改为数组，存最近 N 条
  selected: boolean
}

// 每行学员数选项
const LAYOUT_OPTIONS = [
  { value: '2', label: '每行 2 人（宽松）' },
  { value: '3', label: '每行 3 人（标准）' },
]

// 每位学员卡片内显示的计划数选项
const PLANS_PER_STUDENT_OPTIONS = [
  { value: '1', label: '最近 1 次计划' },
  { value: '2', label: '最近 2 次计划' },
  { value: '3', label: '最近 3 次计划' },
  { value: '4', label: '最近 4 次计划' },
]

export function PrintPlansDrawer({ open, onClose }: PrintPlansDrawerProps) {
  const { students, loadStudents } = useAppStore()
  
  const [studentsWithPlans, setStudentsWithPlans] = useState<StudentWithPlan[]>([])
  const [filterGrade, setFilterGrade] = useState<string>('all')
  const [searchName, setSearchName] = useState('')
  const [layout, setLayout] = useState<number>(2)  // 默认每行2人
  const [plansPerStudent, setPlansPerStudent] = useState<number>(2)  // 默认显示2条计划
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
        const latestPlans = plans.slice(0, 4)  // 取最近 4 条计划
        return {
          student,
          plans: latestPlans,
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
  
  // 获取布局参数（按每行学员数计算）
  const getLayoutParams = (cols: number) => {
    // A4纸高度可容纳的行数（字号变大后，每页可容纳4行）
    return { cols, rows: 4 }
  }
  
  // 生成打印HTML
  const generatePrintHTML = (): string => {
    // 每个计划生成一个独立的卡片
    const cards: string[] = []
    selectedStudents.forEach(item => {
      if (item.plans.length === 0) {
        cards.push(generateSinglePlanCard(item.student, null, 0))
      } else {
        item.plans.slice(0, plansPerStudent).forEach((plan, idx) => {
          cards.push(generateSinglePlanCard(item.student, plan, idx + 1))
        })
      }
    })
    
    const { cols } = getLayoutParams(layout)
    const perPage = cols * 5  // 每页5行
    
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
      margin: 8mm;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 15px;
      line-height: 1.6;
      background: white;
    }
    
    .page {
      width: 210mm;
      padding: 4mm;
      page-break-after: always;
      display: grid;
      grid-template-columns: repeat(${cols}, 1fr);
      gap: 4mm;
    }
    
    .page:last-child {
      page-break-after: auto;
    }
    
    .plan-card {
      border: 2px solid #333;
      border-radius: 6px;
      padding: 14px 16px;
      page-break-inside: avoid;
      overflow: hidden;
      font-size: 15px;
      min-height: 80px;
    }
    
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 8px;
      border-bottom: 1px solid #ddd;
      margin-bottom: 8px;
    }
    
    .student-name {
      font-size: 14px;
      font-weight: 600;
      color: #333;
    }
    
    .plan-date {
      font-size: 18px;
      color: #666;
    }
    
    .task-line {
      display: flex;
      align-items: flex-start;
      gap: 4px;
      font-size: 15px;
      line-height: 1.6;
      margin-bottom: 4px;
    }
    
    .task-no {
      color: #333;
      min-width: 18px;
      font-weight: 500;
    }
    
    .task-content {
      color: #222;
      flex: 1;
    }
    
    .no-plan {
      color: #999;
      text-align: center;
      padding: 20px;
      font-size: 12px;
    }
    
    .plan-label {
      font-size: 11px;
      color: #888;
      background: #f5f5f5;
      padding: 2px 6px;
      border-radius: 3px;
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
  ${generatePages(cards, perPage)}
</body>
</html>
    `
  }
  
  // 生成单个计划的卡片
  const generateSinglePlanCard = (student: Student, plan: LessonPlan | null, planIndex: number): string => {
    if (!plan) {
      return `
        <div class="plan-card">
          <div class="card-header">
            <span class="student-name">${student.name}</span>
            <span class="student-grade">${student.grade || ''}</span>
          </div>
          <div class="no-plan">暂无计划</div>
        </div>
      `
    }
    
    const tasks = parseTasks(plan.tasks)
    const tasksHtml = tasks.map((task: TaskBlockType, i: number) => {
      const typeLabel = TASK_TYPE_LABELS[task.type] || task.type
      let content = ''
      if (['vocab_new', 'vocab_review', 'nine_grid'].includes(task.type)) {
        content = task.wordbank_label || ''
        if (task.level_from && task.level_to) content += ` 第${task.level_from}-${task.level_to}关`
      } else {
        content = task.content || ''
      }
      const taskText = content ? `${typeLabel}：${content}` : typeLabel
      return `<div class="task-line"><span class="task-no">${i + 1}.</span><span class="task-content">${taskText}</span></div>`
    }).join('')
    
    const planLabel = plansPerStudent === 2 ? (planIndex === 1 ? '【第一次】' : '【第二次】') : ''
    
    return `
      <div class="plan-card">
        <div class="card-header">
          <span class="student-name">${student.name} ${student.grade || ''}</span>
          <span class="plan-date">Period      ______:  ${plan.plan_date || '未定'}</span>
        </div>
        <div class="tasks">${tasksHtml}</div>
        ${showAssistantTips && plan.notes ? `<div style="font-size: 9px; color: #666; margin-top: 4px; padding-top: 4px; border-top: 1px dashed #ddd;">提示：${plan.notes}</div>` : ''}
      </div>
    `
  }
  
  // 生成分页
  const generatePages = (cards: string[], perPage: number): string => {
    const pages: string[] = []
    for (let i = 0; i < cards.length; i += perPage) {
      const pageCards = cards.slice(i, i + perPage)
      // 填充空白卡片确保页面完整
      while (pageCards.length < perPage) {
        pageCards.push('<div class="student-card"><div class="no-plan"></div></div>')
      }
      pages.push(`<div class="page">${pageCards.join('')}</div>`)
    }
    return pages.join('')
  }
  
  // 导出 PDF（通过打印功能，支持中文）
  const handleExportPDF = async () => {
    if (selectedStudents.length === 0) return
    
    setExporting(true)
    
    try {
      const html = generatePrintHTML()
      
      // 打开打印窗口，用户可以选择"另存为PDF"
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(html)
        printWindow.document.close()
        printWindow.onload = () => {
          printWindow.print()
        }
      }
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
            className="fixed right-0 top-0 h-full w-[700px] bg-background border-l shadow-xl z-50 flex flex-col"
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
                          item.plans.length === 0 && "opacity-60"
                        )}
                      >
                        {item.selected && (
                          <Check className="w-3 h-3 absolute top-1 right-1 text-primary" />
                        )}
                        {item.student.name}
                        <span className="text-xs text-muted-foreground ml-1">
                          {item.student.grade}
                        </span>
                        {item.plans.length === 0 && (
                          <span className="text-xs text-yellow-600 block">无计划</span>
                        )}
                        {item.plans.length > 0 && (
                          <span className="text-xs text-green-600 block">{item.plans.length}条计划</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
                
                {selectedStudents.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-3">
                    已选择 <span className="text-primary font-medium">{selectedStudents.length}</span> 名学员
                    （{selectedStudents.filter(s => s.plans.length > 0).length} 人有计划）
                  </p>
                )}
              </div>
              
              {/* 打印设置 */}
              <div className="p-6 border-b space-y-4">
                <h3 className="font-medium">打印设置</h3>
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">每行学员数</label>
                    <Select
                      value={layout.toString()}
                      options={LAYOUT_OPTIONS}
                      onChange={(e) => setLayout(parseInt(e.target.value))}
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">每人计划数</label>
                    <Select
                      value={plansPerStudent.toString()}
                      options={PLANS_PER_STUDENT_OPTIONS}
                      onChange={(e) => setPlansPerStudent(parseInt(e.target.value))}
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">显示选项</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showAssistantTips}
                          onChange={(e) => setShowAssistantTips(e.target.checked)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">助教提示</span>
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
                  <div className="flex flex-col items-center">
                    {(() => {
                      const previewCards: Array<{ student: Student, plan: LessonPlan | null, planIndex: number }> = []
                      selectedStudents.slice(0, 8).forEach(item => {
                        if (item.plans.length === 0) {
                          previewCards.push({ student: item.student, plan: null, planIndex: 0 })
                        } else {
                          item.plans.slice(0, plansPerStudent).forEach((plan, idx) => {
                            previewCards.push({ student: item.student, plan, planIndex: idx + 1 })
                          })
                        }
                      })
                      
                      const totalPages = Math.ceil(selectedStudents.reduce((acc, item) => {
                        return acc + (item.plans.length === 0 ? 1 : Math.min(item.plans.length, plansPerStudent))
                      }, 0) / (layout * 5))
                      
                      return (
                        <div className="space-y-3">
                          {/* A4预览容器 - 严格按照A4比例 210:297 */}
                          <div 
                            className="bg-white border-2 border-gray-400 shadow-lg mx-auto"
                            style={{ 
                              width: '297px',
                              height: '420px',
                              padding: '6px',
                              display: 'grid',
                              gridTemplateColumns: layout === 2 ? '1fr 1fr' : '1fr 1fr 1fr',
                              gridAutoRows: '1fr',
                              gap: '5px',
                              alignContent: 'start',
                              boxSizing: 'border-box',
                            }}>
                            {previewCards.slice(0, layout * 5).map((card, idx) => (
                              <div 
                                key={idx}
                                className="border border-gray-400 rounded overflow-hidden flex flex-col"
                              >
                                <div className="flex justify-between items-center border-b border-gray-300 px-2 py-1 bg-gray-50">
                                  <span className="font-bold text-[11px]">{card.student.name}</span>
                                  {card.plan && (
                                    <span className="text-[10px] text-gray-500">
                                      Period      ______:  {card.plan.plan_date || '未定'}
                                    </span>
                                  )}
                                </div>
                                
                                <div className="flex-1 p-1.5 overflow-hidden">
                                  {card.plan ? (
                                    <div className="space-y-0.5">
                                      {parseTasks(card.plan.tasks).slice(0, 3).map((task: TaskBlockType, tIdx: number) => {
                                        const typeLabel = TASK_TYPE_LABELS[task.type] || task.type
                                        let taskContent = ''
                                        if (['vocab_new', 'vocab_review', 'nine_grid'].includes(task.type)) {
                                          if (task.wordbank_label) {
                                            taskContent = task.wordbank_label
                                          }
                                        } else {
                                          taskContent = task.content || ''
                                        }
                                        return (
                                          <div key={tIdx} className="flex items-start gap-0.5">
                                            <span className="text-[8px] font-medium shrink-0">{tIdx + 1}.</span>
                                            <span className="text-[8px] leading-tight">{typeLabel}{taskContent ? `：${taskContent}` : ''}</span>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  ) : (
                                    <div className="text-[8px] text-gray-400 text-center py-2">暂无计划</div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">
                              预览（A4纸比例缩放）
                            </p>
                            {totalPages > 1 && (
                              <p className="text-sm text-muted-foreground">
                                共 {totalPages} 页，显示第 1 页预览
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })()}
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
                    导出 PDF ({selectedStudents.filter(s => s.plans.length > 0).length} 份)
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