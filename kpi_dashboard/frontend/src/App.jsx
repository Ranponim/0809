import { useState } from 'react'
import Layout from './components/Layout.jsx'
import Dashboard from './components/Dashboard.jsx'
import SummaryReport from './components/SummaryReport.jsx'
import Statistics from './components/Statistics.jsx'
import Preference from './components/Preference.jsx'
import './App.css'

function App() {
  const [activeMenu, setActiveMenu] = useState('dashboard')

  const renderContent = () => {
    switch (activeMenu) {
      case 'dashboard':
        return <Dashboard />
      case 'summary':
        return <SummaryReport />
      case 'statistics':
        return <Statistics />
      case 'preference':
        return <Preference />
      default:
        return <Dashboard />
    }
  }

  return (
    <Layout activeMenu={activeMenu} setActiveMenu={setActiveMenu}>
      {renderContent()}
    </Layout>
  )
}

export default App
