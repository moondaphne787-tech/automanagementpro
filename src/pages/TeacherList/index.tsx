import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Plus, Search, Award, AlertTriangle } from 'lucide-react'
import { teacherDb } from '@/db'
import type { Teacher, TeacherStatus, TrainingStage } from '@/types'
import { TRAINING_STAGE_LABELS, TEACHER_UPGRADE_THRESHOLDS } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { TeacherCard } from './TeacherCard'
import { TeacherFormDialog } from './TeacherFormDialog'

const STATUS_SELECT_OPTIONS = [
  { value: 'all', label: '全部状态' },
  { value: 'active', label: '在职' },
  { value: 'inactive', label: '离职' }
]

interface UpgradeReminder {
  teacher: Teacher
  newStage: TrainingStage
  message: string
  currentHours: number
  threshold: number
}

export function TeacherList() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<TeacherStatus | 'all'>('all')
  
  // 对话框状态
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null)
  
  // 删除确认对话框
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingTeacher, setDeletingTeacher] = useState<Teacher | null>(null)
  
  // 升级提醒
  const [upgradeReminders, setUpgradeReminders] = useState<UpgradeReminder[]>([])
  const [currentUpgradeIndex, setCurrentUpgradeIndex] = useState(0)
  
  // 加载助教列表
  const loadTeachers = async () => {
    try {
      setLoading(true)
      const data = await teacherDb.getAll()
      setTeachers(data)
      
      // 检查升级提醒
      checkUpgradeReminders(data)
    } catch (error) {
      console.error('Failed to load teachers:', error)
    } finally {
      setLoading(false)
    }
  }
  
  // 检查升级提醒
  const checkUpgradeReminders = (teacherList: Teacher[]) => {
    const reminders: UpgradeReminder[] = []
    
    for (const teacher of teacherList) {
      if (teacher.status !== 'active') continue
      
      const hours = teacher.total_teaching_hours || 0
      const stage = teacher.training_stage || 'probation'
      
      // 实训期满2小时 → 提醒升级实习期
      if (stage === 'probation' && hours >= TEACHER_UPGRADE_THRESHOLDS.probation.hours) {
        reminders.push({
          teacher,
          newStage: TEACHER_UPGRADE_THRESHOLDS.probation.nextStage,
          message: `${teacher.name} 已累计教学 ${hours} 小时，建议从实训期升级为${TEACHER_UPGRADE_THRESHOLDS.probation.nextLabel}`,
          currentHours: hours,
          threshold: TEACHER_UPGRADE_THRESHOLDS.probation.hours
        })
      }
      
      // 实习期满10小时 → 提醒升级正式助教
      if (stage === 'intern' && hours >= TEACHER_UPGRADE_THRESHOLDS.intern.hours) {
        reminders.push({
          teacher,
          newStage: TEACHER_UPGRADE_THRESHOLDS.intern.nextStage,
          message: `${teacher.name} 已累计教学 ${hours} 小时，建议从实习期升级为${TEACHER_UPGRADE_THRESHOLDS.intern.nextLabel}`,
          currentHours: hours,
          threshold: TEACHER_UPGRADE_THRESHOLDS.intern.hours
        })
      }
    }
    
    setUpgradeReminders(reminders)
  }
  
  useEffect(() => {
    loadTeachers()
  }, [])
  
  // 筛选后的列表
  const filteredTeachers = useMemo(() => {
    return teachers.filter(teacher => {
      const matchesSearch = teacher.name.includes(search) || 
        (teacher.phone && teacher.phone.includes(search)) ||
        (teacher.university && teacher.university.includes(search))
      const matchesStatus = statusFilter === 'all' || teacher.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [teachers, search, statusFilter])
  
  // 检查哪些教师需要升级（用于卡片显示）
  const teacherUpgradeMap = useMemo(() => {
    const map = new Map<string, boolean>()
    upgradeReminders.forEach(r => map.set(r.teacher.id, true))
    return map
  }, [upgradeReminders])
  
  // 打开新建对话框
  const handleCreate = () => {
    setEditingTeacher(null)
    setDialogOpen(true)
  }
  
  // 打开编辑对话框
  const handleEdit = (teacher: Teacher) => {
    setEditingTeacher(teacher)
    setDialogOpen(true)
  }
  
  // 关闭对话框
  const handleDialogClose = () => {
    setDialogOpen(false)
    setEditingTeacher(null)
  }
  
  // 删除助教
  const handleDelete = async () => {
    if (!deletingTeacher) return
    
    try {
      await teacherDb.delete(deletingTeacher.id)
      setDeleteDialogOpen(false)
      setDeletingTeacher(null)
      loadTeachers()
      toast.success('助教已删除')
    } catch (error) {
      console.error('Failed to delete teacher:', error)
      toast.error('删除失败，请重试')
    }
  }
  
  // 打开删除确认对话框
  const handleOpenDeleteDialog = (teacher: Teacher) => {
    setDeletingTeacher(teacher)
    setDeleteDialogOpen(true)
  }
  
  // 处理升级
  const handleUpgrade = async (reminder: UpgradeReminder) => {
    try {
      await teacherDb.update(reminder.teacher.id, {
        training_stage: reminder.newStage
      })
      
      // 从提醒列表中移除
      setUpgradeReminders(prev => prev.filter(r => r.teacher.id !== reminder.teacher.id))
      loadTeachers()
      toast.success(`${reminder.teacher.name} 已升级为${reminder.newStage === 'formal' ? '正式助教' : '实习期'}`)
    } catch (error) {
      console.error('Failed to upgrade teacher:', error)
      toast.error('升级失败，请重试')
    }
  }
  
  // 跳过当前升级提醒
  const handleSkipUpgrade = () => {
    if (upgradeReminders.length === 0) return
    
    // 移除当前提醒
    const newReminders = upgradeReminders.slice(1)
    setUpgradeReminders(newReminders)
    setCurrentUpgradeIndex(0)
  }
  
  // 检查是否有升级提醒需要显示
  const currentReminder = upgradeReminders[currentUpgradeIndex]
  
  return (
    <div className="h-full flex flex-col">
      {/* 升级提醒横幅 */}
      {currentReminder && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-orange-50 border-b border-orange-200 px-6 py-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <span className="text-sm text-orange-800">{currentReminder.message}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSkipUpgrade}
              >
                稍后处理
              </Button>
              <Button
                size="sm"
                onClick={() => handleUpgrade(currentReminder)}
              >
                <Award className="h-4 w-4 mr-1" />
                确认升级
              </Button>
            </div>
          </div>
        </motion.div>
      )}
      
      {/* 头部 */}
      <header className="h-16 border-b bg-card flex items-center justify-between px-6">
        <h1 className="text-lg font-semibold">助教管理</h1>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          新增助教
        </Button>
      </header>
      
      {/* 筛选栏 */}
      <div className="p-4 border-b bg-card/50 flex gap-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索姓名/电话/院校"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as TeacherStatus | 'all')}
          options={STATUS_SELECT_OPTIONS}
          className="w-32"
        />
      </div>
      
      {/* 列表 */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="text-center text-muted-foreground py-12">加载中...</div>
        ) : filteredTeachers.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            {search || statusFilter !== 'all' ? '没有找到匹配的助教' : '暂无助教，点击上方按钮新增'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTeachers.map((teacher, index) => (
              <TeacherCard
                key={teacher.id}
                teacher={teacher}
                index={index}
                needsUpgrade={teacherUpgradeMap.get(teacher.id) || false}
                onEdit={handleEdit}
                onDelete={handleOpenDeleteDialog}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* 新建/编辑对话框 */}
      <TeacherFormDialog
        open={dialogOpen}
        editingTeacher={editingTeacher}
        onClose={handleDialogClose}
        onSuccess={loadTeachers}
      />
      
      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p className="py-4">
            确定要删除助教 <strong>{deletingTeacher?.name}</strong> 吗？此操作不可撤销。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>取消</Button>
            <Button variant="destructive" onClick={handleDelete}>删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}