import { useEffect, useState } from 'react'
import { Save, TestTube, Calendar, RefreshCw, Sparkles, Database, BookOpen, Settings2 } from 'lucide-react'
import { toast } from 'sonner'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { DateInput } from '@/components/ui/date-input'
import { useAppStore } from '@/store/appStore'
import { settingsDb, studentDb, learningPhaseDb, classRecordDb } from '@/db'
import { testAIConnection } from '@/ai/client'
import type { AIConfig, PhaseType } from '@/types'
import { DatabaseManagementCard } from '@/components/Settings/DatabaseManagementCard'
import { SystemPromptEditor } from '@/components/Settings/SystemPromptEditor'
import { WordbankManager } from '@/components/Settings/WordbankManager'
import { cn } from '@/lib/utils'

type SettingsTab = 'ai' | 'wordbank' | 'semester' | 'prompt' | 'task_defaults' | 'database'

const TABS: Array<{ key: SettingsTab; label: string; icon: React.ReactNode }> = [
  { key: 'ai', label: 'AI 配置', icon: <Settings2 className="w-4 h-4" /> },
  { key: 'wordbank', label: '词库管理', icon: <BookOpen className="w-4 h-4" /> },
  { key: 'task_defaults', label: '任务模板', icon: <Save className="w-4 h-4" /> },
  { key: 'semester', label: '学期设置', icon: <Calendar className="w-4 h-4" /> },
  { key: 'prompt', label: '系统提示词', icon: <Sparkles className="w-4 h-4" /> },
  { key: 'database', label: '数据库', icon: <Database className="w-4 h-4" /> },
]

const TASK_TYPES_FOR_DEFAULTS = [
  { key: 'phonics', label: '语音训练' },
  { key: 'vocab_new', label: '词库学习（新词）' },
  { key: 'vocab_review', label: '词库复习' },
  { key: 'nine_grid', label: '九宫格清理' },
  { key: 'textbook', label: '课文梳理' },
  { key: 'reading', label: '阅读训练' },
  { key: 'picture_book', label: '绘本阅读' },
  { key: 'exercise', label: '专项练习' },
  { key: 'other', label: '其他' },
]

