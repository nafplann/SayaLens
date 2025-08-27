# Google Analytics Setup for SayaLens

Google Analytics has been integrated into SayaLens to track user interactions and improve the application. This document explains how to configure and use the analytics.

## Configuration

### 1. Set up Google Analytics Measurement ID

1. Create a Google Analytics 4 property at [analytics.google.com](https://analytics.google.com)
2. Get your Measurement ID (format: `G-XXXXXXXXXX`)
3. Update the `GA_MEASUREMENT_ID` in `/src/renderer/src/lib/analytics.ts`:

```typescript
export const GA_MEASUREMENT_ID = 'G-XXXXXXXXXX' // Replace with your actual ID
```

### 2. Privacy Considerations

By default, analytics are disabled in development mode and only log to console. The analytics system:
- Respects user privacy by only tracking usage patterns, not personal data
- Processes everything locally first
- Only sends anonymized usage statistics

### 3. Tracked Events

The following events are automatically tracked:

#### App Lifecycle
- `app_started` - When the application starts
- `app_closed` - When the application closes

#### Capture Events
- `ocr_capture_started` - When OCR text capture begins
- `ocr_capture_success/ocr_capture_failed` - OCR capture results
- `qr_capture_started` - When QR code scanning begins
- `qr_capture_success/qr_capture_failed` - QR scan results

#### User Interactions
- `text_copied` - When user copies extracted text
- `language_changed` - When OCR language is changed
- `url_opened` - When external URLs are opened (About page)

#### Navigation
- Page views for each screen (Home, Capture, Result, About)

#### Main Process Events (via IPC)
- `global_shortcut_used` - When global shortcuts are triggered (Cmd/Ctrl+Shift+1/2)
- `tray_action_used` - When tray menu items are clicked (Capture Text, Scan QR, About)

#### Global Features
- Global shortcut usage (tracked from main process)
- Tray menu interactions (tracked from main process)

## File Structure

```
src/renderer/src/lib/analytics.ts     # Main analytics configuration
src/renderer/src/main.tsx             # Analytics initialization
src/renderer/src/pages/Capture.tsx    # Capture event tracking
src/renderer/src/pages/Result.tsx     # Result page interactions
src/renderer/src/pages/About.tsx      # URL opens and navigation
src/main/index.ts                     # Main process event logging
src/preload/index.ts                  # IPC bridge for analytics
src/renderer/index.html               # CSP configuration for GA
```

## Testing

In development mode, analytics events are logged to the console instead of being sent to Google Analytics. Check the browser console to see what events are being tracked.

## Building for Production

When building for production with a valid Google Analytics Measurement ID:
1. Ensure `GA_MEASUREMENT_ID` is set correctly
2. Build the application: `npm run build`
3. Analytics will automatically start tracking real usage

## Disabling Analytics

To disable analytics entirely:
1. Set `GA_MEASUREMENT_ID` to an empty string or `'G-XXXXXXXXXX'`
2. Analytics will not initialize and events will only be logged to console

## GDPR/Privacy Compliance

If deploying in regions with strict privacy laws:
1. Consider implementing user consent mechanisms
2. Add privacy policy links in the About page
3. Allow users to opt out of analytics
4. Review data collection practices with legal counsel
