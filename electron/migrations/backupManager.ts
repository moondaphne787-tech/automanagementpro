/**
 * 数据库备份管理模块
 * 
 * 功能：
 * - 自动备份：应用启动时检查并执行每日自动备份
 * - 手动备份：用户主动创建备份文件
 * - 备份恢复：从备份文件恢复数据库
 * - 备份历史：记录和管理备份历史
 * - 数据库统计：获取数据库基本信息和统计
 */

import Database from 'better-sqlite3'
import * as fs from 'fs'
import * as path from 'path'
import { DatabaseStats, BackupHistoryRecord } from './types'
import { getCurrentVersion, migrations } from './migrationRunner'
import { runWalCheckpoint } from './walManager'

/**
 * 自动备份功能
 * 在应用启动时检查并执行每日自动备份
 * @param db 数据库实例
 * @param dbPath 数据库文件路径
 */
export async function runAutoBackup(db: Database.Database, dbPath: string): Promise<void> {
  const backupDir = path.join(path.dirname(dbPath), 'backups')
  
  // 确保备份目录存在
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }
  
  const today = new Date().toISOString().split('T')[0]
  
  // 检查今天是否已备份
  const lastBackup = db.prepare("SELECT value FROM settings WHERE key = 'last_auto_backup'").get() as { value: string } | undefined
  
  if (lastBackup?.value === today) {
    console.log('Auto backup already completed today, skipping.')
    return
  }
  
  try {
    // 执行备份
    const backupFileName = `auto_backup_${today}.db`
    const backupPath = path.join(backupDir, backupFileName)
    
    // 如果今天的备份文件已存在，跳过
    if (fs.existsSync(backupPath)) {
      console.log('Backup file already exists for today:', backupPath)
      
      // 更新设置中的备份日期
      db.prepare(`
        INSERT OR REPLACE INTO settings (key, value, updated_at) 
        VALUES ('last_auto_backup', ?, datetime('now'))
      `).run(today)
      
      return
    }
    
    // 执行数据库备份
    await db.backup(backupPath)
    
    // 记录备份历史
    const stats = fs.statSync(backupPath)
    const backupId = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    db.prepare(`
      INSERT INTO backup_history (id, backup_path, backup_type, file_size) 
      VALUES (?, ?, 'auto', ?)
    `).run(backupId, backupPath, stats.size)
    
    // 更新设置中的备份日期
    db.prepare(`
      INSERT OR REPLACE INTO settings (key, value, updated_at) 
      VALUES ('last_auto_backup', ?, datetime('now'))
    `).run(today)
    
    console.log('✓ Auto backup completed:', backupPath)
    
    // 清理旧的自动备份（只保留最近7个）
    cleanupOldBackups(db, backupDir, 7)
    
    // 执行 WAL checkpoint，减少 WAL 文件大小
    const checkpointResult = runWalCheckpoint(db, 'TRUNCATE')
    if (checkpointResult.success) {
      console.log('✓ WAL checkpoint completed after backup:', checkpointResult.message)
    } else {
      console.warn('WAL checkpoint warning:', checkpointResult.message)
    }
    
  } catch (error) {
    console.error('Auto backup failed:', error)
    // 备份失败不阻塞应用启动
  }
}

/**
 * 清理旧的自动备份文件
 * @param db 数据库实例
 * @param backupDir 备份目录
 * @param keepCount 保留的备份数量
 */
function cleanupOldBackups(db: Database.Database, backupDir: string, keepCount: number): void {
  try {
    // 获取所有自动备份文件
    const backupFiles = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('auto_backup_') && f.endsWith('.db'))
      .sort()  // 按文件名排序（日期格式保证顺序正确）
    
    // 如果备份数量超过保留数量，删除最旧的
    if (backupFiles.length > keepCount) {
      const filesToDelete = backupFiles.slice(0, backupFiles.length - keepCount)
      
      for (const file of filesToDelete) {
        const filePath = path.join(backupDir, file)
        fs.unlinkSync(filePath)
        console.log('Deleted old backup:', file)
        
        // 从备份历史表中删除记录
        db.prepare('DELETE FROM backup_history WHERE backup_path = ?').run(filePath)
      }
    }
  } catch (error) {
    console.error('Failed to cleanup old backups:', error)
  }
}

/**
 * 手动创建备份
 * @param db 数据库实例
 * @param dbPath 数据库文件路径
 * @param backupName 备份名称（可选）
 * @returns 备份文件路径
 */
