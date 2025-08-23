import React, { useEffect, useState } from 'react';
import ScreenCapture from './components/ScreenCapture';
import { CaptureMode } from './types/electron';
import './globals.css';

const CaptureApp: React.FC = () => {
  const [mode, setMode] = useState<CaptureMode>('qr');

  useEffect(() => {
    if (window.electronAPI && window.electronAPI.onInitCapture) {
      window.electronAPI.onInitCapture((_, data) => {
        setMode(data.mode);
      });
    } else {
      console.error('electronAPI not available, waiting for it to load...');
      // Try again after a short delay
      const timeout = setTimeout(() => {
        if (window.electronAPI && window.electronAPI.onInitCapture) {
          console.log('electronAPI now available, setting up listener');
          window.electronAPI.onInitCapture((_, data) => {
            setMode(data.mode);
          });
        } else {
          console.error('electronAPI still not available after timeout');
        }
      }, 100);

      return () => clearTimeout(timeout);
    }
  }, []);

  return (
    <div className="w-full h-full">
      <ScreenCapture mode={mode} />
    </div>
  );
};

export default CaptureApp;
