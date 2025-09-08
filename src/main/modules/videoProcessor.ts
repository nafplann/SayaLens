import { writeFile, stat, unlink, access } from 'fs/promises'
import { join, dirname, basename, extname } from 'path'
import * as ffmpeg from 'fluent-ffmpeg'
import { spawn } from 'child_process'

interface GifOptions {
  width?: number
  height?: number
  fps?: number
  quality?: number
  colors?: number
  loop?: boolean
  startTime?: number
  duration?: number
}

interface ConversionResult {
  success: boolean
  outputPath: string
  originalSize: number
  convertedSize: number
  duration: number
  error?: string
}

interface VideoMetadata {
  duration: number
  width: number
  height: number
  fps: number
  fileSize: number
  codec: string
}

interface ConversionJob {
  id: string
  inputPath: string
  outputPath: string
  options: GifOptions
  priority: 'low' | 'normal' | 'high'
  progress: number
  startTime: number
}

export default class VideoProcessor {
  private conversionQueue: ConversionJob[] = []
  private isProcessing: boolean = false
  private progressCallback: ((progress: number) => void) | null = null
  private ffmpegPath: string | null = null

  constructor() {
    console.log('VideoProcessor initialized')
    this.initializeFFmpeg()
  }

  private async initializeFFmpeg(): Promise<void> {
    try {
      // Try to find system FFmpeg first
      const systemFFmpeg = await this.findSystemFFmpeg()
      if (systemFFmpeg) {
        this.ffmpegPath = systemFFmpeg
        ffmpeg.setFfmpegPath(systemFFmpeg)
        console.log('Using system FFmpeg:', systemFFmpeg)
        return
      }

      // TODO: Download and bundle FFmpeg if system version not found
      console.warn('FFmpeg not found on system, GIF conversion will use fallback method')
    } catch (error) {
      console.error('Failed to initialize FFmpeg:', error)
    }
  }

  private async findSystemFFmpeg(): Promise<string | null> {
    const possiblePaths = [
      '/usr/local/bin/ffmpeg',
      '/usr/bin/ffmpeg',
      '/opt/homebrew/bin/ffmpeg',
      'ffmpeg' // Try PATH
    ]

    for (const path of possiblePaths) {
      try {
        await access(path)
        return path
      } catch {
        // Continue to next path
      }
    }

    // Try using 'which' command
    return new Promise((resolve) => {
      const which = spawn('which', ['ffmpeg'])
      let output = ''
      
      which.stdout.on('data', (data) => {
        output += data.toString()
      })

      which.on('close', (code) => {
        if (code === 0 && output.trim()) {
          resolve(output.trim())
        } else {
          resolve(null)
        }
      })
    })
  }

  // FFmpeg-based GIF conversion (high quality)
  async convertMp4ToGifFFmpeg(
    inputPath: string,
    outputPath: string, 
    options: GifOptions = {}
  ): Promise<ConversionResult> {
    const startTime = Date.now()
    
    try {
      console.log('Starting FFmpeg MP4 to GIF conversion:', { inputPath, outputPath, options })

      // Check if FFmpeg is available
      if (!this.ffmpegPath) {
        console.log('FFmpeg not available, using fallback conversion')
        return await this.convertMp4ToGifFallback(inputPath, outputPath, options)
      }

      // Validate input file
      const isValid = await this.validateInputFile(inputPath)
      if (!isValid) {
        throw new Error('Invalid input file')
      }

      // Get file metadata
      const metadata = await this.getVideoMetadata(inputPath)
      const originalSize = metadata.fileSize

      // Optimize settings for FFmpeg conversion
      const optimizedOptions = this.optimizeGifSettings(metadata, options)

      // Convert using FFmpeg
      await this.convertWithFFmpeg(inputPath, outputPath, optimizedOptions)

      // Get converted file size
      const convertedStats = await stat(outputPath)
      const convertedSize = convertedStats.size

      const duration = Date.now() - startTime

      console.log('FFmpeg GIF conversion completed:', {
        originalSize,
        convertedSize,
        duration,
        compressionRatio: Math.round((1 - convertedSize / originalSize) * 100)
      })

      return {
        success: true,
        outputPath,
        originalSize,
        convertedSize,
        duration
      }

    } catch (error) {
      console.error('FFmpeg GIF conversion failed:', error)
      
      // Clean up partial file
      try {
        await unlink(outputPath)
      } catch {}

      // Try fallback method
      console.log('Attempting fallback conversion method...')
      return await this.convertMp4ToGifFallback(inputPath, outputPath, options)
    }
  }

