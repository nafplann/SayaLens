import { useState, useEffect } from 'react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Separator } from '../components/ui/separator'
import { Textarea } from '../components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu'

interface RecordingResult {
  success: boolean
  outputPath?: string
  duration?: number
  fileSize?: number
  error?: string
  metadata?: {
    width: number
    height: number
    fps: number
    codec: string
  }
}

interface FileInfo {
  name: string
  path: string
  size: number
  duration: number
  format: string
  resolution: string
  created: Date
}

export default function RecordingResult() {
  const [recordingData, setRecordingData] = useState<RecordingResult | null>(null)
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null)
  const [isConverting, setIsConverting] = useState(false)
  const [conversionProgress, setConversionProgress] = useState(0)
  const [newFileName, setNewFileName] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Listen for recording data from main process
    const handleRecordingData = (_event: any, data: RecordingResult) => {
      console.log('Received recording data:', data)
      setRecordingData(data)
      
      if (data.success && data.outputPath) {
        extractFileInfo(data)
      }
    }

    // Listen for conversion progress
    const handleConversionProgress = (_event: any, progress: number) => {
      setConversionProgress(progress)
    }

    window.api.onShowRecordingData(handleRecordingData)
    window.api.onConversionProgress(handleConversionProgress)

    // Track page view
    window.api.trackPageView({ page: 'recording_result', title: 'Recording Result' })

    return () => {
      window.api.removeAllListeners('show-recording-data')
      window.api.removeAllListeners('conversion-progress')
    }
  }, [])

  const extractFileInfo = (data: RecordingResult) => {
    if (!data.outputPath) return

    const pathParts = data.outputPath.split('/')
    const fileName = pathParts[pathParts.length - 1]
    const nameWithoutExt = fileName.replace('.mp4', '')
    
    setNewFileName(nameWithoutExt)
    
    const info: FileInfo = {
      name: fileName,
      path: data.outputPath,
      size: data.fileSize || 0,
      duration: data.duration || 0,
      format: 'MP4',
      resolution: data.metadata ? `${data.metadata.width}x${data.metadata.height}` : 'Unknown',
      created: new Date()
    }
    
    setFileInfo(info)
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60

    if (hours > 0) {
      return `${hours}:${remainingMinutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
    }
    return `${remainingMinutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const handleOpenFileLocation = async () => {
    if (!recordingData?.outputPath) return

    try {
      await window.api.openFileLocation(recordingData.outputPath)
      
      // Track analytics
      await window.api.trackAnalyticsEvent({
        action: 'file_location_opened',
        category: 'recording_result'
      })
    } catch (error) {
      console.error('Failed to open file location:', error)
      setError('Failed to open file location')
    }
  }

  const handlePreviewRecording = () => {
    if (!recordingData?.outputPath) return

    // Open file with default system application
    window.api.openFileLocation(recordingData.outputPath)
    
    // Track analytics
    window.api.trackAnalyticsEvent({
      action: 'recording_previewed',
      category: 'recording_result'
    })
  }

  const handleConvertToGif = async () => {
    if (!recordingData?.outputPath) return

    try {
      setIsConverting(true)
      setConversionProgress(0)
      setError(null)

      console.log('Converting to GIF:', recordingData.outputPath)
      const result = await window.api.convertToGif(recordingData.outputPath)

      if (result.success) {
        // Update file info to show GIF version
        const gifPath = recordingData.outputPath.replace('.mp4', '.gif')
        const pathParts = gifPath.split('/')
        const fileName = pathParts[pathParts.length - 1]
        
        setFileInfo(prev => prev ? {
          ...prev,
          name: fileName,
          path: gifPath,
          size: result.convertedSize || 0,
          format: 'GIF'
        } : null)

        // Track analytics
        await window.api.trackAnalyticsEvent({
          action: 'converted_to_gif',
          category: 'recording_result',
          value: result.duration
        })
      } else {
        setError(result.error || 'Failed to convert to GIF')
      }
    } catch (error) {
      console.error('Failed to convert to GIF:', error)
      setError((error as Error).message)
    } finally {
      setIsConverting(false)
      setConversionProgress(0)
    }
  }

  const handleRenameFile = async () => {
    if (!fileInfo || !newFileName.trim()) return

    try {
      setIsRenaming(true)
      setError(null)

      // TODO: Implement file renaming
      // For now, just update the display name
      setFileInfo(prev => prev ? {
        ...prev,
        name: `${newFileName.trim()}.${prev.format.toLowerCase()}`
      } : null)

      // Track analytics
      await window.api.trackAnalyticsEvent({
        action: 'file_renamed',
        category: 'recording_result'
      })
    } catch (error) {
      console.error('Failed to rename file:', error)
      setError('Failed to rename file')
    } finally {
      setIsRenaming(false)
    }
  }

  const handleClose = () => {
    window.api.closeRecordingResult()
  }

  const handleNewRecording = () => {
    // Close this window and the user can start a new recording from tray
    window.api.closeRecordingResult()
  }

  if (!recordingData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading recording results...</p>
        </div>
      </div>
    )
  }

  if (!recordingData.success) {
    return (
      <div className="p-6 max-w-md mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Recording Failed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {recordingData.error || 'An unknown error occurred during recording.'}
            </p>
            <div className="flex gap-2">
              <Button onClick={handleNewRecording} className="flex-1">
                Try Again
              </Button>
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Success Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            Recording Complete!
          </CardTitle>
        </CardHeader>
      </Card>

      {/* File Information */}
      {fileInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">File Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* File Name with Rename Option */}
            <div className="space-y-2">
              <label className="text-sm font-medium">File Name</label>
              <div className="flex gap-2">
                <Textarea
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  className="flex-1 min-h-0 resize-none"
                  rows={1}
                />
                <Button
                  variant="outline"
                  onClick={handleRenameFile}
                  disabled={isRenaming || newFileName.trim() === fileInfo.name.replace(/\.[^/.]+$/, "")}
                  size="sm"
                >
                  {isRenaming ? 'Renaming...' : 'Rename'}
                </Button>
              </div>
            </div>

            <Separator />

            {/* File Details */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Format:</span>
                <Badge variant="secondary" className="ml-2">
                  {fileInfo.format}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Size:</span>
                <span className="ml-2 font-mono">{formatFileSize(fileInfo.size)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Duration:</span>
                <span className="ml-2 font-mono">{formatDuration(fileInfo.duration)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Resolution:</span>
                <span className="ml-2">{fileInfo.resolution}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Conversion Progress */}
      {isConverting && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Converting to GIF...</span>
                <span>{Math.round(conversionProgress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${conversionProgress}%` }}
                ></div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Card>
          <CardContent className="pt-6">
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleOpenFileLocation} variant="outline">
              Open File Location
            </Button>
            
            <Button onClick={handlePreviewRecording} variant="outline">
              Preview Recording
            </Button>
            
            {fileInfo?.format === 'MP4' && (
              <Button
                onClick={handleConvertToGif}
                variant="outline"
                disabled={isConverting}
              >
                {isConverting ? 'Converting...' : 'Export as GIF'}
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  More Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={handlePreviewRecording}>
                  Preview with Default App
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleOpenFileLocation}>
                  Show in Finder
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      {/* Bottom Actions */}
      <div className="flex gap-2 pt-4">
        <Button onClick={handleNewRecording} className="flex-1">
          Record Again
        </Button>
        <Button variant="outline" onClick={handleClose}>
          Close
        </Button>
      </div>
    </div>
  )
}
