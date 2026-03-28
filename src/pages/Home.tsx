import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, ArrowUpDown, AlertTriangle, Upload, Calendar, Users, Check } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { FileCabinet } from '@/components/FileCabinet/FileCabinet'
import { SemesterReminder, CurrentSemesterBadge } from '@/components/Reminder/SemesterReminder'
import { ImportStudentsDrawer } from '@/components/Drawers/ImportStudentsDrawer'
import { useAppStore } from '@/store/appStore'
import { cn } from '@/lib/utils'
import { GRADE_OPTIONS, LEVEL_LABELS, STATUS_LABELS } from '@/types'
import type { SortOptions, DayOfWeek, StudentSchedulePreference, Billing } from '@/types'

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

const DAY_OPTIONS: { value: DayOfWeek; label: string }[] = [
  { value: 'monday', label: '周一' },
  { value: 'tuesday', label: '周二' },
  { value: 'wednesday', label: '周三' },
  { value: 'thursday', label: '周四' },
  { value: 'friday', label: '周五' },
  { value: 'saturday', label: '周六' },
  { value: 'sunday', label: '周日' },
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
  const { 
    students, 
    studentsLoading, 
    filters, 
    sort, 
    loadStudents, 
    loadExpiredPlansCount,
    setFilters, 
    setSort 
  } = useAppStore()
  
  const [searchValue, setSearchValue] = useState(filters.search)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(sort.direction)
  const [importDrawerOpen, setImportDrawerOpen] = useState(false)
  
  // 批量设置时段偏好状态
  const [batchPrefOpen, setBatchPrefOpen] = useState(false)
  const [batchPrefForm, setBatchPrefForm] = useState({
    day_of_week: 'saturday' as DayOfWeek,
    preferred_start: '09:00',
    preferred_end: '11:00',
    notes: '',
    grade_filter: 'all'
  })
  const [batchSelectedStudents, setBatchSelectedStudents] = useState<string[]>([])
  const [batchSaving, setBatchSaving] = useState(false)
  
  // 追踪是否已加载过期计划，确保只加载一次
  const expiredPlansLoadedRef = useRef(false)

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
          <Button variant="outline" onClick={() => setBatchPrefOpen(true)}>
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
        <FileCabinet students={students} loading={studentsLoading} />
      </div>
      
      {/* 学员导入抽屉 */}
      <ImportStudentsDrawer 
        open={importDrawerOpen} 
        onClose={() => setImportDrawerOpen(false)} 
      />
      
      {/* 批量设置时段偏好对话框 */}
      {batchPrefOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setBatchPrefOpen(false)} />
          <div className="relative bg-card rounded-lg shadow-lg p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto mx-4">
            <h3 className="text-lg font-semibold mb-4">批量设置学生时段偏好</h3>
            
            <div className="space-y-4">
              {/* 时段设置 */}
              <div className="p-4 bg-primary/5 rounded-lg space-y-3">
                <p className="text-sm font-medium">要添加的时段</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">星期</label>
                    <Select
                      value={batchPrefForm.day_of_week}
                      onChange={e => setBatchPrefForm(prev => ({
                        ...prev,
                        day_of_week: e.target.value as DayOfWeek
                      }))}
                      options={DAY_OPTIONS}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">开始时间</label>
                    <Input
                      type="time"
                      value={batchPrefForm.preferred_start}
                      onChange={e => {
                        const start = e.target.value
                        const [h, m] = start.split(':').map(Number)
                        const endH = (h + 2).toString().padStart(2, '0')
                        const endM = m.toString().padStart(2, '0')
                        setBatchPrefForm(prev => ({
                          ...prev,
                          preferred_start: start,
                          preferred_end: `${endH}:${endM}`,
                        }))
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">结束时间</label>
                    <Input
                      type="time"
                      value={batchPrefForm.preferred_end}
                      onChange={e => setBatchPrefForm(prev => ({
                        ...prev,
                        preferred_end: e.target.value
                      }))}
                    />
                  </div>
                </div>
              </div>

              {/* 年级快速筛选 */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">按年级筛选：</span>
                {['all', '三年级', '四年级', '五年级', '六年级', '初一', '初二', '初三', '高一', '高二', '高三', '大学'].map(grade => (
                  <button
                    key={grade}
                    onClick={() => setBatchPrefForm(prev => ({ ...prev, grade_filter: grade }))}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      batchPrefForm.grade_filter === grade
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    {grade === 'all' ? '全部' : grade}
                  </button>
                ))}
              </div>

              {/* 学生多选列表 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    选择学生（已选 {batchSelectedStudents.length} 人）
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const filtered = students
                          .filter(s => batchPrefForm.grade_filter === 'all' ||
                            s.grade === batchPrefForm.grade_filter)
                          .map(s => s.id)
                        setBatchSelectedStudents(filtered)
                      }}
                    >
                      全选
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setBatchSelectedStudents([])}
                    >
                      清空
                    </Button>
                  </div>
                </div>

                <div className="max-h-64 overflow-auto border rounded-lg divide-y">
                  {students
                    .filter(s => batchPrefForm.grade_filter === 'all' ||
                      s.grade === batchPrefForm.grade_filter)
                    .map(student => {
                      const isSelected = batchSelectedStudents.includes(student.id)
                      const existingPrefs = ((student as any).preferences || []) .filter(
                        (p: StudentSchedulePreference) => p.day_of_week === batchPrefForm.day_of_week
                      )
                      return (
                        <div
                          key={student.id}
                          className={`flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-muted/50 ${
                            isSelected ? 'bg-primary/5' : ''
                          }`}
                          onClick={() => setBatchSelectedStudents(prev =>
                            isSelected ? prev.filter(id => id !== student.id) : [...prev, student.id]
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                              isSelected ? 'bg-primary border-primary' : 'border-muted-foreground'
                            }`}>
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <div>
                              <span className="text-sm font-medium">{student.name}</span>
                              <span className="text-xs text-muted-foreground ml-2">{student.grade}</span>
                            </div>
                          </div>
                          {existingPrefs.length > 0 && (
                            <div className="flex gap-1">
                              {existingPrefs.map((p: StudentSchedulePreference) => (
                                <span key={p.id} className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                                  {p.preferred_start?.slice(0, 5)}-{p.preferred_end?.slice(0, 5)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                </div>
                <p className="text-xs text-muted-foreground">
                  已有相同星期+时间偏好的学生不会重复添加
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setBatchPrefOpen(false)}>取消</Button>
              <Button 
                onClick={async () => {
                  if (batchSelectedStudents.length === 0) return
                  setBatchSaving(true)
                  try {
                    const { studentSchedulePreferenceDb } = await import('@/db/schedule')
                    let addedCount = 0
                    for (const studentId of batchSelectedStudents) {
                      // 检查是否已有相同的偏好
                      const existing = await studentSchedulePreferenceDb.getByStudentId(studentId)
                      const hasSame = existing.some(p => 
                        p.day_of_week === batchPrefForm.day_of_week &&
                        p.preferred_start === batchPrefForm.preferred_start &&
                        p.preferred_end === batchPrefForm.preferred_end
                      )
                      if (!hasSame) {
                        await studentSchedulePreferenceDb.create({
                          student_id: studentId,
                          day_of_week: batchPrefForm.day_of_week,
                          preferred_start: batchPrefForm.preferred_start,
                          preferred_end: batchPrefForm.preferred_end,
                          notes: batchPrefForm.notes || undefined
                        })
                        addedCount++
                      }
                    }
                    const skippedCount = batchSelectedStudents.length - addedCount
                    if (skippedCount > 0) {
                      alert(`已为 ${addedCount} 名学生添加时段偏好\n${skippedCount} 名学生已有相同偏好，已跳过`)
                    } else {
                      alert(`已为 ${addedCount} 名学生添加时段偏好`)
                    }
                    setBatchPrefOpen(false)
                    setBatchSelectedStudents([])
                    loadStudents()
                  } catch (error) {
                    alert('保存失败：' + (error as Error).message)
                  }
                  setBatchSaving(false)
                }}
                disabled={batchSaving || batchSelectedStudents.length === 0}
              >
                {batchSaving ? '保存中...' : `确认添加到 ${batchSelectedStudents.length} 名学生`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