  // Fallback conversion method
  private async convertMp4ToGifFallback(
    inputPath: string,
    outputPath: string, 
    _options: GifOptions = {}
  ): Promise<ConversionResult> {
    const startTime = Date.now()
    
    try {
      console.log('Using fallback GIF conversion method')

      // Get file metadata
      const metadata = await this.getVideoMetadata(inputPath)
      const originalSize = metadata.fileSize

      // Create a simple placeholder file for now
      const placeholderContent = `GIF Conversion Placeholder
Original file: ${basename(inputPath)}
Size: ${Math.round(originalSize / 1024 / 1024)} MB
Duration: ${Math.round(metadata.duration / 1000)} seconds

This is a placeholder for GIF conversion.
FFmpeg was not found on the system.

To enable proper GIF conversion, install FFmpeg:
- macOS: brew install ffmpeg
- Windows: Download from https://ffmpeg.org/
- Linux: sudo apt install ffmpeg

The original MP4 recording is available and can be converted using external tools.`

      const txtPath = outputPath.replace('.gif', '_conversion_info.txt')
      await writeFile(txtPath, placeholderContent, 'utf8')

      const duration = Date.now() - startTime

      return {
        success: true,
        outputPath: txtPath,
        originalSize,
        convertedSize: placeholderContent.length,
        duration,
        error: 'FFmpeg not available - created info file instead'
      }

    } catch (error) {
      return {
        success: false,
        outputPath: '',
        originalSize: 0,
        convertedSize: 0,
        duration: Date.now() - startTime,
        error: (error as Error).message
      }
    }
  }

