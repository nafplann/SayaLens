import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ResultData, QRResult, OCRResult } from '@/types/electron';
import { QrCode, FileText, AlertCircle, Copy, X } from 'lucide-react';

const ResultDisplay: React.FC = () => {
  const [data, setData] = useState<ResultData | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (window.electronAPI && window.electronAPI.onShowData) {
      window.electronAPI.onShowData((_, resultData: ResultData) => {
        setData(resultData);
      });
    }
  }, []);

  const copyToClipboard = async (text: string) => {
    try {
      await window.electronAPI.copyToClipboard(text);
      toast({
        description: "Copied to clipboard!",
        duration: 2000,
      });
    } catch (error) {
      console.error('Failed to copy:', error);
      toast({
        variant: "destructive",
        description: "Failed to copy to clipboard",
        duration: 3000,
      });
    }
  };

  const close = () => {
    window.electronAPI.closeResult();
  };



  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div>Loading...</div>
      </div>
    );
  }

  const { type, result } = data;

  const renderIcon = () => {
    if (!result.success) {
      return <AlertCircle className="w-6 h-6 text-red-500" />;
    }
    
    if (type === 'qr') {
      return <QrCode className="w-6 h-6 text-blue-500" />;
    } else {
      return <FileText className="w-6 h-6 text-green-500" />;
    }
  };

  const getTitle = () => {
    if (!result.success) {
      return type === 'qr' ? 'QR Scan Failed' : 'Text Extraction Failed';
    }
    return type === 'qr' ? 'QR Code Detected' : 'Text Extracted';
  };

  const getResultText = () => {
    if (!result.success) {
      return result.error || 'Unknown error occurred';
    }
    
    if (type === 'qr') {
      const qrResult = result as QRResult;
      return qrResult.data || '';
    } else {
      const ocrResult = result as OCRResult;
      return ocrResult.text || '';
    }
  };

  const resultText = getResultText();

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      close();
    } else if (e.metaKey && e.key === 'c') {
      // Allow native copy if text is selected
      if (window.getSelection()?.toString()) {
        return;
      }
      // Otherwise copy the main result
      if (resultText) {
        copyToClipboard(resultText);
      }
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [resultText]);

  return (
    <div className="p-5 bg-gray-50 min-h-screen">
      <Card className="w-full max-w-md mx-auto max-h-[450px] flex flex-col shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-lg">
            {renderIcon()}
            {getTitle()}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
          <div className="flex-1 overflow-y-auto min-h-0">
            {result.success ? (
              <>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm leading-relaxed text-gray-900 whitespace-pre-wrap break-words max-h-32 overflow-y-auto font-mono">
                  {resultText}
                </div>
                
                {type === 'ocr' && (result as OCRResult).confidence && (
                  <div className="text-xs text-gray-500 mt-2 text-right">
                    Confidence: {(result as OCRResult).confidence}%
                  </div>
                )}

                {result.capturedImage && (
                  <div className="mt-4 text-center">
                    <div className="text-xs text-gray-500 mb-2 font-medium">
                      Captured Area
                    </div>
                    <img 
                      src={result.capturedImage} 
                      alt="Captured area"
                      className="max-w-full max-h-40 border border-gray-200 rounded-md shadow-sm mx-auto"
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="text-red-500 text-sm text-center py-5">
                {result.error}
              </div>
            )}
          </div>
          
          <div className="flex gap-3 mt-4">
            {result.success && (
              <Button 
                onClick={() => copyToClipboard(resultText)}
                className="flex-1 flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy to Clipboard
              </Button>
            )}
            <Button 
              variant="secondary" 
              onClick={close}
              className="flex-1 flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Close
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResultDisplay;
