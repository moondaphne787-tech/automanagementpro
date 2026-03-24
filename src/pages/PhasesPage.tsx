import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, Calendar, Target, BookOpen, TrendingUp, ChevronRight, X, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { studentDb, classRecordDb, examScoreDb } from '@/db'
import { useAppStore } from '@/store/appStore'
import { TASK_TYPE_LABELS } from '@/types'
import type { Student, ClassRecord, ExamScore, PhaseType } from '@/types'

// 阶段类型显示名称
const PHASE_TYPE_LABELS: Record<PhaseType, string> = {
  semester: '学期',
  summer: '暑假',
  winter: '寒假'
}

// 自动学习阶段接口
interface AutoPhase {
  id: string
  name: string
  type: PhaseType
  startDate: string
  endDate: string
  isActive: boolean
  isCompleted: boolean
  student?: Student
  recordCount?: number
  totalHours?: number
  taskStats?: Record<string, number>
}

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

export function PhasesPage() {
  const navigate = useNavigate()
  const [phases, setPhases] = useState<AutoPhase[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  
  // 从 store 获取学期配置
  const semesterConfig = useAppStore(state => state.semesterConfig)
  
  // 详情抽屉状态
  const [selectedPhase, setSelectedPhase] = useState<AutoPhase | null>(null)
  const [phaseRecords, setPhaseRecords] = useState<ClassRecord[]>([])
  const [phaseScores, setPhaseScores] = useState<ExamScore[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    loadData()
  }, [semesterConfig]) // 当学期配置变化时重新加载

  const loadData = async () => {
    setLoading(true)
    try {
      // 如果学期配置未加载，等待
      if (!semesterConfig) {
        setLoading(false)
        return
      }
      
      // 加载所有学员
      const allStudents = await studentDb.getAllWithBilling(
        { status: 'all', student_type: 'all', level: 'all', grade: 'all', search: '' },
        { field: 'student_no', direction: 'asc' }
      )
      
      // 为每个学员生成自动阶段
      const allPhases: AutoPhase[] = []
      const today = new Date().toISOString().split('T')[0]
      const currentYear = new Date().getFullYear()
      
      for (const student of allStudents) {
        // 获取该学员的所有课堂记录
        const records = await classRecordDb.getByStudentId(student.id)
        const scores = await examScoreDb.getByStudentId(student.id)
        
        // 生成阶段
        const studentPhases = generatePhasesForStudent(semesterConfig, student, records, scores, today, currentYear)
        allPhases.push(...studentPhases)
      }
      
      // 按开始日期降序排序
      allPhases.sort((a, b) => b.startDate.localeCompare(a.startDate))
      
      setPhases(allPhases)
    } catch (error) {
      console.error('Failed to load phases:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const generatePhasesForStudent = (
    config: SemesterConfig,
    student: Student,
    records: ClassRecord[],
    scores: ExamScore[],
    today: string,
    year: number
  ): AutoPhase[] => {
    const phases: AutoPhase[] = []
    
    const phaseConfigs: Array<{
      id: string
      type: PhaseType
      name: string
      startKey: keyof SemesterConfig
      endKey: keyof SemesterConfig
    }> = [
      { id: 'spring', type: 'semester', name: `${year}年春季学期`, startKey: 'spring_start', endKey: 'spring_end' },
      { id: 'summer', type: 'summer', name: `${year}年暑假`, startKey: 'summer_start', endKey: 'summer_end' },
      { id: 'autumn', type: 'semester', name: `${year}年秋季学期`, startKey: 'autumn_start', endKey: 'autumn_end' },
      { id: 'winter', type: 'winter', name: `${year}年寒假`, startKey: 'winter_start', endKey: 'winter_end' }
    ]
    
    for (const pc of phaseConfigs) {
      const startDate = config[pc.startKey]
      const endDate = config[pc.endKey]
      
      if (!startDate || !endDate) continue
      
      // 筛选该阶段的课堂记录
      const phaseRecords = records.filter(r => 
        r.class_date >= startDate && r.class_date <= endDate
      )
      
      // 如果该学员在这个阶段没有课堂记录，跳过
      if (phaseRecords.length === 0) continue
      
      const isActive = startDate <= today && endDate >= today
      const isCompleted = endDate < today
      
      // 计算任务统计
      const taskStats: Record<string, number> = {}
      for (const record of phaseRecords) {
        for (const task of record.tasks) {
          taskStats[task.type] = (taskStats[task.type] || 0) + 1
        }
      }
      
      phases.push({
        id: `${student.id}-${pc.id}`,
        name: pc.name,
        type: pc.type,
        startDate,
        endDate,
        isActive,
        isCompleted,
        student,
        recordCount: phaseRecords.length,
        totalHours: phaseRecords.reduce((sum, r) => sum + r.duration_hours, 0),
        taskStats
      })
    }
    
    return phases
  }

  // 筛选
  const filteredPhases = phases.filter(p => {
    const matchesSearch = !search || 
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.student?.name.toLowerCase().includes(search.toLowerCase())
    const matchesType = filterType === 'all' || p.type === filterType
    return matchesSearch && matchesType
  })

  // 统计
  const stats = {
    total: phases.length,
    active: phases.filter(p => p.isActive).length,
    totalRecords: phases.reduce((sum, p) => sum + (p.recordCount || 0), 0)
  }

  const loadPhaseDetail = async (phase: AutoPhase) => {
    setSelectedPhase(phase)
    setDetailLoading(true)
    
    try {
      if (!phase.student) return
      
      // 获取该阶段内的课堂记录
      const allRecords = await classRecordDb.getByStudentId(phase.student.id)
      const records = allRecords.filter(r => 
        r.class_date >= phase.startDate && r.class_date <= phase.endDate
      )
      setPhaseRecords(records)
      
      // 获取考试成绩
      const allScores = await examScoreDb.getByStudentId(phase.student.id)
      const scores = allScores.filter(s =>
        s.exam_date >= phase.startDate && s.exam_date <= phase.endDate
      )
      setPhaseScores(scores)
    } catch (error) {
      console.error('Failed to load phase detail:', error)
    } finally {
      setDetailLoading(false)
    }
  }

  const getPhaseStatus = (phase: AutoPhase) => {
    if (phase.isCompleted) {
      return { label: '已结束', color: 'text-muted-foreground bg-muted' }
    }
    if (phase.isActive) {
      return { label: '进行中', color: 'text-green-600 bg-green-500/10' }
    }
    return { label: '未开始', color: 'text-amber-600 bg-amber-500/10' }
  }

  return (
    <div className="h-full flex">
      {/* 主列表区域 */}
      <div className="flex-1 flex flex-col">
        {/* 顶部栏 */}
        <header className="h-16 border-b bg-card flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold">学习阶段</h1>
            
            {/* 统计卡片 */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1 bg-muted rounded-lg text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{stats.total}</span>
                <span className="text-muted-foreground">个阶段</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-green-500/10 text-green-600 rounded-lg text-sm">
                <Target className="w-4 h-4" />
                <span className="font-medium">{stats.active}</span>
                <span className="text-green-600/70">进行中</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 text-blue-600 rounded-lg text-sm">
                <BookOpen className="w-4 h-4" />
                <span className="font-medium">{stats.totalRecords}</span>
                <span className="text-blue-600/70">次课</span>
              </div>
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground">
            阶段日期由「设置」页面统一配置
          </p>
        </header>

        {/* 搜索和筛选栏 */}
        <div className="border-b bg-card/50 px-6 py-3">
          <div className="flex items-center gap-4">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索阶段名称或学员..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border rounded-md text-sm"
            >
              <option value="all">全部类型</option>
              <option value="semester">学期</option>
              <option value="summer">暑假</option>
              <option value="winter">寒假</option>
            </select>
          </div>
        </div>

        {/* 列表 */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              加载中...
            </div>
          ) : filteredPhases.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              {search || filterType !== 'all' ? (
                '没有找到匹配的学习阶段'
              ) : (
                <>
                  <Calendar className="w-12 h-12 mb-3 opacity-50" />
                  <p>暂无学习阶段</p>
                  <p className="text-sm mt-1">请在「设置」页面配置学期日期</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPhases.map((phase, index) => {
                const status = getPhaseStatus(phase)
                return (
                  <motion.div
                    key={phase.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <Card 
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => loadPhaseDetail(phase)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            {/* 状态标签 */}
                            <span className={`px-2 py-0.5 text-xs rounded-full ${status.color}`}>
                              {status.label}
                            </span>
                            
                            {/* 类型标签 */}
                            <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">
                              {PHASE_TYPE_LABELS[phase.type]}
                            </span>
                            
                            {/* 阶段名称 */}
                            <div>
                              <div className="font-medium">{phase.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {phase.student?.name} · {phase.student?.grade || '未知年级'}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-6 text-sm">
                            {/* 日期范围 */}
                            <div className="text-muted-foreground">
                              {phase.startDate} ~ {phase.endDate}
                            </div>
                            
                            {/* 课堂记录数 */}
                            <div className="flex items-center gap-1">
                              <BookOpen className="w-4 h-4 text-muted-foreground" />
                              <span>{phase.recordCount || 0}次课</span>
                            </div>
                            
                            {/* 课时 */}
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4 text-muted-foreground" />
                              <span>{phase.totalHours?.toFixed(1) || 0}h</span>
                            </div>
                            
                            <ChevronRight className="w-5 h-5 text-muted-foreground" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* 详情面板 */}
      {selectedPhase && (
        <div className="w-96 border-l bg-card flex flex-col">
          <div className="h-16 border-b flex items-center justify-between px-4">
            <h2 className="font-semibold">阶段详情</h2>
            <Button variant="ghost" size="icon" onClick={() => setSelectedPhase(null)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          {detailLoading ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              加载中...
            </div>
          ) : (
            <div className="flex-1 overflow-auto p-4 space-y-4">
              {/* 基本信息 */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{selectedPhase.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">学员</span>
                    <span 
                      className="cursor-pointer hover:text-primary"
                      onClick={() => navigate(`/students/${selectedPhase.student?.id}`)}
                    >
                      {selectedPhase.student?.name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">类型</span>
                    <span>{PHASE_TYPE_LABELS[selectedPhase.type]}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">日期范围</span>
                    <span>{selectedPhase.startDate} ~ {selectedPhase.endDate}</span>
                  </div>
                </CardContent>
              </Card>

              {/* 统计汇总 */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">阶段汇总</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">{selectedPhase.recordCount || 0}</div>
                      <div className="text-xs text-muted-foreground">课堂次数</div>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">{selectedPhase.totalHours?.toFixed(1) || 0}</div>
                      <div className="text-xs text-muted-foreground">总课时</div>
                    </div>
                  </div>

                  {/* 任务统计 */}
                  {selectedPhase.taskStats && Object.values(selectedPhase.taskStats).some(v => v > 0) && (
                    <div>
                      <div className="text-sm font-medium mb-2">任务类型分布</div>
                      <div className="space-y-1">
                        {Object.entries(selectedPhase.taskStats).map(([type, count]) => (
                          count > 0 && (
                            <div key={type} className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">
                                {TASK_TYPE_LABELS[type as keyof typeof TASK_TYPE_LABELS] || type}
                              </span>
                              <span>{count}次</span>
                            </div>
                          )
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 最近课堂记录 */}
              {phaseRecords.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">课堂记录</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {phaseRecords.slice(0, 5).map(record => (
                      <div 
                        key={record.id}
                        className="flex items-center justify-between p-2 bg-muted rounded text-sm cursor-pointer hover:bg-muted/80"
                        onClick={() => {
                          navigate(`/students/${selectedPhase.student?.id}`)
                          // 使用 sessionStorage 传递目标 tab
                          sessionStorage.setItem('studentDetailTab', 'records')
                        }}
                      >
                        <div>
                          <div className="font-medium">{record.class_date}</div>
                          <div className="text-xs text-muted-foreground">
                            {record.tasks.length}个任务 · {record.duration_hours}小时
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    ))}
                    {phaseRecords.length > 5 && (
                      <Button 
                        variant="ghost" 
                        className="w-full"
                        onClick={() => {
                          navigate(`/students/${selectedPhase.student?.id}`)
                          sessionStorage.setItem('studentDetailTab', 'records')
                        }}
                      >
                        查看全部 {phaseRecords.length} 条记录
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* 考试成绩 */}
              {phaseScores.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">考试成绩</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {phaseScores.map(score => (
                      <div 
                        key={score.id}
                        className="flex items-center justify-between p-2 bg-muted rounded text-sm"
                      >
                        <div>
                          <div className="font-medium">{score.exam_name || '考试'}</div>
                          <div className="text-xs text-muted-foreground">{score.exam_date}</div>
                        </div>
                        <div className="font-semibold">
                          {score.score ?? '-'}/{score.full_score || 100}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}