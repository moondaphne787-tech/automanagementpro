import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import path from 'path'
import Database from 'better-sqlite3'
import * as fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import {
  runMigrations,
  runAutoBackup,
  createManualBackup,
  restoreFromBackup,
  getBackupHistory,
  getMigrationHistory,
  getCurrentVersion,
  getDatabaseStats,
  getWalFileInfo,
  runWalCheckpoint,
  migrations
} from './migrations'

let mainWindow: BrowserWindow | null = null
let db: Database.Database | null = null

// 数据库文件路径
const dbPath = path.join(app.getPath('documents'), 'EduManager', 'edumanager.db')

// 初始化数据库
async function initDatabase() {
  try {
    const dbDir = path.dirname(dbPath)
    // 确保目录存在
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true })
    }
    
    console.log('Attempting to open database at:', dbPath)
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    console.log('Database opened successfully')
    
    // 创建基础表（保持向后兼容）
    createTables()
    
    // 运行数据库迁移系统
    if (db) {
      try {
        const appliedMigrations = runMigrations(db)
        if (appliedMigrations.length > 0) {
          console.log(`Database migrated to version ${getCurrentVersion(db)}`)
        }
      } catch (migrationError) {
        console.error('Migration error:', migrationError)
        // 迁移失败时显示警告但不阻止应用启动
        dialog.showMessageBox(mainWindow!, {
          type: 'warning',
          title: '数据库迁移警告',
          message: '数据库迁移过程中出现部分问题，部分功能可能受影响。',
          detail: `错误信息: ${(migrationError as Error).message}`
        })
      }
      
      // 执行自动备份
      try {
        await runAutoBackup(db, dbPath)
      } catch (backupError) {
        console.error('Auto backup error:', backupError)
        // 备份失败不阻塞应用
      }
    }
    
    // 记录数据库版本信息
    console.log(`Database initialized. Current version: ${db ? getCurrentVersion(db) : 'unknown'}`)
    
  } catch (error) {
    console.error('Failed to initialize database:', error)
    // 显示错误对话框
    dialog.showErrorBox('数据库初始化失败', 
      `无法初始化数据库，应用可能无法正常工作。\n\n错误信息: ${(error as Error).message}\n\n数据库路径: ${dbPath}`)
    // 仍然继续运行，但数据库操作会失败
  }
}

/**
 * 创建数据库基础表结构（v0 基线）
 * 
 * ⚠️ 重要说明：
 * 此函数仅用于新安装用户的初始化建表，定义的是 v0 版本的基础表结构。
 * 
 * 【字段演进原则】
 * - 所有后续字段变更（ADD COLUMN、字段类型修改等）必须在迁移系统中维护
 * - 迁移文件位置：electron/migrations/migrationRunner.ts
 * - 不要在此函数中添加新字段，只需添加迁移版本即可
 * 
 * 【为什么这样设计？】
 * - 已有用户通过迁移系统获取新字段
 * - 新安装用户通过此函数获取基础表，然后通过迁移系统应用到最新版本
 * - 避免双重维护导致的不一致风险
 * 
 * 【示例】
 * 假设需要为 students 表添加 reading_progress 字段：
 * ❌ 错误：在此函数的 CREATE TABLE 中添加 reading_progress TEXT
 * ✅ 正确：在 migrationRunner.ts 中添加新迁移版本，使用 ALTER TABLE 添加字段
 * 
 * @see electron/migrations/migrationRunner.ts 迁移系统
 */
