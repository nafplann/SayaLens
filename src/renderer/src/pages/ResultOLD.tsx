import { useState, useEffect } from 'react'
import { Copy, X, QrCode, FileText, AlertCircle } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../components/ui/card'
import { cn } from '../lib/utils'

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
      setCopyFeedback({ show: true, message: 'Copied to clipboard!' })
      setTimeout(() => setCopyFeedback({ show: false, message: '' }), 2000)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      setCopyFeedback({ show: true, message: 'Failed to copy' })
      setTimeout(() => setCopyFeedback({ show: false, message: '' }), 2000)
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

  return (
    <div className="min-h-screen bg-gray-50 p-5 relative">
      <Card className="max-w-md mx-auto max-h-[450px] flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center space-x-3">
            {getIcon()}
            <CardTitle className={cn("text-lg font-semibold", getHeaderColor())}>
              {getTitle()}
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto min-h-0 space-y-4">
          {isSuccess ? (
            <>
              {/* Display the extracted text or QR data */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="text-sm text-gray-900 whitespace-pre-wrap break-words max-h-32 overflow-y-auto font-mono">
                  {displayText}
                </div>
                {resultData.confidence && (
                  <div className="text-xs text-gray-500 mt-2 text-right">
                    Confidence: {resultData.confidence}%
                  </div>
                )}
              </div>

              {/* Show captured image if available */}
              {resultData.capturedImage && (
                <div className="text-center">
                  <div className="text-xs text-gray-500 mb-2 font-medium">Captured Image</div>
                  <img 
                    src={resultData.capturedImage.startsWith('data:')
                      ? resultData.capturedImage
                      : `media://${resultData.capturedImage}`
                    }
                    alt="Captured area"
                    className="max-w-full max-h-32 border border-gray-200 rounded-md shadow-sm mx-auto"
                    onError={(e) => {
                      console.error('Image load error:', e)
                      ;(e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <div className="text-red-500 text-sm">
                {resultData.error || 'An unknown error occurred'}
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex gap-3 pt-4">
          {isSuccess && displayText && (
            <Button 
              onClick={() => handleCopy(displayText)}
              className="flex-1"
              size="sm"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy
            </Button>
          )}
          <Button 
            variant="outline" 
            onClick={handleClose}
            className={cn("flex-1", !isSuccess && "w-full")}
            size="sm"
          >
            <X className="w-4 h-4 mr-2" />
            Close
          </Button>
        </CardFooter>
      </Card>

      {/* Copy feedback toast */}
      {copyFeedback.show && (
        <div className={cn(
          "fixed top-5 right-5 bg-green-500/90 text-white px-4 py-2 rounded-full text-xs font-medium backdrop-blur-sm transition-all duration-300",
          copyFeedback.show ? "opacity-100 translate-x-0" : "opacity-0 translate-x-full"
        )}>
          {copyFeedback.message}
        </div>
      )}
    </div>
  )
}
