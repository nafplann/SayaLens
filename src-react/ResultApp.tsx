import React from 'react';
import ResultDisplay from './components/ResultDisplay';
import { Toaster } from './components/ui/toaster';
import './globals.css';

const ResultApp: React.FC = () => {
  return (
    <div className="w-full h-full">
      <ResultDisplay />
      <Toaster />
    </div>
  );
};

export default ResultApp;
