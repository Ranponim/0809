import React, { useEffect } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { BarChart3, Settings, TrendingUp, Database, Brain } from 'lucide-react'
import { 
  preloadDashboard, 
  preloadStatistics, 
  preloadPreferenceManager, 
  preloadResultsList, 
  preloadLLMAnalysisManager,
  preloadBasedOnNetworkSpeed 
} from './LazyComponents.jsx'

const Layout = ({ children, activeMenu, setActiveMenu }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3, preload: preloadDashboard },
    { id: 'results', label: '분석 결과', icon: Database, preload: preloadResultsList },
    { id: 'statistics', label: 'Statistics', icon: TrendingUp, preload: preloadStatistics },
    { id: 'llm-analysis', label: 'LLM 분석', icon: Brain, preload: preloadLLMAnalysisManager },
    { id: 'preference', label: 'Preference', icon: Settings, preload: preloadPreferenceManager }
  ]

  // 컴포넌트 마운트 시 네트워크 상태 기반 프리로딩 시작
  useEffect(() => {
    preloadBasedOnNetworkSpeed()
  }, [])

  // 메뉴 호버 시 해당 컴포넌트 프리로딩
  const handleMenuHover = (item) => {
    if (item.preload && activeMenu !== item.id) {
      console.log(`🎯 메뉴 호버 감지 - ${item.label} 프리로딩 시작`)
      item.preload().catch(error => {
        console.warn(`⚠️ ${item.label} 프리로딩 실패:`, error)
      })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">PVT  KPI Dashboard</h1>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white shadow-sm min-h-screen flex flex-col">
          <nav className="p-4">
            <div className="space-y-2">
              {menuItems.map((item) => {
                const Icon = item.icon
                return (
                  <Button
                    key={item.id}
                    variant={activeMenu === item.id ? "default" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setActiveMenu(item.id)}
                    onMouseEnter={() => handleMenuHover(item)}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </Button>
                )
              })}
            </div>
          </nav>
          {/* Footer */}
          <div className="mt-auto p-4 text-xs text-gray-400">
            Powered by PVT AI Crew
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

export default Layout

