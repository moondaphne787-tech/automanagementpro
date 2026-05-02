import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/appStore'
import { settingsDb, progressDb, classRecordDb, lessonPlanDb, scheduledClassDb } from '@/db'
import { sendAIRequest } from '@/ai/client'
import { buildUserInput, parseAIResponse, getSystemPrompt } from '@/ai/prompts'
import { autoFillWordbankContent } from '@/ai/autoFillWordbankContent'
import { StudentSelector } from './StudentSelector'
import { PlanResultCard, StudentPlanState, GenerationStatus, StudentContext } from './PlanResultCard'
import { GenerationControls } from './GenerationControls'
import type { Student, TaskBlock as TaskBlockType, AIConfig, Wordbank, ClassRecord, StudentWordbankProgress } from '@/types'
import { TASK_TYPE_LABELS } from '@/types'

interface GeneratePlansDrawerProps {
  open: boolean
  onClose: () => void
  fullPage?: boolean
}

export function GeneratePlansDrawer({ open, onClose, fullPage }: GeneratePlansDrawerProps) {
  const students = useAppStore(s => s.students)
  const wordbanks = useAppStore(s => s.wordbanks)
  const loadStudents = useAppStore(s => s.loadStudents)
  const loadWordbanks = useAppStore(s => s.loadWordbanks)
  const createLessonPlan = useAppStore(s => s.createLessonPlan)
  const preselectedIds = useAppStore(s => s.generateDrawerPreselectedIds)

  const [selectedStudents, setSelectedStudents] = useState<StudentPlanState[]>([])
  const [extraInstruction, setExtraInstruction] = useState('')
  const [planDate, setPlanDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [generating, setGenerating] = useState(false)
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null)
  const [smartFilterLoading, setSmartFilterLoading] = useState(false)
  const [studentContextMap, setStudentContextMap] = useState<Map<string, StudentContext>>(new Map())

  // 构建课堂记录摘要文本
  const buildRecordSummary = useCallback((record: ClassRecord): string => {
    const date = record.class_date.slice(5) // MM-DD
    const taskSummary = record.tasks.map(t => {
      const label = TASK_TYPE_LABELS[t.type] || t.type
      if (t.wordbank_label && t.level_from && t.level_to) {
        return `${t.wordbank_label}${t.level_from}-${t.level_to}关`
      }
      if (t.content) return `${label}·${t.content.slice(0, 15)}`
      return label
    }).join(' + ')
    return `${date}: ${taskSummary}`
  }, [])

  // 加载所有活跃学员的上下文数据（最近1条课堂记录）
  const loadStudentContexts = useCallback(async (studentIds: string[]) => {
    if (studentIds.length === 0) return new Map<string, StudentContext>()

    const recordsMap = await classRecordDb.getAllForStudents(studentIds)
    const contextMap = new Map<string, StudentContext>()

    for (const sid of studentIds) {
      const records = recordsMap.get(sid) || []
      const lastRecord = records[0] || null
      contextMap.set(sid, {
        lastRecord,
        lastRecordSummary: lastRecord ? buildRecordSummary(lastRecord) : null
      })
    }

    return contextMap
  }, [buildRecordSummary])

  // 智能筛选：查找目标日期有排课但无计划的学员
  const handleSmartFilter = useCallback(async (): Promise<Student[]> => {
    setSmartFilterLoading(true)
    try {
      // 获取目标日期的排课（也检查相邻日期，覆盖周末场景）
      const targetDate = new Date(planDate)
      const dayOfWeek = targetDate.getDay()

      // 收集需要检查的日期：当天 + 如果是周六则也查周日，反之亦然
      const datesToCheck = [planDate]
      if (dayOfWeek === 6) {
        // 周六 → 也查周日
        const sunday = new Date(targetDate)
        sunday.setDate(sunday.getDate() + 1)
        datesToCheck.push(sunday.toISOString().split('T')[0])
      } else if (dayOfWeek === 0) {
        // 周日 → 也查周六
        const saturday = new Date(targetDate)
        saturday.setDate(saturday.getDate() - 1)
        datesToCheck.push(saturday.toISOString().split('T')[0])
      }

      // 查询这些日期的排课
      const scheduledStudentIds = new Set<string>()
      for (const date of datesToCheck) {
        const scheduled = await scheduledClassDb.getByDate(date)
        scheduled
          .filter(sc => sc.status === 'scheduled')
          .forEach(sc => scheduledStudentIds.add(sc.student_id))
      }

      if (scheduledStudentIds.size === 0) {
        toast.info('目标日期没有排课记录')
        return []
      }

      // 查询这些日期已有的计划
      const existingPlanStudentIds = new Set<string>()
      for (const date of datesToCheck) {
        const plans = await lessonPlanDb.getByDate(date)
        plans.forEach(p => existingPlanStudentIds.add(p.student_id))
      }

      // 筛选出有排课但无计划的学员
      const missingPlanIds = [...scheduledStudentIds].filter(id => !existingPlanStudentIds.has(id))

      if (missingPlanIds.length === 0) {
        toast.success('所有排课学员都已有计划')
        return []
      }

      // 匹配学员对象
      const matched = students.filter(s => missingPlanIds.includes(s.id) && s.status === 'active')

      // 加载这些学员的上下文
      const contextMap = await loadStudentContexts(matched.map(s => s.id))
      setStudentContextMap(contextMap)

      toast.success(`找到 ${matched.length} 名有排课但无计划的学员`)
      return matched
    } catch (error) {
      toast.error('智能筛选失败：' + (error as Error).message)
      return []
    } finally {
      setSmartFilterLoading(false)
    }
  }, [planDate, students, loadStudentContexts])

  // 选中学员变更时，自动加载上下文数据
  const handleSelectionChange = useCallback(async (newSelection: StudentPlanState[]) => {
    // 找出新增的学员（之前没有上下文的）
    const newStudentIds = newSelection
      .filter(s => !s.context && !studentContextMap.has(s.student.id))
      .map(s => s.student.id)

    if (newStudentIds.length > 0) {
      const newContexts = await loadStudentContexts(newStudentIds)
      // 合并到已有的 contextMap
      setStudentContextMap(prev => {
        const merged = new Map(prev)
        newContexts.forEach((v, k) => merged.set(k, v))
        return merged
      })
      // 将上下文附加到新选中的学员
      const enriched = newSelection.map(s => ({
        ...s,
        context: s.context || newContexts.get(s.student.id) || studentContextMap.get(s.student.id)
      }))
      setSelectedStudents(enriched)
    } else {
      // 附加已有的上下文
      const enriched = newSelection.map(s => ({
        ...s,
        context: s.context || studentContextMap.get(s.student.id)
      }))
      setSelectedStudents(enriched)
    }
  }, [studentContextMap, loadStudentContexts])

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

  // Dashboard 联动：当抽屉打开且有预选学员 ID 时，自动选中对应学员
  useEffect(() => {
    if (open && preselectedIds.length > 0 && students.length > 0) {
      const preselected = students
        .filter(s => preselectedIds.includes(s.id))
        .map(student => ({
          student,
          status: 'pending' as const,
          plan: null,
          error: null,
          expanded: false,
          editing: false,
          extraNote: ''
        }))
      if (preselected.length > 0) {
        setSelectedStudents(preselected)
      }
    }
  }, [open, preselectedIds, students])

  // 开始生成
  const startGeneration = async () => {
    if (!aiConfig || selectedStudents.length === 0) return

    setGenerating(true)

    for (let i = 0; i < selectedStudents.length; i++) {
      const item = selectedStudents[i]

      // 跳过已完成或已跳过的
      if (item.status === 'saved' || item.status === 'skipped') continue

      // 更新状态为生成中
      setSelectedStudents(prev => prev.map((s) =>
        s.student.id === item.student.id ? { ...s, status: 'generating' as GenerationStatus } : s
      ))

      try {
        // 获取学员数据
        const progress = await progressDb.getByStudentId(item.student.id)
        const recentRecords = await classRecordDb.getByStudentId(item.student.id, 3)
        const lastPlanSummary = await lessonPlanDb.getLastPlanSummary(item.student.id)

        // 构建用户输入 - 合并全局提示和本学员专属提示
        const userInput = buildUserInput({
          student: item.student,
          wordbankProgress: progress,
          wordbanks,
          recentRecords,
          lastPlanSummary,
          extraInstruction: [extraInstruction, item.extraNote].filter(Boolean).join('；') || undefined
        })

        // 获取当前生效的系统提示词
        const systemPrompt = await getSystemPrompt()

        // 调用 AI（非流式，批量生成时更可靠）
        const response = await sendAIRequest(aiConfig, systemPrompt, userInput)

        // 解析响应
        const parsed = parseAIResponse(response)

        if (parsed) {
          // 根据上次课堂记录自动填充词库复习和词库学习的 content
          const lastRecord = recentRecords[0] || null
          const filledTasks = autoFillWordbankContent(parsed.tasks, lastRecord, progress)
          const filledPlan = { ...parsed, tasks: filledTasks }

          setSelectedStudents(prev => prev.map(s =>
            s.student.id === item.student.id
              ? { ...s, status: 'success' as GenerationStatus, plan: filledPlan, expanded: true }
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
        extraInstruction: [extraInstruction, item.extraNote].filter(Boolean).join('；') || undefined
      })

      const systemPrompt = await getSystemPrompt()
      const response = await sendAIRequest(aiConfig, systemPrompt, userInput)
      const parsed = parseAIResponse(response)

      if (parsed) {
        // 根据上次课堂记录自动填充词库复习和词库学习的 content
        const lastRecord = recentRecords[0] || null
        const filledTasks = autoFillWordbankContent(parsed.tasks, lastRecord, progress)
        const filledPlan = { ...parsed, tasks: filledTasks }

        setSelectedStudents(prev => prev.map(s =>
          s.student.id === studentId
            ? { ...s, status: 'success' as GenerationStatus, plan: filledPlan, expanded: true }
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
      toast.error('保存失败：' + (error as Error).message)
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

  // 切换编辑模式
  const toggleEditing = (studentId: string) => {
    setSelectedStudents(prev => prev.map(s =>
      s.student.id === studentId ? { ...s, editing: !s.editing } : s
    ))
  }

  // 更新任务
  const updateTask = (studentId: string, taskIndex: number, updatedTask: TaskBlockType) => {
    setSelectedStudents(prev => prev.map(s => {
      if (s.student.id === studentId && s.plan) {
        const newTasks = [...s.plan.tasks]
        newTasks[taskIndex] = updatedTask
        return { ...s, plan: { ...s.plan, tasks: newTasks } }
      }
      return s
    }))
  }

  // 删除任务
  const deleteTask = (studentId: string, taskIndex: number) => {
    setSelectedStudents(prev => prev.map(s => {
      if (s.student.id === studentId && s.plan) {
        const newTasks = s.plan.tasks.filter((_, idx) => idx !== taskIndex)
        return { ...s, plan: { ...s.plan, tasks: newTasks } }
      }
      return s
    }))
  }

  // 添加任务
  const addTask = (studentId: string) => {
    setSelectedStudents(prev => prev.map(s => {
      if (s.student.id === studentId && s.plan) {
        const newTask: TaskBlockType = { type: 'vocab_new' }
        return { ...s, plan: { ...s.plan, tasks: [...s.plan.tasks, newTask] } }
      }
      return s
    }))
  }

  // 重新排序任务（拖拽排序）
  const reorderTasks = (studentId: string, newTasks: TaskBlockType[]) => {
    setSelectedStudents(prev => prev.map(s => {
      if (s.student.id === studentId && s.plan) {
        return { ...s, plan: { ...s.plan, tasks: newTasks } }
      }
      return s
    }))
  }

  // 更新备注
  const updateNotes = (studentId: string, notes: string) => {
    setSelectedStudents(prev => prev.map(s => {
      if (s.student.id === studentId && s.plan) {
        return { ...s, plan: { ...s.plan, notes } }
      }
      return s
    }))
  }

  // 更新计划说明
  const updateReason = (studentId: string, reason: string) => {
    setSelectedStudents(prev => prev.map(s => {
      if (s.student.id === studentId && s.plan) {
        return { ...s, plan: { ...s.plan, reason } }
      }
      return s
    }))
  }

  // 更新学员附加提示词
  const updateStudentExtraNote = (studentId: string, note: string) => {
    setSelectedStudents(prev => prev.map(s =>
      s.student.id === studentId ? { ...s, extraNote: note } : s
    ))
  }

  // 关闭并重置
  const handleClose = () => {
    setSelectedStudents([])
    setExtraInstruction('')
    onClose()
  }

  // 统计
  const successCount = selectedStudents.filter(s => s.status === 'success' || s.status === 'saved').length
  const failedCount = selectedStudents.filter(s => s.status === 'failed').length
  const pendingCount = selectedStudents.filter(s => s.status === 'pending').length

  // 内容区域（fullPage 和 drawer 共用）
  const contentArea = (
    <div className="flex-1 overflow-auto">
      <StudentSelector
        students={students}
        selectedStudents={selectedStudents}
        onSelectionChange={handleSelectionChange}
        onSmartFilter={handleSmartFilter}
        smartFilterLoading={smartFilterLoading}
        studentContextMap={studentContextMap}
      />
      <GenerationControls
        planDate={planDate}
        onPlanDateChange={setPlanDate}
        extraInstruction={extraInstruction}
        onExtraInstructionChange={setExtraInstruction}
        aiConfig={aiConfig}
        generating={generating}
        selectedCount={selectedStudents.length}
        successCount={successCount}
        onStartGeneration={startGeneration}
        onSaveAllConfirmed={saveAllConfirmed}
      />
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
              <PlanResultCard
                key={item.student.id}
                item={item}
                wordbanks={wordbanks}
                onToggleExpand={toggleExpand}
                onToggleEditing={toggleEditing}
                onRegenerate={regenerateStudent}
                onSave={saveStudentPlan}
                onSkip={skipStudent}
                onUpdateExtraNote={updateStudentExtraNote}
                onUpdateTask={updateTask}
                onDeleteTask={deleteTask}
                onAddTask={addTask}
                onReorderTasks={reorderTasks}
                onUpdateNotes={updateNotes}
                onUpdateReason={updateReason}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )

  // 全页模式：直接渲染内容，不带遮罩和动画壳
  if (fullPage) {
    return open ? contentArea : null
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={handleClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-[700px] bg-background border-l shadow-xl z-50 flex flex-col"
          >
            <div className="h-16 border-b flex items-center justify-between px-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                批量生成课程计划
              </h2>
              <Button variant="ghost" size="icon" onClick={handleClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            {contentArea}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

