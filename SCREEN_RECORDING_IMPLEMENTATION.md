# Screen Recording Feature Implementation Plan

## Overview

This document outlines the step-by-step implementation plan for adding screen recording capabilities to SayaLens with support for .mp4 and .gif export formats.

## User Experience Flow

### 1. Initiation
- User clicks "Record Screen" from system tray menu
- Control panel window appears with pre-recording settings

### 2. Pre-Recording Settings (Control Panel)
- **Recording Area**: Full Screen, Selected Window, or Custom Area
- **Audio Input**: System Audio, Microphone, Both, or None
- **Timer/Countdown**: Optional countdown (3-5 seconds)
- **Output Settings**: Video resolution, frame rate, file format

### 3. Recording in Progress
- Control panel changes color (red) with elapsed time
- System tray shows recording indicator
- Thin red border around recorded area
- Pause/Resume and Stop buttons available

### 4. Post-Recording Actions
- Recording complete notification
- Dedicated result window with options:
  - Open File Location
  - Preview/Play Recording
  - Rename File
  - Export as MP4 or GIF

## Technical Architecture

### Core Components

```
src/
├── main/
│   └── modules/
│       ├── screenRecorder.ts          # New - Core recording logic
│       └── videoProcessor.ts          # New - Format conversion
├── renderer/
│   └── src/
│       └── pages/
│           ├── ControlPanel.tsx       # New - Recording control panel
│           └── RecordingResult.tsx    # New - Post-recording UI
└── preload/
    └── index.ts                       # Extended - New IPC methods
```

## Step-by-Step Implementation

### Phase 0: Technical Validation & Proof of Concept

#### Step 0.1: Desktop Capture API Validation
**Goal**: Validate MediaRecorder with desktopCapturer works across platforms
```typescript
// Test basic screen recording capability
const sources = await desktopCapturer.getSources({ types: ['screen'] })
const stream = await navigator.mediaDevices.getUserMedia({
  audio: false,
  video: {
    mandatory: {
      chromeMediaSource: 'desktop', 
      chromeMediaSourceId: sources[0].id
    }
  }
})
const recorder = new MediaRecorder(stream)
```

#### Step 0.2: Permission System Validation
**macOS Specific**: Test screen recording permissions
```typescript
// macOS requires different permissions for recording vs capture
import { systemPreferences } from 'electron'

const status = systemPreferences.getMediaAccessStatus('screen')
if (status !== 'granted') {
  await systemPreferences.askForMediaAccess('screen')
}
```

#### Step 0.3: Audio Capture Testing
**Platform Testing**: Validate system audio capture per platform
- **macOS**: Test with Soundflower/BlackHole virtual audio devices
- **Windows**: Test with DirectShow/WASAPI
- **Linux**: Test with PulseAudio

#### Step 0.4: Memory & Performance Baseline
**Goal**: Establish performance benchmarks
- Test recording duration limits before memory issues
- Measure CPU usage during recording
- Test file size scaling with duration/quality

#### Step 0.5: File Format Validation
**Goal**: Test alternative conversion methods
```typescript
// Alternative to FFmpeg: Canvas-based GIF conversion
const canvas = document.createElement('canvas')
const ctx = canvas.getContext('2d')
// Process video frames to GIF using gif-encoder-2
```

### Phase 1: Core Infrastructure Setup

#### Step 1.1: Install Dependencies
```bash
# Core recording dependencies
yarn add gif-encoder-2 canvas react-draggable

# Optional advanced video processing (Phase 3+)
yarn add fluent-ffmpeg @ffmpeg/ffmpeg
yarn add -D @types/fluent-ffmpeg

# Platform-specific audio (if implementing audio capture)
# macOS: No additional deps (use built-in AVAudioEngine bindings)
# Windows: yarn add node-audio (for WASAPI support)
# Linux: yarn add pulseaudio (for PulseAudio support)
```

**Dependency Strategy**:
- **Phase 1**: Basic MP4 recording only (built-in MediaRecorder)
- **Phase 2**: Canvas-based GIF conversion (gif-encoder-2)
- **Phase 3**: Advanced FFmpeg features (compression, formats)
- **Phase 4**: Platform-specific audio capture

#### Step 1.2: Create Screen Recorder Module
**File**: `src/main/modules/screenRecorder.ts`

