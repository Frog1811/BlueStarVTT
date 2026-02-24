import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import CampaignsPage from './pages/CampaignsPage'
import CampaignScreen from './pages/CampaignScreen'
import BugReports from './pages/BugReports'
import './App.css'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/campaigns" element={<CampaignsPage />} />
      <Route path="/bug-reports" element={<BugReports />} />
      <Route path="/:campaignName/:sessionID" element={<CampaignScreen />} />
    </Routes>
  )
}

export default App
