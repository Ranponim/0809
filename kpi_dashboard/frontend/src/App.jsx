import React, { useEffect } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { BarChart3, Settings, TrendingUp, Database, Brain, Play, Target, GitCompare, Activity } from 'lucide-react'
import { 
  preloadDashboard, 
  preloadStatistics, 
  preloadPreferenceManager, 
  preloadResultsList, 
  preloadLLMAnalysisManager,
  preloadBasedOnNetworkSpeed,
  // 실제 렌더링할 컴포넌트들 import
  SuspenseDashboard,
  SuspenseStatistics,
  SuspensePreferenceManager,
  SuspenseResultsList,
  SuspenseLLMAnalysisManager
} from './LazyComponents.jsx'

const Layout = ({ children, activeMenu, setActiveMenu }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3, preload: preloadDashboard },
    { id: 'compare-result', label: 'Compare Result', icon: GitCompare, preload: null },
    { id: 'detailed-analysis', label: 'Detailed Analysis', icon: Activity, preload: null },
    { id: 'analysis-workflow', label: 'Analysis Workflow', icon: Play, preload: null },
    { id: 'analysis-setup', label: '분석 설정', icon: Target, preload: null },
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

  // 실제 컴포넌트 렌더링 함수
  const renderActiveComponent = () => {
    console.log(`🔄 현재 활성 메뉴: ${activeMenu}`)
    
    switch (activeMenu) {
      case 'dashboard':
        return <SuspenseDashboard />
      case 'statistics':
        return <SuspenseStatistics />
      case 'preference':
        return <SuspensePreferenceManager />
      case 'results':
        return <SuspenseResultsList />
      case 'llm-analysis':
        return <SuspenseLLMAnalysisManager />
      case 'compare-result':
        return (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <GitCompare className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Compare Result</h3>
              <p className="text-gray-500">비교 결과 페이지가 준비 중입니다.</p>
 