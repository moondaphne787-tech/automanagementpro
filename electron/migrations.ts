/**
 * 数据库迁移管理系统
 * 
 * 功能：
 * - 版本管理：记录每个迁移版本的执行状态
 * - 自动迁移：应用启动时自动执行未应用的迁移
 * - 数据安全：每个迁移在事务中执行，失败时回滚
 * - 向后兼容：新版本可以读取旧版本数据
 */

import Database from 'better-sqlite3'
import * as fs from 'fs'
import * as path from 'path'

// 迁移版本信息接口
export interface MigrationRecord {
  version: number
  applied_at: string
  description?: string
}

// 迁移定义接口
export interface Migration {
  version: number
  description: string
  up: (db: Database.Database) => void
  down?: (db: Database.Database) => void  // 可选的回滚脚本
}

/**
 * 所有迁移定义列表
 * 每次数据库结构变更时，在此处添加新的迁移
 * 
 * 注意：
 * 1. 版本号必须连续递增
 * 2. 已发布的迁移不可修改（只能添加新迁移修复）
 * 3. 每个迁移应该是幂等的（可重复执行不产生副作用）
 */
export const migrations: Migration[] = [
  // ===== 版本 1: 初始化迁移系统 =====
  {
    version: 1,
    description: '初始化迁移系统，创建 schema_migrations 表',
    up: (db: Database.Database) => {
      // schema_migrations 表已经在 runMigrations 中创建
      // 此迁移仅作为版本起点，确保新安装的用户也有迁移记录
      console.log('Migration v1: Migration system initialized')
    }
  },
  
  // ===== 版本 2: 确保 settings 表有 updated_at 字段 =====
  {
    version: 2,
    description: '确保 settings 表有 updated_at 字段',
    up: (db: Database.Database) => {
      const info = db.prepare('PRAGMA table_info(settings)').all() as Array<{ name: string }>
      const columns = info.map(col => col.name)
      
      if (!columns.includes('updated_at')) {
        db.exec(`ALTER TABLE settings ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP`)
        console.log('Migration v2: Added updated_at column to settings table')
      }
    }
  },
  
  // ===== 版本 3: 添加数据库元信息表 =====
  {
    version: 3,
    description: '添加数据库元信息表 db_metadata',
    up: (db: Database.Database) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS db_metadata (
          key TEXT PRIMARY KEY,
          value TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `)
      
      // 插入数据库创建时间和版本信息
      const metaExists = db.prepare("SELECT value FROM db_metadata WHERE key = 'db_created_at'").get() as { value: string } | undefined
      if (!metaExists) {
        db.prepare("INSERT INTO db_metadata (key, value) VALUES ('db_created_at', datetime('now'))").run()
      }
      
      console.log('Migration v3: Added db_metadata table')
    }
  },
  
  // ===== 版本 4: 为 lesson_plans 表添加索引优化查询性能 =====
  {
    version: 4,
    description: '为 lesson_plans 表添加索引优化查询性能',
    up: (db: Database.Database) => {
      // 检查索引是否已存在
      const indexExists = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type = 'index' AND name = 'idx_lesson_plans_student_date'
      `).get()
      
      if (!indexExists) {
        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_lesson_plans_student_date 
          ON lesson_plans(student_id, plan_date DESC)
        `)
        console.log('Migration v4: Added index on lesson_plans(student_id, plan_date)')
      }
    }
  },
  
  // ===== 版本 5: 为 class_records 表添加索引优化查询性能 =====
  {
    version: 5,
    description: '为 class_records 表添加索引优化查询性能',
    up: (db: Database.Database) => {
      const indexExists = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type = 'index' AND name = 'idx_class_records_student_date'
      `).get()
      
      if (!indexExists) {
        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_class_records_student_date 
          ON class_records(student_id, class_date DESC)
        `)
        console.log('Migration v5: Added index on class_records(student_id, class_date)')
      }
    }
  },
  
  // ===== 版本 6: 为 scheduled_classes 表添加索引 =====
  {
    version: 6,
    description: '为 scheduled_classes 表添加索引优化查询性能',
    up: (db: Database.Database) => {
      const indexes = [
        'idx_scheduled_classes_date',
        'idx_scheduled_classes_teacher',
        'idx_scheduled_classes_student'
      ]
      
      indexes.forEach(indexName => {
        const exists = db.prepare(`
          SELECT name FROM sqlite_master 
          WHERE type = 'index' AND name = ?
        `).get(indexName)
        
        if (!exists) {
          let column = indexName.replace('idx_scheduled_classes_', '')
          if (column === 'date') column = 'class_date'
          if (column === 'teacher') column = 'teacher_id'
          if (column === 'student') column = 'student_id'
          db.exec(`CREATE INDEX IF NOT EXISTS ${indexName} ON scheduled_classes(${column})`)
        }
      })
      
      console.log('Migration v6: Added indexes on scheduled_classes table')
    }
  },
  
  // ===== 版本 7: 添加备份记录表 =====
  {
    version: 7,
    description: '添加备份记录表 backup_history',
    up: (db: Database.Database) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS backup_history (
          id TEXT PRIMARY KEY,
          backup_path TEXT NOT NULL,
          backup_type TEXT DEFAULT 'manual',
          file_size INTEGER,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `)
      console.log('Migration v7: Added backup_history table')
    }
  },
  
  // ===== 版本 8: 更新课时预警默认值为10 =====
  {
    version: 8,
    description: '更新所有学员的课时预警默认值为10',
    up: (db: Database.Database) => {
      // 将所有现有学员的课时预警更新为10
      db.exec(`UPDATE billing SET warning_threshold = 10 WHERE warning_threshold = 3`)
      console.log('Migration v8: Updated warning_threshold to 10 for all students')
    }
  },
  
  // ===== 后续迁移在此添加 =====
  // {
  //   version: 9,
  //   description: '描述此次迁移的目的',
  //   up: (db: Database.Database) => {
  //     // 迁移逻辑
  //   }
  // },
]