export function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('ai')
  const [aiConfig, setAiConfig] = useState<AIConfig>({
    api_url: 'https://api.deepseek.com/v1',api_key: '',
    model: 'deepseek-chat',
    temperature: 0.7,
    max_tokens: 2048
  })
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  
  // 学期节点设置
  const [semesterConfig, setSemesterConfig] = useState({
    spring_start: '',
    spring_end: '',
    summer_start: '',
    summer_end: '',
    autumn_start: '',
    autumn_end: '',
    winter_start: '',
    winter_end: ''
  })
  const [savingSemester, setSavingSemester] = useState(false)
  const [syncingPhases, setSyncingPhases] = useState(false)

  // 任务默认文本
  const [taskDefaults, setTaskDefaults] = useState<Record<string, string>>({})
  const [savingDefaults, setSavingDefaults] = useState(false)

  // 从 store 获取学期配置和加载方法
  const storeSemesterConfig = useAppStore(state => state.semesterConfig)
  const loadSemesterConfig = useAppStore(state => state.loadSemesterConfig)

  useEffect(() => {
    loadSettings()
  }, [])
  
  // 当 store 中的学期配置加载完成后，同步到本地状态
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

    // 加载任务默认文本
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
      
      // 更新 store 中的学期配置
      await loadSemesterConfig()
      
      toast.success('学期节点设置已保存！')
    } catch (error) {
      toast.error('保存失败：' + (error as Error).message)
    } finally {
      setSavingSemester(false)
    }
  }
  
  // 同步学习阶段到所有学员
  const handleSyncPhases = async () => {
    if (!semesterConfig.spring_start && !semesterConfig.summer_start && 
        !semesterConfig.autumn_start && !semesterConfig.winter_start) {
      toast.error('请先设置至少一个学期的起止日期')
      return
    }
    
    const confirmed = await confirmDialog({
      title: '同步学习阶段',
      message: '确定要根据学期设置同步所有学员的学习阶段吗？\n\n这将为每个学员创建对应的学习阶段记录。',
      confirmText: '同步',
      variant: 'warning'
    })
    
    if (!confirmed) {
      return
    }
    
    setSyncingPhases(true)
    try {
      // 获取所有学员
      const allStudents = await studentDb.getAllWithBilling(
        { status: 'all', student_type: 'all', level: 'all', grade: 'all', search: '', day_of_week: 'all' },
        { field: 'student_no', direction: 'asc' }
      )
      
      const currentYear = new Date().getFullYear()
      let createdCount = 0
      
      // 定义阶段类型映射
      const phaseConfigs: Array<{
        type: PhaseType
        name: string
        startKey: keyof typeof semesterConfig
        endKey: keyof typeof semesterConfig
      }> = [
        { type: 'semester', name: `${currentYear}年春季学期`, startKey: 'spring_start', endKey: 'spring_end' },
        { type: 'summer', name: `${currentYear}年暑假`, startKey: 'summer_start', endKey: 'summer_end' },
        { type: 'semester', name: `${currentYear}年秋季学期`, startKey: 'autumn_start', endKey: 'autumn_end' },
        { type: 'winter', name: `${currentYear}年寒假`, startKey: 'winter_start', endKey: 'winter_end' }
      ]
      
      for (const student of allStudents) {
        for (const config of phaseConfigs) {
          const startDate = semesterConfig[config.startKey]
          const endDate = semesterConfig[config.endKey]
          
          if (!startDate || !endDate) continue
          
          // 检查是否已存在相同学期类型的阶段
          const existingPhases = await learningPhaseDb.getByStudentId(student.id)
          const exists = existingPhases.some(p => 
            p.phase_type === config.type && 
            p.start_date === startDate &&
            p.end_date === endDate
          )
          
          if (!exists) {
            // 获取该学员在这个阶段的起始词汇量（从课堂记录中获取）
            const records = await classRecordDb.getByStudentId(student.id)
            const phaseRecords = records.filter(r => 
              r.class_date >= startDate && r.class_date <= endDate
            )
            
            // 创建学习阶段
            await learningPhaseDb.create({
              student_id: student.id,
              phase_name: config.name,
              phase_type: config.type,
              start_date: startDate,
              end_date: endDate,
              vocab_start: student.initial_vocab || undefined
            })
            createdCount++
          }
        }
      }
      
      toast.success(`同步完成！共创建了 ${createdCount} 个学习阶段记录。`)
    } catch (error) {
      toast.error('同步失败：' + (error as Error).message)
    } finally {
      setSyncingPhases(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* 顶部栏 */}
      <header className="h-16 border-b bg-card flex items-center px-6">
        <h1 className="text-lg font-semibold">设置</h1>
      </header>

      {/* Tab 导航 */}
      <div className="border-b bg-card px-6">
        <nav className="flex gap-1 -mb-px">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-auto p-6">
        {/* AI 配置 Tab */}
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
          </div>
        )}

        {/* 词库管理 Tab */}
        {activeTab === 'wordbank' && (
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
        )}

        {/* 学期设置 Tab */}
        {activeTab === 'semester' && (
          <div className="max-w-3xl">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  学期节点设置
                </CardTitle>
                <CardDescription>
                  设置各学期的起止日期，用于提醒和数据统计
                </CardDescription>
              </CardHeader>
          <CardContent className="space-y-4">
                {/* 春季学期 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-green-600">春季学期</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-muted-foreground">开始日期</label>
                      <DateInput
                        value={semesterConfig.spring_start}
                        onChange={(val) => setSemesterConfig({ ...semesterConfig, spring_start: val })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">结束日期</label>
                      <DateInput
                        value={semesterConfig.spring_end}
                        onChange={(val) => setSemesterConfig({ ...semesterConfig, spring_end: val })}
                      />
                    </div>
                  </div>
                </div>

                {/* 暑假 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-orange-600">暑假</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-muted-foreground">开始日期</label>
                      <DateInput
                        value={semesterConfig.summer_start}
                        onChange={(val) => setSemesterConfig({ ...semesterConfig, summer_start: val })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">结束日期</label>
                      <DateInput
                        value={semesterConfig.summer_end}
                        onChange={(val) => setSemesterConfig({ ...semesterConfig, summer_end: val })}
                      />
                    </div>
                  </div>
                </div>

                {/* 秋季学期 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-blue-600">秋季学期</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-muted-foreground">开始日期</label>
                      <DateInput
                        value={semesterConfig.autumn_start}
                        onChange={(val) => setSemesterConfig({ ...semesterConfig, autumn_start: val })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">结束日期</label>
                      <DateInput
                        value={semesterConfig.autumn_end}
                        onChange={(val) => setSemesterConfig({ ...semesterConfig, autumn_end: val })}
                      />
                    </div>
                  </div>
                </div>

                {/* 寒假 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-cyan-600">寒假</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-muted-foreground">开始日期</label>
                      <DateInput
                        value={semesterConfig.winter_start}
                        onChange={(val) => setSemesterConfig({ ...semesterConfig, winter_start: val })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">结束日期</label>
                      <DateInput
                        value={semesterConfig.winter_end}
                        onChange={(val) => setSemesterConfig({ ...semesterConfig, winter_end: val })}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button onClick={handleSaveSemester} disabled={savingSemester}>
                    <Save className="w-4 h-4 mr-2" />
                    {savingSemester ? '保存中...' : '保存学期设置'}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleSyncPhases} 
                    disabled={syncingPhases}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${syncingPhases ? 'animate-spin' : ''}`} />
                    {syncingPhases ? '同步中...' : '同步到学员学习阶段'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  点击"同步到学员学习阶段"后，系统将根据上方设置的学期日期，自动为每位学员创建对应的学习阶段记录。
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 系统提示词 Tab */}
        {activeTab === 'prompt' && (
          <div className="max-w-3xl">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  AI 系统提示词
                </CardTitle>
                <CardDescription>
                  自定义 AI 生成课程计划时使用的系统规则。留空则使用内置默认提示词。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <SystemPromptEditor />
              </CardContent>
            </Card>
          </div>
        )}

        {/* 任务模板 Tab */}
        {activeTab === 'task_defaults' && (
          <div className="max-w-2xl">
            <Card>
              <CardHeader>
                <CardTitle>任务默认文本模板</CardTitle>
                <CardDescription>
                  为每种任务类型设置默认文本内容。创建新任务时会自动填充对应模板。
                </CardDescription>
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
                  <Save className="w-4 h-4 mr-2" />
                  {savingDefaults ? '保存中...' : '保存模板'}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 数据库 Tab */}
        {activeTab === 'database' && (
          <div className="max-w-2xl">
            <DatabaseManagementCard />
          </div>
        )}
      </div>
    </div>
  )
}
