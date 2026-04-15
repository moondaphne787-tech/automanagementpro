import type { StateCreator } from 'zustand'
import type { AppState, GenerationSlice, GenerationTask } from './types'
import { toast } from 'sonner'
import { progressDb, classRecordDb, lessonPlanDb, settingsDb } from '@/db'
import { sendAIRequest } from '@/ai/client'
import { buildUserInput, parseAIResponse, getSystemPrompt } from '@/ai/prompts'
import type { TaskBlock, StudentWordbankProgress, ClassRecord, Wordbank } from '@/types'

// 自动填充词库 content（从 GeneratePlansDrawer 提取的逻辑）
function autoFillWordbankContent(
  tasks: TaskBlock[],
  lastRecord: ClassRecord | null,
  wordbankProgress: StudentWordbankProgress[]
): TaskBlock[] {
  let filled = tasks
  if (lastRecord) {
    const lastVocabNew = lastRecord.tasks.find(t => t.type === 'vocab_new')
    if (lastVocabNew) {
      const lastLabel = lastVocabNew.wordbank_label
      const lastFrom = lastVocabNew.level_from
      const lastTo = lastVocabNew.level_to
      if (lastLabel && lastFrom && lastTo) {
        const span = lastTo - lastFrom + 1
        const progressItem = wordbankProgress.find(p => p.wordbank_label === lastLabel)
        const totalLevels = progressItem?.total_levels_override || 60
        filled = filled.map(task => {
          if (task.type === 'vocab_review' && !task.content) {
            return { ...task, content: `检测复习${lastLabel}第${lastFrom}-${lastTo}关`, wordbank_label: task.wordbank_label || lastLabel, level_from: task.level_from || lastFrom, level_to: task.level_to || lastTo }
          }
          if (task.type === 'vocab_new' && !task.content) {
            const nextFrom = lastTo + 1
            const nextTo = Math.min(lastTo + span, totalLevels)
            if (nextFrom <= totalLevels) {
              return { ...task, content: `学习${lastLabel}第${nextFrom}-${nextTo}关`, wordbank_label: task.wordbank_label || lastLabel, level_from: task.level_from || nextFrom, level_to: task.level_to || nextTo }
            }
          }
          return task
        })
      }
    }
  }
  return filled.map(task => {
    if (task.content) return task
    if (task.type === 'vocab_new' && task.wordbank_label && task.level_from && task.level_to) return { ...task, content: `学习${task.wordbank_label}第${task.level_from}-${task.level_to}关` }
    if (task.type === 'vocab_review' && task.wordbank_label && task.level_from && task.level_to) return { ...task, content: `检测复习${task.wordbank_label}第${task.level_from}-${task.level_to}关` }
    if (task.type === 'nine_grid' && task.wordbank_label) return { ...task, content: `清理${task.wordbank_label}九宫格，共清理30-50词/轮×____轮=____词（助教课上填写）` }
    return task
  })
}

// 暂停控制标志（模块级别，不在 store 中以避免闭包问题）
let pauseFlag = false
let cancelFlag = false

function waitForResume(): Promise<void> {
  return new Promise(resolve => {
    const check = () => {
      if (!pauseFlag || cancelFlag) { resolve(); return }
      setTimeout(check, 200)
    }
    check()
  })
}

