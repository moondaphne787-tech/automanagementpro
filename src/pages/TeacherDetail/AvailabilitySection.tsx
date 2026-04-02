import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { Plus, Trash2, Clock, Calendar, Copy, ChevronDown, ChevronUp } from 'lucide-react'
import { teacherAvailabilityDb } from '@/db'
import type { TeacherAvailability, DayOfWeek } from '@/types'
import { DAY_LABELS } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

const DAY_OPTIONS = [
  { value: 'monday', label: '周一' },
  { value: 'tuesday', label: '周二' },
  { value: 'wednesday', label: '周三' },
  { value: 'thursday', label: '周四' },
  { value: 'friday', label: '周五' },
  { value: 'saturday', label: '周六' },
  { value: 'sunday', label: '周日' }
]

// 获取本周周一日期
function getWeekStart(date: Date = new Date()): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // 调整到周一
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

// 格式化日期显示
function formatWeekDisplay(weekStart: string): string {
  const date = new Date(weekStart)
  const month = date.getMonth() + 1
  const day = date.getDate()
  const endDate = new Date(date)
  endDate.setDate(endDate.getDate() + 6)
  const endMonth = endDate.getMonth() + 1
  const endDay = endDate.getDate()
  return `${month}月${day}日 - ${endMonth}月${endDay}日`
}

interface AvailabilitySectionProps {
  teacherId: string
  availabilities: TeacherAvailability[]
  onDataReload: () => void
}

