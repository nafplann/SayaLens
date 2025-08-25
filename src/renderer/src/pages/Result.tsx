import { useState, useEffect } from 'react'
import {Copy, X, QrCode, FileText, AlertCircle, ImageIcon, Check} from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../components/ui/card'
import { cn } from '../lib/utils'
import { Textarea } from '@renderer/components/ui/textarea'

interface ResultData {
  success: boolean
  data?: string
  text?: string
  confidence?: number
  error?: string
  capturedImage?: string
  mode?: 'qr' | 'ocr'
}

interface CopyFeedbackState {
  show: boolean
  message: string
}

export default function Result() {
  const [resultData, setResultData] = useState<ResultData | null>({
    capturedImage: "",
    confidence: 100,
    data: "",
    error: "",
    mode: 'ocr',
    success: true,
    text: "Helloww"
  })
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedbackState>({ show: false, message: '' })
  const [copied, setCopied] = useState(false);

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

  const handleCopy = async (text: string) => {
    try {
      await window.api?.copyToClipboard(text)
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }

  const handleClose = () => {
    window.api?.closeResult()
  }

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
    if (!isSuccess) return <AlertCircle className="w-6 h-6 text-red-500" />
    return isQRMode ? <QrCode className="w-6 h-6 text-blue-500" /> : <FileText className="w-6 h-6 text-green-500" />
  }

  const getTitle = () => {
    if (!isSuccess) return 'Scan Failed'
    return isQRMode ? 'QR Code Result' : 'Text Recognition Result'
  }

  const getHeaderColor = () => {
    if (!isSuccess) return 'text-red-600'
    return isQRMode ? 'text-blue-600' : 'text-green-600'
  }

  const onClose = () => {};

  return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <Card className="shadow-lg">
            <CardHeader className="bg-primary text-primary-foreground rounded-t-lg">
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl font-bold text-primary-foreground">OCR Results</CardTitle>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="text-primary-foreground hover:bg-primary-foreground/20"
                >
                  <X size={24} />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Captured Image */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <ImageIcon size={20} className="text-primary" />
                    <h2 className="text-lg font-semibold">Captured Image</h2>
                  </div>
                  <Card className="bg-muted/50">
                    <CardContent className="p-4 min-h-[300px] flex items-center justify-center">
                      {resultData.capturedImage ? (
                          <img
                              src={resultData.capturedImage.startsWith('data:')
                                  ? resultData.capturedImage
                                  : `media://${resultData.capturedImage}`
                              }
                              alt="Captured screenshot"
                              className="max-w-full max-h-[400px] object-contain rounded-md shadow-sm"
                          />
                      ) : (
                          <div className="text-muted-foreground text-center">
                            <ImageIcon size={48} className="mx-auto mb-2 opacity-50" />
                            <p>No image available</p>
                          </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* OCR Text */}
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold">Extracted Text</h2>
                  <Card className="bg-muted/50">
                    <CardContent className="p-4">
                      <Textarea
                          value={resultData.text}
                          readOnly
                          className="min-h-[280px] resize-none bg-transparent border-none shadow-none focus-visible:ring-0"
                          placeholder="No text extracted"
                      />
                    </CardContent>
                  </Card>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <Button onClick={() => handleCopy(displayText)} className="flex items-center gap-2">
                      {copied ? (
                          <>
                            <Check size={18} />
                            Copied!
                          </>
                      ) : (
                          <>
                            <Copy size={18} />
                            Copy to Clipboard
                          </>
                      )}
                    </Button>

                    <Button variant="secondary" onClick={onClose} className="flex items-center gap-2">
                      <X size={18} />
                      Close
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
  )
}
