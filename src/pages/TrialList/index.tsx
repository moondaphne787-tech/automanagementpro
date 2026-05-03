import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, CheckCircle, Clock, TrendingUp, Users as UsersIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { DateInput } from '@/components/ui/date-input'
import { trialConversionDb } from '@/db'
import { TabNav } from '@/components/ui/tab-nav'
import { TrialStudentList } from './TrialStudentList'
import { ConversionStats } from './ConversionStats'
import type { TrialStudent } from './TrialStudentList'

export function TrialList() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'list' | 'stats'>('list')
  const [students, setStudents] = useState<TrialStudent[]>([])
  const [loading, setLoading] = useState(true)

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
      await trialConversionDb.markConverted(selectedStudent.id, conversionDate, commissionNote || undefined)
      setConvertDialogOpen(false)
      await loadTrialStudents()
    } catch (error) {
      console.error('Failed to mark conversion:', error)
      toast.error('标记成交失败，请重试')
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
          {activeTab === 'list' && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1 bg-muted rounded-lg text-sm">
                <UsersIcon className="w-4 h-4 text-muted-foreground" />
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
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => navigate('/students/new?trial=true')}>
            <Plus className="w-4 h-4 mr-1" />
            新增体验生
          </Button>
        </div>
      </header>

      <div className="border-b bg-card px-6">
        <TabNav
          tabs={[
            { key: 'list', label: '体验生列表', icon: <UsersIcon className="w-4 h-4" /> },
            { key: 'stats', label: '成交统计', icon: <TrendingUp className="w-4 h-4" /> },
          ]}
          activeTab={activeTab}
          onChange={(key) => setActiveTab(key as 'list' | 'stats')}
        />
      </div>

      {activeTab === 'list' ? (
        <TrialStudentList
          students={students}
          loading={loading}
          onOpenConvertDialog={handleOpenConvertDialog}
        />
      ) : (
        <ConversionStats />
      )}

      {/* 成交对话框 */}
      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>标记成交</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">学员姓名</label>
              <div className="text-lg font-medium">{selectedStudent?.name}</div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">成交日期</label>
              <DateInput value={conversionDate} onChange={setConversionDate} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">提成备注（可选）</label>
              <Input value={commissionNote} onChange={(e) => setCommissionNote(e.target.value)} placeholder="输入提成相关信息..." />
            </div>
            <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">标记成交后，该学员将自动转为正式学员。</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertDialogOpen(false)}>取消</Button>
            <Button onClick={handleConvert} disabled={converting}>{converting ? '处理中...' : '确认成交'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
