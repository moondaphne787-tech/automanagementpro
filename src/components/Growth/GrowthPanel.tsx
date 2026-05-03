import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/appStore'
import { classRecordDb } from '@/db'
import { GrowthOverviewTab } from './GrowthOverviewTab'
import { GrowthExamsTab } from './GrowthExamsTab'
import { GrowthVocabTab } from './GrowthVocabTab'
import type { ExamScore, VocabTest } from '@/types'

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

  const [showExamForm, setShowExamForm] = useState(false)
  const [editingExam, setEditingExam] = useState<ExamScore | null>(null)
  const [showVocabForm, setShowVocabForm] = useState(false)
  const [editingVocab, setEditingVocab] = useState<VocabTest | null>(null)
  const [activeSection, setActiveSection] = useState<'overview' | 'exams' | 'vocab'>('overview')

  // 完成率趋势数据
  const [completionRateData, setCompletionRateData] = useState<{ date: string; total: number; completed: number; rate: number }[]>([])

  useEffect(() => {
    loadClassRecords(studentId)
    loadExamScores(studentId)
    loadVocabTests(studentId)
    loadCompletionRateData(studentId)
  }, [studentId])

  const loadCompletionRateData = async (studentId: string) => {
    const data = await classRecordDb.getCompletionRateStats(studentId, 12) // 最近12周
    setCompletionRateData(data)
  }

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
    </div>
  )
}
