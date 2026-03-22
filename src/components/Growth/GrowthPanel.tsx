import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { DateInput } from '@/components/ui/date-input'
import { Plus, Trash2, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { formatDate, cn } from '@/lib/utils'
import type { ExamScore, StudentWordbankProgress, ClassRecord, LearningPhase, TaskBlock } from '@/types'
import { ExamType } from '@/types'

// 考试类型标签
const EXAM_TYPE_LABELS: Record<ExamType, string> = {
  school_exam: '学校考试',
  placement: '分班考试',
  mock: '模拟考试'
}

// 成绩趋势图组件（简化版，使用条形图）
function ScoreChart({ scores }: { scores: ExamScore[] }) {
  if (scores.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        暂无成绩记录
      </div>
    )
  }

  const sortedScores = [...scores].sort((a, b) => a.exam_date.localeCompare(b.exam_date))
  const maxScore = Math.max(...sortedScores.map(s => s.full_score || 100))

  return (
    <div className="space-y-3">
      {sortedScores.map((score, index) => {
        const percentage = score.score != null ? (score.score / (score.full_score || 100)) * 100 : 0
        const prevScore = index > 0 ? sortedScores[index - 1] : null
        const trend = prevScore && score.score != null && prevScore.score != null
          ? score.score > prevScore.score ? 'up' : score.score < prevScore.score ? 'down' : 'same'
          : null

        return (
          <div key={score.id} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="truncate flex-1">
                {score.exam_name || EXAM_TYPE_LABELS[score.exam_type]}
                <span className="text-muted-foreground ml-2 text-xs">
                  {score.exam_date}
                </span>
              </span>
              <span className="flex items-center gap-1">
                {score.score ?? '-'}/{score.full_score || 100}
                {trend && (
                  trend === 'up' ? <TrendingUp className="w-3 h-3 text-green-500" /> :
                  trend === 'down' ? <TrendingDown className="w-3 h-3 text-red-500" /> :
                  <Minus className="w-3 h-3 text-muted-foreground" />
                )}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full transition-all",
                  percentage >= 80 ? "bg-green-500" :
                  percentage >= 60 ? "bg-blue-500" :
                  percentage >= 40 ? "bg-yellow-500" : "bg-red-500"
                )}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// 词库进度汇总
function WordbankProgressSummary({ progress }: { progress: StudentWordbankProgress[] }) {
  if (progress.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-4">
        暂无词库进度
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {progress.map((p) => {
        const percentage = Math.round((p.current_level / (p.total_levels_override || 60)) * 100)
        return (
          <div key={p.id} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span>{p.wordbank_label}</span>
              <span className="text-muted-foreground">
                第 {p.current_level} 关 ({percentage}%)
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// 任务统计
function TaskStats({ records }: { records: ClassRecord[] }) {
  const taskStats = records.reduce((acc, record) => {
    record.tasks.forEach((task) => {
      const type = task.type
      acc[type] = (acc[type] || 0) + 1
    })
    return acc
  }, {} as Record<string, number>)

  const taskLabels: Record<string, string> = {
    phonics: '语音训练',
    vocab_new: '词库学习',
    vocab_review: '词库复习',
    nine_grid: '九宫格清理',
    textbook: '课文梳理',
    reading: '阅读训练',
    picture_book: '绘本阅读',
    exercise: '专项练习',
    other: '其他'
  }

  const sortedStats = Object.entries(taskStats).sort((a, b) => b[1] - a[1])

  if (sortedStats.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-4">
        暂无任务记录
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {sortedStats.map(([type, count]) => (
        <div key={type} className="flex items-center justify-between text-sm">
          <span>{taskLabels[type] || type}</span>
          <span className="text-muted-foreground">{count} 次</span>
        </div>
      ))}
    </div>
  )
}

// 课堂表现统计
function PerformanceStats({ records }: { records: ClassRecord[] }) {
  const stats = records.reduce((acc, record) => {
    acc[record.performance] = (acc[record.performance] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const labels: Record<string, { label: string; color: string }> = {
    excellent: { label: '表现优秀', color: 'bg-green-500' },
    good: { label: '表现良好', color: 'bg-blue-500' },
    needs_improvement: { label: '待提高', color: 'bg-orange-500' }
  }

  const total = records.length

  if (total === 0) {
    return (
      <div className="text-center text-muted-foreground py-4">
        暂无课堂记录
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1 h-4 rounded-full overflow-hidden">
        {(['excellent', 'good', 'needs_improvement'] as const).map((type) => {
          const count = stats[type] || 0
          const percentage = (count / total) * 100
          if (percentage === 0) return null
          return (
            <div 
              key={type}
              className={labels[type].color}
              style={{ width: `${percentage}%` }}
              title={`${labels[type].label}: ${count}次`}
            />
          )
        })}
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        {(['excellent', 'good', 'needs_improvement'] as const).map((type) => (
          <div key={type} className="flex items-center gap-2">
            <div className={cn("w-3 h-3 rounded", labels[type].color)} />
            <span>{labels[type].label}: {stats[type] || 0}次</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// 考试成绩表单
function ExamScoreForm({ 
  studentId, 
  onSave, 
  onCancel,
  initialData 
}: { 
  studentId: string
  onSave: (data: any) => void
  onCancel: () => void
  initialData?: ExamScore
}) {
  const [form, setForm] = useState<{
    exam_date: string
    exam_name: string
    exam_type: 'school_exam' | 'placement' | 'mock'
    score: string
    full_score: string
    notes: string
  }>({
    exam_date: initialData?.exam_date || new Date().toISOString().split('T')[0],
    exam_name: initialData?.exam_name || '',
    exam_type: initialData?.exam_type || 'school_exam',
    score: initialData?.score?.toString() || '',
    full_score: initialData?.full_score?.toString() || '100',
    notes: initialData?.notes || ''
  })

  const handleSubmit = () => {
    onSave({
      student_id: studentId,
      exam_date: form.exam_date,
      exam_name: form.exam_name || undefined,
      exam_type: form.exam_type,
      score: form.score ? parseInt(form.score) : undefined,
      full_score: form.full_score ? parseInt(form.full_score) : 100,
      notes: form.notes || undefined
    })
  }

  return (
    <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">考试日期</label>
          <DateInput
            value={form.exam_date}
            onChange={(val) => setForm({ ...form, exam_date: val })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">考试类型</label>
          <Select
            value={form.exam_type}
            onChange={(e) => setForm({ ...form, exam_type: e.target.value as 'school_exam' | 'placement' | 'mock' })}
            options={[
              { value: 'school_exam', label: '学校考试' },
              { value: 'placement', label: '分班考试' },
              { value: 'mock', label: '模拟考试' }
            ]}
          />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">考试名称</label>
        <Input
          value={form.exam_name}
          onChange={(e) => setForm({ ...form, exam_name: e.target.value })}
          placeholder="如：期中考试、月考等"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">得分</label>
          <Input
            type="number"
            value={form.score}
            onChange={(e) => setForm({ ...form, score: e.target.value })}
            placeholder="分数"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">满分</label>
          <Input
            type="number"
            value={form.full_score}
            onChange={(e) => setForm({ ...form, full_score: e.target.value })}
            placeholder="100"
          />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">备注</label>
        <Input
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="可选备注"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>取消</Button>
        <Button onClick={handleSubmit}>保存</Button>
      </div>
    </div>
  )
}

// 主组件
export function GrowthPanel({ studentId }: { studentId: string }) {
  const { 
    examScores, 
    loadExamScores, 
    createExamScore, 
    updateExamScore, 
    deleteExamScore,
    currentProgress,
    classRecords,
    learningPhases,
    loadLearningPhases,
    createLearningPhase,
    updateLearningPhase,
    deleteLearningPhase
  } = useAppStore()

  const [showExamForm, setShowExamForm] = useState(false)
  const [editingExam, setEditingExam] = useState<ExamScore | null>(null)
  const [activeSection, setActiveSection] = useState<'overview' | 'exams' | 'phases'>('overview')

  useEffect(() => {
    loadExamScores(studentId)
    loadLearningPhases(studentId)
  }, [studentId])

  const handleSaveExam = async (data: any) => {
    if (editingExam) {
      await updateExamScore(editingExam.id, data)
    } else {
      await createExamScore(data)
    }
    setShowExamForm(false)
    setEditingExam(null)
  }

  // 计算统计数据
  const totalClasses = classRecords.length
  const totalHours = classRecords.reduce((sum, r) => sum + r.duration_hours, 0)
  const latestScore = examScores[0]
  const previousScore = examScores[1]

  return (
    <div className="space-y-6">
      {/* Tab 切换 */}
      <div className="flex gap-2 border-b pb-2">
        <Button 
          variant={activeSection === 'overview' ? 'default' : 'ghost'}
          onClick={() => setActiveSection('overview')}
        >
          总览
        </Button>
        <Button 
          variant={activeSection === 'exams' ? 'default' : 'ghost'}
          onClick={() => setActiveSection('exams')}
        >
          考试成绩
        </Button>
        <Button 
          variant={activeSection === 'phases' ? 'default' : 'ghost'}
          onClick={() => setActiveSection('phases')}
        >
          学习阶段
        </Button>
      </div>

      {activeSection === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 概览卡片 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">学习概览</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-semibold">{totalClasses}</div>
                  <div className="text-xs text-muted-foreground">总课次</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-semibold">{totalHours.toFixed(1)}h</div>
                  <div className="text-xs text-muted-foreground">总课时</div>
                </div>
              </div>
              
              {latestScore && (
                <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">最近考试成绩</span>
                    <span className="font-semibold">
                      {latestScore.score ?? '-'}/{latestScore.full_score || 100}
                    </span>
                  </div>
                  {previousScore && latestScore.score != null && previousScore.score != null && (
                    <div className="flex items-center gap-1 text-xs mt-1">
                      {latestScore.score > previousScore.score ? (
                        <span className="text-green-600">
                          <TrendingUp className="w-3 h-3 inline mr-1" />
                          较上次提升 {latestScore.score - previousScore.score} 分
                        </span>
                      ) : latestScore.score < previousScore.score ? (
                        <span className="text-red-600">
                          <TrendingDown className="w-3 h-3 inline mr-1" />
                          较上次下降 {previousScore.score - latestScore.score} 分
                        </span>
                      ) : (
                        <span className="text-muted-foreground">成绩持平</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 词库进度 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">词库进度</CardTitle>
            </CardHeader>
            <CardContent>
              <WordbankProgressSummary progress={currentProgress} />
            </CardContent>
          </Card>

          {/* 课堂表现 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">课堂表现分布</CardTitle>
            </CardHeader>
            <CardContent>
              <PerformanceStats records={classRecords} />
            </CardContent>
          </Card>

          {/* 任务统计 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">任务类型统计</CardTitle>
            </CardHeader>
            <CardContent>
              <TaskStats records={classRecords} />
            </CardContent>
          </Card>

          {/* 成绩趋势 */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">成绩趋势</CardTitle>
            </CardHeader>
            <CardContent>
              <ScoreChart scores={examScores} />
            </CardContent>
          </Card>
        </div>
      )}

      {activeSection === 'exams' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">考试成绩记录</h3>
            <Button onClick={() => { setShowExamForm(true); setEditingExam(null) }}>
              <Plus className="w-4 h-4 mr-1" />
              添加成绩
            </Button>
          </div>

          {showExamForm && (
            <ExamScoreForm
              studentId={studentId}
              onSave={handleSaveExam}
              onCancel={() => { setShowExamForm(false); setEditingExam(null) }}
              initialData={editingExam || undefined}
            />
          )}

          {examScores.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              暂无考试成绩记录
            </div>
          ) : (
            <div className="space-y-3">
              {examScores.map((score) => {
                const percentage = score.score != null 
                  ? Math.round((score.score / (score.full_score || 100)) * 100) 
                  : null

                return (
                  <Card key={score.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {score.exam_name || EXAM_TYPE_LABELS[score.exam_type]}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {score.exam_date}
                            </span>
                            <span className={cn(
                              "text-xs px-2 py-0.5 rounded",
                              score.exam_type === 'school_exam' && "bg-blue-500/10 text-blue-600",
                              score.exam_type === 'placement' && "bg-purple-500/10 text-purple-600",
                              score.exam_type === 'mock' && "bg-orange-500/10 text-orange-600"
                            )}>
                              {EXAM_TYPE_LABELS[score.exam_type]}
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-lg font-semibold">
                              {score.score ?? '-'}/{score.full_score || 100}
                            </span>
                            {percentage != null && (
                              <span className={cn(
                                "text-sm",
                                percentage >= 80 ? "text-green-600" :
                                percentage >= 60 ? "text-blue-600" :
                                percentage >= 40 ? "text-yellow-600" : "text-red-600"
                              )}>
                                {percentage}%
                              </span>
                            )}
                          </div>
                          {score.notes && (
                            <p className="text-sm text-muted-foreground">{score.notes}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => { setEditingExam(score); setShowExamForm(true) }}
                          >
                            编辑
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="text-destructive"
                            onClick={async () => {
                              if (confirm('确定删除此成绩记录？')) {
                                await deleteExamScore(score.id)
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
        </div>
      )}

      {activeSection === 'phases' && (
        <LearningPhasesPanel studentId={studentId} />
      )}
    </div>
  )
}

// 学习阶段面板
function LearningPhasesPanel({ studentId }: { studentId: string }) {
  const { 
    learningPhases, 
    createLearningPhase, 
    updateLearningPhase, 
    deleteLearningPhase,
    classRecords,
    currentProgress,
    examScores
  } = useAppStore()

  const [showForm, setShowForm] = useState(false)
  const [editingPhase, setEditingPhase] = useState<LearningPhase | null>(null)
  const [form, setForm] = useState({
    phase_name: '',
    phase_type: 'semester' as 'semester' | 'summer' | 'winter',
    start_date: '',
    end_date: '',
    goal: '',
    vocab_start: '',
    vocab_end: '',
    summary: ''
  })

  const resetForm = () => {
    setForm({
      phase_name: '',
      phase_type: 'semester',
      start_date: '',
      end_date: '',
      goal: '',
      vocab_start: '',
      vocab_end: '',
      summary: ''
    })
    setEditingPhase(null)
  }

  const handleSave = async () => {
    const data = {
      student_id: studentId,
      phase_name: form.phase_name || undefined,
      phase_type: form.phase_type,
      start_date: form.start_date || undefined,
      end_date: form.end_date || undefined,
      goal: form.goal || undefined,
      vocab_start: form.vocab_start ? parseInt(form.vocab_start) : undefined,
      vocab_end: form.vocab_end ? parseInt(form.vocab_end) : undefined,
      summary: form.summary || undefined
    }

    if (editingPhase) {
      await updateLearningPhase(editingPhase.id, data)
    } else {
      await createLearningPhase(data)
    }

    setShowForm(false)
    resetForm()
  }

  const handleEdit = (phase: LearningPhase) => {
    setEditingPhase(phase)
    setForm({
      phase_name: phase.phase_name || '',
      phase_type: phase.phase_type || 'semester',
      start_date: phase.start_date || '',
      end_date: phase.end_date || '',
      goal: phase.goal || '',
      vocab_start: phase.vocab_start?.toString() || '',
      vocab_end: phase.vocab_end?.toString() || '',
      summary: phase.summary || ''
    })
    setShowForm(true)
  }

  const phaseTypeLabels: Record<string, string> = {
    semester: '学期',
    summer: '暑假',
    winter: '寒假'
  }

  // 计算阶段内的统计数据
  const getPhaseStats = (phase: LearningPhase) => {
    const startDate = phase.start_date || '2000-01-01'
    const endDate = phase.end_date || new Date().toISOString().split('T')[0]

    // 筛选阶段内的课堂记录
    const phaseRecords = classRecords.filter(r => 
      r.class_date >= startDate && r.class_date <= endDate
    )

    // 筛选阶段内的考试成绩
    const phaseScores = examScores.filter(s =>
      s.exam_date >= startDate && s.exam_date <= endDate
    )

    return {
      classCount: phaseRecords.length,
      totalHours: phaseRecords.reduce((sum, r) => sum + r.duration_hours, 0),
      scoreCount: phaseScores.length,
      avgScore: phaseScores.length > 0 && phaseScores.some(s => s.score != null)
        ? Math.round(phaseScores.filter(s => s.score != null).reduce((sum, s) => sum + (s.score || 0), 0) / phaseScores.filter(s => s.score != null).length)
        : null
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">学习阶段</h3>
        <Button onClick={() => { setShowForm(true); resetForm() }}>
          <Plus className="w-4 h-4 mr-1" />
          新建阶段
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">阶段名称</label>
                <Input
                  value={form.phase_name}
                  onChange={(e) => setForm({ ...form, phase_name: e.target.value })}
                  placeholder="如：2025年春季学期"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">阶段类型</label>
                <Select
                  value={form.phase_type}
                  onChange={(e) => setForm({ ...form, phase_type: e.target.value as any })}
                  options={[
                    { value: 'semester', label: '学期' },
                    { value: 'summer', label: '暑假' },
                    { value: 'winter', label: '寒假' }
                  ]}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">开始日期</label>
                <DateInput
                  value={form.start_date}
                  onChange={(val) => setForm({ ...form, start_date: val })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">结束日期</label>
                <DateInput
                  value={form.end_date}
                  onChange={(val) => setForm({ ...form, end_date: val })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">阶段目标</label>
              <Input
                value={form.goal}
                onChange={(e) => setForm({ ...form, goal: e.target.value })}
                placeholder="如：完成初中考纲、词汇量达到1600"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">起始词汇量</label>
                <Input
                  type="number"
                  value={form.vocab_start}
                  onChange={(e) => setForm({ ...form, vocab_start: e.target.value })}
                  placeholder="可选"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">结束词汇量</label>
                <Input
                  type="number"
                  value={form.vocab_end}
                  onChange={(e) => setForm({ ...form, vocab_end: e.target.value })}
                  placeholder="可选"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">阶段总结</label>
              <Input
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                placeholder="阶段结束后的总结"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setShowForm(false); resetForm() }}>
                取消
              </Button>
              <Button onClick={handleSave}>
                {editingPhase ? '更新' : '创建'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {learningPhases.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          暂无学习阶段记录
        </div>
      ) : (
        <div className="space-y-4">
          {learningPhases.map((phase) => {
            const stats = getPhaseStats(phase)

            return (
              <Card key={phase.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {phase.phase_name || '未命名阶段'}
                        </span>
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded",
                          phase.phase_type === 'semester' && "bg-blue-500/10 text-blue-600",
                          phase.phase_type === 'summer' && "bg-orange-500/10 text-orange-600",
                          phase.phase_type === 'winter' && "bg-cyan-500/10 text-cyan-600"
                        )}>
                          {phaseTypeLabels[phase.phase_type]}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {phase.start_date} ~ {phase.end_date || '进行中'}
                      </div>
                      
                      {/* 阶段内统计 */}
                      <div className="grid grid-cols-4 gap-3 mt-3">
                        <div className="text-center p-2 bg-muted/50 rounded">
                          <div className="font-semibold">{stats.classCount}</div>
                          <div className="text-xs text-muted-foreground">课次</div>
                        </div>
                        <div className="text-center p-2 bg-muted/50 rounded">
                          <div className="font-semibold">{stats.totalHours.toFixed(1)}h</div>
                          <div className="text-xs text-muted-foreground">课时</div>
                        </div>
                        <div className="text-center p-2 bg-muted/50 rounded">
                          <div className="font-semibold">{stats.scoreCount}</div>
                          <div className="text-xs text-muted-foreground">考试</div>
                        </div>
                        <div className="text-center p-2 bg-muted/50 rounded">
                          <div className="font-semibold">{stats.avgScore ?? '-'}</div>
                          <div className="text-xs text-muted-foreground">平均分</div>
                        </div>
                      </div>

                      {phase.goal && (
                        <div className="mt-2">
                          <span className="text-xs text-muted-foreground">目标：</span>
                          <span className="text-sm">{phase.goal}</span>
                        </div>
                      )}

                      {phase.vocab_start != null && phase.vocab_end != null && (
                        <div className="mt-1 text-sm">
                          词汇量：{phase.vocab_start} → {phase.vocab_end}
                          <span className="text-green-600 ml-1">
                            (+{phase.vocab_end - phase.vocab_start})
                          </span>
                        </div>
                      )}

                      {phase.summary && (
                        <div className="mt-2 p-2 bg-muted/30 rounded text-sm">
                          <span className="text-muted-foreground">总结：</span>
                          {phase.summary}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleEdit(phase)}
                      >
                        编辑
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-destructive"
                        onClick={async () => {
                          if (confirm('确定删除此学习阶段？')) {
                            await deleteLearningPhase(phase.id)
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
    </div>
  )
}