/**
 * 数据库迁移系统 - 统一导出入口
 * 
 * 该模块将三个独立职责分离到专门的子模块：
 * - types.ts: 共享类型定义
 * - migrationRunner.ts: 迁移定义和执行
 * - walManager.ts: WAL Checkpoint 管理
 * - backupManager.ts: 备份管理
 * 
 * 此文件作为统一导出入口，保持向后兼容性。
 * 外部模块可以继续从 './migrations' 导入所有功能。
 */

// 导出类型定义
export {
  MigrationRecord,
  Migration,
  DatabaseStats,
  WalCheckpointResult,
  WalFileInfo,
  BackupHistoryRecord
} from './types'

// 导出迁移执行相关功能
export {
  migrations,
  runMigrations,
  getCurrentVersion,
  getMigrationHistory,
  hasPendingMigrations
} from './migrationRunner'

// 导出 WAL 管理相关功能
export {
  runWalCheckpoint,
  getWalFileInfo
} from './walManager'

// 导出备份管理相关功能
export {
  runAutoBackup,
  createManualBackup,
  restoreFromBackup,
  getBackupHistory,
  getDatabaseStats
} from './backupManager'