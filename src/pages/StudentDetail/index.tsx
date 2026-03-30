import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StudentForm } from '@/components/Student/StudentForm'
import { GrowthPanel } from '@/components/Growth/GrowthPanel'
import { useAppStore } from '@/store/appStore'
import { getLevelColor, cn } from '@/lib/utils'
import { InfoTab } from './InfoTab'
import { WordbankTab } from './WordbankTab'
import { RecordsTab } from './RecordsTab'
import { PlansTab } from './PlansTab'

type TabType = 'info' | 'wordbank' | 'growth' | 'records' | 'plans'

export function StudentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    currentStudent,
    updateStudent,
    deleteStudent,
    selectStudent,
    loadWordbanks
  } = useAppStore()

  const [tab, setTab] = useState<TabType>('info')
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (id) {
      selectStudent(id)
      loadWordbanks()
      const targetTab = sessionStorage.getItem('studentDetailTab')
      if (targetTab && ['info', 'wordbank', 'growth', 'records', 'plans'].includes(targetTab)) {
        setTab(targetTab as TabType)
        sessionStorage.removeItem('studentDetailTab')
      }
    }
  }, [id])

  if (!currentStudent) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        加载中...
      </div>
    )
  }

  const handleDelete = async () => {
    if (confirm('确定要删除此学员吗？此操作不可恢复。')) {
      await deleteStudent(id!)
      navigate('/')
    }
  }

  const tabs: { key: TabType; label: string }[] = [
    { key: 'info', label: '基本信息' },
    { key: 'wordbank', label: '词库进度' },
    { key: 'growth', label: '成长档案' },
    { key: 'records', label: '课堂记录' },
    { key: 'plans', label: '课程计划' },
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
          <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
            <Edit className="w-4 h-4 mr-1" />
            {editing ? '取消' : '编辑'}
          </Button>
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
        {editing ? (
          <Card className="max-w-2xl mx-auto">
            <CardHeader><CardTitle>编辑学员信息</CardTitle></CardHeader>
            <CardContent>
              <StudentForm
                student={currentStudent}
                onSubmit={async data => {
                  await updateStudent(id!, data)
                  setEditing(false)
                }}
                onCancel={() => setEditing(false)}
              />
            </CardContent>
          </Card>
        ) : tab === 'info' ? (
          <InfoTab studentId={id!} />
        ) : tab === 'wordbank' ? (
          <WordbankTab studentId={id!} />
        ) : tab === 'growth' ? (
          <GrowthPanel studentId={id!} />
        ) : tab === 'records' ? (
          <RecordsTab studentId={id!} />
        ) : tab === 'plans' ? (
          <PlansTab studentId={id!} />
        ) : null}
      </div>
    </div>
  )
}