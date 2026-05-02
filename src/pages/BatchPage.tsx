import { useState } from 'react'
import { Upload, Sparkles, FileDown, LayoutList } from 'lucide-react'
import { GeneratePlansDrawer } from '@/components/Drawers/GeneratePlansDrawer'
import { ImportRecordsDrawer } from '@/components/Drawers/ImportRecordsDrawer'
import { PrintPlansDrawer } from '@/components/Drawers/PrintPlansDrawer'
import { cn } from '@/lib/utils'

type BatchTab = 'generate' | 'import' | 'export'

const TABS: Array<{ key: BatchTab; label: string; icon: React.ReactNode }> = [
  { key: 'generate', label: '生成计划', icon: <Sparkles className="w-4 h-4" /> },
  { key: 'import', label: '导入记录', icon: <Upload className="w-4 h-4" /> },
  { key: 'export', label: '导出数据', icon: <FileDown className="w-4 h-4" /> },
]

export function BatchPage() {
  const [activeTab, setActiveTab] = useState<BatchTab>('generate')

  return (
    <div className="h-full flex flex-col">
      <header className="h-16 border-b bg-card flex items-center gap-4 px-6">
        <LayoutList className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold">批量操作</h1>
      </header>

      {/* Tab 导航 */}
      <div className="border-b bg-card px-6">
        <nav className="flex gap-1 -mb-px">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 overflow-auto">
        {activeTab === 'generate' && (
          <GeneratePlansDrawer open={true} onClose={() => {}} fullPage />
        )}
        {activeTab === 'import' && (
          <ImportRecordsDrawer open={true} onClose={() => {}} fullPage />
        )}
        {activeTab === 'export' && (
          <PrintPlansDrawer open={true} onClose={() => {}} fullPage />
        )}
      </div>
    </div>
  )
}
