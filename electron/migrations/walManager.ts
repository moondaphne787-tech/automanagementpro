/**
 * WAL (Write-Ahead Logging) 管理模块
 * 
 * 功能：
 * - WAL Checkpoint 操作：将 WAL 文件中的更改合并回主数据库文件
 * - WAL 文件信息查询：获取 WAL 文件大小和状态
 */

import Database from 'better-sqlite3'
import * as fs from 'fs'
import { WalCheckpointResult, WalFileInfo } from './types'

/**
 * 执行 WAL checkpoint 操作
 * 将 WAL 文件中的更改合并回主数据库文件，减少 WAL 文件大小
 * @param db 数据库实例
 * @param mode checkpoint 模式：'PASSIVE' | 'RESTART' | 'TRUNCATE' | 'FULL'
 * @returns checkpoint 结果信息
 */
export function runWalCheckpoint(
  db: Database.Database, 
  mode: 'PASSIVE' | 'RESTART' | 'TRUNCATE' | 'FULL' = 'TRUNCATE'
): WalCheckpointResult {
  try {
    // 执行 WAL checkpoint
    // PASSIVE: 不阻塞写入，尽可能多地 checkpoint
    // RESTART: 阻塞写入，确保所有 WAL 内容被 checkpoint
    // TRUNCATE: 类似 RESTART，但会将 WAL 文件截断为 0 字节
    // FULL: 类似 RESTART，但不会截断 WAL 文件
    const result = db.pragma(`wal_checkpoint(${mode})`) as Array<{ checkpoint: number; busy: number; log: number; checkpointed: number }>
    
    const checkpointInfo = result[0]
    
    // log: WAL 文件中的总页数
    // checkpointed: 已 checkpoint 的页数
    const walPages = checkpointInfo?.log ?? 0
    const checkpointedPages = checkpointInfo?.checkpointed ?? 0
    
    // 计算预估的 WAL 文件大小（每页约 4KB）
    const estimatedWalSizeKB = walPages * 4
    
    console.log(`WAL checkpoint completed (${mode}): ${checkpointedPages}/${walPages} pages checkpointed`)
    
    return {
      success: true,
      walSize: estimatedWalSizeKB,
      checkpointedCount: checkpointedPages,
      message: `Checkpoint 完成，处理了 ${checkpointedPages} 页，WAL 文件约 ${estimatedWalSizeKB} KB`
    }
  } catch (error) {
    console.error('WAL checkpoint failed:', error)
    return {
      success: false,
      walSize: 0,
      checkpointedCount: 0,
      message: `Checkpoint 失败: ${(error as Error).message}`
    }
  }
}

/**
 * 获取 WAL 文件信息
 * @param dbPath 数据库文件路径
 * @returns WAL 文件信息
 */
export function getWalFileInfo(dbPath: string): WalFileInfo {
  const walPath = `${dbPath}-wal`
  const shmPath = `${dbPath}-shm`
  
  try {
    let walSize = 0
    let walExists = false
    
    if (fs.existsSync(walPath)) {
      walExists = true
      const stats = fs.statSync(walPath)
      walSize = stats.size
    }
    
    return {
      exists: walExists,
      size: walSize,
      path: walPath
    }
  } catch (error) {
    console.error('Failed to get WAL file info:', error)
    return {
      exists: false,
      size: 0,
      path: walPath
    }
  }
}