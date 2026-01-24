import Foundation
import CoreAudio
import AudioToolbox

protocol AudioCaptureDelegate: AnyObject {
    func didCaptureAudio(data: Data, frameCount: UInt32)
    func didEncounterError(_ error: Error)
}

class AudioCaptureManager {
    weak var delegate: AudioCaptureDelegate?

    private var tapID: AudioObjectID = AudioObjectID(kAudioObjectUnknown)
    private var aggregateDeviceID: AudioDeviceID = AudioDeviceID(kAudioObjectUnknown)
    private var ioProcID: AudioDeviceIOProcID?
    private var tapDescription: CATapDescription?
    private var _isCapturing = false
    private var totalSamplesCaptured: Int = 0

    var isCapturing: Bool { _isCapturing }
    var actualSampleRate: Double = 48000.0
    var channelsPerFrame: Int = 2

    func start() throws {
        guard !_isCapturing else {
            throw AudioCaptureError.alreadyRecording
        }

        // 1. Create CATapDescription for system-wide audio
        let description = CATapDescription(stereoGlobalTapButExcludeProcesses: [])
        description.name = "CourierAudioTap"
        self.tapDescription = description

        // 2. Create the process tap
        var tap: AudioObjectID = AudioObjectID(kAudioObjectUnknown)
        let tapStatus = AudioHardwareCreateProcessTap(description, &tap)
        guard tapStatus == noErr else {
            if tapStatus == -66753 { // Permission denied
                throw AudioCaptureError.permissionDenied
            }
            throw AudioCaptureError.deviceError("Failed to create process tap (status: \(tapStatus))")
        }
        self.tapID = tap

        // 3. Get the tap UUID
        let tapUUID = description.uuid.uuidString

        // 4. Create aggregate device with the tap
        let aggregateDescription: [String: Any] = [
            kAudioAggregateDeviceNameKey as String: "CourierAggregateDevice",
            kAudioAggregateDeviceUIDKey as String: "com.courier.aggregate.\(UUID().uuidString)",
            kAudioAggregateDeviceIsPrivateKey as String: true,
            kAudioAggregateDeviceTapListKey as String: [[
                kAudioSubTapUIDKey as String: tapUUID,
                kAudioSubTapDriftCompensationKey as String: true
            ]]
        ]

        var aggDeviceID: AudioDeviceID = AudioDeviceID(kAudioObjectUnknown)
        let aggStatus = AudioHardwareCreateAggregateDevice(
            aggregateDescription as CFDictionary,
            &aggDeviceID
        )
        guard aggStatus == noErr else {
            AudioHardwareDestroyProcessTap(tapID)
            tapID = AudioObjectID(kAudioObjectUnknown)
            throw AudioCaptureError.deviceError("Failed to create aggregate device (status: \(aggStatus))")
        }
        self.aggregateDeviceID = aggDeviceID

        // 5. Get the stream format from the tap
        var formatSize = UInt32(MemoryLayout<AudioStreamBasicDescription>.size)
        var format = AudioStreamBasicDescription()
        var formatAddress = AudioObjectPropertyAddress(
            mSelector: kAudioTapPropertyFormat,
            mScope: kAudioObjectPropertyScopeGlobal,
            mElement: kAudioObjectPropertyElementMain
        )
        let formatStatus = AudioObjectGetPropertyData(
            tapID,
            &formatAddress,
            0,
            nil,
            &formatSize,
            &format
        )
        if formatStatus == noErr {
            self.actualSampleRate = format.mSampleRate
            self.channelsPerFrame = Int(format.mChannelsPerFrame)
        }

        // 6. Register IO proc callback
        var procID: AudioDeviceIOProcID?
        let ioStatus = AudioDeviceCreateIOProcIDWithBlock(
            &procID,
            aggregateDeviceID,
            nil
        ) { [weak self] (
            inNow: UnsafePointer<AudioTimeStamp>,
            inInputData: UnsafePointer<AudioBufferList>,
            inInputTime: UnsafePointer<AudioTimeStamp>,
            outOutputData: UnsafeMutablePointer<AudioBufferList>,
            inOutputTime: UnsafePointer<AudioTimeStamp>
        ) in
            guard let self = self else { return }
            self.handleAudioCallback(bufferList: inInputData)
        }
        guard ioStatus == noErr, let validProcID = procID else {
            self.cleanup()
            throw AudioCaptureError.deviceError("Failed to create IO proc (status: \(ioStatus))")
        }
        self.ioProcID = validProcID

        // 7. Start the device
        let startStatus = AudioDeviceStart(aggregateDeviceID, validProcID)
        guard startStatus == noErr else {
            self.cleanup()
            throw AudioCaptureError.deviceError("Failed to start device (status: \(startStatus))")
        }

        _isCapturing = true
        totalSamplesCaptured = 0
    }

