import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import './assets/globals.css'
import Capture from './pages/Capture'
import Result from './pages/Result'
import About from './pages/About'
import { initializeAnalytics, Analytics } from './lib/analytics'

// Main menu component
function MainMenu() {
  const handleNavigate = (path: string) => {
    window.location.hash = path
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-blue-600 rounded-xl flex items-center justify-center mx-auto">
            <span className="text-2xl text-white font-bold">SL</span>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">SayaLens</h1>
            <p className="text-gray-600">Extract text from anywhere on your screen</p>
          </div>
        </div>
        
        <div className="space-y-3">
          <button
            onClick={() => handleNavigate('/about')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg transition-colors font-medium"
          >
            About SayaLens
          </button>
          <div className="text-center text-sm text-gray-500">
            Use system tray or global shortcuts to capture text
          </div>
        </div>
      </div>
    </div>
  )
}

// Analytics page tracker component
function PageTracker() {
  const location = useLocation()

  useEffect(() => {
    // Track page view when location changes
    Analytics.pageVisited(location.pathname)
  }, [location])

  return null
}

// Main app component
function App() {
  useEffect(() => {
    // Initialize Google Analytics with version tracking when app starts
    const initAnalytics = async () => {
      try {
        await initializeAnalytics()
        Analytics.appStarted()
        Analytics.appVersionInfo()
      } catch (error) {
        console.error('Failed to initialize analytics:', error)
      }
    }
    
    initAnalytics()

    // Track app close when component unmounts
    return () => {
      Analytics.appClosed()
    }
  }, [])

  return (
    <Router>
      <PageTracker />
      <Routes>
        <Route path="/" element={<MainMenu />} />
        <Route path="/capture" element={<Capture />} />
        <Route path="/result" element={<Result />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </Router>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
