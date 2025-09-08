import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from './ui/button'

interface AreaSelection {
  x: number
  y: number
  width: number
  height: number
  isSelecting: boolean
}

interface AreaSelectorProps {
  isActive: boolean
  onAreaSelected: (area: AreaSelection) => void
  onCancel: () => void
}

interface ResizeHandle {
  position: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w'
  cursor: string
}

const resizeHandles: ResizeHandle[] = [
  { position: 'nw', cursor: 'nw-resize' },
  { position: 'ne', cursor: 'ne-resize' },
  { position: 'sw', cursor: 'sw-resize' },
  { position: 'se', cursor: 'se-resize' },
  { position: 'n', cursor: 'n-resize' },
  { position: 's', cursor: 's-resize' },
  { position: 'e', cursor: 'e-resize' },
  { position: 'w', cursor: 'w-resize' }
]

export default function AreaSelector({ isActive, onAreaSelected, onCancel }: AreaSelectorProps) {
  const [selection, setSelection] = useState<AreaSelection>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    isSelecting: false
  })
  
  const [isDrawing, setIsDrawing] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeHandle, setResizeHandle] = useState<string | null>(null)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [originalSelection, setOriginalSelection] = useState<AreaSelection | null>(null)
  
  const overlayRef = useRef<HTMLDivElement>(null)
  const selectionRef = useRef<HTMLDivElement>(null)

  // Get screen dimensions
  const [screenDimensions, setScreenDimensions] = useState({
    width: window.screen.width,
    height: window.screen.height
  })

  useEffect(() => {
    if (isActive) {
      // Set screen dimensions when component becomes active
      setScreenDimensions({
        width: window.screen.width,
        height: window.screen.height
      })
      
      // Reset selection
      setSelection({
        x: Math.floor(screenDimensions.width * 0.25),
        y: Math.floor(screenDimensions.height * 0.25),
        width: Math.floor(screenDimensions.width * 0.5),
        height: Math.floor(screenDimensions.height * 0.5),
        isSelecting: true
      })
    }
  }, [isActive, screenDimensions.width, screenDimensions.height])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isActive) return
    
    e.preventDefault()
    const rect = overlayRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Check if clicking on a resize handle
    const handle = getResizeHandle(x, y)
    if (handle) {
      setIsResizing(true)
      setResizeHandle(handle.position)
      setStartPos({ x, y })
      setOriginalSelection({ ...selection })
      return
    }

    // Check if clicking inside the selection to move it
    if (isInsideSelection(x, y)) {
      setIsDrawing(true)
      setStartPos({ x: x - selection.x, y: y - selection.y })
      return
    }

    // Start new selection
    setIsDrawing(true)
    setStartPos({ x, y })
    setSelection({
      x,
      y,
      width: 0,
      height: 0,
      isSelecting: true
    })
  }, [isActive, selection])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isActive) return

    const rect = overlayRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (isResizing && resizeHandle && originalSelection) {
      handleResize(x, y)
    } else if (isDrawing) {
      if (isInsideSelection(startPos.x + selection.x, startPos.y + selection.y)) {
        // Move selection
        const newX = Math.max(0, Math.min(x - startPos.x, screenDimensions.width - selection.width))
        const newY = Math.max(0, Math.min(y - startPos.y, screenDimensions.height - selection.height))
        
        setSelection(prev => ({
          ...prev,
          x: newX,
          y: newY
        }))
      } else {
        // Draw new selection
        const width = Math.abs(x - startPos.x)
        const height = Math.abs(y - startPos.y)
        const newX = Math.min(startPos.x, x)
        const newY = Math.min(startPos.y, y)

        setSelection(prev => ({
          ...prev,
          x: newX,
          y: newY,
          width,
          height
        }))
      }
    } else {
      // Update cursor based on hover position
      updateCursor(x, y)
    }
  }, [isActive, isDrawing, isResizing, resizeHandle, startPos, selection, originalSelection, screenDimensions])

  const handleMouseUp = useCallback(() => {
    setIsDrawing(false)
    setIsResizing(false)
    setResizeHandle(null)
    setOriginalSelection(null)
  }, [])

  const handleResize = (x: number, y: number) => {
    if (!originalSelection || !resizeHandle) return

    let newSelection = { ...originalSelection }

    switch (resizeHandle) {
      case 'nw':
        newSelection.width = originalSelection.width + (originalSelection.x - x)
        newSelection.height = originalSelection.height + (originalSelection.y - y)
        newSelection.x = x
        newSelection.y = y
        break
      case 'ne':
        newSelection.width = x - originalSelection.x
        newSelection.height = originalSelection.height + (originalSelection.y - y)
        newSelection.y = y
        break
      case 'sw':
        newSelection.width = originalSelection.width + (originalSelection.x - x)
        newSelection.height = y - originalSelection.y
        newSelection.x = x
        break
      case 'se':
        newSelection.width = x - originalSelection.x
        newSelection.height = y - originalSelection.y
        break
      case 'n':
        newSelection.height = originalSelection.height + (originalSelection.y - y)
        newSelection.y = y
        break
      case 's':
        newSelection.height = y - originalSelection.y
        break
      case 'e':
        newSelection.width = x - originalSelection.x
        break
      case 'w':
        newSelection.width = originalSelection.width + (originalSelection.x - x)
        newSelection.x = x
        break
    }

    // Ensure minimum size and boundaries
    newSelection.width = Math.max(50, Math.min(newSelection.width, screenDimensions.width - newSelection.x))
    newSelection.height = Math.max(50, Math.min(newSelection.height, screenDimensions.height - newSelection.y))
    newSelection.x = Math.max(0, Math.min(newSelection.x, screenDimensions.width - newSelection.width))
    newSelection.y = Math.max(0, Math.min(newSelection.y, screenDimensions.height - newSelection.height))

    setSelection(newSelection)
  }

  const getResizeHandle = (x: number, y: number): ResizeHandle | null => {
    const handleSize = 8
    const { x: selX, y: selY, width, height } = selection

    // Check corner handles first
    if (Math.abs(x - selX) <= handleSize && Math.abs(y - selY) <= handleSize) {
      return resizeHandles.find(h => h.position === 'nw') || null
    }
    if (Math.abs(x - (selX + width)) <= handleSize && Math.abs(y - selY) <= handleSize) {
      return resizeHandles.find(h => h.position === 'ne') || null
    }
    if (Math.abs(x - selX) <= handleSize && Math.abs(y - (selY + height)) <= handleSize) {
      return resizeHandles.find(h => h.position === 'sw') || null
    }
    if (Math.abs(x - (selX + width)) <= handleSize && Math.abs(y - (selY + height)) <= handleSize) {
      return resizeHandles.find(h => h.position === 'se') || null
    }

    // Check edge handles
    if (Math.abs(y - selY) <= handleSize && x >= selX && x <= selX + width) {
      return resizeHandles.find(h => h.position === 'n') || null
    }
    if (Math.abs(y - (selY + height)) <= handleSize && x >= selX && x <= selX + width) {
      return resizeHandles.find(h => h.position === 's') || null
    }
    if (Math.abs(x - selX) <= handleSize && y >= selY && y <= selY + height) {
      return resizeHandles.find(h => h.position === 'w') || null
    }
    if (Math.abs(x - (selX + width)) <= handleSize && y >= selY && y <= selY + height) {
      return resizeHandles.find(h => h.position === 'e') || null
    }

    return null
  }

  const isInsideSelection = (x: number, y: number): boolean => {
    return x >= selection.x && x <= selection.x + selection.width &&
           y >= selection.y && y <= selection.y + selection.height
  }

  const updateCursor = (x: number, y: number) => {
    if (!overlayRef.current) return

    const handle = getResizeHandle(x, y)
    if (handle) {
      overlayRef.current.style.cursor = handle.cursor
    } else if (isInsideSelection(x, y)) {
      overlayRef.current.style.cursor = 'move'
    } else {
      overlayRef.current.style.cursor = 'crosshair'
    }
  }

  const handleConfirm = () => {
    if (selection.width > 0 && selection.height > 0) {
      onAreaSelected(selection)
    }
  }

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isActive) return
    
    if (e.key === 'Escape') {
      onCancel()
    } else if (e.key === 'Enter') {
      handleConfirm()
    }
  }, [isActive, onCancel, selection])

  useEffect(() => {
    if (isActive) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isActive, handleKeyDown])

  if (!isActive) return null

  return (
    <div className="inset-0 z-50 bg-black bg-opacity-50">
      <h1>HEHEHEH</h1>
      {/* Selection overlay */}
      <div
        ref={overlayRef}
        className="absolute inset-0 cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{
          width: screenDimensions.width,
          height: screenDimensions.height
        }}
      >
        {/* Selection rectangle */}
        {selection.isSelecting && (
          <div
            ref={selectionRef}
            className="absolute border-2 border-blue-500 bg-blue-500 bg-opacity-10"
            style={{
              left: selection.x,
              top: selection.y,
              width: selection.width,
              height: selection.height
            }}
          >
            {/* Resize handles */}
            {resizeHandles.map((handle) => (
              <div
                key={handle.position}
                className="absolute w-2 h-2 bg-blue-500 border border-white"
                style={{
                  left: handle.position.includes('w') ? -4 : 
                        handle.position.includes('e') ? selection.width - 4 :
                        selection.width / 2 - 4,
                  top: handle.position.includes('n') ? -4 :
                       handle.position.includes('s') ? selection.height - 4 :
                       selection.height / 2 - 4,
                  cursor: handle.cursor
                }}
              />
            ))}
            
            {/* Selection info */}
            <div className="absolute -top-8 left-0 bg-blue-500 text-white px-2 py-1 rounded text-sm">
              {Math.round(selection.width)} × {Math.round(selection.height)}
            </div>
          </div>
        )}
      </div>

      {/* Instructions panel */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-lg p-4 max-w-md">
        <div className="text-center space-y-2">
          <h3 className="font-semibold text-gray-900">Select Recording Area</h3>
          <p className="text-sm text-gray-600">
            Click and drag to create a selection, or resize the existing area.
          </p>
          <div className="flex justify-center space-x-2">
            <Button onClick={handleConfirm} size="sm">
              Confirm Selection
            </Button>
            <Button onClick={onCancel} variant="outline" size="sm">
              Cancel
            </Button>
          </div>
          <div className="text-xs text-gray-500">
            Press Enter to confirm or Escape to cancel
          </div>
        </div>
      </div>
    </div>
  )
}
