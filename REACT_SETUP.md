# React TypeScript + shadcn/ui Setup

This project has been successfully converted from vanilla HTML/CSS/JS to React TypeScript with shadcn/ui for a modern, maintainable UI.

## 🚀 What's New

### Technology Stack
- **React 18.3.1** - Modern React with hooks
- **TypeScript** - Type safety and better development experience  
- **Vite** - Fast build tool and development server
- **shadcn/ui** - Modern, accessible UI components
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Beautiful icons

### Project Structure
```
src-react/              # React TypeScript source
├── components/
│   ├── ui/            # shadcn/ui components
│   ├── ScreenCapture.tsx
│   └── ResultDisplay.tsx
├── hooks/             # React hooks
├── lib/               # Utilities
├── types/             # TypeScript definitions
├── globals.css        # Global styles
├── CaptureApp.tsx     # Capture window app
├── ResultApp.tsx      # Result window app
├── capture.html       # Capture window HTML template
├── result.html        # Result window HTML template
├── capture.tsx        # Capture entry point
└── result.tsx         # Result entry point

dist-react/             # Built React files (production)
```

## 🛠️ Development Commands

```bash
# Install dependencies
npm install --legacy-peer-deps

# Development (runs React dev server + Electron)
npm run dev

# Build React app only
npm run build:react

# Build entire app for distribution
npm run build

# Build for Windows
npm run build:win
```

## 🎨 UI Components

The app now uses shadcn/ui components for a consistent, modern look:

- **Button** - Interactive buttons with variants
- **Card** - Container components for content
- **Toast** - Notification system
- **Icons** - Lucide React icons throughout

### Screen Capture UI Features
- Modern crosshair cursor with visual feedback
- Smooth selection with real-time coordinate display
- Loading states with spinner animations
- Tailwind CSS for responsive design

### Result Display Features  
- Clean card-based layout
- Copy to clipboard with toast notifications
- Responsive image display
- Keyboard shortcuts (Escape to close, Cmd+C to copy)

## 🔧 Development vs Production

**Development Mode:**
- React dev server runs on http://localhost:5173
- Hot reload for instant UI updates
- TypeScript type checking
- Source maps for debugging

**Production Mode:**
- React app is built to `dist-react/`
- Electron loads from built files
- Optimized bundles for performance

## 🎯 Key Benefits

1. **Type Safety** - Catch errors at compile time
2. **Modern UI** - shadcn/ui components with Tailwind CSS
3. **Developer Experience** - Hot reload, TypeScript IntelliSense
4. **Maintainability** - Component-based architecture
5. **Performance** - Optimized builds with Vite

## 🚦 Development Workflow

1. Start development: `npm run dev`
2. Edit React components in `src-react/`
3. Changes appear instantly with hot reload
4. Build for production: `npm run build`

The Electron main process automatically detects development vs production and loads the appropriate React app.

## 📁 File Changes Summary

- `src/capture.html` → `src-react/components/ScreenCapture.tsx`
- `src/result.html` → `src-react/components/ResultDisplay.tsx`
- `src/capture.js` → Integrated into React component
- `src/result.js` → Integrated into React component
- Added TypeScript configuration
- Added Vite build system
- Added shadcn/ui component library
- Updated Electron main process for development/production modes
