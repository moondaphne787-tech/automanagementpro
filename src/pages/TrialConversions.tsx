import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, TrendingUp, TrendingDown, Users, CheckCircle, Calendar, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { trialConversionDb } from '@/db'
import { LEVEL_LABELS } from '@/types'
import type { TrialConversion, Student } from '@/types'

type ConversionWithStudent = TrialConversion & { student: Student }

const MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']

export function TrialConversions() {
  const navigate = useNavigate()
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  
  const [year, setYear] = useState(currentYear)
  const [selectedMonth, setSelectedMonth] = useState<number | null>(currentMonth)
  
  const [yearlyStats, setYearlyStats] = useState<{ month: number; total: number; converted: number }[]>([])
  const [monthDetail, setMonthDetail] = useState<{
    total: number
    converted: number
    pending: number
    conversions: ConversionWithStudent[]
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadYearlyStats()
  }, [year])

  useEffect(() => {
    if (selectedMonth !== null) {
      loadMonthDetail()
    }
  }, [year, selectedMonth])

  const loadYearlyStats = async () => {
    setLoading(true)
    try {
      const stats = await trialConversionDb.getYearlyStats(year)
      setYearlyStats(stats)
      
      // 如果当前月份没有数据，自动选择有数据的月份
      if (selectedMonth !== null && stats[selectedMonth - 1]?.total === 0) {
        const monthWithData = stats.find(s => s.total > 0)
        if (monthWithData) {
          setSelectedMonth(monthWithData.month)
        }
      }
    } catch (error) {
      console.error('Failed to load yearly stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadMonthDetail = async () => {
    if (selectedMonth === null) return
    
    try {
      const detail = await trialConversionDb.getMonthlyConversions(year, selectedMonth)
      setMonthDetail(detail)
    } catch (error) {
      console.error('Failed to load month detail:', error)
    }
  }

  // 年度统计
  const yearTotal = yearlyStats.reduce((sum, s) => sum + s.total, 0)
  const yearConverted = yearlyStats.reduce((sum, s) => sum + s.converted, 0)
  const conversionRate = yearTotal > 0 ? Math.round((yearConverted / yearTotal) * 100) : 0

  // 年份选项
  const yearOptions = []
  for (let y = currentYear; y >= currentYear - 5; y--) {
    yearOptions.push({ value: y.toString(), label: `${y}年` })
  }

  // 找出最大值用于图表缩放
  const maxValue = Math.max(...yearlyStats.map(s => s.total), 1)

  return (
    <div className="h-full flex flex-col">
      {/* 顶部栏 */}
      <header className="h-16 border-b bg-card flex items-center px-6 gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/trial')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-semibold">成交统计</h1>
        
        <div className="ml-auto">
          <Select
            value={year.toString()}
            onChange={(e) => setYear(parseInt(e.target.value))}
            options={yearOptions}
            className="w-32"
          />
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            加载中...
          </div>
        ) : (
          <div className="space-y-6">
            {/* 年度总览 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <Users className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{yearTotal}</div>
                      <div className="text-sm text-muted-foreground">年度体验生</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-green-500/10 rounded-lg">
                      <CheckCircle className="w-6 h-6 text-green-500" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-600">{yearConverted}</div>
                      <div className="text-sm text-muted-foreground">已成交</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-amber-500/10 rounded-lg">
                      <TrendingUp className="w-6 h-6 text-amber-500" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{conversionRate}%</div>
                      <div className="text-sm text-muted-foreground">成交率</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-500/10 rounded-lg">
                      <Calendar className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{yearTotal - yearConverted}</div>
                      <div className="text-sm text-muted-foreground">待转化</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 月度图表 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  月度统计
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-12 gap-2">
                  {yearlyStats.map((stat) => (
                    <motion.div
                      key={stat.month}
                      className={`flex flex-col items-center p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedMonth === stat.month 
                          ? 'bg-primary/10 ring-2 ring-primary' 
                          : 'bg-muted/50 hover:bg-muted'
                      }`}
                      onClick={() => setSelectedMonth(stat.month)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="text-xs text-muted-foreground mb-2">
                        {MONTH_NAMES[stat.month - 1]}
                      </div>
                      
                      {/* 柱状图 */}
                      <div className="w-full h-24 flex flex-col justify-end items-center gap-1">
                        {/* 已成交柱 */}
                        <div 
                          className="w-6 bg-green-500 rounded-t transition-all"
                          style={{ 
                            height: `${(stat.converted / maxValue) * 100}%`,
                            minHeight: stat.converted > 0 ? '4px' : '0'
                          }}
                        />
                        {/* 未成交柱 */}
                        <div 
                          className="w-6 bg-amber-400 rounded-t transition-all"
                          style={{ 
                            height: `${((stat.total - stat.converted) / maxValue) * 100}%`,
                            minHeight: (stat.total - stat.converted) > 0 ? '4px' : '0'
                          }}
                        />
                      </div>
                      
                      <div className="text-sm font-medium mt-1">
                        {stat.total > 0 ? stat.total : '-'}
                      </div>
                      
                      {stat.total > 0 && (
                        <div className="text-xs text-green-600">
                          {stat.converted}成交
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
                
                {/* 图例 */}
                <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded" />
                    <span className="text-sm text-muted-foreground">已成交</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-amber-400 rounded" />
                    <span className="text-sm text-muted-foreground">待转化</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 月度详情 */}
            {selectedMonth !== null && monthDetail && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    {year}年{MONTH_NAMES[selectedMonth - 1]}详情
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {monthDetail.total === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      该月暂无体验生记录
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* 月度统计 */}
                      <div className="flex items-center gap-4 pb-4 border-b">
                        <div className="flex items-center gap-2 px-3 py-1 bg-muted rounded-lg text-sm">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{monthDetail.total}</span>
                          <span className="text-muted-foreground">人</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 text-green-600 rounded-lg text-sm">
                          <CheckCircle className="w-4 h-4" />
                          <span className="font-medium">{monthDetail.converted}</span>
                          <span className="text-green-600/70">已成交</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 text-amber-600 rounded-lg text-sm">
                          <TrendingDown className="w-4 h-4" />
                          <span className="font-medium">{monthDetail.pending}</span>
                          <span className="text-amber-600/70">待转化</span>
                        </div>
                      </div>
                      
                      {/* 列表 */}
                      <div className="space-y-3">
                        {monthDetail.conversions.map((conversion) => (
                          <motion.div
                            key={conversion.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                            onClick={() => navigate(`/students/${conversion.student_id}`)}
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-medium">
                                {conversion.student.name.charAt(0)}
                              </div>
                              <div>
                                <div className="font-medium">{conversion.student.name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {conversion.student.grade} · {LEVEL_LABELS[conversion.student.level]}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-4">
                              <div className="text-sm text-muted-foreground">
                                体验：{conversion.trial_date || '未记录'}
                              </div>
                              
                              {conversion.converted ? (
                                <span className="px-2 py-0.5 bg-green-500/10 text-green-600 text-xs rounded-full">
                                  已成交
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 text-xs rounded-full">
                                  待转化
                                </span>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}