export function AvailabilitySection({ teacherId, availabilities, onDataReload }: AvailabilitySectionProps) {
  // 时段对话框
  const [availabilityDialogOpen, setAvailabilityDialogOpen] = useState(false)
  const [availabilityForm, setAvailabilityForm] = useState({
    day_of_week: 'saturday' as DayOfWeek,
    start_time: '09:00',
    end_time: '12:00',
    notes: '',
    is_week_specific: false,
    week_start: ''
  })
  const [saving, setSaving] = useState(false)
  
  // 周选择
  const [selectedWeekStart, setSelectedWeekStart] = useState(getWeekStart())
  const [showGeneralSlots, setShowGeneralSlots] = useState(true)
  
  // 按星期分组时段（区分通用和特定周）
  const { generalAvailabilities, weekSpecificAvailabilities } = useMemo(() => {
    const general: TeacherAvailability[] = []
    const weekSpecific: Record<string, TeacherAvailability[]> = {}
    
    availabilities.forEach(a => {
      if (!a.week_start) {
        general.push(a)
      } else {
        if (!weekSpecific[a.week_start]) {
          weekSpecific[a.week_start] = []
        }
        weekSpecific[a.week_start].push(a)
      }
    })
    
    return { generalAvailabilities: general, weekSpecificAvailabilities: weekSpecific }
  }, [availabilities])
  
  // 获取当前选中周的时段
  const currentWeekAvailabilities = weekSpecificAvailabilities[selectedWeekStart] || []
  
  // 按星期分组的通用时段
  const groupedGeneralAvailabilities = generalAvailabilities.reduce((acc, a) => {
    const day = a.day_of_week
    if (!acc[day]) acc[day] = []
    acc[day].push(a)
    return acc
  }, {} as Record<DayOfWeek, TeacherAvailability[]>)
  
  // 按星期分组的特定周时段
  const groupedWeekAvailabilities = currentWeekAvailabilities.reduce((acc, a) => {
    const day = a.day_of_week
    if (!acc[day]) acc[day] = []
    acc[day].push(a)
    return acc
  }, {} as Record<DayOfWeek, TeacherAvailability[]>)
  
  // 获取所有有特定时段的周
  const weeksWithAvailability = Object.keys(weekSpecificAvailabilities).sort()
  
  // 打开添加时段对话框
  const handleOpenAvailabilityDialog = (isWeekSpecific: boolean = false) => {
    setAvailabilityForm({
      day_of_week: 'saturday',
      start_time: '09:00',
      end_time: '12:00',
      notes: '',
      is_week_specific: isWeekSpecific,
      week_start: isWeekSpecific ? selectedWeekStart : ''
    })
    setAvailabilityDialogOpen(true)
  }
  
  // 添加时段
  const handleAddAvailability = async () => {
    if (!teacherId) return
    
    try {
      setSaving(true)
      await teacherAvailabilityDb.create({
        teacher_id: teacherId,
        day_of_week: availabilityForm.day_of_week,
        start_time: availabilityForm.start_time,
        end_time: availabilityForm.end_time,
        notes: availabilityForm.notes || undefined,
        week_start: availabilityForm.is_week_specific ? availabilityForm.week_start : undefined
      })
      
      setAvailabilityDialogOpen(false)
      setAvailabilityForm({
        day_of_week: 'saturday',
        start_time: '09:00',
        end_time: '12:00',
        notes: '',
        is_week_specific: false,
        week_start: ''
      })
      onDataReload()
      toast.success('时段添加成功')
    } catch (error) {
      console.error('Failed to add availability:', error)
      toast.error('添加失败，请重试')
    } finally {
      setSaving(false)
    }
  }
  
  // 复制通用时段到本周
  const handleCopyGeneralToWeek = async () => {
    if (!teacherId || generalAvailabilities.length === 0) return
    
    const confirmed = await confirmDialog({
      title: '复制时段',
      message: '确定要将通用时段复制到本周吗？这将保留原有的通用时段，同时为本周创建副本。',
      confirmText: '复制',
      variant: 'info'
    })
    if (!confirmed) return
    
    try {
      setSaving(true)
      for (const a of generalAvailabilities) {
        await teacherAvailabilityDb.create({
          teacher_id: teacherId,
          day_of_week: a.day_of_week,
          start_time: a.start_time || undefined,
          end_time: a.end_time || undefined,
          notes: a.notes || undefined,
          week_start: selectedWeekStart
        })
      }
      onDataReload()
      toast.success('时段复制成功')
    } catch (error) {
      console.error('Failed to copy availability:', error)
      toast.error('复制失败，请重试')
    } finally {
      setSaving(false)
    }
  }
  
  // 清除本周特定时段
  const handleClearWeekAvailability = async () => {
    if (!teacherId || currentWeekAvailabilities.length === 0) return
    
    const confirmed = await confirmDialog({
      title: '清除时段',
      message: '确定要清除本周的特定时段吗？',
      confirmText: '清除',
      variant: 'warning'
    })
    if (!confirmed) return
    
    try {
      setSaving(true)
      for (const a of currentWeekAvailabilities) {
        await teacherAvailabilityDb.delete(a.id)
      }
      onDataReload()
      toast.success('本周时段已清除')
    } catch (error) {
      console.error('Failed to clear week availability:', error)
      toast.error('清除失败，请重试')
    } finally {
      setSaving(false)
    }
  }
  
  // 删除时段
  const handleDeleteAvailability = async (availabilityId: string) => {
    const confirmed = await confirmDialog({
      title: '删除时段',
      message: '确定要删除这个时段吗？',
      confirmText: '删除',
      variant: 'danger'
    })
    if (!confirmed) return
    
    try {
      await teacherAvailabilityDb.delete(availabilityId)
      onDataReload()
      toast.success('时段已删除')
    } catch (error) {
      console.error('Failed to delete availability:', error)
      toast.error('删除失败，请重试')
    }
  }
  
  return (
    <Card className="p-6 lg:col-span-2">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">可用时段</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleOpenAvailabilityDialog(false)}>
            <Plus className="h-4 w-4 mr-1" />
            添加通用时段
          </Button>
          <Button size="sm" onClick={() => handleOpenAvailabilityDialog(true)}>
            <Plus className="h-4 w-4 mr-1" />
            添加本周时段
          </Button>
        </div>
      </div>
      
      {availabilities.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          暂无可用时段，点击上方按钮添加
        </p>
      ) : (
        <div className="space-y-6">
          {/* 通用时段（每周都可用） */}
          {generalAvailabilities.length > 0 && (
            <div>
              <button
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                onClick={() => setShowGeneralSlots(!showGeneralSlots)}
              >
                {showGeneralSlots ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                通用时段（每周可用）
                <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-xs">
                  {generalAvailabilities.length}
                </span>
              </button>
              
              <AnimatePresence>
                {showGeneralSlots && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-2 gap-4 mt-3">
                      {(['saturday', 'sunday'] as DayOfWeek[]).map(day => (
                        <div key={day}>
                          <div className="text-sm font-medium mb-2">{DAY_LABELS[day]}</div>
                          <div className="space-y-2">
                            {groupedGeneralAvailabilities[day]?.map(a => (
                              <motion.div
                                key={a.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="flex items-center justify-between p-2 bg-blue-50 border border-blue-100 rounded-lg"
                              >
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-blue-500" />
                                  <span className="text-sm">
                                    {a.start_time?.slice(0, 5)} - {a.end_time?.slice(0, 5)}
                                  </span>
                                  {a.notes && (
                                    <span className="text-xs text-muted-foreground">({a.notes})</span>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteAvailability(a.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </motion.div>
                            ))}
                            {!groupedGeneralAvailabilities[day] && (
                              <p className="text-xs text-muted-foreground py-2">暂无时段</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
          
          {/* 特定周时段 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-muted-foreground">特定周时段</label>
                <Input
                  type="date"
                  value={selectedWeekStart}
                  onChange={e => setSelectedWeekStart(e.target.value)}
                  className="w-40"
                />
                <span className="text-sm text-muted-foreground">
                  {formatWeekDisplay(selectedWeekStart)}
                </span>
              </div>
              <div className="flex gap-2">
                {generalAvailabilities.length > 0 && currentWeekAvailabilities.length === 0 && (
                  <Button variant="outline" size="sm" onClick={handleCopyGeneralToWeek}>
                    <Copy className="h-4 w-4 mr-1" />
                    复制通用时段
                  </Button>
                )}
                {currentWeekAvailabilities.length > 0 && (
                  <Button variant="outline" size="sm" onClick={handleClearWeekAvailability}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    清除本周
                  </Button>
                )}
              </div>
            </div>
            
            {currentWeekAvailabilities.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {(['saturday', 'sunday'] as DayOfWeek[]).map(day => (
                  <div key={day}>
                    <div className="text-sm font-medium mb-2">{DAY_LABELS[day]}</div>
                    <div className="space-y-2">
                      {groupedWeekAvailabilities[day]?.map(a => (
                        <motion.div
                          key={a.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center justify-between p-2 bg-green-50 border border-green-100 rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-green-500" />
                            <span className="text-sm">
                              {a.start_time?.slice(0, 5)} - {a.end_time?.slice(0, 5)}
                            </span>
                            {a.notes && (
                              <span className="text-xs text-muted-foreground">({a.notes})</span>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteAvailability(a.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </motion.div>
                      ))}
                      {!groupedWeekAvailabilities[day] && (
                        <p className="text-xs text-muted-foreground py-2">暂无时段</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 bg-muted/30 rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">
                  本周暂无特定时段设置
                </p>
                {generalAvailabilities.length > 0 ? (
                  <Button variant="outline" size="sm" onClick={handleCopyGeneralToWeek}>
                    <Copy className="h-4 w-4 mr-1" />
                    从通用时段复制
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    请先添加通用时段或直接为本周添加特定时段
                  </p>
                )}
              </div>
            )}
            
            {/* 其他周的时段（快速切换） */}
            {weeksWithAvailability.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <div className="text-xs text-muted-foreground mb-2">其他已设置的周：</div>
                <div className="flex flex-wrap gap-2">
                  {weeksWithAvailability.map(week => (
                    <button
                      key={week}
                      onClick={() => setSelectedWeekStart(week)}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        week === selectedWeekStart
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      {formatWeekDisplay(week)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* 添加时段对话框 */}
      <Dialog open={availabilityDialogOpen} onOpenChange={setAvailabilityDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {availabilityForm.is_week_specific ? '添加本周特定时段' : '添加通用时段'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* 显示当前设置的时段类型 */}
            {availabilityForm.is_week_specific && (
              <div className="p-3 bg-green-50 border border-green-100 rounded-lg text-sm">
                <div className="flex items-center gap-2 text-green-700">
                  <Calendar className="h-4 w-4" />
                  <span>为 <strong>{formatWeekDisplay(availabilityForm.week_start)}</strong> 添加特定时段</span>
                </div>
              </div>
            )}
            
            {!availabilityForm.is_week_specific && (
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm">
                <div className="flex items-center gap-2 text-blue-700">
                  <Clock className="h-4 w-4" />
                  <span>添加通用时段，每周都可用</span>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium">星期</label>
              <Select
                value={availabilityForm.day_of_week}
                onChange={e => setAvailabilityForm(prev => ({ ...prev, day_of_week: e.target.value as DayOfWeek }))}
                options={DAY_OPTIONS}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">开始时间</label>
                <Input
                  type="time"
                  value={availabilityForm.start_time}
                  onChange={e => setAvailabilityForm(prev => ({ ...prev, start_time: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">结束时间</label>
                <Input
                  type="time"
                  value={availabilityForm.end_time}
                  onChange={e => setAvailabilityForm(prev => ({ ...prev, end_time: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">备注</label>
              <Input
                value={availabilityForm.notes}
                onChange={e => setAvailabilityForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="可选备注"
              />
            </div>
            
            {/* 如果是添加本周时段，允许切换周 */}
            {availabilityForm.is_week_specific && (
              <div className="space-y-2">
                <label className="text-sm font-medium">选择周</label>
                <Input
                  type="date"
                  value={availabilityForm.week_start}
                  onChange={e => setAvailabilityForm(prev => ({ ...prev, week_start: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  选择周一日期，该时段将仅对所选周有效
                </p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setAvailabilityDialogOpen(false)}>取消</Button>
            <Button onClick={handleAddAvailability} disabled={saving}>
              {saving ? '添加中...' : '添加'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}