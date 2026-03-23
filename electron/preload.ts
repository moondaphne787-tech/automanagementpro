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
  dbQuery: (sql: string, params?: unknown[]) => Promise<unknown>
  dbQueryOne: (sql: string, params?: unknown[]) => Promise<unknown>
  dbTransaction: (statements: Array<{ sql: string; params: unknown[] }>) => Promise<{ success: boolean }>
  dbGetPath: () => Promise<string>
  dbBackup: (backupPath: string) => Promise<{ success: boolean }>
  printLessonPlans: (htmlContent: string) => Promise<{ success: boolean; error?: string }>
  platform: string
  isElectron: boolean
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}