/**
 * Python Bridge - Manages the Python subprocess and IPC communication.
 *
 * Spawns the Python IPC server and provides a typed interface for
 * sending requests and receiving responses/streams.
 */

import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { createInterface, Interface } from 'readline'
import { v4 as uuid } from 'uuid'
import * as path from 'path'
import { app } from 'electron'

// IPC Protocol types
interface Request {
  jsonrpc: '2.0'
  id: string
  method: string
  params?: Record<string, unknown>
}

interface Response {
  jsonrpc: '2.0'
  id: string
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

interface StreamEvent {
  jsonrpc: '2.0'
  id: string
  stream: boolean
  data: unknown
  done: boolean
}

interface Notification {
  jsonrpc: '2.0'
  method: string
  params?: Record<string, unknown>
}

type Message = Response | StreamEvent | Notification

interface PendingRequest {
  resolve: (result: unknown) => void
  reject: (error: Error) => void
  onStream?: (data: unknown) => void
}

export class PythonBridge extends EventEmitter {
  private process: ChildProcess | null = null
  private readline: Interface | null = null
  private pendingRequests: Map<string, PendingRequest> = new Map()
  private isReady = false
  private readyPromise: Promise<void> | null = null
  private readyResolve: (() => void) | null = null

  /**
   * Start the Python subprocess.
   */
  async start(): Promise<void> {
    if (this.process) {
      throw new Error('Python process already running')
    }

    // Find Python executable
    const pythonPath = this.findPythonPath()

    // Find the app directory (Python code)
    const appDir = this.findAppDir()

    console.log(`[PythonBridge] Starting Python from ${pythonPath}`)
    console.log(`[PythonBridge] App directory: ${appDir}`)

    // Create ready promise
    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve
    })

    // Spawn Python subprocess
    this.process = spawn(pythonPath, ['-u', '-m', 'app.ipc_server'], {
      cwd: appDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
      },
    })

    // Handle stdout (JSON messages)
    this.readline = createInterface({
      input: this.process.stdout!,
      crlfDelay: Infinity,
    })

    this.readline.on('line', (line) => this.handleMessage(line))

    // Handle stderr (debug output)
    this.process.stderr!.on('data', (data) => {
      console.log('[Python stderr]', data.toString().trim())
    })

    // Handle process exit
    this.process.on('exit', (code, signal) => {
      console.log(`[PythonBridge] Python process exited with code ${code}, signal ${signal}`)
      this.emit('exit', code, signal)
      this.cleanup()
    })

    this.process.on('error', (error) => {
      console.error('[PythonBridge] Python process error:', error)
      this.emit('error', error)
    })

    // Wait for ready notification
    await this.waitForReady()
    console.log('[PythonBridge] Python process ready')
  }

  /**
   * Send a request and wait for response.
   */
  async request<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    if (!this.isReady) {
      throw new Error('Python process not ready')
    }

    const id = uuid()
    const message: Request = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    }

    return new Promise<T>((resolve, reject) => {
      this.pendingRequests.set(id, {
        resolve: resolve as (result: unknown) => void,
        reject,
      })
      this.send(message)
    })
  }

  /**
   * Send a request that returns streaming responses.
   */
  async requestWithStream<T>(
    method: string,
    params: Record<string, unknown>,
    onStream: (data: unknown) => void
  ): Promise<T> {
    if (!this.isReady) {
      throw new Error('Python process not ready')
    }

    const id = uuid()
    const message: Request = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    }

    return new Promise<T>((resolve, reject) => {
      this.pendingRequests.set(id, {
        resolve: resolve as (result: unknown) => void,
        reject,
        onStream,
      })
      this.send(message)
    })
  }

  /**
   * Gracefully shutdown the Python process.
   */
  async shutdown(): Promise<void> {
    if (!this.process) {
      return
    }

    try {
      await this.request('shutdown')
    } catch {
      // Ignore errors during shutdown
    }

    // Give it a moment to exit gracefully
    await new Promise((resolve) => setTimeout(resolve, 500))

    this.cleanup()
  }

  /**
   * Force kill the Python process.
   */
  kill(): void {
    if (this.process) {
      this.process.kill('SIGKILL')
      this.cleanup()
    }
  }

  private handleMessage(line: string): void {
    try {
      const msg = JSON.parse(line) as Message

      // Check if it's a notification (no id, has method)
      if ('method' in msg && !('id' in msg)) {
        this.handleNotification(msg as Notification)
        return
      }

      // Check if it has an id (response or stream)
      if ('id' in msg && typeof msg.id === 'string') {
        const id = msg.id
        const pending = this.pendingRequests.get(id)

        if ('stream' in msg && msg.stream) {
          // Stream event
          const streamMsg = msg as StreamEvent
          pending?.onStream?.(streamMsg.data)

          if (streamMsg.done) {
            pending?.resolve(streamMsg.data)
            this.pendingRequests.delete(id)
          }
        } else if ('error' in msg && msg.error) {
          // Error response
          const errorMsg = msg as Response
          pending?.reject(new Error(errorMsg.error!.message))
          this.pendingRequests.delete(id)
        } else if ('result' in msg) {
          // Success response
          const responseMsg = msg as Response
          pending?.resolve(responseMsg.result)
          this.pendingRequests.delete(id)
        }
      }
    } catch (e) {
      console.error('[PythonBridge] Failed to parse message:', line, e)
    }
  }

  private handleNotification(notification: Notification): void {
    if (notification.method === 'ready') {
      this.isReady = true
      this.readyResolve?.()
      this.emit('ready', notification.params)
    } else {
      // Forward other notifications as events
      this.emit(notification.method, notification.params)
    }
  }

  private send(message: Request): void {
    if (!this.process?.stdin?.writable) {
      throw new Error('Python process not running')
    }
    const line = JSON.stringify(message) + '\n'
    this.process.stdin.write(line)
  }

  private async waitForReady(): Promise<void> {
    if (this.isReady) {
      return
    }

    // Wait for ready with timeout
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Python process did not become ready')), 10000)
    })

    await Promise.race([this.readyPromise, timeout])
  }

  private cleanup(): void {
    if (this.process) {
      try {
        this.process.kill()
      } catch {
        // Ignore
      }
      this.process = null
    }

    this.readline?.close()
    this.readline = null
    this.isReady = false

    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      pending.reject(new Error('Python process terminated'))
    }
    this.pendingRequests.clear()
  }

  private findPythonPath(): string {
    // Try common Python paths
    // In production, we might bundle Python or use a specific path
    return process.env.PYTHON_PATH || 'python3'
  }

  private findAppDir(): string {
    // In development, use the parent directory
    // In production, use the resources directory
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'app')
    } else {
      // Development: go up from desktop/src/main to courier/
      return path.resolve(__dirname, '..', '..', '..')
    }
  }
}

// Singleton instance
let pythonBridge: PythonBridge | null = null

export function getPythonBridge(): PythonBridge {
  if (!pythonBridge) {
    pythonBridge = new PythonBridge()
  }
  return pythonBridge
}