function createTables() {
  if (!db) return

  // 学员表
  // 注：reading_progress 字段由迁移 v12 添加，此处不重复定义
  db.exec(`
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      student_no TEXT UNIQUE,
      name TEXT NOT NULL,
      school TEXT,
      grade TEXT,
      account TEXT,
      enroll_date TEXT,
      student_type TEXT DEFAULT 'formal',
      status TEXT DEFAULT 'active',
      level TEXT DEFAULT 'medium',
      initial_score INTEGER,
      initial_vocab INTEGER,
      phonics_progress TEXT,
      phonics_completed INTEGER DEFAULT 0,
      ipa_completed INTEGER DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 课时与收费表
  db.exec(`
    CREATE TABLE IF NOT EXISTS billing (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      total_hours REAL DEFAULT 0,
      used_hours REAL DEFAULT 0,
      warning_threshold REAL DEFAULT 10,
      last_payment_date TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    )
  `)
  // 注：ALTER TABLE 逻辑已迁移到迁移系统 (v9)

  // 词库配置表
  db.exec(`
    CREATE TABLE IF NOT EXISTS wordbanks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      total_levels INTEGER DEFAULT 60,
      category TEXT DEFAULT 'primary_exam',
      sort_order INTEGER DEFAULT 0,
      notes TEXT
    )
  `)

  // 学生词库进度表
  db.exec(`
    CREATE TABLE IF NOT EXISTS student_wordbank_progress (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      wordbank_id TEXT NOT NULL,
      wordbank_label TEXT,
      current_level INTEGER DEFAULT 0,
      total_levels_override INTEGER,
      status TEXT DEFAULT 'active',
      started_date TEXT,
      completed_date TEXT,
      source TEXT DEFAULT 'manual',
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (wordbank_id) REFERENCES wordbanks(id) ON DELETE CASCADE,
      UNIQUE(student_id, wordbank_id)
    )
  `)
  // 注：ALTER TABLE 逻辑已迁移到迁移系统 (v9)

  // 课堂记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS class_records (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      class_date TEXT NOT NULL,
      duration_hours REAL DEFAULT 1,
      teacher_name TEXT,
      attendance TEXT DEFAULT 'present',
      tasks TEXT,
      task_completed TEXT DEFAULT 'completed',
      incomplete_reason TEXT,
      performance TEXT DEFAULT 'good',
      detail_feedback TEXT,
      highlights TEXT,
      issues TEXT,
      checkin_completed INTEGER DEFAULT 0,
      phase_id TEXT,
      plan_id TEXT,
      imported_from_excel INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    )
  `)
  // 注：ALTER TABLE 逻辑已迁移到迁移系统 (v9)

  // 课程计划表
  db.exec(`
    CREATE TABLE IF NOT EXISTS lesson_plans (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      phase_id TEXT,
      plan_date TEXT,
      tasks TEXT,
      notes TEXT,
      ai_reason TEXT,
      generated_by_ai INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    )
  `)

  // 考试成绩表
  db.exec(`
    CREATE TABLE IF NOT EXISTS exam_scores (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      exam_date TEXT NOT NULL,
      exam_name TEXT,
      exam_type TEXT DEFAULT 'school_exam',
      score INTEGER,
      full_score INTEGER DEFAULT 100,
      notes TEXT,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    )
  `)

  // 学习阶段表
  db.exec(`
    CREATE TABLE IF NOT EXISTS learning_phases (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      phase_name TEXT,
      phase_type TEXT DEFAULT 'semester',
      start_date TEXT,
      end_date TEXT,
      goal TEXT,
      vocab_start INTEGER,
      vocab_end INTEGER,
      summary TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    )
  `)

  // 体验生成交记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS trial_conversions (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      trial_date TEXT,
      conversion_date TEXT,
      converted INTEGER DEFAULT 0,
      commission_note TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    )
  `)

  // 助教档案表
  db.exec(`
    CREATE TABLE IF NOT EXISTS teachers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      university TEXT,
      major TEXT,
      enroll_date TEXT,
      status TEXT DEFAULT 'active',
      vocab_level TEXT,
      oral_level TEXT DEFAULT 'intermediate',
      teaching_style TEXT,
      suitable_grades TEXT,
      suitable_levels TEXT,
      training_stage TEXT DEFAULT 'probation',
      teacher_types TEXT DEFAULT '[]',
      total_teaching_hours REAL DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)
  // 注：ALTER TABLE 逻辑已迁移到迁移系统 (v9)

  // 老师可用时段表
  db.exec(`
    CREATE TABLE IF NOT EXISTS teacher_availability (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL,
      week_start TEXT,
      day_of_week TEXT,
      start_time TEXT,
      end_time TEXT,
      notes TEXT,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
    )
  `)

  // 学生固定时段偏好表
  db.exec(`
    CREATE TABLE IF NOT EXISTS student_schedule_preferences (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      day_of_week TEXT,
      preferred_start TEXT,
      preferred_end TEXT,
      semester TEXT,
      notes TEXT,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    )
  `)

  // 课表
  db.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_classes (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      teacher_id TEXT,
      class_date TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      duration_hours REAL DEFAULT 1,
      status TEXT DEFAULT 'scheduled',
      rescheduled_from_id TEXT,
      cancel_reason TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL
    )
  `)

  // 排课时段配置表（用于区分平时/假期等不同时段的学员偏好）
  db.exec(`
    CREATE TABLE IF NOT EXISTS schedule_periods (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 系统设置表
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 待办事项表
  // 注：student_name 字段已移除，通过 JOIN 查询从 students 表获取最新姓名
  db.exec(`
    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      student_id TEXT,
      due_date TEXT,
      completed INTEGER DEFAULT 0,
      completed_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL
    )
  `)

  // 朗读打卡表
  db.exec(`
    CREATE TABLE IF NOT EXISTS reading_checkins (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      checked_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      UNIQUE(student_id, checked_date)
    )
  `)

  // 任务类型预设模板
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_presets (
      id TEXT PRIMARY KEY,
      task_type TEXT NOT NULL,
      label TEXT NOT NULL,
      content TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 课程设计模板库
  db.exec(`
    CREATE TABLE IF NOT EXISTS plan_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      tasks TEXT NOT NULL,
      notes TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 插入默认课程模板
  const planTemplatesCount = db.prepare('SELECT COUNT(*) as count FROM plan_templates').get() as { count: number }
  if (planTemplatesCount.count === 0) {
    const insertTemplate = db.prepare(`
      INSERT INTO plan_templates (id, name, category, tasks, notes, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `)
    const defaultTemplates: [string, string, string, string, number][] = [
      ['通用模板：词汇复习+新词+课文', 'general',
        JSON.stringify([
          { type: 'vocab_review', content: '复习上节课词库内容' },
          { type: 'vocab_new', content: '新词学习 5 个' },
          { type: 'textbook', content: '课文梳理与朗读' },
        ]),
        '常规课程：复习→新授→课文', 1],
      ['通用模板：阅读+练习', 'general',
        JSON.stringify([
          { type: 'vocab_review', content: '词库复习前2关' },
          { type: 'reading', content: '阅读训练 1 篇' },
          { type: 'exercise', content: '配套练习册' },
        ]),
        '阅读专项课程', 2],
      ['拼读模板：语音+词汇+绘本', 'phonics',
        JSON.stringify([
          { type: 'phonics', content: '自然拼读规则学习' },
          { type: 'vocab_review', content: '拼读相关词汇复习' },
          { type: 'picture_book', content: '绘本阅读 1 本' },
        ]),
        '拼读入门课程', 1],
      ['拼读模板：强化练习', 'phonics',
        JSON.stringify([
          { type: 'phonics', content: '拼读规则复习与强化' },
          { type: 'exercise', content: '拼读专项练习' },
          { type: 'picture_book', content: '拼读绘本自主阅读' },
        ]),
        '拼读强化课程', 2],
    ]
    defaultTemplates.forEach(([name, category, tasks, notes, order]) => {
      insertTemplate.run(uuidv4(), name, category, tasks, notes, order)
    })
  }

  // 插入默认词库配置
  const wordbanksCount = db.prepare('SELECT COUNT(*) as count FROM wordbanks').get() as { count: number }
  if (wordbanksCount.count === 0) {
    const insertWordbank = db.prepare(`
      INSERT INTO wordbanks (id, name, total_levels, category, sort_order) 
      VALUES (?, ?, ?, ?, ?)
    `)
    
    const defaultWordbanks = [
      ['小学考纲', 60, 'primary_exam', 1],
      ['小学进阶', 40, 'primary_advanced', 2],
      ['初中考纲', 60, 'junior_exam', 3],
      ['初中进阶', 40, 'junior_advanced', 4],
      ['高中考纲', 60, 'senior_exam', 5],
      ['高中进阶', 40, 'senior_advanced', 6],
      ['大学四级', 40, 'college_cet4', 7],
    ]
    
    defaultWordbanks.forEach(([name, total, category, order]) => {
      insertWordbank.run(uuidv4(), name, total, category, order)
    })
  }

  // 插入默认设置
  const settingsCount = db.prepare('SELECT COUNT(*) as count FROM settings').get() as { count: number }
  if (settingsCount.count === 0) {
    const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)')
    insertSetting.run('ai_api_url', 'https://api.deepseek.com/v1')
    insertSetting.run('ai_model', 'deepseek-chat')
    insertSetting.run('ai_temperature', '0.7')
    insertSetting.run('ai_max_tokens', '2048')
  }
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 }
  })

  // 开发环境加载本地服务器
  // 使用 process.defaultApp 或检查是否在 asar 包内来判断环境
  const isDev = !app.isPackaged
  
  if (isDev) {
    // 尝试多个可能的端口（Vite 可能因为端口占用而自动切换）
    const ports = [5173, 5174, 5175, 5176, 5177]
    let loaded = false
    
    for (const port of ports) {
      try {
        await mainWindow.loadURL(`http://localhost:${port}`)
        console.log(`Successfully loaded from port ${port}`)
        loaded = true
        break
      } catch (err) {
        console.log(`Port ${port} not available, trying next...`)
      }
    }
    
    if (!loaded) {
      // 如果所有端口都失败，使用默认端口
      await mainWindow.loadURL('http://localhost:5173')
    }
    
    mainWindow.webContents.openDevTools()
  } else {
    // 生产环境：加载打包后的文件
    const indexPath = path.join(__dirname, '../dist/index.html')
    console.log('Loading index from:', indexPath)
    mainWindow.loadFile(indexPath).catch(err => {
      console.error('Failed to load index.html:', err)
    })
    // 生产环境也可以通过快捷键打开 DevTools 调试
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12' || (input.control && input.shift && input.key === 'i')) {
        mainWindow?.webContents.toggleDevTools()
      }
    })
  }
  
  // 监听控制台消息，便于调试
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log('[Renderer]', message)
  })
  
  // 监听加载错误
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load:', errorCode, errorDescription, validatedURL)
  })
}

