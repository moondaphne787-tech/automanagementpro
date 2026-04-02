import type { StateCreator } from 'zustand'
import type { AppState, ClassRecordSlice } from './types'
import type { TaskBlock } from '@/types'
import { classRecordDb, billingDb, progressDb, wordbankDb, teacherDb } from '@/db'
import { matchTeacherByName } from '@/lib/utils'
import { toast } from 'sonner'

export const createClassRecordSlice: StateCreator<AppState, [], [], ClassRecordSlice> = (set, get) => ({
  // 初始状态
  classRecords: [],

  // 加载课堂记录
  loadClassRecords: async (studentId) => {
    const records = await classRecordDb.getByStudentId(studentId)
    set({ classRecords: records })
  },

  // 创建课堂记录（使用原子性事务保障）
  createClassRecord: async (data) => {
    // ✅ 使用事务原子性地创建课堂记录和更新课时
    // 这确保了：如果中途崩溃，课堂记录和课时更新要么都成功，要么都回滚
    const billing = await billingDb.getByStudentId(data.student_id)
    const billingUpdate = billing && data.duration_hours ? {
      student_id: data.student_id,
      used_hours_delta: data.duration_hours
    } : undefined
    
    const record = await classRecordDb.createWithBillingUpdate(data, billingUpdate)
    
    // ✅ 词库进度同步（best-effort 操作，失败不影响核心数据）
    // 原因：进度同步失败影响较小，可以在下次上课时手动修正
    try {
      const wordbanks = await wordbankDb.getAll()
      const existingProgress = await progressDb.getByStudentId(data.student_id)
      
      for (const task of data.tasks) {
        const effectiveLevel = task.level_reached ?? task.level_to
        if ((task.type === 'vocab_new' || task.type === 'vocab_review') && 
            task.wordbank_label && effectiveLevel) {
          const wordbank = wordbanks.find(w => w.name === task.wordbank_label)
          if (wordbank) {
            const currentProgress = existingProgress.find(p => p.wordbank_id === wordbank.id)
            
            // 只有新关数大于当前关数才更新
            if (!currentProgress || effectiveLevel > currentProgress.current_level) {
              await progressDb.upsert({
                student_id: data.student_id,
                wordbank_id: wordbank.id,
                current_level: effectiveLevel
              })
              
              // ✅ 检查九宫格触发条件
              // 当新关数与上次九宫格关数的差值达到间隔时，提醒用户
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
        
        // 九宫格进度同步
        if (task.type === 'nine_grid' && task.wordbank_label) {
          const wordbank = wordbanks.find(w => w.name === task.wordbank_label)
          if (wordbank) {
            const currentProgress = existingProgress.find(p => p.wordbank_id === wordbank.id)
            if (currentProgress) {
              await progressDb.upsert({
                student_id: data.student_id,
                wordbank_id: wordbank.id,
                current_level: currentProgress.current_level,
                last_nine_grid_level: currentProgress.current_level
              })
            }
          }
        }
      }
    } catch (progressError) {
      // 进度同步失败只记录日志，不阻断主流程
      console.warn('[createClassRecord] 词库进度同步失败（不影响核心数据）:', progressError)
    }
    
    // ✅ 助教课时同步（best-effort 操作，失败不影响核心数据）
    try {
      if (data.teacher_name && data.duration_hours) {
        const allTeachers = await teacherDb.getAll()
        const matchedTeacher = matchTeacherByName(data.teacher_name, allTeachers)
        if (matchedTeacher) {
          await teacherDb.addTeachingHours(matchedTeacher.id, data.duration_hours)
        }
      }
    } catch (teacherError) {
      // 助教课时同步失败只记录日志，不阻断主流程
      console.warn('[createClassRecord] 助教课时同步失败（不影响核心数据）:', teacherError)
    }
    
    // 刷新数据
    await get().loadClassRecords(data.student_id)
    if (get().currentStudent?.id === data.student_id) {
      const billing = await billingDb.getByStudentId(data.student_id)
      set({ currentBilling: billing ?? null })
      await get().loadProgress(data.student_id)
    }
    await get().loadStudents()
    
    return record
  },

  // 更新课堂记录
  updateClassRecord: async (id, data) => {
    // 获取原记录用于课时调整
    const oldRecord = await classRecordDb.getById(id)
    if (!oldRecord) return undefined
    
    // 更新记录
    const record = await classRecordDb.update(id, data)
    if (!record) return undefined
    
    // 处理课时调整：如果时长变化，需要先减旧值再加新值
    if (data.duration_hours !== undefined && oldRecord.duration_hours !== data.duration_hours) {
      const billing = await billingDb.getByStudentId(record.student_id)
      if (billing) {
        // 先减去旧课时，再加上新课时
        const newUsedHours = Math.max(0, billing.used_hours - oldRecord.duration_hours + data.duration_hours)
        await billingDb.update(record.student_id, {
          used_hours: newUsedHours
        })
      }
    }
    
    // 处理助教课时调整：如果助教或时长变化
    if (data.duration_hours !== undefined || data.teacher_name !== undefined) {
      const oldTeacherName = oldRecord.teacher_name
      // 如果没有指定新的助教，则使用原助教（处理只更新时长的情况）
      const newTeacherName = data.teacher_name !== undefined ? data.teacher_name : oldRecord.teacher_name
      const oldDuration = oldRecord.duration_hours
      const newDuration = data.duration_hours ?? oldRecord.duration_hours
      
      const allTeachers = await teacherDb.getAll()
      
      // 如果助教变更或时长变更，需要调整课时
      if (oldTeacherName !== newTeacherName || oldDuration !== newDuration) {
        // 回退原助教课时（使用模糊匹配）
        if (oldTeacherName && oldDuration) {
          const oldTeacher = matchTeacherByName(oldTeacherName, allTeachers)
          if (oldTeacher) {
            await teacherDb.update(oldTeacher.id, {
              total_teaching_hours: Math.max(0, oldTeacher.total_teaching_hours - oldDuration)
            })
          }
        }
        
        // 累加新助教课时（使用模糊匹配）
        if (newTeacherName && newDuration) {
          // 重新获取最新数据（因为上面的回退操作可能已修改）
          const updatedTeachers = await teacherDb.getAll()
          const newTeacher = matchTeacherByName(newTeacherName, updatedTeachers)
          if (newTeacher) {
            await teacherDb.addTeachingHours(newTeacher.id, newDuration)
          }
        }
      }
    }
    
    // 刷新数据
    if (get().currentStudent?.id === record.student_id) {
      await get().loadClassRecords(record.student_id)
      const billing = await billingDb.getByStudentId(record.student_id)
      set({ currentBilling: billing ?? null })
    }
    await get().loadStudents()
    
    return record
  },

  // 删除课堂记录
  deleteClassRecord: async (id) => {
    const record = await classRecordDb.getById(id)
    if (record) {
      // 回退学员课时
      if (record.duration_hours) {
        const billing = await billingDb.getByStudentId(record.student_id)
        if (billing) {
          await billingDb.update(record.student_id, {
            used_hours: Math.max(0, billing.used_hours - record.duration_hours)
          })
        }
      }
      
      // 回退助教课时（使用与创建时相同的模糊匹配逻辑）
      if (record.teacher_name && record.duration_hours) {
        const allTeachers = await teacherDb.getAll()
        const teacher = matchTeacherByName(record.teacher_name, allTeachers)
        if (teacher) {
          await teacherDb.update(teacher.id, {
            total_teaching_hours: Math.max(0, teacher.total_teaching_hours - record.duration_hours)
          })
        }
      }
      
      await classRecordDb.delete(id)
      
      // 刷新数据
      if (get().currentStudent?.id === record.student_id) {
        await get().loadClassRecords(record.student_id)
        const billing = await billingDb.getByStudentId(record.student_id)
        set({ currentBilling: billing ?? null })
      }
      await get().loadStudents()
    }
  },

  // 批量导入课堂记录（使用事务保障原子性）
  // ✅ 所有课堂记录插入和课时更新在同一个事务中执行
  // 确保要么全部成功，要么全部回滚，避免部分数据不一致
  batchImportClassRecords: async (records) => {
    // 按学员汇总课时变化
    const studentHoursMap = new Map<string, number>()
    for (const record of records) {
      if (record.duration_hours && record.student_id) {
        const current = studentHoursMap.get(record.student_id) || 0
        studentHoursMap.set(record.student_id, current + record.duration_hours)
      }
    }
    
    // 使用事务原子性地执行：1) 批量创建课堂记录 2) 更新所有学员课时
    const count = await classRecordDb.batchCreateWithBillingUpdate(records, studentHoursMap)
    
    // ✅ 性能优化：在循环前批量获取词库（避免 N+1 查询）
    const wordbanks = await wordbankDb.getAll()
    const wordbankMap = new Map(wordbanks.map(w => [w.name, w]))
    
    // ✅ 性能优化：预加载所有涉及学员的进度（单次批量查询，避免 N+1）
    const uniqueStudentIds = [...new Set(records.map(r => r.student_id))]
    const progressMap = await progressDb.getAllForStudents(uniqueStudentIds)
    
    // ✅ 性能优化：收集所有需要更新的进度，然后批量执行（避免循环内 N+1 写入）
    const progressUpdates: Array<{
      student_id: string
      wordbank_id: string
      current_level: number
      last_nine_grid_level?: number
    }> = []
    
    // ✅ 收集九宫格触发提醒（用于批量导入后的统一提示）
    const nineGridAlerts: Array<{
      wordbankLabel: string
      interval: number
      level: number
    }> = []
    
    for (const record of records) {
      for (const task of record.tasks) {
        const effectiveLevel = task.level_reached ?? task.level_to
        if ((task.type === 'vocab_new' || task.type === 'vocab_review') && 
            task.wordbank_label && effectiveLevel) {
          const wordbank = wordbankMap.get(task.wordbank_label)
          if (wordbank) {
            const existingProgress = progressMap.get(record.student_id) || []
            const currentProgress = existingProgress.find(p => p.wordbank_id === wordbank.id)
            
            // 只有新关数大于当前关数才需要更新
            if (!currentProgress || effectiveLevel > currentProgress.current_level) {
              progressUpdates.push({
                student_id: record.student_id,
                wordbank_id: wordbank.id,
                current_level: effectiveLevel
              })
              
              // ✅ 检查九宫格触发条件
              const lastNineGridLevel = currentProgress?.last_nine_grid_level ?? 0
              const interval = wordbank.nine_grid_interval || 10
              const levelsSinceLastGrid = effectiveLevel - lastNineGridLevel
              
              if (levelsSinceLastGrid >= interval) {
                nineGridAlerts.push({
                  wordbankLabel: task.wordbank_label,
                  interval,
                  level: effectiveLevel
                })
              }
            }
          }
        }
        
        // 九宫格进度同步
        if (task.type === 'nine_grid' && task.wordbank_label) {
          const wordbank = wordbankMap.get(task.wordbank_label)
          if (wordbank) {
            const existingProgress = progressMap.get(record.student_id) || []
            const currentProgress = existingProgress.find(p => p.wordbank_id === wordbank.id)
            if (currentProgress) {
              progressUpdates.push({
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
    
    // 批量执行进度更新
    await progressDb.batchUpsert(progressUpdates, wordbanks, progressMap)
    
    // ✅ 显示九宫格触发提醒（批量导入后统一提示）
    // 对提醒按词库去重，避免重复提示
    const uniqueAlerts = new Map<string, { interval: number; maxLevel: number }>()
    for (const alert of nineGridAlerts) {
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
    
    // 按助教姓名汇总需要累加的课时
    const teacherHoursMap = new Map<string, number>()
    for (const record of records) {
      if (record.teacher_name && record.duration_hours) {
        const current = teacherHoursMap.get(record.teacher_name) || 0
        teacherHoursMap.set(record.teacher_name, current + record.duration_hours)
      }
    }
    
    // 批量更新助教课时（使用精确匹配优先的匹配函数）
    if (teacherHoursMap.size > 0) {
      const allTeachers = await teacherDb.getAll()
      for (const [teacherName, hours] of teacherHoursMap) {
        const matchedTeacher = matchTeacherByName(teacherName, allTeachers)
        if (matchedTeacher) {
          await teacherDb.addTeachingHours(matchedTeacher.id, hours)
        }
      }
    }
    
    await get().loadStudents()
    return count
  }
})