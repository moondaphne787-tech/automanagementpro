import { useEffect, useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/appStore'
import { classRecordDb } from '@/db'
import { GrowthOverviewTab } from './GrowthOverviewTab'
import { GrowthExamsTab } from './GrowthExamsTab'
import { GrowthVocabTab } from './GrowthVocabTab'
import { AutoLearningPhasesPanel, AutoPhase } from './AutoLearningPhasesPanel'
import type { ExamScore, VocabTest } from '@/types'

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
        <GrowthOverviewTab
          totalClasses={totalClasses}
          totalHours={totalHours}
          latestScore={latestScore}
          previousScore={previousScore}
          latestVocab={latestVocab}
          previousVocab={previousVocab}
          currentProgress={currentProgress}
          classRecords={classRecords}
          completionRateData={completionRateData}
          examScores={examScores}
        />
      )}

      {activeSection === 'exams' && (
        <GrowthExamsTab
          studentId={studentId}
          examScores={examScores}
          showForm={showExamForm}
          editingItem={editingExam}
          onAdd={() => { setShowExamForm(true); setEditingExam(null) }}
          onEdit={(score) => { setEditingExam(score); setShowExamForm(true) }}
          onSave={handleSaveExam}
          onCancel={() => { setShowExamForm(false); setEditingExam(null) }}
          onDelete={(id) => deleteExamScore(id)}
        />
      )}

      {activeSection === 'vocab' && (
        <GrowthVocabTab
          studentId={studentId}
          vocabTests={vocabTests}
          showForm={showVocabForm}
          editingItem={editingVocab}
          onAdd={() => { setShowVocabForm(true); setEditingVocab(null) }}
          onEdit={(test) => { setEditingVocab(test); setShowVocabForm(true) }}
          onSave={handleSaveVocab}
          onCancel={() => { setShowVocabForm(false); setEditingVocab(null) }}
          onDelete={(id) => deleteVocabTest(id)}
        />
      )}

      {activeSection === 'phases' && (
        <AutoLearningPhasesPanel
          classRecords={classRecords}
          examScores={examScores}
          phases={autoPhases}
        />
      )}
    </div>
  )
}
