import { useEffect, useState } from 'react'
import { Save, TestTube, Calendar, Sparkles, BookOpen, Settings2, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { DateInput } from '@/components/ui/date-input'
import { useAppStore } from '@/store/appStore'
import { settingsDb } from '@/db'
import type { AIConfig } from '@/types'
import { DatabaseManagementCard } from '@/components/Settings/DatabaseManagementCard'
import { SystemPromptEditor } from '@/components/Settings/SystemPromptEditor'
import { WordbankManager } from '@/components/Settings/WordbankManager'
import { PlanTemplateManager } from '@/components/Settings/PlanTemplateManager'
import { SchedulePeriodManager } from '@/components/Settings/SchedulePeriodManager'
import { TabNav } from '@/components/ui/tab-nav'

type SettingsTab = 'ai' | 'wordbank' | 'semester' | 'templates' | 'schedule_periods'


const TABS: Array<{ key: SettingsTab; label: string; icon: React.ReactNode }> = [
  { key: 'wordbank', label: '词库管理', icon: <BookOpen className="w-4 h-4" /> },
  { key: 'templates', label: '模板管理', icon: <Save className="w-4 h-4" /> },
  { key: 'ai', label: 'AI 配置', icon: <Settings2 className="w-4 h-4" /> },
  { key: 'semester', label: '学期设置', icon: <Calendar className="w-4 h-4" /> },
  { key: 'schedule_periods', label: '排课时段', icon: <Calendar className="w-4 h-4" /> },
]

const TASK_TYPES_FOR_DEFAULTS = [
  { key: 'phonics', label: '语音训练' },
  { key: 'vocab_new', label: '词库学习（新词）' },
  { key: 'vocab_review', label: '词库复习' },
  { key: 'textbook', label: '课文梳理' },
  { key: 'reading', label: '阅读训练' },
  { key: 'picture_book', label: '绘本阅读' },
  { key: 'exercise', label: '专项练习' },
  { key: 'other', label: '其他' },
]

export function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('wordbank')
  const [aiConfig, setAiConfig] = useState<AIConfig>({
    api_url: 'https://api.deepseek.com/v1', api_key: '',
    model: 'deepseek-chat',
    temperature: 0.7,
    max_tokens: 2048
  })
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  // 学期节点设置
  const [semesterConfig, setSemesterConfig] = useState({
    spring_start: '', spring_end: '',
    summer_start: '', summer_end: '',
    autumn_start: '', autumn_end: '',
    winter_start: '', winter_end: ''
  })
  const [savingSemester, setSavingSemester] = useState(false)

  // 任务默认文本
  const [taskDefaults, setTaskDefaults] = useState<Record<string, string>>({})
  const [savingDefaults, setSavingDefaults] = useState(false)

  // 折叠面板状态
  const [showPromptEditor, setShowPromptEditor] = useState(false)
  const [showDatabaseCard, setShowDatabaseCard] = useState(false)

  const storeSemesterConfig = useAppStore(state => state.semesterConfig)
  const loadSemesterConfig = useAppStore(state => state.loadSemesterConfig)

  useEffect(() => {
    loadSettings()
  }, [])

  useEffect(() => {
    if (storeSemesterConfig) {
      setSemesterConfig({
        spring_start: storeSemesterConfig.spring_start || '',
        spring_end: storeSemesterConfig.spring_end || '',
        summer_start: storeSemesterConfig.summer_start || '',
        summer_end: storeSemesterConfig.summer_end || '',
        autumn_start: storeSemesterConfig.autumn_start || '',
        autumn_end: storeSemesterConfig.autumn_end || '',
        winter_start: storeSemesterConfig.winter_start || '',
        winter_end: storeSemesterConfig.winter_end || ''
      })
    }
  }, [storeSemesterConfig])

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

    const defaults: Record<string, string> = {}
    for (const t of TASK_TYPES_FOR_DEFAULTS) {
      const val = await settingsDb.get(`task_default_${t.key}`)
      defaults[t.key] = val || ''
    }
    setTaskDefaults(defaults)
  }

  const handleSaveTaskDefaults = async () => {
    setSavingDefaults(true)
    try {
      for (const t of TASK_TYPES_FOR_DEFAULTS) {
        await settingsDb.set(`task_default_${t.key}`, taskDefaults[t.key] || '')
      }
      toast.success('任务模板已保存')
    } catch (error) {
      toast.error('保存失败：' + (error as Error).message)
    }
    setSavingDefaults(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await settingsDb.set('ai_api_url', aiConfig.api_url)
      await settingsDb.set('ai_api_key', aiConfig.api_key)
      await settingsDb.set('ai_model', aiConfig.model)
      await settingsDb.set('ai_temperature', aiConfig.temperature.toString())
      await settingsDb.set('ai_max_tokens', aiConfig.max_tokens.toString())
      toast.success('保存成功！')
    } catch (error) {
      toast.error('保存失败：' + (error as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    const { testAIConnection } = await import('@/ai/client')
    const result = await testAIConnection(aiConfig)
    setTestResult(result.message)
    setTesting(false)
  }

  const handleSaveSemester = async () => {
    setSavingSemester(true)
    try {
      await settingsDb.set('semester_spring_start', semesterConfig.spring_start)
      await settingsDb.set('semester_spring_end', semesterConfig.spring_end)
      await settingsDb.set('semester_summer_start', semesterConfig.summer_start)
      await settingsDb.set('semester_summer_end', semesterConfig.summer_end)
      await settingsDb.set('semester_autumn_start', semesterConfig.autumn_start)
      await settingsDb.set('semester_autumn_end', semesterConfig.autumn_end)
      await settingsDb.set('semester_winter_start', semesterConfig.winter_start)
      await settingsDb.set('semester_winter_end', semesterConfig.winter_end)
      await loadSemesterConfig()
      toast.success('学期节点设置已保存！')
    } catch (error) {
      toast.error('保存失败：' + (error as Error).message)
    } finally {
      setSavingSemester(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* 顶部栏 */}
      <header className="h-16 border-b bg-card flex items-center px-6">
        <h1 className="text-lg font-semibold">设置</h1>
      </header>

      <div className="border-b bg-card px-6">
        <TabNav tabs={TABS} activeTab={activeTab} onChange={(key) => setActiveTab(key as SettingsTab)} />
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-auto p-6">
        {/* AI 配置 Tab（合并系统提示词） */}
        {activeTab === 'ai' && (
          <div className="max-w-2xl space-y-4">
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
                  <Input value={aiConfig.api_url} onChange={(e) => setAiConfig({ ...aiConfig, api_url: e.target.value })} placeholder="https://api.deepseek.com/v1" />
                  <p className="text-xs text-muted-foreground">支持 OpenAI、DeepSeek 等兼容格式的 API 地址</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">API Key</label>
                  <Input type="password" value={aiConfig.api_key} onChange={(e) => setAiConfig({ ...aiConfig, api_key: e.target.value })} placeholder="sk-xxxxxxxxxxxxxxxx" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">模型名称</label>
                  <Input value={aiConfig.model} onChange={(e) => setAiConfig({ ...aiConfig, model: e.target.value })} placeholder="deepseek-chat" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">温度参数</label>
                    <Input type="number" step="0.1" min="0" max="2" value={aiConfig.temperature} onChange={(e) => setAiConfig({ ...aiConfig, temperature: parseFloat(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">最大 Token</label>
                    <Input type="number" value={aiConfig.max_tokens} onChange={(e) => setAiConfig({ ...aiConfig, max_tokens: parseInt(e.target.value) })} />
                  </div>
                </div>
                {testResult && (
                  <div className={`p-3 rounded-lg text-sm ${testResult.includes('成功') ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                    {testResult}
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <Button onClick={handleSave} disabled={saving}>
                    <Save className="w-4 h-4 mr-2" />{saving ? '保存中...' : '保存配置'}
                  </Button>
                  <Button variant="outline" onClick={handleTest} disabled={testing}>
                    <TestTube className="w-4 h-4 mr-2" />{testing ? '测试中...' : '测试连接'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 系统提示词 - 折叠面板 */}
            <Card>
              <CardHeader className="cursor-pointer" onClick={() => setShowPromptEditor(!showPromptEditor)}>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      AI 系统提示词
                    </CardTitle>
                    <CardDescription>自定义 AI 生成课程计划时使用的系统规则。留空则使用内置默认提示词。</CardDescription>
                  </div>
                  {showPromptEditor ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </CardHeader>
              {showPromptEditor && (
                <CardContent>
                  <SystemPromptEditor />
                </CardContent>
              )}
            </Card>
          </div>
        )}

        {/* 词库管理 Tab */}
        {activeTab === 'wordbank' && (
          <Card>
            <CardHeader>
              <CardTitle>词库管理</CardTitle>
              <CardDescription>管理学习词库配置，包括总关数和分类</CardDescription>
            </CardHeader>
            <CardContent>
              <WordbankManager />
            </CardContent>
          </Card>
        )}

        {/* 学期设置 Tab */}
        {activeTab === 'semester' && (
          <div className="max-w-3xl space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Calendar className="w-4 h-4" />学期节点设置</CardTitle>
                <CardDescription>设置各学期的起止日期，用于提醒和数据统计</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-green-600">春季学期</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-xs text-muted-foreground">开始日期</label><DateInput value={semesterConfig.spring_start} onChange={(val) => setSemesterConfig({ ...semesterConfig, spring_start: val })} /></div>
                    <div><label className="text-xs text-muted-foreground">结束日期</label><DateInput value={semesterConfig.spring_end} onChange={(val) => setSemesterConfig({ ...semesterConfig, spring_end: val })} /></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-orange-600">暑假</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-xs text-muted-foreground">开始日期</label><DateInput value={semesterConfig.summer_start} onChange={(val) => setSemesterConfig({ ...semesterConfig, summer_start: val })} /></div>
                    <div><label className="text-xs text-muted-foreground">结束日期</label><DateInput value={semesterConfig.summer_end} onChange={(val) => setSemesterConfig({ ...semesterConfig, summer_end: val })} /></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-blue-600">秋季学期</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-xs text-muted-foreground">开始日期</label><DateInput value={semesterConfig.autumn_start} onChange={(val) => setSemesterConfig({ ...semesterConfig, autumn_start: val })} /></div>
                    <div><label className="text-xs text-muted-foreground">结束日期</label><DateInput value={semesterConfig.autumn_end} onChange={(val) => setSemesterConfig({ ...semesterConfig, autumn_end: val })} /></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-cyan-600">寒假</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-xs text-muted-foreground">开始日期</label><DateInput value={semesterConfig.winter_start} onChange={(val) => setSemesterConfig({ ...semesterConfig, winter_start: val })} /></div>
                    <div><label className="text-xs text-muted-foreground">结束日期</label><DateInput value={semesterConfig.winter_end} onChange={(val) => setSemesterConfig({ ...semesterConfig, winter_end: val })} /></div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button onClick={handleSaveSemester} disabled={savingSemester}>
                    <Save className="w-4 h-4 mr-2" />{savingSemester ? '保存中...' : '保存学期设置'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">配置各学期的起止日期后，系统将自动计算学员的学习阶段。</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 排课时段 Tab */}
        {activeTab === 'schedule_periods' && (
          <div className="max-w-3xl">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Calendar className="w-4 h-4" />排课时段配置</CardTitle>
                <CardDescription>定义假期/特殊排课时段。排课时系统会根据日期自动匹配对应的学员偏好，未配置时段的日子默认使用"平时"偏好。</CardDescription>
              </CardHeader>
              <CardContent>
                <SchedulePeriodManager />
              </CardContent>
            </Card>
          </div>
        )}

        {/* 模板管理 Tab（合并任务模板 + 课程模板） */}
        {activeTab === 'templates' && (
          <div className="max-w-3xl space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>任务默认文本模板</CardTitle>
                <CardDescription>为每种任务类型设置默认文本内容。创建新任务时会自动填充对应模板。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {TASK_TYPES_FOR_DEFAULTS.map(t => (
                  <div key={t.key} className="space-y-1">
                    <label className="text-sm font-medium">{t.label}</label>
                    <textarea
                      value={taskDefaults[t.key] || ''}
                      onChange={(e) => setTaskDefaults({ ...taskDefaults, [t.key]: e.target.value })}
                      placeholder={`${t.label}的默认内容模板（可留空）`}
                      rows={2}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y min-h-[48px]"
                    />
                  </div>
                ))}
                <Button onClick={handleSaveTaskDefaults} disabled={savingDefaults}>
                  <Save className="w-4 h-4 mr-2" />{savingDefaults ? '保存中...' : '保存模板'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><BookOpen className="w-4 h-4" />课程设计模板</CardTitle>
                <CardDescription>管理课程设计模板，创建新课程设计时可选。每个模板包含多个任务和助教提示。</CardDescription>
              </CardHeader>
              <CardContent>
                <PlanTemplateManager />
              </CardContent>
            </Card>
          </div>
        )}

        {/* 数据库管理 - 折叠卡片（始终显示在末尾） */}
        <div className="mt-4">
          <button
            onClick={() => setShowDatabaseCard(!showDatabaseCard)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {showDatabaseCard ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            数据库管理
          </button>
          {showDatabaseCard && (
            <div className="mt-2 max-w-2xl">
              <DatabaseManagementCard />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
