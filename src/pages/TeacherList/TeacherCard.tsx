import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Pencil, Trash2, Phone, GraduationCap, Clock } from 'lucide-react'
import type { Teacher, TrainingStage, OralLevel, TeacherType } from '@/types'
import { TRAINING_STAGE_LABELS, TEACHER_TYPE_LABELS } from '@/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

const ORAL_LEVEL_LABELS: Record<OralLevel, string> = {
  basic: '基础',
  intermediate: '中级',
  advanced: '高级'
}

const STATUS_LABELS = {
  active: '在职',
  inactive: '离职'
}

interface TeacherCardProps {
  teacher: Teacher
  index: number
  needsUpgrade: boolean
  onEdit: (teacher: Teacher) => void
  onDelete: (teacher: Teacher) => void
}

export function TeacherCard({ teacher, index, needsUpgrade, onEdit, onDelete }: TeacherCardProps) {
  const navigate = useNavigate()
  
  // 获取培训阶段颜色
  const getTrainingStageColor = (stage: TrainingStage) => {
    switch (stage) {
      case 'probation': return 'bg-yellow-100 text-yellow-700'
      case 'intern': return 'bg-blue-100 text-blue-700'
      case 'formal': return 'bg-green-100 text-green-700'
    }
  }
  
  // 计算升级进度百分比
  const getUpgradeProgressPercent = (teacher: Teacher) => {
    const hours = teacher.total_teaching_hours || 0
    const threshold = teacher.training_stage === 'probation' ? 2 : 10
    return Math.min((hours / threshold) * 100, 100)
  }
  
  // 判断是否已达到升级条件
  const hasReachedUpgradeThreshold = (teacher: Teacher) => {
    const hours = teacher.total_teaching_hours || 0
    if (teacher.training_stage === 'probation') return hours >= 2
    if (teacher.training_stage === 'intern') return hours >= 10
    return false
  }
  
  return (
    <motion.div
      key={teacher.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card 
        className={`p-4 hover:shadow-md transition-shadow cursor-pointer ${
          needsUpgrade ? 'ring-2 ring-orange-300' : ''
        }`}
        onClick={() => navigate(`/teachers/${teacher.id}`)}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="font-medium flex items-center gap-2">
                {teacher.name}
                {needsUpgrade && (
                  <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" title="需要升级" />
                )}
              </div>
              <div className={`text-xs ${teacher.status === 'active' ? 'text-green-600' : 'text-muted-foreground'}`}>
                {STATUS_LABELS[teacher.status]}
              </div>
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={e => {
                e.stopPropagation()
                onEdit(teacher)
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={e => {
                e.stopPropagation()
                onDelete(teacher)
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="space-y-2 text-sm text-muted-foreground">
          {teacher.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              <span>{teacher.phone}</span>
            </div>
          )}
          {teacher.university && (
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              <span>{teacher.university}{teacher.major ? ` · ${teacher.major}` : ''}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>累计教学: <strong className="text-foreground">{teacher.total_teaching_hours || 0}</strong> 小时</span>
            {/* 升级进度条 */}
            {teacher.training_stage !== 'formal' && (
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden ml-2">
                <div 
                  className={`h-full transition-all ${
                    hasReachedUpgradeThreshold(teacher) ? 'bg-green-500' : 'bg-primary'
                  }`}
                  style={{ 
                    width: `${getUpgradeProgressPercent(teacher)}%` 
                  }}
                />
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`px-2 py-0.5 rounded-full text-xs ${getTrainingStageColor(teacher.training_stage || 'probation')}`}>
              {TRAINING_STAGE_LABELS[teacher.training_stage || 'probation']}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs">
              口语: {ORAL_LEVEL_LABELS[teacher.oral_level]}
            </span>
            {teacher.teacher_types && teacher.teacher_types.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs">
                {teacher.teacher_types.map((t: TeacherType) => TEACHER_TYPE_LABELS[t]).join('、')}
              </span>
            )}
          </div>
          {teacher.suitable_levels && teacher.suitable_levels.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-xs">适合:</span>
              {teacher.suitable_levels.map(level => (
                <span key={level} className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-xs">
                  {level === 'weak' ? '基础薄弱' : level === 'medium' ? '基础较好' : '非常优秀'}
                </span>
              ))}
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  )
}