export const createGenerationSlice: StateCreator<AppState, [], [], GenerationSlice> = (set, get) => ({
  generationTasks: [],
  generationRunning: false,
  generationPaused: false,
  generationProgress: { done: 0, total: 0 },

  startGeneration: async (tasks, extraInstruction) => {
    // 加载 AI 配置
    const url = await settingsDb.get('ai_api_url')
    const key = await settingsDb.get('ai_api_key')
    const model = await settingsDb.get('ai_model')
    const temp = await settingsDb.get('ai_temperature')
    const tokens = await settingsDb.get('ai_max_tokens')

    if (!key) {
      toast.error('请先在设置中配置 AI API Key')
      return
    }

    const aiConfig = {
      api_url: url || 'https://api.deepseek.com/v1',
      api_key: key,
      model: model || 'deepseek-chat',
      temperature: parseFloat(temp || '0.7'),
      max_tokens: parseInt(tokens || '2048')
    }

    // 加载词库
    const wordbanks = get().wordbanks

    pauseFlag = false
    cancelFlag = false
    set({
      generationTasks: tasks,
      generationRunning: true,
      generationPaused: false,
      generationProgress: { done: 0, total: tasks.length }
    })

    let doneCount = 0

    for (let i = 0; i < tasks.length; i++) {
      // 检查取消
      if (cancelFlag) break

      // 检查暂停
      if (pauseFlag) {
        await waitForResume()
        if (cancelFlag) break
      }

      const task = tasks[i]
      if (task.status === 'saved' || task.status === 'skipped') {
        doneCount++
        set({ generationProgress: { done: doneCount, total: tasks.length } })
        continue
      }

      // 更新状态为生成中
      set(state => ({
        generationTasks: state.generationTasks.map(t =>
          t.studentId === task.studentId ? { ...t, status: 'generating' as const } : t
        )
      }))

      try {
        const students = get().students
        const student = students.find(s => s.id === task.studentId)
        if (!student) throw new Error('学员不存在')

        const progress = await progressDb.getByStudentId(task.studentId)
        const recentRecords = await classRecordDb.getByStudentId(task.studentId, 3)
        const lastPlanSummary = await lessonPlanDb.getLastPlanSummary(task.studentId)

        const userInput = buildUserInput({
          student,
          wordbankProgress: progress,
          wordbanks,
          recentRecords,
          lastPlanSummary,
          extraInstruction: [extraInstruction, task.extraNote].filter(Boolean).join('；') || undefined
        })

        const systemPrompt = await getSystemPrompt()
        const response = await sendAIRequest(aiConfig, systemPrompt, userInput)
        const parsed = parseAIResponse(response)

        if (parsed) {
          const lastRecord = recentRecords[0] || null
          const filledTasks = autoFillWordbankContent(parsed.tasks, lastRecord, progress)
          const filledPlan = { ...parsed, tasks: filledTasks }

          set(state => ({
            generationTasks: state.generationTasks.map(t =>
              t.studentId === task.studentId ? { ...t, status: 'success' as const, plan: filledPlan } : t
            )
          }))
        } else {
          set(state => ({
            generationTasks: state.generationTasks.map(t =>
              t.studentId === task.studentId ? { ...t, status: 'failed' as const, error: '解析 AI 响应失败' } : t
            )
          }))
        }
      } catch (error) {
        set(state => ({
          generationTasks: state.generationTasks.map(t =>
            t.studentId === task.studentId ? { ...t, status: 'failed' as const, error: (error as Error).message } : t
          )
        }))
      }

      doneCount++
      set({ generationProgress: { done: doneCount, total: tasks.length } })

      // 间隔 500ms
      if (i < tasks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    set({ generationRunning: false, generationPaused: false })
    if (!cancelFlag) {
      const successCount = get().generationTasks.filter(t => t.status === 'success').length
      toast.success(`批量生成完成：${successCount}/${tasks.length} 成功`)
    }
  },

  pauseGeneration: () => {
    pauseFlag = true
    set({ generationPaused: true })
  },

  resumeGeneration: () => {
    pauseFlag = false
    set({ generationPaused: false })
  },

  cancelGeneration: () => {
    cancelFlag = true
    pauseFlag = false
    set({ generationRunning: false, generationPaused: false })
  },

  updateGenerationTask: (studentId, updates) => {
    set(state => ({
      generationTasks: state.generationTasks.map(t =>
        t.studentId === studentId ? { ...t, ...updates } : t
      )
    }))
  },

  clearGenerationResults: () => {
    set({ generationTasks: [], generationProgress: { done: 0, total: 0 } })
  }
})
