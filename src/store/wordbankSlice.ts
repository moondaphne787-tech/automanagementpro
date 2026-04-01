import type { StateCreator } from 'zustand'
import type { AppState, WordbankSlice } from './types'
import { wordbankDb } from '@/db'

export const createWordbankSlice: StateCreator<AppState, [], [], WordbankSlice> = (set, get) => ({
  // 初始状态
  wordbanks: [],

  // 加载词库配置
  loadWordbanks: async () => {
    const wordbanks = await wordbankDb.getAll()
    set({ wordbanks })
  },

  // 创建词库
  createWordbank: async (wordbank) => {
    const newWordbank = await wordbankDb.create(wordbank)
    await get().loadWordbanks()
    return newWordbank
  },

  // 创建或更新词库（防止重复）
  upsertWordbank: async (wordbank) => {
    const result = await wordbankDb.upsert(wordbank)
    await get().loadWordbanks()
    return result
  },

  // 更新词库
  updateWordbank: async (id, data) => {
    const wordbank = await wordbankDb.update(id, data)
    await get().loadWordbanks()
    return wordbank
  },

  // 删除词库
  deleteWordbank: async (id) => {
    await wordbankDb.delete(id)
    await get().loadWordbanks()
  }
})