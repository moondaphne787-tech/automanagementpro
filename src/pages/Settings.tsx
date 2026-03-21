import { useEffect, useState } from 'react'
import { Save, TestTube } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { PromptDialog } from '@/components/ui/dialog'
import { useAppStore } from '@/store/appStore'
import { settingsDb } from '@/db'
import type { AIConfig } from '@/types'

export function Settings() {
  const [aiConfig, setAiConfig] = useState<AIConfig>({
    api_url: 'https://api.deepseek.com/v1',
    api_key: '',
    model: 'deepseek-chat',
    temperature: 0.7,
    max_tokens: 2048
  })
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    const url = await settingsDb.get('ai_api_url')
    const key = await settingsDb.get('ai_api_key')
    const model = await settingsDb.get('ai_model')
    const temp = await settingsDb.get('ai_temperature')
    const tokens = await settingsDb.get('ai_max_tokens')

    setAiConfig({
      api_url: url || 'https://api.deepseek.com/v1',
      api_key: key || '',
      model: model || 'deepseek-chat',
      temperature: parseFloat(temp || '0.7'),
      max_tokens: parseInt(tokens || '2048')
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await settingsDb.set('ai_api_url', aiConfig.api_url)
      await settingsDb.set('ai_api_key', aiConfig.api_key)
      await settingsDb.set('ai_model', aiConfig.model)
      await settingsDb.set('ai_temperature', aiConfig.temperature.toString())
      await settingsDb.set('ai_max_tokens', aiConfig.max_tokens.toString())
      alert('保存成功！')
    } catch (error) {
      alert('保存失败：' + (error as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!aiConfig.api_key) {
      alert('请先输入 API Key')
      return
    }

    setTesting(true)
    setTestResult(null)
    
    try {
      const response = await fetch(`${aiConfig.api_url}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiConfig.api_key}`
        },
        body: JSON.stringify({
          model: aiConfig.model,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 10
        })
      })

      if (response.ok) {
        setTestResult('连接成功！API 配置正确。')
      } else {
        const error = await response.json()
        setTestResult(`连接失败：${error.error?.message || response.statusText}`)
      }
    } catch (error) {
      setTestResult(`连接失败：${(error as Error).message}`)
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* 顶部栏 */}
      <header className="h-16 border-b bg-card flex items-center px-6">
        <h1 className="text-lg font-semibold">设置</h1>
      </header>

      {/* 内容区域 */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl space-y-6">
          {/* AI 配置 */}
          <Card>
            <CardHeader>
              <CardTitle>AI 服务配置</CardTitle>
              <CardDescription>
                配置 OpenAI 兼容的 API 服务，用于生成课程计划
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">API 地址</label>
                <Input
                  value={aiConfig.api_url}
                  onChange={(e) => setAiConfig({ ...aiConfig, api_url: e.target.value })}
                  placeholder="https://api.deepseek.com/v1"
                />
                <p className="text-xs text-muted-foreground">
                  支持 OpenAI、DeepSeek 等兼容格式的 API 地址
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">API Key</label>
                <Input
                  type="password"
                  value={aiConfig.api_key}
                  onChange={(e) => setAiConfig({ ...aiConfig, api_key: e.target.value })}
                  placeholder="sk-xxxxxxxxxxxxxxxx"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">模型名称</label>
                <Input
                  value={aiConfig.model}
                  onChange={(e) => setAiConfig({ ...aiConfig, model: e.target.value })}
                  placeholder="deepseek-chat"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">温度参数</label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    value={aiConfig.temperature}
                    onChange={(e) => setAiConfig({ ...aiConfig, temperature: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">最大 Token</label>
                  <Input
                    type="number"
                    value={aiConfig.max_tokens}
                    onChange={(e) => setAiConfig({ ...aiConfig, max_tokens: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              {testResult && (
                <div className={`p-3 rounded-lg text-sm ${
                  testResult.includes('成功') ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                }`}>
                  {testResult}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? '保存中...' : '保存配置'}
                </Button>
                <Button variant="outline" onClick={handleTest} disabled={testing}>
                  <TestTube className="w-4 h-4 mr-2" />
                  {testing ? '测试中...' : '测试连接'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 词库配置 */}
          <Card>
            <CardHeader>
              <CardTitle>词库管理</CardTitle>
              <CardDescription>
                管理学习词库配置，包括总关数和九宫格清理间隔
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WordbankManager />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// 词库管理组件
function WordbankManager() {
  const { wordbanks, loadWordbanks, updateWordbank, createWordbank, deleteWordbank } = useAppStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  
  // Prompt dialog state
  const [promptState, setPromptState] = useState<{
    open: boolean
    title: string
    defaultValue: string
    onConfirm: ((value: string) => void) | null
  }>({ open: false, title: '', defaultValue: '', onConfirm: null })
  
  const showPrompt = (title: string, defaultValue: string, onConfirm: (value: string) => void) => {
    setPromptState({ open: true, title, defaultValue, onConfirm })
  }

  useEffect(() => {
    loadWordbanks()
  }, [])

  return (
    <>
      <div className="space-y-4">
        {wordbanks.map((wb) => (
          <div key={wb.id} className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
            <div className="flex-1">
              <div className="font-medium">{wb.name}</div>
              <div className="text-xs text-muted-foreground">
                总关数: {wb.total_levels} | 九宫格间隔: {wb.nine_grid_interval}关
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                showPrompt('输入新的总关数:', wb.total_levels.toString(), (newTotal) => {
                  if (newTotal && !isNaN(parseInt(newTotal))) {
                    updateWordbank(wb.id, { total_levels: parseInt(newTotal) })
                  }
                })
              }}
            >
              编辑
            </Button>
          </div>
        ))}

        <Button 
          variant="outline" 
          size="sm"
          onClick={async () => {
            showPrompt('输入词库名称:', '', async (name) => {
              if (name) {
                await createWordbank({
                  name,
                  total_levels: 60,
                  nine_grid_interval: 10,
                  category: 'primary_exam',
                  sort_order: wordbanks.length + 1,
                  notes: null
                })
              }
            })
          }}
        >
          添加词库
        </Button>
      </div>
      
      {/* Prompt Dialog */}
      <PromptDialog
        open={promptState.open}
        title={promptState.title}
        defaultValue={promptState.defaultValue}
        onConfirm={(value) => {
          promptState.onConfirm?.(value)
          setPromptState({ open: false, title: '', defaultValue: '', onConfirm: null })
        }}
        onCancel={() => setPromptState({ open: false, title: '', defaultValue: '', onConfirm: null })}
      />
    </>
  )
}
