import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit, Trash2, Clock, Plus, Calendar, FileText, Sparkles, Download, Printer, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { PromptDialog } from '@/components/ui/dialog'
import { useAppStore } from '@/store/appStore'
import { formatDate, formatHours, isHoursWarning, getLevelColor } from '@/lib/utils'
import { LEVEL_LABELS, STATUS_LABELS, STUDENT_TYPE_LABELS, TASK_TYPE_LABELS } from '@/types'
import { TaskBlock } from '@/components/TaskBlock/TaskBlock'
import { ClassRecordForm } from '@/components/ClassRecord/ClassRecordForm'
import { GrowthPanel } from '@/components/Growth/GrowthPanel'
import { StudentForm } from '@/components/Student/StudentForm'
import { settingsDb, progressDb, classRecordDb, lessonPlanDb } from '@/db'
import { sendAIRequestStream } from '@/ai/client'
import { SYSTEM_PROMPT, buildUserInput, parseAIResponse } from '@/ai/prompts'
import { exportLessonPlanPDF, printLessonPlan } from '@/utils/pdfExport'
import type { Student, Billing, ClassRecord, LessonPlan, AIConfig, TaskBlock as TaskBlockType } from '@/types'
import { cn } from '@/lib/utils'

type TabType = 'info' | 'wordbank' | 'growth' | 'records' | 'plans'

export function StudentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { 
    currentStudent, 
    currentBilling, 
    currentProgress,
    wordbanks,
    classRecords,
    selectStudent, 
    updateStudent, 
    deleteStudent,
    updateBilling,
    loadWordbanks,
    upsertProgress,
    deleteProgress,
    loadClassRecords,
    createClassRecord,
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
  
  // 课程计划相关状态
  const [lessonPlans, setLessonPlans] = useState<LessonPlan[]>([])
  const [generatingPlan, setGeneratingPlan] = useState(false)
  const [streamContent, setStreamContent] = useState('')
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null)
  const [extraInstruction, setExtraInstruction] = useState('')
  const [showPlanGenerator, setShowPlanGenerator] = useState(false)
  
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

  useEffect(() => {
    if (id) {
      selectStudent(id)
      loadWordbanks()
      loadClassRecords(id)
      loadLessonPlans(id)
      loadAIConfig()
    }
  }, [id])
  
  const loadLessonPlans = async (studentId: string) => {
    const plans = await lessonPlanDb.getByStudentId(studentId)
    setLessonPlans(plans)
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
    await updateBilling(id!, { total_hours: (currentBilling?.total_hours || 0) + hours })
    setBillingForm({ ...billingForm, total_hours: '' })
  }

  const handleCreateRecord = async (data: any) => {
    await createClassRecord(data)
    setShowRecordForm(false)
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
      
      // 流式调用 AI
      let fullContent = ''
      for await (const chunk of sendAIRequestStream(aiConfig, SYSTEM_PROMPT, userInput)) {
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

  if (!currentStudent) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        加载中...
      </div>
    )
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
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded",
                          progress.status === 'completed' && "bg-success/10 text-success",
                          progress.status === 'active' && "bg-progress/10 text-progress",
                          progress.status === 'paused' && "bg-muted text-muted-foreground"
                        )}>
                          {progress.status === 'completed' ? '已完成' : progress.status === 'active' ? '进行中' : '已暂停'}
                        </span>
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
                {classRecords.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>暂无课堂记录</p>
                    <p className="text-sm mt-1">点击上方按钮创建第一条记录</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {classRecords.map((record) => (
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
                              </div>
                              
                              {/* 任务块 */}
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
                              
                              {/* 备注 */}
                              {record.issues && (
                                <p className="text-sm text-muted-foreground">
                                  问题: {record.issues}
                                </p>
                              )}
                            </div>
                            
                            {/* 删除按钮 */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={async () => {
                                if (confirm('确定删除此课堂记录？')) {
                                  await deleteClassRecord(record.id)
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
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
                
                {/* 课程计划列表 */}
                {lessonPlans.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>暂无课程计划</p>
                    <p className="text-sm mt-1">点击「AI 生成计划」创建新计划</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {lessonPlans.map((plan) => (
                      <Card key={plan.id}>
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
                    ))}
                  </div>
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
