import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { Trash2, Calendar, Sparkles, Printer, CalendarX, RefreshCw, Copy, PanelRightClose, PanelRightOpen, ChevronDown, ChevronUp, BookOpen, Plus, Library } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PromptDialog } from '@/components/ui/dialog'
import { PlanEditor } from '@/components/PlanEditor/PlanEditor'
import { AIPlanGenerator } from '@/components/PlanEditor/AIPlanGenerator'
import { RefPanel } from '@/components/PlanEditor/RefPanel'
import { TemplatePickerDialog } from '@/components/PlanEditor/TemplatePickerDialog'
import { PlanningOverview } from './PlanningOverview'
import { useAppStore } from '@/store/appStore'
import { sendAIRequestStream } from '@/ai/client'
import { buildUserInput, parseAIResponse, getSystemPrompt } from '@/ai/prompts'
import { printLessonPlan } from '@/utils/pdfExport'
import { formatLocalDate, cn } from '@/lib/utils'
import type { PlanStatus } from '@/types'

interface PlansTabProps {
  studentId: string
}

export function PlansTab({ studentId }: PlansTabProps) {
  const currentStudent = useAppStore(s => s.currentStudent)
  const currentProgress = useAppStore(s => s.currentProgress)
  const wordbanks = useAppStore(s => s.wordbanks)

  // 从 Store 读取课程计划相关状态
  const lessonPlans = useAppStore(s => s.lessonPlans)
  const expiredPlans = useAppStore(s => s.expiredPlans)
  const recentRecords = useAppStore(s => s.recentRecords)
  const aiConfig = useAppStore(s => s.aiConfig)

  // 从 Store 获取操作方法
  const loadLessonPlans = useAppStore(s => s.loadLessonPlans)
  const loadExpiredPlans = useAppStore(s => s.loadExpiredPlans)
  const loadRecentRecords = useAppStore(s => s.loadRecentRecords)
  const loadAIConfig = useAppStore(s => s.loadAIConfig)
  const getLastPlanSummary = useAppStore(s => s.getLastPlanSummary)
  const createLessonPlan = useAppStore(s => s.createLessonPlan)
  const updateLessonPlan = useAppStore(s => s.updateLessonPlan)
  const deleteLessonPlan = useAppStore(s => s.deleteLessonPlan)

  const [generatingPlan, setGeneratingPlan] = useState(false)
  const [streamContent, setStreamContent] = useState('')
  const [extraInstruction, setExtraInstruction] = useState('')
  const [showPlanGenerator, setShowPlanGenerator] = useState(false)
  const [planStatus, setPlanStatus] = useState<PlanStatus | null>(null)

  const [showTemplatePicker, setShowTemplatePicker] = useState(false)

  // 参考面板状态
  const [showRefPanel, setShowRefPanel] = useState(true)
  const [mobileRefExpanded, setMobileRefExpanded] = useState(false)

  // 学习规划折叠状态
  const [planningOpen, setPlanningOpen] = useState(false)

  // PromptDialog 状态
  const [promptState, setPromptState] = useState<{
    open: boolean
    title: string
    defaultValue: string
    onConfirm: ((value: string) => void) | null
  }>({ open: false, title: '', defaultValue: '', onConfirm: null })

  const showPrompt = (
    title: string,
    defaultValue: string,
    onConfirm: (value: string) => void
  ) => {
    setPromptState({ open: true, title, defaultValue, onConfirm })
  }

  useEffect(() => {
    loadLessonPlans(studentId)
    loadExpiredPlans(studentId)
    loadRecentRecords(studentId)
    loadAIConfig()
  }, [studentId])

  // 刷新计划列表（供 PlanEditor 回调使用）
  const refreshPlans = async () => {
    await loadLessonPlans(studentId)
    await loadExpiredPlans(studentId)
  }

  const handleGeneratePlan = async () => {
    if (!aiConfig || !currentStudent) return

    setGeneratingPlan(true)
    setStreamContent('')

    try {
      // 尝试获取完整的大纲数据（含里程碑），注入到 AI 输入
      let promptData = undefined
      try {
        if (window.electronAPI?.buildPromptData) {
          promptData = await window.electronAPI.buildPromptData(studentId)
        }
      } catch { /* 无大纲数据时降级到旧格式 */ }

      const lastPlanSummary = await getLastPlanSummary(studentId)

      const userInput = buildUserInput({
        student: currentStudent,
        wordbankProgress: currentProgress,
        wordbanks,
        recentRecords,
        lastPlanSummary,
        extraInstruction,
        promptData,
      })

      const systemPrompt = await getSystemPrompt()

      let fullContent = ''
      for await (const chunk of sendAIRequestStream(aiConfig, systemPrompt, userInput)) {
        fullContent += chunk
        setStreamContent(fullContent)
      }

      const parsed = parseAIResponse(fullContent)

      if (parsed) {
        const today = new Date().toISOString().split('T')[0]
        const newPlan = await createLessonPlan({
          student_id: studentId,
          plan_date: today,
          tasks: parsed.tasks,
          notes: parsed.notes,
          ai_reason: parsed.reason,
          generated_by_ai: true
        })

        // 将 plan_status 写入刚创建的 lesson_plans 记录（不再创建空 class_records）
        if (parsed.planStatus && newPlan && window.electronAPI?.dbQuery) {
          try {
            await window.electronAPI.dbQuery(
              `UPDATE lesson_plans SET plan_status_json = ? WHERE id = ?`,
              [JSON.stringify(parsed.planStatus), newPlan.id]
            )
          } catch (e) {
            console.warn('[PlansTab] 写入 plan_status 失败:', e)
          }
        }

        setPlanStatus(parsed.planStatus)
        setShowPlanGenerator(false)
        setStreamContent('')
        setExtraInstruction('')
        toast.success('课程计划已生成')
      } else {
        toast.error('AI 响应格式错误，请重试')
      }
    } catch (error) {
      toast.error('生成失败：' + (error as Error).message)
    }

    setGeneratingPlan(false)
  }


  if (!currentStudent) return null

  return (
    <>
      {/* 移动端：顶部可展开参考面板 */}
      <div className="lg:hidden mb-4">
        <button
          onClick={() => setMobileRefExpanded(!mobileRefExpanded)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/50 rounded-lg border text-sm font-medium text-muted-foreground hover:bg-muted/70 transition-colors"
        >
          <span className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            参考信息
            {currentStudent.notes && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
          </span>
          {mobileRefExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {mobileRefExpanded && (
          <div className="mt-2 p-4 bg-card border rounded-lg">
            <RefPanel
              student={currentStudent}
              progress={currentProgress}
              wordbanks={wordbanks}
              recentRecords={recentRecords}
            />
          </div>
        )}
      </div>

      <div className="flex gap-6">
        {/* 左侧：课程计划主区域 */}
        <div className={cn("flex-1 min-w-0 space-y-6", showRefPanel && "lg:mr-0")}>
        {/* AI 生成计划区域 */}
        {showPlanGenerator ? (
          <AIPlanGenerator
            student={currentStudent}
            progress={currentProgress}
            wordbanks={wordbanks}
            aiConfig={aiConfig}
            generating={generatingPlan}
            streamContent={streamContent}
            planStatus={planStatus}
            extraInstruction={extraInstruction}
            onExtraInstructionChange={setExtraInstruction}
            onGenerate={handleGeneratePlan}
            onCancel={() => {
              setShowPlanGenerator(false)
              setStreamContent('')
              setExtraInstruction('')
            }}
          />
        ) : (
          <>
            {/* 新建按钮 */}
            <div className="flex justify-end gap-3 flex-wrap">
              <Button variant="default" onClick={async () => {
                const today = new Date().toISOString().split('T')[0]
                await createLessonPlan({
                  student_id: studentId,
                  plan_date: today,
                  tasks: [],
                  notes: '',
                  generated_by_ai: false
                })
                toast.success('空白课程设计已创建，点击卡片开始编辑')
              }}>
                <Plus className="w-4 h-4 mr-1" />
                新增课程设计
              </Button>
              <Button variant="outline" onClick={() => setShowTemplatePicker(true)}>
                <Library className="w-4 h-4 mr-1" />
                从模板创建
              </Button>
              <Button variant="outline" onClick={() => setShowPlanGenerator(true)}>
                <Sparkles className="w-4 h-4 mr-1" />
                AI 生成计划
              </Button>
            </div>
            
            {/* 学习规划（折叠卡片） */}
            <div className="border rounded-lg bg-card">
              <button
                onClick={() => setPlanningOpen(!planningOpen)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-muted/50 transition-colors rounded-lg"
              >
                <span className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  学习规划
                </span>
                <ChevronDown className={cn("w-4 h-4 transition-transform", planningOpen && "rotate-180")} />
              </button>
              {planningOpen && (
                <div className="px-4 pb-4">
                  <PlanningOverview studentId={studentId} />
                </div>
              )}
            </div>

            {/* 过期计划警告 */}
            {expiredPlans.length > 0 && (
              <Card className="border-orange-300 bg-orange-50/50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <CalendarX className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium text-orange-700 mb-2">
                        有 {expiredPlans.length} 个过期未执行的课程计划
                      </h4>
                      <div className="space-y-2">
                        {expiredPlans.map(plan => (
                          <div key={plan.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-orange-200">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Calendar className="w-4 h-4 text-orange-500" />
                                <span className="font-medium">{plan.plan_date}</span>
                                <span className="text-xs text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">已过期</span>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {plan.tasks.slice(0, 3).map((task, idx) => (
                                  <span key={idx} className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                    {task.wordbank_label || task.content || task.type}
                                  </span>
                                ))}
                                {plan.tasks.length > 3 && (
                                  <span className="text-xs text-muted-foreground">+{plan.tasks.length - 3}更多</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 ml-3">
                              <Button
                                variant="outline"
                                size="sm"
                                title="改期"
                                onClick={() => {
                                  showPrompt('请输入新的计划日期 (YYYY-MM-DD):', formatLocalDate(new Date()), async (newDate) => {
                                    if (newDate) {
                                      await updateLessonPlan(plan.id, { plan_date: newDate })
                                    }
                                  })
                                }}
                              >
                                <RefreshCw className="w-4 h-4 mr-1" />
                                改期
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                title="沿用到新计划"
                                onClick={() => {
                                  showPrompt('请输入新计划的日期 (YYYY-MM-DD):', formatLocalDate(new Date()), async (newDate) => {
                                    if (newDate) {
                                      await createLessonPlan({
                                        student_id: studentId,
                                        plan_date: newDate,
                                        tasks: plan.tasks,
                                        notes: plan.notes || undefined,
                                        generated_by_ai: false
                                      })
                                      await deleteLessonPlan(plan.id)
                                    }
                                  })
                                }}
                              >
                                <Copy className="w-4 h-4 mr-1" />
                                沿用
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={async () => {
                                  const confirmed = await confirmDialog({
                                    title: '删除过期计划',
                                    message: '确定要删除这个过期计划吗？',
                                    confirmText: '删除',
                                    variant: 'danger'
                                  })
                                  if (confirmed) {
                                    await deleteLessonPlan(plan.id)
                                    toast.success('过期计划已删除')
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* 课程计划列表 — 使用共享 PlanEditor 组件 */}
            <PlanEditor
              studentId={studentId}
              plans={lessonPlans}
              onPlansChange={refreshPlans}
              wordbanks={wordbanks}
              renderCardActions={(plan) => (
                <>
                  <Button variant="ghost" size="sm" title="复制" onClick={async () => {
                    await createLessonPlan({
                      student_id: studentId,
                      plan_date: new Date().toISOString().split('T')[0],
                      tasks: plan.tasks,
                      notes: plan.notes || undefined,
                      generated_by_ai: false
                    })
                  }}>
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" title="打印" onClick={() => printLessonPlan(currentStudent!, plan)}>
                    <Printer className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={async () => {
                    const confirmed = await confirmDialog({
                      title: '删除课程计划',
                      message: '确定删除此课程计划？',
                      confirmText: '删除',
                      variant: 'danger'
                    })
                    if (confirmed) {
                      await deleteLessonPlan(plan.id)
                      toast.success('课程计划已删除')
                    }
                  }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </>
              )}
            />
          </>
        )}
        </div>

        {/* 右侧：参考信息面板（桌面端） */}
        <div className={cn(
          "hidden lg:block flex-shrink-0 transition-all duration-300",
          showRefPanel ? "w-72 xl:w-80" : "w-0 overflow-hidden"
        )}>
          {showRefPanel && (
            <div className="sticky top-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  📋 参考信息
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  title="收起参考面板"
                  onClick={() => setShowRefPanel(false)}
                >
                  <PanelRightClose className="w-4 h-4" />
                </Button>
              </div>
              <div className="border rounded-lg p-4 bg-card">
                <RefPanel
                  student={currentStudent}
                  progress={currentProgress}
                  wordbanks={wordbanks}
                  recentRecords={recentRecords}
                />
              </div>
            </div>
          )}
        </div>

        {/* 面板收起时的展开按钮 */}
        {!showRefPanel && (
          <div className="hidden lg:flex flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              title="展开参考面板"
              onClick={() => setShowRefPanel(true)}
            >
              <PanelRightOpen className="w-4 h-4 mr-1" />
              <span className="text-xs">参考</span>
            </Button>
          </div>
        )}
      </div>

      <PromptDialog
        open={promptState.open}
        title={promptState.title}
        defaultValue={promptState.defaultValue}
        onConfirm={(value) => {
          promptState.onConfirm?.(value)
          setPromptState({ open: false, title: '', defaultValue: '', onConfirm: null })
        }}
        onCancel={() =>
          setPromptState({ open: false, title: '', defaultValue: '', onConfirm: null })
        }
      />

      <TemplatePickerDialog
        open={showTemplatePicker}
        onOpenChange={setShowTemplatePicker}
        onSelect={async (template) => {
          setShowTemplatePicker(false)
          const today = new Date().toISOString().split('T')[0]
          await createLessonPlan({
            student_id: studentId,
            plan_date: today,
            tasks: template.tasks,
            notes: template.notes,
            generated_by_ai: false
          })
          toast.success(`已从「${template.name}」模板创建课程设计`)
        }}
      />
    </>
  )
}
