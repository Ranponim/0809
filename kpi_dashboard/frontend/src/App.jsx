import { useState } from 'react'
import Layout from './components/Layout.jsx'
import {
  SuspenseDashboard as Dashboard,
  SuspenseStatistics as Statistics,
  SuspensePreferenceManager as PreferenceManager,
  SuspenseResultsList as ResultsList,
  SuspenseLLMAnalysisManager as LLMAnalysisManager
} from './components/LazyComponents.jsx'
import Preference from './components/Preference.jsx'
import PreferenceTest from './components/PreferenceTest.jsx'
import UserSettingsTest from './components/UserSettingsTest.jsx'
import { PreferenceProvider } from './contexts/PreferenceContext.jsx'
import './App.css'

function App() {
  const [activeMenu, setActiveMenu] = useState('dashboard')

  const renderContent = () => {
    switch (activeMenu) {
      case 'dashboard':
        return <Dashboard />
      case 'results':
        return <ResultsList />
      case 'statistics':
        return <Statistics />
      case 'preference':
        return <PreferenceManager />
      case 'preference-old':
        return <Preference />
      case 'preference-test':
        return <PreferenceTest />
      case 'user-settings-test':
        return <UserSettingsTest />
      case 'llm-analysis':
        return <LLMAnalysisManager />
      default:
        return <Dashboard />
    }
  }

  return (
    <PreferenceProvider>
      <Layout activeMenu={activeMenu} setActiveMenu={setActiveMenu}>
        {renderContent()}
      </Layout>
    </PreferenceProvider>
  )
}

export default App
