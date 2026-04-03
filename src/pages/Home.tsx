import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Plus, Search, ArrowUpDown, AlertTriangle, Upload, Users } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { FileCabinet } from '@/components/FileCabinet/FileCabinet'
import { QuickRecordPanel, ViewPlansPanel, ViewProgressPanel } from '@/components/FileCabinet/StudentQuickPanels'
import { SemesterReminder, CurrentSemesterBadge } from '@/components/Reminder/SemesterReminder'
import { ImportStudentsDrawer } from '@/components/Drawers/ImportStudentsDrawer'
import { BatchPrefDialog } from '@/components/Preferences/BatchPrefDialog'
import { useBatchPrefDialog } from '@/hooks/useBatchPrefDialog'
import { useAppStore } from '@/store/appStore'
import { cn } from '@/lib/utils'
import { GRADE_OPTIONS, LEVEL_LABELS, STATUS_LABELS } from '@/types'
import type { SortOptions } from '@/types'

const statusOptions = [
  { value: 'all', label: '全部状态' },
  { value: 'active', label: '在读' },
  { value: 'paused', label: '暂停' },
  { value: 'graduated', label: '结课' },
]

const typeOptions = [
  { value: 'all', label: '全部类型' },
  { value: 'formal', label: '正式学员' },
  { value: 'trial', label: '体验生' },
]

const levelOptions = [
  { value: 'all', label: '全部程度' },
  { value: 'weak', label: '基础薄弱' },
  { value: 'medium', label: '基础较好' },
  { value: 'advanced', label: '非常优秀' },
]

const gradeOptions = [
  { value: 'all', label: '全部年级' },
  ...GRADE_OPTIONS.map(g => ({ value: g, label: g }))
]

const dayOfWeekOptions = [
  { value: 'all', label: '全部时段' },
  { value: 'monday', label: '周一有课' },
  { value: 'tuesday', label: '周二有课' },
  { value: 'wednesday', label: '周三有课' },
  { value: 'thursday', label: '周四有课' },
  { value: 'friday', label: '周五有课' },
  { value: 'saturday', label: '周六有课' },
  { value: 'sunday', label: '周日有课' },
]

const sortOptions = [
  { value: 'student_no', label: '学号' },
  { value: 'total_hours', label: '购买课时' },
  { value: 'remaining_hours', label: '剩余课时' },
  { value: 'enroll_date', label: '入学时间' },
  { value: 'last_class', label: '最近上课' },
]

