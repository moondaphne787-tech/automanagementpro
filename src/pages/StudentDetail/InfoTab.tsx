import { useState, useEffect } from 'react'
import { Edit, Trash2, Clock, Calendar, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { InlineField } from '@/components/ui/inline-field'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { useAppStore } from '@/store/appStore'
import { studentSchedulePreferenceDb, schedulePeriodDb } from '@/db'
import { formatDateCN, formatHours, isHoursWarning, cn } from '@/lib/utils'
import { LEVEL_LABELS, STATUS_LABELS, STUDENT_TYPE_LABELS, DAY_LABELS, GRADE_OPTIONS } from '@/types'
import type { StudentSchedulePreference, DayOfWeek } from '@/types'
import type { SchedulePeriod } from '@/db'

/** 偏好时段表单（添加/编辑共用） */
function PreferenceForm({ form, onChange, onSubmit, onCancel, submitLabel, title, periods }: {
  form: { day_of_week: DayOfWeek; preferred_start: string; preferred_end: string; semester: string; notes: string }
  onChange: (form: { day_of_week: DayOfWeek; preferred_start: string; preferred_end: string; semester: string; notes: string }) => void
  onSubmit: () => void
  onCancel: () => void
  submitLabel: string
  title?: string
  periods?: { name: string }[]
}) {
  return (
    <div className="border rounded-lg p-3 bg-blue-50/30 space-y-2">
      {title && <div className="text-xs font-medium text-muted-foreground">{title}</div>}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs text-muted-foreground">星期</label>
          <select
            value={form.day_of_week}
            onChange={(e) => onChange({ ...form, day_of_week: e.target.value as DayOfWeek })}
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
            value={form.preferred_start}
            onChange={(e) => onChange({ ...form, preferred_start: e.target.value })}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">结束</label>
          <Input
            type="time"
            value={form.preferred_end}
            onChange={(e) => onChange({ ...form, preferred_end: e.target.value })}
            className="h-8 text-sm"
          />
        </div>
      </div>
      {periods && periods.length > 0 && (
        <div>
          <label className="text-xs text-muted-foreground">所属时段</label>
          <select
            value={form.semester}
            onChange={(e) => onChange({ ...form, semester: e.target.value })}
            className="w-full h-8 px-2 rounded border text-sm"
          >
            <option value="">平时</option>
            {periods.map(p => (
              <option key={p.name} value={p.name}>{p.name}</option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="text-xs text-muted-foreground">备注</label>
        <Input
          value={form.notes}
          onChange={(e) => onChange({ ...form, notes: e.target.value })}
          placeholder="可选"
          className="h-8 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={onSubmit}>{submitLabel}</Button>
        <Button variant="outline" size="sm" onClick={onCancel}>取消</Button>
      </div>
    </div>
  )
}

interface InfoTabProps {
  studentId: string
}

export function InfoTab({ studentId }: InfoTabProps) {
  const currentStudent = useAppStore(s => s.currentStudent)
  const currentBilling = useAppStore(s => s.currentBilling)
  const updateBilling = useAppStore(s => s.updateBilling)
  const updateStudent = useAppStore(s => s.updateStudent)
  const selectStudent = useAppStore(s => s.selectStudent)

  const [billingForm, setBillingForm] = useState({
    total_hours: '',
    warning_threshold: '3'
  })
  const [schedulePreferences, setSchedulePreferences] = useState<StudentSchedulePreference[]>([])
  const [showPreferenceForm, setShowPreferenceForm] = useState(false)
  const [editingPreference, setEditingPreference] = useState<StudentSchedulePreference | null>(null)
  const [preferenceForm, setPreferenceForm] = useState({
    day_of_week: 'monday' as DayOfWeek,
    preferred_start: '09:00',
    preferred_end: '11:00',
    semester: '',
    notes: ''
  })
  const [schedulePeriods, setSchedulePeriods] = useState<SchedulePeriod[]>([])

  // 同步 billing 数据到表单
  useEffect(() => {
    if (currentBilling) {
      setBillingForm({
        total_hours: '',
        warning_threshold: currentBilling.warning_threshold.toString()
      })
    }
  }, [currentBilling])

  // 加载偏好时段 和 排课时段列表
  useEffect(() => {
    loadSchedulePreferences()
    loadSchedulePeriods()
  }, [studentId])

  const loadSchedulePeriods = async () => {
    const periods = await schedulePeriodDb.getAll()
    setSchedulePeriods(periods)
  }

  const loadSchedulePreferences = async () => {
    const prefs = await studentSchedulePreferenceDb.getByStudentId(studentId)
    setSchedulePreferences(prefs)
  }

  // 内联编辑保存：更新学员字段后刷新 store
  const handleFieldSave = async (field: string, value: string | number | boolean | null) => {
    await updateStudent(studentId, { [field]: value })
    await selectStudent(studentId)
  }

  const handleAddHours = async () => {
    const hours = parseFloat(billingForm.total_hours)
    if (isNaN(hours) || hours <= 0) return
    const confirmMessage = `确定要增加 ${hours} 课时吗？\n\n当前购买课时：${formatHours(currentBilling?.total_hours || 0)}\n增加后：${formatHours((currentBilling?.total_hours || 0) + hours)}`
    const confirmed = await confirmDialog({
      title: '增加课时',
      message: confirmMessage,
      variant: 'warning'
    })
    if (!confirmed) return
    await updateBilling(studentId, {
      total_hours: (currentBilling?.total_hours || 0) + hours
    })
    setBillingForm(prev => ({ ...prev, total_hours: '' }))
  }

  const resetPreferenceForm = () => {
    setPreferenceForm({ day_of_week: 'monday', preferred_start: '09:00', preferred_end: '11:00', semester: '', notes: '' })
  }

  const handleCreatePreference = async () => {
    await studentSchedulePreferenceDb.create({
      student_id: studentId,
      day_of_week: preferenceForm.day_of_week,
      preferred_start: preferenceForm.preferred_start || undefined,
      preferred_end: preferenceForm.preferred_end || undefined,
      semester: preferenceForm.semester || undefined,
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
      semester: preferenceForm.semester || undefined,
      notes: preferenceForm.notes || undefined
    })
    await loadSchedulePreferences()
    setEditingPreference(null)
    resetPreferenceForm()
  }

  const handleDeletePreference = async (prefId: string) => {
    const confirmed = await confirmDialog({
      title: '删除偏好时段',
      message: '确定要删除这个偏好时段吗？',
      confirmText: '删除',
      variant: 'danger'
    })
    if (!confirmed) return
    await studentSchedulePreferenceDb.delete(prefId)
    await loadSchedulePreferences()
  }

  const openEditPreference = (pref: StudentSchedulePreference) => {
    setEditingPreference(pref)
    setPreferenceForm({
      day_of_week: pref.day_of_week,
      preferred_start: pref.preferred_start || '09:00',
      preferred_end: pref.preferred_end || '11:00',
      semester: pref.semester || '',
      notes: pref.notes || ''
    })
  }

  if (!currentStudent) return null

  // select 选项
  const typeOptions = Object.entries(STUDENT_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))
  const statusOptions = Object.entries(STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))
  const gradeOptions = GRADE_OPTIONS.map(g => ({ value: g, label: g }))
  const levelOptions = Object.entries(LEVEL_LABELS).map(([v, l]) => ({ value: v, label: l }))

  return (
    <div className="space-y-4 max-w-3xl">
      {/* 基本信息 + 课时信息 — 两列并排 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 基本信息 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">基本信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <InlineField
              label="学员类型"
              value={currentStudent.student_type}
              displayValue={STUDENT_TYPE_LABELS[currentStudent.student_type]}
              type="select"
              options={typeOptions}
              onSave={(v) => handleFieldSave('student_type', v)}
            />
            <InlineField
              label="状态"
              value={currentStudent.status}
              displayValue={STATUS_LABELS[currentStudent.status]}
              type="select"
              options={statusOptions}
              onSave={(v) => handleFieldSave('status', v)}
            />
            <InlineField
              label="年级"
              value={currentStudent.grade}
              type="select"
              options={[{ value: '', label: '-' }, ...gradeOptions]}
              onSave={(v) => handleFieldSave('grade', v)}
            />
            <InlineField
              label="程度"
              value={currentStudent.level}
              displayValue={LEVEL_LABELS[currentStudent.level]}
              type="select"
              options={levelOptions}
              onSave={(v) => handleFieldSave('level', v)}
            />
            <InlineField
              label="学校"
              value={currentStudent.school}
              type="text"
              onSave={(v) => handleFieldSave('school', v)}
            />
            <InlineField
              label="学习目标"
              value={(currentStudent as any).learning_target}
              placeholder="如：中考冲刺、KET备考"
              type="text"
              onSave={(v) => handleFieldSave('learning_target', v)}
            />
            <InlineField
              label="入学日期"
              value={currentStudent.enroll_date}
              displayValue={formatDateCN(currentStudent.enroll_date)}
              type="date"
              onSave={(v) => handleFieldSave('enroll_date', v)}
            />
            <InlineField
              label="入学成绩"
              value={currentStudent.initial_score}
              type="number"
              onSave={(v) => handleFieldSave('initial_score', v)}
            />
            <InlineField
              label="入学词汇量"
              value={currentStudent.initial_vocab}
              type="number"
              onSave={(v) => handleFieldSave('initial_vocab', v)}
            />
            <InlineField
              label="备注"
              value={currentStudent.notes}
              type="text"
              onSave={(v) => handleFieldSave('notes', v)}
            />
          </CardContent>
        </Card>

        {/* 右列：课时 + 语音进度 */}
        <div className="space-y-4">
          {/* 课时信息 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" />
                课时信息
                {currentBilling && isHoursWarning(currentBilling) && (
                  <span className="text-xs text-warning font-normal">（预警中）</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {currentBilling && (
                <>
                  <div className="grid grid-cols-3 gap-2 text-center py-3 bg-muted/50 rounded-lg">
                    <div>
                      <div className="text-xl font-semibold">{formatHours(currentBilling.total_hours)}</div>
                      <div className="text-xs text-muted-foreground">购买</div>
                    </div>
                    <div>
                      <div className="text-xl font-semibold">{formatHours(currentBilling.used_hours)}</div>
                      <div className="text-xs text-muted-foreground">已用</div>
                    </div>
                    <div>
                      <div className={cn(
                        "text-xl font-semibold",
                        isHoursWarning(currentBilling) && "text-warning"
                      )}>
                        {formatHours(currentBilling.remaining_hours)}
                      </div>
                      <div className="text-xs text-muted-foreground">剩余</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.5"
                      value={billingForm.total_hours}
                      onChange={(e) => setBillingForm({ ...billingForm, total_hours: e.target.value })}
                      placeholder="增加课时数"
                      className="h-8 text-sm"
                    />
                    <Button size="sm" onClick={handleAddHours} className="shrink-0">增加</Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground shrink-0">预警阈值</label>
                    <Input
                      type="number"
                      step="0.5"
                      value={billingForm.warning_threshold}
                      onChange={(e) => setBillingForm({ ...billingForm, warning_threshold: e.target.value })}
                      className="h-8 text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => updateBilling(studentId, { warning_threshold: parseFloat(billingForm.warning_threshold) })}
                    >
                      保存
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* 语音训练进度 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">语音训练进度</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <InlineField
                label="自然拼读进度"
                value={currentStudent.phonics_progress}
                placeholder="未开始"
                type="text"
                onSave={(v) => handleFieldSave('phonics_progress', v)}
              />
              <InlineField
                label="自然拼读"
                value={currentStudent.phonics_completed}
                type="checkbox"
                onSave={(v) => handleFieldSave('phonics_completed', v)}
              />
              <InlineField
                label="国际音标"
                value={currentStudent.ipa_completed}
                type="checkbox"
                onSave={(v) => handleFieldSave('ipa_completed', v)}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 偏好时段 — 全宽 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5" />
            偏好时段
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {schedulePreferences.length === 0 && !showPreferenceForm ? (
            <div className="text-sm text-muted-foreground text-center py-3">
              暂无偏好时段设置
            </div>
          ) : (
            <div className="space-y-1">
              {schedulePreferences.map((pref) => {
                if (editingPreference?.id === pref.id) {
                  return (
                    <PreferenceForm
                      key={pref.id}
                      form={preferenceForm}
                      onChange={setPreferenceForm}
                      onSubmit={handleUpdatePreference}
                      onCancel={() => { setEditingPreference(null); resetPreferenceForm() }}
                      submitLabel="保存"
                      periods={schedulePeriods}
                    />
                  )
                }

                return (
                  <div key={pref.id} className="group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 transition-colors">
                    <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded min-w-[40px] text-center">
                      {DAY_LABELS[pref.day_of_week]}
                    </span>
                    <span className="text-sm">
                      {pref.preferred_start?.slice(0,5) || '09:00'} - {pref.preferred_end?.slice(0,5) || '11:00'}
                    </span>
                    {pref.semester ? (
                      <span className="text-xs bg-primary/5 text-primary px-1.5 py-0.5 rounded">{pref.semester}</span>
                    ) : null}
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

          {showPreferenceForm ? (
            <div className="mt-2">
              <PreferenceForm
                form={preferenceForm}
                onChange={setPreferenceForm}
                onSubmit={handleCreatePreference}
                onCancel={() => { setShowPreferenceForm(false); resetPreferenceForm() }}
                submitLabel="添加"
                title="添加新偏好时段"
                periods={schedulePeriods}
              />
            </div>
          ) : (
            <button
              onClick={() => setShowPreferenceForm(true)}
              className="w-full mt-1 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded flex items-center justify-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              添加时段偏好
            </button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