```typescript
import { desktopCapturer, systemPreferences } from 'electron'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'

interface RecordingSettings {
  area: 'fullscreen' | 'window' | 'custom'
  bounds?: { x: number; y: number; width: number; height: number }
  sourceId?: string // For specific window/screen selection
  audio: 'none' | 'microphone' // Start simple, system audio in Phase 4
  format: 'mp4' // GIF conversion handled by VideoProcessor
  quality: 'low' | 'medium' | 'high'
  framerate: 30 | 60
  countdown: number
  maxDuration: number // Prevent runaway recordings
  maxFileSize: number // MB limit
}

interface RecordingState {
  isRecording: boolean
  isPaused: boolean
  startTime: number
  duration: number
  outputPath: string
  tempFiles: string[] // For crash recovery
  memoryUsage: number
  fileSize: number
}

interface RecordingPreferences {
  defaultQuality: string
  defaultFormat: string
  defaultAudio: string
  saveLocation: string
  autoCleanup: boolean
  maxRecordings: number
}

export default class ScreenRecorder {
  private mediaRecorder: MediaRecorder | null = null
  private stream: MediaStream | null = null
  private state: RecordingState
  private chunks: Blob[] = []
  private preferences: RecordingPreferences
  private performanceMonitor: NodeJS.Timer | null = null

  constructor() {
    this.loadPreferences()
    this.setupCrashRecovery()
  }

  // Core recording methods
  async startRecording(settings: RecordingSettings): Promise<void>
  async pauseRecording(): Promise<void>
  async resumeRecording(): Promise<void>
  async stopRecording(): Promise<RecordingResult>

  // Permission and setup methods
  async checkPermissions(): Promise<boolean>
  private async requestScreenRecordingPermission(): Promise<boolean>
  private async getMediaStream(settings: RecordingSettings): Promise<MediaStream>

  // File and memory management
  private async saveRecording(blob: Blob): Promise<string>
  private startPerformanceMonitoring(): void
  private checkMemoryUsage(): void
  private cleanupTempFiles(): void

  // Configuration and recovery
  private loadPreferences(): void
  private savePreferences(): void
  private setupCrashRecovery(): void
  private recoverFromCrash(): Promise<void>
}
```

#### Step 1.3: Create Video Processor Module  
**File**: `src/main/modules/videoProcessor.ts`

```typescript
import * as GIFEncoder from 'gif-encoder-2'
import { createCanvas } from 'canvas'
import * as ffmpeg from 'fluent-ffmpeg' // Optional, Phase 3+

interface GifOptions {
  width?: number
  height?: number
  fps?: number
  quality?: number
  colors?: number
  loop?: boolean
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

export default class VideoProcessor {
  private conversionQueue: ConversionJob[] = []
  private isProcessing: boolean = false

  // Phase 2: Canvas-based GIF conversion (lightweight)
  async convertMp4ToGifCanvas(
    inputPath: string,
    outputPath: string, 
    options: GifOptions = {}
  ): Promise<ConversionResult>

  // Phase 3+: FFmpeg-based conversion (advanced features)
  async convertMp4ToGifFFmpeg(
    inputPath: string,
    outputPath: string,
    options: GifOptions
  ): Promise<ConversionResult>

  // Metadata and utility methods
  async getVideoMetadata(filePath: string): Promise<VideoMetadata>
  async compressVideo(inputPath: string, outputPath: string, quality: string): Promise<string>
  async generateThumbnail(videoPath: string): Promise<string>

  // Performance and queue management
  private async processConversionQueue(): Promise<void>
  private estimateConversionTime(metadata: VideoMetadata): number
  private optimizeGifSettings(metadata: VideoMetadata): GifOptions
  
  // Progress and error handling
  private onProgress(callback: (progress: number) => void): void
  private onError(callback: (error: Error) => void): void
  private validateInputFile(filePath: string): Promise<boolean>

  // Platform-specific optimizations
  private getOptimalWorkerCount(): number
  private setupPlatformSpecificCodecs(): void
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
```

### Phase 2: User Interface Components

#### Step 2.1: Create Control Panel Component
**File**: `src/renderer/src/pages/ControlPanel.tsx`

**Features**:
- Draggable window with position persistence
- Recording settings form with validation
- Real-time recording controls
- Visual recording indicators
- Countdown timer with audio cues
- Area selection UI (Custom Area mode)
- Performance monitoring display

