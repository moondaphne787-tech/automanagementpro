import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WordbankProgressSummary } from './WordbankProgressSummary'
import { PerformanceStats, TaskStats, CompletionRateChart } from './ClassStats'
import { ScoreChart } from './ScoreChart'
import type { ExamScore, VocabTest, ClassRecord } from '@/types'

interface GrowthOverviewTabProps {
  totalClasses: number
  totalHours: number
  latestScore?: ExamScore
  previousScore?: ExamScore
  latestVocab?: VocabTest
  previousVocab?: VocabTest
  currentProgress: any
  classRecords: ClassRecord[]
  completionRateData: { date: string; total: number; completed: number; rate: number }[]
  examScores: ExamScore[]
}

export function GrowthOverviewTab({
  totalClasses,
  totalHours,
  latestScore,
  previousScore,
  latestVocab,
  previousVocab,
  currentProgress,
  classRecords,
  completionRateData,
  examScores,
}: GrowthOverviewTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">词库进度</CardTitle>
        </CardHeader>
        <CardContent>
          <WordbankProgressSummary progress={currentProgress} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">课堂表现分布</CardTitle>
        </CardHeader>
        <CardContent>
          <PerformanceStats records={classRecords} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">任务类型统计</CardTitle>
        </CardHeader>
        <CardContent>
          <TaskStats records={classRecords} />
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">任务完成率趋势（近12周）</CardTitle>
        </CardHeader>
        <CardContent>
          <CompletionRateChart data={completionRateData} />
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">成绩趋势</CardTitle>
        </CardHeader>
        <CardContent>
          <ScoreChart scores={examScores} />
        </CardContent>
      </Card>
    </div>
  )
}
