import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Trash2, TrendingUp, TrendingDown } from 'lucide-react'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { useAppStore } from '@/store/appStore'
import { cn } from '@/lib/utils'
import { classRecordDb } from '@/db'
import { CompletionRateChart } from './CompletionRateChart'
import { ScoreChart, EXAM_TYPE_LABELS } from './ScoreChart'
import { WordbankProgressSummary } from './WordbankProgressSummary'
import { TaskStats } from './TaskStats'
import { PerformanceStats } from './PerformanceStats'
import { ExamScoreForm } from './ExamScoreForm'
import { VocabTestForm } from './VocabTestForm'
import { VocabChart } from './VocabChart'
import { AutoLearningPhasesPanel, AutoPhase } from './AutoLearningPhasesPanel'
import type { ExamScore, VocabTest, PhaseType } from '@/types'
import { ExamType } from '@/types'

// 学期配置接口
interface SemesterConfig {
  spring_start: string
  spring_end: string
  summer_start: string
  summer_end: string
  autumn_start: string
  autumn_end: string
  winter_start: string
  winter_end: string
}

// 主组件
export function GrowthPanel({ studentId }: { studentId: string }) {
  const examScores = useAppStore(s => s.examScores)
  const loadExamScores = useAppStore(s => s.loadExamScores)
  const createExamScore = useAppStore(s => s.createExamScore)
  const updateExamScore = useAppStore(s => s.updateExamScore)
  const deleteExamScore = useAppStore(s => s.deleteExamScore)
  const vocabTests = useAppStore(s => s.vocabTests)
  const loadVocabTests = useAppStore(s => s.loadVocabTests)
  const createVocabTest = useAppStore(s => s.createVocabTest)
  const updateVocabTest = useAppStore(s => s.updateVocabTest)
  const deleteVocabTest = useAppStore(s => s.deleteVocabTest)
  const currentProgress = useAppStore(s => s.currentProgress)
  const classRecords = useAppStore(s => s.classRecords)
  const loadClassRecords = useAppStore(s => s.loadClassRecords)
  const loadSemesterConfig = useAppStore(s => s.loadSemesterConfig)

  const [showExamForm, setShowExamForm] = useState(false)
  const [editingExam, setEditingExam] = useState<ExamScore | null>(null)
  const [showVocabForm, setShowVocabForm] = useState(false)
  const [editingVocab, setEditingVocab] = useState<VocabTest | null>(null)
  const [activeSection, setActiveSection] = useState<'overview' | 'exams' | 'vocab' | 'phases'>('overview')

  // 完成率趋势数据
  const [completionRateData, setCompletionRateData] = useState<{ date: string; total: number; completed: number; rate: number }[]>([])

  // 从 store 获取学期配置
  const semesterConfig = useAppStore(state => state.semesterConfig)

  useEffect(() => {
    loadClassRecords(studentId)
    loadExamScores(studentId)
    loadVocabTests(studentId)
    loadSemesterConfig()
    loadCompletionRateData(studentId)
  }, [studentId])

  const loadCompletionRateData = async (studentId: string) => {
    const data = await classRecordDb.getCompletionRateStats(studentId, 12) // 最近12周
    setCompletionRateData(data)
  }

  // 使用 useMemo 缓存自动计算的学习阶段列表
  const autoPhases = useMemo(() => {
    const phases: AutoPhase[] = []
    const today = new Date().toISOString().split('T')[0]
    const currentYear = new Date().getFullYear()

    // 如果学期配置未加载，返回空数组
    if (!semesterConfig) return []

    // 辅助函数：判断阶段状态
    const getPhaseStatus = (start: string, end: string) => {
      const isActive = start <= today && (!end || end >= today)
      const isCompleted = !!end && end < today
      return { isActive, isCompleted }
    }

    // 春季学期
    if (semesterConfig.spring_start && semesterConfig.spring_end) {
      const { isActive, isCompleted } = getPhaseStatus(semesterConfig.spring_start, semesterConfig.spring_end)
      phases.push({
        id: 'spring',
        name: `${currentYear}年春季学期`,
        type: 'semester',
        startDate: semesterConfig.spring_start,
        endDate: semesterConfig.spring_end,
        isActive,
        isCompleted
      })
    }

    // 暑假
    if (semesterConfig.summer_start && semesterConfig.summer_end) {
      const { isActive, isCompleted } = getPhaseStatus(semesterConfig.summer_start, semesterConfig.summer_end)
      phases.push({
        id: 'summer',
        name: `${currentYear}年暑假`,
        type: 'summer',
        startDate: semesterConfig.summer_start,
        endDate: semesterConfig.summer_end,
        isActive,
        isCompleted
      })
    }

    // 秋季学期
    if (semesterConfig.autumn_start && semesterConfig.autumn_end) {
      const { isActive, isCompleted } = getPhaseStatus(semesterConfig.autumn_start, semesterConfig.autumn_end)
      phases.push({
        id: 'autumn',
        name: `${currentYear}年秋季学期`,
        type: 'semester',
        startDate: semesterConfig.autumn_start,
        endDate: semesterConfig.autumn_end,
        isActive,
        isCompleted
      })
    }

    // 寒假
    if (semesterConfig.winter_start && semesterConfig.winter_end) {
      const { isActive, isCompleted } = getPhaseStatus(semesterConfig.winter_start, semesterConfig.winter_end)
      phases.push({
        id: 'winter',
        name: `${currentYear}年寒假`,
        type: 'winter',
        startDate: semesterConfig.winter_start,
        endDate: semesterConfig.winter_end,
        isActive,
        isCompleted
      })
    }

    return phases
  }, [semesterConfig])

  const handleSaveExam = async (data: any) => {
    if (editingExam) {
      await updateExamScore(editingExam.id, data)
    } else {
      await createExamScore(data)
    }
    setShowExamForm(false)
    setEditingExam(null)
  }

  const handleSaveVocab = async (data: any) => {
    if (editingVocab) {
      await updateVocabTest(editingVocab.id, data)
    } else {
      await createVocabTest(data)
    }
    setShowVocabForm(false)
    setEditingVocab(null)
  }

  // 计算统计数据
  const totalClasses = classRecords.length
  const totalHours = classRecords.reduce((sum, r) => sum + r.duration_hours, 0)
  const latestScore = examScores[0]
  const previousScore = examScores[1]
  const latestVocab = vocabTests[0]
  const previousVocab = vocabTests[1]

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
          variant={activeSection === 'vocab' ? 'default' : 'ghost'}
          onClick={() => setActiveSection('vocab')}
        >
          词汇量
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

              {latestVocab && (
                <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">最近词汇量</span>
                    <span className="font-semibold">{latestVocab.vocab_count} 词</span>
                  </div>
                  {previousVocab && (
                    <div className="flex items-center gap-1 text-xs mt-1">
                      {latestVocab.vocab_count > previousVocab.vocab_count ? (
                        <span className="text-green-600">
                          <TrendingUp className="w-3 h-3 inline mr-1" />
                          较上次增长 {latestVocab.vocab_count - previousVocab.vocab_count} 词
                        </span>
                      ) : latestVocab.vocab_count < previousVocab.vocab_count ? (
                        <span className="text-red-600">
                          <TrendingDown className="w-3 h-3 inline mr-1" />
                          较上次减少 {previousVocab.vocab_count - latestVocab.vocab_count} 词
                        </span>
                      ) : (
                        <span className="text-muted-foreground">词汇量持平</span>
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

          {/* 完成率趋势 */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">任务完成率趋势（近12周）</CardTitle>
            </CardHeader>
            <CardContent>
              <CompletionRateChart data={completionRateData} />
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
                              const confirmed = await confirmDialog({
                                title: '删除成绩记录',
                                message: '确定删除此成绩记录？',
                                confirmText: '删除',
                                variant: 'danger'
                              })
                              if (confirmed) {
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

      {activeSection === 'vocab' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">词汇量测试记录</h3>
            <Button onClick={() => { setShowVocabForm(true); setEditingVocab(null) }}>
              <Plus className="w-4 h-4 mr-1" />
              添加记录
            </Button>
          </div>

          {showVocabForm && (
            <VocabTestForm
              studentId={studentId}
              onSave={handleSaveVocab}
              onCancel={() => { setShowVocabForm(false); setEditingVocab(null) }}
              initialData={editingVocab || undefined}
            />
          )}

          {/* 词汇量增长趋势图 */}
          {vocabTests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">词汇量增长趋势</CardTitle>
              </CardHeader>
              <CardContent>
                <VocabChart tests={vocabTests} />
              </CardContent>
            </Card>
          )}

          {vocabTests.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              暂无词汇量测试记录
            </div>
          ) : (
            <div className="space-y-3">
              {vocabTests.map((test) => (
                <Card key={test.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-semibold">{test.vocab_count} 词</span>
                          <span className="text-xs text-muted-foreground">{test.test_date}</span>
                          {test.test_source && (
                            <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600">
                              {test.test_source}
                            </span>
                          )}
                        </div>
                        {test.notes && (
                          <p className="text-sm text-muted-foreground">{test.notes}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setEditingVocab(test); setShowVocabForm(true) }}
                        >
                          编辑
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={async () => {
                            const confirmed = await confirmDialog({
                              title: '删除词汇量记录',
                              message: '确定删除此词汇量测试记录？',
                              confirmText: '删除',
                              variant: 'danger'
                            })
                            if (confirmed) {
                              await deleteVocabTest(test.id)
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
        </div>
      )}

      {activeSection === 'phases' && (
        <AutoLearningPhasesPanel
          studentId={studentId}
          classRecords={classRecords}
          examScores={examScores}
          phases={autoPhases}
        />
      )}
    </div>
  )
}
