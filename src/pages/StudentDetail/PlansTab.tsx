import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { Edit, Trash2, Plus, Calendar, FileText, Sparkles, Printer, Loader2, CalendarX, RefreshCw, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PromptDialog } from '@/components/ui/dialog'
import { TaskBlock } from '@/components/TaskBlock/TaskBlock'
import { useAppStore } from '@/store/appStore'
import { settingsDb, progressDb, classRecordDb, lessonPlanDb } from '@/db'
import { sendAIRequestStream } from '@/ai/client'
import { buildUserInput, parseAIResponse, getSystemPrompt } from '@/ai/prompts'
import { printLessonPlan } from '@/utils/pdfExport'
import { formatLocalDate, cn } from '@/lib/utils'
import { LEVEL_LABELS } from '@/types'
import type { LessonPlan, AIConfig, TaskBlock as TaskBlockType } from '@/types'

interface PlansTabProps {
  studentId: string
}

export function PlansTab({ studentId }: PlansTabProps) {
  const currentStudent = useAppStore(s => s.currentStudent)
  const currentProgress = useAppStore(s => s.currentProgress)
  const wordbanks = useAppStore(s => s.wordbanks)
  const createLessonPlan = useAppStore(s => s.createLessonPlan)
  const deleteLessonPlan = useAppStore(s => s.deleteLessonPlan)

  const [lessonPlans, setLessonPlans] = useState<LessonPlan[]>([])
  const [expiredPlans, setExpiredPlans] = useState<LessonPlan[]>([])
  const [generatingPlan, setGeneratingPlan] = useState(false)
  const [streamContent, setStreamContent] = useState('')
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null)
  const [extraInstruction, setExtraInstruction] = useState('')
  const [showPlanGenerator, setShowPlanGenerator] = useState(false)
  const [editingPlan, setEditingPlan] = useState<LessonPlan | null>(null)
  const [editingPlanTasks, setEditingPlanTasks] = useState<TaskBlockType[]>([])
  const [editingPlanNotes, setEditingPlanNotes] = useState('')
  const [editingPlanDate, setEditingPlanDate] = useState('')

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
    loadLessonPlans()
    loadAIConfig()
  }, [studentId])

  const loadLessonPlans = async () => {
    const plans = await lessonPlanDb.getByStudentId(studentId)
    setLessonPlans(plans)
    const expired = await lessonPlanDb.getExpiredPlans(studentId)
    setExpiredPlans(expired)
  }

  const loadAIConfig = async () => {
    const url = await settingsDb.get('ai_api_url')
    const key = await settingsDb.get('ai_api_key')
    const model = await settingsDb.get('ai_model')
    const temp = await settingsDb.get('ai_temperature')
    const tokens = await settingsDb.get('ai_max_tokens')
    
    if (key) {
      setAiConfig({
        api_url: url || 'https://api.deepseek.com/v1',
        api_key: key,
        model: model || 'deepseek-chat',
        temperature: parseFloat(temp || '0.7'),
        max_tokens: parseInt(tokens || '2048')
      })
    }
  }

  const handleGeneratePlan = async () => {
    if (!aiConfig || !currentStudent) return
    
    setGeneratingPlan(true)
    setStreamContent('')
    
    try {
      const progress = await progressDb.getByStudentId(studentId)
      const recentRecords = await classRecordDb.getByStudentId(studentId, 3)
      const lastPlanSummary = await lessonPlanDb.getLastPlanSummary(studentId)
      
      const userInput = buildUserInput({
        student: currentStudent,
        wordbankProgress: progress,
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
        
        await loadLessonPlans()
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

  const openEditPlan = (plan: LessonPlan) => {
    setEditingPlan(plan)
    setEditingPlanTasks([...plan.tasks])
    setEditingPlanNotes(plan.notes || '')
    setEditingPlanDate(plan.plan_date || '')
  }

  const handleUpdatePlan = async () => {
    if (!editingPlan) return
    
    await lessonPlanDb.update(editingPlan.id, {
      plan_date: editingPlanDate || null,
      tasks: editingPlanTasks,
      notes: editingPlanNotes || null
    })
    
    await loadLessonPlans()
    setEditingPlan(null)
    setEditingPlanTasks([])
    setEditingPlanNotes('')
    setEditingPlanDate('')
  }

  const handleAddPlanTask = () => {
    setEditingPlanTasks([...editingPlanTasks, { type: 'vocab_new' }])
  }

  const handleUpdatePlanTask = (index: number, updatedTask: TaskBlockType) => {
    const newTasks = [...editingPlanTasks]
    newTasks[index] = updatedTask
    setEditingPlanTasks(newTasks)
  }

  const handleDeletePlanTask = (index: number) => {
    const newTasks = editingPlanTasks.filter((_, i) => i !== index)
    setEditingPlanTasks(newTasks)
  }

  if (!currentStudent) return null

  return (
    <>
      <div className="space-y-6">
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
                                      await lessonPlanDb.update(plan.id, { plan_date: newDate })
                                      loadLessonPlans()
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
                                      await lessonPlanDb.create({
                                        student_id: studentId,
                                        plan_date: newDate,
                                        tasks: plan.tasks,
                                        notes: plan.notes || undefined,
                                        generated_by_ai: false
                                      })
                                      await lessonPlanDb.delete(plan.id)
                                      loadLessonPlans()
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
                                    await lessonPlanDb.delete(plan.id)
                                    loadLessonPlans()
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
            
            {/* 课程计划列表 */}
            {lessonPlans.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>暂无课程计划</p>
                <p className="text-sm mt-1">点击「AI 生成计划」创建新计划</p>
              </div>
            ) : (
              <div className="space-y-4">
                {lessonPlans.map((plan) => {
                  const isExpired = expiredPlans.some(ep => ep.id === plan.id)
                  return (
                  <Card key={plan.id} className={cn(isExpired && "border-orange-300 bg-orange-50/30")}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-3 flex-1">
                          {/* 日期和基本信息 */}
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium">{plan.plan_date || '未设定日期'}</span>
                            </div>
                            {plan.generated_by_ai && (
                              <span className="text-xs px-2 py-0.5 rounded bg-purple-500/10 text-purple-600">
                                AI 生成
                              </span>
                            )}
                            {isExpired && (
                              <span className="text-xs px-2 py-0.5 rounded bg-orange-500/10 text-orange-600">
                                已过期
                              </span>
                            )}
                          </div>
                          
                          {/* 任务块 */}
                          <div className="flex flex-wrap gap-2">
                            {plan.tasks.map((task, index) => (
                              <TaskBlock
                                key={index}
                                task={task}
                                index={index}
                              />
                            ))}
                          </div>
                          
                          {/* 助教提示 */}
                          {plan.notes && (
                            <div className="bg-yellow-500/5 border border-yellow-200 rounded p-2">
                              <span className="text-xs text-yellow-700">助教提示：</span>
                              <span className="text-sm">{plan.notes}</span>
                            </div>
                          )}
                          
                          {/* AI 说明 */}
                          {plan.ai_reason && (
                            <div className="bg-blue-500/5 border border-blue-200 rounded p-2">
                              <span className="text-xs text-blue-700">计划说明：</span>
                              <span className="text-sm">{plan.ai_reason}</span>
                            </div>
                          )}
                        </div>
                        
                        {/* 操作按钮 */}
                        <div className="flex items-center gap-2 ml-4">
                          <Button
                            variant="outline"
                            size="sm"
                            title="编辑计划"
                            onClick={() => openEditPlan(plan)}
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            编辑
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            title="复制为新计划"
                            onClick={async () => {
                              await createLessonPlan({
                                student_id: studentId,
                                plan_date: new Date().toISOString().split('T')[0],
                                tasks: plan.tasks,
                                notes: plan.notes || undefined,
                                generated_by_ai: false
                              })
                              loadLessonPlans()
                            }}
                          >
                            <Copy className="w-4 h-4 mr-1" />
                            复制
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="打印 / 导出 PDF"
                            onClick={() => printLessonPlan(currentStudent, plan)}
                          >
                            <Printer className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={async () => {
                              const confirmed = await confirmDialog({
                                title: '删除课程计划',
                                message: '确定删除此课程计划？',
                                confirmText: '删除',
                                variant: 'danger'
                              })
                              if (confirmed) {
                                await deleteLessonPlan(plan.id)
                                loadLessonPlans()
                                toast.success('课程计划已删除')
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  )
                })}
              </div>
            )}
            
            {/* 编辑课程计划表单 */}
            {editingPlan && (
              <Card className="border-blue-300 bg-blue-50/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Edit className="w-4 h-4" />
                    编辑课程计划
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* 计划日期 */}
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">计划日期</label>
                    <Input
                      type="date"
                      value={editingPlanDate}
                      onChange={(e) => setEditingPlanDate(e.target.value)}
                    />
                  </div>
                  
                  {/* 任务列表 */}
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">任务列表</label>
                    <div className="space-y-3">
                      {editingPlanTasks.map((task, index) => (
                        <TaskBlock
                          key={index}
                          task={task}
                          index={index}
                          editable
                          onChange={(updatedTask) => handleUpdatePlanTask(index, updatedTask)}
                          onDelete={() => handleDeletePlanTask(index)}
                          wordbanks={wordbanks}
                        />
                      ))}
                      
                      {editingPlanTasks.length === 0 && (
                        <div className="text-sm text-muted-foreground text-center py-4 border rounded-lg">
                          暂无任务，请添加任务
                        </div>
                      )}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={handleAddPlanTask}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      添加任务
                    </Button>
                  </div>
                  
                  {/* 助教提示 */}
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">助教提示（可选）</label>
                    <Input
                      value={editingPlanNotes}
                      onChange={(e) => setEditingPlanNotes(e.target.value)}
                      placeholder="输入助教提示或备注"
                    />
                  </div>
                  
                  {/* 操作按钮 */}
                  <div className="flex gap-3">
                    <Button onClick={handleUpdatePlan}>
                      保存修改
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setEditingPlan(null)
                        setEditingPlanTasks([])
                        setEditingPlanNotes('')
                        setEditingPlanDate('')
                      }}
                    >
                      取消
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
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