/**
 * 运行数据库迁移
 * @param db 数据库实例
 * @returns 返回已应用的迁移版本列表
 */
export function runMigrations(db: Database.Database): number[] {
  console.log('Starting database migrations...')
  
  // 1. 创建迁移版本记录表（如果不存在）
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT DEFAULT CURRENT_TIMESTAMP,
      description TEXT
    )
  `)
  
  // 2. 获取当前已应用的最高版本
  const result = db.prepare('SELECT MAX(version) as v FROM schema_migrations').get() as { v: number | null }
  const currentVersion = result?.v ?? 0
  
  console.log(`Current database version: ${currentVersion}`)
  console.log(`Target version: ${migrations[migrations.length - 1]?.version ?? 0}`)
  
  // 3. 获取已应用的版本列表
  const appliedVersions = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as Array<{ version: number }>
  const appliedSet = new Set(appliedVersions.map(v => v.version))
  
  // 4. 按顺序执行未应用的迁移
  const appliedInThisRun: number[] = []
  
  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      try {
        // 在事务中执行迁移
        const runMigration = db.transaction(() => {
          // 执行迁移逻辑
          migration.up(db)
          
          // 记录迁移版本
          db.prepare(`
            INSERT INTO schema_migrations (version, description) 
            VALUES (?, ?)
          `).run(migration.version, migration.description)
        })
        
        runMigration()
        
        appliedInThisRun.push(migration.version)
        console.log(`✓ Applied migration v${migration.version}: ${migration.description}`)
      } catch (error) {
        console.error(`✗ Failed to apply migration v${migration.version}:`, error)
        throw new Error(`Migration v${migration.version} failed: ${(error as Error).message}`)
      }
    }
  }
  
  if (appliedInThisRun.length === 0) {
    console.log('Database is up to date, no migrations applied.')
  } else {
    console.log(`Applied ${appliedInThisRun.length} migration(s): v${appliedInThisRun.join(', v')}`)
  }
  
  return appliedInThisRun
}

/**
 * 获取当前数据库版本
 * @param db 数据库实例
 * @returns 当前版本号，如果没有迁移记录则返回0
 */
export function getCurrentVersion(db: Database.Database): number {
  try {
    const result = db.prepare('SELECT MAX(version) as v FROM schema_migrations').get() as { v: number | null }
    return result?.v ?? 0
  } catch {
    return 0
  }
}

/**
 * 获取所有已应用的迁移记录
 * @param db 数据库实例
 * @returns 迁移记录列表
 */
export function getMigrationHistory(db: Database.Database): MigrationRecord[] {
  try {
    return db.prepare('SELECT version, applied_at, description FROM schema_migrations ORDER BY version').all() as MigrationRecord[]
  } catch {
    return []
  }
}

/**
 * 检查是否需要迁移
 * @param db 数据库实例
 * @returns 是否有待应用的迁移
 */
export function hasPendingMigrations(db: Database.Database): boolean {
  const currentVersion = getCurrentVersion(db)
  const latestVersion = migrations[migrations.length - 1]?.version ?? 0
  return currentVersion < latestVersion
}

/**
 * 自动备份功能
 * 在应用启动时检查并执行每日自动备份
 * @param db 数据库实例
 * @param dbPath 数据库文件路径
 */
export function runAutoBackup(db: Database.Database, dbPath: string): void {
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
    db.backup(backupPath)
    
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
export function createManualBackup(db: Database.Database, dbPath: string, backupName?: string): string {
  const backupDir = path.join(path.dirname(dbPath), 'backups')
  
  // 确保备份目录存在
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').slice(0, 19)
  const fileName = backupName 
    ? `manual_backup_${backupName}_${timestamp}.db`
    : `manual_backup_${timestamp}.db`
  const backupPath = path.join(backupDir, fileName)
  
  // 执行备份
  db.backup(backupPath)
  
  // 记录备份历史
  const stats = fs.statSync(backupPath)
  const backupId = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  db.prepare(`
    INSERT INTO backup_history (id, backup_path, backup_type, file_size) 
    VALUES (?, ?, 'manual', ?)
  `).run(backupId, backupPath, stats.size)
  
  console.log('✓ Manual backup created:', backupPath)
  
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
export function getBackupHistory(db: Database.Database, limit: number = 20): Array<{
  id: string
  backup_path: string
  backup_type: string
  file_size: number
  created_at: string
}> {
  try {
    return db.prepare(`
      SELECT id, backup_path, backup_type, file_size, created_at 
      FROM backup_history 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(limit) as Array<{
      id: string
      backup_path: string
      backup_type: string
      file_size: number
      created_at: string
    }>
  } catch {
    return []
  }
}

/**
 * 获取数据库统计信息
 * @param db 数据库实例
 * @returns 数据库统计信息
 */
export function getDatabaseStats(db: Database.Database): {
  version: number
  latestVersion: number
  students: number
  teachers: number
  classRecords: number
  lessonPlans: number
  dbSize: number
  lastBackup: string | null
} {
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
