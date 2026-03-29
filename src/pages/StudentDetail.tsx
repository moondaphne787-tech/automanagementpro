import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit, Trash2, Clock, Plus, Calendar, FileText, Sparkles, Download, Printer, Loader2, CalendarX, RefreshCw, Copy, Link, Columns, Target, TrendingUp, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { PromptDialog } from '@/components/ui/dialog'
import { useAppStore } from '@/store/appStore'
import { formatDate, formatHours, isHoursWarning, getLevelColor } from '@/lib/utils'
import { extractFeedbackBeforeNotes } from '@/utils/feedbackParser'
import { LEVEL_LABELS, STATUS_LABELS, STUDENT_TYPE_LABELS, TASK_TYPE_LABELS } from '@/types'
import { TaskBlock } from '@/components/TaskBlock/TaskBlock'
import { ClassRecordForm } from '@/components/ClassRecord/ClassRecordForm'
import { GrowthPanel } from '@/components/Growth/GrowthPanel'
import { StudentForm } from '@/components/Student/StudentForm'
import { settingsDb, progressDb, classRecordDb, lessonPlanDb, learningPhaseDb, studentSchedulePreferenceDb } from '@/db'
import { sendAIRequestStream } from '@/ai/client'
import { buildUserInput, parseAIResponse, getSystemPrompt } from '@/ai/prompts'
import { exportLessonPlanPDF, printLessonPlan } from '@/utils/pdfExport'
import type { Student, Billing, ClassRecord, LessonPlan, AIConfig, TaskBlock as TaskBlockType, LearningPhase, PhaseType, StudentSchedulePreference, DayOfWeek } from '@/types'
import { cn } from '@/lib/utils'
import { formatDate as formatDateUtil } from '@/lib/utils'

type TabType = 'info' | 'wordbank' | 'growth' | 'records' | 'plans'

