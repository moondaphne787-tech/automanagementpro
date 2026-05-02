import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { planTemplateDb } from '@/db'
import type { PlanTemplate } from '@/db/planTemplates'
import type { TaskBlock } from '@/types'
import { TASK_TYPE_LABELS } from '@/types'
import { cn } from '@/lib/utils'

interface TemplatePickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (template: {
    tasks: TaskBlock[]
    notes?: string
    name: string
  }) => void
}

const CATEGORY_LABELS: Record<string, string> = {
  general: '通用',
  phonics: '拼读',
  exam_prep: '备考',
  new_concept: '新概念',
}

export function TemplatePickerDialog({ open, onOpenChange, onSelect }: TemplatePickerDialogProps) {
  const [templates, setTemplates] = useState<PlanTemplate[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    Promise.all([
      planTemplateDb.getAll(),
      planTemplateDb.getCategories(),
    ]).then(([all, cats]) => {
      setTemplates(all)
      setCategories(cats)
      setActiveCategory(cats[0] ?? null)
    })
  }, [open])

  const filtered = activeCategory
    ? templates.filter(t => t.category === activeCategory)
    : templates

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>从模板创建课程设计</DialogTitle>
        </DialogHeader>

        <div className="flex gap-4 min-h-[300px]">
          {/* 左侧分类列表 */}
          <div className="w-32 shrink-0 space-y-1">
            {categories.map(cat => (
              <button
                key={cat}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm rounded-md transition-colors',
                  activeCategory === cat
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted'
                )}
                onClick={() => setActiveCategory(cat)}
              >
                {CATEGORY_LABELS[cat] || cat}
              </button>
            ))}
          </div>

          {/* 右侧模板列表 */}
          <div className="flex-1 space-y-2 max-h-[400px] overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">
                暂无模板
              </p>
            ) : (
              filtered.map(t => {
                let tasks: TaskBlock[] = []
                try { tasks = JSON.parse(t.tasks) } catch { /* 忽略解析错误 */ }
                return (
                  <button
                    key={t.id}
                    className="w-full text-left border rounded-lg p-3 hover:border-primary/50 hover:bg-muted/30 transition-colors"
                    onClick={() => onSelect({
                      tasks,
                      notes: t.notes ?? undefined,
                      name: t.name,
                    })}
                  >
                    <p className="text-sm font-medium mb-1">{t.name}</p>
                    <div className="flex flex-wrap gap-1 mb-1">
                      {tasks.slice(0, 4).map((task, i) => (
                        <span key={i} className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {TASK_TYPE_LABELS[task.type]}
                        </span>
                      ))}
                      {tasks.length > 4 && (
                        <span className="text-xs text-muted-foreground">+{tasks.length - 4}</span>
                      )}
                    </div>
                    {t.notes && (
                      <p className="text-xs text-muted-foreground truncate">{t.notes}</p>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