// SQL 安全校验：只允许常规 DML 操作，禁止 DDL 和多语句
function validateSQL(sql: string): void {
  const trimmed = sql.trim()
  const upper = trimmed.toUpperCase()

  // 只允许 SELECT / INSERT / UPDATE / DELETE / PRAGMA / WITH (CTE)
  const ALLOWED_PREFIXES = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'PRAGMA', 'WITH']
  const startsWithAllowed = ALLOWED_PREFIXES.some(p => upper.startsWith(p))
  if (!startsWithAllowed) {
    throw new Error(`SQL 操作被拒绝：不允许的语句类型。仅允许 ${ALLOWED_PREFIXES.join('/')}`)
  }

  // 禁止分号分隔的多语句（参数化查询中的值不会被匹配，因为 better-sqlite3 的 prepare 只接受单语句）
  // 但仍做防御性检查：去掉字符串字面量后检查是否有多个分号
  const withoutStrings = trimmed.replace(/'[^']*'/g, '').replace(/"[^"]*"/g, '')
  const semicolonCount = (withoutStrings.match(/;/g) || []).length
  if (semicolonCount > 1) {
    throw new Error('SQL 操作被拒绝：不允许多语句执行')
  }
}

// IPC 处理程序 - 数据库操作
ipcMain.handle('db:query', async (_event, sql: string, params: unknown[] = []) => {
  if (!db) throw new Error('Database not initialized')
  validateSQL(sql)
  try {
    const stmt = db.prepare(sql)
    if (sql.trim().toUpperCase().startsWith('SELECT') || sql.trim().toUpperCase().startsWith('WITH') || sql.trim().toUpperCase().startsWith('PRAGMA')) {
      return stmt.all(...params)
    } else if (sql.trim().toUpperCase().startsWith('INSERT')) {
      const result = stmt.run(...params)
      return { lastInsertRowid: result.lastInsertRowid, changes: result.changes }
    } else {
      const result = stmt.run(...params)
      return { changes: result.changes }
    }
  } catch (error) {
    console.error('Database error:', error)
    throw error
  }
})

