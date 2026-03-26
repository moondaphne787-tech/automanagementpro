// 数据库工具函数
import type { TaskBlock } from '@/types'

/**
 * 解析 tasks 字段，确保返回 TaskBlock[]
 * 统一处理数据库中存储为 JSON 字符串的情况
 * @param tasks - 可能是字符串或 TaskBlock[]
 * @returns TaskBlock[]
 */
export function parseTasks(tasks: TaskBlock[] | string | null | undefined): TaskBlock[] {
  if (!tasks) return []
  if (typeof tasks === 'string') {
    try {
      const parsed = JSON.parse(tasks)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      console.warn('[parseTasks] JSON 解析失败:', tasks)
      return []
    }
  }
  return Array.isArray(tasks) ? tasks : []
}


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

// 生成唯一 ID - 使用 crypto.randomUUID() 统一为 UUID v4 格式
// 现代 Electron/Chromium 原生支持 crypto.randomUUID()
export function generateId(): string {
  return crypto.randomUUID()
}

/**
 * 带重试机制的 IPC 数据库查询
 * @param sql SQL 查询语句
 * @param params 查询参数
 * @param retries 重试次数，默认 2 次
 * @returns 查询结果
 * @throws 当重试次数用尽后仍然失败时抛出错误
 */
export async function ipcQuery<T>(sql: string, params: unknown[] = [], retries = 2): Promise<T> {
  if (!window.electronAPI) throw new Error('Electron API not available')
  
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await window.electronAPI.dbQuery(sql, params) as Promise<T>
    } catch (error) {
      lastError = error as Error
      console.warn(`[ipcQuery] 第 ${attempt + 1} 次查询失败:`, error)
      
      // 如果还有重试机会，等待一段时间后重试
      if (attempt < retries) {
        const delay = 100 * (attempt + 1)
        console.log(`[ipcQuery] 将在 ${delay}ms 后重试...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  // 所有重试都失败后，抛出最后一个错误
  throw new Error(`数据库查询失败（已重试 ${retries} 次）: ${lastError?.message || '未知错误'}`)
}

/**
 * 带重试机制的 IPC 单条记录查询
 * @param sql SQL 查询语句
 * @param params 查询参数
 * @param retries 重试次数，默认 2 次
 * @returns 查询结果或 undefined
 * @throws 当重试次数用尽后仍然失败时抛出错误
 */
export async function ipcQueryOne<T>(sql: string, params: unknown[] = [], retries = 2): Promise<T | undefined> {
  if (!window.electronAPI) throw new Error('Electron API not available')
  
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await window.electronAPI.dbQueryOne(sql, params) as Promise<T | undefined>
    } catch (error) {
      lastError = error as Error
      console.warn(`[ipcQueryOne] 第 ${attempt + 1} 次查询失败:`, error)
      
      // 如果还有重试机会，等待一段时间后重试
      if (attempt < retries) {
        const delay = 100 * (attempt + 1)
        console.log(`[ipcQueryOne] 将在 ${delay}ms 后重试...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  // 所有重试都失败后，抛出最后一个错误
  throw new Error(`数据库查询失败（已重试 ${retries} 次）: ${lastError?.message || '未知错误'}`)
}
