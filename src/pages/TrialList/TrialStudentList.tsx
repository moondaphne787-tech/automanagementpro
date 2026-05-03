import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LEVEL_LABELS } from '@/types'
import type { Student, TrialConversion, Billing } from '@/types'

export type TrialStudent = Student & {
  conversion: TrialConversion | null
  billing: Billing | null
}

interface TrialStudentListProps {
  students: TrialStudent[]
  loading: boolean
  onOpenConvertDialog: (student: TrialStudent) => void
}

export function TrialStudentList({ students, loading, onOpenConvertDialog }: TrialStudentListProps) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const filteredStudents = useMemo(() =>
    students.filter(s => s.name.toLowerCase().includes(search.toLowerCase())),
    [students, search]
  )

  return (
    <>
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
          <div className="flex items-center justify-center h-full text-muted-foreground">加载中...</div>
        ) : filteredStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            {search ? '没有找到匹配的体验生' : '暂无体验生'}
          </div>
        ) : (
          <div className="border rounded-lg">
            <div className="grid grid-cols-[1fr_5rem_5rem_7rem_7rem_5rem_6rem] gap-4 py-2 px-4 bg-muted/50 border-b text-sm font-medium text-muted-foreground">
              <div>姓名</div>
              <div>年级</div>
              <div>程度</div>
              <div>体验日期</div>
              <div>成交日期</div>
              <div className="text-center">状态</div>
              <div className="text-center">操作</div>
            </div>
            {filteredStudents.map(student => (
              <div
                key={student.id}
                className="grid grid-cols-[1fr_5rem_5rem_7rem_7rem_5rem_6rem] gap-4 py-2 px-4 border-b last:border-b-0 items-center hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => navigate(`/students/${student.id}`)}
              >
                <div className="font-medium text-sm truncate">{student.name}</div>
                <div className="text-sm text-muted-foreground">{student.grade || '-'}</div>
                <div className="text-sm">{LEVEL_LABELS[student.level]}</div>
                <div className="text-sm text-muted-foreground">{student.conversion?.trial_date || '-'}</div>
                <div className="text-sm">
                  {student.conversion?.converted && student.conversion.conversion_date ? (
                    <span className="text-green-600">{student.conversion.conversion_date}</span>
                  ) : '-'}
                </div>
                <div className="text-center">
                  {student.conversion?.converted ? (
                    <span className="px-2 py-0.5 bg-green-500/10 text-green-600 text-xs rounded-full">已成交</span>
                  ) : (
                    <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 text-xs rounded-full">待跟进</span>
                  )}
                </div>
                <div className="text-center">
                  {!student.conversion?.converted && (
                    <Button size="sm" variant="outline" className="h-7 text-xs"
                      onClick={(e) => { e.stopPropagation(); onOpenConvertDialog(student); }}>
                      <CheckCircle className="w-3 h-3 mr-1" />成交
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