ipcMain.handle('db:queryOne', async (_event, sql: string, params: unknown[] = []) => {
  if (!db) throw new Error('Database not initialized')
  validateSQL(sql)
  try {
    const stmt = db.prepare(sql)
    return stmt.get(...params)
  } catch (error) {
    console.error('Database error:', error)
    throw error
  }
})

ipcMain.handle('db:transaction', async (_event, statements: Array<{ sql: string; params: unknown[] }>) => {
  if (!db) throw new Error('Database not initialized')
  // 校验事务中的每条语句
  for (const { sql } of statements) {
    validateSQL(sql)
  }
  try {
    const transaction = db.transaction(() => {
      statements.forEach(({ sql, params }) => {
        const stmt = db!.prepare(sql)
        stmt.run(...params)
      })
    })
    transaction()
    return { success: true }
  } catch (error) {
    console.error('Transaction error:', error)
    throw error
  }
})

// 获取数据库路径
ipcMain.handle('db:getPath', () => {
  return dbPath
})

// 备份数据库
ipcMain.handle('db:backup', async (_event, backupPath: string) => {
  if (!db) throw new Error('Database not initialized')
  try {
    db.backup(backupPath)
    return { success: true }
  } catch (error) {
    console.error('Backup error:', error)
    throw error
  }
})

