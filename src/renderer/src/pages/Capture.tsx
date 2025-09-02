import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { Analytics } from '../lib/analytics'

interface CaptureState {
  isSelecting: boolean
  startX: number
  startY: number
  currentX: number
  currentY: number
  mode: 'qr' | 'ocr'
  isLoading: boolean
  loadingText: string
}

interface SelectionBounds {
  x: number
  y: number
  width: number
  height: number
}

export default function Capture() {
  const [state, setState] = useState<CaptureState>({
    isSelecting: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    mode: 'qr',
    isLoading: false,
    loadingText: 'Processing...'
  })

  const overlayRef = useRef<HTMLDivElement>(null)

  // Initialize capture mode from electron main process
  useEffect(() => {
    if (window.api?.onInitCapture) {
      window.api.onInitCapture((_event: any, data: { mode: 'qr' | 'ocr' }) => {
        setState(prev => ({ ...prev, mode: data.mode }))
        
        // Track capture start
        if (data.mode === 'qr') {
          Analytics.qrCaptureStarted()
        } else {
          Analytics.ocrCaptureStarted()
        }
      })
    }

    return () => {
      if (window.api?.removeAllListeners) {
        window.api.removeAllListeners('init-capture')
      }
    }
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setState(prev => ({
      ...prev,
      isSelecting: true,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY
    }))
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!state.isSelecting) return

    setState(prev => ({
      ...prev,
      currentX: e.clientX,
      currentY: e.clientY
    }))
  }, [state.isSelecting])

  const handleMouseUp = useCallback(async () => {
    if (!state.isSelecting) return

    const bounds: SelectionBounds = {
      x: Math.min(state.startX, state.currentX),
      y: Math.min(state.startY, state.currentY),
      width: Math.abs(state.currentX - state.startX),
      height: Math.abs(state.currentY - state.startY)
    }

    // Minimum selection size
    if (bounds.width < 10 || bounds.height < 10) {
      setState(prev => ({ ...prev, isSelecting: false }))
      return
    }

    setState(prev => ({
      ...prev,
      isSelecting: false,
      loadingText: state.mode === 'qr' ? 'Scanning QR code...' : 'Extracting text...'
    }))

    // TODO: replace this ugly workaround, to delay loading wrapper to show
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        isLoading: true
      }));
    }, 200);

    try {
      let result
      if (state.mode === 'qr') {
        result = await window.api?.captureAndProcessQR(bounds)
      } else {
        result = await window.api?.captureAndProcessOCR(bounds)
      }

      if (result?.success) {
        // Track successful capture
        if (state.mode === 'qr') {
          await Analytics.qrCaptureCompleted(true)
        } else {
          await Analytics.ocrCaptureCompleted(true)
        }
        window.api?.showResult(result)
        window.api?.captureComplete()
      } else {
        // Track failed capture
        if (state.mode === 'qr') {
          await Analytics.qrCaptureCompleted(false)
        } else {
          await Analytics.ocrCaptureCompleted(false)
        }
        window.api?.showResult({
          success: false,
          error: result?.error || 'Processing failed',
          mode: state.mode
        })
        window.api?.captureComplete()
      }
    } catch (error) {
      console.error('Capture processing failed:', error)
      
      // Track error in capture
      if (state.mode === 'qr') {
        await Analytics.qrCaptureCompleted(false)
      } else {
        await Analytics.ocrCaptureCompleted(false)
      }
      
      window.api?.showResult({
        success: false,
        error: 'An unexpected error occurred',
        mode: state.mode
      })
      window.api?.captureComplete()
    }
  }, [state])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      window.api?.captureComplete()
    }
  }, [])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Calculate selection rectangle
  const selectionStyle = state.isSelecting ? {
    left: Math.min(state.startX, state.currentX),
    top: Math.min(state.startY, state.currentY),
    width: Math.abs(state.currentX - state.startX),
    height: Math.abs(state.currentY - state.startY)
  } : { display: 'none' }

  // Calculate coordinates display position
  const coordinatesStyle = state.isSelecting ? {
    left: state.currentX + 10,
    top: state.currentY - 30
  } : { display: 'none' }

  const coordinatesText = state.isSelecting 
    ? `${Math.abs(state.currentX - state.startX)} × ${Math.abs(state.currentY - state.startY)}`
    : ''

  return (
    <div className="fixed inset-0 cursor-crosshair select-none overflow-hidden bg-transparent">
      {/* Main overlay */}
      <div
        ref={overlayRef}
        className="fixed inset-0 bg-transparent border border-red-700 rounded-xl"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      />

      {/* Instructions */}
      <div className="fixed top-5 left-1/2 transform -translate-x-1/2 bg-black/80 text-white px-5 py-3 rounded-lg text-sm z-10 backdrop-blur-lg">
        {state.mode === 'qr' 
          ? 'Drag to select QR code area, then release to scan'
          : 'Drag to select text area, then release to capture'
        }
      </div>

      {/* Selection rectangle */}
      {state.isSelecting && (
        <div
          className="fixed border-2 border-blue-500 bg-blue-500/10 pointer-events-none z-20"
          style={selectionStyle}
        />
      )}

      {/* Coordinates display */}
      {state.isSelecting && (
        <div
          className="fixed bg-black/80 text-white px-2.5 py-1.5 rounded text-xs font-mono z-20 pointer-events-none backdrop-blur-lg"
          style={coordinatesStyle}
        >
          {coordinatesText}
        </div>
      )}

      {/* Loading overlay */}
      {state.isLoading && (
        <div className="fixed inset-0 flex items-center justify-center z-40">
          <div className="bg-black/90 text-white px-10 py-8 rounded-xl text-center backdrop-blur-xl">
            <Loader2 className="w-10 h-10 mx-auto mb-4 animate-spin text-blue-500" />
            <div className="text-lg">{state.loadingText}</div>
          </div>
        </div>
      )}
    </div>
  )
}