    func stop() throws -> Int {
        guard _isCapturing else {
            throw AudioCaptureError.notRecording
        }

        cleanup()

        _isCapturing = false
        let samples = totalSamplesCaptured
        totalSamplesCaptured = 0
        return samples
    }

    func checkPermission() -> Bool {
        // Attempt to create a tap to check if we have permission
        let description = CATapDescription(stereoGlobalTapButExcludeProcesses: [])
        description.name = "CourierPermissionCheck"

        var tap: AudioObjectID = AudioObjectID(kAudioObjectUnknown)
        let status = AudioHardwareCreateProcessTap(description, &tap)

        if status == noErr {
            // Permission granted - clean up the test tap
            AudioHardwareDestroyProcessTap(tap)
            return true
        }

        // Write diagnostic info to stderr so Python can surface it
        FileHandle.standardError.write(
            "AudioHardwareCreateProcessTap failed: OSStatus \(status) (permission-denied = -66753)\n"
                .data(using: .utf8)!
        )
        return false
    }

    // MARK: - Private

    private func handleAudioCallback(bufferList: UnsafePointer<AudioBufferList>) {
        let abl = bufferList.pointee
        let bufferCount = Int(abl.mNumberBuffers)

        // Process each buffer in the buffer list
        withUnsafePointer(to: abl.mBuffers) { firstBuffer in
            let buffers = UnsafeBufferPointer<AudioBuffer>(
                start: firstBuffer,
                count: bufferCount
            )

            for buffer in buffers {
                guard let dataPointer = buffer.mData,
                      buffer.mDataByteSize > 0 else {
                    continue
                }

                let frameCount = buffer.mDataByteSize / UInt32(MemoryLayout<Float32>.size)
                totalSamplesCaptured += Int(frameCount)

                let data = Data(bytes: dataPointer, count: Int(buffer.mDataByteSize))
                delegate?.didCaptureAudio(data: data, frameCount: frameCount)
            }
        }
    }

    private func cleanup() {
        // Stop device
        if let procID = ioProcID, aggregateDeviceID != AudioDeviceID(kAudioObjectUnknown) {
            AudioDeviceStop(aggregateDeviceID, procID)
            AudioDeviceDestroyIOProcID(aggregateDeviceID, procID)
            ioProcID = nil
        }

        // Destroy aggregate device
        if aggregateDeviceID != AudioDeviceID(kAudioObjectUnknown) {
            AudioHardwareDestroyAggregateDevice(aggregateDeviceID)
            aggregateDeviceID = AudioDeviceID(kAudioObjectUnknown)
        }

        // Destroy process tap
        if tapID != AudioObjectID(kAudioObjectUnknown) {
            AudioHardwareDestroyProcessTap(tapID)
            tapID = AudioObjectID(kAudioObjectUnknown)
        }

        tapDescription = nil
    }

    deinit {
        if _isCapturing {
            cleanup()
        }
    }
}

enum AudioCaptureError: Error, CustomStringConvertible {
    case permissionDenied
    case deviceError(String)
    case alreadyRecording
    case notRecording
    case internalError(String)

    var description: String {
        switch self {
        case .permissionDenied:
            return "Screen Recording permission not granted"
        case .deviceError(let msg):
            return "Device error: \(msg)"
        case .alreadyRecording:
            return "Already recording"
        case .notRecording:
            return "Not recording"
        case .internalError(let msg):
            return "Internal error: \(msg)"
        }
    }

    var code: String {
        switch self {
        case .permissionDenied: return "PERMISSION_DENIED"
        case .deviceError: return "DEVICE_ERROR"
        case .alreadyRecording: return "ALREADY_RECORDING"
        case .notRecording: return "NOT_RECORDING"
        case .internalError: return "INTERNAL_ERROR"
        }
    }
}
