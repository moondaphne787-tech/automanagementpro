import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Search, CheckCircle, Clock, TrendingUp, Calendar, User, Phone, GraduationCap, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { DateInput } from '@/components/ui/date-input'
import { trialConversionDb } from '@/db'
import { LEVEL_LABELS } from '@/types'
import type { Student, TrialConversion, Billing } from '@/types'

type TrialStudent = Student & { 
  conversion: TrialConversion | null
  billing: Billing | null
}

export function TrialList() {
  const navigate = useNavigate()
  const [students, setStudents] = useState<TrialStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  
  // 成交对话框状态
  const [convertDialogOpen, setConvertDialogOpen] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<TrialStudent | null>(null)
  const [conversionDate, setConversionDate] = useState(new Date().toISOString().split('T')[0])
  const [commissionNote, setCommissionNote] = useState('')
  const [converting, setConverting] = useState(false)

  useEffect(() => {
    loadTrialStudents()
  }, [])

  const loadTrialStudents = async () => {
    setLoading(true)
    try {
      const data = await trialConversionDb.getAllTrialStudents()
      setStudents(data)
    } catch (error) {
      console.error('Failed to load trial students:', error)
    } finally {
      setLoading(false)
    }
  }

  // 筛选
  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase())
  )

  // 统计
  const stats = {
    total: students.length,
    converted: students.filter(s => s.conversion?.converted).length,
    pending: students.filter(s => !s.conversion?.converted).length,
  }

  const handleOpenConvertDialog = (student: TrialStudent) => {
    setSelectedStudent(student)
    setConversionDate(new Date().toISOString().split('T')[0])
    setCommissionNote('')
    setConvertDialogOpen(true)
  }

  const handleConvert = async () => {
    if (!selectedStudent) return
    
    setConverting(true)
    try {
      await trialConversionDb.markConverted(
        selectedStudent.id, 
        conversionDate, 
        commissionNote || undefined
      )
      setConvertDialogOpen(false)
      await loadTrialStudents()
    } catch (error) {
      console.error('Failed to mark conversion:', error)
      alert('标记成交失败，请重试')
    } finally {
      setConverting(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* 顶部栏 */}
      <header className="h-16 border-b bg-card flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">体验生</h1>
          
          {/* 统计卡片 */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-muted rounded-lg text-sm">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{stats.total}</span>
              <span className="text-muted-foreground">人</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-green-500/10 text-green-600 rounded-lg text-sm">
              <CheckCircle className="w-4 h-4" />
              <span className="font-medium">{stats.converted}</span>
              <span className="text-green-600/70">已成交</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-600 rounded-lg text-sm">
              <Clock className="w-4 h-4" />
              <span className="font-medium">{stats.pending}</span>
              <span className="text-amber-600/70">待跟进</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate('/trial/conversions')}>
            <TrendingUp className="w-4 h-4 mr-1" />
            成交统计
          </Button>
          <Button onClick={() => navigate('/students/new?trial=true')}>
            <Plus className="w-4 h-4 mr-1" />
            新增体验生
          </Button>
        </div>
      </header>

      {/* 搜索栏 */}
      <div className="border-b bg-card/50 px-6 py-3">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索体验生姓名..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            加载中...
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            {search ? '没有找到匹配的体验生' : '暂无体验生'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStudents.map((student, index) => (
              <motion.div
                key={student.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/students/${student.id}`)}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{student.name}</CardTitle>
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                          {student.grade && (
                            <span className="flex items-center gap-1">
                              <GraduationCap className="w-3 h-3" />
                              {student.grade}
                            </span>
                          )}
                          {student.school && (
                            <span className="flex items-center gap-1">
                              <BookOpen className="w-3 h-3" />
                              {student.school}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* 状态标签 */}
                      {student.conversion?.converted ? (
                        <span className="px-2 py-0.5 bg-green-500/10 text-green-600 text-xs rounded-full">
                          已成交
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 text-xs rounded-full">
                          待跟进
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2 text-sm">
                      {/* 程度 */}
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">程度</span>
                        <span>{LEVEL_LABELS[student.level]}</span>
                      </div>
                      
                      {/* 体验日期 */}
                      {student.conversion?.trial_date && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">体验日期</span>
                          <span>{student.conversion.trial_date}</span>
                        </div>
                      )}
                      
                      {/* 成交日期 */}
                      {student.conversion?.converted && student.conversion.conversion_date && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">成交日期</span>
                          <span className="text-green-600">{student.conversion.conversion_date}</span>
                        </div>
                      )}
                      
                      {/* 操作按钮 */}
                      {!student.conversion?.converted && (
                        <div className="pt-2">
                          <Button 
                            size="sm" 
                            className="w-full"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenConvertDialog(student)
                            }}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            标记成交
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* 成交对话框 */}
      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>标记成交</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">学员姓名</label>
              <div className="text-lg font-medium">{selectedStudent?.name}</div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">成交日期</label>
              <DateInput
                value={conversionDate}
                onChange={setConversionDate}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">提成备注（可选）</label>
              <Input
                value={commissionNote}
                onChange={(e) => setCommissionNote(e.target.value)}
                placeholder="输入提成相关信息..."
              />
            </div>
            
            <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
              标记成交后，该学员将自动转为正式学员。
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleConvert} disabled={converting}>
              {converting ? '处理中...' : '确认成交'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}