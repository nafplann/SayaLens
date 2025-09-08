import { desktopCapturer, systemPreferences, shell, dialog } from 'electron'
import { writeFile, mkdir, access } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'

interface RecordingSettings {
  area: 'fullscreen' | 'window' | 'custom'
  bounds?: { x: number; y: number; width: number; height: number }
  sourceId?: string
  audio: 'none' | 'microphone'
  format: 'mp4'
  quality: 'low' | 'medium' | 'high'
  framerate: 30 | 60
  countdown: number
  maxDuration: number
  maxFileSize: number
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

interface RecordingResult {
  success: boolean
  outputPath?: string
  duration?: number
  fileSize?: number
  error?: string
  metadata?: {
    sourceId?: string
    settings?: RecordingSettings
    width: number
    height: number
    fps: number
    codec: string
  }
}

export default class ScreenRecorder {
  private mediaRecorder: MediaRecorder | null = null
  private stream: MediaStream | null = null
  private state: RecordingState
  private chunks: Blob[] = []
  private saveDirectory: string
  private performanceMonitor: NodeJS.Timeout | null = null

  constructor() {
    this.state = {
      isRecording: false,
      isPaused: false,
      startTime: 0,
      duration: 0,
      outputPath: '',
      tempFiles: [],
      memoryUsage: 0,
      fileSize: 0
    }

    this.saveDirectory = join(homedir(), 'Movies', 'SayaLens', 'Recordings')
    this.ensureDirectoryExists()
  }

  async startRecording(settings: RecordingSettings): Promise<RecordingResult> {
    try {
      console.log('Starting screen recording with settings:', settings)

      const hasPermission = await this.checkPermissions()
      if (!hasPermission) {
        throw new Error('Screen recording permission not granted')
      }

      // Get available sources for the renderer process
      const sources = await desktopCapturer.getSources({
        types: settings.area === 'window' ? ['window'] : ['screen'],
        thumbnailSize: { width: 150, height: 150 }
      })

      if (sources.length === 0) {
        throw new Error('No screen sources available')
      }

      const sourceId = settings.sourceId || sources[0].id

      // Generate output path
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `SayaLens_Recording_${timestamp}.mp4`
      this.state.outputPath = join(this.saveDirectory, filename)

      // Set recording state
      this.state.isRecording = true
      this.state.startTime = Date.now()
      this.state.duration = 0

      this.startPerformanceMonitoring()

      console.log('Screen recording prepared successfully')
      
      // Return the sourceId and settings for the renderer process to handle
      return { 
        success: true, 
        outputPath: this.state.outputPath,
        metadata: {
          sourceId,
          settings,
          width: this.getMaxWidth(settings.quality),
          height: this.getMaxHeight(settings.quality),
          fps: settings.framerate,
          codec: 'h264'
        }
      }

    } catch (error) {
      console.error('Failed to start recording:', error)
      await this.cleanup()
      return { success: false, error: (error as Error).message }
    }
  }

  async stopRecording(): Promise<RecordingResult> {
    try {
      if (!this.mediaRecorder || !this.state.isRecording) {
        throw new Error('No active recording to stop')
      }

      console.log('Stopping screen recording...')

      return new Promise((resolve) => {
        if (this.mediaRecorder) {
          this.mediaRecorder.addEventListener('stop', async () => {
            try {
              const result = await this.saveRecording()
              await this.cleanup()
              resolve(result)
            } catch (error) {
              resolve({ success: false, error: (error as Error).message })
            }
          }, { once: true })

          this.mediaRecorder.stop()
        }
      })

    } catch (error) {
      await this.cleanup()
      return { success: false, error: (error as Error).message }
    }
  }

  async checkPermissions(): Promise<boolean> {
    try {
      if (process.platform === 'darwin') {
        const status = systemPreferences.getMediaAccessStatus('screen')
        console.log('macOS screen recording permission status:', status)
        
        if (status === 'denied') {
          await this.showPermissionDialog()
          return false
        }
        
        if (status === 'not-determined') {
          const granted = await systemPreferences.askForMediaAccess('screen' as any)
          return granted
        }
        
        return status === 'granted'
      }
      
      return true
      
    } catch (error) {
      console.error('Permission check failed:', error)
      return false
    }
  }


