import { useEffect, useState } from 'react'
import { Save, TestTube, Calendar, Download, Upload, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { DateInput } from '@/components/ui/date-input'
import { PromptDialog } from '@/components/ui/dialog'
import { useAppStore } from '@/store/appStore'
import { settingsDb, studentDb, learningPhaseDb, classRecordDb } from '@/db'
import type { AIConfig, PhaseType } from '@/types'

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
      
      alert('学期节点设置已保存！')
    } catch (error) {
      alert('保存失败：' + (error as Error).message)
    } finally {
      setSavingSemester(false)
    }
  }
  
  // 同步学习阶段到所有学员
  const handleSyncPhases = async () => {
    if (!semesterConfig.spring_start && !semesterConfig.summer_start && 
        !semesterConfig.autumn_start && !semesterConfig.winter_start) {
      alert('请先设置至少一个学期的起止日期')
      return
    }
    
    if (!confirm('确定要根据学期设置同步所有学员的学习阶段吗？\n\n这将为每个学员创建对应的学习阶段记录。')) {
      return
    }
    
    setSyncingPhases(true)
    try {
      // 获取所有学员
      const allStudents = await studentDb.getAllWithBilling(
        { status: 'all', student_type: 'all', level: 'all', grade: 'all', search: '' },
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
      
      alert(`同步完成！共创建了 ${createdCount} 个学习阶段记录。`)
    } catch (error) {
      alert('同步失败：' + (error as Error).message)
    } finally {
      setSyncingPhases(false)
    }
  }

  const handleBackup = async () => {
    try {
      if (!window.electronAPI) {
        alert('备份功能仅在桌面应用中可用')
        return
      }
      
      // 通过 IPC 调用主进程的 dialog.showSaveDialog
      const result = await window.electronAPI.showSaveDialog({
        title: '选择备份保存位置',
        defaultPath: `edumanager_backup_${new Date().toISOString().split('T')[0]}.db`,
        filters: [{ name: 'SQLite Database', extensions: ['db'] }]
      })
      
      if (!result || result.canceled || !result.filePath) return
      
      await window.electronAPI.dbBackup(result.filePath)
      await settingsDb.set('last_backup_date', new Date().toISOString())
      alert(`备份成功！文件已保存到：${result.filePath}`)
    } catch (error) {
      alert('备份失败：' + (error as Error).message)
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

          {/* 学期节点设置 */}
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

          {/* 数据备份 */}
          <Card>
            <CardHeader>
              <CardTitle>数据管理</CardTitle>
              <CardDescription>
                备份和恢复学员数据
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <Button variant="outline" onClick={handleBackup}>
                  <Download className="w-4 h-4 mr-2" />
                  备份数据
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                备份文件将保存到下载目录，建议每周备份一次
              </p>
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
  
  // Add wordbank dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [newWordbank, setNewWordbank] = useState({
    name: '',
    total_levels: 60
  })
  
  const showPrompt = (title: string, defaultValue: string, onConfirm: (value: string) => void) => {
    setPromptState({ open: true, title, defaultValue, onConfirm })
  }

  useEffect(() => {
    loadWordbanks()
  }, [])

  const handleAddWordbank = async () => {
    if (!newWordbank.name.trim()) {
      alert('请输入词库名称')
      return
    }
    if (isNaN(newWordbank.total_levels) || newWordbank.total_levels < 1) {
      alert('请输入有效的关数')
      return
    }
    await createWordbank({
      name: newWordbank.name.trim(),
      total_levels: newWordbank.total_levels,
      nine_grid_interval: 10,
      category: 'primary_exam',
      sort_order: wordbanks.length + 1,
      notes: null
    })
    setAddDialogOpen(false)
    setNewWordbank({ name: '', total_levels: 60 })
  }

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
          onClick={() => setAddDialogOpen(true)}
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
      
      {/* Add Wordbank Dialog */}
      {addDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setAddDialogOpen(false)} />
          <div className="relative bg-card rounded-lg shadow-lg p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-semibold mb-4">添加新词库</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">词库名称</label>
                <Input
                  value={newWordbank.name}
                  onChange={(e) => setNewWordbank({ ...newWordbank, name: e.target.value })}
                  placeholder="请输入词库名称"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">总关数</label>
                <Input
                  type="number"
                  min="1"
                  value={newWordbank.total_levels}
                  onChange={(e) => setNewWordbank({ ...newWordbank, total_levels: parseInt(e.target.value) || 0 })}
                  placeholder="请输入总关数"
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
