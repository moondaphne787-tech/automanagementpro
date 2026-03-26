import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Upload, FileSpreadsheet, Check, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { DateInput } from '@/components/ui/date-input'
import { TaskBlock } from '@/components/TaskBlock/TaskBlock'
import { useAppStore } from '@/store/appStore'
import { parseExcelFile, createImportPreview, type ImportPreviewItem } from '@/utils/excelParser'
import { extractFeedbackBeforeNotes } from '@/utils/feedbackParser'
import { cn } from '@/lib/utils'
import type { TaskBlock as TaskBlockType } from '@/types'

interface ImportRecordsDrawerProps {
  open: boolean
  onClose: () => void
}

type Step = 'upload' | 'preview' | 'result'

export function ImportRecordsDrawer({ open, onClose }: ImportRecordsDrawerProps) {
  const { students, batchImportClassRecords, loadStudents } = useAppStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [columnStatus, setColumnStatus] = useState<Record<string, 'recognized' | 'ignored' | 'unrecognized'>>({})
  const [previewItems, setPreviewItems] = useState<ImportPreviewItem[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ success: number; skipped: number; errors: string[] } | null>(null)
  const [classDate, setClassDate] = useState<string>(new Date().toISOString().split('T')[0])
  
  // 处理文件选择
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    
    setFile(selectedFile)
    setParsing(true)
    setParseError(null)
    
    try {
      const parseResult = await parseExcelFile(selectedFile)
      
      if (!parseResult.success) {
        setParseError(parseResult.errors.join('\n'))
        setParsing(false)
        return
      }
      
      setColumnStatus(parseResult.columnStatus)
      
      // 创建预览
      const preview = createImportPreview(
        parseResult.data,
        students.map(s => ({ id: s.id, name: s.name, grade: s.grade }))
      )
      
      setPreviewItems(preview)
      setStep('preview')
    } catch (error) {
      setParseError(error instanceof Error ? error.message : '解析文件失败')
    }
    
    setParsing(false)
  }
  
  // 手动匹配学员
  const handleStudentMatch = (index: number, studentId: string) => {
    setPreviewItems(items => items.map((item, i) => {
      if (i === index) {
        return {
          ...item,
          student_id: studentId || undefined,
          matched: !!studentId
        }
      }
      return item
    }))
  }
  
  // 执行导入
  const handleImport = async () => {
    // 过滤出匹配成功的项
    const validItems = previewItems.filter(item => item.matched && item.student_id)
    
    if (validItems.length === 0) {
      alert('没有可导入的记录，请确保学员已正确匹配')
      return
    }
    
    setImporting(true)
    
    try {
      const records = validItems.map(item => ({
        student_id: item.student_id!,
        class_date: classDate,
        duration_hours: item.duration_hours,
        teacher_name: item.teacher_name,
        attendance: item.attendance,
        tasks: item.tasks,
        task_completed: item.task_completed,
        incomplete_reason: item.incomplete_reason,
        // 处理学情反馈，保留"学习状态"及之前的内容，删除后续的注意事项等内容
        detail_feedback: item.detail_feedback ? extractFeedbackBeforeNotes(item.detail_feedback) : undefined,
        imported_from_excel: true
      }))
      
      const successCount = await batchImportClassRecords(records)
      
      setResult({
        success: successCount,
        skipped: previewItems.length - validItems.length,
        errors: []
      })
      
      setStep('result')
      await loadStudents()
    } catch (error) {
      setResult({
        success: 0,
        skipped: 0,
        errors: [error instanceof Error ? error.message : '导入失败']
      })
      setStep('result')
    }
    
    setImporting(false)
  }
  
  // 重置状态
  const handleReset = () => {
    setStep('upload')
    setFile(null)
    setParseError(null)
    setColumnStatus({})
    setPreviewItems([])
    setResult(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }
  
  // 关闭抽屉
  const handleClose = () => {
    handleReset()
    onClose()
  }
  
  const matchedCount = previewItems.filter(item => item.matched).length
  const unmatchedCount = previewItems.length - matchedCount
  
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={handleClose}
          />
          
          {/* 抽屉面板 */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-[600px] bg-background border-l shadow-xl z-50 flex flex-col"
          >
            {/* 头部 */}
            <div className="h-16 border-b flex items-center justify-between px-6">
              <h2 className="text-lg font-semibold">批量导入课堂记录</h2>
              <Button variant="ghost" size="icon" onClick={handleClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            {/* 步骤指示器 */}
            <div className="px-6 py-4 border-b">
              <div className="flex items-center gap-2">
                {['上传文件', '预览确认', '导入结果'].map((label, i) => (
                  <div key={i} className="flex items-center">
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                      (step === 'upload' && i === 0) ||
                      (step === 'preview' && i <= 1) ||
                      (step === 'result' && i <= 2)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {i + 1}
                    </div>
                    <span className={cn(
                      "ml-2 text-sm",
                      (step === 'upload' && i === 0) ||
                      (step === 'preview' && i === 1) ||
                      (step === 'result' && i === 2)
                        ? "text-foreground"
                        : "text-muted-foreground"
                    )}>
                      {label}
                    </span>
                    {i < 2 && (
                      <div className={cn(
                        "w-12 h-0.5 mx-3",
                        (step === 'preview' && i === 0) ||
                        (step === 'result')
                          ? "bg-primary"
                          : "bg-muted"
                      )} />
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            {/* 内容区域 */}
            <div className="flex-1 overflow-auto p-6">
              {/* 上传步骤 */}
              {step === 'upload' && (
                <div className="space-y-6">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors",
                      "hover:border-primary hover:bg-primary/5",
                      parsing && "pointer-events-none opacity-50"
                    )}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    
                    {parsing ? (
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-12 h-12 text-primary animate-spin" />
                        <p className="text-muted-foreground">正在解析文件...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <Upload className="w-12 h-12 text-muted-foreground" />
                        <p className="font-medium">点击上传 Excel 文件</p>
                        <p className="text-sm text-muted-foreground">支持 .xlsx / .xls 格式</p>
                      </div>
                    )}
                  </div>
                  
                  {parseError && (
                    <Card className="border-destructive">
                      <CardContent className="p-4 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
                        <div>
                          <p className="font-medium text-destructive">解析失败</p>
                          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{parseError}</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  
                  {file && Object.keys(columnStatus).length > 0 && (
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <FileSpreadsheet className="w-5 h-5 text-primary" />
                          <span className="font-medium">{file.name}</span>
                        </div>
                        
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">列识别状态：</p>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(columnStatus).map(([col, status]) => (
                              <div
                                key={col}
                                className={cn(
                                  "px-2 py-1 rounded text-xs flex items-center gap-1",
                                  status === 'recognized' && "bg-green-500/10 text-green-600",
                                  status === 'ignored' && "bg-gray-500/10 text-gray-500",
                                  status === 'unrecognized' && "bg-yellow-500/10 text-yellow-600"
                                )}
                              >
                                {status === 'recognized' && <Check className="w-3 h-3" />}
                                {status === 'unrecognized' && <AlertCircle className="w-3 h-3" />}
                                {col}
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
              
              {/* 预览步骤 */}
              {step === 'preview' && (
                <div className="space-y-6">
                  {/* 日期选择 */}
                  <div className="bg-blue-500/10 border border-blue-200 rounded-lg p-4">
                    <label className="text-sm font-medium mb-2 block text-blue-700">
                      📅 选择课堂记录日期
                    </label>
                    <p className="text-xs text-muted-foreground mb-3">
                      请选择实际上课日期，所有导入的记录都将使用此日期
                    </p>
                    <DateInput
                      value={classDate}
                      onChange={(val) => setClassDate(val)}
                    />
                  </div>
                  
                  {/* 统计信息 */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-muted rounded-lg p-3 text-center">
                      <div className="text-2xl font-semibold">{previewItems.length}</div>
                      <div className="text-xs text-muted-foreground">总记录数</div>
                    </div>
                    <div className="bg-green-500/10 rounded-lg p-3 text-center">
                      <div className="text-2xl font-semibold text-green-600">{matchedCount}</div>
                      <div className="text-xs text-muted-foreground">已匹配</div>
                    </div>
                    <div className="bg-red-500/10 rounded-lg p-3 text-center">
                      <div className="text-2xl font-semibold text-red-600">{unmatchedCount}</div>
                      <div className="text-xs text-muted-foreground">未匹配</div>
                    </div>
                  </div>
                  
                  {/* 预览列表 */}
                  <div className="space-y-4">
                    {previewItems.map((item, index) => (
                      <Card key={index} className={cn(
                        !item.matched && "border-red-300"
                      )}>
                        <CardContent className="p-4 space-y-3">
                          {/* 学员匹配 */}
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-2 h-2 rounded-full",
                              item.matched ? "bg-green-500" : "bg-red-500"
                            )} />
                            <span className="font-medium">{item.student_name}</span>
                            <Select
                              value={item.student_id || ''}
                              options={[
                                { value: '', label: '选择学员...' },
                                ...students.map(s => ({ value: s.id, label: s.name }))
                              ]}
                              onChange={(e) => handleStudentMatch(index, e.target.value)}
                              className="flex-1"
                            />
                          </div>
                          
                          {/* 任务列表 */}
                          <div className="flex flex-wrap gap-2">
                            {item.tasks.length > 0 ? (
                              item.tasks.map((task, taskIndex) => (
                                <TaskBlock
                                  key={taskIndex}
                                  task={task}
                                  index={taskIndex}
                                />
                              ))
                            ) : (
                              <span className="text-sm text-muted-foreground">无任务数据</span>
                            )}
                          </div>
                          
                          {/* 词库信息 */}
                          {item.wordbank && (
                            <div className="flex items-center gap-2 text-sm">
                              <span className="px-2 py-0.5 bg-blue-500/10 text-blue-600 rounded">
                                {item.wordbank}
                              </span>
                              {item.level && (
                                <span className="text-muted-foreground">第{item.level}关</span>
                              )}
                            </div>
                          )}
                          
                          {/* 其他信息 */}
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>时长: {item.duration_hours}h</span>
                            {item.teacher_name && <span>助教: {item.teacher_name}</span>}
                            {item.issues && (
                              <span className="text-yellow-600 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {item.issues}
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
              
              {/* 结果步骤 */}
              {step === 'result' && (
                <div className="space-y-6">
                  <Card>
                    <CardContent className="p-6">
                      <div className="text-center space-y-4">
                        {result && result.success > 0 ? (
                          <>
                            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                              <Check className="w-8 h-8 text-green-600" />
                            </div>
                            <div>
                              <h3 className="text-xl font-semibold">导入完成</h3>
                              <p className="text-muted-foreground mt-1">
                                成功导入 <span className="text-green-600 font-medium">{result.success}</span> 条记录
                              </p>
                              {result.skipped > 0 && (
                                <p className="text-sm text-yellow-600 mt-1">
                                  跳过 {result.skipped} 条未匹配记录
                                </p>
                              )}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
                              <AlertCircle className="w-8 h-8 text-red-600" />
                            </div>
                            <div>
                              <h3 className="text-xl font-semibold">导入失败</h3>
                              <p className="text-muted-foreground mt-1">
                                {result?.errors.join(', ') || '没有可导入的记录'}
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={handleReset} className="flex-1">
                      继续导入
                    </Button>
                    <Button onClick={handleClose} className="flex-1">
                      完成
                    </Button>
                  </div>
                </div>
              )}
            </div>
            
            {/* 底部操作栏 */}
            {step === 'preview' && (
              <div className="h-16 border-t flex items-center justify-between px-6">
                <Button variant="outline" onClick={handleReset}>
                  重新上传
                </Button>
                <Button 
                  onClick={handleImport}
                  disabled={matchedCount === 0 || importing}
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      导入中...
                    </>
                  ) : (
                    `确认导入 (${matchedCount}条)`
                  )}
                </Button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}