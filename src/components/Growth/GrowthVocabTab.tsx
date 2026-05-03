import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Trash2 } from 'lucide-react'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { VocabTestForm } from './VocabTestForm'
import { VocabChart } from './VocabChart'
import type { VocabTest } from '@/types'

interface GrowthVocabTabProps {
  studentId: string
  vocabTests: VocabTest[]
  showForm: boolean
  editingItem: VocabTest | null
  onAdd: () => void
  onEdit: (test: VocabTest) => void
  onSave: (data: any) => Promise<void>
  onCancel: () => void
  onDelete: (id: string) => Promise<void>
}

export function GrowthVocabTab({
  studentId,
  vocabTests,
  showForm,
  editingItem,
  onAdd,
  onEdit,
  onSave,
  onCancel,
  onDelete,
}: GrowthVocabTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">词汇量测试记录</h3>
        <Button onClick={onAdd}>
          <Plus className="w-4 h-4 mr-1" />
          添加记录
        </Button>
      </div>

      {showForm && (
        <VocabTestForm
          studentId={studentId}
          onSave={onSave}
          onCancel={onCancel}
          initialData={editingItem || undefined}
        />
      )}

      {vocabTests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">词汇量增长趋势</CardTitle>
          </CardHeader>
          <CardContent>
            <VocabChart tests={vocabTests} />
          </CardContent>
        </Card>
      )}

      {vocabTests.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          暂无词汇量测试记录
        </div>
      ) : (
        <div className="space-y-3">
          {vocabTests.map((test) => (
            <Card key={test.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold">{test.vocab_count} 词</span>
                      <span className="text-xs text-muted-foreground">{test.test_date}</span>
                      {test.test_source && (
                        <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600">
                          {test.test_source}
                        </span>
                      )}
                    </div>
                    {test.notes && (
                      <p className="text-sm text-muted-foreground">{test.notes}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(test)}
                    >
                      编辑
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={async () => {
                        const confirmed = await confirmDialog({
                          title: '删除词汇量记录',
                          message: '确定删除此词汇量测试记录？',
                          confirmText: '删除',
                          variant: 'danger'
                        })
                        if (confirmed) {
                          await onDelete(test.id)
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
