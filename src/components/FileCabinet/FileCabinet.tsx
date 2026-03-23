import { motion, AnimatePresence } from 'framer-motion'
import { FileFolder } from './FileFolder'
import { useAppStore } from '@/store/appStore'
import type { StudentWithBilling } from '@/types'

interface FileCabinetProps {
  students: StudentWithBilling[]
  loading?: boolean
}

export function FileCabinet({ students, loading }: FileCabinetProps) {
  const expiredPlansMap = useAppStore(state => state.expiredPlansMap)
  
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="bg-muted rounded-lg p-4 h-40" />
          </div>
        ))}
      </div>
    )
  }

  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <div className="text-6xl mb-4">📁</div>
        <div className="text-lg font-medium mb-2">暂无学员档案</div>
        <div className="text-sm">点击右上角「新增学员」开始添加</div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
      <AnimatePresence mode="popLayout">
        {students.map((student) => (
          <motion.div
            key={student.id}
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: student.status !== 'active' ? 0.6 : 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <FileFolder 
              student={student} 
              expiredPlansCount={expiredPlansMap.get(student.id) || 0}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}