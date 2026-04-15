import { useMemo } from 'react'
import { HOUR_WIDTH } from './constants'
import type { Student, Teacher } from '@/types'
import type { AIScheduleResult } from '@/ai/schedulePrompts'

interface AIPreviewSectionProps {
  aiResults: AIScheduleResult[]
  students: Student[]
  teachers: Teacher[]
  timeRange: { start: number; end: number }
}

export function AIPreviewSection({ aiResults, students, teachers, timeRange }: AIPreviewSectionProps) {
  const totalWidth = ((timeRange.end - timeRange.start) / 60) * HOUR_WIDTH

  if (aiResults.length === 0) return null

  return (
    <div className="border-t border-dashed border-primary/30 bg-primary/5">
      <div className="h-6 flex items-center px-4 border-b border-dashed border-primary/20">
        <span className="text-[10px] font-medium text-primary">
          ✨ AI 排课预览 ({aiResults.length})
        </span>
      </div>
      {aiResults.map((result, idx) => {
        const student = students.find(s => s.id === result.student_id)
        const teacher = teachers.find(t => t.id === result.teacher_id)
        const startMin = parseInt(result.start_time.split(':')[0]) * 60 + parseInt(result.start_time.split(':')[1])
        const endMin = parseInt(result.end_time.split(':')[0]) * 60 + parseInt(result.end_time.split(':')[1])
        const left = ((startMin - timeRange.start) / 60) * HOUR_WIDTH
        const width = ((endMin - startMin) / 60) * HOUR_WIDTH

        return (
          <div key={idx} className="flex border-b border-dashed border-primary/10" style={{ height: '48px' }}>
            <div className="w-32 flex-shrink-0 border-r px-2 flex flex-col justify-center">
              <div className="text-xs font-medium text-primary truncate">{student?.name || '未知'}</div>
              <div className="text-[10px] text-primary/60">{teacher?.name || '未指定'}</div>
            </div>
            <div className="flex-1 overflow-hidden">
              <div
                data-scroll-sync="timeline"
                className="relative h-full"
                style={{ width: `${totalWidth}px`, transform: 'translateX(0px)' }}
              >
                {Array.from({ length: (timeRange.end - timeRange.start) / 60 + 1 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 border-l border-dashed border-muted"
                    style={{ left: `${i * HOUR_WIDTH}px` }}
                  />
                ))}
                <div
                  className="absolute top-1.5 bottom-1.5 rounded-lg border-2 border-dashed border-primary/50 bg-primary/10 flex items-center justify-center"
                  style={{
                    left: `${left}px`,
                    width: `${Math.max(width - 2, 40)}px`,
                  }}
                >
                  <span className="text-[10px] text-primary font-medium truncate px-1">
                    {result.start_time.slice(0, 5)}-{result.end_time.slice(0, 5)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
