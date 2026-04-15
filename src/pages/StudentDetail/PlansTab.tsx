import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { Trash2, Calendar, Sparkles, Printer, Loader2, CalendarX, RefreshCw, Copy, PanelRightClose, PanelRightOpen, ChevronDown, ChevronUp, StickyNote, BookOpen, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PromptDialog } from '@/components/ui/dialog'
import { PlanEditor } from '@/components/PlanEditor/PlanEditor'
import { useAppStore } from '@/store/appStore'
import { sendAIRequestStream } from '@/ai/client'
import { buildUserInput, parseAIResponse, getSystemPrompt } from '@/ai/prompts'
import { printLessonPlan } from '@/utils/pdfExport'
import { formatLocalDate, cn } from '@/lib/utils'
import { LEVEL_LABELS, TASK_TYPE_LABELS } from '@/types'

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

  // 参考面板状态
  const [showRefPanel, setShowRefPanel] = useState(true)
  const [mobileRefExpanded, setMobileRefExpanded] = useState(false)

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
      const lastPlanSummary = await getLastPlanSummary(studentId)
      
      const userInput = buildUserInput({
        student: currentStudent,
        wordbankProgress: currentProgress,
        wordbanks,
        recentRecords,
        lastPlanSummary,
        extraInstruction
      })
      
      const systemPrompt = await getSystemPrompt()
      
      let fullContent = ''
      for await (const chunk of sendAIRequestStream(aiConfig, systemPrompt, userInput)) {
        fullContent += chunk
        setStreamContent(fullContent)
      }
      
      const parsed = parseAIResponse(fullContent)
      
      if (parsed) {
        await createLessonPlan({
          student_id: studentId,
          plan_date: new Date().toISOString().split('T')[0],
          tasks: parsed.tasks,
          notes: parsed.notes,
          ai_reason: parsed.reason,
          generated_by_ai: true
        })
        
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


  // 参考面板内容渲染
  const renderRefPanelContent = () => (
    <div className="space-y-4">
      {/* 学员备注 */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <StickyNote className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-xs font-medium text-muted-foreground">学员备注</span>
        </div>
        {currentStudent!.notes ? (
          <p className="text-sm bg-amber-500/5 border border-amber-200 rounded-lg p-2.5 leading-relaxed">
            {currentStudent!.notes}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground italic">暂无备注</p>
        )}
      </div>

      {/* 最近课堂记录 */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <BookOpen className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-xs font-medium text-muted-foreground">最近 {recentRecords.length} 次课堂</span>
        </div>
        {recentRecords.length > 0 ? (
          <div className="space-y-2">
            {recentRecords.map(record => (
              <div key={record.id} className="bg-muted/40 rounded-lg p-2.5 text-sm">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-medium text-xs">{record.class_date}</span>
                  <span className={cn(
                    "text-xs px-1.5 py-0.5 rounded",
                    record.task_completed === 'completed' ? 'bg-green-500/10 text-green-600' :
                    record.task_completed === 'partial' ? 'bg-yellow-500/10 text-yellow-600' :
                    'bg-red-500/10 text-red-600'
                  )}>
                    {record.task_completed === 'completed' ? '全部完成' :
                     record.task_completed === 'partial' ? '部分完成' : '未完成'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {record.tasks.map((task, idx) => (
                    <span key={idx} className="text-xs bg-background px-1.5 py-0.5 rounded border">
                      {TASK_TYPE_LABELS[task.type]}
                      {task.content ? `·${task.content.slice(0, 15)}${task.content.length > 15 ? '…' : ''}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">暂无课堂记录</p>
        )}
      </div>

      {/* 词库进度 */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <BarChart3 className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-xs font-medium text-muted-foreground">词库进度</span>
        </div>
        {currentProgress.length > 0 ? (
          <div className="space-y-1.5">
            {currentProgress.map(p => {
              const wb = wordbanks.find(w => w.id === p.wordbank_id)
              const total = p.total_levels_override || wb?.total_levels || 0
              const pct = total > 0 ? Math.round((p.current_level / total) * 100) : 0
              return (
                <div key={p.id} className="text-sm">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs">{p.wordbank_label}</span>
                    <span className="text-xs text-muted-foreground">
                      第 {p.current_level} 关{total > 0 ? ` / ${total}` : ''}
                    </span>
                  </div>
                  {total > 0 && (
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">暂无词库进度</p>
        )}
      </div>
    </div>
  )

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
            {renderRefPanelContent()}
          </div>
        )}
      </div>

      <div className="flex gap-6">
        {/* 左侧：课程计划主区域 */}
        <div className={cn("flex-1 min-w-0 space-y-6", showRefPanel && "lg:mr-0")}>
        {/* AI 生成计划区域 */}
        {showPlanGenerator ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                AI 生成课程计划
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 数据摘要 */}
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="text-sm font-medium mb-2">学员数据摘要</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>年级: {currentStudent.grade || '-'}</div>
                  <div>程度: {LEVEL_LABELS[currentStudent.level]}</div>
                  <div>自然拼读: {currentStudent.phonics_completed ? '已完成' : currentStudent.phonics_progress || '未开始'}</div>
                  <div>国际音标: {currentStudent.ipa_completed ? '已完成' : '未开始'}</div>
                </div>
                {currentProgress.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="text-xs text-muted-foreground mb-1">词库进度:</div>
                    {currentProgress.map(p => (
                      <div key={p.id} className="text-sm">
                        {p.wordbank_label}: 第 {p.current_level} 关
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* 大纲方向 */}
              <div>
                <label className="text-sm text-muted-foreground">大纲方向（可选）</label>
                <Input
                  value={extraInstruction}
                  onChange={(e) => setExtraInstruction(e.target.value)}
                  placeholder="如：本周重点推进词库"
                />
              </div>
              
              {/* 流式输出内容 */}
              {streamContent && (
                <div className="bg-blue-500/5 border border-blue-200 rounded-lg p-4">
                  <div className="text-sm font-medium text-blue-700 mb-2">AI 正在生成...</div>
                  <pre className="text-sm whitespace-pre-wrap font-mono">{streamContent}</pre>
                </div>
              )}
              
              {/* 操作按钮 */}
              <div className="flex gap-3">
                <Button
                  onClick={handleGeneratePlan}
                  disabled={!aiConfig?.api_key || generatingPlan}
                >
                  {generatingPlan ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      开始生成
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => {
                  setShowPlanGenerator(false)
                  setStreamContent('')
                  setExtraInstruction('')
                }}>
                  取消
                </Button>
              </div>
              
              {!aiConfig?.api_key && (
                <p className="text-sm text-yellow-600">
                  请先在「设置」页面配置 AI API Key
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {/* 新建按钮 */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowPlanGenerator(true)}>
                <Sparkles className="w-4 h-4 mr-1" />
                AI 生成计划
              </Button>
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
                {renderRefPanelContent()}
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
    </>
  )
}
