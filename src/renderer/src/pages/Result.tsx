import {useEffect, useState} from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {Copy, Check, Image as ImageIcon, AlertCircle, QrCode, FileText, ChevronDown} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu.tsx";
import { Analytics } from '../lib/analytics';

interface ResultData {
  success: boolean
  data?: string
  text?: string
  confidence?: number
  error?: string
  capturedImage?: string
  mode?: 'qr' | 'ocr'
}

const languages = [
  { code: 'eng', name: 'English' },
  { code: 'ara', name: 'Arabic' },
  { code: 'chi_sim', name: 'Chinese' },
  { code: 'fra', name: 'French' },
  { code: 'deu', name: 'German' },
  { code: 'hin', name: 'Hindi' },
  { code: 'ita', name: 'Italian' },
  { code: 'jpn', name: 'Japanese' },
  { code: 'kor', name: 'Korean' },
  { code: 'por', name: 'Portuguese' },
  { code: 'rus', name: 'Russian' },
  { code: 'spa', name: 'Spanish' },
  { code: 'tha', name: 'Thai' },
  { code: 'vie', name: 'Vietnamese' },
];

export default function OCRResultPage() {
  const [resultData, setResultData] = useState<ResultData | null>(null)
  const [copied, setCopied] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(() => {
    // Load saved language preference or default to English
    return localStorage.getItem('ocr-language') || 'eng';
  });
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    if (window.api?.onShowData) {
      window.api.onShowData((_event: any, data: ResultData) => {
        console.log('Received result data:', data)
        setResultData(data)
      })
    }

    // Sync the stored language preference with the main process
    const syncLanguage = async () => {
      try {
        await window.api?.syncLanguagePreference(selectedLanguage)
        console.log(`Language preference synced with main process: ${selectedLanguage}`)
      } catch (error) {
        console.error('Failed to sync language preference:', error)
      }
    }
    syncLanguage()

    return () => {
      if (window.api?.removeAllListeners) {
        window.api.removeAllListeners('show-data')
      }
    }
  }, [selectedLanguage])

  useEffect(() => {
    const changeLanguageAndReprocess = async () => {
      if (!resultData) return;

      // On initial load, just set the language without reprocessing
      if (isInitialLoad) {
        try {
          const languageResult = await window.api?.setOCRLanguage(selectedLanguage)
          if (languageResult && !languageResult.success) {
            console.error('Failed to set initial OCR language:', languageResult.error)
          } else {
            console.log(`Initial OCR language set to: ${selectedLanguage}`)
          }
        } catch (error) {
          console.error('Error setting initial OCR language:', error)
        }
        setIsInitialLoad(false)
        return
      }

      const isOCRMode = resultData.mode === 'ocr' || (!resultData.mode && !resultData.data)

      try {
        // First, change the language
        const languageResult = await window.api?.setOCRLanguage(selectedLanguage)
        if (languageResult && !languageResult.success) {
          console.error('Failed to change OCR language:', languageResult.error)
          return
        }
        console.log(`OCR language changed to: ${selectedLanguage}`)

        // If we have a captured image and it's OCR mode, reprocess it
        if (isOCRMode && resultData.capturedImage) {
          setIsReprocessing(true)

          // Extract the actual file path from the captured image
          let imagePath = resultData.capturedImage
          if (imagePath.startsWith('data:image/png;base64,')) {
            // Skip reprocessing for base64 images (QR mode)
            setIsReprocessing(false)
            return
          }
          if (imagePath.startsWith('media://')) {
            imagePath = imagePath.replace('media://', '')
          }

          console.log('Reprocessing image with new language:', imagePath)
          const reprocessResult = await window.api?.reprocessOCR(imagePath)

          if (reprocessResult && reprocessResult.success) {
            // Update the result data with new OCR results
            setResultData(prev => prev ? {
              ...prev,
              text: reprocessResult.text,
              confidence: reprocessResult.confidence,
              success: reprocessResult.success
            } : null)
            console.log('Reprocessing completed successfully')
          } else {
            console.error('Reprocessing failed:', reprocessResult?.error)
          }

          setIsReprocessing(false)
        }
      } catch (error) {
        console.error('Error during language change and reprocessing:', error)
        setIsReprocessing(false)
      }
    }

    changeLanguageAndReprocess()
  }, [selectedLanguage, resultData?.capturedImage, isInitialLoad])

  // Save language preference whenever it changes
  useEffect(() => {
    localStorage.setItem('ocr-language', selectedLanguage)
    console.log(`Language preference saved: ${selectedLanguage}`)
    Analytics.languageChanged(selectedLanguage)
  }, [selectedLanguage])

  const handleCopy = async (text: string, close: boolean) => {
    try {
      await window.api?.copyToClipboard(text)
      Analytics.textCopied()
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
    } catch (err) {
      // toast
    } finally {
      if (close) {
        window.api?.closeResult()
      }
    }
  };

  if (!resultData) {
    return (
      <div className="min-h-screen bg-gray-50 p-5">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-6">
            <div className="text-center text-gray-600">Loading...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isQRMode = resultData.mode === 'qr' || !!resultData.data
  const isSuccess = resultData.success
  const displayText = resultData.text || resultData.data || ''

  const getIcon = () => {
    if (!isSuccess) return <AlertCircle className="w-5 h-5 text-red-500" />
    return isQRMode ? <QrCode className="w-5 h-5 text-blue-600" /> : <FileText className="w-5 h-5 text-blue-600" />
  }

  const getTitle = () => {
    if (!isSuccess) return 'Scan Failed'
    return isQRMode ? 'QR Code Result' : 'Text Recognition Result'
  }

  return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex flex-col gap-6">
            {/* OCR Text */}
            <Card className="flex-2 shadow-lg border-0 bg-white/80 backdrop-blur">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center justify-between text-lg">
                  <div className="flex items-center">
                    {getIcon()}
                    <span className="pl-2">{getTitle()}</span>
                    {isReprocessing && (
                      <span className="ml-2 text-sm text-blue-600 animate-pulse">
                        (Processing...)
                      </span>
                    )}
                  </div>
                  <div className="flex">
                    {!isQRMode && (
                      <Select value={selectedLanguage} onValueChange={setSelectedLanguage} disabled={isReprocessing}>
                        <SelectTrigger className="w-40 h-8 text-xs">
                          <SelectValue placeholder="Language" />
                        </SelectTrigger>
                        <SelectContent>
                          {languages.map((lang) => (
                              <SelectItem key={lang.code} value={lang.code} className="text-xs">
                                {lang.name}
                              </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 ml-2"
                        >
                          {copied ? (
                              <>
                                <Check className="w-4 h-4 mr-2" />
                                Copied!
                              </>
                          ) : (
                              <>
                                <Copy className="w-4 h-4 mr-2" />
                                Copy
                                <ChevronDown className="w-3 h-3 ml-1" />
                              </>
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem onClick={() => handleCopy(displayText, false)} className="cursor-pointer">
                          Copy text
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleCopy(displayText, true)} className="cursor-pointer">
                          Copy and close
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                    value={displayText}
                    readOnly
                    className="h-full field-sizing-content resize-none border-slate-200 bg-slate-50 text-slate-800 leading-relaxed"
                    placeholder="No text detected in the image"
                />
                <div className="flex justify-between items-center mt-4 text-sm text-slate-500">
                  <span>{displayText.length} characters</span>
                  <span>{displayText.split(/\s+/).filter(word => word.length > 0).length} words</span>
                </div>
              </CardContent>
            </Card>

            {/* Captured Image */}
            {resultData.capturedImage && (
              <Card className="flex-1 overflow-hidden shadow-lg border-0 bg-white/80 backdrop-blur">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center text-lg">
                    <ImageIcon className="w-5 h-5 mr-2 text-blue-600" />
                    Captured Image
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative rounded-lg overflow-hidden bg-slate-100">
                    <img
                        src={resultData.capturedImage.startsWith('data:')
                            ? resultData.capturedImage
                            : `media://${resultData.capturedImage}&encoded=${btoa(resultData.capturedImage)}`
                        }
                        alt="Captured screenshot"
                        className="w-full h-auto max-h-96 object-contain"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent pointer-events-none" />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
  );
}