import { useState } from 'react'
import Layout from './components/Layout.jsx'
import Dashboard from './components/Dashboard.jsx'
import SummaryReport from './components/SummaryReport.jsx'
import Statistics from './components/Statistics.jsx'
import Preference from './components/Preference.jsx'
import PreferenceManager from './components/PreferenceManager.jsx'
import ResultsList from './components/ResultsList.jsx'
import PreferenceTest from './components/PreferenceTest.jsx'
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
      case 'summary':
        return <SummaryReport />
      case 'statistics':
        return <Statistics />
      case 'preference':
        return <PreferenceManager />
      case 'preference-old':
        return <Preference />
      case 'preference-test':
        return <PreferenceTest />
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