export function Home() {
  const navigate = useNavigate()
  const location = useLocation()
  const students = useAppStore(s => s.students)
  const studentsLoading = useAppStore(s => s.studentsLoading)
  const filters = useAppStore(s => s.filters)
  const sort = useAppStore(s => s.sort)
  const loadStudents = useAppStore(s => s.loadStudents)
  const loadExpiredPlansCount = useAppStore(s => s.loadExpiredPlansCount)
  const setFilters = useAppStore(s => s.setFilters)
  const setSort = useAppStore(s => s.setSort)
  
  const [searchValue, setSearchValue] = useState(filters.search)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(sort.direction)
  const [importDrawerOpen, setImportDrawerOpen] = useState(false)
  
  // 快捷面板状态
  const [quickRecordOpen, setQuickRecordOpen] = useState(false)
  const [viewPlansOpen, setViewPlansOpen] = useState(false)
  const [viewProgressOpen, setViewProgressOpen] = useState(false)
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null)
  
  // 批量设置时段偏好（共享 hook）
  const batchPrefDialog = useBatchPrefDialog(loadStudents)
  
  // 追踪是否已加载过期计划，确保只加载一次
  const expiredPlansLoadedRef = useRef(false)

  // 处理从 Dashboard 跳转过来的筛选条件
  const [dashboardFilter, setDashboardFilter] = useState<string | null>(null)
  
  useEffect(() => {
    const state = location.state as { filter?: string } | null
    if (state?.filter === 'low_hours') {
      // 从 Dashboard 课时预警卡片跳转过来：按剩余课时升序排列，只看在读学员
      setFilters({ status: 'active' })
      setSort({ field: 'remaining_hours', direction: 'asc' })
      setSortDirection('asc')
      setDashboardFilter('low_hours')
      // 清除 state 避免刷新后重复触发
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.state])

  useEffect(() => {
    // 加载学员列表
    loadStudents()
  }, [])
  
  // 过期计划查询只在学员首次加载完成后执行一次
  useEffect(() => {
    if (!expiredPlansLoadedRef.current && students.length > 0 && !studentsLoading) {
      expiredPlansLoadedRef.current = true
      loadExpiredPlansCount()
    }
  }, [students.length, studentsLoading])

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue !== filters.search) {
        setFilters({ search: searchValue })
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchValue])

  // 预警学员数量
  const warningCount = students.filter(s => 
    s.status === 'active' && 
    s.billing && 
    s.billing.remaining_hours <= s.billing.warning_threshold
  ).length


  return (
    <div className="h-full flex flex-col">
      {/* 顶部栏 */}
      <header className="h-16 border-b bg-card flex items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">学员档案</h1>
          <CurrentSemesterBadge />
          {dashboardFilter === 'low_hours' && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-full text-xs">
              ⚡ 课时预警筛选中
              <button
                onClick={() => {
                  setDashboardFilter(null)
                  setFilters({ status: 'all' })
                  setSort({ field: 'student_no', direction: 'asc' })
                  setSortDirection('asc')
                }}
                className="ml-1 hover:text-red-800 dark:hover:text-red-200"
              >
                ✕
              </button>
            </span>
          )}
          {warningCount > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1 px-2 py-0.5 bg-warning/10 text-warning rounded-full text-xs"
            >
              <AlertTriangle className="w-3 h-3" />
              {warningCount}人课时预警
            </motion.div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => batchPrefDialog.setOpen(true)}>
            <Users className="w-4 h-4 mr-1" />
            批量设置时段偏好
          </Button>
          <Button variant="outline" onClick={() => setImportDrawerOpen(true)}>
            <Upload className="w-4 h-4 mr-1" />
            批量导入
          </Button>
          <Button onClick={() => navigate('/students/new')}>
            <Plus className="w-4 h-4 mr-1" />
            新增学员
          </Button>
        </div>
      </header>

      {/* 学期提醒横幅 */}
      <SemesterReminder />
      
      {/* 筛选和排序栏 */}
      <div className="border-b bg-card/50 px-6 py-3">
        <div className="flex items-center gap-4 flex-wrap">
          {/* 搜索 */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜索学员姓名..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="pl-9"
            />
          </div>
          
          {/* 筛选条件 */}
          <Select
            value={filters.status}
            onChange={(e) => setFilters({ status: e.target.value as any })}
            options={statusOptions}
            className="w-32"
          />
          
          <Select
            value={filters.student_type}
            onChange={(e) => setFilters({ student_type: e.target.value as any })}
            options={typeOptions}
            className="w-32"
          />
          
          <Select
            value={filters.level}
            onChange={(e) => setFilters({ level: e.target.value as any })}
            options={levelOptions}
            className="w-32"
          />
          
          <Select
            value={filters.grade}
            onChange={(e) => setFilters({ grade: e.target.value })}
            options={gradeOptions}
            className="w-32"
          />
          
          <Select
            value={filters.day_of_week}
            onChange={(e) => setFilters({ day_of_week: e.target.value as any })}
            options={dayOfWeekOptions}
            className="w-32"
          />
          
          {/* 排序 */}
          <div className="flex items-center gap-2 ml-auto">
            <Select
              value={sort.field}
              onChange={(e) => setSort({ field: e.target.value as any, direction: sortDirection })}
              options={sortOptions}
              className="w-32"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                const newDir = sortDirection === 'asc' ? 'desc' : 'asc'
                setSortDirection(newDir)
                setSort({ field: sort.field, direction: newDir })
              }}
            >
              <ArrowUpDown className={cn(
                "w-4 h-4",
                sortDirection === 'desc' && "rotate-180"
              )} />
            </Button>
          </div>
        </div>
      </div>

      {/* 档案柜主体 */}
      <div className="flex-1 overflow-auto p-6">
        <FileCabinet
          students={students}
          loading={studentsLoading}
          onQuickRecord={(id) => { setActiveStudentId(id); setQuickRecordOpen(true) }}
          onViewPlans={(id) => { setActiveStudentId(id); setViewPlansOpen(true) }}
          onViewProgress={(id) => { setActiveStudentId(id); setViewProgressOpen(true) }}
        />
      </div>
      
      {/* 学员导入抽屉 */}
      <ImportStudentsDrawer 
        open={importDrawerOpen} 
        onClose={() => setImportDrawerOpen(false)} 
      />
      
      {/* 批量设置时段偏好对话框 */}
      <BatchPrefDialog
        open={batchPrefDialog.open}
        onOpenChange={batchPrefDialog.setOpen}
        students={students}
        batchSelectedStudents={batchPrefDialog.selectedStudents}
        setBatchSelectedStudents={batchPrefDialog.setSelectedStudents}
        batchPrefForm={batchPrefDialog.form}
        setBatchPrefForm={batchPrefDialog.setForm}
        batchSaving={batchPrefDialog.saving}
        onSave={batchPrefDialog.onSave}
      />
      
      {/* 快捷面板 */}
      <QuickRecordPanel
        open={quickRecordOpen}
        onOpenChange={setQuickRecordOpen}
        studentId={activeStudentId}
      />
      <ViewPlansPanel
        open={viewPlansOpen}
        onOpenChange={setViewPlansOpen}
        studentId={activeStudentId}
      />
      <ViewProgressPanel
        open={viewProgressOpen}
        onOpenChange={setViewProgressOpen}
        studentId={activeStudentId}
      />
    </div>
  )
}
