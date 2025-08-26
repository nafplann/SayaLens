import {useEffect, useState} from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {Copy, X, Check, Image as ImageIcon, AlertCircle, QrCode, FileText} from 'lucide-react';

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
  // { code: 'es', name: 'Spanish' },
  // { code: 'fr', name: 'French' },
  // { code: 'de', name: 'German' },
  // { code: 'it', name: 'Italian' },
  // { code: 'pt', name: 'Portuguese' },
  // { code: 'ru', name: 'Russian' },
  { code: 'jpn', name: 'Japanese' },
  // { code: 'ko', name: 'Korean' },
  // { code: 'zh', name: 'Chinese (Simplified)' },
  // { code: 'ar', name: 'Arabic' },
  // { code: 'hi', name: 'Hindi' },
  // { code: 'th', name: 'Thai' },
  // { code: 'vi', name: 'Vietnamese' },
  // { code: 'nl', name: 'Dutch' },
  // { code: 'sv', name: 'Swedish' },
  // { code: 'da', name: 'Danish' },
  // { code: 'no', name: 'Norwegian' },
  // { code: 'fi', name: 'Finnish' },
  // { code: 'pl', name: 'Polish' }
];

export default function OCRResultPage() {
  const [resultData, setResultData] = useState<ResultData | null>(null)
  const [copied, setCopied] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('eng');

  useEffect(() => {
    if (window.api?.onShowData) {
      window.api.onShowData((_event: any, data: ResultData) => {
        console.log('Received result data:', data)
        setResultData(data)
      })
    }

    return () => {
      if (window.api?.removeAllListeners) {
        window.api.removeAllListeners('show-data')
      }
    }
  }, [])

  const handleClose = () => {
    window.api?.closeResult()
  }

  const handleCopy = async (text: string) => {
    try {
      await window.api?.copyToClipboard(text)
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
    } catch (err) {
      // toast
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* OCR Text */}
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center justify-between text-lg">
                  <div className="flex items-center">
                    {getIcon()}
                    <span className="pl-2">{getTitle()}</span>
                  </div>
                  <div className="flex">
                    {!isQRMode && (
                      <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
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
                    <Button
                        onClick={() => handleCopy(displayText)}
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
                            Copy Text
                          </>
                      )}
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                    value={displayText}
                    readOnly
                    className="field-sizing-content resize-none border-slate-200 bg-slate-50 text-slate-800 leading-relaxed"
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
              <Card className="overflow-hidden shadow-lg border-0 bg-white/80 backdrop-blur">
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
                            : `media://${resultData.capturedImage}`
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