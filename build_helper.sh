#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HELPER_DIR="$SCRIPT_DIR/courier-audio-helper"
OUTPUT_DIR="$SCRIPT_DIR/app/bin"
BINARY_NAME="courier-audio-helper"

echo "=== Building courier-audio-helper ==="
echo ""

# Check Swift toolchain
if ! command -v swift &> /dev/null; then
    echo "Error: Swift toolchain not found. Install Xcode or Swift."
    exit 1
fi

echo "Swift version: $(swift --version 2>&1 | head -1)"
echo ""

# Navigate to Swift package
cd "$HELPER_DIR"

# Clean previous builds
echo "Cleaning previous build..."
swift package clean

# Build for ARM64 (Apple Silicon)
echo "Building for ARM64 (Apple Silicon)..."
swift build -c release --arch arm64

# Build for x86_64 (Intel)
echo "Building for x86_64 (Intel)..."
swift build -c release --arch x86_64

# Create universal binary using lipo
echo "Creating universal binary..."
mkdir -p "$OUTPUT_DIR"

ARM64_BINARY=".build/arm64-apple-macosx/release/$BINARY_NAME"
X86_BINARY=".build/x86_64-apple-macosx/release/$BINARY_NAME"

if [ ! -f "$ARM64_BINARY" ]; then
    echo "Error: ARM64 binary not found at $ARM64_BINARY"
    exit 1
fi

if [ ! -f "$X86_BINARY" ]; then
    echo "Error: x86_64 binary not found at $X86_BINARY"
    exit 1
fi

lipo -create \
    "$ARM64_BINARY" \
    "$X86_BINARY" \
    -output "$OUTPUT_DIR/$BINARY_NAME"

chmod +x "$OUTPUT_DIR/$BINARY_NAME"

# Verify universal binary
echo ""
echo "=== Build Complete ==="
echo "Binary: $OUTPUT_DIR/$BINARY_NAME"
echo ""
echo "Architectures:"
lipo -info "$OUTPUT_DIR/$BINARY_NAME"
echo ""
echo "Size: $(du -h "$OUTPUT_DIR/$BINARY_NAME" | cut -f1)"
echo ""
echo "Done!"
