import { contextBridge, ipcRenderer } from 'electron'

// 暴露给渲染进程的API
contextBridge.exposeInMainWorld('electronAPI', {
  // 数据库操作
  dbQuery: (sql: string, params: unknown[] = []) => 
    ipcRenderer.invoke('db:query', sql, params),
  
  dbQueryOne: (sql: string, params: unknown[] = []) => 
    ipcRenderer.invoke('db:queryOne', sql, params),
  
  dbTransaction: (statements: Array<{ sql: string; params: unknown[] }>) => 
    ipcRenderer.invoke('db:transaction', statements),
  
  dbGetPath: () => 
    ipcRenderer.invoke('db:getPath'),
  
  dbBackup: (backupPath: string) => 
    ipcRenderer.invoke('db:backup', backupPath),

  // === 迁移和备份相关 API ===
  
  // 获取数据库版本信息
  dbGetVersion: () => 
    ipcRenderer.invoke('db:getVersion'),
  
  // 获取迁移历史
  dbGetMigrationHistory: () => 
    ipcRenderer.invoke('db:getMigrationHistory'),
  
  // 获取数据库统计信息
  dbGetStats: () => 
    ipcRenderer.invoke('db:getStats'),
  
  // 创建手动备份
  dbCreateBackup: (backupName?: string) => 
    ipcRenderer.invoke('db:createBackup', backupName),
  
  // 获取备份历史
  dbGetBackupHistory: (limit?: number) => 
    ipcRenderer.invoke('db:getBackupHistory', limit),
  
  // 从备份恢复
  dbRestoreFromBackup: (backupPath: string) => 
    ipcRenderer.invoke('db:restoreFromBackup', backupPath),
  
  // 获取备份目录路径
  dbGetBackupDir: () => 
    ipcRenderer.invoke('db:getBackupDir'),
  
  // 打开备份目录
  dbOpenBackupDir: () => 
    ipcRenderer.invoke('db:openBackupDir'),

  // 显示保存对话框
  showSaveDialog: (options: { title?: string; defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }) =>
    ipcRenderer.invoke('dialog:showSaveDialog', options),

  // 获取 WASM 文件路径
  getWasmPath: (filename: string) => 
    ipcRenderer.invoke('getWasmPath', filename),

  // 打印课程计划
  printLessonPlans: (htmlContent: string) => 
    ipcRenderer.invoke('print-lesson-plans', htmlContent),

  // 平台信息
  platform: process.platform,
  
  // 是否在Electron环境中
  isElectron: true,
})

// TypeScript类型声明
export interface ElectronAPI {
  // 基础数据库操作
  dbQuery: (sql: string, params?: unknown[]) => Promise<unknown>
  dbQueryOne: (sql: string, params?: unknown[]) => Promise<unknown>
  dbTransaction: (statements: Array<{ sql: string; params: unknown[] }>) => Promise<{ success: boolean }>
  dbGetPath: () => Promise<string>
  dbBackup: (backupPath: string) => Promise<{ success: boolean }>
  
  // 迁移和备份相关
  dbGetVersion: () => Promise<{ version: number; latestVersion: number }>
  dbGetMigrationHistory: () => Promise<Array<{ version: number; applied_at: string; description?: string }>>
  dbGetStats: () => Promise<{
    version: number
    students: number
    teachers: number
    classRecords: number
    lessonPlans: number
    dbSize: number
    lastBackup: string | null
  } | null>
  dbCreateBackup: (backupName?: string) => Promise<{ success: boolean; path: string }>
  dbGetBackupHistory: (limit?: number) => Promise<Array<{
    id: string
    backup_path: string
    backup_type: string
    file_size: number
    created_at: string
  }>>
  dbRestoreFromBackup: (backupPath: string) => Promise<{ success: boolean; message: string }>
  dbGetBackupDir: () => Promise<string>
  dbOpenBackupDir: () => Promise<{ success: boolean }>
  
  // 对话框
  showSaveDialog: (options: { title?: string; defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }) => 
    Promise<{ canceled: boolean; filePath?: string }>
  
  // 打印
  printLessonPlans: (htmlContent: string) => Promise<{ success: boolean; error?: string }>
  
  // 平台信息
  platform: string
  isElectron: boolean
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}