import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StudentForm } from '@/components/Student/StudentForm'
import { useAppStore } from '@/store/appStore'
import { studentDb } from '@/db'
import type { Student } from '@/types'

export function StudentNew() {
  const navigate = useNavigate()
  const { createStudent } = useAppStore()

  const handleSubmit = async (data: Omit<Student, 'id' | 'created_at' | 'updated_at'>) => {
    // 如果没有学号，自动生成
    if (!data.student_no) {
      const nextNo = await studentDb.getNextStudentNo()
      data.student_no = nextNo
    }
    
    await createStudent(data)
    navigate('/')
  }

  return (
    <div className="h-full flex flex-col">
      {/* 顶部栏 */}
      <header className="h-16 border-b bg-card flex items-center px-6 gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-lg font-semibold">新增学员</h1>
      </header>

      {/* 表单区域 */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto bg-card rounded-lg border p-6">
          <StudentForm
            onSubmit={handleSubmit}
            onCancel={() => navigate(-1)}
          />
        </div>
      </div>
    </div>
  )
}