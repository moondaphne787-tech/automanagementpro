import { useState, useEffect } from 'react'
import { AlertTriangle, Calendar, X, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { settingsDb } from '@/db'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'

// 学期日期接口（包含备份日期）
interface SemesterDates {
  spring_start: string | null
  spring_end: string | null
  summer_start: string | null
  summer_end: string | null
  autumn_start: string | null
  autumn_end: string | null
  winter_start: string | null
  winter_end: string | null
  last_backup_date: string | null
}

// 获取当前学期信息
function getCurrentSemester(dates: SemesterDates): { 
  type: 'spring' | 'summer' | 'autumn' | 'winter' | null
  name: string
  startDate: string | null
  endDate: string | null
} {
  const today = new Date().toISOString().split('T')[0]
  const year = new Date().getFullYear()
  
  // 春季学期
  if (dates.spring_start && dates.spring_end) {
    if (today >= dates.spring_start && today <= dates.spring_end) {
      return { type: 'spring', name: `${year}年春季学期`, startDate: dates.spring_start, endDate: dates.spring_end }
    }
  }
  
  // 暑假
  if (dates.summer_start && dates.summer_end) {
    if (today >= dates.summer_start && today <= dates.summer_end) {
      return { type: 'summer', name: `${year}年暑假`, startDate: dates.summer_start, endDate: dates.summer_end }
    }
  }
  
  // 秋季学期
  if (dates.autumn_start && dates.autumn_end) {
    if (today >= dates.autumn_start && today <= dates.autumn_end) {
      return { type: 'autumn', name: `${year}年秋季学期`, startDate: dates.autumn_start, endDate: dates.autumn_end }
    }
  }
  
  // 寒假
  if (dates.winter_start && dates.winter_end) {
    if (today >= dates.winter_start && today <= dates.winter_end) {
      return { type: 'winter', name: `${year}年寒假`, startDate: dates.winter_start, endDate: dates.winter_end }
    }
  }
  
  return { type: null, name: '', startDate: null, endDate: null }
}

// 检查是否需要设置学期节点
function checkNeedSetup(dates: SemesterDates): boolean {
  const currentMonth = new Date().getMonth() + 1
  
  // 如果当前是1-2月或7-8月，检查是否设置了寒暑假
  if (currentMonth === 1 || currentMonth === 2) {
    return !dates.winter_start || !dates.winter_end
  }
  if (currentMonth === 7 || currentMonth === 8) {
    return !dates.summer_start || !dates.summer_end
  }
  
  // 如果当前是3-6月，检查是否设置了春季学期
  if (currentMonth >= 3 && currentMonth <= 6) {
    return !dates.spring_start || !dates.spring_end
  }
  
  // 如果当前是9-12月，检查是否设置了秋季学期
  if (currentMonth >= 9 && currentMonth <= 12) {
    return !dates.autumn_start || !dates.autumn_end
  }
  
  return false
}

// 检查备份提醒
function checkBackupReminder(dates: SemesterDates): { need: boolean; days: number } {
  if (!dates.last_backup_date) {
    return { need: true, days: 999 }
  }
  
  const lastBackup = new Date(dates.last_backup_date)
  const today = new Date()
  const diffDays = Math.floor((today.getTime() - lastBackup.getTime()) / (1000 * 60 * 60 * 24))
  
  return { need: diffDays > 7, days: diffDays }
}

export function SemesterReminder() {
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState(false)
  const [lastBackupDate, setLastBackupDate] = useState<string | null>(null)
  
  // 从 store 获取学期配置
  const semesterConfig = useAppStore(state => state.semesterConfig)

  useEffect(() => {
    // 只需要加载备份日期，学期配置已在 main.tsx 中加载到 store
    loadBackupDate()
  }, [])

  const loadBackupDate = async () => {
    const lastBackup = await settingsDb.get('last_backup_date')
    setLastBackupDate(lastBackup)
  }
  
  // 将 store 的 semesterConfig 转换为 SemesterDates 格式
  const dates: SemesterDates = {
    spring_start: semesterConfig?.spring_start || null,
    spring_end: semesterConfig?.spring_end || null,
    summer_start: semesterConfig?.summer_start || null,
    summer_end: semesterConfig?.summer_end || null,
    autumn_start: semesterConfig?.autumn_start || null,
    autumn_end: semesterConfig?.autumn_end || null,
    winter_start: semesterConfig?.winter_start || null,
    winter_end: semesterConfig?.winter_end || null,
    last_backup_date: lastBackupDate
  }

  const currentSemester = getCurrentSemester(dates)
  const needSetup = checkNeedSetup(dates)
  const backupReminder = checkBackupReminder(dates)

  // 如果已关闭或者没有需要提醒的内容，不显示
  if (dismissed) return null

  const reminders: JSX.Element[] = []

  // 学期节点设置提醒
  if (needSetup) {
    reminders.push(
      <div key="semester" className="flex items-center gap-2 text-sm">
        <Calendar className="w-4 h-4 text-primary" />
        <span>当前学期节点未设置，建议前往设置</span>
      </div>
    )
  }

  // 备份提醒
  if (backupReminder.need) {
    reminders.push(
      <div key="backup" className="flex items-center gap-2 text-sm">
        <AlertTriangle className="w-4 h-4 text-warning" />
        <span>
          {backupReminder.days === 999 
            ? '尚未进行数据备份，建议立即备份' 
            : `距上次备份已过 ${backupReminder.days} 天，建议进行数据备份`}
        </span>
      </div>
    )
  }

  if (reminders.length === 0) return null

  return (
    <div className={cn(
      "px-6 py-3 border-b",
      "bg-primary/5 border-primary/20"
    )}>
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          {reminders}
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/settings')}
          >
            <Settings className="w-3 h-3 mr-1" />
            前往设置
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            className="h-7 w-7"
            onClick={() => setDismissed(true)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// 当前学期显示组件
export function CurrentSemesterBadge() {
  // 从 store 获取学期配置
  const semesterConfig = useAppStore(state => state.semesterConfig)
  
  // 将 store 的 semesterConfig 转换为 SemesterDates 格式
  const dates: SemesterDates = {
    spring_start: semesterConfig?.spring_start || null,
    spring_end: semesterConfig?.spring_end || null,
    summer_start: semesterConfig?.summer_start || null,
    summer_end: semesterConfig?.summer_end || null,
    autumn_start: semesterConfig?.autumn_start || null,
    autumn_end: semesterConfig?.autumn_end || null,
    winter_start: semesterConfig?.winter_start || null,
    winter_end: semesterConfig?.winter_end || null,
    last_backup_date: null
  }

  const currentSemester = getCurrentSemester(dates)

  if (!currentSemester.type) return null

  const colorMap: Record<string, string> = {
    spring: 'bg-green-500/10 text-green-600',
    summer: 'bg-orange-500/10 text-orange-600',
    autumn: 'bg-blue-500/10 text-blue-600',
    winter: 'bg-cyan-500/10 text-cyan-600'
  }

  return (
    <span className={cn("text-xs px-2 py-0.5 rounded", colorMap[currentSemester.type])}>
      {currentSemester.name}
    </span>
  )
}