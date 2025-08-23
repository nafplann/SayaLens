import React, { useState, useEffect, useCallback } from 'react';
import { CaptureMode, ScreenBounds } from '@/types/electron';
import { Loader2 } from 'lucide-react';

interface ScreenCaptureProps {
  mode: CaptureMode;
}

const ScreenCapture: React.FC<ScreenCaptureProps> = ({ mode }) => {
  const [isSelecting, setIsSelecting] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Processing...');
  const [showSelection, setShowSelection] = useState(false);
  const [showCoordinates, setShowCoordinates] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsSelecting(true);
    setStartX(e.clientX);
    setStartY(e.clientY);
    setShowSelection(true);
    setShowCoordinates(true);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isSelecting) return;
    setCurrentX(e.clientX);
    setCurrentY(e.clientY);
  }, [isSelecting]);

  const handleMouseUp = useCallback(async (e: React.MouseEvent) => {
    if (!isSelecting) return;

    setIsSelecting(false);
    
    const endX = e.clientX;
    const endY = e.clientY;
    
    const left = Math.min(startX, endX);
    const top = Math.min(startY, endY);
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);

    if (width < 10 || height < 10) {
      reset();
      return;
    }

    const menuBarHeight = 38;
    const bounds: ScreenBounds = { x: left, y: top + menuBarHeight, width, height };

    setIsLoading(true);
    
    try {
      await processCapture(bounds);
    } catch (error) {
      console.error('Capture processing failed:', error);
      showError('Processing failed');
    }
  }, [isSelecting, startX, startY, mode]);

  const processCapture = async (bounds: ScreenBounds) => {
    if (!window.electronAPI) {
      console.error('electronAPI is not available');
      showError('Application communication error - electronAPI not available');
      return;
    }

    try {
      let result;
      if (mode === 'qr') {
        setLoadingText('Scanning QR code...');
        result = await window.electronAPI.captureAndProcessQR(bounds);
      } else {
        setLoadingText('Extracting text...');
        result = await window.electronAPI.captureAndProcessOCR(bounds);
      }

      setIsLoading(false);
      window.electronAPI.captureComplete(bounds);
      window.electronAPI.showResult({
        type: mode,
        result: result
      });
    } catch (error) {
      setIsLoading(false);
      showError((error as Error).message);
    }
  };

  const showError = (message: string) => {
    setIsLoading(false);
    if (window.electronAPI && window.electronAPI.showResult) {
      window.electronAPI.showResult({
        type: mode,
        result: {
          success: false,
          error: message
        }
      });
    } else {
      console.error('Cannot show error result - electronAPI not available:', message);
    }
  };

  const reset = () => {
    setShowSelection(false);
    setShowCoordinates(false);
    setIsSelecting(false);
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (window.electronAPI && window.electronAPI.captureComplete) {
        window.electronAPI.captureComplete();
      } else {
        console.error('Cannot close capture window - electronAPI not available');
      }
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Calculate selection rectangle
  const left = Math.min(startX, currentX);
  const top = Math.min(startY, currentY);
  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);

  const instructions = mode === 'qr' 
    ? 'Drag to select QR code area, then release to scan'
    : 'Drag to select text area, then release to capture';

  return (
    <div 
      className="fixed inset-0 w-full h-full bg-transparent cursor-crosshair select-none overflow-hidden border border-red-800 rounded-lg"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Instructions */}
      {!showSelection && (
        <div className="fixed top-5 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-80 text-white px-5 py-3 rounded-lg text-sm z-10 backdrop-blur-lg">
          {instructions}
        </div>
      )}
      
      {/* Selection rectangle */}
      {showSelection && (
        <div 
          className="fixed border-2 border-blue-500 bg-blue-500 bg-opacity-10 pointer-events-none z-20"
          style={{
            left: `${left}px`,
            top: `${top}px`,
            width: `${width}px`,
            height: `${height}px`,
          }}
        />
      )}

      {/* Coordinates display */}
      {showCoordinates && (
        <div 
          className="fixed bg-black bg-opacity-80 text-white px-2 py-1 rounded text-xs font-mono z-30 pointer-events-none backdrop-blur-lg"
          style={{
            left: `${currentX + 10}px`,
            top: `${currentY - 30}px`,
          }}
        >
          {width} × {height}
        </div>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-90 z-40 backdrop-blur-xl">
          <div className="bg-black bg-opacity-90 text-white p-8 rounded-xl text-center backdrop-blur-xl">
            <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4" />
            <div>{loadingText}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScreenCapture;