// 显示保存对话框
ipcMain.handle('dialog:showSaveDialog', async (_event, options) => {
  const result = await dialog.showSaveDialog(mainWindow!, options)
  return result
})

// === 迁移和备份相关 IPC 处理程序 ===

// 获取数据库版本信息
ipcMain.handle('db:getVersion', () => {
  if (!db) return { version: 0, latestVersion: 0 }
  return {
    version: getCurrentVersion(db),
    latestVersion: migrations[migrations.length - 1]?.version ?? 0
  }
})

// 获取迁移历史
ipcMain.handle('db:getMigrationHistory', () => {
  if (!db) return []
  return getMigrationHistory(db)
})

// 获取数据库统计信息
ipcMain.handle('db:getStats', () => {
  if (!db) return null
  const stats = getDatabaseStats(db)
  // 获取数据库文件大小
  try {
    const statsFs = fs.statSync(dbPath)
    stats.dbSize = statsFs.size
  } catch {
    stats.dbSize = 0
  }
  return stats
})

// 创建手动备份
ipcMain.handle('db:createBackup', async (_event, backupName?: string) => {
  if (!db) throw new Error('Database not initialized')
  try {
    const backupPath = await createManualBackup(db, dbPath, backupName)
    return { success: true, path: backupPath }
  } catch (error) {
    console.error('Create backup error:', error)
    throw error
  }
})

// 获取备份历史
ipcMain.handle('db:getBackupHistory', async (_event, limit?: number) => {
  if (!db) return []
  return getBackupHistory(db, limit ?? 20)
})

// 从备份恢复
ipcMain.handle('db:restoreFromBackup', async (_event, backupPath: string) => {
  if (!db) throw new Error('Database not initialized')
  try {
    // 先关闭数据库连接
    db.close()
    db = null
    
    // 执行恢复
    const success = restoreFromBackup(dbPath, backupPath)
    
    if (success) {
      // 重新打开数据库
      db = new Database(dbPath)
      db.pragma('journal_mode = WAL')
      return { success: true, message: '数据库已从备份恢复，请重启应用。' }
    } else {
      throw new Error('恢复失败')
    }
  } catch (error) {
    console.error('Restore from backup error:', error)
    // 尝试重新打开数据库
    if (!db) {
      try {
        db = new Database(dbPath)
        db.pragma('journal_mode = WAL')
      } catch (e) {
        console.error('Failed to reopen database:', e)
      }
    }
    throw error
  }
})

// 获取备份目录路径
ipcMain.handle('db:getBackupDir', () => {
  return path.join(path.dirname(dbPath), 'backups')
})

// 打开备份目录（在文件管理器中显示）
ipcMain.handle('db:openBackupDir', async () => {
  const backupDir = path.join(path.dirname(dbPath), 'backups')
  
  // 确保目录存在
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }
  
  shell.openPath(backupDir)
  return { success: true }
})

// === WAL Checkpoint 相关 IPC 处理程序 ===

