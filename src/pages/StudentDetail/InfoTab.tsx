import { useState, useEffect } from 'react'
import { Edit, Trash2, Clock, Calendar, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAppStore } from '@/store/appStore'
import { studentSchedulePreferenceDb } from '@/db'
import { formatDateCN, formatHours, isHoursWarning, cn } from '@/lib/utils'
import { LEVEL_LABELS, STATUS_LABELS, STUDENT_TYPE_LABELS, DAY_LABELS } from '@/types'
import type { StudentSchedulePreference, DayOfWeek } from '@/types'

interface InfoTabProps {
  studentId: string
}

export function InfoTab({ studentId }: InfoTabProps) {
  const { currentStudent, currentBilling, updateBilling, updateStudent } = useAppStore()

  const [billingForm, setBillingForm] = useState({
    total_hours: '',
    warning_threshold: '3'
  })
  const [readingProgress, setReadingProgress] = useState('')
  const [schedulePreferences, setSchedulePreferences] = useState<StudentSchedulePreference[]>([])
  const [showPreferenceForm, setShowPreferenceForm] = useState(false)
  const [editingPreference, setEditingPreference] = useState<StudentSchedulePreference | null>(null)
  const [preferenceForm, setPreferenceForm] = useState({
    day_of_week: 'monday' as DayOfWeek,
    preferred_start: '09:00',
    preferred_end: '11:00',
    notes: ''
  })

  // 同步 billing 数据到表单
  useEffect(() => {
    if (currentBilling) {
      setBillingForm({
        total_hours: '',
        warning_threshold: currentBilling.warning_threshold.toString()
      })
    }
  }, [currentBilling])

  // 同步阅读进度到表单
  useEffect(() => {
    if (currentStudent) {
      setReadingProgress(currentStudent.reading_progress || '')
    }
  }, [currentStudent])

  // 加载偏好时段
  useEffect(() => {
    loadSchedulePreferences()
  }, [studentId])

  const loadSchedulePreferences = async () => {
    const prefs = await studentSchedulePreferenceDb.getByStudentId(studentId)
    setSchedulePreferences(prefs)
  }

  const handleAddHours = async () => {
    const hours = parseFloat(billingForm.total_hours)
    if (isNaN(hours) || hours <= 0) return
    const confirmMessage = `确定要增加 ${hours} 课时吗？\n\n当前购买课时：${formatHours(currentBilling?.total_hours || 0)}\n增加后：${formatHours((currentBilling?.total_hours || 0) + hours)}`
    if (!confirm(confirmMessage)) return
    await updateBilling(studentId, {
      total_hours: (currentBilling?.total_hours || 0) + hours
    })
    setBillingForm(prev => ({ ...prev, total_hours: '' }))
  }

  const handleUpdateReadingProgress = async () => {
    if (!currentStudent) return
    await updateStudent(studentId, {
      reading_progress: readingProgress || null
    })
  }

  const resetPreferenceForm = () => {
    setPreferenceForm({ day_of_week: 'monday', preferred_start: '09:00', preferred_end: '11:00', notes: '' })
  }

  const handleCreatePreference = async () => {
    await studentSchedulePreferenceDb.create({
      student_id: studentId,
      day_of_week: preferenceForm.day_of_week,
      preferred_start: preferenceForm.preferred_start || undefined,
      preferred_end: preferenceForm.preferred_end || undefined,
      notes: preferenceForm.notes || undefined
    })
    await loadSchedulePreferences()
    setShowPreferenceForm(false)
    resetPreferenceForm()
  }

  const handleUpdatePreference = async () => {
    if (!editingPreference) return
    await studentSchedulePreferenceDb.update(editingPreference.id, {
      day_of_week: preferenceForm.day_of_week,
      preferred_start: preferenceForm.preferred_start || undefined,
      preferred_end: preferenceForm.preferred_end || undefined,
      notes: preferenceForm.notes || undefined
    })
    await loadSchedulePreferences()
    setEditingPreference(null)
    resetPreferenceForm()
  }

  const handleDeletePreference = async (prefId: string) => {
    if (!confirm('确定要删除这个偏好时段吗？')) return
    await studentSchedulePreferenceDb.delete(prefId)
    await loadSchedulePreferences()
  }

  const openEditPreference = (pref: StudentSchedulePreference) => {
    setEditingPreference(pref)
    setPreferenceForm({
      day_of_week: pref.day_of_week,
      preferred_start: pref.preferred_start || '09:00',
      preferred_end: pref.preferred_end || '11:00',
      notes: pref.notes || ''
    })
  }

  if (!currentStudent) return null

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 基本信息 */}
      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">学员类型：</span>
              <span>{STUDENT_TYPE_LABELS[currentStudent.student_type]}</span>
            </div>
            <div>
              <span className="text-muted-foreground">状态：</span>
              <span>{STATUS_LABELS[currentStudent.status]}</span>
            </div>
            <div>
              <span className="text-muted-foreground">年级：</span>
              <span>{currentStudent.grade || '-'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">程度：</span>
              <span>{LEVEL_LABELS[currentStudent.level]}</span>
            </div>
            <div>
              <span className="text-muted-foreground">学校：</span>
              <span>{currentStudent.school || '-'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">入学日期：</span>
              <span>{formatDateCN(currentStudent.enroll_date)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">入学成绩：</span>
              <span>{currentStudent.initial_score || '-'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">入学词汇量：</span>
              <span>{currentStudent.initial_vocab || '-'}</span>
            </div>
          </div>
          {currentStudent.notes && (
            <div className="pt-3 border-t">
              <span className="text-muted-foreground text-sm">备注：</span>
              <p className="text-sm mt-1">{currentStudent.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 课时信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            课时信息
            {currentBilling && isHoursWarning(currentBilling) && (
              <span className="text-xs text-warning font-normal">（预警中）</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentBilling && (
            <>
              <div className="grid grid-cols-3 gap-4 text-center py-4 bg-muted/50 rounded-lg">
                <div>
                  <div className="text-2xl font-semibold">{formatHours(currentBilling.total_hours)}</div>
                  <div className="text-xs text-muted-foreground">购买课时</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold">{formatHours(currentBilling.used_hours)}</div>
                  <div className="text-xs text-muted-foreground">已用课时</div>
                </div>
                <div>
                  <div className={cn(
                    "text-2xl font-semibold",
                    isHoursWarning(currentBilling) && "text-warning"
                  )}>
                    {formatHours(currentBilling.remaining_hours)}
                  </div>
                  <div className="text-xs text-muted-foreground">剩余课时</div>
                </div>
              </div>
              
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="text-sm text-muted-foreground">增加课时</label>
                  <Input
                    type="number"
                    step="0.5"
                    value={billingForm.total_hours}
                    onChange={(e) => setBillingForm({ ...billingForm, total_hours: e.target.value })}
                    placeholder="输入课时数"
                  />
                </div>
                <Button onClick={handleAddHours}>增加</Button>
              </div>

              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="text-sm text-muted-foreground">预警阈值（小时）</label>
                  <Input
                    type="number"
                    step="0.5"
                    value={billingForm.warning_threshold}
                    onChange={(e) => setBillingForm({ ...billingForm, warning_threshold: e.target.value })}
                  />
                </div>
                <Button 
                  variant="outline"
                  onClick={() => updateBilling(studentId, { warning_threshold: parseFloat(billingForm.warning_threshold) })}
                >
                  保存
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 偏好时段 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            偏好时段
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {schedulePreferences.length === 0 && !showPreferenceForm ? (
            <div className="text-sm text-muted-foreground text-center py-4">
              暂无偏好时段设置
            </div>
          ) : (
            <div className="space-y-1">
              {schedulePreferences.map((pref) => {
                // 如果正在编辑这个偏好，显示内联编辑表单
                if (editingPreference?.id === pref.id) {
                  return (
                    <div key={pref.id} className="border rounded-lg p-3 bg-blue-50/30 space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-xs text-muted-foreground">星期</label>
                          <select
                            value={preferenceForm.day_of_week}
                            onChange={(e) => setPreferenceForm({ ...preferenceForm, day_of_week: e.target.value as DayOfWeek })}
                            className="w-full h-8 px-2 rounded border text-sm"
                          >
                            <option value="monday">周一</option>
                            <option value="tuesday">周二</option>
                            <option value="wednesday">周三</option>
                            <option value="thursday">周四</option>
                            <option value="friday">周五</option>
                            <option value="saturday">周六</option>
                            <option value="sunday">周日</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">开始</label>
                          <Input
                            type="time"
                            value={preferenceForm.preferred_start}
                            onChange={(e) => setPreferenceForm({ ...preferenceForm, preferred_start: e.target.value })}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">结束</label>
                          <Input
                            type="time"
                            value={preferenceForm.preferred_end}
                            onChange={(e) => setPreferenceForm({ ...preferenceForm, preferred_end: e.target.value })}
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">备注</label>
                        <Input
                          value={preferenceForm.notes}
                          onChange={(e) => setPreferenceForm({ ...preferenceForm, notes: e.target.value })}
                          placeholder="可选"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleUpdatePreference}>保存</Button>
                        <Button variant="outline" size="sm" onClick={() => {
                          setEditingPreference(null)
                          resetPreferenceForm()
                        }}>取消</Button>
                      </div>
                    </div>
                  )
                }
                
                // 正常显示偏好项
                return (
                  <div key={pref.id} className="group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 transition-colors">
                    <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded min-w-[40px] text-center">
                      {DAY_LABELS[pref.day_of_week]}
                    </span>
                    <span className="text-sm">
                      {pref.preferred_start?.slice(0,5) || '09:00'} - {pref.preferred_end?.slice(0,5) || '11:00'}
                    </span>
                    {pref.notes && (
                      <span className="text-xs text-muted-foreground truncate flex-1">({pref.notes})</span>
                    )}
                    <div className="ml-auto opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                      <button 
                        onClick={() => openEditPreference(pref)}
                        className="p-1 hover:bg-muted rounded"
                        title="编辑"
                      >
                        <Edit className="w-3 h-3" />
                      </button>
                      <button 
                        onClick={() => handleDeletePreference(pref.id)} 
                        className="p-1 hover:bg-muted rounded text-destructive"
                        title="删除"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          
          {/* 添加新偏好 - 底部折叠表单 */}
          {showPreferenceForm ? (
            <div className="border rounded-lg p-3 bg-blue-50/30 space-y-2 mt-2">
              <div className="text-xs font-medium text-muted-foreground">添加新偏好时段</div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">星期</label>
                  <select
                    value={preferenceForm.day_of_week}
                    onChange={(e) => setPreferenceForm({ ...preferenceForm, day_of_week: e.target.value as DayOfWeek })}
                    className="w-full h-8 px-2 rounded border text-sm"
                  >
                    <option value="monday">周一</option>
                    <option value="tuesday">周二</option>
                    <option value="wednesday">周三</option>
                    <option value="thursday">周四</option>
                    <option value="friday">周五</option>
                    <option value="saturday">周六</option>
                    <option value="sunday">周日</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">开始</label>
                  <Input
                    type="time"
                    value={preferenceForm.preferred_start}
                    onChange={(e) => setPreferenceForm({ ...preferenceForm, preferred_start: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">结束</label>
                  <Input
                    type="time"
                    value={preferenceForm.preferred_end}
                    onChange={(e) => setPreferenceForm({ ...preferenceForm, preferred_end: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">备注</label>
                <Input
                  value={preferenceForm.notes}
                  onChange={(e) => setPreferenceForm({ ...preferenceForm, notes: e.target.value })}
                  placeholder="可选"
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleCreatePreference}>添加</Button>
                <Button variant="outline" size="sm" onClick={() => {
                  setShowPreferenceForm(false)
                  resetPreferenceForm()
                }}>取消</Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowPreferenceForm(true)}
              className="w-full mt-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded flex items-center justify-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              添加时段偏好
            </button>
          )}
        </CardContent>
      </Card>

      {/* 语音进度 */}
      <Card>
        <CardHeader>
          <CardTitle>语音训练进度</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">自然拼读进度</span>
            <span>{currentStudent.phonics_progress || '未开始'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">自然拼读状态</span>
            <span>{currentStudent.phonics_completed ? '已完成' : '进行中'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">国际音标状态</span>
            <span>{currentStudent.ipa_completed ? '已完成' : '未开始'}</span>
          </div>
        </CardContent>
      </Card>

      {/* 阅读训练进度 */}
      <Card>
        <CardHeader>
          <CardTitle>阅读训练进度</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="text-sm text-muted-foreground">当前进度</label>
              <Input
                value={readingProgress}
                onChange={(e) => setReadingProgress(e.target.value)}
                placeholder="如：初中B级,12（级别+已完成篇数）"
                className="h-8"
              />
            </div>
            <Button 
              size="sm"
              onClick={handleUpdateReadingProgress}
              disabled={readingProgress === (currentStudent.reading_progress || '')}
            >
              保存
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            格式说明：级别 + 已完成篇数，如 "初中B级,12" 表示初中B级已完成12篇
          </div>
        </CardContent>
      </Card>
    </div>
  )
}