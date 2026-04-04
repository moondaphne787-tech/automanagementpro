import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAppStore } from '@/store/appStore'
import type { WordbankCategory, Wordbank } from '@/types'

// 词库分类选项
export const WORDBANK_CATEGORY_OPTIONS: Array<{ value: WordbankCategory; label: string }> = [
  { value: 'textbook', label: '教材词库' },
  { value: 'primary_exam', label: '小学考试' },
  { value: 'primary_advanced', label: '小学拓展' },
  { value: 'junior_exam', label: '初中考试' },
  { value: 'junior_advanced', label: '初中拓展' },
  { value: 'senior_exam', label: '高中考试' },
  { value: 'senior_advanced', label: '高中拓展' },
  { value: 'college_cet4', label: '大学四级' },
]

export function WordbankManager() {
  const wordbanks = useAppStore(s => s.wordbanks)
  const loadWordbanks = useAppStore(s => s.loadWordbanks)
  const updateWordbank = useAppStore(s => s.updateWordbank)
  const createWordbank = useAppStore(s => s.createWordbank)
  const deleteWordbank = useAppStore(s => s.deleteWordbank)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{
    name: string
    total_levels: number
    nine_grid_interval: number
    category: WordbankCategory
    sort_order: number
    notes: string
  }>({
    name: '',
    total_levels: 60,
    nine_grid_interval: 10,
    category: 'primary_exam',
    sort_order: 1,
    notes: ''
  })
  
  // Add wordbank dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [newWordbank, setNewWordbank] = useState({
    name: '',
    total_levels: 60,
    nine_grid_interval: 10,
    category: 'primary_exam' as WordbankCategory,
    notes: ''
  })

  useEffect(() => {
    loadWordbanks()
  }, [])

  // 开始编辑
  const handleStartEdit = (wb: Wordbank) => {
    setEditingId(wb.id)
    setEditForm({
      name: wb.name,
      total_levels: wb.total_levels,
      nine_grid_interval: wb.nine_grid_interval,
      category: wb.category,
      sort_order: wb.sort_order,
      notes: wb.notes || ''
    })
  }

  // 保存编辑
  const handleSaveEdit = async () => {
    if (!editingId) return
    if (!editForm.name.trim()) {
      toast.error('词库名称不能为空')
      return
    }
    if (editForm.total_levels < 1) {
      toast.error('总关数必须大于0')
      return
    }
    if (editForm.nine_grid_interval < 1) {
      toast.error('九宫格间隔必须大于0')
      return
    }
    
    await updateWordbank(editingId, {
      name: editForm.name.trim(),
      total_levels: editForm.total_levels,
      nine_grid_interval: editForm.nine_grid_interval,
      category: editForm.category,
      sort_order: editForm.sort_order,
      notes: editForm.notes || null
    })
    setEditingId(null)
  }

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingId(null)
  }

  // 删除词库
  const handleDelete = async (wb: Wordbank) => {
    const confirmed = await confirmDialog({
      title: '删除词库',
      message: `确定要删除词库「${wb.name}」吗？\n\n⚠️ 警告：删除词库不会删除学员的词库进度记录，但进度记录中的词库名称可能不再匹配。`,
      confirmText: '删除',
      variant: 'danger'
    })
    if (!confirmed) {
      return
    }
    await deleteWordbank(wb.id)
    toast.success('词库已删除')
  }

  // 添加词库
  const handleAddWordbank = async () => {
    if (!newWordbank.name.trim()) {
      toast.error('请输入词库名称')
      return
    }
    // 检查词库名称是否已存在
    const existingWordbank = wordbanks.find(w => w.name === newWordbank.name.trim())
    if (existingWordbank) {
      toast.error(`词库「${newWordbank.name.trim()}」已存在，请使用其他名称`)
      return
    }
    if (isNaN(newWordbank.total_levels) || newWordbank.total_levels < 1) {
      toast.error('请输入有效的关数')
      return
    }
    if (isNaN(newWordbank.nine_grid_interval) || newWordbank.nine_grid_interval < 1) {
      toast.error('请输入有效的九宫格间隔')
      return
    }
    await createWordbank({
      name: newWordbank.name.trim(),
      total_levels: newWordbank.total_levels,
      nine_grid_interval: newWordbank.nine_grid_interval,
      category: newWordbank.category,
      sort_order: wordbanks.length + 1,
      notes: newWordbank.notes || null
    })
    setAddDialogOpen(false)
    setNewWordbank({
      name: '',
      total_levels: 60,
      nine_grid_interval: 10,
      category: 'primary_exam',
      notes: ''
    })
  }

  return (
    <>
      <div className="space-y-1.5">
        {/* 表头 */}
        <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground font-medium px-3 py-2 bg-muted/30 rounded sticky top-0 z-10">
          <div className="col-span-3">词库名称</div>
          <div className="col-span-2 text-center">总关数</div>
          <div className="col-span-2 text-center">九宫格间隔</div>
          <div className="col-span-2 text-center">分类</div>
          <div className="col-span-1 text-center">排序</div>
          <div className="col-span-2 text-center">操作</div>
        </div>
        
        {/* 词库列表 */}
        {wordbanks.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            暂无词库，请点击下方按钮添加
          </div>
        ) : (
          <div className={wordbanks.length > 6 ? "max-h-[400px] overflow-y-auto space-y-1.5" : "space-y-1.5"}>
          {wordbanks.map((wb) => (
            <div key={wb.id} className="grid grid-cols-12 gap-2 items-center p-3 bg-muted/50 rounded-lg">
              {editingId === wb.id ? (
                // 编辑模式
                <>
                  <div className="col-span-3">
                    <Input
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      placeholder="词库名称"
                      className="h-8"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      min="1"
                      value={editForm.total_levels}
                      onChange={(e) => setEditForm({ ...editForm, total_levels: parseInt(e.target.value) || 1 })}
                      className="h-8 text-center"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      min="1"
                      value={editForm.nine_grid_interval}
                      onChange={(e) => setEditForm({ ...editForm, nine_grid_interval: parseInt(e.target.value) || 1 })}
                      className="h-8 text-center"
                    />
                  </div>
                  <div className="col-span-2">
                    <select
                      value={editForm.category}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value as WordbankCategory })}
                      className="w-full h-8 px-2 rounded border border-input bg-background text-sm"
                    >
                      {WORDBANK_CATEGORY_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-1">
                    <Input
                      type="number"
                      min="1"
                      value={editForm.sort_order}
                      onChange={(e) => setEditForm({ ...editForm, sort_order: parseInt(e.target.value) || 1 })}
                      className="h-8 text-center"
                    />
                  </div>
                  <div className="col-span-2 flex justify-center gap-1">
                    <Button size="sm" onClick={handleSaveEdit} className="h-7 px-2 text-xs">保存</Button>
                    <Button size="sm" variant="outline" onClick={handleCancelEdit} className="h-7 px-2 text-xs">取消</Button>
                  </div>
                  {/* 备注 - 编辑模式下单独一行 */}
                  <div className="col-span-12 mt-2">
                    <Input
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      placeholder="备注（可选）"
                      className="h-8"
                    />
                  </div>
                </>
              ) : (
                // 查看模式
                <>
                  <div className="col-span-3">
                    <div className="font-medium">{wb.name}</div>
                    {wb.notes && (
                      <div className="text-xs text-muted-foreground truncate">{wb.notes}</div>
                    )}
                  </div>
                  <div className="col-span-2 text-center">{wb.total_levels}</div>
                  <div className="col-span-2 text-center">{wb.nine_grid_interval}关</div>
                  <div className="col-span-2 text-center">
                    <span className="text-xs px-2 py-0.5 rounded bg-muted">
                      {WORDBANK_CATEGORY_OPTIONS.find(o => o.value === wb.category)?.label || wb.category}
                    </span>
                  </div>
                  <div className="col-span-1 text-center">{wb.sort_order}</div>
                  <div className="col-span-2 flex justify-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => handleStartEdit(wb)}
                    >
                      编辑
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={() => handleDelete(wb)}
                    >
                      删除
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
          </div>
        )}

        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setAddDialogOpen(true)}
        >
          添加词库
        </Button>
      </div>
      
      {/* Add Wordbank Dialog */}
      {addDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setAddDialogOpen(false)} />
          <div className="relative bg-card rounded-lg shadow-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">添加新词库</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">词库名称 <span className="text-destructive">*</span></label>
                <Input
                  value={newWordbank.name}
                  onChange={(e) => setNewWordbank({ ...newWordbank, name: e.target.value })}
                  placeholder="请输入词库名称"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">总关数 <span className="text-destructive">*</span></label>
                  <Input
                    type="number"
                    min="1"
                    value={newWordbank.total_levels}
                    onChange={(e) => setNewWordbank({ ...newWordbank, total_levels: parseInt(e.target.value) || 0 })}
                    placeholder="如: 60"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">九宫格间隔 <span className="text-destructive">*</span></label>
                  <Input
                    type="number"
                    min="1"
                    value={newWordbank.nine_grid_interval}
                    onChange={(e) => setNewWordbank({ ...newWordbank, nine_grid_interval: parseInt(e.target.value) || 0 })}
                    placeholder="如: 10"
                  />
                  <p className="text-xs text-muted-foreground">每隔几关进行一次九宫格清理</p>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">分类</label>
                <select
                  value={newWordbank.category}
                  onChange={(e) => setNewWordbank({ ...newWordbank, category: e.target.value as WordbankCategory })}
                  className="w-full h-9 px-3 rounded border border-input bg-background text-sm"
                >
                  {WORDBANK_CATEGORY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">备注</label>
                <Input
                  value={newWordbank.notes}
                  onChange={(e) => setNewWordbank({ ...newWordbank, notes: e.target.value })}
                  placeholder="可选备注信息"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setAddDialogOpen(false)}>取消</Button>
              <Button onClick={handleAddWordbank}>确定</Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}