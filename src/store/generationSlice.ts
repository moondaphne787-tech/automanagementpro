import type { StateCreator } from 'zustand'
import type { AppState, GenerationSlice, GenerationTask } from './types'
import { toast } from 'sonner'
import { progressDb, classRecordDb, lessonPlanDb, settingsDb } from '@/db'
import { sendAIRequest } from '@/ai/client'
import { buildUserInput, parseAIResponse, getSystemPrompt } from '@/ai/prompts'
import type { TaskBlock, StudentWordbankProgress, ClassRecord, Wordbank } from '@/types'
import { autoFillWordbankContent } from '@/ai/autoFillWordbankContent'

let cancelFlag = false

export const createGenerationSlice: StateCreator<AppState, [], [], GenerationSlice> = (set, get) => ({
  generationTasks: [],
  generationRunning: false,
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

    cancelFlag = false
    set({
      generationTasks: tasks,
      generationRunning: true,
      generationProgress: { done: 0, total: tasks.length }
    })

    let doneCount = 0

    for (let i = 0; i < tasks.length; i++) {
      // 检查取消
      if (cancelFlag) break

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

    set({ generationRunning: false })
    if (!cancelFlag) {
      const successCount = get().generationTasks.filter(t => t.status === 'success').length
      toast.success(`批量生成完成：${successCount}/${tasks.length} 成功`)
    }
  },

  cancelGeneration: () => {
    cancelFlag = true
    set({ generationRunning: false })
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