// 获取 WAL 文件信息
ipcMain.handle('db:getWalInfo', () => {
  return getWalFileInfo(dbPath)
})

// 执行 WAL checkpoint
ipcMain.handle('db:checkpoint', async (_event, mode?: 'PASSIVE' | 'RESTART' | 'TRUNCATE' | 'FULL') => {
  if (!db) throw new Error('Database not initialized')
  try {
    const result = runWalCheckpoint(db, mode ?? 'TRUNCATE')
    return result
  } catch (error) {
    console.error('Checkpoint error:', error)
    throw error
  }
})

// 写入文件到指定路径（供 Excel 导出等使用）
ipcMain.handle('fs:writeFile', async (_event, filePath: string, base64Data: string) => {
  try {
    const buffer = Buffer.from(base64Data, 'base64')
    fs.writeFileSync(filePath, buffer)
    return { success: true }
  } catch (error) {
    console.error('Write file error:', error)
    throw error
  }
})

// 打印课程计划
ipcMain.handle('print-lesson-plans', async (_event, htmlContent: string) => {
  try {
    // 创建隐藏的打印窗口
    const printWindow = new BrowserWindow({
      width: 800,
      height: 600,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    })
    
    // 加载 HTML 内容
    const tempPath = path.join(app.getPath('temp'), 'print-plans.html')
    fs.writeFileSync(tempPath, htmlContent, 'utf-8')
    
    await printWindow.loadFile(tempPath)
    
    // 等待内容加载完成
    await new Promise<void>((resolve) => {
      printWindow.webContents.on('did-finish-load', () => resolve())
    })
    
    // 调用打印对话框（使用回调形式，因为 print() 不返回 Promise）
    await new Promise<void>((resolve, reject) => {
      printWindow.webContents.print(
        { silent: false, printBackground: true },
        (success, failureReason) => {
          if (success) {
            resolve()
          } else {
            reject(new Error(failureReason || '打印失败'))
          }
        }
      )
    })
    
    // 打印完成后销毁窗口
    printWindow.close()
    
    // 删除临时文件
    fs.unlinkSync(tempPath)
    
    return { success: true }
  } catch (error) {
    console.error('Print error:', error)
    return { success: false, error: (error as Error).message }
  }
})

// ===== 学习规划 IPC 处理程序 =====

