import { useState, useEffect } from 'react'
import { Database, FolderOpen, History, AlertCircle, Download, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { settingsDb } from '@/db'
import { exportToExcel } from '@/utils/excelExport'

export function DatabaseManagementCard() {
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