import { useState, useEffect } from 'react'
import { Edit, Trash2, Clock, Calendar, Plus, Route } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { InlineField } from '@/components/ui/inline-field'
import { DEFAULT_ROUTES } from '@/ai/learningRoutes'
import type { LearningRoute } from '@/ai/learningRoutes'
import { PromptDialog } from '@/components/ui/dialog'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { useAppStore } from '@/store/appStore'
import { studentSchedulePreferenceDb, schedulePeriodDb } from '@/db'
import { PreferenceForm } from '@/components/Schedule/PreferenceForm'
import type { PreferenceFormData } from '@/components/Schedule/PreferenceForm'
import { formatDateCN, formatHours, isHoursWarning, cn } from '@/lib/utils'
import { LEVEL_LABELS, STATUS_LABELS, STUDENT_TYPE_LABELS, DAY_LABELS, GRADE_OPTIONS } from '@/types'
import type { StudentSchedulePreference } from '@/types'
import type { SchedulePeriod } from '@/db'

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
  const currentProgress = useAppStore(s => s.currentProgress)
  const wordbanks = useAppStore(s => s.wordbanks)
  const loadProgress = useAppStore(s => s.loadProgress)
  const upsertProgress = useAppStore(s => s.upsertProgress)
  const deleteProgress = useAppStore(s => s.deleteProgress)

  const [promptState, setPromptState] = useState<{ open: boolean; title: string; defaultValue: string; onConfirm: ((v: string) => void) | null }>({ open: false, title: '', defaultValue: '', onConfirm: null })

  const [schedulePreferences, setSchedulePreferences] = useState<StudentSchedulePreference[]>([])
  const [showPreferenceForm, setShowPreferenceForm] = useState(false)
  const [editingPreference, setEditingPreference] = useState<StudentSchedulePreference | null>(null)
  const [preferenceForm, setPreferenceForm] = useState<PreferenceFormData>({
    day_of_week: 'monday',
    preferred_start: '09:00',
    preferred_end: '11:00',
    semester: '',
    notes: ''
  })
  const [schedulePeriods, setSchedulePeriods] = useState<SchedulePeriod[]>([])

  // 学习路线绑定
  const currentBinding = (() => {
    if (!currentStudent?.learning_target) return null
    try {
      const b = JSON.parse(currentStudent.learning_target)
      return b && typeof b === 'object' && b.routeId ? b as { routeId: string; stageOrder: number; customNote?: string } : null
    } catch { return null }
  })()
  const [selectedRouteId, setSelectedRouteId] = useState(currentBinding?.routeId || '')
  const [selectedStageOrder, setSelectedStageOrder] = useState(currentBinding?.stageOrder || 1)
  const [customNote, setCustomNote] = useState(currentBinding?.customNote || '')
  const [bindingRoutes, setBindingRoutes] = useState<LearningRoute[]>(DEFAULT_ROUTES)

  // 同步 billing 数据到表单
  useEffect(() => {
    if (currentBilling) {
      setBillingForm({
        total_hours: '',
        warning_threshold: currentBilling.warning_threshold.toString()
      })
    }
  }, [currentBilling])

  // 同步 currentBinding 到表单状态
  useEffect(() => {
    if (currentBinding) {
      setSelectedRouteId(currentBinding.routeId)
      setSelectedStageOrder(currentBinding.stageOrder)
      setCustomNote(currentBinding.customNote || '')
    }
  }, [currentStudent?.id])

  // 加载已保存的学习路线 + 偏好时段、排课时段列表、词库进度
  useEffect(() => {
    loadSchedulePreferences()
    loadSchedulePeriods()
    ;(async () => {
      const { settingsDb } = await import('@/db')
      const saved = await settingsDb.get('learning_routes')
      if (saved) {
        try {
          const overrides = JSON.parse(saved) as LearningRoute[]
          setBindingRoutes(DEFAULT_ROUTES.map(dr => {
            const o = overrides.find((r: LearningRoute) => r.id === dr.id)
            if (!o) return dr
            return { ...dr, stages: dr.stages.map(s => { const os = o.stages.find((st: any) => st.order === s.order); return os ? { ...s, guideline: os.guideline } : s }) }
          }))
        } catch {}
      }
    })()
    loadProgress(studentId)
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
            <div className="pt-2 border-t mt-2 space-y-2">
              <label className="text-xs font-medium flex items-center gap-1"><Route className="w-3 h-3" />学习路线</label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={selectedRouteId}
                  onChange={e => { setSelectedRouteId(e.target.value); const route = bindingRoutes.find(r => r.id === e.target.value); setSelectedStageOrder(route?.stages[0]?.order || 1) }}
                  className="h-8 text-xs rounded-md border border-input bg-transparent px-2"
                >
                  <option value="">未绑定</option>
                  {bindingRoutes.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                {selectedRouteId && (
                  <select
                    value={selectedStageOrder}
                    onChange={e => setSelectedStageOrder(parseInt(e.target.value))}
                    className="h-8 text-xs rounded-md border border-input bg-transparent px-2"
                  >
                    {bindingRoutes.find(r => r.id === selectedRouteId)?.stages.map(s => (
                      <option key={s.order} value={s.order}>阶段{s.order} {s.name}</option>
                    ))}
                  </select>
                )}
              </div>
              {selectedRouteId && (
                <div className="flex gap-2">
                  <Input
                    value={customNote}
                    onChange={e => setCustomNote(e.target.value)}
                    placeholder="个性化补充说明（可选）"
                    className="h-8 text-xs flex-1"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 shrink-0"
                    onClick={async () => {
                      const json = JSON.stringify({ routeId: selectedRouteId, stageOrder: selectedStageOrder, customNote: customNote || undefined })
                      await handleFieldSave('learning_target', json)
                    }}
                  >
                    保存路线
                  </Button>
                </div>
              )}
              {!selectedRouteId && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={async () => { await handleFieldSave('learning_target', ''); setSelectedRouteId(''); setSelectedStageOrder(1); setCustomNote('') }}
                >
                  清除目标（恢复纯文本模式）
                </Button>
              )}
            </div>
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

      {/* 词库进度 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">📚 词库进度</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {currentProgress.length === 0 ? (
            <p className="text-sm text-muted-foreground/60 italic py-1">暂无词库进度</p>
          ) : (
            <div className="space-y-3">
              {currentProgress.map((progress) => {
                const wordbank = wordbanks.find(w => w.id === progress.wordbank_id)
                const totalLevels = progress.total_levels_override || wordbank?.total_levels || 60
                const pct = Math.round((progress.current_level / totalLevels) * 100)
                return (
                  <div key={progress.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{progress.wordbank_label}</span>
                        <span className={cn(
                          'text-xs px-1.5 py-0.5 rounded',
                          progress.status === 'completed' && 'bg-green-100 text-green-700',
                          progress.status === 'active' && 'bg-blue-100 text-blue-700',
                          progress.status === 'paused' && 'bg-muted text-muted-foreground',
                        )}>
                          {progress.status === 'completed' ? '已完成' : progress.status === 'active' ? '进行中' : '已暂停'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">第 {progress.current_level}/{totalLevels} 关</span>
                        <button
                          className="text-xs text-primary hover:underline"
                          onClick={() => setPromptState({
                            open: true,
                            title: `更新「${progress.wordbank_label}」关数（最大 ${totalLevels}）`,
                            defaultValue: progress.current_level.toString(),
                            onConfirm: (v) => {
                              const level = Math.min(parseInt(v) || 0, totalLevels)
                              if (!isNaN(level)) upsertProgress({ student_id: studentId, wordbank_id: progress.wordbank_id, current_level: level, status: level >= totalLevels ? 'completed' : 'active' })
                            }
                          })}
                        >
                          更新
                        </button>
                        <button
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          onClick={async () => {
                            const confirmed = await confirmDialog({ title: '删除词库进度', message: `确定删除「${progress.wordbank_label}」的进度记录吗？`, confirmText: '删除', variant: 'danger' })
                            if (confirmed) deleteProgress(studentId, progress.wordbank_id)
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground">已学至第 {progress.current_level} 关</p>
                  </div>
                )
              })}
            </div>
          )}

          {/* 添加词库 */}
          {wordbanks.length > currentProgress.length && (
            <div className="pt-2 border-t">
              <Select
                placeholder="+ 添加词库"
                options={wordbanks.filter(w => !currentProgress.some(p => p.wordbank_id === w.id)).map(w => ({ value: w.id, label: w.name }))}
                onChange={(e) => {
                  if (e.target.value) upsertProgress({ student_id: studentId, wordbank_id: e.target.value, current_level: 0, status: 'active' })
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>

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
      <PromptDialog
        open={promptState.open}
        title={promptState.title}
        defaultValue={promptState.defaultValue}
        onConfirm={(v) => { promptState.onConfirm?.(v); setPromptState({ open: false, title: '', defaultValue: '', onConfirm: null }) }}
        onCancel={() => setPromptState({ open: false, title: '', defaultValue: '', onConfirm: null })}
      />
    </div>
  )
}
