import Foundation

class IPCHandler: AudioCaptureDelegate {
    private let captureManager: AudioCaptureManager
    private let audioLock = NSLock()

    init(captureManager: AudioCaptureManager) {
        self.captureManager = captureManager
        self.captureManager.delegate = self
    }

    func run() async {
        // Send ready message
        sendResponse(["type": "ready", "version": "1.0.0"])

        // Read commands from stdin
        while let line = readLine() {
            let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { continue }

            do {
                guard let data = trimmed.data(using: .utf8),
                      let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                      let command = json["command"] as? String else {
                    sendError(message: "Invalid command format", code: "INTERNAL_ERROR")
                    continue
                }

                try handleCommand(command, json: json)
            } catch let error as AudioCaptureError {
                sendError(message: error.description, code: error.code)
            } catch {
                sendError(message: error.localizedDescription, code: "INTERNAL_ERROR")
            }
        }
    }

    private func handleCommand(_ command: String, json: [String: Any]) throws {
        switch command {
        case "start":
            try captureManager.start()
            sendResponse([
                "type": "started",
                "actualSampleRate": captureManager.actualSampleRate,
                "channels": captureManager.channelsPerFrame
            ])

        case "stop":
            let totalSamples = try captureManager.stop()
            sendResponse([
                "type": "stopped",
                "totalSamples": totalSamples
            ])

        case "check_permission":
            let granted = captureManager.checkPermission()
            sendResponse([
                "type": "permission",
                "granted": granted
            ])

        default:
            sendError(message: "Unknown command: \(command)", code: "INTERNAL_ERROR")
        }
    }

    // MARK: - AudioCaptureDelegate

    func didCaptureAudio(data: Data, frameCount: UInt32) {
        writeAudioChunk(data)
    }

    func didEncounterError(_ error: Error) {
        if let captureError = error as? AudioCaptureError {
            sendError(message: captureError.description, code: captureError.code)
        } else {
            sendError(message: error.localizedDescription, code: "INTERNAL_ERROR")
        }
    }

    // MARK: - IPC Output

    private func sendResponse(_ dict: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: dict),
              let jsonString = String(data: data, encoding: .utf8) else {
            return
        }
        print(jsonString)
        fflush(stdout)
    }

    private func sendError(message: String, code: String) {
        sendResponse([
            "type": "error",
            "message": message,
            "code": code
        ])
    }

    private func writeAudioChunk(_ data: Data) {
        audioLock.lock()
        defer { audioLock.unlock() }

        // Write 4-byte size prefix (big-endian UInt32)
        var size = UInt32(data.count).bigEndian
        let sizeData = Data(bytes: &size, count: 4)

        FileHandle.standardError.write(sizeData)
        FileHandle.standardError.write(data)
    }
}
