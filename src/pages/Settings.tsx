import { useEffect, useState } from 'react'
import { Save, TestTube, Calendar, Download, Upload, RefreshCw, Database, FolderOpen, History, AlertCircle, FileSpreadsheet, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { DateInput } from '@/components/ui/date-input'
import { PromptDialog } from '@/components/ui/dialog'
import { useAppStore } from '@/store/appStore'
import { settingsDb, studentDb, learningPhaseDb, classRecordDb } from '@/db'
import { exportToExcel } from '@/utils/excelExport'
import { DEFAULT_SYSTEM_PROMPT } from '@/ai/prompts'
import type { AIConfig, PhaseType, WordbankCategory, Wordbank } from '@/types'

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

          {/* AI 系统提示词设置 */}
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

          {/* 数据库版本与迁移管理 */}
          <DatabaseManagementCard />
        </div>
      </div>
    </div>
  )
}

// 数据库管理卡片组件
function DatabaseManagementCard() {
  const [dbStats, setDbStats] = useState<{
    version: number
    latestVersion: number
    students: number
    teachers: number
    classRecords: number
    lessonPlans: number
    dbSize: number
    lastBackup: string | null
  } | null>(null)
  const [migrationHistory, setMigrationHistory] = useState<Array<{
    version: number
    applied_at: string
    description?: string
  }>>([])
  const [backupHistory, setBackupHistory] = useState<Array<{
    id: string
    backup_path: string
    backup_type: string
    file_size: number
    created_at: string
  }>>([])
  const [loading, setLoading] = useState(true)
  const [showMigrationHistory, setShowMigrationHistory] = useState(false)
  const [showBackupHistory, setShowBackupHistory] = useState(false)
  const [creatingBackup, setCreatingBackup] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)

  useEffect(() => {
    loadDatabaseInfo()
  }, [])

  const loadDatabaseInfo = async () => {
    if (!window.electronAPI) {
      setLoading(false)
      return
    }

    try {
      const [stats, history, backups] = await Promise.all([
        window.electronAPI.dbGetStats(),
        window.electronAPI.dbGetMigrationHistory(),
        window.electronAPI.dbGetBackupHistory(10)
      ])
      
      setDbStats(stats)
      setMigrationHistory(history)
      setBackupHistory(backups)
    } catch (error) {
      console.error('Failed to load database info:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateBackup = async () => {
    if (!window.electronAPI) return
    
    setCreatingBackup(true)
    try {
      const result = await window.electronAPI.dbCreateBackup()
      if (result.success) {
        alert(`备份成功！\n文件路径: ${result.path}`)
        loadDatabaseInfo() // 刷新信息
      }
    } catch (error) {
      alert('备份失败：' + (error as Error).message)
    } finally {
      setCreatingBackup(false)
    }
  }

  const handleOpenBackupDir = async () => {
    if (!window.electronAPI) return
    await window.electronAPI.dbOpenBackupDir()
  }

  const handleRestoreBackup = async (backupPath: string) => {
    if (!window.electronAPI) return
    
    if (!confirm('确定要从该备份恢复数据库吗？\n\n⚠️ 警告：当前数据将被覆盖，恢复后需要重启应用。')) {
      return
    }

    try {
      const result = await window.electronAPI.dbRestoreFromBackup(backupPath)
      if (result.success) {
        alert(result.message)
        window.location.reload()
      }
    } catch (error) {
      alert('恢复失败：' + (error as Error).message)
    }
  }
  
  const handleExportExcel = async () => {
    setExportingExcel(true)
    try {
      await exportToExcel()
    } catch (error) {
      alert('导出失败：' + (error as Error).message)
    } finally {
      setExportingExcel(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('zh-CN')
    } catch {
      return dateStr
    }
  }

  // 非Electron环境 - 仅显示导出Excel功能
  if (!window.electronAPI) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            数据管理
          </CardTitle>
          <CardDescription>
            数据导出功能
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-4">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">数据库备份功能仅在桌面应用中可用</span>
          </div>
          
          <Button variant="outline" onClick={handleExportExcel} disabled={exportingExcel}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            {exportingExcel ? '导出中...' : '导出数据为 Excel'}
          </Button>
          
          <p className="text-xs text-muted-foreground">
            导出的 Excel 文件包含学员信息、课堂记录、课程计划等多个工作表，可用于数据备份或迁移。
          </p>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">加载中...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {/* 数据库状态卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            数据库管理
          </CardTitle>
          <CardDescription>
            数据库版本管理与备份恢复
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 数据库版本信息 */}
          {dbStats && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <div className="text-xs text-muted-foreground">数据库版本</div>
                <div className="font-semibold text-lg">
                  v{dbStats.version}
                  {dbStats.version < dbStats.latestVersion && (
                    <span className="ml-2 text-xs text-orange-500">
                      (可升级到 v{dbStats.latestVersion})
                    </span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">数据库大小</div>
                <div className="font-semibold text-lg">{formatFileSize(dbStats.dbSize)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">学员数量</div>
                <div className="font-semibold">{dbStats.students}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">助教数量</div>
                <div className="font-semibold">{dbStats.teachers}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">课堂记录</div>
                <div className="font-semibold">{dbStats.classRecords}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">课程计划</div>
                <div className="font-semibold">{dbStats.lessonPlans}</div>
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={handleExportExcel} disabled={exportingExcel}>
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              {exportingExcel ? '导出中...' : '导出数据为 Excel'}
            </Button>
            <Button variant="outline" onClick={handleCreateBackup} disabled={creatingBackup}>
              <Download className="w-4 h-4 mr-2" />
              {creatingBackup ? '创建中...' : '创建备份'}
            </Button>
            <Button variant="outline" onClick={handleOpenBackupDir}>
              <FolderOpen className="w-4 h-4 mr-2" />
              打开备份目录
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowMigrationHistory(!showMigrationHistory)}
            >
              <History className="w-4 h-4 mr-2" />
              {showMigrationHistory ? '隐藏' : '查看'}迁移历史
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowBackupHistory(!showBackupHistory)}
            >
              <History className="w-4 h-4 mr-2" />
              {showBackupHistory ? '隐藏' : '查看'}备份历史
            </Button>
          </div>

          {/* 最后备份时间 */}
          {dbStats?.lastBackup && (
            <p className="text-xs text-muted-foreground">
              上次自动备份: {formatDate(dbStats.lastBackup)}
            </p>
          )}

          {/* 迁移历史 */}
          {showMigrationHistory && migrationHistory.length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="text-sm font-medium">迁移历史</h4>
              <div className="max-h-48 overflow-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">版本</th>
                      <th className="px-3 py-2 text-left">描述</th>
                      <th className="px-3 py-2 text-left">应用时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {migrationHistory.map((m) => (
                      <tr key={m.version} className="border-t">
                        <td className="px-3 py-2 font-mono">v{m.version}</td>
                        <td className="px-3 py-2">{m.description || '-'}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {formatDate(m.applied_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 备份历史 */}
          {showBackupHistory && backupHistory.length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="text-sm font-medium">备份历史</h4>
              <div className="max-h-48 overflow-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">类型</th>
                      <th className="px-3 py-2 text-left">大小</th>
                      <th className="px-3 py-2 text-left">创建时间</th>
                      <th className="px-3 py-2 text-left">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backupHistory.map((b) => (
                      <tr key={b.id} className="border-t">
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            b.backup_type === 'auto' 
                              ? 'bg-blue-100 text-blue-700' 
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {b.backup_type === 'auto' ? '自动' : '手动'}
                          </span>
                        </td>
                        <td className="px-3 py-2">{formatFileSize(b.file_size)}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {formatDate(b.created_at)}
                        </td>
                        <td className="px-3 py-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleRestoreBackup(b.backup_path)}
                          >
                            恢复
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            系统每日自动备份一次数据库，保留最近7天的自动备份。建议定期手动创建备份并保存到安全位置。
          </p>
        </CardContent>
      </Card>
    </>
  )
}

// 系统提示词编辑器组件
function SystemPromptEditor() {
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

// 词库分类选项
const WORDBANK_CATEGORY_OPTIONS: Array<{ value: WordbankCategory; label: string }> = [
  { value: 'textbook', label: '教材词库' },
  { value: 'primary_exam', label: '小学考试' },
  { value: 'primary_advanced', label: '小学拓展' },
  { value: 'junior_exam', label: '初中考试' },
  { value: 'junior_advanced', label: '初中拓展' },
  { value: 'senior_exam', label: '高中考试' },
  { value: 'senior_advanced', label: '高中拓展' },
  { value: 'college_cet4', label: '大学四级' },
]

// 词库管理组件
function WordbankManager() {
  const { wordbanks, loadWordbanks, updateWordbank, createWordbank, deleteWordbank } = useAppStore()
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
      alert('词库名称不能为空')
      return
    }
    if (editForm.total_levels < 1) {
      alert('总关数必须大于0')
      return
    }
    if (editForm.nine_grid_interval < 1) {
      alert('九宫格间隔必须大于0')
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
    if (!confirm(`确定要删除词库「${wb.name}」吗？\n\n⚠️ 警告：删除词库不会删除学员的词库进度记录，但进度记录中的词库名称可能不再匹配。`)) {
      return
    }
    await deleteWordbank(wb.id)
  }

  // 添加词库
  const handleAddWordbank = async () => {
    if (!newWordbank.name.trim()) {
      alert('请输入词库名称')
      return
    }
    if (isNaN(newWordbank.total_levels) || newWordbank.total_levels < 1) {
      alert('请输入有效的关数')
      return
    }
    if (isNaN(newWordbank.nine_grid_interval) || newWordbank.nine_grid_interval < 1) {
      alert('请输入有效的九宫格间隔')
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
      <div className="space-y-3">
        {/* 表头 */}
        <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground font-medium px-3 py-2 bg-muted/30 rounded">
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
          wordbanks.map((wb) => (
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
          ))
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
