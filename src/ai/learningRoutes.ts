import { settingsDb } from '@/db'

export interface LearningRoute {
  id: string
  name: string
  targetGrades: string[]
  stages: {
    order: number
    name: string
    focus: string[]
    guideline: string
  }[]
}

export interface StudentRouteBinding {
  routeId: string
  stageOrder: number
  customNote?: string
}

export const DEFAULT_ROUTES: LearningRoute[] = [
  {
    id: 'primary',
    name: '小学提升路线',
    targetGrades: ['三年级', '四年级', '五年级', '六年级'],
    stages: [
      { order: 1, name: '语音打基础', focus: ['phonics', 'picture_book'], guideline: '优先推进自然拼读和绘本，词库暂缓' },
      { order: 2, name: '词库建设', focus: ['vocab_new', 'textbook'], guideline: '主推小学考纲，同步梳理教材' },
      { order: 3, name: '综合提升', focus: ['vocab_new', 'reading', 'exercise'], guideline: '词库升阶到小学进阶，引入阅读训练' },
    ],
  },
  {
    id: 'junior',
    name: '初中备考路线',
    targetGrades: ['初一', '初二', '初三'],
    stages: [
      { order: 1, name: '词库冲刺', focus: ['vocab_new', 'textbook'], guideline: '主推初中考纲，每节课必排词库新学' },
      { order: 2, name: '语篇精读', focus: ['textbook', 'reading'], guideline: '词库推进同时加强课文梳理和阅读训练' },
      { order: 3, name: '考前强化', focus: ['exercise', 'reading'], guideline: '减少新词，加大专项练习和真题比重' },
    ],
  },
  {
    id: 'senior',
    name: '高中提升路线',
    targetGrades: ['高一', '高二', '高三'],
    stages: [
      { order: 1, name: '词汇扩充', focus: ['vocab_new'], guideline: '主推高中考纲，词汇密度优先' },
      { order: 2, name: '阅读突破', focus: ['reading', 'exercise'], guideline: '高阶阅读训练为主，配合语法专项' },
    ],
  },
]

/** 读取已保存的自定义路线（用 saved 覆盖默认），未设置时返回默认路线 */
export async function resolveRoutes(): Promise<LearningRoute[]> {
  try {
    const saved = await settingsDb.get('learning_routes')
    if (!saved) return DEFAULT_ROUTES

    const overrides = JSON.parse(saved) as LearningRoute[]
    return DEFAULT_ROUTES.map(defaultRoute => {
      const override = overrides.find(o => o.id === defaultRoute.id)
      if (!override) return defaultRoute
      return {
        ...defaultRoute,
        stages: defaultRoute.stages.map(stage => {
          const overriddenStage = override.stages.find(s => s.order === stage.order)
          return overriddenStage ? { ...stage, guideline: overriddenStage.guideline } : stage
        }),
      }
    })
  } catch {
    return DEFAULT_ROUTES
  }
}

/** 保存路线 guideline 覆盖 */
export async function saveRoutes(routes: LearningRoute[]): Promise<void> {
  await settingsDb.set('learning_routes', JSON.stringify(routes))
}
