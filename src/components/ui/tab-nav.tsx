import { cn } from '@/lib/utils'

interface TabNavItem {
  key: string
  label: string
  icon?: React.ReactNode
}

interface TabNavProps {
  tabs: TabNavItem[]
  activeTab: string
  onChange: (key: string) => void
}

export function TabNav({ tabs, activeTab, onChange }: TabNavProps) {
  return (
    <nav className="flex gap-1 -mb-px">
      {tabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
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
  )
}
