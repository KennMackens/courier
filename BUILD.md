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

### 2. Build Python Backend (Required)

**IMPORTANT:** The Python backend must be bundled with PyInstaller before building the Electron app:

```bash
cd /path/to/courier
./build_python.sh
```

This creates `desktop/build/python-backend/` containing:
- `python-backend` - Standalone executable (~55MB)
- `_internal/` - Bundled runtime dependencies (typically ~250-350MB after COU-98 optimizations)

**When to rebuild Python backend:**
- After any changes to `app/*.py` files
- After updating Python dependencies in `requirements.txt`
- For initial build or clean builds

### 3. Build TypeScript and Renderer

```bash
cd desktop
npm run build
```

This runs:
- `tsc -p tsconfig.main.json` - Compiles main process TypeScript
- `vite build` - Bundles renderer process React app

### 4. Build Electron App (Mac Silicon only)

```bash
npx electron-builder --mac --arm64
```

This creates:
- `release/Otto-0.1.0-arm64.dmg` - Distributable DMG installer (~411MB)
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
        "from": "build/python-backend",
        "to": "python-backend",
        "filter": ["**/*"]
      },
      {
        "from": "../app/bin",
        "to": "bin",
        "filter": ["**/*"]
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

### Python Backend (Bundled)

The Python backend is bundled as a **standalone executable** using PyInstaller:
- **No Python installation required** on end-user machines
- All ML dependencies (MLX, faster-whisper, scipy, numpy) are included
- Entry point: `ipc_main.py` (wrapper for `app.ipc_server`)
- Audio helper: `courier-audio-helper` (Swift binary for Core Audio capture)

**Bundle optimization guardrails (COU-98):**
- Keep `pyinstaller.spec` hidden imports explicit and minimal; avoid broad `collect_submodules(...)` on heavy libraries.
- Exclude optional training/GUI/notebook frameworks (torch/tensorflow/jupyter/matplotlib) from bundled runtime.
- Treat backend size and file count as release gates before notarization.
- Current measured reference (February 12, 2026): `899MB / 7055 files` -> `277MB / 2224 files`.

Measure backend footprint after each build:

```bash
du -sh desktop/build/python-backend desktop/build/python-backend/_internal
find desktop/build/python-backend -type f | wc -l
du -sm desktop/build/python-backend/_internal/* | sort -nr | head -n 20
```

**How it works:**
1. `build_python.sh` runs PyInstaller with `pyinstaller.spec`
2. PyInstaller bundles Python + all dependencies into `desktop/build/python-backend/`
3. Electron-builder copies this to `Otto.app/Contents/Resources/python-backend/`
4. At runtime, `python-bridge.ts` spawns the bundled executable

### Application Support Paths

Otto stores data in:
- `~/Library/Application Support/Otto/` - Database, sessions
- `~/Library/Application Support/Otto/models/` - Downloaded MLX models

## Quick Build Commands

### Full Clean Build (Recommended)

Rebuilds everything from scratch:

```bash
cd /path/to/courier
./build_python.sh && cd desktop && rm -rf release/mac-arm64 release/*.dmg && npm run build && npx electron-builder --mac --arm64
```

### Incremental Build

If only Electron/TypeScript code changed (no Python changes):

```bash
cd desktop
rm -rf release/mac-arm64 release/*.dmg
npm run build && npx electron-builder --mac --arm64
```

### Signed + Notarized Release Checklist (Each Update)

Run this sequence for every production update you distribute:

```bash
# 0) from repo root
cd /Users/kennmackens/Desktop/courier

# 1) compile/bundle Python backend
./build_python.sh

# 2) build desktop app
cd desktop
npm run build

# 3) confirm signing identity exists (must show Developer ID Application)
security find-identity -v -p codesigning ~/Library/Keychains/login.keychain-db

# 4) set notarization credentials
export APPLE_API_KEY_ID="YOUR_KEY_ID"
export APPLE_API_ISSUER="YOUR_ISSUER_ID"
export APPLE_API_KEY_PATH="$HOME/.keys/AuthKey_XXXXXX.p8"
# optional fallback if signing identity auto-detection fails:
# export CSC_NAME="Developer ID Application: Kenn Mackens (WXW99U972S)"

# 5) package mac arm64 build (DMG + app)
npx electron-builder --mac --arm64

# 6) derive DMG path from app version
VERSION=$(node -p "require('./package.json').version")
DMG="release/Otto-${VERSION}-arm64.dmg"

# 7) notarize DMG
xcrun notarytool submit "$DMG" \
  --key "$APPLE_API_KEY_PATH" \
  --key-id "$APPLE_API_KEY_ID" \
  --issuer "$APPLE_API_ISSUER" \
  --wait

# 8) staple notarization ticket to DMG
xcrun stapler staple "$DMG"

# 9) verify signing + notarization
codesign --verify --deep --strict --verbose=2 "release/mac-arm64/Otto.app"
spctl --assess --type execute -v "release/mac-arm64/Otto.app"
xcrun stapler validate "$DMG"
```

If step 3 returns `0 valid identities found`, stop and fix certificate/private-key pairing in your login keychain before continuing.

## Output

After a successful build:
```
release/
├── Otto-0.1.0-arm64.dmg      # Distributable (~411 MB with bundled Python/ML)
├── Otto-0.1.0-arm64.dmg.blockmap
├── mac-arm64/
│   └── Otto.app/             # Unpacked app for testing
│       └── Contents/
│           └── Resources/
│               ├── python-backend/    # Bundled Python + dependencies
│               └── bin/              # Audio helper binary
└── builder-debug.yml
```

## Troubleshooting

### Runtime Errors on Test Devices

**Check log files first:**
- `~/Library/Logs/Otto/python-bridge.log` - Python backend startup and IPC
- `~/Library/Logs/Otto/main.log` - Database initialization and main process errors

### "Python process not ready"

**Symptoms:** App shows "Connection Error: Python process not ready"

**Causes:**
1. Python backend not bundled or corrupted
2. Relative import errors in bundled Python code
3. Missing dependencies in PyInstaller bundle

**Fixes:**
1. Verify Python backend was built: `ls -la desktop/build/python-backend/python-backend`
2. Rebuild Python backend: `./build_python.sh`
3. Check `python-bridge.log` for Python errors
4. If using relative imports in new Python files, ensure they use `from .module import` syntax

**Historical fix:** We added `ipc_main.py` wrapper to properly load the `app` package before running `ipc_server.py`

### "Audio helper not found. Please run build_helper.sh"

**Symptoms:** App shows permission error with "Audio helper not found"

**Causes:**
1. Audio helper binary not bundled
2. Helper path hardcoded incorrectly in Python code

**Fixes:**
1. Verify helper exists: `ls -la app/bin/courier-audio-helper`
2. If missing, rebuild: `cd /path/to/courier && ./build_helper.sh`
3. Ensure `python-bridge.ts` sets `OTTO_AUDIO_HELPER` env var correctly
4. Ensure both `ipc_server.py` AND `recorder.py` use `os.environ.get("OTTO_AUDIO_HELPER")`

**Historical fix:** We fixed `ipc_server.py` to use the `OTTO_AUDIO_HELPER` env var instead of `Path(__file__).parent / "bin" / ...`

### "No handler registered for 'db:listMeetings'"

**Symptoms:** App shows "History Error" with "No handler registered for 'db:listMeetings'"

**Causes:**
1. Database initialization failed silently
2. Migration errors (duplicate columns, etc.)

**Fixes:**
1. Check `main.log` for database errors
2. Common error: "duplicate column name: enhancement_status"
   - This means migration v2 tried to add columns that already exist
   - Fix: Ensure migration checks column existence before adding
3. Delete database to reset: `rm -rf ~/Library/Application\ Support/Otto/meetings.db`
4. Restart app to recreate with current schema

**Historical fix:** We made migration v2 idempotent by checking `pragma table_info(meetings)` before adding columns

### "Cannot find module 'xyz'"

**Symptoms:** App crashes on startup with "Cannot find module" error

**Fixes:**
Add the missing module to the `files` array in `package.json` build config:
```json
"files": [
  "dist/**/*",
  "node_modules/uuid/**/*",
  "node_modules/missing-module/**/*"
]
```

### "default Electron icon is used"
Ensure `desktop/build/icon.icns` exists.

### Native module errors
Run `npm run rebuild` to rebuild native modules for Electron:
```bash
cd desktop
npm run rebuild
```

### Build fails with memory issues
Close other applications and try again, or increase Node memory:
```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

### PyInstaller build fails

**Common issues:**
1. Missing Python dependencies: `pip3 install -r requirements.txt`
2. PyInstaller not installed: `pip3 install pyinstaller`
3. Import errors: Ensure all app modules use relative imports (`from .module import`)

### Test Device Debugging Workflow

1. Install the DMG on test device
2. Launch app and reproduce error
3. Quit app
4. Check log files:
   ```bash
   cat ~/Library/Logs/Otto/python-bridge.log
   cat ~/Library/Logs/Otto/main.log
   ```
5. Look for errors and apply fixes above
6. If database is corrupted: `rm -rf ~/Library/Application\ Support/Otto/meetings.db`
7. Reinstall new build and test
