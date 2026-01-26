import Foundation
import AVFoundation

/// Manages microphone audio capture using AVAudioEngine.
/// Captures from the system default input device and writes to a ring buffer.
class MicrophoneCaptureManager {
    /// Ring buffer for audio synchronization with system audio capture
    let ringBuffer: RingBuffer

    /// Target sample rate (must match system audio capture)
    let targetSampleRate: Double = 48000.0

    /// Target channel count (stereo to match system audio)
    let targetChannels: Int = 2

    /// Whether microphone capture is currently active
    private(set) var isCapturing: Bool = false

    /// Whether microphone is available and working
    private(set) var isAvailable: Bool = false

    /// Last error message if capture failed
    private(set) var lastError: String?

    private var audioEngine: AVAudioEngine?
    private var converter: AVAudioConverter?

    /// Initialize with a ring buffer.
    /// Buffer should have capacity for ~100ms of audio at target sample rate.
    init(ringBuffer: RingBuffer) {
        self.ringBuffer = ringBuffer
    }

    /// Check if microphone permission is granted.
    static func checkPermission() -> Bool {
        switch AVCaptureDevice.authorizationStatus(for: .audio) {
        case .authorized:
            return true
        case .notDetermined, .denied, .restricted:
            return false
        @unknown default:
            return false
        }
    }

    /// Request microphone permission asynchronously.
    static func requestPermission() async -> Bool {
        return await AVCaptureDevice.requestAccess(for: .audio)
    }

    /// Start capturing audio from the default input device.
    /// - Throws: MicrophoneError if capture cannot be started
    func start() throws {
        guard !isCapturing else {
            throw MicrophoneError.alreadyCapturing
        }

        // Check permission first
        guard MicrophoneCaptureManager.checkPermission() else {
            lastError = "Microphone permission not granted"
            throw MicrophoneError.permissionDenied
        }

        // Create audio engine
        let engine = AVAudioEngine()
        self.audioEngine = engine

        let inputNode = engine.inputNode

        // Check if input is available
        guard inputNode.inputFormat(forBus: 0).channelCount > 0 else {
            lastError = "No microphone input available"
            throw MicrophoneError.noInputDevice
        }

        // Get the native input format
        let inputFormat = inputNode.outputFormat(forBus: 0)

        // Create target format (48kHz stereo float32 interleaved)
        guard let targetFormat = AVAudioFormat(
            commonFormat: .pcmFormatFloat32,
            sampleRate: targetSampleRate,
            channels: AVAudioChannelCount(targetChannels),
            interleaved: true
        ) else {
            lastError = "Failed to create target audio format"
            throw MicrophoneError.formatError
        }

        // Create converter if sample rates or channels differ
        if inputFormat.sampleRate != targetSampleRate ||
           inputFormat.channelCount != AVAudioChannelCount(targetChannels) {
            guard let conv = AVAudioConverter(from: inputFormat, to: targetFormat) else {
                lastError = "Failed to create audio converter"
                throw MicrophoneError.formatError
            }
            self.converter = conv
        }

        // Install tap on input node
        let bufferSize: AVAudioFrameCount = 4096
        inputNode.installTap(onBus: 0, bufferSize: bufferSize, format: inputFormat) { [weak self] buffer, _ in
            self?.handleAudioBuffer(buffer)
        }

        // Start the engine
        do {
            try engine.start()
        } catch {
            cleanup()
            lastError = "Failed to start audio engine: \(error.localizedDescription)"
            throw MicrophoneError.engineStartFailed(error.localizedDescription)
        }

        isCapturing = true
        isAvailable = true
        lastError = nil
    }

    /// Stop capturing audio.
    func stop() {
        cleanup()
        isCapturing = false
    }

    // MARK: - Private

    private func handleAudioBuffer(_ buffer: AVAudioPCMBuffer) {
        guard isCapturing else { return }

        // Convert to target format if needed
        let outputBuffer: AVAudioPCMBuffer
        if let converter = self.converter {
            guard let convertedBuffer = convertBuffer(buffer, using: converter) else {
                return
            }
            outputBuffer = convertedBuffer
        } else {
            outputBuffer = buffer
        }

        // Extract interleaved samples and write to ring buffer
        guard let channelData = outputBuffer.floatChannelData else { return }

        let frameCount = Int(outputBuffer.frameLength)
        let channelCount = Int(outputBuffer.format.channelCount)

        if outputBuffer.format.isInterleaved {
            // Already interleaved - write directly
            ringBuffer.write(from: channelData[0], count: frameCount * channelCount)
        } else {
            // Non-interleaved - interleave manually
            var interleaved = [Float](repeating: 0, count: frameCount * targetChannels)
            for frame in 0..<frameCount {
                for channel in 0..<min(channelCount, targetChannels) {
                    interleaved[frame * targetChannels + channel] = channelData[channel][frame]
                }
                // If mono input, duplicate to stereo
                if channelCount == 1 && targetChannels == 2 {
                    interleaved[frame * targetChannels + 1] = channelData[0][frame]
                }
            }
            ringBuffer.write(interleaved)
        }
    }

    private func convertBuffer(_ inputBuffer: AVAudioPCMBuffer, using converter: AVAudioConverter) -> AVAudioPCMBuffer? {
        // Calculate output frame capacity based on sample rate ratio
        let ratio = converter.outputFormat.sampleRate / converter.inputFormat.sampleRate
        let outputFrameCapacity = AVAudioFrameCount(Double(inputBuffer.frameLength) * ratio) + 1

        guard let outputBuffer = AVAudioPCMBuffer(
            pcmFormat: converter.outputFormat,
            frameCapacity: outputFrameCapacity
        ) else {
            return nil
        }

        var error: NSError?
        var inputBufferConsumed = false

        converter.convert(to: outputBuffer, error: &error) { _, outStatus in
            if inputBufferConsumed {
                outStatus.pointee = .noDataNow
                return nil
            }
            inputBufferConsumed = true
            outStatus.pointee = .haveData
            return inputBuffer
        }

        if error != nil {
            return nil
        }

        return outputBuffer
    }

    private func cleanup() {
        audioEngine?.inputNode.removeTap(onBus: 0)
        audioEngine?.stop()
        audioEngine = nil
        converter = nil
    }

    deinit {
        cleanup()
    }
}

// MARK: - Errors

enum MicrophoneError: Error, CustomStringConvertible {
    case permissionDenied
    case noInputDevice
    case formatError
    case engineStartFailed(String)
    case alreadyCapturing

    var description: String {
        switch self {
        case .permissionDenied:
            return "Microphone permission not granted"
        case .noInputDevice:
            return "No microphone input device available"
        case .formatError:
            return "Failed to configure audio format"
        case .engineStartFailed(let msg):
            return "Failed to start audio engine: \(msg)"
        case .alreadyCapturing:
            return "Already capturing microphone audio"
        }
    }

    var code: String {
        switch self {
        case .permissionDenied: return "MICROPHONE_PERMISSION_DENIED"
        case .noInputDevice: return "NO_INPUT_DEVICE"
        case .formatError: return "FORMAT_ERROR"
        case .engineStartFailed: return "ENGINE_START_FAILED"
        case .alreadyCapturing: return "ALREADY_CAPTURING"
        }
    }
}
