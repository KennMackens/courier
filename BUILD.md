# Building Otto

This document describes how to build Otto for distribution on Mac Silicon.

## Prerequisites

- macOS 14.2+ (Sonoma or later)
- Node.js 18+
- Xcode Command Line Tools (for native module compilation)

## Build Steps

### 1. Install Dependencies

```bash
cd desktop
npm install
```

### 2. Build the Application

```bash
# Build TypeScript (main process) and Vite (renderer)
npm run build
```

This runs:
- `tsc -p tsconfig.main.json` - Compiles main process TypeScript
- `vite build` - Bundles renderer process React app

### 3. Build Electron App (Mac Silicon only)

```bash
npx electron-builder --mac --arm64
```

This creates:
- `release/Otto-0.1.0-arm64.dmg` - Distributable DMG installer
- `release/mac-arm64/Otto.app` - Unpacked app for testing

## Build Configuration

### electron-builder config (in `package.json`)

```json
{
  "build": {
    "appId": "com.otto.app",
    "productName": "Otto",
    "directories": {
      "output": "release"
    },
    "mac": {
      "target": ["dmg"],
      "category": "public.app-category.productivity"
    },
    "files": [
      "dist/**/*",
      "node_modules/uuid/**/*",
      "node_modules/better-sqlite3/**/*",
      "node_modules/bindings/**/*",
      "node_modules/file-uri-to-path/**/*",
      "node_modules/firebase/**/*",
      "node_modules/@firebase/**/*"
    ],
    "extraResources": [
      {
        "from": "../app",
        "to": "app",
        "filter": ["**/*", "!__pycache__/**"]
      }
    ]
  }
}
```

### Required Files

- `desktop/build/icon.icns` - App icon (required for custom icon in DMG)

## Important Notes

### Dependencies in Build

The `files` config must explicitly include runtime dependencies used by the main process:
- `uuid` - For generating unique IDs
- `better-sqlite3` - SQLite database (native module)
- `bindings` / `file-uri-to-path` - Required by better-sqlite3
- `firebase` / `@firebase` - Authentication

Without these, the app will crash with "Cannot find module" errors.

### Code Signing

The build currently skips code signing. Users will see an "unidentified developer" warning and need to:
1. Right-click the app
2. Select "Open"
3. Confirm to open anyway

To enable code signing, you need a valid Apple Developer ID certificate.

### Python Backend

The Python backend (`app/` directory) is bundled as an extra resource. It requires:
- Python 3.11+ installed on the user's machine, OR
- A bundled Python distribution (see PyInstaller setup)

### Application Support Paths

Otto stores data in:
- `~/Library/Application Support/Otto/` - Database, sessions
- `~/Library/Application Support/Otto/models/` - Downloaded MLX models

## Quick Build Command

For a clean build:

```bash
cd desktop
rm -rf release/mac-arm64 release/*.dmg
npm run build && npx electron-builder --mac --arm64
```

## Output

After a successful build:
```
release/
├── Otto-0.1.0-arm64.dmg      # Distributable (~126 MB)
├── Otto-0.1.0-arm64.dmg.blockmap
├── mac-arm64/
│   └── Otto.app/             # Unpacked app for testing
└── builder-debug.yml
```

## Troubleshooting

### "Cannot find module 'xyz'"
Add the missing module to the `files` array in `package.json` build config.

### "default Electron icon is used"
Ensure `desktop/build/icon.icns` exists.

### Native module errors
Run `npm run rebuild` to rebuild native modules for Electron.

### Build fails with memory issues
Close other applications and try again, or increase Node memory:
```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```