```typescript
import React, { useState, useEffect, useRef } from 'react'
import Draggable from 'react-draggable'

interface AreaSelection {
  x: number
  y: number
  width: number
  height: number
  isSelecting: boolean
}

export default function ControlPanel() {
  // State management
  const [settings, setSettings] = useState<RecordingSettings>()
  const [state, setState] = useState<RecordingState>()
  const [countdown, setCountdown] = useState<number>(0)
  const [areaSelection, setAreaSelection] = useState<AreaSelection | null>(null)
  const [availableSources, setAvailableSources] = useState<any[]>([])
  const [performance, setPerformance] = useState<PerformanceMetrics>()
  
  // Refs
  const selectionOverlayRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Area selection methods
  const startAreaSelection = () => void
  const updateAreaSelection = (bounds: AreaSelection) => void
  const confirmAreaSelection = () => void
  const cancelAreaSelection = () => void

  // Recording control methods
  const startRecording = async () => void
  const pauseResumeRecording = async () => void
  const stopRecording = async () => void

  // Settings persistence
  const loadSettings = () => void
  const saveSettings = (newSettings: RecordingSettings) => void

  // Permission handling
  const checkAndRequestPermissions = async () => boolean
  const showPermissionDialog = () => void

  // Performance monitoring
  const updatePerformanceMetrics = () => void

  return (
    <Draggable handle=".drag-handle" defaultPosition={{ x: 100, y: 100 }}>
      <div ref={panelRef} className="control-panel">
        {/* Area Selection Overlay */}
        {areaSelection?.isSelecting && (
          <AreaSelectionOverlay 
            selection={areaSelection}
            onUpdate={updateAreaSelection}
            onConfirm={confirmAreaSelection}
            onCancel={cancelAreaSelection}
          />
        )}

        {/* Main Control Panel UI */}
        <ControlPanelContent 
          settings={settings}
          state={state}
          countdown={countdown}
          performance={performance}
          onSettingsChange={setSettings}
          onStartRecording={startRecording}
          onPauseResume={pauseResumeRecording}
          onStopRecording={stopRecording}
          onAreaSelection={startAreaSelection}
        />
      </div>
    </Draggable>
  )
}

// Separate component for area selection overlay
const AreaSelectionOverlay: React.FC<AreaSelectionOverlayProps> = ({ ... }) => {
  return (
    <div className="fixed inset-0 z-50">
      {/* Selection rectangle with resize handles */}
      <SelectionRectangle />
      {/* Instructions overlay */}
      <InstructionsPanel />
    </div>
  )
}
```

#### Step 2.2: Create Recording Result Page
**File**: `src/renderer/src/pages/RecordingResult.tsx`

**Features**:
- File information display
- Preview functionality
- Rename capability
- Export file as MP4 or GIF
- File management actions

### Phase 3: System Integration

#### Step 3.1: Extend Main Process
**File**: `src/main/index.ts`

**Add to TrayScanner class** (following existing module pattern):
```typescript
// Follow existing pattern from line 40-44
private screenRecorder: ScreenRecorder | null = null
private videoProcessor: VideoProcessor | null = null
private controlPanelWindow: BrowserWindow | null = null
private recordingResultWindow: BrowserWindow | null = null

// Add to init() method around line 76-79 (after existing modules)
this.screenRecorder = new ScreenRecorder()
this.videoProcessor = new VideoProcessor()

// Permission checks - enhance existing checkInitialPermissions() method
private checkInitialPermissions(): void {
  try {
    console.log('Checking screen capture permissions...')
    const hasCapturePermission = this.screenCapture?.checkPermissions()
    
    // NEW: Check screen recording permissions (different from capture)
    if (process.platform === 'darwin') {
      const hasRecordingPermission = this.screenRecorder?.checkPermissions()
      if (!hasRecordingPermission) {
        console.warn('Screen recording permission not granted.')
      }
    }
  } catch (error) {
    console.warn('Permission check failed:', error)
  }
}

// New methods
private async startScreenRecording(): Promise<void>
private createControlPanel(): void
private createRecordingResultWindow(data: RecordingResultData): void
private updateTrayIconForRecording(isRecording: boolean): void

// Error handling and recovery
private handleRecordingError(error: Error): void
private async recoverFromRecordingCrash(): Promise<void>
```