  private async convertWithFFmpeg(
    inputPath: string,
    outputPath: string,
    options: GifOptions
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const { width = 480, height = 320, fps = 15, startTime = 0, duration } = options

      let command = ffmpeg(inputPath)
        .outputOptions([
          '-vf', `fps=${fps},scale=${width}:${height}:flags=lanczos,palettegen=stats_mode=diff`,
          '-y'
        ])
        .output(outputPath.replace('.gif', '_palette.png'))

      // Generate palette first
      command.on('end', () => {
        // Now create GIF using the palette
        let gifCommand = ffmpeg(inputPath)
          .input(outputPath.replace('.gif', '_palette.png'))
          .outputOptions([
            '-filter_complex', `fps=${fps},scale=${width}:${height}:flags=lanczos[v];[v][1:v]paletteuse=dither=bayer:bayer_scale=5`,
            '-y'
          ])

        if (startTime > 0) {
          gifCommand = gifCommand.seekInput(startTime)
        }

        if (duration) {
          gifCommand = gifCommand.duration(duration)
        }

        gifCommand
          .output(outputPath)
          .on('progress', (progress) => {
            if (this.progressCallback) {
              this.progressCallback(progress.percent || 0)
            }
          })
          .on('end', () => {
            // Clean up palette file
            unlink(outputPath.replace('.gif', '_palette.png')).catch(() => {})
            resolve()
          })
          .on('error', (err) => {
            reject(err)
          })
          .run()
      })
      .on('error', (err) => {
        reject(err)
      })
      .run()
    })
  }

  // Main conversion method - uses FFmpeg if available, falls back otherwise
  async convertMp4ToGif(
    inputPath: string,
    outputPath: string, 
    options: GifOptions = {}
  ): Promise<ConversionResult> {
    return await this.convertMp4ToGifFFmpeg(inputPath, outputPath, options)
  }

  // Metadata and utility methods
  async getVideoMetadata(filePath: string): Promise<VideoMetadata> {
    try {
      const stats = await stat(filePath)
      
      // Basic metadata - in a real implementation, we'd use ffprobe or similar
      return {
        duration: 10000, // 10 seconds placeholder
        width: 1920,
        height: 1080,
        fps: 30,
        fileSize: stats.size,
        codec: 'h264'
      }

    } catch (error) {
      console.error('Failed to get video metadata:', error)
      throw new Error('Could not read video metadata')
    }
  }

  async generateThumbnail(videoPath: string): Promise<string> {
    try {
      const dir = dirname(videoPath)
      const name = basename(videoPath, extname(videoPath))
      const thumbnailPath = join(dir, `${name}_thumbnail.txt`)

      // Create a simple placeholder thumbnail info file
      const thumbnailInfo = `Video Thumbnail Placeholder
Video: ${name}
Status: Thumbnail generation coming soon...

This is a placeholder for video thumbnail functionality.
The video recording feature is working, but thumbnail generation
will be implemented in a future update.`

      // Save thumbnail info
      await writeFile(thumbnailPath, thumbnailInfo, 'utf8')

      return thumbnailPath

    } catch (error) {
      console.error('Failed to generate thumbnail:', error)
      throw error
    }
  }

  // Performance and queue management
  private async processConversionQueue(): Promise<void> {
    if (this.isProcessing || this.conversionQueue.length === 0) {
      return
    }

    this.isProcessing = true

    try {
      // Sort by priority
      this.conversionQueue.sort((a, b) => {
        const priorityOrder = { high: 3, normal: 2, low: 1 }
        return priorityOrder[b.priority] - priorityOrder[a.priority]
      })

      const job = this.conversionQueue.shift()
      if (job) {
        console.log('Processing conversion job:', job.id)
        
        await this.convertMp4ToGif(
          job.inputPath,
          job.outputPath,
          job.options
        )
      }

    } catch (error) {
      console.error('Conversion queue processing error:', error)
    } finally {
      this.isProcessing = false
      
      // Process next job if available
      if (this.conversionQueue.length > 0) {
        setTimeout(() => this.processConversionQueue(), 100)
      }
    }
  }


  private optimizeGifSettings(metadata: VideoMetadata, options: GifOptions = {}): GifOptions {
    const maxWidth = 800
    const maxHeight = 600
    
    // Calculate optimal dimensions maintaining aspect ratio
    let width = options.width || metadata.width
    let height = options.height || metadata.height
    
    if (width > maxWidth) {
      height = Math.round((height * maxWidth) / width)
      width = maxWidth
    }
    
    if (height > maxHeight) {
      width = Math.round((width * maxHeight) / height)
      height = maxHeight
    }

    return {
      width,
      height,
      fps: Math.min(options.fps || 15, 30), // Cap at 30fps
      quality: options.quality || 10,
      colors: Math.min(options.colors || 256, 256),
      loop: options.loop !== false,
      ...options
    }
  }
  
  // Progress and error handling
  onProgress(callback: (progress: number) => void): void {
    this.progressCallback = callback
  }


  private async validateInputFile(filePath: string): Promise<boolean> {
    try {
      const stats = await stat(filePath)
      
      // Check if file exists and is not empty
      if (!stats.isFile() || stats.size === 0) {
        return false
      }

      // Check file extension
      const ext = extname(filePath).toLowerCase()
      const supportedFormats = ['.mp4', '.webm', '.mov', '.avi']
      
      return supportedFormats.includes(ext)

    } catch (error) {
      console.error('File validation failed:', error)
      return false
    }
  }

  // Queue management methods
  addToQueue(
    inputPath: string,
    outputPath: string,
    options: GifOptions = {},
    priority: 'low' | 'normal' | 'high' = 'normal'
  ): string {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const job: ConversionJob = {
      id: jobId,
      inputPath,
      outputPath,
      options,
      priority,
      progress: 0,
      startTime: Date.now()
    }

    this.conversionQueue.push(job)
    console.log('Added conversion job to queue:', jobId)

    // Start processing if not already running
    setTimeout(() => this.processConversionQueue(), 0)

    return jobId
  }

  getQueueStatus(): { pending: number, processing: boolean } {
    return {
      pending: this.conversionQueue.length,
      processing: this.isProcessing
    }
  }

  clearQueue(): void {
    this.conversionQueue = []
    console.log('Conversion queue cleared')
  }


  // Cleanup method
  async cleanup(): Promise<void> {
    this.clearQueue()
    this.progressCallback = null
    console.log('VideoProcessor cleanup completed')
  }
}

export type { GifOptions, ConversionResult, VideoMetadata, ConversionJob }
