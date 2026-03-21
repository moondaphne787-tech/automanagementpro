import { useState } from 'react'
import { Plus, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TaskBlock, createEmptyTask } from '@/components/TaskBlock/TaskBlock'
import { parseFeedback } from '@/utils/feedbackParser'
import type { TaskBlock as TaskBlockType, AttendanceType, PerformanceType, TaskCompletedType, Wordbank } from '@/types'

interface ClassRecordFormProps {
  studentId: string
  wordbanks?: Wordbank[]
  onSave: (data: {
    student_id: string
    class_date: string
    duration_hours: number
    teacher_name?: string
    attendance: AttendanceType
    tasks: TaskBlockType[]
    task_completed: TaskCompletedType
    incomplete_reason?: string
    performance: PerformanceType
    detail_feedback?: string
    highlights?: string
    issues?: string
    checkin_completed?: boolean
  }) => Promise<void>
  onCancel: () => void
  initialDate?: string
}

export function ClassRecordForm({ studentId, wordbanks = [], onSave, onCancel, initialDate }: ClassRecordFormProps) {
  const [classDate, setClassDate] = useState(initialDate || new Date().toISOString().split('T')[0])
  const [durationHours, setDurationHours] = useState(1)
  const [teacherName, setTeacherName] = useState('')
  const [attendance, setAttendance] = useState<AttendanceType>('present')
  const [tasks, setTasks] = useState<TaskBlockType[]>([createEmptyTask()])
  const [taskCompleted, setTaskCompleted] = useState<TaskCompletedType>('completed')
  const [incompleteReason, setIncompleteReason] = useState('')
  const [performance, setPerformance] = useState<PerformanceType>('good')
  const [detailFeedback, setDetailFeedback] = useState('')
  const [highlights, setHighlights] = useState('')
  const [issues, setIssues] = useState('')
  const [saving, setSaving] = useState(false)
  
  // 从学情反馈解析任务
  const handleParseFeedback = () => {
    if (!detailFeedback.trim()) return
    
    const parsedTasks = parseFeedback(detailFeedback)
    if (parsedTasks.length > 0) {
      setTasks(parsedTasks)
    }
  }
  
  // 添加任务
  const handleAddTask = () => {
    if (tasks.length < 4) {
      setTasks([...tasks, createEmptyTask()])
    }
  }
  
  // 删除任务
  const handleRemoveTask = (index: number) => {
    setTasks(tasks.filter((_, i) => i !== index))
  }
  
  // 更新任务
  const handleUpdateTask = (index: number, updatedTask: TaskBlockType) => {
    setTasks(tasks.map((task, i) => i === index ? updatedTask : task))
  }
  
  // 保存记录
  const handleSave = async () => {
    if (!classDate) {
      alert('请选择上课日期')
      return
    }
    
    // 过滤掉空任务
    const validTasks = tasks.filter(t => {
      if (['vocab_new', 'vocab_review', 'nine_grid'].includes(t.type)) {
        return t.wordbank_label && t.level_from && t.level_to
      }
      return t.content
    })
    
    if (validTasks.length === 0) {
      alert('请至少添加一个有效的任务')
      return
    }
    
    setSaving(true)
    
    try {
      await onSave({
        student_id: studentId,
        class_date: classDate,
        duration_hours: durationHours,
        teacher_name: teacherName || undefined,
        attendance,
        tasks: validTasks,
        task_completed: taskCompleted,
        incomplete_reason: incompleteReason || undefined,
        performance,
        detail_feedback: detailFeedback || undefined,
        highlights: highlights || undefined,
        issues: issues || undefined
      })
    } finally {
      setSaving(false)
    }
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>新建课堂记录</span>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 基本信息 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">上课日期 *</label>
            <Input
              type="date"
              value={classDate}
              onChange={(e) => setClassDate(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">课时时长（小时）</label>
            <Input
              type="number"
              step="0.5"
              min="0.5"
              max="4"
              value={durationHours}
              onChange={(e) => setDurationHours(parseFloat(e.target.value) || 1)}
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">助教老师</label>
            <Input
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
              placeholder="输入助教姓名"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">出勤状态</label>
            <Select
              value={attendance}
              options={[
                { value: 'present', label: '到课' },
                { value: 'late', label: '迟到' },
                { value: 'absent', label: '缺课' }
              ]}
              onChange={(e) => setAttendance(e.target.value as AttendanceType)}
            />
          </div>
        </div>
        
        {/* 任务列表 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium">学习任务</label>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddTask}
              disabled={tasks.length >= 4}
            >
              <Plus className="w-4 h-4 mr-1" />
              添加任务 ({tasks.length}/4)
            </Button>
          </div>
          
          <div className="space-y-3">
            {tasks.map((task, index) => (
              <TaskBlock
                key={index}
                task={task}
                index={index}
                editable
                wordbanks={wordbanks}
                onChange={(updated) => handleUpdateTask(index, updated)}
                onDelete={tasks.length > 1 ? () => handleRemoveTask(index) : undefined}
              />
            ))}
          </div>
        </div>
        
        {/* 任务完成状态 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">任务完成情况</label>
            <Select
              value={taskCompleted}
              options={[
                { value: 'completed', label: '全部完成' },
                { value: 'partial', label: '部分完成' },
                { value: 'not_completed', label: '未完成' }
              ]}
              onChange={(e) => setTaskCompleted(e.target.value as TaskCompletedType)}
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">课堂表现</label>
            <Select
              value={performance}
              options={[
                { value: 'excellent', label: '优秀' },
                { value: 'good', label: '良好' },
                { value: 'needs_improvement', label: '待提高' }
              ]}
              onChange={(e) => setPerformance(e.target.value as PerformanceType)}
            />
          </div>
        </div>
        
        {taskCompleted !== 'completed' && (
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">未完成原因</label>
            <Input
              value={incompleteReason}
              onChange={(e) => setIncompleteReason(e.target.value)}
              placeholder="请输入未完成原因"
            />
          </div>
        )}
        
        {/* 学情反馈 */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm text-muted-foreground">学情反馈</label>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleParseFeedback}
              disabled={!detailFeedback.trim()}
            >
              从反馈解析任务
            </Button>
          </div>
          <textarea
            value={detailFeedback}
            onChange={(e) => setDetailFeedback(e.target.value)}
            placeholder="粘贴学情反馈长文本，系统将自动解析学习内容..."
            className="w-full h-32 px-3 py-2 border rounded-lg resize-none text-sm"
          />
        </div>
        
        {/* 亮点和问题 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">亮点记录</label>
            <textarea
              value={highlights}
              onChange={(e) => setHighlights(e.target.value)}
              placeholder="学员亮点..."
              className="w-full h-20 px-3 py-2 border rounded-lg resize-none text-sm"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">问题记录</label>
            <textarea
              value={issues}
              onChange={(e) => setIssues(e.target.value)}
              placeholder="需要关注的问题..."
              className="w-full h-20 px-3 py-2 border rounded-lg resize-none text-sm"
            />
          </div>
        </div>
        
        {/* 操作按钮 */}
        <div className="flex justify-end gap-3 pt-3 border-t">
          <Button variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-1" />
            {saving ? '保存中...' : '保存记录'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}