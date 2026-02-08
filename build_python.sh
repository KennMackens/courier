#!/bin/bash
# Build Python backend with PyInstaller for Otto

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Building Otto Python Backend ==="

# Clean previous build
echo "Cleaning previous builds..."
rm -rf build dist desktop/build/python-backend

# Build with PyInstaller
echo "Building Python backend..."
python3 -m PyInstaller pyinstaller.spec --noconfirm

# Move to desktop/build for electron-builder
echo "Moving build output..."
mkdir -p desktop/build
mv dist/python-backend desktop/build/

# Cleanup
rm -rf build dist

echo ""
echo "=== Build complete ==="
echo "Python backend built at: desktop/build/python-backend/"
echo ""
echo "To verify, run:"
echo "  ./desktop/build/python-backend/python-backend"
echo ""
