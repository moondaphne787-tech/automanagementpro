/**
 * 词库进度同步服务
 * 负责课堂记录创建/导入后的词库进度同步逻辑
 */
import type { TaskBlock, Wordbank, StudentWordbankProgress } from '@/types'
import { progressDb, wordbankDb } from '@/db'
import { toast } from 'sonner'

/**
 * 单条课堂记录创建后同步词库进度
 * best-effort 操作，失败不影响核心数据
 */
export async function syncWordbankProgressForRecord(
  studentId: string,
  tasks: TaskBlock[],
  wordbanks: Wordbank[],
  existingProgress: StudentWordbankProgress[]
): Promise<void> {
  for (const task of tasks) {
    const effectiveLevel = task.level_reached ?? task.level_to
    if ((task.type === 'vocab_new' || task.type === 'vocab_review') && 
        task.wordbank_label && effectiveLevel) {
      const wordbank = wordbanks.find(w => w.name === task.wordbank_label)
      if (wordbank) {
        const currentProgress = existingProgress.find(p => p.wordbank_id === wordbank.id)
        
        if (!currentProgress || effectiveLevel > currentProgress.current_level) {
          await progressDb.upsert({
            student_id: studentId,
            wordbank_id: wordbank.id,
            current_level: effectiveLevel
          })
          
          const lastNineGridLevel = currentProgress?.last_nine_grid_level ?? 0
          const interval = wordbank.nine_grid_interval || 10
          const levelsSinceLastGrid = effectiveLevel - lastNineGridLevel
          
          if (levelsSinceLastGrid >= interval) {
            toast.info(`📚 ${task.wordbank_label} 已满 ${interval} 关（当前第 ${effectiveLevel} 关），可以安排九宫格清理了`, {
              duration: 5000
            })
          }
        }
      }
    }
    
    if (task.type === 'nine_grid' && task.wordbank_label) {
      const wordbank = wordbanks.find(w => w.name === task.wordbank_label)
      if (wordbank) {
        const currentProgress = existingProgress.find(p => p.wordbank_id === wordbank.id)
        if (currentProgress) {
          await progressDb.upsert({
            student_id: studentId,
            wordbank_id: wordbank.id,
            current_level: currentProgress.current_level,
            last_nine_grid_level: currentProgress.current_level
          })
        }
      }
    }
  }
}

/**
 * 收集批量导入时的词库进度更新（纯计算，无副作用）
 * 返回需要更新的进度数组和九宫格提醒信息
 */
export function collectWordbankProgressUpdates(
  records: Array<{ student_id: string; tasks: TaskBlock[] }>,
  wordbankMap: Map<string, Wordbank>,
  progressMap: Map<string, StudentWordbankProgress[]>
): {
  updates: Array<{
    student_id: string
    wordbank_id: string
    current_level: number
    last_nine_grid_level?: number
  }>
  alerts: Array<{ wordbankLabel: string; interval: number; level: number }>
} {
  const updates: Array<{
    student_id: string
    wordbank_id: string
    current_level: number
    last_nine_grid_level?: number
  }> = []
  
  const alerts: Array<{ wordbankLabel: string; interval: number; level: number }> = []
  
  for (const record of records) {
    for (const task of record.tasks) {
      const effectiveLevel = task.level_reached ?? task.level_to
      if ((task.type === 'vocab_new' || task.type === 'vocab_review') && 
          task.wordbank_label && effectiveLevel) {
        const wordbank = wordbankMap.get(task.wordbank_label)
        if (wordbank) {
          const existingProgress = progressMap.get(record.student_id) || []
          const currentProgress = existingProgress.find(p => p.wordbank_id === wordbank.id)
          
          if (!currentProgress || effectiveLevel > currentProgress.current_level) {
            updates.push({
              student_id: record.student_id,
              wordbank_id: wordbank.id,
              current_level: effectiveLevel
            })
            
            const lastNineGridLevel = currentProgress?.last_nine_grid_level ?? 0
            const interval = wordbank.nine_grid_interval || 10
            const levelsSinceLastGrid = effectiveLevel - lastNineGridLevel
            
            if (levelsSinceLastGrid >= interval) {
              alerts.push({
                wordbankLabel: task.wordbank_label,
                interval,
                level: effectiveLevel
              })
            }
          }
        }
      }
      
      if (task.type === 'nine_grid' && task.wordbank_label) {
        const wordbank = wordbankMap.get(task.wordbank_label)
        if (wordbank) {
          const existingProgress = progressMap.get(record.student_id) || []
          const currentProgress = existingProgress.find(p => p.wordbank_id === wordbank.id)
          if (currentProgress) {
            updates.push({
              student_id: record.student_id,
              wordbank_id: wordbank.id,
              current_level: currentProgress.current_level,
              last_nine_grid_level: currentProgress.current_level
            })
          }
        }
      }
    }
  }
  
  return { updates, alerts }
}

/**
 * 批量导入后执行词库进度同步
 * 包含：预加载数据 → 收集更新 → 批量执行 → 显示提醒
 */
export async function syncWordbankProgressForBatch(
  records: Array<{ student_id: string; tasks: TaskBlock[] }>
): Promise<void> {
  const wordbanks = await wordbankDb.getAll()
  const wordbankMap = new Map(wordbanks.map(w => [w.name, w]))
  
  const uniqueStudentIds = [...new Set(records.map(r => r.student_id))]
  const progressMap = await progressDb.getAllForStudents(uniqueStudentIds)
  
  const { updates, alerts } = collectWordbankProgressUpdates(records, wordbankMap, progressMap)
  
  await progressDb.batchUpsert(updates, wordbanks, progressMap)
  
  // 显示九宫格触发提醒（按词库去重）
  const uniqueAlerts = new Map<string, { interval: number; maxLevel: number }>()
  for (const alert of alerts) {
    const existing = uniqueAlerts.get(alert.wordbankLabel)
    if (!existing || alert.level > existing.maxLevel) {
      uniqueAlerts.set(alert.wordbankLabel, { interval: alert.interval, maxLevel: alert.level })
    }
  }
  
  for (const [wordbankLabel, info] of uniqueAlerts) {
    toast.info(`📚 ${wordbankLabel} 已满 ${info.interval} 关（当前第 ${info.maxLevel} 关），可以安排九宫格清理了`, {
      duration: 5000
    })
  }
}
