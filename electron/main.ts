import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import Database from 'better-sqlite3'

let mainWindow: BrowserWindow | null = null
let db: Database.Database | null = null

// 数据库文件路径
const dbPath = path.join(app.getPath('documents'), 'EduManager', 'edumanager.db')

// 初始化数据库
function initDatabase() {
  try {
    const dbDir = path.dirname(dbPath)
    // 确保目录存在
    const fs = require('fs')
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true })
    }
    
    console.log('Attempting to open database at:', dbPath)
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    console.log('Database opened successfully')
    
    // 创建表
    createTables()
  } catch (error) {
    console.error('Failed to initialize database:', error)
    // 显示错误对话框
    const { dialog } = require('electron')
    dialog.showErrorBox('数据库初始化失败', 
      `无法初始化数据库，应用可能无法正常工作。\n\n错误信息: ${(error as Error).message}\n\n数据库路径: ${dbPath}`)
    // 仍然继续运行，但数据库操作会失败
  }
}

function createTables() {
  if (!db) return

  // 学员表
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
      warning_threshold REAL DEFAULT 3,
      last_payment_date TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    )
  `)
  
  // 为旧数据库添加缺失的列
  const billingInfo = db.prepare('PRAGMA table_info(billing)').all() as Array<{ name: string }>
  const billingColumns = billingInfo.map(col => col.name)
  
  if (!billingColumns.includes('last_payment_date')) {
    db.exec(`ALTER TABLE billing ADD COLUMN last_payment_date TEXT`)
  }
  if (!billingColumns.includes('created_at')) {
    db.exec(`ALTER TABLE billing ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP`)
  }
  if (!billingColumns.includes('updated_at')) {
    db.exec(`ALTER TABLE billing ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP`)
  }
  // 为现有记录设置默认值
  db.exec(`UPDATE billing SET created_at = datetime('now') WHERE created_at IS NULL`)
  db.exec(`UPDATE billing SET updated_at = datetime('now') WHERE updated_at IS NULL`)

  // 词库配置表
  db.exec(`
    CREATE TABLE IF NOT EXISTS wordbanks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      total_levels INTEGER DEFAULT 60,
      nine_grid_interval INTEGER DEFAULT 10,
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
      last_nine_grid_level INTEGER DEFAULT 0,
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
  
  // 为旧数据库 student_wordbank_progress 添加缺失的列
  const progressInfo = db.prepare('PRAGMA table_info(student_wordbank_progress)').all() as Array<{ name: string }>
  const progressColumns = progressInfo.map(col => col.name)
  
  if (!progressColumns.includes('created_at')) {
    db.exec(`ALTER TABLE student_wordbank_progress ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP`)
  }
  if (!progressColumns.includes('updated_at')) {
    db.exec(`ALTER TABLE student_wordbank_progress ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP`)
  }

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
      imported_from_excel INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    )
  `)

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
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

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

  // 系统设置表
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 插入默认词库配置
  const wordbanksCount = db.prepare('SELECT COUNT(*) as count FROM wordbanks').get() as { count: number }
  if (wordbanksCount.count === 0) {
    const insertWordbank = db.prepare(`
      INSERT INTO wordbanks (id, name, total_levels, nine_grid_interval, category, sort_order) 
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    
    const defaultWordbanks = [
      ['小学考纲', 60, 10, 'primary_exam', 1],
      ['小学进阶', 40, 10, 'primary_advanced', 2],
      ['初中考纲', 60, 20, 'junior_exam', 3],
      ['初中进阶', 40, 20, 'junior_advanced', 4],
      ['高中考纲', 60, 20, 'senior_exam', 5],
      ['高中进阶', 40, 20, 'senior_advanced', 6],
      ['大学四级', 40, 20, 'college_cet4', 7],
    ]
    
    const { v4: uuidv4 } = require('uuid')
    defaultWordbanks.forEach(([name, total, interval, category, order]) => {
      insertWordbank.run(uuidv4(), name, total, interval, category, order)
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

function createWindow() {
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
    mainWindow.loadURL('http://localhost:5173')
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

// IPC 处理程序 - 数据库操作
ipcMain.handle('db:query', async (_event, sql: string, params: unknown[] = []) => {
  if (!db) throw new Error('Database not initialized')
  try {
    const stmt = db.prepare(sql)
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
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

app.whenReady().then(() => {
  initDatabase()
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
    db.close()
  }
})