**New IPC Handlers**:
```typescript
// Recording control
ipcMain.handle('start-recording', async (_event, settings) => {...})
ipcMain.handle('stop-recording', async () => {...})
ipcMain.handle('pause-recording', async () => {...})
ipcMain.handle('resume-recording', async () => {...})

// File operations
ipcMain.handle('open-file-location', async (_event, filePath) => {...})
ipcMain.handle('preview-recording', async (_event, filePath) => {...})
ipcMain.handle('rename-recording', async (_event, filePath, newName) => {...})
ipcMain.handle('convert-to-gif', async (_event, filePath) => {...})
```

#### Step 3.2: Extend Preload API
**File**: `src/preload/index.ts`

```typescript
const api = {
  // ... existing APIs
  
  // Recording APIs
  startRecording: (settings: RecordingSettings) => 
    ipcRenderer.invoke('start-recording', settings),
  stopRecording: () => 
    ipcRenderer.invoke('stop-recording'),
  pauseRecording: () => 
    ipcRenderer.invoke('pause-recording'),
  resumeRecording: () => 
    ipcRenderer.invoke('resume-recording'),
    
  // File operations
  openFileLocation: (filePath: string) => 
    ipcRenderer.invoke('open-file-location', filePath),
  previewRecording: (filePath: string) => 
    ipcRenderer.invoke('preview-recording', filePath),
  renameRecording: (filePath: string, newName: string) => 
    ipcRenderer.invoke('rename-recording', filePath, newName),
  convertToGif: (filePath: string) => 
    ipcRenderer.invoke('convert-to-gif', filePath),
    
  // Event listeners
  onRecordingStateChange: (callback: Function) => 
    ipcRenderer.on('recording-state-change', callback),
  onRecordingComplete: (callback: Function) => 
    ipcRenderer.on('recording-complete', callback),
  onConversionProgress: (callback: Function) => 
    ipcRenderer.on('conversion-progress', callback)
}
```

#### Step 3.3: Update System Tray
**File**: `src/main/index.ts` - Extend tray menu

```typescript
const contextMenu = Menu.buildFromTemplate([
  {
    label: `Capture Text`,
    // ... existing
  },
  {
    label: `Scan QR`,
    // ... existing  
  },
  { type: 'separator' },
  {
    label: 'Record Screen',           // NEW
    click: async () => {
      console.log('Tray action: Record Screen')
      await this.analytics?.trayActionUsed('Record Screen')
      this.startScreenRecording()
    }
  },
  // ... rest of existing menu
])
```

#### Step 3.4: Update Router
**File**: `src/renderer/src/main.tsx`

```typescript
<Routes>
  <Route path="/" element={<MainMenu />} />
  <Route path="/capture" element={<Capture />} />
  <Route path="/result" element={<Result />} />
  <Route path="/control-panel" element={<ControlPanel />} />      {/* NEW */}
  <Route path="/recording-result" element={<RecordingResult />} /> {/* NEW */}
  <Route path="/about" element={<About />} />
</Routes>
```

### Phase 4: Visual Enhancements

#### Step 4.1: Recording Indicators
- **System Tray**: Red dot indicator during recording
- **Recording Border**: Thin red border around capture area
- **Control Panel**: Color change (red background) during recording

#### Step 4.2: Drag and Drop Support
- Make control panel draggable using `react-draggable`
- Save position preferences

#### Step 4.3: Keyboard Shortcuts
```typescript
// Global shortcuts
globalShortcut.register('CommandOrControl+Shift+3', () => {
  this.startScreenRecording()
})

globalShortcut.register('Escape', () => {
  if (this.screenRecorder?.isRecording) {
    this.screenRecorder.stopRecording()
  }
})
```

### Phase 5: File Management & Processing

#### Step 5.1: File Storage Structure
```
~/Movies/SayaLens/
├── Recordings/
│   ├── 2024-01-15_14-30-22.mp4
│   ├── 2024-01-15_14-32-45.gif
│   └── ...
└── Temp/
    ├── processing/
    └── conversion/
```

#### Step 5.2: Format Conversion
- **MP4 to GIF**: Using FFmpeg with optimization
- **Progress tracking**: Real-time conversion progress
- **Quality options**: Different compression levels

