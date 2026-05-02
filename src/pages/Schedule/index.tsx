import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Settings2, CalendarDays } from 'lucide-react'
import { useScheduleData } from './hooks/useScheduleData'
import { useClassDialog } from './hooks/useScheduleDialogs'
import { DayScheduleView } from './components/DayScheduleView'
import { ClassDialog } from './components/ClassDialog'
import { Button } from '@/components/ui/button'
import { formatDateISO } from '@/lib/utils'

export function Schedule() {
  const navigate = useNavigate()
  const today = formatDateISO(new Date())
  const [selectedDate, setSelectedDate] = useState(today)

  const { students, teachers, classes, loading, loadData } = useScheduleData(selectedDate)
  const classDialog = useClassDialog(loadData)

  const handleCreateClass = useCallback(() => {
    classDialog.initForCreate(selectedDate)
    classDialog.setOpen(true)
  }, [classDialog, selectedDate])

  const handleEditClass = useCallback((cls: any) => {
    classDialog.initForEdit(cls)
    classDialog.setOpen(true)
  }, [classDialog])

  const handleToday = useCallback(() => {
    setSelectedDate(today)
  }, [today])

  return (
    <div className="h-full flex flex-col">
      <header className="h-16 border-b bg-card flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">排课管理</h1>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 text-sm border rounded-md bg-background"
            />
            <Button variant="outline" size="sm" onClick={handleToday}>
              <CalendarDays className="h-4 w-4 mr-1" />
              今天
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/schedule/preferences')}>
            <Settings2 className="h-4 w-4 mr-1" />
            时段偏好
          </Button>
          <Button size="sm" onClick={handleCreateClass}>
            <Plus className="h-4 w-4 mr-1" />
            新增排课
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <DayScheduleView
          classes={classes}
          loading={loading}
          onEditClass={handleEditClass}
          onDeleteClass={classDialog.handleDelete}
        />
      </div>

      <ClassDialog
        open={classDialog.open}
        onOpenChange={classDialog.setOpen}
        editingClass={classDialog.editingClass}
        classForm={classDialog.form}
        setClassForm={classDialog.setForm}
        students={students}
        teachers={teachers}
        saving={classDialog.saving}
        onSave={classDialog.onSave}
      />
    </div>
  )
}
