# SayaLens

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Electron](https://img.shields.io/badge/Electron-32.0.1-47848F?logo=electron)](https://electronjs.org)
[![React](https://img.shields.io/badge/React-19.1.1-61DAFB?logo=react)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.2-3178C6?logo=typescript)](https://typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-7.1.3-646CFF?logo=vite)](https://vitejs.dev)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js)](https://nodejs.org)

**Effortlessly scan QR codes and extract text from your screen.** SayaLens is a streamlined macOS system tray app that makes screen scanning simple and efficient. Instead of manually typing URLs or copying text from images, just select any area of your screen and let SayaLens do the work.

Built with privacy in mind, all processing happens locally on your Mac. Whether you're capturing text from documents, scanning QR codes from presentations, or extracting information from screenshots, SayaLens provides quick, accurate results without the hassle.

![SayaLens Demo](resources/demo.gif)

## ✨ Features

- 🔍 **QR Code Scanning**: Quickly scan QR codes from any part of your screen
- 📝 **Fast OCR**: Instant text recognition and extraction from images
- 🖥️ **Screen Area Selection**: Intuitive drag-to-select interface with React UI
- 🍎 **Native macOS Integration**: Lives in your system tray for instant access
- 📋 **Clipboard Integration**: Automatically copy results to clipboard
- 🔐 **Privacy First**: All processing happens locally on your device - no data leaves your machine
- ⚡ **Lightweight**: Minimal system resources usage for optimal performance
- 🎨 **Clean UI**: Beautiful, intuitive interface with modern shadcn/ui components
- 🌍 **Multi-Language Support**: OCR supports 14+ languages including English, Arabic, Chinese, and more
- 🌓 **Dark/Light Mode Support**: Automatically adapts tray icon to macOS appearance
- 🔷 **TypeScript**: Full type safety and better development experience

## 🛠️ Tech Stack

- **Framework**: [Electron](https://electronjs.org/) with [electron-vite](https://electron-vite.org/)
- **Frontend**: [React 19](https://react.dev/) with [TypeScript](https://typescriptlang.org/)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/) with [Tailwind CSS](https://tailwindcss.com/)
- **OCR Engine**: [Tesseract.js](https://github.com/naptha/tesseract.js)
- **QR Scanner**: [jsQR](https://github.com/cozmo/jsQR)
- **Image Processing**: [Sharp](https://github.com/lovell/sharp)

## ☕ Support

If you find SayaLens useful, consider supporting the development:

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-support-yellow.svg?logo=buy-me-a-coffee&logoColor=white)](https://buymeacoffee.com/nafplann)
[![GitHub Sponsors](https://img.shields.io/badge/GitHub%20Sponsors-sponsor-EA4AAA.svg?logo=github&logoColor=white)](https://github.com/sponsors/nafplann)

## 🚀 Quick Start

### Prerequisites

- **macOS 10.15** or later
- **Node.js 18** or later
- **Yarn** package manager (recommended) or npm

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/nafplann/SayaLens.git
   cd SayaLens
   ```

2. **Install dependencies**
   ```bash
   yarn install
   # or
   npm install
   ```

3. **Run in development mode**
   ```bash
   yarn dev
   # or
   npm run dev
   ```

4. **Build for production**
   ```bash
   yarn build
   # or
   npm run build
   ```

5. **Create distributable packages**
   ```bash
   yarn dist
   # or
   npm run dist
   ```

## 📖 Usage

### Getting Started

1. **Launch the app** - The SayaLens icon will appear in your macOS menu bar
2. **Grant permissions** - When first running, you'll be prompted to grant screen recording permissions:
   - Open **System Preferences** (or **System Settings** on macOS 13+)
   - Navigate to **Privacy & Security** → **Screen Recording**
   - Add and enable **SayaLens**
   - Restart the application

### Scanning QR Codes

1. Click the **SayaLens** icon in your menu bar
2. Select **"Scan QR"**
3. Drag to select the area containing the QR code
4. Release to scan - the result will be displayed in a modern React UI and copied to your clipboard

### Extracting Text (OCR)

1. Click the **SayaLens** icon in your menu bar
2. Select **"Capture Text"**
3. Drag to select the text area
4. Release to extract - the text will be displayed with confidence score in a beautiful interface

### Keyboard Shortcuts

#### Global Shortcuts (work system-wide)
- **Cmd+Shift+1**: Start QR code scanning
- **Cmd+Shift+2**: Start text capture (OCR)

#### During Capture
- **Escape**: Cancel current selection
- **Drag & Release**: Select area and process

#### In Result Window
- **Click Copy**: Copy result to clipboard
- **Copy and Close**: Copy result and close the window

## 🛠️ Development

### Available Scripts

- `yarn dev` - Start development server with hot reload
- `yarn build` - Build the app for production
- `yarn preview` - Preview the built app
- `yarn typecheck` - Run TypeScript type checking
- `yarn pack` - Package the app without publishing
- `yarn dist` - Build and create distributable packages
- `yarn test` - Run unit tests
- `yarn test:watch` - Run tests in watch mode
- `yarn test:coverage` - Run tests with coverage report

### Project Structure

```
src/
├── main/                    # Main Electron process (TypeScript)
│   ├── index.ts            # Main entry point
│   └── modules/            # Core functionality modules
│       ├── ocrProcessor.ts  # OCR text extraction
│       ├── qrScanner.ts     # QR code scanning
│       └── screenCapture.ts # Screen capture functionality
├── preload/                # Preload scripts (TypeScript)
│   └── index.ts           # Secure IPC bridge
└── renderer/               # React frontend
    ├── index.html          # HTML entry point
    └── src/
        ├── main.tsx        # React app entry point
        ├── pages/          # React pages/components
        │   ├── Capture.tsx # Screen capture interface
        │   ├── Result.tsx  # Results display
        │   └── About.tsx   # About page with developer info and support links
        ├── components/     # Reusable React components
        │   └── ui/         # shadcn/ui components (Button, Card, Select, Badge, Separator, etc.)
        ├── lib/            # Utilities and helpers
        ├── assets/         # CSS and other assets
        └── types/          # TypeScript type definitions

resources/                  # App assets
├── appicon.png            # Application icon (used in About page)
├── tray-icon-light.png    # Tray icon for light mode
├── tray-icon-dark.png     # Tray icon for dark mode
└── demo.gif               # Demo animation for README

tests/                     # Unit tests
└── modules/              # Tests for core modules

Configuration files:
├── electron.vite.config.ts # electron-vite configuration
├── tsconfig.json          # TypeScript configuration
├── tailwind.config.js     # Tailwind CSS configuration
└── postcss.config.js      # PostCSS configuration
```

### Architecture Overview

The application follows a modern Electron + React architecture with TypeScript:

- **Main Process** (`src/main/index.ts`): Manages tray icon, windows, and IPC communication
- **Preload Scripts** (`src/preload/index.ts`): Provides secure IPC bridge between main and renderer
- **React Frontend** (`src/renderer/`): Modern React UI with shadcn/ui components
- **Core Modules** (`src/main/modules/`): Business logic for screen capture, OCR, and QR scanning
- **Type Safety**: Full TypeScript coverage for better development experience

#### Key Technologies:

- **electron-vite**: Fast build tool optimized for Electron apps
- **React 19**: Latest React with modern patterns
- **shadcn/ui**: Beautiful, accessible UI components
- **Tailwind CSS**: Utility-first CSS framework
- **TypeScript**: Type safety throughout the application

## 🔧 Configuration

### OCR Settings

The OCR processor supports multiple languages that can be selected directly in the result window UI. Supported languages include:

- **English** (`eng`) - Default
- **Arabic** (`ara`)
- **Chinese Simplified** (`chi_sim`)
- **Chinese Traditional** (`chi_tra`)
- **French** (`fra`)
- **German** (`deu`)
- **Hindi** (`hin`)
- **Italian** (`ita`)
- **Japanese** (`jpn`)
- **Korean** (`kor`)
- **Portuguese** (`por`)
- **Russian** (`rus`)
- **Spanish** (`spa`)
- **Thai** (`tha`)
- **Vietnamese** (`vie`)

The language preference is automatically saved and synced between the renderer and main process for subsequent OCR operations.

### Build Configuration

electron-vite configuration in `electron.vite.config.ts`:

```typescript
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()],
  }
})
```

### UI Customization

The app uses shadcn/ui components with Tailwind CSS. Customize the theme in `tailwind.config.js`:

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        // Customize your color palette
        primary: "hsl(var(--primary))",
        secondary: "hsl(var(--secondary))",
        // ...
      },
    },
  },
}
```

### Tray Icon Assets

For proper dark/light mode support on macOS, provide two tray icon files in the `resources/` directory:

- **`tray-icon-light.png`**: Dark icon for light mode (16x16px or 32x32px recommended)
- **`tray-icon-dark.png`**: Light icon for dark mode (16x16px or 32x32px recommended)

The application automatically switches between these icons based on the system appearance setting.

**Icon Guidelines:**
- Use simple, monochromatic designs
- Ensure good contrast against menu bar backgrounds
- Test with both light and dark menu bars
- PNG format with transparent backgrounds work best

## 🔒 Privacy & Security

- **Local Processing**: All OCR and QR scanning happens locally on your device
- **No Data Transmission**: No captured images or extracted data leaves your computer
- **Secure IPC**: Uses Electron's context isolation with TypeScript for secure communication
- **Permission-Based**: Requires explicit screen recording permission from user
- **Type Safety**: TypeScript helps prevent runtime security issues

## 🐛 Troubleshooting

### Permission Issues

**Problem**: "Screen recording permission not granted" error

**Solution**:
1. Open System Preferences/Settings
2. Go to Privacy & Security → Screen Recording
3. Add SayaLens and enable it
4. Restart the application

### Development Issues

**Problem**: Build or development server fails

**Solutions**:
- Ensure Node.js version is 18+
- Run `yarn install` to ensure all dependencies are installed
- Check that all TypeScript files compile with `yarn typecheck`
- Clear node_modules and yarn.lock, then reinstall dependencies

### OCR Accuracy Issues

**Problem**: Text extraction is inaccurate

**Solutions**:
- Ensure the text area is clearly selected
- Use higher contrast images when possible
- The app works best with printed text (not handwritten)
- Minimum confidence threshold is set to 30%

### Performance Issues

**Problem**: App feels slow or unresponsive

**Solutions**:
- Restart the application to clear memory
- Ensure your Mac meets minimum system requirements
- Close other resource-intensive applications
- electron-vite provides faster builds and hot reload in development

## 📋 System Requirements

- **OS**: macOS 10.15 (Catalina) or later
- **Memory**: 150MB RAM minimum (React + Electron)
- **Disk Space**: 250MB for installation
- **Permissions**: Screen Recording access required
- **Development**: Node.js 18+, Yarn (recommended)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Run type checking (`yarn typecheck`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Development Guidelines

- Follow existing code style and patterns
- Use TypeScript for type safety
- Follow React best practices and hooks patterns
- Use shadcn/ui components when possible
- Add unit tests for new features
- Update documentation for user-facing changes
- Test on multiple macOS versions when possible

### Code Style

- TypeScript with strict mode enabled
- React functional components with hooks
- Tailwind CSS for styling
- ESLint for code linting
- Prefer composition over inheritance

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [electron-vite](https://electron-vite.org/) - Fast build tool for Electron apps
- [React](https://react.dev/) - UI framework
- [shadcn/ui](https://ui.shadcn.com/) - Beautiful UI components
- [Tailwind CSS](https://tailwindcss.com/) - CSS framework
- [Tesseract.js](https://github.com/naptha/tesseract.js) - OCR functionality
- [jsQR](https://github.com/cozmo/jsQR) - QR code detection
- [Sharp](https://github.com/lovell/sharp) - Image processing
- [Electron](https://electronjs.org/) - Cross-platform desktop framework
- [TypeScript](https://typescriptlang.org/) - Type safety

---

**Made with ❤️ from Makassar, Indonesia for users who need quick access to modern screen scanning tools.**