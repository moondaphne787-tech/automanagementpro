import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import {
  RefreshCw,
  User,
  Filter,
  Pencil,
  Trash2,
  Plus,
  X,
  Check,
  Search
} from 'lucide-react'
import { studentSchedulePreferenceDb, studentDb } from '@/db'
import type { StudentSchedulePreference, Student, DayOfWeek } from '@/types'
import { DAY_LABELS } from '@/types'
import { Button } from '@/components/ui/button'

// 星期排序
const DAY_ORDER: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

// 星期选项（用于下拉选择）
const DAY_OPTIONS = DAY_ORDER.map(day => ({
  value: day,
  label: DAY_LABELS[day]
}))

interface PreferenceWithStudent extends StudentSchedulePreference {
  student: Student
}

interface StudentPrefGroup {
  student: Student
  preferences: PreferenceWithStudent[]
}

// 编辑表单状态类型
interface EditForm {
  day_of_week: DayOfWeek
  preferred_start: string
  preferred_end: string
  notes: string
}

// 空编辑表单
const EMPTY_EDIT_FORM: EditForm = {
  day_of_week: 'saturday',
  preferred_start: '09:00',
  preferred_end: '11:00',
  notes: ''
}

export function PreferenceManage() {
  // 所有时段偏好数据
  const [preferences, setPreferences] = useState<PreferenceWithStudent[]>([])
  
  // 所有在读学员
  const [students, setStudents] = useState<Student[]>([])
  
  // 加载状态
  const [loading, setLoading] = useState(true)
  
  // 选中的星期筛选
  const [selectedDay, setSelectedDay] = useState<DayOfWeek | 'all'>('all')
  
  // 搜索关键词
  const [searchKeyword, setSearchKeyword] = useState('')
  
  // 编辑状态：正在编辑的偏好ID
  const [editingPrefId, setEditingPrefId] = useState<string | null>(null)
  
  // 编辑表单数据
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_EDIT_FORM)
  
  // 新增状态：正在新增的学员ID
  const [addingForStudentId, setAddingForStudentId] = useState<string | null>(null)
  
  // 新增表单数据
  const [addForm, setAddForm] = useState<EditForm>(EMPTY_EDIT_FORM)
  
  // 删除确认状态
  const [deletingPrefId, setDeletingPrefId] = useState<string | null>(null)
  
  // 操作中状态
  const [operating, setOperating] = useState(false)

  // 加载所有数据
  const loadData = async () => {
    setLoading(true)
    try {
      // 加载所有时段偏好
      const prefsData = await studentSchedulePreferenceDb.getAllWithStudents()
      setPreferences(prefsData)
      
      // 加载所有在读学员
      const studentsData = await studentDb.getAll()
      const activeStudents = studentsData.filter(s => s.status === 'active')
      setStudents(activeStudents)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // 按学员分组的偏好数据
  const preferencesByStudent = useMemo(() => {
    const studentMap = new Map<string, StudentPrefGroup>()
    
    for (const pref of preferences) {
      const existing = studentMap.get(pref.student_id)
      if (existing) {
        existing.preferences.push(pref)
      } else {
        studentMap.set(pref.student_id, {
          student: pref.student,
          preferences: [pref]
        })
      }
    }
    
    // 转为数组并按学员姓名排序
    const result = Array.from(studentMap.values())
    result.sort((a, b) => a.student.name.localeCompare(b.student.name))
    
    // 每个学员内的偏好按星期排序
    for (const group of result) {
      group.preferences.sort((a, b) => {
        const dayOrderA = DAY_ORDER.indexOf(a.day_of_week)
        const dayOrderB = DAY_ORDER.indexOf(b.day_of_week)
        if (dayOrderA !== dayOrderB) return dayOrderA - dayOrderB
        return (a.preferred_start || '').localeCompare(b.preferred_start || '')
      })
    }
    
    return result
  }, [preferences])

  // 筛选后的学员列表
  const filteredStudents = useMemo(() => {
    let result = preferencesByStudent
    
    // 按星期筛选
    if (selectedDay !== 'all') {
      result = result.filter(s => 
        s.preferences.some(p => p.day_of_week === selectedDay)
      )
    }
    
    // 按关键词搜索
    if (searchKeyword.trim()) {
      const keyword = searchKeyword.toLowerCase().trim()
      result = result.filter(s => 
        s.student.name.toLowerCase().includes(keyword) ||
        (s.student.grade && s.student.grade.toLowerCase().includes(keyword))
      )
    }
    
    return result
  }, [preferencesByStudent, selectedDay, searchKeyword])

  // 未设置偏好的学员
  const studentsWithoutPrefs = useMemo(() => {
    const studentIdsWithPrefs = new Set(preferences.map(p => p.student_id))
    return students.filter(s => !studentIdsWithPrefs.has(s.id))
  }, [students, preferences])

  // 开始编辑偏好
  const handleStartEdit = (pref: PreferenceWithStudent) => {
    setEditingPrefId(pref.id)
    setEditForm({
      day_of_week: pref.day_of_week,
      preferred_start: pref.preferred_start || '09:00',
      preferred_end: pref.preferred_end || '11:00',
      notes: pref.notes || ''
    })
    // 关闭新增状态
    setAddingForStudentId(null)
  }

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingPrefId(null)
    setEditForm(EMPTY_EDIT_FORM)
  }

  // 保存编辑
  const handleSaveEdit = async () => {
    if (!editingPrefId) return
    
    setOperating(true)
    try {
      await studentSchedulePreferenceDb.update(editingPrefId, {
        day_of_week: editForm.day_of_week,
        preferred_start: editForm.preferred_start || null,
        preferred_end: editForm.preferred_end || null,
        notes: editForm.notes || null
      })
      
      // 刷新数据
      await loadData()
      setEditingPrefId(null)
      setEditForm(EMPTY_EDIT_FORM)
    } catch (error) {
      console.error('Failed to update preference:', error)
      toast.error('保存失败，请重试')
    } finally {
      setOperating(false)
    }
  }

  // 开始新增偏好
  const handleStartAdd = (studentId: string) => {
    setAddingForStudentId(studentId)
    setAddForm({
      day_of_week: 'saturday',
      preferred_start: '09:00',
      preferred_end: '11:00',
      notes: ''
    })
    // 关闭编辑状态
    setEditingPrefId(null)
  }

  // 取消新增
  const handleCancelAdd = () => {
    setAddingForStudentId(null)
    setAddForm(EMPTY_EDIT_FORM)
  }

  // 保存新增
  const handleSaveAdd = async (studentId: string) => {
    setOperating(true)
    try {
      await studentSchedulePreferenceDb.create({
        student_id: studentId,
        day_of_week: addForm.day_of_week,
        preferred_start: addForm.preferred_start || undefined,
        preferred_end: addForm.preferred_end || undefined,
        notes: addForm.notes || undefined
      })
      
      // 刷新数据
      await loadData()
      setAddingForStudentId(null)
      setAddForm(EMPTY_EDIT_FORM)
    } catch (error) {
      console.error('Failed to create preference:', error)
      toast.error('添加失败，请重试')
    } finally {
      setOperating(false)
    }
  }

  // 删除偏好
  const handleDelete = async (prefId: string) => {
    const confirmed = await confirmDialog({
      title: '删除时段偏好',
      message: '确定要删除这条时段偏好吗？',
      confirmText: '删除',
      variant: 'danger'
    })
    if (!confirmed) {
      return
    }
    
    setDeletingPrefId(prefId)
    setOperating(true)
    try {
      await studentSchedulePreferenceDb.delete(prefId)
      
      // 刷新数据
      await loadData()
      setDeletingPrefId(null)
      toast.success('时段偏好已删除')
    } catch (error) {
      console.error('Failed to delete preference:', error)
      toast.error('删除失败，请重试')
    } finally {
      setOperating(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <header className="h-16 border-b bg-card flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">时段偏好管理</h1>
        </div>

        <div className="flex items-center gap-2">
          {/* 刷新 */}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </header>

      {/* 筛选栏 */}
      <div className="border-b bg-muted/30 px-6 py-3">
        <div className="flex items-center gap-4 flex-wrap">
          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="搜索学员..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="pl-9 pr-4 py-2 border rounded-md text-sm w-48 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* 星期筛选 */}
          <div className="flex bg-muted rounded-lg p-1">
            <button
              onClick={() => setSelectedDay('all')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                selectedDay === 'all' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              全部
            </button>
            {DAY_ORDER.map(day => (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  selectedDay === day ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {DAY_LABELS[day]}
              </button>
            ))}
          </div>

          {/* 统计信息 */}
          <div className="flex items-center gap-3 text-sm text-muted-foreground ml-auto">
            <span>共 {students.length} 名在读学员</span>
            <span>{preferencesByStudent.length} 名已设置偏好</span>
          </div>
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            加载中...
          </div>
        ) : (
          <div className="space-y-6">
            {/* 学员卡片 Grid */}
            {filteredStudents.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Filter className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>暂无时段偏好数据</p>
                {searchKeyword && (
                  <p className="text-sm mt-1">未找到匹配"{searchKeyword}"的学员</p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredStudents.map(({ student, preferences: prefs }) => (
                  <div 
                    key={student.id}
                    className="bg-card border rounded-lg overflow-hidden"
                  >
                    {/* 卡片头部 */}
                    <div className="bg-muted/50 px-4 py-3 border-b flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{student.name}</span>
                        {student.grade && (
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                            {student.grade}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {prefs.length} 个时段
                      </span>
                    </div>
                    
                    {/* 偏好列表 */}
                    <div className="divide-y">
                      {prefs.map(pref => (
                        <div 
                          key={pref.id}
                          className="px-4 py-1.5 hover:bg-muted/30"
                        >
                          {editingPrefId === pref.id ? (
                            // 编辑模式
                            <div className="flex items-center gap-2 flex-wrap">
                              <select
                                value={editForm.day_of_week}
                                onChange={(e) => setEditForm(prev => ({ ...prev, day_of_week: e.target.value as DayOfWeek }))}
                                className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                              >
                                {DAY_OPTIONS.map(opt => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                              <input
                                type="time"
                                value={editForm.preferred_start}
                                onChange={(e) => setEditForm(prev => ({ ...prev, preferred_start: e.target.value }))}
                                className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                              />
                              <span className="text-muted-foreground">-</span>
                              <input
                                type="time"
                                value={editForm.preferred_end}
                                onChange={(e) => setEditForm(prev => ({ ...prev, preferred_end: e.target.value }))}
                                className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                              />
                              <div className="flex items-center gap-1 ml-auto">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={handleSaveEdit}
                                  disabled={operating}
                                  className="h-7 w-7 p-0"
                                >
                                  <Check className="h-4 w-4 text-green-600" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={handleCancelEdit}
                                  disabled={operating}
                                  className="h-7 w-7 p-0"
                                >
                                  <X className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            // 显示模式
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-medium">
                                  {DAY_LABELS[pref.day_of_week]}
                                </span>
                                <span className="text-sm font-mono">
                                  {pref.preferred_start?.slice(0, 5) || '--:--'} - {pref.preferred_end?.slice(0, 5) || '--:--'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleStartEdit(pref)}
                                  className="h-7 w-7 p-0"
                                >
                                  <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDelete(pref.id)}
                                  disabled={operating && deletingPrefId === pref.id}
                                  className="h-7 w-7 p-0"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      
                      {/* 新增偏好表单 */}
                      {addingForStudentId === student.id && (
                        <div className="px-4 py-3 bg-muted/30 border-t">
                          <div className="flex items-center gap-2 flex-wrap">
                            <select
                              value={addForm.day_of_week}
                              onChange={(e) => setAddForm(prev => ({ ...prev, day_of_week: e.target.value as DayOfWeek }))}
                              className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                              {DAY_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                            <input
                              type="time"
                              value={addForm.preferred_start}
                              onChange={(e) => setAddForm(prev => ({ ...prev, preferred_start: e.target.value }))}
                              className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                            <span className="text-muted-foreground">-</span>
                            <input
                              type="time"
                              value={addForm.preferred_end}
                              onChange={(e) => setAddForm(prev => ({ ...prev, preferred_end: e.target.value }))}
                              className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                            <div className="flex items-center gap-1 ml-auto">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleSaveAdd(student.id)}
                                disabled={operating}
                              >
                                保存
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleCancelAdd}
                                disabled={operating}
                              >
                                取消
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* 添加时段按钮 */}
                      {addingForStudentId !== student.id && (
                        <div className="px-4 py-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleStartAdd(student.id)}
                            className="w-full text-muted-foreground hover:text-foreground"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            添加时段
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 未设置偏好的学员提示 */}
            {studentsWithoutPrefs.length > 0 && (
              <div className="bg-muted/50 border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    未设置时段偏好的学员 ({studentsWithoutPrefs.length}人)
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {studentsWithoutPrefs.slice(0, 10).map(s => (
                    <button
                      key={s.id}
                      className={`text-xs px-2 py-1 rounded transition-colors ${
                        addingForStudentId === s.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-primary/10 hover:text-primary'
                      }`}
                      onClick={() => addingForStudentId === s.id ? handleCancelAdd() : handleStartAdd(s.id)}
                      title={`为 ${s.name} 添加时段偏好`}
                    >
                      {s.name}
                      <Plus className="inline w-3 h-3 ml-0.5 opacity-50" />
                    </button>
                  ))}
                  {studentsWithoutPrefs.length > 10 && (
                    <span className="text-xs text-muted-foreground self-center">
                      等 {studentsWithoutPrefs.length - 10} 人...
                    </span>
                  )}
                </div>

                {/* 未设置偏好学员的内联添加表单 */}
                {addingForStudentId && studentsWithoutPrefs.some(s => s.id === addingForStudentId) && (
                  <div className="mt-3 bg-card border rounded-lg p-3">
                    <div className="text-sm font-medium mb-2">
                      为 {studentsWithoutPrefs.find(s => s.id === addingForStudentId)?.name} 添加时段偏好
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        value={addForm.day_of_week}
                        onChange={(e) => setAddForm(prev => ({ ...prev, day_of_week: e.target.value as DayOfWeek }))}
                        className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        {DAY_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <input
                        type="time"
                        value={addForm.preferred_start}
                        onChange={(e) => setAddForm(prev => ({ ...prev, preferred_start: e.target.value }))}
                        className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <span className="text-muted-foreground">-</span>
                      <input
                        type="time"
                        value={addForm.preferred_end}
                        onChange={(e) => setAddForm(prev => ({ ...prev, preferred_end: e.target.value }))}
                        className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <div className="flex items-center gap-1 ml-auto">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleSaveAdd(addingForStudentId)}
                          disabled={operating}
                        >
                          保存
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleCancelAdd}
                          disabled={operating}
                        >
                          取消
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                <p className="text-xs text-muted-foreground mt-2">
                  点击学员姓名可快速为其添加时段偏好
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}