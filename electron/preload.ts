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

  // === WAL Checkpoint 相关 API ===
  
  // 获取 WAL 文件信息
  dbGetWalInfo: () => 
    ipcRenderer.invoke('db:getWalInfo'),
  
  // 执行 WAL checkpoint
  dbCheckpoint: (mode?: 'PASSIVE' | 'RESTART' | 'TRUNCATE' | 'FULL') => 
    ipcRenderer.invoke('db:checkpoint', mode),

  // 显示保存对话框
  showSaveDialog: (options: { title?: string; defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }) =>
    ipcRenderer.invoke('dialog:showSaveDialog', options),

  // 写入文件到指定路径
  writeFile: (filePath: string, base64Data: string) =>
    ipcRenderer.invoke('fs:writeFile', filePath, base64Data),

  // 打印课程计划
  printLessonPlans: (htmlContent: string) => 
    ipcRenderer.invoke('print-lesson-plans', htmlContent),

  // 平台信息
  platform: process.platform,
  
  // 是否在Electron环境中
  isElectron: true,
})

// 注意：ElectronAPI 类型定义已统一移至 src/types/index.ts
// Window 接口的扩展也在该文件中声明