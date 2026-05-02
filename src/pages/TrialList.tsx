import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, CheckCircle, Clock, TrendingUp, Users as UsersIcon, TrendingDown, Calendar, BarChart3 } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { DateInput } from '@/components/ui/date-input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { trialConversionDb } from '@/db'
import { LEVEL_LABELS } from '@/types'
import { cn } from '@/lib/utils'
import type { Student, TrialConversion, Billing } from '@/types'

type TrialStudent = Student & {
  conversion: TrialConversion | null
  billing: Billing | null
}

type ConversionWithStudent = TrialConversion & { student: Student }

const MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']

export function TrialList() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'list' | 'stats'>('list')
  const [students, setStudents] = useState<TrialStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // 成交对话框状态
  const [convertDialogOpen, setConvertDialogOpen] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<TrialStudent | null>(null)
  const [conversionDate, setConversionDate] = useState(new Date().toISOString().split('T')[0])
  const [commissionNote, setCommissionNote] = useState('')
  const [converting, setConverting] = useState(false)

  // 成交统计状态
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
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    loadTrialStudents()
  }, [])

  useEffect(() => {
    if (activeTab === 'stats') {
      loadYearlyStats()
    }
  }, [activeTab, year])

  useEffect(() => {
    if (selectedMonth !== null && activeTab === 'stats') {
      loadMonthDetail()
    }
  }, [year, selectedMonth, activeTab])

  const loadTrialStudents = async () => {
    setLoading(true)
    try {
      const data = await trialConversionDb.getAllTrialStudents()
      setStudents(data)
    } catch (error) {
      console.error('Failed to load trial students:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadYearlyStats = async () => {
    setStatsLoading(true)
    try {
      const stats = await trialConversionDb.getYearlyStats(year)
      setYearlyStats(stats)
      if (selectedMonth !== null && stats[selectedMonth - 1]?.total === 0) {
        const monthWithData = stats.find(s => s.total > 0)
        if (monthWithData) {
          setSelectedMonth(monthWithData.month)
        }
      }
    } catch (error) {
      console.error('Failed to load yearly stats:', error)
    } finally {
      setStatsLoading(false)
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

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  )

  const stats = {
    total: students.length,
    converted: students.filter(s => s.conversion?.converted).length,
    pending: students.filter(s => !s.conversion?.converted).length,
  }

  // 年度统计
  const yearTotal = yearlyStats.reduce((sum, s) => sum + s.total, 0)
  const yearConverted = yearlyStats.reduce((sum, s) => sum + s.converted, 0)
  const conversionRate = yearTotal > 0 ? Math.round((yearConverted / yearTotal) * 100) : 0
  const yearOptions = []
  for (let y = currentYear; y >= currentYear - 5; y--) {
    yearOptions.push({ value: y.toString(), label: `${y}年` })
  }
  const maxValue = Math.max(...yearlyStats.map(s => s.total), 1)

  const handleOpenConvertDialog = (student: TrialStudent) => {
    setSelectedStudent(student)
    setConversionDate(new Date().toISOString().split('T')[0])
    setCommissionNote('')
    setConvertDialogOpen(true)
  }

  const handleConvert = async () => {
    if (!selectedStudent) return
    setConverting(true)
    try {
      await trialConversionDb.markConverted(selectedStudent.id, conversionDate, commissionNote || undefined)
      setConvertDialogOpen(false)
      await loadTrialStudents()
    } catch (error) {
      console.error('Failed to mark conversion:', error)
      toast.error('标记成交失败，请重试')
    } finally {
      setConverting(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* 顶部栏 */}
      <header className="h-16 border-b bg-card flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">体验生</h1>
          {activeTab === 'list' && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1 bg-muted rounded-lg text-sm">
                <UsersIcon className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{stats.total}</span>
                <span className="text-muted-foreground">人</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-green-500/10 text-green-600 rounded-lg text-sm">
                <CheckCircle className="w-4 h-4" />
                <span className="font-medium">{stats.converted}</span>
                <span className="text-green-600/70">已成交</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-600 rounded-lg text-sm">
                <Clock className="w-4 h-4" />
                <span className="font-medium">{stats.pending}</span>
                <span className="text-amber-600/70">待跟进</span>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => navigate('/students/new?trial=true')}>
            <Plus className="w-4 h-4 mr-1" />
            新增体验生
          </Button>
        </div>
      </header>

      {/* Tab 导航 */}
      <div className="border-b bg-card px-6">
        <nav className="flex gap-1 -mb-px">
          <button
            onClick={() => setActiveTab('list')}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              activeTab === 'list'
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            )}
          >
            <UsersIcon className="w-4 h-4" />
            体验生列表
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              activeTab === 'stats'
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            )}
          >
            <TrendingUp className="w-4 h-4" />
            成交统计
          </button>
        </nav>
      </div>

      {activeTab === 'list' ? (
        <>
          {/* 搜索栏 */}
          <div className="border-b bg-card/50 px-6 py-3">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索体验生姓名..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* 列表 */}
          <div className="flex-1 overflow-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">加载中...</div>
            ) : filteredStudents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                {search ? '没有找到匹配的体验生' : '暂无体验生'}
              </div>
            ) : (
              <div className="border rounded-lg">
                <div className="grid grid-cols-[1fr_5rem_5rem_7rem_7rem_5rem_6rem] gap-4 py-2 px-4 bg-muted/50 border-b text-sm font-medium text-muted-foreground">
                  <div>姓名</div>
                  <div>年级</div>
                  <div>程度</div>
                  <div>体验日期</div>
                  <div>成交日期</div>
                  <div className="text-center">状态</div>
                  <div className="text-center">操作</div>
                </div>
                {filteredStudents.map(student => (
                  <div
                    key={student.id}
                    className="grid grid-cols-[1fr_5rem_5rem_7rem_7rem_5rem_6rem] gap-4 py-2 px-4 border-b last:border-b-0 items-center hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => navigate(`/students/${student.id}`)}
                  >
                    <div className="font-medium text-sm truncate">{student.name}</div>
                    <div className="text-sm text-muted-foreground">{student.grade || '-'}</div>
                    <div className="text-sm">{LEVEL_LABELS[student.level]}</div>
                    <div className="text-sm text-muted-foreground">{student.conversion?.trial_date || '-'}</div>
                    <div className="text-sm">
                      {student.conversion?.converted && student.conversion.conversion_date ? (
                        <span className="text-green-600">{student.conversion.conversion_date}</span>
                      ) : '-'}
                    </div>
                    <div className="text-center">
                      {student.conversion?.converted ? (
                        <span className="px-2 py-0.5 bg-green-500/10 text-green-600 text-xs rounded-full">已成交</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 text-xs rounded-full">待跟进</span>
                      )}
                    </div>
                    <div className="text-center">
                      {!student.conversion?.converted && (
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={(e) => { e.stopPropagation(); handleOpenConvertDialog(student); }}>
                          <CheckCircle className="w-3 h-3 mr-1" />成交
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        /* ===== 成交统计 Tab ===== */
        <div className="flex-1 overflow-auto p-6">
          {statsLoading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">加载中...</div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">{year}年 成交概览</h2>
                <Select
                  value={year.toString()}
                  onChange={(e) => setYear(parseInt(e.target.value))}
                  options={yearOptions}
                  className="w-32"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-primary/10 rounded-lg"><UsersIcon className="w-6 h-6 text-primary" /></div>
                      <div><div className="text-2xl font-bold">{yearTotal}</div><div className="text-sm text-muted-foreground">年度体验生</div></div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-green-500/10 rounded-lg"><CheckCircle className="w-6 h-6 text-green-500" /></div>
                      <div><div className="text-2xl font-bold text-green-600">{yearConverted}</div><div className="text-sm text-muted-foreground">已成交</div></div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-amber-500/10 rounded-lg"><TrendingUp className="w-6 h-6 text-amber-500" /></div>
                      <div><div className="text-2xl font-bold">{conversionRate}%</div><div className="text-sm text-muted-foreground">成交率</div></div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-500/10 rounded-lg"><Calendar className="w-6 h-6 text-blue-500" /></div>
                      <div><div className="text-2xl font-bold">{yearTotal - yearConverted}</div><div className="text-sm text-muted-foreground">待转化</div></div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="w-5 h-5" />月度统计</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-12 gap-2">
                    {yearlyStats.map((stat) => (
                      <motion.div
                        key={stat.month}
                        className={`flex flex-col items-center p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedMonth === stat.month ? 'bg-primary/10 ring-2 ring-primary' : 'bg-muted/50 hover:bg-muted'
                        }`}
                        onClick={() => setSelectedMonth(stat.month)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="text-xs text-muted-foreground mb-2">{MONTH_NAMES[stat.month - 1]}</div>
                        <div className="w-full h-24 flex flex-col justify-end items-center gap-1">
                          <div className="w-6 bg-green-500 rounded-t transition-all" style={{ height: `${(stat.converted / maxValue) * 100}%`, minHeight: stat.converted > 0 ? '4px' : '0' }} />
                          <div className="w-6 bg-amber-400 rounded-t transition-all" style={{ height: `${((stat.total - stat.converted) / maxValue) * 100}%`, minHeight: (stat.total - stat.converted) > 0 ? '4px' : '0' }} />
                        </div>
                        <div className="text-sm font-medium mt-1">{stat.total > 0 ? stat.total : '-'}</div>
                        {stat.total > 0 && <div className="text-xs text-green-600">{stat.converted}成交</div>}
                      </motion.div>
                    ))}
                  </div>
                  <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500 rounded" /><span className="text-sm text-muted-foreground">已成交</span></div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-amber-400 rounded" /><span className="text-sm text-muted-foreground">待转化</span></div>
                  </div>
                </CardContent>
              </Card>

              {selectedMonth !== null && monthDetail && (
                <Card>
                  <CardHeader><CardTitle>{year}年{MONTH_NAMES[selectedMonth - 1]}详情</CardTitle></CardHeader>
                  <CardContent>
                    {monthDetail.total === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">该月暂无体验生记录</div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center gap-4 pb-4 border-b">
                          <div className="flex items-center gap-2 px-3 py-1 bg-muted rounded-lg text-sm">
                            <UsersIcon className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{monthDetail.total}</span><span className="text-muted-foreground">体验生</span>
                          </div>
                          <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 text-green-600 rounded-lg text-sm">
                            <CheckCircle className="w-4 h-4" />
                            <span className="font-medium">{monthDetail.converted}</span><span className="text-green-600/70">已成交</span>
                          </div>
                          <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 text-amber-600 rounded-lg text-sm">
                            <TrendingDown className="w-4 h-4" />
                            <span className="font-medium">{monthDetail.pending}</span><span className="text-amber-600/70">待转化</span>
                          </div>
                        </div>
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
                                  <div className="text-sm text-muted-foreground">{conversion.student.grade} · {LEVEL_LABELS[conversion.student.level]}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-sm text-muted-foreground">体验：{conversion.trial_date || '未记录'}</div>
                                {conversion.converted ? (
                                  <span className="px-2 py-0.5 bg-green-500/10 text-green-600 text-xs rounded-full">已成交</span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 text-xs rounded-full">待转化</span>
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
      )}

      {/* 成交对话框 */}
      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>标记成交</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">学员姓名</label>
              <div className="text-lg font-medium">{selectedStudent?.name}</div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">成交日期</label>
              <DateInput value={conversionDate} onChange={setConversionDate} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">提成备注（可选）</label>
              <Input value={commissionNote} onChange={(e) => setCommissionNote(e.target.value)} placeholder="输入提成相关信息..." />
            </div>
            <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">标记成交后，该学员将自动转为正式学员。</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertDialogOpen(false)}>取消</Button>
            <Button onClick={handleConvert} disabled={converting}>{converting ? '处理中...' : '确认成交'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
