import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, ArrowUpDown, AlertTriangle } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { FileCabinet } from '@/components/FileCabinet/FileCabinet'
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
    setFilters, 
    setSort 
  } = useAppStore()
  
  const [searchValue, setSearchValue] = useState(filters.search)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(sort.direction)

  useEffect(() => {
    loadStudents()
  }, [])

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
        <Button onClick={() => navigate('/students/new')}>
          <Plus className="w-4 h-4 mr-1" />
          新增学员
        </Button>
      </header>

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
    </div>
  )
}