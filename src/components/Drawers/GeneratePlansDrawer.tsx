import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles, Check, AlertCircle, Loader2, ChevronDown, ChevronUp, RefreshCw, Edit, Save, SkipForward } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { DateInput } from '@/components/ui/date-input'
import { TaskBlock } from '@/components/TaskBlock/TaskBlock'
import { useAppStore } from '@/store/appStore'
import { settingsDb, progressDb, classRecordDb, lessonPlanDb } from '@/db'
import { sendAIRequest, sendAIRequestStream } from '@/ai/client'
import { SYSTEM_PROMPT, buildUserInput, parseAIResponse, formatTasksSummary } from '@/ai/prompts'
import { cn } from '@/lib/utils'
import type { Student, StudentWordbankProgress, ClassRecord, Wordbank, TaskBlock as TaskBlockType, AIConfig } from '@/types'

interface GeneratePlansDrawerProps {
  open: boolean
  onClose: () => void
}

type GenerationStatus = 'pending' | 'generating' | 'success' | 'failed' | 'saved' | 'skipped'

interface StudentPlanState {
  student: Student
  status: GenerationStatus
  plan: {
    tasks: TaskBlockType[]
    notes: string
    reason: string
  } | null
  error: string | null
  expanded: boolean
}

export function GeneratePlansDrawer({ open, onClose }: GeneratePlansDrawerProps) {
  const { students, wordbanks, loadStudents, loadWordbanks, createLessonPlan } = useAppStore()
  
  const [selectedStudents, setSelectedStudents] = useState<StudentPlanState[]>([])
  const [extraInstruction, setExtraInstruction] = useState('')
  const [planDate, setPlanDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [generating, setGenerating] = useState(false)
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null)
  const [filterGrade, setFilterGrade] = useState<string>('all')
  const [searchName, setSearchName] = useState('')
  const [streamContent, setStreamContent] = useState<string>('')
  
  // 加载 AI 配置
  useEffect(() => {
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
    
    if (open) {
      loadAIConfig()
      loadStudents()
      loadWordbanks()
    }
  }, [open])
  
  // 过滤学员列表
  const filteredStudents = students.filter(s => {
    if (s.status !== 'active') return false
    if (filterGrade !== 'all' && s.grade !== filterGrade) return false
    if (searchName && !s.name.includes(searchName)) return false
    return true
  })
  
  // 切换学员选择
  const toggleStudent = (student: Student) => {
    setSelectedStudents(prev => {
      const exists = prev.find(s => s.student.id === student.id)
      if (exists) {
        return prev.filter(s => s.student.id !== student.id)
      } else {
        return [...prev, {
          student,
          status: 'pending',
          plan: null,
          error: null,
          expanded: false
        }]
      }
    })
  }
  
  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedStudents.length === filteredStudents.length) {
      setSelectedStudents([])
    } else {
      setSelectedStudents(filteredStudents.map(student => ({
        student,
        status: 'pending',
        plan: null,
        error: null,
        expanded: false
      })))
    }
  }
  
  // 按年级全选
  const selectByGrade = (grade: string) => {
    const gradeStudents = filteredStudents.filter(s => s.grade === grade)
    const newSelection = [...selectedStudents]
    
    gradeStudents.forEach(student => {
      if (!newSelection.find(s => s.student.id === student.id)) {
        newSelection.push({
          student,
          status: 'pending',
          plan: null,
          error: null,
          expanded: false
        })
      }
    })
    
    setSelectedStudents(newSelection)
  }
  
  // 开始生成
  const startGeneration = async () => {
    if (!aiConfig || selectedStudents.length === 0) return
    
    setGenerating(true)
    setStreamContent('')
    
    for (let i = 0; i < selectedStudents.length; i++) {
      const item = selectedStudents[i]
      
      // 跳过已完成或已跳过的
      if (item.status === 'saved' || item.status === 'skipped') continue
      
      // 更新状态为生成中
      setSelectedStudents(prev => prev.map((s, idx) => 
        s.student.id === item.student.id ? { ...s, status: 'generating' as GenerationStatus } : s
      ))
      
      try {
        // 获取学员数据
        const progress = await progressDb.getByStudentId(item.student.id)
        const recentRecords = await classRecordDb.getByStudentId(item.student.id, 3)
        const lastPlanSummary = await lessonPlanDb.getLastPlanSummary(item.student.id)
        
        // 构建用户输入
        const userInput = buildUserInput({
          student: item.student,
          wordbankProgress: progress,
          wordbanks,
          recentRecords,
          lastPlanSummary,
          extraInstruction
        })
        
        // 调用 AI（非流式，批量生成时更可靠）
        const response = await sendAIRequest(aiConfig, SYSTEM_PROMPT, userInput)
        
        // 解析响应
        const parsed = parseAIResponse(response)
        
        if (parsed) {
          setSelectedStudents(prev => prev.map(s => 
            s.student.id === item.student.id 
              ? { ...s, status: 'success' as GenerationStatus, plan: parsed }
              : s
          ))
        } else {
          setSelectedStudents(prev => prev.map(s => 
            s.student.id === item.student.id 
              ? { ...s, status: 'failed' as GenerationStatus, error: '解析 AI 响应失败' }
              : s
          ))
        }
      } catch (error) {
        setSelectedStudents(prev => prev.map(s => 
          s.student.id === item.student.id 
            ? { ...s, status: 'failed' as GenerationStatus, error: (error as Error).message }
            : s
        ))
      }
      
      // 间隔 500ms 避免触发 rate limit
      if (i < selectedStudents.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
    
    setGenerating(false)
  }
  
  // 重新生成单个学员
  const regenerateStudent = async (studentId: string) => {
    if (!aiConfig) return
    
    const item = selectedStudents.find(s => s.student.id === studentId)
    if (!item) return
    
    setSelectedStudents(prev => prev.map(s => 
      s.student.id === studentId ? { ...s, status: 'generating' as GenerationStatus, error: null } : s
    ))
    
    try {
      const progress = await progressDb.getByStudentId(studentId)
      const recentRecords = await classRecordDb.getByStudentId(studentId, 3)
      const lastPlanSummary = await lessonPlanDb.getLastPlanSummary(studentId)
      
      const userInput = buildUserInput({
        student: item.student,
        wordbankProgress: progress,
        wordbanks,
        recentRecords,
        lastPlanSummary,
        extraInstruction
      })
      
      const response = await sendAIRequest(aiConfig, SYSTEM_PROMPT, userInput)
      const parsed = parseAIResponse(response)
      
      if (parsed) {
        setSelectedStudents(prev => prev.map(s => 
          s.student.id === studentId 
            ? { ...s, status: 'success' as GenerationStatus, plan: parsed }
            : s
        ))
      } else {
        setSelectedStudents(prev => prev.map(s => 
          s.student.id === studentId 
            ? { ...s, status: 'failed' as GenerationStatus, error: '解析 AI 响应失败' }
            : s
        ))
      }
    } catch (error) {
      setSelectedStudents(prev => prev.map(s => 
        s.student.id === studentId 
          ? { ...s, status: 'failed' as GenerationStatus, error: (error as Error).message }
          : s
      ))
    }
  }
  
  // 保存单个学员的计划
  const saveStudentPlan = async (studentId: string) => {
    const item = selectedStudents.find(s => s.student.id === studentId)
    if (!item || !item.plan) return
    
    try {
      await createLessonPlan({
        student_id: studentId,
        plan_date: planDate,
        tasks: item.plan.tasks,
        notes: item.plan.notes,
        ai_reason: item.plan.reason,
        generated_by_ai: true
      })
      
      setSelectedStudents(prev => prev.map(s => 
        s.student.id === studentId ? { ...s, status: 'saved' as GenerationStatus } : s
      ))
    } catch (error) {
      alert('保存失败：' + (error as Error).message)
    }
  }
  
  // 跳过单个学员
  const skipStudent = (studentId: string) => {
    setSelectedStudents(prev => prev.map(s => 
      s.student.id === studentId ? { ...s, status: 'skipped' as GenerationStatus } : s
    ))
  }
  
  // 保存全部已确认
  const saveAllConfirmed = async () => {
    for (const item of selectedStudents) {
      if (item.status === 'success' && item.plan) {
        await saveStudentPlan(item.student.id)
      }
    }
  }
  
  // 切换展开状态
  const toggleExpand = (studentId: string) => {
    setSelectedStudents(prev => prev.map(s => 
      s.student.id === studentId ? { ...s, expanded: !s.expanded } : s
    ))
  }
  
  // 关闭并重置
  const handleClose = () => {
    setSelectedStudents([])
    setExtraInstruction('')
    setStreamContent('')
    onClose()
  }
  
  // 统计
  const successCount = selectedStudents.filter(s => s.status === 'success' || s.status === 'saved').length
  const failedCount = selectedStudents.filter(s => s.status === 'failed').length
  const pendingCount = selectedStudents.filter(s => s.status === 'pending').length
  
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
                <Sparkles className="w-5 h-5 text-primary" />
                批量生成课程计划
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
                        { value: '三年级', label: '三年级' },
                        { value: '四年级', label: '四年级' },
                        { value: '五年级', label: '五年级' },
                        { value: '六年级', label: '六年级' },
                        { value: '初一', label: '初一' },
                        { value: '初二', label: '初二' },
                        { value: '初三', label: '初三' }
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
                    {selectedStudents.length === filteredStudents.length ? '取消全选' : '全选'}
                  </Button>
                  {['三年级', '四年级', '五年级', '六年级', '初一', '初二', '初三'].map(grade => (
                    <Button
                      key={grade}
                      variant="ghost"
                      size="sm"
                      onClick={() => selectByGrade(grade)}
                    >
                      {grade}
                    </Button>
                  ))}
                </div>
                
                {/* 学员列表 */}
                <div className="grid grid-cols-4 gap-2 max-h-48 overflow-auto">
                  {filteredStudents.map(student => {
                    const isSelected = selectedStudents.some(s => s.student.id === student.id)
                    return (
                      <button
                        key={student.id}
                        onClick={() => toggleStudent(student)}
                        className={cn(
                          "px-3 py-2 rounded-lg text-sm text-left transition-colors",
                          isSelected 
                            ? "bg-primary/10 text-primary border border-primary/30" 
                            : "bg-muted hover:bg-muted/80"
                        )}
                      >
                        {student.name}
                        <span className="text-xs text-muted-foreground ml-1">
                          {student.grade}
                        </span>
                      </button>
                    )
                  })}
                </div>
                
                {selectedStudents.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-3">
                    已选择 <span className="text-primary font-medium">{selectedStudents.length}</span> 名学员
                  </p>
                )}
              </div>
              
              {/* 全局参数设置 */}
              <div className="p-6 border-b space-y-4">
                <h3 className="font-medium">全局参数</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">计划日期</label>
                    <DateInput
                      value={planDate}
                      onChange={(val) => setPlanDate(val)}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">大纲方向（可选）</label>
                    <Input
                      value={extraInstruction}
                      onChange={(e) => setExtraInstruction(e.target.value)}
                      placeholder="如：本周重点推进词库"
                    />
                  </div>
                </div>
                
                {!aiConfig?.api_key && (
                  <Card className="border-yellow-300 bg-yellow-500/10">
                    <CardContent className="p-3 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-yellow-600" />
                      <span className="text-sm text-yellow-700">
                        请先在「设置」页面配置 AI API Key
                      </span>
                    </CardContent>
                  </Card>
                )}
              </div>
              
              {/* 生成结果列表 */}
              {selectedStudents.length > 0 && (
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">生成结果</h3>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-green-600">成功: {successCount}</span>
                      <span className="text-red-600">失败: {failedCount}</span>
                      <span className="text-muted-foreground">待处理: {pendingCount}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    {selectedStudents.map(item => (
                      <Card key={item.student.id} className={cn(
                        item.status === 'failed' && "border-red-300",
                        item.status === 'saved' && "border-green-300"
                      )}>
                        <CardContent className="p-4">
                          {/* 头部 */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-2 h-2 rounded-full",
                                item.status === 'pending' && "bg-gray-400",
                                item.status === 'generating' && "bg-blue-500 animate-pulse",
                                item.status === 'success' && "bg-green-500",
                                item.status === 'failed' && "bg-red-500",
                                item.status === 'saved' && "bg-green-600",
                                item.status === 'skipped' && "bg-gray-300"
                              )} />
                              <span className="font-medium">{item.student.name}</span>
                              <span className="text-sm text-muted-foreground">{item.student.grade}</span>
                              <span className={cn(
                                "text-xs px-2 py-0.5 rounded",
                                item.status === 'pending' && "bg-gray-100 text-gray-600",
                                item.status === 'generating' && "bg-blue-100 text-blue-600",
                                item.status === 'success' && "bg-green-100 text-green-600",
                                item.status === 'failed' && "bg-red-100 text-red-600",
                                item.status === 'saved' && "bg-green-200 text-green-700",
                                item.status === 'skipped' && "bg-gray-100 text-gray-500"
                              )}>
                                {item.status === 'pending' && '等待中'}
                                {item.status === 'generating' && '生成中...'}
                                {item.status === 'success' && '已完成'}
                                {item.status === 'failed' && '失败'}
                                {item.status === 'saved' && '已保存'}
                                {item.status === 'skipped' && '已跳过'}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              {item.status === 'success' && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleExpand(item.student.id)}
                                  >
                                    {item.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => regenerateStudent(item.student.id)}
                                  >
                                    <RefreshCw className="w-3 h-3 mr-1" />
                                    重新生成
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => saveStudentPlan(item.student.id)}
                                  >
                                    <Save className="w-3 h-3 mr-1" />
                                    保存
                                  </Button>
                                </>
                              )}
                              {item.status === 'failed' && (
                                <>
                                  <span className="text-xs text-red-600">{item.error}</span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => regenerateStudent(item.student.id)}
                                  >
                                    <RefreshCw className="w-3 h-3 mr-1" />
                                    重试
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => skipStudent(item.student.id)}
                                  >
                                    <SkipForward className="w-3 h-3 mr-1" />
                                    跳过
                                  </Button>
                                </>
                              )}
                              {item.status === 'generating' && (
                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                              )}
                            </div>
                          </div>
                          
                          {/* 展开的计划内容 */}
                          {item.expanded && item.plan && (
                            <div className="mt-4 pt-4 border-t space-y-3">
                              <div>
                                <p className="text-sm text-muted-foreground mb-2">任务列表：</p>
                                <div className="flex flex-wrap gap-2">
                                  {item.plan.tasks.map((task, idx) => (
                                    <TaskBlock key={idx} task={task} index={idx} />
                                  ))}
                                </div>
                              </div>
                              {item.plan.notes && (
                                <div>
                                  <p className="text-sm text-muted-foreground">助教提示：</p>
                                  <p className="text-sm">{item.plan.notes}</p>
                                </div>
                              )}
                              {item.plan.reason && (
                                <div>
                                  <p className="text-sm text-muted-foreground">计划说明：</p>
                                  <p className="text-sm">{item.plan.reason}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* 底部操作栏 */}
            <div className="h-16 border-t flex items-center justify-between px-6">
              <Button variant="outline" onClick={handleClose}>
                取消
              </Button>
              <div className="flex gap-3">
                {successCount > 0 && (
                  <Button
                    variant="outline"
                    onClick={saveAllConfirmed}
                    disabled={generating}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    保存全部已确认 ({successCount})
                  </Button>
                )}
                <Button
                  onClick={startGeneration}
                  disabled={!aiConfig?.api_key || selectedStudents.length === 0 || generating}
                >
                  {generating ? (
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
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}