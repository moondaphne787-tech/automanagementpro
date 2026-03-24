// 数据库工具函数

// 初始化数据库 - 在 Electron 中由主进程处理
export async function initDatabase(): Promise<void> {
  // 检查是否在 Electron 环境中
  const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron
  
  console.log('initDatabase called, isElectron:', isElectron)
  console.log('window.electronAPI:', window.electronAPI)
  
  if (isElectron) {
    // Electron 环境中，数据库在主进程初始化
    // 测试 IPC 通信是否正常
    try {
      const dbPath = await window.electronAPI!.dbGetPath()
      console.log('Database path:', dbPath)
      console.log('Using Electron main process database (better-sqlite3)')
      return
    } catch (error) {
      console.error('Failed to connect to main process database:', error)
      throw new Error('无法连接到主进程数据库: ' + (error as Error).message)
    }
  }
  
  // 非 Electron 环境（浏览器）暂不支持
  throw new Error('此应用需要 Electron 环境运行，请使用桌面应用版本。')
}

// 生成唯一 ID
export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// IPC 调用包装
export async function ipcQuery<T>(sql: string, params: unknown[] = []): Promise<T> {
  if (!window.electronAPI) throw new Error('Electron API not available')
  return window.electronAPI.dbQuery(sql, params) as Promise<T>
}

export async function ipcQueryOne<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  if (!window.electronAPI) throw new Error('Electron API not available')
  return window.electronAPI.dbQueryOne(sql, params) as Promise<T | undefined>
}