#### Step 5.3: File Operations
- **Rename**: Atomic file system operations
- **Preview**: Open with default system player
- **File location**: Open in Finder/Explorer

### Phase 6: Analytics & Error Handling

#### Step 6.1: Analytics Events
**File**: `src/lib/analytics.ts`

```typescript
export class Analytics {
  // ... existing methods
  
  // Recording lifecycle events
  static async recordingStarted(settings: RecordingSettings): Promise<void>
  static async recordingCompleted(duration: number, format: string): Promise<void>
  static async recordingFailed(error: string, stage: string): Promise<void>
  static async recordingPaused(duration: number): Promise<void>
  static async recordingResumed(): Promise<void>

  // Performance and quality metrics
  static async recordingPerformance(metrics: PerformanceMetrics): Promise<void>
  static async memoryUsageAlert(usage: number): Promise<void>
  static async fileSize(size: number, duration: number): Promise<void>

  // Format conversion events
  static async formatConverted(fromFormat: string, toFormat: string, duration: number): Promise<void>
  static async conversionFailed(error: string, format: string): Promise<void>

  // User interaction events
  static async recordingAction(action: string): Promise<void>
  static async areaSelectionUsed(area: string): Promise<void>
  static async settingsChanged(setting: string, value: any): Promise<void>

  // Error and recovery events
  static async permissionDenied(platform: string, permissionType: string): Promise<void>
  static async crashRecovery(tempFilesFound: number): Promise<void>
  static async diskSpaceWarning(availableSpace: number): Promise<void>
}
```

#### Step 6.2: Comprehensive Error Handling

##### **Permission Errors**
```typescript
class PermissionHandler {
  static async handleScreenRecordingPermission(): Promise<boolean> {
    if (process.platform === 'darwin') {
      const status = systemPreferences.getMediaAccessStatus('screen')
      if (status === 'denied') {
        return this.showMacOSPermissionDialog()
      }
      if (status === 'not-determined') {
        return await systemPreferences.askForMediaAccess('screen')
      }
    }
    return true
  }

  static showMacOSPermissionDialog(): boolean {
    dialog.showMessageBox({
      type: 'error',
      title: 'Screen Recording Permission Required',
      message: 'SayaLens needs permission to record your screen.',
      detail: 'Go to System Settings > Privacy & Security > Screen Recording and enable SayaLens.',
      buttons: ['Open System Settings', 'Cancel']
    }).then((result) => {
      if (result.response === 0) {
        shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture')
      }
    })
    return false
  }
}
```

##### **Storage & Disk Space Management**
```typescript
class StorageManager {
  static async checkAvailableSpace(): Promise<{ available: number, required: number }> {
    // Estimate space needed based on recording settings
    // Check available disk space
    // Return recommendation
  }

  static async handleInsufficientSpace(): Promise<boolean> {
    // Show dialog with cleanup options
    // Offer to change recording quality
    // Suggest different storage location
  }

  static async cleanupOldRecordings(): Promise<void> {
    // Remove recordings older than X days
    // Keep only Y most recent recordings
    // Clean up temp files
  }
}
```

##### **Recording Failure Recovery**
```typescript
class RecordingErrorHandler {
  static async handleRecordingFailure(error: Error, stage: string): Promise<void> {
    console.error(`Recording failed at ${stage}:`, error)
    
    switch (error.name) {
      case 'NotAllowedError':
        await PermissionHandler.handleScreenRecordingPermission()
        break
      case 'QuotaExceededError':
        await StorageManager.handleInsufficientSpace()
        break
      case 'NetworkError':
        this.handleNetworkFailure()
        break
      default:
        this.handleUnknownError(error)
    }
    
    await Analytics.recordingFailed(error.message, stage)
  }

  static async recoverPartialRecording(tempFiles: string[]): Promise<boolean> {
    // Attempt to salvage partial recording
    // Show user recovery options
    // Clean up corrupted files
  }
}
```

