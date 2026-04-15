// 向后兼容：从各自文件直接导出，避免双层 re-export 链
export { GeneratePlansDrawer } from './GeneratePlansDrawer/index'
export { StudentSelector } from './GeneratePlansDrawer/StudentSelector'
export { PlanResultCard } from './GeneratePlansDrawer/PlanResultCard'
export { GenerationControls } from './GeneratePlansDrawer/GenerationControls'
export type { StudentPlanState, GenerationStatus, StudentContext } from './GeneratePlansDrawer/PlanResultCard'