// plan:get — 获取学员大纲
ipcMain.handle('plan:get', (_event, studentId: string) => {
  if (!db) throw new Error('Database not initialized')
  const row = db.prepare(`SELECT * FROM student_plans WHERE student_id = ?`).get(studentId) as {
    id: number; student_id: string; summary: string | null; phonics_plan: string | null;
    textbook_plan: string | null; reading_plan: string | null; created_at: string; updated_at: string
  } | undefined
  if (!row) return null
  return {
    id: row.id,
    studentId: row.student_id,
    summary: row.summary || '',
    phonicsPlan: row.phonics_plan || '',
    textbookPlan: row.textbook_plan || '',
    readingPlan: row.reading_plan || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
})

// plan:save — 新增或更新学员大纲（upsert）
ipcMain.handle('plan:save', (_event, data: {
  studentId: string; summary: string; phonicsPlan: string; textbookPlan: string; readingPlan: string
}) => {
  if (!db) throw new Error('Database not initialized')
  const now = new Date().toLocaleString('sv').replace(' ', 'T')
  const existing = db.prepare(`SELECT id FROM student_plans WHERE student_id = ?`).get(data.studentId) as { id: number } | undefined
  if (existing) {
    db.prepare(`UPDATE student_plans SET summary=?, phonics_plan=?, textbook_plan=?, reading_plan=?, updated_at=? WHERE student_id=?`)
      .run(data.summary, data.phonicsPlan, data.textbookPlan, data.readingPlan, now, data.studentId)
    return { success: true, id: existing.id }
  } else {
    const result = db.prepare(`INSERT INTO student_plans (student_id, summary, phonics_plan, textbook_plan, reading_plan, created_at, updated_at) VALUES (?,?,?,?,?,?,?)`)
      .run(data.studentId, data.summary, data.phonicsPlan, data.textbookPlan, data.readingPlan, now, now)
    return { success: true, id: result.lastInsertRowid }
  }
})

// milestone:list — 获取学员所有里程碑
ipcMain.handle('milestone:list', (_event, studentId: string) => {
  if (!db) throw new Error('Database not initialized')
  const rows = db.prepare(`SELECT * FROM student_milestones WHERE student_id = ? ORDER BY sort_order ASC`).all(studentId) as Array<{
    id: number; student_id: string; label: string; target_wordbank: string | null;
    target_level: number | null; target_date: string | null; note: string | null;
    is_completed: number; completed_date: string | null; sort_order: number
  }>
  return rows.map(r => ({
    id: r.id,
    studentId: r.student_id,
    label: r.label,
    targetWordbank: r.target_wordbank,
    targetLevel: r.target_level,
    targetDate: r.target_date,
    note: r.note,
    isCompleted: !!r.is_completed,
    completedDate: r.completed_date,
    sortOrder: r.sort_order,
  }))
})

// milestone:add — 新增里程碑
ipcMain.handle('milestone:add', (_event, data: {
  studentId: string; label: string; targetWordbank?: string; targetLevel?: number;
  targetDate?: string; note?: string
}) => {
  if (!db) throw new Error('Database not initialized')
  const maxRow = db.prepare(`SELECT MAX(sort_order) as m FROM student_milestones WHERE student_id = ?`).get(data.studentId) as { m: number | null }
  const sortOrder = (maxRow.m ?? -1) + 1
  const now = new Date().toLocaleString('sv').replace(' ', 'T')
  const result = db.prepare(`INSERT INTO student_milestones (student_id, label, target_wordbank, target_level, target_date, note, sort_order, created_at) VALUES (?,?,?,?,?,?,?,?)`)
    .run(data.studentId, data.label, data.targetWordbank ?? null, data.targetLevel ?? null, data.targetDate ?? null, data.note ?? null, sortOrder, now)
  return { success: true, id: result.lastInsertRowid }
})

// milestone:update — 更新里程碑
ipcMain.handle('milestone:update', (_event, data: {
  id: number; label?: string; targetWordbank?: string; targetLevel?: number;
  targetDate?: string; note?: string; isCompleted?: boolean; completedDate?: string; sortOrder?: number
}) => {
  if (!db) throw new Error('Database not initialized')
  const fields: string[] = []
  const values: unknown[] = []
  if (data.label !== undefined) { fields.push('label=?'); values.push(data.label) }
  if (data.targetWordbank !== undefined) { fields.push('target_wordbank=?'); values.push(data.targetWordbank) }
  if (data.targetLevel !== undefined) { fields.push('target_level=?'); values.push(data.targetLevel) }
  if (data.targetDate !== undefined) { fields.push('target_date=?'); values.push(data.targetDate) }
  if (data.note !== undefined) { fields.push('note=?'); values.push(data.note) }
  if (data.isCompleted !== undefined) { fields.push('is_completed=?'); values.push(data.isCompleted ? 1 : 0) }
  if (data.completedDate !== undefined) { fields.push('completed_date=?'); values.push(data.completedDate) }
  if (data.sortOrder !== undefined) { fields.push('sort_order=?'); values.push(data.sortOrder) }
  if (fields.length > 0) {
    values.push(data.id)
    db.prepare(`UPDATE student_milestones SET ${fields.join(',')} WHERE id=?`).run(...values)
  }
  return { success: true }
})

// milestone:delete — 删除里程碑
ipcMain.handle('milestone:delete', (_event, id: number) => {
  if (!db) throw new Error('Database not initialized')
  db.prepare(`DELETE FROM student_milestones WHERE id=?`).run(id)
  return { success: true }
})

// milestone:reorder — 批量更新排序
ipcMain.handle('milestone:reorder', (_event, orderedIds: number[]) => {
  if (!db) throw new Error('Database not initialized')
  const reorder = db.transaction(() => {
    orderedIds.forEach((id, idx) => {
      db!.prepare(`UPDATE student_milestones SET sort_order=? WHERE id=?`).run(idx, id)
    })
  })
  reorder()
  return { success: true }
})

// plan:buildPromptData — 聚合学员所有数据供 AI 使用
ipcMain.handle('plan:buildPromptData', (_event, studentId: string) => {
  if (!db) throw new Error('Database not initialized')

  // 1. 学员基本信息
  const student = db.prepare(`SELECT * FROM students WHERE id=?`).get(studentId) as {
    name: string; grade: string | null; level: string | null; enroll_date: string | null;
    learning_target: string | null; phonics_progress: string | null; phonics_completed: number;
    ipa_completed: number; reading_progress: string | null
  } | undefined
  if (!student) throw new Error('Student not found')

  // 2. 大纲
  const plan = db.prepare(`SELECT * FROM student_plans WHERE student_id=?`).get(studentId) as {
    summary: string | null; phonics_plan: string | null; textbook_plan: string | null; reading_plan: string | null
  } | undefined

  // 3. 里程碑
  const milestones = (db.prepare(`SELECT * FROM student_milestones WHERE student_id=? ORDER BY sort_order`).all(studentId) as Array<{
    label: string; target_wordbank: string | null; target_level: number | null;
    target_date: string | null; note: string | null; is_completed: number
  }>).map(m => ({
    label: m.label,
    target_wordbank: m.target_wordbank,
    target_level: m.target_level,
    target_date: m.target_date,
    note: m.note,
    is_completed: !!m.is_completed,
  }))

  // 4. 当前词库进度（取 active 状态中 current_level 最高的一条）
  const activeProgress = db.prepare(`
    SELECT swp.*, w.name as wordbank_name, w.total_levels
    FROM student_wordbank_progress swp
    LEFT JOIN wordbanks w ON swp.wordbank_id = w.id
    WHERE swp.student_id = ? AND swp.status = 'active'
    ORDER BY swp.current_level DESC
    LIMIT 1
  `).get(studentId) as {
    wordbank_label: string; current_level: number; 
    wordbank_name: string | null
  } | undefined

  // 5. 最近 3 条课堂记录
  const recentRecords = (db.prepare(`
    SELECT class_date, tasks, issues FROM class_records
    WHERE student_id = ? ORDER BY class_date DESC LIMIT 3
  `).all(studentId) as Array<{ class_date: string; tasks: string | null; issues: string | null }>)
    .map(r => {
      let tasksDone: unknown[] = []
      try { tasksDone = r.tasks ? JSON.parse(r.tasks) : [] } catch { tasksDone = [] }
      return { date: r.class_date, tasks_done: tasksDone, teacher_note: r.issues || '' }
    })

  // 6. 语音阶段描述
  let phonicsStage = '未开始'
  if (student.phonics_completed) phonicsStage = '已完成'
  else if (student.ipa_completed) phonicsStage = '国际音标'
  else if (student.phonics_progress) phonicsStage = student.phonics_progress

  return {
    student_profile: {
      name: student.name,
      grade: student.grade || '',
      type: student.level === 'weak' ? '学苗' : student.level === 'advanced' ? '学霸' : '中等',
      join_date: student.enroll_date || '',
      target: student.learning_target || '',
    },
    student_plan: {
      summary: plan?.summary || '',
      milestones,
      phonics_plan: plan?.phonics_plan || '',
      textbook_plan: plan?.textbook_plan || '',
      reading_plan: plan?.reading_plan || '',
    },
    current_status: {
      vocab_current_bank: activeProgress?.wordbank_label || activeProgress?.wordbank_name || '',
      vocab_current_level: activeProgress?.current_level || 0,
      
      last_lesson_vocab_range: null,
      phonics_stage: phonicsStage,
      phonics_page: 0,
      textbook_current: '',
      reading_progress: student.reading_progress || '',
    },
    recent_lessons: recentRecords,
  }
})

app.whenReady().then(async () => {
  await initDatabase()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (db) {
      db.close()
    }
    app.quit()
  }
})

app.on('before-quit', () => {
  if (db) {
    try {
      // 退出前执行 WAL checkpoint，将 WAL 文件中的更改合并回主数据库
      // 这样可以减少下次启动时的 WAL 重放时间
      runWalCheckpoint(db, 'TRUNCATE')
      console.log('WAL checkpoint completed before quit')
    } catch (e) {
      console.error('Checkpoint on quit failed:', e)
    }
    db.close()
  }
})
