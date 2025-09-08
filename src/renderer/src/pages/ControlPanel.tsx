import { useState, useEffect, useRef } from 'react'
import Draggable from 'react-draggable'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Badge } from '../components/ui/badge'
import { Separator } from '../components/ui/separator'
import AreaSelector from '../components/AreaSelector'

interface RecordingSettings {
  area: 'fullscreen' | 'window' | 'custom'
  bounds?: { x: number; y: number; width: number; height: number }
  sourceId?: string
  audio: 'none' | 'microphone'
  format: 'mp4'
  quality: 'low' | 'medium' | 'high' | 'ultra' | 'custom'
  framerate: 15 | 24 | 30 | 60
  countdown: number
  maxDuration: number
  maxFileSize: number
  // Advanced quality options
  videoBitrate?: number
  resolution?: { width: number; height: number }
  compression?: 'fast' | 'balanced' | 'quality'
}

interface RecordingState {
  isRecording: boolean
  isPaused: boolean
  startTime: number
  duration: number
  outputPath: string
  tempFiles: string[]
  memoryUsage: number
  fileSize: number
}

interface PerformanceMetrics {
  memoryUsage: number
  cpuUsage: number
  frameDropCount: number
  encodingLatency: number
  diskWriteSpeed: number
}

export default function ControlPanel() {
  // State management
  const [settings, setSettings] = useState<RecordingSettings>({
    area: 'fullscreen',
    audio: 'none',
    format: 'mp4',
    quality: 'medium',
    framerate: 30,
    countdown: 3,
    maxDuration: 1800, // 30 minutes
    maxFileSize: 2048, // 2GB
    compression: 'balanced'
  })

  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false)

  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    startTime: 0,
    duration: 0,
    outputPath: '',
    tempFiles: [],
    memoryUsage: 0,
    fileSize: 0
  })

  const [countdown, setCountdown] = useState<number>(0)
  const [performance, setPerformance] = useState<PerformanceMetrics>({
    memoryUsage: 0,
    cpuUsage: 0,
    frameDropCount: 0,
    encodingLatency: 0,
    diskWriteSpeed: 0
  })

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Refs
  const panelRef = useRef<HTMLDivElement>(null)
  const countdownInterval = useRef<NodeJS.Timeout | null>(null)
  const stateUpdateInterval = useRef<NodeJS.Timeout | null>(null)

  // Media recording state (handled in renderer)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [actuallyRecording, setActuallyRecording] = useState(false)

  // Area selection state
  const [showAreaSelector, setShowAreaSelector] = useState(false)
  const [selectedArea, setSelectedArea] = useState<{ x: number; y: number; width: number; height: number } | null>(null)

  // Load available sources on mount
  useEffect(() => {
    loadAvailableSources()
    
    // Set up state polling when recording
    if (recordingState.isRecording) {
      stateUpdateInterval.current = setInterval(updateRecordingState, 1000)
    } else if (stateUpdateInterval.current) {
      clearInterval(stateUpdateInterval.current)
      stateUpdateInterval.current = null
    }

    return () => {
      if (stateUpdateInterval.current) {
        clearInterval(stateUpdateInterval.current)
      }
    }
  }, [recordingState.isRecording])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current)
      }
      if (stateUpdateInterval.current) {
        clearInterval(stateUpdateInterval.current)
      }
    }
  }, [])

  const loadAvailableSources = async () => {
    try {
      await window.api.getScreenSources()
    } catch (error) {
      console.error('Failed to load screen sources:', error)
      setError('Failed to load screen sources')
    }
  }

  const updateRecordingState = async () => {
    try {
      const result = await window.api.getRecordingState()
      if (result.success && result.state) {
        setRecordingState(result.state)
        
        // Update performance metrics
        setPerformance(prev => ({
          ...prev,
          memoryUsage: result.state.memoryUsage || 0
        }))
      }
    } catch (error) {
      console.error('Failed to get recording state:', error)
    }
  }

  const startCountdown = () => {
    let count = settings.countdown
    setCountdown(count)

    if (count === 0) {
      startRecordingImmediate()
      return
    }

    countdownInterval.current = setInterval(() => {
      count -= 1
      setCountdown(count)

      if (count === 0) {
        if (countdownInterval.current) {
          clearInterval(countdownInterval.current)
          countdownInterval.current = null
        }
        startRecordingImmediate()
      }
    }, 1000)
  }

  const startRecordingImmediate = async () => {
    try {
      setIsLoading(true)
      setError(null)
      setCountdown(0)

      console.log('Starting recording with settings:', settings)
      
      // First, prepare the recording in the main process
      const result = await window.api.startRecording(settings)

      if (result.success && result.metadata?.sourceId) {
        // Now create the MediaRecorder in the renderer process
        await startActualRecording(result.metadata.sourceId, result.outputPath!)
        
        setRecordingState(prev => ({
          ...prev,
          isRecording: true,
          startTime: Date.now(),
          outputPath: result.outputPath || ''
        }))
        
        // Track analytics
        await window.api.trackAnalyticsEvent({
          action: 'recording_started',
          category: 'screen_recording',
          label: settings.area
        })
      } else {
        setError(result.error || 'Failed to start recording')
      }
    } catch (error) {
      console.error('Failed to start recording:', error)
      setError((error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const startActualRecording = async (sourceId: string, outputPath: string) => {
    try {
      console.log('Creating MediaRecorder with sourceId:', sourceId)

      // Get the media stream using the sourceId
      const constraints = {
        audio: settings.audio === 'microphone' ? {
          mandatory: {
            chromeMediaSource: 'desktop'
          }
        } : false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId,
            maxWidth: getMaxWidth(settings.quality),
            maxHeight: getMaxHeight(settings.quality),
            maxFrameRate: settings.framerate
          }
        }
      }

      const mediaStream = await (navigator.mediaDevices as any).getUserMedia(constraints)
      setStream(mediaStream)

      // Create MediaRecorder
      const recorder = new MediaRecorder(mediaStream, {
        mimeType: getSupportedMimeType(),
        videoBitsPerSecond: getVideoBitrate(settings.quality)
      })

      // Set up event handlers
      const chunks: Blob[] = []
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      }

      recorder.onstop = async () => {
        console.log('MediaRecorder stopped, saving file...')
        const blob = new Blob(chunks, { type: 'video/mp4' })
        await saveRecordingFile(blob, outputPath)
        setActuallyRecording(false)
      }

      recorder.onerror = (event) => {
        console.error('MediaRecorder error:', event)
        setError('Recording failed')
      }

      // Start recording
      recorder.start(1000) // Collect data every second
      setMediaRecorder(recorder)
      setActuallyRecording(true)

      console.log('MediaRecorder started successfully')

    } catch (error) {
      console.error('Failed to create MediaRecorder:', error)
      throw error
    }
  }

  const saveRecordingFile = async (blob: Blob, outputPath: string) => {
    try {
      // Convert blob to buffer and save via main process
      const arrayBuffer = await blob.arrayBuffer()
      const buffer = new Uint8Array(arrayBuffer)
      
      console.log('Saving recording file, size:', buffer.length, 'bytes')
      
      // Save the file via IPC
      const result = await window.api.saveRecordingFile(buffer, outputPath)
      
      if (result.success) {
        console.log('Recording saved successfully:', result.filePath)
        
        // Track completion analytics
        await window.api.trackAnalyticsEvent({
          action: 'recording_completed',
          category: 'screen_recording',
          value: Math.floor((Date.now() - recordingState.startTime) / 1000)
        })
      } else {
        throw new Error(result.error || 'Failed to save recording')
      }
      
    } catch (error) {
      console.error('Failed to save recording:', error)
      setError('Failed to save recording: ' + (error as Error).message)
    }
  }

  const getSupportedMimeType = (): string => {
    const types = [
      'video/mp4;codecs=h264',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ]

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        console.log('Using MIME type:', type)
        return type
      }
    }

    return 'video/webm' // fallback
  }

  const getVideoBitrate = (quality: string): number => {
    switch (quality) {
      case 'low': return 1000000 // 1 Mbps
      case 'medium': return 2500000 // 2.5 Mbps
      case 'high': return 5000000 // 5 Mbps
      default: return 2500000
    }
  }

  const getMaxWidth = (quality: string): number => {
    switch (quality) {
      case 'low': return 1280
      case 'medium': return 1920
      case 'high': return 2560
      default: return 1920
    }
  }

  const getMaxHeight = (quality: string): number => {
    switch (quality) {
      case 'low': return 720
      case 'medium': return 1080
      case 'high': return 1440
      case 'ultra': return 2160
      default: return 1080
    }
  }

  const getQualityPresets = () => {
    return {
      low: {
        resolution: { width: 1280, height: 720 },
        bitrate: 1000000, // 1 Mbps
        framerate: 24,
        compression: 'fast' as const
      },
      medium: {
        resolution: { width: 1920, height: 1080 },
        bitrate: 2500000, // 2.5 Mbps
        framerate: 30,
        compression: 'balanced' as const
      },
      high: {
        resolution: { width: 1920, height: 1080 },
        bitrate: 5000000, // 5 Mbps
        framerate: 60,
        compression: 'quality' as const
      },
      ultra: {
        resolution: { width: 2560, height: 1440 },
        bitrate: 10000000, // 10 Mbps
        framerate: 60,
        compression: 'quality' as const
      }
    }
  }

  const applyQualityPreset = (quality: string) => {
    const presets = getQualityPresets()
    const preset = presets[quality as keyof typeof presets]
    
    if (preset && quality !== 'custom') {
      setSettings(prev => ({
        ...prev,
        quality: quality as any,
        resolution: preset.resolution,
        videoBitrate: preset.bitrate,
        framerate: preset.framerate as any,
        compression: preset.compression
      }))
    }
  }

  const formatBitrate = (bitrate: number): string => {
    if (bitrate >= 1000000) {
      return `${(bitrate / 1000000).toFixed(1)} Mbps`
    }
    return `${Math.round(bitrate / 1000)} Kbps`
  }

  const stopRecording = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Stop the MediaRecorder in the renderer
      if (mediaRecorder && actuallyRecording) {
        mediaRecorder.stop()
        
        // Stop all tracks in the stream
        if (stream) {
          stream.getTracks().forEach(track => track.stop())
          setStream(null)
        }
        
        setMediaRecorder(null)
      }

      // Update local state
      setRecordingState(prev => ({
        ...prev,
        isRecording: false,
        isPaused: false
      }))

      // Track analytics
      await window.api.trackAnalyticsEvent({
        action: 'recording_stopped',
        category: 'screen_recording',
        value: Date.now() - recordingState.startTime
      })

      // Close control panel after successful recording
      setTimeout(() => {
        window.api.closeControlPanel()
      }, 1000)

    } catch (error) {
      console.error('Failed to stop recording:', error)
      setError((error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const pauseResumeRecording = async () => {
    try {
      if (mediaRecorder && actuallyRecording) {
        if (recordingState.isPaused) {
          mediaRecorder.resume()
          await window.api.trackAnalyticsEvent({
            action: 'recording_resumed',
            category: 'screen_recording'
          })
        } else {
          mediaRecorder.pause()
          await window.api.trackAnalyticsEvent({
            action: 'recording_paused',
            category: 'screen_recording'
          })
        }
        
        setRecordingState(prev => ({
          ...prev,
          isPaused: !prev.isPaused
        }))
      }
    } catch (error) {
      console.error('Failed to pause/resume recording:', error)
      setError((error as Error).message)
    }
  }

  const cancelRecording = () => {
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current)
      countdownInterval.current = null
    }
    setCountdown(0)
    
    if (recordingState.isRecording) {
      stopRecording()
    } else {
      window.api.closeControlPanel()
    }
  }

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(1)} MB`
  }

  const handleAreaSelection = () => {
    setShowAreaSelector(true)
  }

  const handleAreaSelected = (area: any) => {
    setSelectedArea({
      x: area.x,
      y: area.y,
      width: area.width,
      height: area.height
    })
    setSettings(prev => ({
      ...prev,
      bounds: {
        x: area.x,
        y: area.y,
        width: area.width,
        height: area.height
      }
    }))
    setShowAreaSelector(false)
    
    // Track analytics
    window.api.trackAnalyticsEvent({
      action: 'area_selection_used',
      category: 'screen_recording',
      label: 'custom'
    })
  }

  const handleAreaSelectionCancel = () => {
    setShowAreaSelector(false)
    // Reset to fullscreen if custom area was cancelled
    if (settings.area === 'custom') {
      setSettings(prev => ({ ...prev, area: 'fullscreen' }))
    }
  }

  return (
    <>
      {/* Area Selector Overlay */}
      <AreaSelector
        isActive={showAreaSelector}
        onAreaSelected={handleAreaSelected}
        onCancel={handleAreaSelectionCancel}
      />

      {/* Control Panel */}
      <Draggable 
        handle=".drag-handle" 
        defaultPosition={{ x: 100, y: 100 }}
        nodeRef={panelRef}
      >
        <div ref={panelRef} className="fixed z-40">
        <Card className="w-96 shadow-lg border-2">
          <CardHeader className="drag-handle cursor-move pb-3">
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Screen Recording</span>
              <Badge variant={recordingState.isRecording ? "destructive" : "secondary"}>
                {recordingState.isRecording 
                  ? (recordingState.isPaused ? 'PAUSED' : 'RECORDING') 
                  : 'READY'
                }
              </Badge>
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Countdown Display */}
            {countdown > 0 && (
              <div className="text-center">
                <div className="text-6xl font-bold text-red-500 mb-2">
                  {countdown}
                </div>
                <p className="text-sm text-muted-foreground">Recording starts in...</p>
              </div>
            )}

            {/* Recording Status */}
            {recordingState.isRecording && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Duration:</span>
                  <span className="font-mono">
                    {formatDuration(recordingState.duration)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>File Size:</span>
                  <span>{formatFileSize(recordingState.fileSize)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Memory:</span>
                  <span>{performance.memoryUsage} MB</span>
                </div>
              </div>
            )}

            {/* Settings (only show when not recording) */}
            {!recordingState.isRecording && countdown === 0 && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Recording Area</label>
                  <Select
                    value={settings.area}
                    onValueChange={(value: 'fullscreen' | 'window' | 'custom') => {
                      setSettings(prev => ({ ...prev, area: value }))
                      if (value === 'custom') {
                        handleAreaSelection()
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fullscreen">Full Screen</SelectItem>
                      <SelectItem value="window">Selected Window</SelectItem>
                      <SelectItem value="custom">Custom Area</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {/* Show selected area info */}
                  {settings.area === 'custom' && selectedArea && (
                    <div className="text-xs text-muted-foreground bg-blue-50 p-2 rounded">
                      Selected: {selectedArea.width} × {selectedArea.height} at ({selectedArea.x}, {selectedArea.y})
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-2 h-4 text-xs"
                        onClick={handleAreaSelection}
                      >
                        Change
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Quality Preset</label>
                  <Select
                    value={settings.quality}
                    onValueChange={(value: 'low' | 'medium' | 'high' | 'ultra' | 'custom') => {
                      setSettings(prev => ({ ...prev, quality: value }))
                      applyQualityPreset(value)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low (720p, 24fps, 1 Mbps)</SelectItem>
                      <SelectItem value="medium">Medium (1080p, 30fps, 2.5 Mbps)</SelectItem>
                      <SelectItem value="high">High (1080p, 60fps, 5 Mbps)</SelectItem>
                      <SelectItem value="ultra">Ultra (1440p, 60fps, 10 Mbps)</SelectItem>
                      <SelectItem value="custom">Custom Settings</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {/* Quality preset info */}
                  {settings.quality !== 'custom' && settings.resolution && settings.videoBitrate && (
                    <div className="text-xs text-muted-foreground bg-gray-50 p-2 rounded">
                      {settings.resolution.width}×{settings.resolution.height} • {settings.framerate}fps • {formatBitrate(settings.videoBitrate)}
                    </div>
                  )}
                </div>

                {/* Advanced Options Toggle */}
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-between"
                    onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                  >
                    <span>Advanced Options</span>
                    <span className="text-xs">{showAdvancedOptions ? '▼' : '▶'}</span>
                  </Button>
                  
                  {showAdvancedOptions && (
                    <div className="space-y-3 p-3 bg-gray-50 rounded-lg border">
                      {/* Custom Resolution */}
                      {settings.quality === 'custom' && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs font-medium">Width</label>
                            <input
                              type="number"
                              className="w-full px-2 py-1 text-xs border rounded"
                              value={settings.resolution?.width || 1920}
                              onChange={(e) => setSettings(prev => ({
                                ...prev,
                                resolution: {
                                  ...prev.resolution!,
                                  width: parseInt(e.target.value) || 1920
                                }
                              }))}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium">Height</label>
                            <input
                              type="number"
                              className="w-full px-2 py-1 text-xs border rounded"
                              value={settings.resolution?.height || 1080}
                              onChange={(e) => setSettings(prev => ({
                                ...prev,
                                resolution: {
                                  ...prev.resolution!,
                                  height: parseInt(e.target.value) || 1080
                                }
                              }))}
                            />
                          </div>
                        </div>
                      )}

                      {/* Frame Rate */}
                      <div className="space-y-1">
                        <label className="text-xs font-medium">Frame Rate</label>
                        <Select
                          value={settings.framerate.toString()}
                          onValueChange={(value) => setSettings(prev => ({
                            ...prev,
                            framerate: parseInt(value) as any
                          }))}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="15">15 fps</SelectItem>
                            <SelectItem value="24">24 fps</SelectItem>
                            <SelectItem value="30">30 fps</SelectItem>
                            <SelectItem value="60">60 fps</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Video Bitrate */}
                      {settings.quality === 'custom' && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium">Video Bitrate</label>
                          <input
                            type="range"
                            className="w-full"
                            min="500000"
                            max="20000000"
                            step="100000"
                            value={settings.videoBitrate || 2500000}
                            onChange={(e) => setSettings(prev => ({
                              ...prev,
                              videoBitrate: parseInt(e.target.value)
                            }))}
                          />
                          <div className="text-xs text-muted-foreground text-center">
                            {formatBitrate(settings.videoBitrate || 2500000)}
                          </div>
                        </div>
                      )}

                      {/* Compression Mode */}
                      <div className="space-y-1">
                        <label className="text-xs font-medium">Compression</label>
                        <Select
                          value={settings.compression || 'balanced'}
                          onValueChange={(value: 'fast' | 'balanced' | 'quality') =>
                            setSettings(prev => ({ ...prev, compression: value }))
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fast">Fast (Lower CPU usage)</SelectItem>
                            <SelectItem value="balanced">Balanced</SelectItem>
                            <SelectItem value="quality">Quality (Higher CPU usage)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Audio</label>
                  <Select
                    value={settings.audio}
                    onValueChange={(value: 'none' | 'microphone') =>
                      setSettings(prev => ({ ...prev, audio: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Audio</SelectItem>
                      <SelectItem value="microphone">Microphone</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {error}
              </div>
            )}

            <Separator />

            {/* Control Buttons */}
            <div className="flex gap-2">
              {!recordingState.isRecording && countdown === 0 && (
                <>
                  <Button
                    onClick={startCountdown}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    {isLoading ? 'Starting...' : 'Start Recording'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={cancelRecording}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                </>
              )}

              {countdown > 0 && (
                <Button
                  variant="outline"
                  onClick={cancelRecording}
                  className="flex-1"
                >
                  Cancel Countdown
                </Button>
              )}

              {recordingState.isRecording && (
                <>
                  <Button
                    variant="outline"
                    onClick={pauseResumeRecording}
                    disabled={isLoading}
                  >
                    {recordingState.isPaused ? 'Resume' : 'Pause'}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={stopRecording}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    {isLoading ? 'Stopping...' : 'Stop Recording'}
                  </Button>
                </>
              )}
            </div>

            {/* Instructions */}
            <div className="text-xs text-muted-foreground text-center">
              {!recordingState.isRecording 
                ? 'Configure your settings and click Start Recording'
                : 'Recording in progress. Click Stop when finished.'
              }
            </div>
          </CardContent>
        </Card>
        </div>
      </Draggable>
    </>
  )
}
