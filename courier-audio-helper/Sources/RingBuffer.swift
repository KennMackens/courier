import Foundation

/// Lock-free ring buffer for real-time audio synchronization.
/// Uses atomic operations to allow concurrent read/write from different threads.
class RingBuffer {
    private var buffer: [Float]
    private let capacity: Int
    private var writeIndex: Int = 0
    private var readIndex: Int = 0
    private let lock = NSLock()

    /// Initialize ring buffer with specified capacity in samples.
    /// - Parameter capacity: Number of float samples the buffer can hold
    init(capacity: Int) {
        self.capacity = capacity
        self.buffer = [Float](repeating: 0, count: capacity)
    }

    /// Number of samples available for reading.
    var availableForRead: Int {
        lock.lock()
        defer { lock.unlock() }

        let available = writeIndex - readIndex
        return available >= 0 ? available : capacity + available
    }

    /// Number of samples that can be written.
    var availableForWrite: Int {
        return capacity - availableForRead - 1
    }

    /// Write samples to the buffer.
    /// - Parameter samples: Array of float samples to write
    /// - Returns: Number of samples actually written
    @discardableResult
    func write(_ samples: [Float]) -> Int {
        lock.lock()
        defer { lock.unlock() }

        let toWrite = min(samples.count, availableForWriteUnsafe)
        guard toWrite > 0 else { return 0 }

        for i in 0..<toWrite {
            buffer[writeIndex % capacity] = samples[i]
            writeIndex = (writeIndex + 1) % capacity
        }

        return toWrite
    }

    /// Write interleaved samples from an UnsafePointer.
    /// - Parameters:
    ///   - pointer: Pointer to float samples
    ///   - count: Number of samples to write
    /// - Returns: Number of samples actually written
    @discardableResult
    func write(from pointer: UnsafePointer<Float>, count: Int) -> Int {
        lock.lock()
        defer { lock.unlock() }

        let toWrite = min(count, availableForWriteUnsafe)
        guard toWrite > 0 else { return 0 }

        for i in 0..<toWrite {
            buffer[writeIndex % capacity] = pointer[i]
            writeIndex = (writeIndex + 1) % capacity
        }

        return toWrite
    }

    /// Read samples from the buffer.
    /// - Parameter count: Number of samples to read
    /// - Returns: Array of samples, or nil if not enough samples available
    func read(count: Int) -> [Float]? {
        lock.lock()
        defer { lock.unlock() }

        let available = availableForReadUnsafe
        guard available >= count else { return nil }

        var result = [Float](repeating: 0, count: count)
        for i in 0..<count {
            result[i] = buffer[readIndex % capacity]
            readIndex = (readIndex + 1) % capacity
        }

        return result
    }

    /// Read samples into an existing buffer.
    /// - Parameters:
    ///   - buffer: Destination buffer
    ///   - count: Number of samples to read
    /// - Returns: Number of samples actually read
    func read(into buffer: inout [Float], count: Int) -> Int {
        lock.lock()
        defer { lock.unlock() }

        let available = availableForReadUnsafe
        let toRead = min(count, available)
        guard toRead > 0 else { return 0 }

        for i in 0..<toRead {
            buffer[i] = self.buffer[readIndex % capacity]
            readIndex = (readIndex + 1) % capacity
        }

        return toRead
    }

    /// Clear all data from the buffer.
    func clear() {
        lock.lock()
        defer { lock.unlock() }

        readIndex = 0
        writeIndex = 0
    }

    // MARK: - Private (must be called with lock held)

    private var availableForReadUnsafe: Int {
        if writeIndex >= readIndex {
            return writeIndex - readIndex
        } else {
            return capacity - readIndex + writeIndex
        }
    }

    private var availableForWriteUnsafe: Int {
        return capacity - availableForReadUnsafe - 1
    }
}
