import Foundation

// Disable stdout buffering for immediate JSON delivery
setbuf(stdout, nil)

// Handle --version flag
if CommandLine.arguments.contains("--version") {
    print("courier-audio-helper 1.0.0")
    exit(0)
}

// Handle --check-permission flag
if CommandLine.arguments.contains("--check-permission") {
    let manager = AudioCaptureManager()
    let screenGranted = manager.checkPermission()
    let micGranted = manager.checkMicrophonePermission()

    // Output mic status to stdout for Python to parse
    if screenGranted {
        print(micGranted ? "mic:granted" : "mic:denied")
        exit(0)
    } else {
        exit(1)
    }
}

// Set up signal handlers for graceful shutdown
signal(SIGTERM) { _ in
    exit(0)
}
signal(SIGINT) { _ in
    exit(0)
}

// Normal IPC mode
let captureManager = AudioCaptureManager()
let ipcHandler = IPCHandler(captureManager: captureManager)

// Run the IPC loop in an async task
Task {
    await ipcHandler.run()
    exit(0)
}

// Keep the process alive
RunLoop.main.run()