export function StudentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { 
    currentStudent, 
    currentBilling, 
    currentProgress,
    wordbanks,
    selectStudent, 
    updateStudent, 
    deleteStudent,
    updateBilling,
    loadWordbanks,
    upsertProgress,
    deleteProgress,
    createClassRecord,
    updateClassRecord,
    deleteClassRecord,
    createLessonPlan,
    deleteLessonPlan
  } = useAppStore()
  
  const [tab, setTab] = useState<TabType>('info')
  const [editing, setEditing] = useState(false)
  const [billingForm, setBillingForm] = useState({
    total_hours: '',
    warning_threshold: '3'
  })
  const [showRecordForm, setShowRecordForm] = useState(false)
  const [editingRecord, setEditingRecord] = useState<ClassRecord | null>(null)
  
  // 课程计划相关状态
  const [lessonPlans, setLessonPlans] = useState<LessonPlan[]>([])
  const [generatingPlan, setGeneratingPlan] = useState(false)
  const [streamContent, setStreamContent] = useState('')
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null)
  const [extraInstruction, setExtraInstruction] = useState('')
  const [showPlanGenerator, setShowPlanGenerator] = useState(false)
  
  // 课程计划编辑状态
  const [editingPlan, setEditingPlan] = useState<LessonPlan | null>(null)
  const [editingPlanTasks, setEditingPlanTasks] = useState<TaskBlockType[]>([])
  const [editingPlanNotes, setEditingPlanNotes] = useState('')
  const [editingPlanDate, setEditingPlanDate] = useState('')
  
  // 过期计划状态（通过 plan_id 关联判断，从后端加载）
  const [expiredPlans, setExpiredPlans] = useState<LessonPlan[]>([])
  
  // 课堂记录与计划关联状态
  const [recordsWithPlan, setRecordsWithPlan] = useState<(ClassRecord & { plan?: LessonPlan })[]>([])
  
  // 学情反馈原文展开状态
  const [expandedFeedbackId, setExpandedFeedbackId] = useState<string | null>(null)
  
  // 学习阶段状态
  const [learningPhases, setLearningPhases] = useState<LearningPhase[]>([])
  
  // 偏好时段状态
  const [schedulePreferences, setSchedulePreferences] = useState<StudentSchedulePreference[]>([])
  const [showPreferenceForm, setShowPreferenceForm] = useState(false)
  const [editingPreference, setEditingPreference] = useState<StudentSchedulePreference | null>(null)
  const [preferenceForm, setPreferenceForm] = useState({
    day_of_week: 'monday' as DayOfWeek,
    preferred_start: '09:00',
    preferred_end: '11:00',
    notes: ''
  })
  const [showPhaseForm, setShowPhaseForm] = useState(false)
  const [editingPhase, setEditingPhase] = useState<LearningPhase | null>(null)
  const [phaseForm, setPhaseForm] = useState({
    phase_name: '',
    phase_type: 'semester' as PhaseType,
    start_date: '',
    end_date: '',
    goal: '',
    vocab_start: '',
    vocab_end: '',
    summary: ''
  })
  
  // Prompt dialog state
  const [promptState, setPromptState] = useState<{
    open: boolean
    title: string
    defaultValue: string
    onConfirm: ((value: string) => void) | null
  }>({ open: false, title: '', defaultValue: '', onConfirm: null })
  
  const showPrompt = (title: string, defaultValue: string, onConfirm: (value: string) => void) => {
    setPromptState({ open: true, title, defaultValue, onConfirm })
  }

  // 加载学习阶段
  const loadLearningPhases = async (studentId: string) => {
    const phases = await learningPhaseDb.getByStudentId(studentId)
    setLearningPhases(phases)
  }
  
  // 加载偏好时段
  const loadSchedulePreferences = async (studentId: string) => {
    const prefs = await studentSchedulePreferenceDb.getByStudentId(studentId)
    setSchedulePreferences(prefs)
  }
  
  const loadRecordsWithPlan = async (studentId: string) => {
    const records = await classRecordDb.getWithPlan(studentId)
    setRecordsWithPlan(records)
  }
  
  const loadLessonPlans = async (studentId: string) => {
    const plans = await lessonPlanDb.getByStudentId(studentId)
    setLessonPlans(plans)
    // 通过 plan_id 关联判断过期计划
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

  useEffect(() => {
    if (currentBilling) {
      setBillingForm({
        total_hours: currentBilling.total_hours.toString(),
        warning_threshold: currentBilling.warning_threshold.toString()
      })
    }
  }, [currentBilling])

  const handleDelete = async () => {
    if (confirm('确定要删除此学员吗？此操作不可恢复。')) {
      await deleteStudent(id!)
      navigate('/')
    }
  }

  const handleAddHours = async () => {
    const hours = parseFloat(billingForm.total_hours)
    if (isNaN(hours) || hours <= 0) return
    
    // 确认保护：显示即将增加的课时数，防止误操作
    const confirmMessage = `确定要增加 ${hours} 课时吗？\n\n当前购买课时：${formatHours(currentBilling?.total_hours || 0)}\n增加后：${formatHours((currentBilling?.total_hours || 0) + hours)}`
    if (!confirm(confirmMessage)) return
    
    await updateBilling(id!, { total_hours: (currentBilling?.total_hours || 0) + hours })
    setBillingForm({ ...billingForm, total_hours: '' })
  }

  const handleCreateRecord = async (data: any) => {
    await createClassRecord(data)
    setShowRecordForm(false)
    // 刷新带计划关联的记录
    if (id) {
      loadRecordsWithPlan(id)
    }
  }
  
  const handleUpdateRecord = async (data: any) => {
    if (!editingRecord) return
    await updateClassRecord(editingRecord.id, data)
    setEditingRecord(null)
    // 刷新带计划关联的记录
    if (id) {
      loadRecordsWithPlan(id)
    }
  }
  
  // AI 生成课程计划（流式输出）
  const handleGeneratePlan = async () => {
    if (!aiConfig || !id) return
    
    setGeneratingPlan(true)
    setStreamContent('')
    
    try {
      // 获取学员数据
      const progress = await progressDb.getByStudentId(id)
      const recentRecords = await classRecordDb.getByStudentId(id, 3)
      const lastPlanSummary = await lessonPlanDb.getLastPlanSummary(id)
      
      // 构建用户输入
      const userInput = buildUserInput({
        student: currentStudent!,
        wordbankProgress: progress,
        wordbanks,
        recentRecords,
        lastPlanSummary,
        extraInstruction
      })
      
      // 获取当前生效的系统提示词
      const systemPrompt = await getSystemPrompt()
      
      // 流式调用 AI
      let fullContent = ''
      for await (const chunk of sendAIRequestStream(aiConfig, systemPrompt, userInput)) {
        fullContent += chunk
        setStreamContent(fullContent)
      }
      
      // 解析响应
      const parsed = parseAIResponse(fullContent)
      
      if (parsed) {
        // 保存课程计划
        await createLessonPlan({
          student_id: id,
          plan_date: new Date().toISOString().split('T')[0],
          tasks: parsed.tasks,
          notes: parsed.notes,
          ai_reason: parsed.reason,
          generated_by_ai: true
        })
        
        // 刷新列表
        await loadLessonPlans(id)
        setShowPlanGenerator(false)
        setStreamContent('')
        setExtraInstruction('')
      } else {
        alert('AI 响应格式错误，请重试')
      }
    } catch (error) {
      alert('生成失败：' + (error as Error).message)
    }
    
    setGeneratingPlan(false)
  }
  
  // 获取词库的总关数
  const getWordbankTotalLevels = (wordbankId: string): number => {
    const wordbank = wordbanks.find(w => w.id === wordbankId)
    return wordbank?.total_levels || 999
  }
  
  // 获取词库的总关数（通过名称）
  const getWordbankTotalLevelsByName = (wordbankLabel: string): number => {
    const wordbank = wordbanks.find(w => w.name === wordbankLabel)
    return wordbank?.total_levels || 999
  }

  useEffect(() => {
    if (id) {
      selectStudent(id)
      loadWordbanks()
      loadLessonPlans(id)
      loadAIConfig()
      // expiredPlans 已在 loadLessonPlans 中一并加载
      loadRecordsWithPlan(id)
      loadLearningPhases(id)
      loadSchedulePreferences(id)
      
      // 检查是否需要跳转到特定 tab
      const targetTab = sessionStorage.getItem('studentDetailTab')
      if (targetTab && ['info', 'wordbank', 'growth', 'records', 'plans'].includes(targetTab)) {
        setTab(targetTab as TabType)
        sessionStorage.removeItem('studentDetailTab')
      }
    }
  }, [id])

  if (!currentStudent) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        加载中...
      </div>
    )
  }
  
  const handleCreatePhase = async () => {
    if (!id) return
    await learningPhaseDb.create({
      student_id: id,
      phase_name: phaseForm.phase_name || undefined,
      phase_type: phaseForm.phase_type,
      start_date: phaseForm.start_date || undefined,
      end_date: phaseForm.end_date || undefined,
      goal: phaseForm.goal || undefined,
      vocab_start: phaseForm.vocab_start ? parseInt(phaseForm.vocab_start) : undefined,
      vocab_end: phaseForm.vocab_end ? parseInt(phaseForm.vocab_end) : undefined,
      summary: phaseForm.summary || undefined
    })
    loadLearningPhases(id)
    setShowPhaseForm(false)
    resetPhaseForm()
  }
  
  const handleUpdatePhase = async () => {
    if (!editingPhase || !id) return
    await learningPhaseDb.update(editingPhase.id, {
      phase_name: phaseForm.phase_name || undefined,
      phase_type: phaseForm.phase_type,
      start_date: phaseForm.start_date || undefined,
      end_date: phaseForm.end_date || undefined,
      goal: phaseForm.goal || undefined,
      vocab_start: phaseForm.vocab_start ? parseInt(phaseForm.vocab_start) : undefined,
      vocab_end: phaseForm.vocab_end ? parseInt(phaseForm.vocab_end) : undefined,
      summary: phaseForm.summary || undefined
    })
    loadLearningPhases(id)
    setEditingPhase(null)
    resetPhaseForm()
  }
  
  const handleDeletePhase = async (phaseId: string) => {
    if (!confirm('确定要删除这个学习阶段吗？')) return
    await learningPhaseDb.delete(phaseId)
    if (id) loadLearningPhases(id)
  }
  
  const resetPhaseForm = () => {
    setPhaseForm({
      phase_name: '',
      phase_type: 'semester',
      start_date: '',
      end_date: '',
      goal: '',
      vocab_start: '',
      vocab_end: '',
      summary: ''
    })
  }
  
  // 偏好时段操作
  const handleCreatePreference = async () => {
    if (!id) return
    await studentSchedulePreferenceDb.create({
      student_id: id,
      day_of_week: preferenceForm.day_of_week,
      preferred_start: preferenceForm.preferred_start || undefined,
      preferred_end: preferenceForm.preferred_end || undefined,
      notes: preferenceForm.notes || undefined
    })
    loadSchedulePreferences(id)
    setShowPreferenceForm(false)
    resetPreferenceForm()
  }
  
  const handleUpdatePreference = async () => {
    if (!editingPreference || !id) return
    await studentSchedulePreferenceDb.update(editingPreference.id, {
      day_of_week: preferenceForm.day_of_week,
      preferred_start: preferenceForm.preferred_start || undefined,
      preferred_end: preferenceForm.preferred_end || undefined,
      notes: preferenceForm.notes || undefined
    })
    loadSchedulePreferences(id)
    setEditingPreference(null)
    resetPreferenceForm()
  }
  
  const handleDeletePreference = async (prefId: string) => {
    if (!confirm('确定要删除这个偏好时段吗？')) return
    await studentSchedulePreferenceDb.delete(prefId)
    if (id) loadSchedulePreferences(id)
  }
  
  const resetPreferenceForm = () => {
    setPreferenceForm({
      day_of_week: 'monday',
      preferred_start: '09:00',
      preferred_end: '11:00',
      notes: ''
    })
  }
  
  const openEditPreference = (pref: StudentSchedulePreference) => {
    setEditingPreference(pref)
    setPreferenceForm({
      day_of_week: pref.day_of_week,
      preferred_start: pref.preferred_start || '09:00',
      preferred_end: pref.preferred_end || '11:00',
      notes: pref.notes || ''
    })
  }
  
  const openEditPhase = (phase: LearningPhase) => {
    setEditingPhase(phase)
    setPhaseForm({
      phase_name: phase.phase_name || '',
      phase_type: phase.phase_type,
      start_date: phase.start_date || '',
      end_date: phase.end_date || '',
      goal: phase.goal || '',
      vocab_start: phase.vocab_start?.toString() || '',
      vocab_end: phase.vocab_end?.toString() || '',
      summary: phase.summary || ''
    })
  }
  
  // 课程计划编辑操作
  const openEditPlan = (plan: LessonPlan) => {
    setEditingPlan(plan)
    setEditingPlanTasks([...plan.tasks])
    setEditingPlanNotes(plan.notes || '')
    setEditingPlanDate(plan.plan_date || '')
  }
  
  const handleUpdatePlan = async () => {
    if (!editingPlan || !id) return
    
    await lessonPlanDb.update(editingPlan.id, {
      plan_date: editingPlanDate || null,
      tasks: editingPlanTasks,
      notes: editingPlanNotes || null
    })
    
    loadLessonPlans(id)
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
  
  const tabs: { key: TabType; label: string }[] = [
    { key: 'info', label: '基本信息' },
    { key: 'wordbank', label: '词库进度' },
    { key: 'growth', label: '成长档案' },
    { key: 'records', label: '课堂记录' },
    { key: 'plans', label: '课程计划' },
  ]

  return (
    <div className="h-full flex flex-col">
      {/* 顶部栏 */}
      <header className="h-16 border-b bg-card flex items-center px-6 gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-3">
          <div className={cn("w-3 h-3 rounded-full", getLevelColor(currentStudent.level))} />
          <h1 className="text-lg font-semibold">{currentStudent.name}</h1>
          <span className="text-sm text-muted-foreground">
            {currentStudent.student_no}
          </span>
          {currentStudent.student_type === 'trial' && (
            <span className="trial-badge">体验</span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
            <Edit className="w-4 h-4 mr-1" />
            {editing ? '取消' : '编辑'}
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="w-4 h-4 mr-1" />
            删除
          </Button>
        </div>
      </header>

      {/* Tab导航 */}
      <div className="border-b bg-card">
        <div className="flex px-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
                tab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-auto p-6">
        {editing ? (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>编辑学员信息</CardTitle>
            </CardHeader>
            <CardContent>
              <StudentForm
                student={currentStudent}
                onSubmit={async (data) => {
                  await updateStudent(id!, data)
                  setEditing(false)
                }}
                onCancel={() => setEditing(false)}
              />
            </CardContent>
          </Card>
        ) : tab === 'info' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 基本信息 */}
            <Card>
              <CardHeader>
                <CardTitle>基本信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">学员类型：</span>
                    <span>{STUDENT_TYPE_LABELS[currentStudent.student_type]}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">状态：</span>
                    <span>{STATUS_LABELS[currentStudent.status]}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">年级：</span>
                    <span>{currentStudent.grade || '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">程度：</span>
                    <span>{LEVEL_LABELS[currentStudent.level]}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">学校：</span>
                    <span>{currentStudent.school || '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">入学日期：</span>
                    <span>{formatDate(currentStudent.enroll_date)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">入学成绩：</span>
                    <span>{currentStudent.initial_score || '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">入学词汇量：</span>
                    <span>{currentStudent.initial_vocab || '-'}</span>
                  </div>
                </div>
                {currentStudent.notes && (
                  <div className="pt-3 border-t">
                    <span className="text-muted-foreground text-sm">备注：</span>
                    <p className="text-sm mt-1">{currentStudent.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 课时信息 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  课时信息
                  {currentBilling && isHoursWarning(currentBilling) && (
                    <span className="text-xs text-warning font-normal">（预警中）</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {currentBilling && (
                  <>
                    <div className="grid grid-cols-3 gap-4 text-center py-4 bg-muted/50 rounded-lg">
                      <div>
                        <div className="text-2xl font-semibold">{formatHours(currentBilling.total_hours)}</div>
                        <div className="text-xs text-muted-foreground">购买课时</div>
                      </div>
                      <div>
                        <div className="text-2xl font-semibold">{formatHours(currentBilling.used_hours)}</div>
                        <div className="text-xs text-muted-foreground">已用课时</div>
                      </div>
                      <div>
                        <div className={cn(
                          "text-2xl font-semibold",
                          isHoursWarning(currentBilling) && "text-warning"
                        )}>
                          {formatHours(currentBilling.remaining_hours)}
                        </div>
                        <div className="text-xs text-muted-foreground">剩余课时</div>
                      </div>
                    </div>
                    
                    <div className="flex items-end gap-3">
                      <div className="flex-1">
                        <label className="text-sm text-muted-foreground">增加课时</label>
                        <Input
                          type="number"
                          step="0.5"
                          value={billingForm.total_hours}
                          onChange={(e) => setBillingForm({ ...billingForm, total_hours: e.target.value })}
                          placeholder="输入课时数"
                        />
                      </div>
                      <Button onClick={handleAddHours}>增加</Button>
                    </div>

                    <div className="flex items-end gap-3">
                      <div className="flex-1">
                        <label className="text-sm text-muted-foreground">预警阈值（小时）</label>
                        <Input
                          type="number"
                          step="0.5"
                          value={billingForm.warning_threshold}
                          onChange={(e) => setBillingForm({ ...billingForm, warning_threshold: e.target.value })}
                        />
                      </div>
                      <Button 
                        variant="outline"
                        onClick={() => updateBilling(id!, { warning_threshold: parseFloat(billingForm.warning_threshold) })}
                      >
                        保存
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* 偏好时段 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  偏好时段
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {schedulePreferences.length === 0 && !showPreferenceForm ? (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    暂无偏好时段设置
                  </div>
                ) : (
                  <div className="space-y-1">
                    {schedulePreferences.map((pref) => {
                      const dayLabels: Record<DayOfWeek, string> = {
                        monday: '周一',
                        tuesday: '周二',
                        wednesday: '周三',
                        thursday: '周四',
                        friday: '周五',
                        saturday: '周六',
                        sunday: '周日'
                      }
                      
                      // 如果正在编辑这个偏好，显示内联编辑表单
                      if (editingPreference?.id === pref.id) {
                        return (
                          <div key={pref.id} className="border rounded-lg p-3 bg-blue-50/30 space-y-2">
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="text-xs text-muted-foreground">星期</label>
                                <select
                                  value={preferenceForm.day_of_week}
                                  onChange={(e) => setPreferenceForm({ ...preferenceForm, day_of_week: e.target.value as DayOfWeek })}
                                  className="w-full h-8 px-2 rounded border text-sm"
                                >
                                  <option value="monday">周一</option>
                                  <option value="tuesday">周二</option>
                                  <option value="wednesday">周三</option>
                                  <option value="thursday">周四</option>
                                  <option value="friday">周五</option>
                                  <option value="saturday">周六</option>
                                  <option value="sunday">周日</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground">开始</label>
                                <Input
                                  type="time"
                                  value={preferenceForm.preferred_start}
                                  onChange={(e) => setPreferenceForm({ ...preferenceForm, preferred_start: e.target.value })}
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground">结束</label>
                                <Input
                                  type="time"
                                  value={preferenceForm.preferred_end}
                                  onChange={(e) => setPreferenceForm({ ...preferenceForm, preferred_end: e.target.value })}
                                  className="h-8 text-sm"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">备注</label>
                              <Input
                                value={preferenceForm.notes}
                                onChange={(e) => setPreferenceForm({ ...preferenceForm, notes: e.target.value })}
                                placeholder="可选"
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={handleUpdatePreference}>保存</Button>
                              <Button variant="outline" size="sm" onClick={() => {
                                setEditingPreference(null)
                                resetPreferenceForm()
                              }}>取消</Button>
                            </div>
                          </div>
                        )
                      }
                      
                      // 正常显示偏好项
                      return (
                        <div key={pref.id} className="group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 transition-colors">
                          <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded min-w-[40px] text-center">
                            {dayLabels[pref.day_of_week]}
                          </span>
                          <span className="text-sm">
                            {pref.preferred_start?.slice(0,5) || '09:00'} - {pref.preferred_end?.slice(0,5) || '11:00'}
                          </span>
                          {pref.notes && (
                            <span className="text-xs text-muted-foreground truncate flex-1">({pref.notes})</span>
                          )}
                          <div className="ml-auto opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                            <button 
                              onClick={() => openEditPreference(pref)}
                              className="p-1 hover:bg-muted rounded"
                              title="编辑"
                            >
                              <Edit className="w-3 h-3" />
                            </button>
                            <button 
                              onClick={() => handleDeletePreference(pref.id)} 
                              className="p-1 hover:bg-muted rounded text-destructive"
                              title="删除"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                
                {/* 添加新偏好 - 底部折叠表单 */}
                {showPreferenceForm ? (
                  <div className="border rounded-lg p-3 bg-blue-50/30 space-y-2 mt-2">
                    <div className="text-xs font-medium text-muted-foreground">添加新偏好时段</div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground">星期</label>
                        <select
                          value={preferenceForm.day_of_week}
                          onChange={(e) => setPreferenceForm({ ...preferenceForm, day_of_week: e.target.value as DayOfWeek })}
                          className="w-full h-8 px-2 rounded border text-sm"
                        >
                          <option value="monday">周一</option>
                          <option value="tuesday">周二</option>
                          <option value="wednesday">周三</option>
                          <option value="thursday">周四</option>
                          <option value="friday">周五</option>
                          <option value="saturday">周六</option>
                          <option value="sunday">周日</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">开始</label>
                        <Input
                          type="time"
                          value={preferenceForm.preferred_start}
                          onChange={(e) => setPreferenceForm({ ...preferenceForm, preferred_start: e.target.value })}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">结束</label>
                        <Input
                          type="time"
                          value={preferenceForm.preferred_end}
                          onChange={(e) => setPreferenceForm({ ...preferenceForm, preferred_end: e.target.value })}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">备注</label>
                      <Input
                        value={preferenceForm.notes}
                        onChange={(e) => setPreferenceForm({ ...preferenceForm, notes: e.target.value })}
                        placeholder="可选"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleCreatePreference}>添加</Button>
                      <Button variant="outline" size="sm" onClick={() => {
                        setShowPreferenceForm(false)
                        resetPreferenceForm()
                      }}>取消</Button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowPreferenceForm(true)}
                    className="w-full mt-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded flex items-center justify-center gap-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    添加时段偏好
                  </button>
                )}
              </CardContent>
            </Card>

            {/* 语音进度 */}
            <Card>
              <CardHeader>
                <CardTitle>语音训练进度</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">自然拼读进度</span>
                  <span>{currentStudent.phonics_progress || '未开始'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">自然拼读状态</span>
                  <span>{currentStudent.phonics_completed ? '已完成' : '进行中'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">国际音标状态</span>
                  <span>{currentStudent.ipa_completed ? '已完成' : '未开始'}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {tab === 'wordbank' && (
          <div className="space-y-6">
            {/* 现有进度列表 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentProgress.map((progress) => {
                const wordbank = wordbanks.find(w => w.id === progress.wordbank_id)
                const totalLevels = progress.total_levels_override || wordbank?.total_levels || 60
                const percentage = Math.round((progress.current_level / totalLevels) * 100)
                
                return (
                  <Card key={progress.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">{progress.wordbank_label}</CardTitle>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded",
                            progress.status === 'completed' && "bg-success/10 text-success",
                            progress.status === 'active' && "bg-progress/10 text-progress",
                            progress.status === 'paused' && "bg-muted text-muted-foreground"
                          )}>
                            {progress.status === 'completed' ? '已完成' : progress.status === 'active' ? '进行中' : '已暂停'}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            title="删除词库进度"
                            onClick={async () => {
                              const confirmMessage = progress.status === 'completed'
                                ? `确定要删除已完成的词库「${progress.wordbank_label}」吗？`
                                : `确定要删除词库「${progress.wordbank_label}」的进度记录吗？\n\n删除后进度将无法恢复。`
                              if (confirm(confirmMessage)) {
                                await deleteProgress(id!, progress.wordbank_id)
                              }
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">当前进度</span>
                          <span>第 {progress.current_level} / {totalLevels} 关</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center pt-2">
                          <span className="text-xs text-muted-foreground">
                            上次九宫格：第 {progress.last_nine_grid_level} 关
                          </span>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 text-xs"
                            onClick={() => {
                              showPrompt(`输入新的当前关数 (最大 ${totalLevels} 关):`, progress.current_level.toString(), (newLevel) => {
                                if (newLevel && !isNaN(parseInt(newLevel))) {
                                  const level = Math.min(parseInt(newLevel), totalLevels)
                                  upsertProgress({
                                    student_id: id!,
                                    wordbank_id: progress.wordbank_id,
                                    current_level: level,
                                    status: level >= totalLevels ? 'completed' : 'active'
                                  })
                                }
                              })
                            }}
                          >
                            更新进度
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {/* 添加词库进度 */}
            {wordbanks.length > currentProgress.length && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">添加词库</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-3">
                    <Select
                      placeholder="选择词库"
                      options={wordbanks
                        .filter(w => !currentProgress.some(p => p.wordbank_id === w.id))
                        .map(w => ({ value: w.id, label: w.name }))}
                      className="flex-1"
                      onChange={(e) => {
                        if (e.target.value) {
                          upsertProgress({
                            student_id: id!,
                            wordbank_id: e.target.value,
                            current_level: 0,
                            status: 'active'
                          })
                        }
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {tab === 'growth' && (
          <GrowthPanel studentId={id!} />
        )}

        {tab === 'records' && (
          <div className="space-y-6">
            {showRecordForm ? (
              <ClassRecordForm
                studentId={id!}
                wordbanks={wordbanks}
                onSave={handleCreateRecord}
                onCancel={() => setShowRecordForm(false)}
              />
            ) : editingRecord ? (
              <ClassRecordForm
                studentId={id!}
                wordbanks={wordbanks}
                onSave={handleUpdateRecord}
                onCancel={() => setEditingRecord(null)}
                initialData={editingRecord}
              />
            ) : (
              <>
                {/* 新建按钮 */}
                <div className="flex justify-end">
                  <Button onClick={() => setShowRecordForm(true)}>
                    <Plus className="w-4 h-4 mr-1" />
                    新建课堂记录
                  </Button>
                </div>
                
                {/* 课堂记录列表 */}
                {recordsWithPlan.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>暂无课堂记录</p>
                    <p className="text-sm mt-1">点击上方按钮创建第一条记录</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recordsWithPlan.map((record) => (
                      <Card key={record.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-3 flex-1">
                              {/* 日期和基本信息 */}
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-muted-foreground" />
                                  <span className="font-medium">{record.class_date}</span>
                                </div>
                                <span className="text-sm text-muted-foreground">
                                  {record.duration_hours}h
                                </span>
                                {record.teacher_name && (
                                  <span className="text-sm text-muted-foreground">
                                    助教: {record.teacher_name}
                                  </span>
                                )}
                                <span className={cn(
                                  "text-xs px-2 py-0.5 rounded",
                                  record.attendance === 'present' && "bg-green-500/10 text-green-600",
                                  record.attendance === 'late' && "bg-yellow-500/10 text-yellow-600",
                                  record.attendance === 'absent' && "bg-red-500/10 text-red-600"
                                )}>
                                  {record.attendance === 'present' ? '到课' : record.attendance === 'late' ? '迟到' : '缺课'}
                                </span>
                                {record.plan_id && (
                                  <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 flex items-center gap-1">
                                    <Link className="w-3 h-3" />
                                    关联计划
                                  </span>
                                )}
                              </div>
                              
                              {/* 双栏对比展示：原定计划 vs 实际完成 */}
                              {record.plan ? (
                                <div className="border rounded-lg overflow-hidden">
                                  <div className="grid grid-cols-2 divide-x">
                                    {/* 左栏：原定计划 */}
                                    <div className="bg-blue-50/50 p-3">
                                      <div className="flex items-center gap-2 mb-2 text-blue-700">
                                        <Columns className="w-4 h-4" />
                                        <span className="text-xs font-medium">原定计划</span>
                                      </div>
                                      <div className="flex flex-wrap gap-1.5">
                                        {record.plan.tasks.map((task, idx) => (
                                          <span key={idx} className="text-xs bg-white border border-blue-200 px-2 py-1 rounded">
                                            {task.wordbank_label || task.content || task.type}
                                            {task.level_from && task.level_to && ` 第${task.level_from}-${task.level_to}关`}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                    
                                    {/* 右栏：实际完成 */}
                                    <div className="bg-green-50/50 p-3">
                                      <div className="flex items-center gap-2 mb-2 text-green-700">
                                        <FileText className="w-4 h-4" />
                                        <span className="text-xs font-medium">实际完成</span>
                                      </div>
                                      <div className="flex flex-wrap gap-1.5">
                                        {record.tasks.map((task, idx) => (
                                          <span key={idx} className="text-xs bg-white border border-green-200 px-2 py-1 rounded">
                                            {task.wordbank_label || task.content || task.type}
                                            {task.level_reached && ` → 第${task.level_reached}关`}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* 完成状态对比 */}
                                  <div className="border-t p-2 bg-muted/30 flex items-center gap-4">
                                    <span className={cn(
                                      "text-sm font-medium",
                                      record.task_completed === 'completed' && "text-green-600",
                                      record.task_completed === 'partial' && "text-yellow-600",
                                      record.task_completed === 'not_completed' && "text-red-600"
                                    )}>
                                      {record.task_completed === 'completed' ? '✓ 全部完成' : 
                                       record.task_completed === 'partial' ? '◐ 部分完成' : '✗ 未完成'}
                                    </span>
                                    <span className={cn(
                                      "text-sm",
                                      record.performance === 'excellent' && "text-green-600",
                                      record.performance === 'good' && "text-blue-600",
                                      record.performance === 'needs_improvement' && "text-orange-600"
                                    )}>
                                      表现: {record.performance === 'excellent' ? '优秀' : 
                                       record.performance === 'good' ? '良好' : '待提高'}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  {/* 无关联计划时正常显示任务块 */}
                                  <div className="flex flex-wrap gap-2">
                                    {record.tasks.map((task, index) => (
                                      <TaskBlock
                                        key={index}
                                        task={task}
                                        index={index}
                                      />
                                    ))}
                                  </div>
                                  
                                  {/* 完成状态和表现 */}
                                  <div className="flex items-center gap-4 text-sm">
                                    <span className={cn(
                                      record.task_completed === 'completed' && "text-green-600",
                                      record.task_completed === 'partial' && "text-yellow-600",
                                      record.task_completed === 'not_completed' && "text-red-600"
                                    )}>
                                      {record.task_completed === 'completed' ? '✓ 全部完成' : 
                                       record.task_completed === 'partial' ? '◐ 部分完成' : '✗ 未完成'}
                                    </span>
                                    <span className={cn(
                                      record.performance === 'excellent' && "text-green-600",
                                      record.performance === 'good' && "text-blue-600",
                                      record.performance === 'needs_improvement' && "text-orange-600"
                                    )}>
                                      {record.performance === 'excellent' ? '表现优秀' : 
                                       record.performance === 'good' ? '表现良好' : '待提高'}
                                    </span>
                                  </div>
                                </>
                              )}
                              
                              {/* 备注 */}
                              {record.issues && (
                                <p className="text-sm text-muted-foreground">
                                  问题: {record.issues}
                                </p>
                              )}
                              
                              {/* 学情反馈原文 */}
                              {record.detail_feedback && (
                                <div>
                                  <button
                                    onClick={() => setExpandedFeedbackId(
                                      expandedFeedbackId === record.id ? null : record.id
                                    )}
                                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    <FileText className="w-3 h-3" />
                                    {expandedFeedbackId === record.id ? '收起反馈原文' : '查看完整反馈原文'}
                                  </button>
                                  
                                  {expandedFeedbackId === record.id && (
                                    <div className="mt-2 p-3 bg-muted/50 rounded-lg border border-muted">
                                      <p className="text-xs text-muted-foreground mb-1 font-medium">学情反馈原文</p>
                                      <pre className="text-sm whitespace-pre-wrap font-sans text-foreground leading-relaxed">
                                        {extractFeedbackBeforeNotes(record.detail_feedback)}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            
                            {/* 操作按钮 */}
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-foreground"
                                title="编辑"
                                onClick={() => setEditingRecord(record)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-destructive"
                                title="删除"
                                onClick={async () => {
                                  if (confirm('确定删除此课堂记录？')) {
                                    await deleteClassRecord(record.id)
                                    if (id) {
                                      loadRecordsWithPlan(id)
                                    }
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'plans' && (
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
                                      showPrompt('请输入新的计划日期 (YYYY-MM-DD):', formatDateUtil(new Date()), async (newDate) => {
                                        if (newDate) {
                                          await lessonPlanDb.update(plan.id, { plan_date: newDate })
                                          loadLessonPlans(id!)
                                          // expiredPlans 会自动从 lessonPlans 派生更新
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
                                      showPrompt('请输入新计划的日期 (YYYY-MM-DD):', formatDateUtil(new Date()), async (newDate) => {
                                        if (newDate) {
                                          // 创建新计划
                                          await lessonPlanDb.create({
                                            student_id: id!,
                                            plan_date: newDate,
                                            tasks: plan.tasks,
                                            notes: plan.notes || undefined,
                                            generated_by_ai: false
                                          })
                                          // 删除过期计划
                                          await lessonPlanDb.delete(plan.id)
                                          loadLessonPlans(id!)
                                          // expiredPlans 会自动从 lessonPlans 派生更新
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
                                      if (confirm('确定要删除这个过期计划吗？')) {
                                        await lessonPlanDb.delete(plan.id)
                                        loadLessonPlans(id!)
                                        // expiredPlans 会自动从 lessonPlans 派生更新
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
                                    student_id: id!,
                                    plan_date: new Date().toISOString().split('T')[0],
                                    tasks: plan.tasks,
                                    notes: plan.notes || undefined,
                                    generated_by_ai: false
                                  })
                                  loadLessonPlans(id!)
                                }}
                              >
                                <Copy className="w-4 h-4 mr-1" />
                                复制
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                title="导出 PDF"
                                onClick={() => exportLessonPlanPDF(currentStudent, plan)}
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                title="打印"
                                onClick={() => printLessonPlan(currentStudent, plan)}
                              >
                                <Printer className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-destructive"
                                onClick={async () => {
                                  if (confirm('确定删除此课程计划？')) {
                                    await deleteLessonPlan(plan.id)
                                    loadLessonPlans(id!)
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
        )}
      </div>
      
      {/* Prompt Dialog */}
      <PromptDialog
        open={promptState.open}
        title={promptState.title}
        defaultValue={promptState.defaultValue}
        onConfirm={(value) => {
          promptState.onConfirm?.(value)
          setPromptState({ open: false, title: '', defaultValue: '', onConfirm: null })
        }}
        onCancel={() => setPromptState({ open: false, title: '', defaultValue: '', onConfirm: null })}
      />
    </div>
  )
}