##### **Platform-Specific Error Handling**
```typescript
class PlatformErrorHandler {
  static async handleMacOSErrors(error: Error): Promise<void> {
    // Handle sandbox restrictions
    // Deal with macOS-specific codec issues
    // Handle Gatekeeper warnings
  }

  static async handleWindowsErrors(error: Error): Promise<void> {
    // Handle Windows Media Foundation issues
    // Deal with antivirus interference
    // Handle UAC permission problems
  }

  static async handleLinuxErrors(error: Error): Promise<void> {
    // Handle X11 vs Wayland differences
    // Deal with PulseAudio/ALSA issues
    // Handle different desktop environments
  }
}
```

### Phase 7: Testing Strategy

#### Step 7.1: Unit Tests
```typescript
// Test files to create
tests/
├── screenRecorder.test.js
├── videoProcessor.test.js
├── controlPanel.test.js
└── recordingResult.test.js
```

#### Step 7.2: Integration Tests
- **End-to-end recording flow**
- **Format conversion pipeline**
- **File operations**
- **UI state management**

#### Step 7.3: Performance Tests
- **Memory usage during recording**
- **CPU impact measurement**
- **Large file handling**
- **Conversion speed benchmarks**

## Critical Platform-Specific Considerations

### macOS Implementation Details
```typescript
// Required entitlements for screen recording
"com.apple.security.device.screen-recording": true
"com.apple.security.files.user-selected.read-write": true

// Permission handling specific to macOS
const checkMacOSPermissions = async (): Promise<boolean> => {
  const screenRecordingStatus = systemPreferences.getMediaAccessStatus('screen')
  if (screenRecordingStatus !== 'granted') {
    const granted = await systemPreferences.askForMediaAccess('screen')
    if (!granted) {
      // Guide user to System Settings
      shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture')
      return false
    }
  }
  return true
}

// macOS-specific challenges:
// 1. Sandbox restrictions for file access
// 2. Gatekeeper warnings for unsigned builds
// 3. Different behavior for menu bar vs dock apps
// 4. Hardware acceleration differences on Apple Silicon
```

### Windows Implementation Details
```typescript
// Windows-specific media access
const getWindowsMediaStream = async (sourceId: string): Promise<MediaStream> => {
  // Use DirectShow/Media Foundation
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: sourceId
      }
    },
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: sourceId
      }
    }
  })
  return stream
}

// Windows-specific challenges:
// 1. UAC (User Access Control) permission dialogs
// 2. Windows Defender/antivirus interference
// 3. Different codecs available on different Windows versions
// 4. DPI scaling issues for area selection
// 5. Windows Media Foundation vs DirectShow compatibility
```

### Linux Implementation Details
```typescript
// Linux display server detection
const getLinuxDisplayInfo = (): { server: 'x11' | 'wayland', session: string } => {
  if (process.env.WAYLAND_DISPLAY) return { server: 'wayland', session: process.env.WAYLAND_DISPLAY }
  if (process.env.DISPLAY) return { server: 'x11', session: process.env.DISPLAY }
  throw new Error('Unable to detect display server')
}

// Platform-specific capture methods
const getLinuxMediaStream = async (displayInfo: DisplayInfo): Promise<MediaStream> => {
  if (displayInfo.server === 'wayland') {
    // Use portal-based capture for Wayland
    return getWaylandStream()
  } else {
    // Use X11-based capture
    return getX11Stream()
  }
}

// Linux-specific challenges:
// 1. X11 vs Wayland differences
// 2. Different desktop environments (GNOME, KDE, etc.)
// 3. Audio system variations (PulseAudio, ALSA, PipeWire)
// 4. Permission models vary by distribution
// 5. Flatpak/Snap sandboxing considerations
```

## Updated Technical Considerations

### Performance & Memory Management
```typescript
interface PerformanceMetrics {
  memoryUsage: number      // MB
  cpuUsage: number        // Percentage  
  frameDropCount: number   // Dropped frames
  encodingLatency: number  // ms
  diskWriteSpeed: number   // MB/s
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics
  private warningThresholds = {
    memoryUsage: 512,     // MB
    cpuUsage: 60,         // %
    frameDropRate: 0.05   // 5%
  }

  startMonitoring(): void {
    // Monitor system resources every second
    // Alert if thresholds exceeded
    // Auto-adjust quality if performance drops
  }

  optimizeSettings(currentMetrics: PerformanceMetrics): RecordingSettings {
    // Reduce quality if performance is poor
    // Adjust framerate based on CPU usage
    // Switch to lower resolution if memory constrained
  }
}
```