  private async saveRecording(): Promise<RecordingResult> {
    try {
      if (this.chunks.length === 0) {
        throw new Error('No recording data to save')
      }

      const blob = new Blob(this.chunks, { type: 'video/mp4' })
      const buffer = Buffer.from(await blob.arrayBuffer())

      await writeFile(this.state.outputPath, buffer)

      const fileSize = buffer.length
      const duration = Date.now() - this.state.startTime

      return {
        success: true,
        outputPath: this.state.outputPath,
        duration: duration,
        fileSize: fileSize,
        metadata: {
          width: 1920,
          height: 1080,
          fps: 30,
          codec: 'h264'
        }
      }

    } catch (error) {
      console.error('Failed to save recording:', error)
      throw error
    }
  }

  private async showPermissionDialog(): Promise<void> {
    const result = await dialog.showMessageBox({
      type: 'error',
      title: 'Screen Recording Permission Required',
      message: 'SayaLens needs permission to record your screen.',
      detail: 'Go to System Settings > Privacy & Security > Screen Recording and enable SayaLens.',
      buttons: ['Open System Settings', 'Cancel'],
      defaultId: 0
    })

    if (result.response === 0) {
      await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture')
    }
  }

  private startPerformanceMonitoring(): void {
    this.performanceMonitor = setInterval(() => {
      this.checkMemoryUsage()
      this.updateRecordingDuration()
    }, 1000)
  }

  private checkMemoryUsage(): void {
    const usage = process.memoryUsage()
    this.state.memoryUsage = Math.round(usage.heapUsed / 1024 / 1024)

    if (this.state.memoryUsage > 500) {
      console.warn(`High memory usage: ${this.state.memoryUsage}MB`)
    }
  }

  private updateRecordingDuration(): void {
    if (this.state.isRecording) {
      this.state.duration = Date.now() - this.state.startTime
      
      const maxDurationMs = 30 * 60 * 1000 // 30 minutes
      if (this.state.duration > maxDurationMs) {
        console.warn('Max recording duration reached')
        this.stopRecording()
      }
    }
  }

  private async cleanup(): Promise<void> {
    try {
      if (this.performanceMonitor) {
        clearInterval(this.performanceMonitor)
        this.performanceMonitor = null
      }

      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop())
        this.stream = null
      }

      this.state.isRecording = false
      this.state.isPaused = false
      this.mediaRecorder = null
      this.chunks = []

    } catch (error) {
      console.error('Error during cleanup:', error)
    }
  }

  private async ensureDirectoryExists(): Promise<void> {
    try {
      await access(this.saveDirectory)
    } catch {
      await mkdir(this.saveDirectory, { recursive: true })
      console.log('Created recordings directory:', this.saveDirectory)
    }
  }


  private getMaxWidth(quality: string): number {
    switch (quality) {
      case 'low': return 1280
      case 'medium': return 1920
      case 'high': return 2560
      default: return 1920
    }
  }

  private getMaxHeight(quality: string): number {
    switch (quality) {
      case 'low': return 720
      case 'medium': return 1080
      case 'high': return 1440
      default: return 1080
    }
  }

  getState(): RecordingState {
    return { ...this.state }
  }

  isRecording(): boolean {
    return this.state.isRecording
  }

  async pauseRecording(): Promise<void> {
    if (this.mediaRecorder && this.state.isRecording && !this.state.isPaused) {
      this.mediaRecorder.pause()
      this.state.isPaused = true
      console.log('Recording paused')
    }
  }

  async resumeRecording(): Promise<void> {
    if (this.mediaRecorder && this.state.isRecording && this.state.isPaused) {
      this.mediaRecorder.resume()
      this.state.isPaused = false
      console.log('Recording resumed')
    }
  }
}

export type { RecordingSettings, RecordingState, RecordingResult }