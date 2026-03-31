import { useState, useEffect, useMemo } from 'react'
import { Edit, Trash2, Plus, Calendar, FileText, Link, Columns } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DatePicker } from '@/components/ui/date-picker'
import { TaskBlock } from '@/components/TaskBlock/TaskBlock'
import { ClassRecordForm } from '@/components/ClassRecord/ClassRecordForm'
import { useAppStore } from '@/store/appStore'
import { classRecordDb } from '@/db'
import { extractFeedbackBeforeNotes } from '@/utils/feedbackParser'
import { cn } from '@/lib/utils'
import type { ClassRecord, LessonPlan } from '@/types'

interface RecordsTabProps {
  studentId: string
}

/** 获取本月的日期范围 */
function getThisMonthRange() {
  const now = new Date()
  return {
    startDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
    endDate: new Date().toISOString().split('T')[0]
  }
}

/** 获取近三个月的日期范围 */
function getLast3MonthsRange() {
  const end = new Date()
  const start = new Date()
  start.setMonth(start.getMonth() - 3)
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0]
  }
}

export function RecordsTab({ studentId }: RecordsTabProps) {
  const { wordbanks, createClassRecord, updateClassRecord, deleteClassRecord } = useAppStore()

  const [showRecordForm, setShowRecordForm] = useState(false)
  const [editingRecord, setEditingRecord] = useState<ClassRecord | null>(null)
  const [recordsWithPlan, setRecordsWithPlan] = useState<(ClassRecord & { plan?: LessonPlan })[]>([])
  const [recordFilter, setRecordFilter] = useState<{ startDate: string; endDate: string }>({
    startDate: '',
    endDate: ''
  })
  const [expandedFeedbackId, setExpandedFeedbackId] = useState<string | null>(null)

  useEffect(() => {
    loadRecordsWithPlan()
  }, [studentId])

  const loadRecordsWithPlan = async () => {
    const records = await classRecordDb.getWithPlan(studentId)
    setRecordsWithPlan(records)
    if (records.length > 50) {
      setRecordFilter(getLast3MonthsRange())
    }
  }

  const filteredRecords = useMemo(() => {
    return recordsWithPlan.filter(r => {
      if (recordFilter.startDate && r.class_date < recordFilter.startDate) return false
      if (recordFilter.endDate && r.class_date > recordFilter.endDate) return false
      return true
    })
  }, [recordsWithPlan, recordFilter])

  const handleCreateRecord = async (data: any) => {
    await createClassRecord(data)
    setShowRecordForm(false)
    await loadRecordsWithPlan()
  }

  const handleUpdateRecord = async (data: any) => {
    if (!editingRecord) return
    await updateClassRecord(editingRecord.id, data)
    setEditingRecord(null)
    await loadRecordsWithPlan()
  }

  return (
    <div className="space-y-6">
      {showRecordForm ? (
        <ClassRecordForm
          studentId={studentId}
          wordbanks={wordbanks}
          onSave={handleCreateRecord}
          onCancel={() => setShowRecordForm(false)}
        />
      ) : editingRecord ? (
        <ClassRecordForm
          studentId={studentId}
          wordbanks={wordbanks}
          onSave={handleUpdateRecord}
          onCancel={() => setEditingRecord(null)}
          initialData={editingRecord}
        />
      ) : (
        <>
          {/* 新建按钮 */}
          <div className="flex justify-end">
            <Button onClick={() => setShowRecordForm(true)}>
              <Plus className="w-4 h-4 mr-1" />
              新建课堂记录
            </Button>
          </div>
          
          {/* 日期筛选栏 */}
          <div className="space-y-2">
            {recordsWithPlan.length > 50 && (
              <p className="text-xs text-muted-foreground">
                默认显示近 3 个月，点击【全部】查看所有记录
              </p>
            )}
            <div className="flex items-center gap-3 flex-wrap p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">起始日期</label>
                <DatePicker
                  value={recordFilter.startDate}
                  onChange={(val) => setRecordFilter(prev => ({ ...prev, startDate: val }))}
                  placeholder="选择起始日期"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">结束日期</label>
                <DatePicker
                  value={recordFilter.endDate}
                  onChange={(val) => setRecordFilter(prev => ({ ...prev, endDate: val }))}
                  placeholder="选择结束日期"
                />
              </div>
              <div className="flex gap-2 ml-auto">
                <Button
                  variant="outline" size="sm"
                  onClick={() => setRecordFilter(getThisMonthRange())}
                >
                  本月
                </Button>
                <Button
                  variant="outline" size="sm"
                  onClick={() => setRecordFilter(getLast3MonthsRange())}
                >
                  近三个月
                </Button>
                <Button
                  variant="ghost" size="sm"
                  onClick={() => setRecordFilter({ startDate: '', endDate: '' })}
                >
                  全部
                </Button>
              </div>
              {(recordFilter.startDate || recordFilter.endDate) && (
                <span className="text-xs text-muted-foreground">
                  共 {filteredRecords.length} 条记录
                </span>
              )}
            </div>
          </div>
          
          {/* 课堂记录列表 */}
          {recordsWithPlan.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>暂无课堂记录</p>
              <p className="text-sm mt-1">点击上方按钮创建第一条记录</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>当前日期范围内无记录</p>
              <p className="text-sm mt-1">点击【全部】查看所有记录</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRecords.map((record) => (
                <Card key={record.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-3 flex-1">
                        {/* 日期和基本信息 */}
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{record.class_date}</span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {record.duration_hours}h
                          </span>
                          {record.teacher_name && (
                            <span className="text-sm text-muted-foreground">
                              助教: {record.teacher_name}
                            </span>
                          )}
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded",
                            record.attendance === 'present' && "bg-green-500/10 text-green-600",
                            record.attendance === 'late' && "bg-yellow-500/10 text-yellow-600",
                            record.attendance === 'absent' && "bg-red-500/10 text-red-600"
                          )}>
                            {record.attendance === 'present' ? '到课' : record.attendance === 'late' ? '迟到' : '缺课'}
                          </span>
                          {record.plan_id && (
                            <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 flex items-center gap-1">
                              <Link className="w-3 h-3" />
                              关联计划
                            </span>
                          )}
                        </div>
                        
                        {/* 双栏对比展示：原定计划 vs 实际完成 */}
                        {record.plan ? (
                          <div className="border rounded-lg overflow-hidden">
                            <div className="grid grid-cols-2 divide-x">
                              {/* 左栏：原定计划 */}
                              <div className="bg-blue-50/50 p-3">
                                <div className="flex items-center gap-2 mb-2 text-blue-700">
                                  <Columns className="w-4 h-4" />
                                  <span className="text-xs font-medium">原定计划</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {record.plan.tasks.map((task, idx) => (
                                    <span key={idx} className="text-xs bg-white border border-blue-200 px-2 py-1 rounded">
                                      {task.wordbank_label || task.content || task.type}
                                      {task.level_from && task.level_to && ` 第${task.level_from}-${task.level_to}关`}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              
                              {/* 右栏：实际完成 */}
                              <div className="bg-green-50/50 p-3">
                                <div className="flex items-center gap-2 mb-2 text-green-700">
                                  <FileText className="w-4 h-4" />
                                  <span className="text-xs font-medium">实际完成</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {record.tasks.map((task, idx) => (
                                    <span key={idx} className="text-xs bg-white border border-green-200 px-2 py-1 rounded">
                                      {task.wordbank_label || task.content || task.type}
                                      {task.level_reached && ` → 第${task.level_reached}关`}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                            
                            {/* 完成状态对比 */}
                            <div className="border-t p-2 bg-muted/30 flex items-center gap-4">
                              <span className={cn(
                                "text-sm font-medium",
                                record.task_completed === 'completed' && "text-green-600",
                                record.task_completed === 'partial' && "text-yellow-600",
                                record.task_completed === 'not_completed' && "text-red-600"
                              )}>
                                {record.task_completed === 'completed' ? '✓ 全部完成' : 
                                 record.task_completed === 'partial' ? '◐ 部分完成' : '✗ 未完成'}
                              </span>
                              <span className={cn(
                                "text-sm",
                                record.performance === 'excellent' && "text-green-600",
                                record.performance === 'good' && "text-blue-600",
                                record.performance === 'needs_improvement' && "text-orange-600"
                              )}>
                                表现: {record.performance === 'excellent' ? '优秀' : 
                                 record.performance === 'good' ? '良好' : '待提高'}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* 无关联计划时正常显示任务块 */}
                            <div className="flex flex-wrap gap-2">
                              {record.tasks.map((task, index) => (
                                <TaskBlock
                                  key={index}
                                  task={task}
                                  index={index}
                                />
                              ))}
                            </div>
                            
                            {/* 完成状态和表现 */}
                            <div className="flex items-center gap-4 text-sm">
                              <span className={cn(
                                record.task_completed === 'completed' && "text-green-600",
                                record.task_completed === 'partial' && "text-yellow-600",
                                record.task_completed === 'not_completed' && "text-red-600"
                              )}>
                                {record.task_completed === 'completed' ? '✓ 全部完成' : 
                                 record.task_completed === 'partial' ? '◐ 部分完成' : '✗ 未完成'}
                              </span>
                              <span className={cn(
                                record.performance === 'excellent' && "text-green-600",
                                record.performance === 'good' && "text-blue-600",
                                record.performance === 'needs_improvement' && "text-orange-600"
                              )}>
                                {record.performance === 'excellent' ? '表现优秀' : 
                                 record.performance === 'good' ? '表现良好' : '待提高'}
                              </span>
                            </div>
                          </>
                        )}
                        
                        {/* 备注 */}
                        {record.issues && (
                          <p className="text-sm text-muted-foreground">
                            问题: {record.issues}
                          </p>
                        )}
                        
                        {/* 学情反馈原文 */}
                        {record.detail_feedback && (
                          <div>
                            <button
                              onClick={() => setExpandedFeedbackId(
                                expandedFeedbackId === record.id ? null : record.id
                              )}
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <FileText className="w-3 h-3" />
                              {expandedFeedbackId === record.id ? '收起反馈原文' : '查看完整反馈原文'}
                            </button>
                            
                            {expandedFeedbackId === record.id && (
                              <div className="mt-2 p-3 bg-muted/50 rounded-lg border border-muted">
                                <p className="text-xs text-muted-foreground mb-1 font-medium">学情反馈原文</p>
                                <pre className="text-sm whitespace-pre-wrap font-sans text-foreground leading-relaxed">
                                  {extractFeedbackBeforeNotes(record.detail_feedback)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* 操作按钮 */}
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-foreground"
                          title="编辑"
                          onClick={() => setEditingRecord(record)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          title="删除"
                          onClick={async () => {
                            if (confirm('确定删除此课堂记录？')) {
                              await deleteClassRecord(record.id)
                              await loadRecordsWithPlan()
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}