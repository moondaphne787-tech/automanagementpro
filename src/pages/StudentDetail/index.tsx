import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { GrowthPanel } from '@/components/Growth/GrowthPanel'
import { useAppStore } from '@/store/appStore'
import { getLevelColor, cn } from '@/lib/utils'
import { InfoTab } from './InfoTab'
import { RecordsTab } from './RecordsTab'
import { PlansTab } from './PlansTab'

type TabType = 'info' | 'records' | 'plans' | 'growth'

export function StudentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const currentStudent = useAppStore(s => s.currentStudent)
  const deleteStudent = useAppStore(s => s.deleteStudent)
  const selectStudent = useAppStore(s => s.selectStudent)
  const loadWordbanks = useAppStore(s => s.loadWordbanks)
  const addRecentStudent = useAppStore(s => s.addRecentStudent)

  const [tab, setTab] = useState<TabType>('info')

  useEffect(() => {
    if (id) {
      selectStudent(id)
      loadWordbanks()
    }
  }, [id])

  useEffect(() => {
    if (currentStudent && id) {
      addRecentStudent(id, currentStudent.name)
    }
  }, [currentStudent?.id])

  if (!currentStudent) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        加载中...
      </div>
    )
  }

  const handleDelete = async () => {
    const confirmed = await confirmDialog({
      title: '删除学员',
      message: '确定要删除此学员吗？此操作不可恢复。',
      confirmText: '删除',
      variant: 'danger'
    })
    if (confirmed) {
      await deleteStudent(id!)
      navigate('/')
    }
  }

  const tabs: { key: TabType; label: string }[] = [
    { key: 'info', label: '基本信息' },
    { key: 'records', label: '课堂记录' },
    { key: 'plans', label: '课程计划' },
    { key: 'growth', label: '成长档案' },
  ]

  return (
    <div className="h-full flex flex-col">
      {/* 顶部栏 */}
      <header className="h-16 border-b bg-card flex items-center px-6 gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-3">
          <div className={cn('w-3 h-3 rounded-full', getLevelColor(currentStudent.level))} />
          <h1 className="text-lg font-semibold">{currentStudent.name}</h1>
          <span className="text-sm text-muted-foreground">{currentStudent.student_no}</span>
          {currentStudent.student_type === 'trial' && (
            <span className="trial-badge">体验</span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="w-4 h-4 mr-1" />
            删除
          </Button>
        </div>
      </header>

      {/* Tab 导航 */}
      <div className="border-b bg-card">
        <div className="flex px-6">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === t.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-auto p-6">
        {tab === 'info' ? (
          <InfoTab studentId={id!} />
        ) : tab === 'records' ? (
          <RecordsTab studentId={id!} />
        ) : tab === 'plans' ? (
          <PlansTab studentId={id!} />
        ) : tab === 'growth' ? (
          <GrowthPanel studentId={id!} />
        ) : null}
      </div>
    </div>
  )
}
