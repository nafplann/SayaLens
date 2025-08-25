import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import './assets/globals.css'
import Capture from './pages/Capture'
import Result from './pages/Result'

// Main app component
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<div>SayaLens Main Window</div>} />
        <Route path="/capture" element={<Capture />} />
        <Route path="/result" element={<Result />} />
      </Routes>
    </Router>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
