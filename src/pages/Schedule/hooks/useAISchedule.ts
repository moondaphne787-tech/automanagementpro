import { useState } from 'react'
import { settingsDb, scheduledClassDb } from '@/db'
import { sendAIRequest } from '@/ai/client'
import {
  AI_SCHEDULE_SYSTEM_PROMPT,
  buildSchedulePromptInput,
  parseAIScheduleResponse,
  validateScheduleResults,
  type AIScheduleResult,
  type ScheduleDateConfig
} from '@/ai/schedulePrompts'
import type { Student, Teacher, Billing, StudentSchedulePreference, TeacherAvailability } from '@/types'

type StudentWithPrefs = Student & { billing: Billing | null; preferences: StudentSchedulePreference[] }
type TeacherWithAvail = Teacher & { availabilities: TeacherAvailability[] }

interface UseAIScheduleProps {
  students: StudentWithPrefs[]
  teachers: TeacherWithAvail[]
  scheduleDates: ScheduleDateConfig[]
  extraInstructions: string
  onSuccess: () => void
}

interface UseAIScheduleReturn {
  aiScheduling: boolean
  aiResults: AIScheduleResult[]
  aiConflicts: AIScheduleResult[]
  aiError: string | null
  selectedAiResults: Set<string>
  setSelectedAiResults: React.Dispatch<React.SetStateAction<Set<string>>>
  handleAISchedule: () => Promise<void>
  toggleAiResultSelection: (studentId: string) => void
  handleConfirmAISchedule: () => Promise<void>
  saving: boolean
}

export function useAISchedule({
  students,
  teachers,
  scheduleDates,
  extraInstructions,
  onSuccess
}: UseAIScheduleProps): UseAIScheduleReturn {
  const [aiScheduling, setAiScheduling] = useState(false)
  const [aiResults, setAiResults] = useState<AIScheduleResult[]>([])
  const [aiConflicts, setAiConflicts] = useState<AIScheduleResult[]>([])
  const [aiError, setAiError] = useState<string | null>(null)
  const [selectedAiResults, setSelectedAiResults] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  // AI排课
  const handleAISchedule = async () => {
    if (students.length === 0) {
      alert('没有需要排课的学生')
      return
    }

    if (teachers.length === 0) {
      alert('没有可用的助教')
      return
    }

    if (scheduleDates.length === 0) {
      alert('请先添加排课日期')
      return
    }

    try {
      setAiScheduling(true)
      setAiError(null)
      setAiResults([])
      setAiConflicts([])
      setSelectedAiResults(new Set())

      const apiUrl = await settingsDb.get('ai_api_url') || 'https://api.deepseek.com/v1'
      const apiKey = await settingsDb.get('ai_api_key')
      const model = await settingsDb.get('ai_model') || 'deepseek-chat'

      if (!apiKey) {
        alert('请先在设置页面配置 AI API Key')
        setAiScheduling(false)
        return
      }

      const userInput = buildSchedulePromptInput({
        students,
        teachers,
        targetDates: scheduleDates,
        extraInstructions
      })

      const response = await sendAIRequest(
        { api_url: apiUrl, api_key: apiKey, model, temperature: 0.7, max_tokens: 4096 },
        AI_SCHEDULE_SYSTEM_PROMPT,
        userInput
      )

      const results = parseAIScheduleResponse(response)

      if (!results) {
        setAiError('AI 返回的数据格式不正确，请重试')
        return
      }

      const { valid, conflicts } = validateScheduleResults(results)
      setAiResults(valid)
      setAiConflicts(conflicts)
      setSelectedAiResults(new Set(valid.filter(r => !r.unmatched).map(r => r.student_id)))

    } catch (error) {
      console.error('AI scheduling failed:', error)
      setAiError(`AI 排课失败：${(error as Error).message}`)
    } finally {
      setAiScheduling(false)
    }
  }

  const toggleAiResultSelection = (studentId: string) => {
    setSelectedAiResults(prev => {
      const newSet = new Set(prev)
      if (newSet.has(studentId)) {
        newSet.delete(studentId)
      } else {
        newSet.add(studentId)
      }
      return newSet
    })
  }

  const handleConfirmAISchedule = async () => {
    const toSave = aiResults.filter(r => selectedAiResults.has(r.student_id) && !r.unmatched)

    if (toSave.length === 0) {
      alert('请至少选择一个排课结果')
      return
    }

    try {
      setSaving(true)

      const results = await scheduledClassDb.batchCreate(
        toSave.map(r => ({
          student_id: r.student_id,
          teacher_id: r.teacher_id,
          class_date: r.date,
          start_time: r.start_time,
          end_time: r.end_time,
          duration_hours: r.duration_hours,
          notes: r.match_reason
        }))
      )

      alert(`排课完成：成功 ${results.success} 条，失败 ${results.failed} 条${results.conflicts.length > 0 ? `，冲突 ${results.conflicts.length} 条` : ''}`)

      setAiResults([])
      setAiConflicts([])
      setSelectedAiResults(new Set())
      onSuccess()

    } catch (error) {
      console.error('Failed to save AI schedule:', error)
      alert('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return {
    aiScheduling,
    aiResults,
    aiConflicts,
    aiError,
    selectedAiResults,
    setSelectedAiResults,
    handleAISchedule,
    toggleAiResultSelection,
    handleConfirmAISchedule,
    saving
  }
}