### File System & Storage Strategy
```typescript
interface StorageConfig {
  baseDirectory: string           // ~/Movies/SayaLens/
  maxRecordingDuration: number   // 30 minutes default
  maxFileSize: number            // 2GB limit
  autoCleanupDays: number        // 30 days
  maxStorageUsage: number        // 10GB total
}

class FileSystemManager {
  async ensureStorageAvailable(estimatedSize: number): Promise<boolean> {
    const available = await this.getAvailableSpace()
    if (available < estimatedSize * 1.5) { // 50% buffer
      return this.handleInsufficientStorage(estimatedSize)
    }
    return true
  }

  async streamToDisk(chunks: Blob[], filePath: string): Promise<void> {
    // Stream directly to disk instead of accumulating in memory
    // Use Node.js streams for better memory management
  }
}
```

### Security & Privacy
- **Data isolation**: No telemetry during recording
- **Temporary file encryption**: Encrypt temp files on disk
- **Secure cleanup**: Overwrite deleted recording data
- **Permission principle**: Request minimal permissions needed
- **User control**: Clear indicators when recording is active

### Network Dependencies (FFmpeg)
```typescript
class FFmpegManager {
  async ensureFFmpegAvailable(): Promise<boolean> {
    // Check if FFmpeg is bundled with app
    if (this.isBundled()) return true
    
    // Check if system FFmpeg is available
    if (await this.isSystemFFmpegAvailable()) return true
    
    // Download FFmpeg if needed (with user consent)
    return this.downloadFFmpeg()
  }

  async downloadFFmpeg(): Promise<boolean> {
    // Show download dialog
    // Download appropriate binary for platform
    // Verify checksum
    // Handle download failures gracefully
  }
}
```

## Success Metrics

### Phase 0 Validation Criteria
- [ ] **MediaRecorder API**: Successfully record 30-second clips on all platforms
- [ ] **Permissions**: Proper screen recording permissions on macOS
- [ ] **Memory Usage**: <200MB RAM during 5-minute recording
- [ ] **File Size**: Predictable file sizes (estimate within 20% accuracy)
- [ ] **GIF Conversion**: Canvas-based conversion works for <30 seconds

### Phase 1 Success Criteria  
- [ ] **Basic Recording**: MP4 recording with pause/resume
- [ ] **Area Selection**: Custom area selection with visual feedback
- [ ] **Integration**: Seamless integration with existing SayaLens tray
- [ ] **Error Handling**: Graceful permission and storage error handling
- [ ] **Performance**: <5% CPU overhead during recording

### Phase 2+ Success Criteria
- [ ] **Format Support**: MP4 and GIF export working reliably
- [ ] **UX Excellence**: Intuitive control panel and result management
- [ ] **Reliability**: <1% failure rate in recordings
- [ ] **Cross-Platform**: Feature parity across macOS, Windows, Linux
- [ ] **Storage Management**: Intelligent cleanup and space management

## Risk Assessment & Mitigation

### High-Risk Areas
1. **Platform Permissions** (macOS) - *Mitigation*: Phase 0 validation
2. **Memory Management** - *Mitigation*: Streaming to disk, performance monitoring
3. **File Format Support** - *Mitigation*: Canvas fallback for GIF conversion
4. **Audio Capture Complexity** - *Mitigation*: Start with no audio, add incrementally

### Medium-Risk Areas
1. **Area Selection UI** - *Mitigation*: Use existing overlay patterns from capture
2. **FFmpeg Integration** - *Mitigation*: Make optional, provide alternatives
3. **Cross-Platform Testing** - *Mitigation*: Early testing on all platforms

---

## Updated Next Steps

1. ✅ **Phase 0 is Critical** - Do NOT skip technical validation
2. **Create proof-of-concept branch** (`feature/screen-record-poc`)
3. **Implement Phase 0 validation** (1-2 days)
4. **Review Phase 0 results** before proceeding to Phase 1
5. **Begin Phase 1** only after Phase 0 success criteria met
6. **Implement in small, testable increments** with frequent validation

### Immediate Action Items
- [ ] Set up development environment with updated dependencies
- [ ] Create basic MediaRecorder + desktopCapturer test
- [ ] Test screen recording permissions on macOS
- [ ] Validate memory usage patterns
- [ ] Create Canvas-based GIF conversion prototype

