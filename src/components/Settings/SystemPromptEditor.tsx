import { useState, useEffect } from 'react'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { settingsDb } from '@/db'
import { DEFAULT_SYSTEM_PROMPT } from '@/ai/prompts'

export function SystemPromptEditor() {
  const [promptValue, setPromptValue] = useState('')
  const [isCustom, setIsCustom] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const custom = await settingsDb.get('ai_system_prompt')
      if (custom) {
        setPromptValue(custom)
        setIsCustom(true)
      } else {
        setPromptValue(DEFAULT_SYSTEM_PROMPT)
        setIsCustom(false)
      }
      setLoading(false)
    }
    load()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await settingsDb.set('ai_system_prompt', promptValue)
      setIsCustom(true)
      alert('系统提示词已保存！下次生成计划时生效。')
    } catch (error) {
      alert('保存失败：' + (error as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!confirm('确定要恢复为内置默认提示词吗？')) return
    await settingsDb.set('ai_system_prompt', '')
    setPromptValue(DEFAULT_SYSTEM_PROMPT)
    setIsCustom(false)
    alert('已恢复为默认提示词。')
  }

  if (loading) return <div className="text-sm text-muted-foreground">加载中...</div>

  return (
    <div className="space-y-3">
      {isCustom && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          <span>当前使用自定义提示词</span>
          <button onClick={handleReset} className="ml-auto text-xs underline hover:no-underline">
            恢复默认
          </button>
        </div>
      )}

      <div>
        <label className="text-sm font-medium mb-1 block">提示词内容</label>
        <textarea
          value={promptValue}
          onChange={(e) => setPromptValue(e.target.value)}
          className="w-full h-64 px-3 py-2 text-sm font-mono border rounded-lg resize-y leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="输入自定义系统提示词..."
          spellCheck={false}
        />
        <p className="text-xs text-muted-foreground mt-1">
          修改后需点击保存，仅影响后续新生成的计划，不影响已保存的计划。
        </p>
      </div>

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? '保存中...' : '保存提示词'}
        </Button>
        {isCustom && (
          <Button variant="outline" onClick={handleReset}>
            恢复默认
          </Button>
        )}
      </div>
    </div>
  )
}