export async function createManualBackup(db: Database.Database, dbPath: string, backupName?: string): Promise<string> {
  const backupDir = path.join(path.dirname(dbPath), 'backups')
  
  // 确保备份目录存在
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
    console.log('Created backup directory:', backupDir)
  }
  
  // 验证备份目录是否可写
  try {
    const testFile = path.join(backupDir, '.write_test')
    fs.writeFileSync(testFile, 'test')
    fs.unlinkSync(testFile)
    console.log('Backup directory is writable:', backupDir)
  } catch (writeError) {
    console.error('Backup directory is not writable:', writeError)
    throw new Error(`备份目录无法写入: ${backupDir}`)
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').slice(0, 19)
  const fileName = backupName 
    ? `manual_backup_${backupName}_${timestamp}.db`
    : `manual_backup_${timestamp}.db`
  const backupPath = path.join(backupDir, fileName)
  
  console.log('Database path:', dbPath)
  console.log('Backup path:', backupPath)
  console.log('Database file exists:', fs.existsSync(dbPath))
  
  // 验证源数据库文件存在
  if (!fs.existsSync(dbPath)) {
    throw new Error(`源数据库文件不存在: ${dbPath}`)
  }
  
  // 获取数据库文件大小
  const dbStats = fs.statSync(dbPath)
  console.log('Source database size:', dbStats.size, 'bytes')
  
  console.log('Attempting to backup database...')
  try {
    await db.backup(backupPath)
    console.log('Database backup completed successfully')
  } catch (backupError) {
    console.error('Database backup operation threw error:', backupError)
    throw backupError
  }

  const fileExists = fs.existsSync(backupPath)
  
  // 验证备份文件是否成功创建
  if (!fileExists) {
    // 尝试使用文件复制方式备份作为备选方案
    console.log('db.backup() did not create file, trying file copy fallback...')
    try {
      fs.copyFileSync(dbPath, backupPath)
      console.log('File copy fallback succeeded')
    } catch (copyError) {
      console.error('File copy fallback failed:', copyError)
      throw new Error(`备份失败：db.backup() 未创建文件，且文件复制也失败。路径: ${backupPath}`)
    }
  }
  
  // 再次验证
  if (!fs.existsSync(backupPath)) {
    throw new Error(`备份文件创建失败：文件不存在 ${backupPath}`)
  }
  
  // 记录备份历史
  const stats = fs.statSync(backupPath)
  const backupId = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  console.log('Backup file size:', stats.size, 'bytes')
  
  try {
    db.prepare(`
      INSERT INTO backup_history (id, backup_path, backup_type, file_size) 
      VALUES (?, ?, 'manual', ?)
    `).run(backupId, backupPath, stats.size)
  } catch (historyError) {
    console.warn('Failed to record backup history:', historyError)
    // 备份历史记录失败不影响备份本身
  }
  
  console.log('✓ Manual backup created successfully:', backupPath)
  
  return backupPath
}

/**
 * 从备份恢复数据库
 * 注意：此操作会关闭当前数据库连接并替换数据库文件
 * @param dbPath 数据库文件路径
 * @param backupPath 备份文件路径
 * @returns 是否成功
 */
export function restoreFromBackup(dbPath: string, backupPath: string): boolean {
  try {
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`)
    }
    
    // 复制备份文件到数据库路径
    fs.copyFileSync(backupPath, dbPath)
    
    console.log('✓ Database restored from backup:', backupPath)
    return true
  } catch (error) {
    console.error('Failed to restore from backup:', error)
    return false
  }
}

/**
 * 获取备份历史记录
 * @param db 数据库实例
 * @param limit 返回数量限制
 * @returns 备份记录列表
 */
export function getBackupHistory(db: Database.Database, limit: number = 20): BackupHistoryRecord[] {
  try {
    return db.prepare(`
      SELECT id, backup_path, backup_type, file_size, created_at 
      FROM backup_history 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(limit) as BackupHistoryRecord[]
  } catch {
    return []
  }
}

/**
 * 获取数据库统计信息
 * @param db 数据库实例
 * @returns 数据库统计信息
 */
export function getDatabaseStats(db: Database.Database): DatabaseStats {
  try {
    const version = getCurrentVersion(db)
    const latestVersion = migrations[migrations.length - 1]?.version ?? 0
    
    const studentsCount = db.prepare('SELECT COUNT(*) as count FROM students').get() as { count: number }
    const teachersCount = db.prepare('SELECT COUNT(*) as count FROM teachers').get() as { count: number }
    const classRecordsCount = db.prepare('SELECT COUNT(*) as count FROM class_records').get() as { count: number }
    const lessonPlansCount = db.prepare('SELECT COUNT(*) as count FROM lesson_plans').get() as { count: number }
    
    const lastBackup = db.prepare(`
      SELECT created_at FROM backup_history 
      WHERE backup_type = 'auto' 
      ORDER BY created_at DESC 
      LIMIT 1
    `).get() as { created_at: string } | undefined
    
    return {
      version,
      latestVersion,
      students: studentsCount.count,
      teachers: teachersCount.count,
      classRecords: classRecordsCount.count,
      lessonPlans: lessonPlansCount.count,
      dbSize: 0,  // 需要在主进程中获取文件大小
      lastBackup: lastBackup?.created_at ?? null
    }
  } catch (error) {
    console.error('Failed to get database stats:', error)
    return {
      version: 0,
      latestVersion: 0,
      students: 0,
      teachers: 0,
      classRecords: 0,
      lessonPlans: 0,
      dbSize: 0,
      lastBackup: null
    }
  }
}