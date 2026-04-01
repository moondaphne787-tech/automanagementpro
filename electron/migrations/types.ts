/**
 * 数据库迁移系统 - 共享类型定义
 */

import Database from 'better-sqlite3'

// 迁移版本信息接口
export interface MigrationRecord {
  version: number
  applied_at: string
  description: string | null
}

// 迁移定义接口
export interface Migration {
  version: number
  description: string
  up: (db: Database.Database) => void
  down?: (db: Database.Database) => void  // 可选的回滚脚本
}

// 数据库统计信息接口
export interface DatabaseStats {
  version: number
  latestVersion: number
  students: number
  teachers: number
  classRecords: number
  lessonPlans: number
  dbSize: number
  lastBackup: string | null
}

// WAL Checkpoint 结果接口
export interface WalCheckpointResult {
  success: boolean
  walSize: number
  checkpointedCount: number
  message: string
}

// WAL 文件信息接口
export interface WalFileInfo {
  exists: boolean
  size: number
  path: string
}

// 备份历史记录接口
export interface BackupHistoryRecord {
  id: string
  backup_path: string
  backup_type: string
  file_size: number
  created_at: string
}