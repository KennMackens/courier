import { useState, useEffect } from 'react'

interface ConnectionStatus {
  connected: boolean
  version?: string
  pythonVersion?: string
  helperAvailable?: boolean
  error?: string
}

interface RecordingState {
  isRecording: boolean
  duration: number
}

interface Settings {
  language: string
  whisperModel: string
  ollamaModel: string
}

function App() {
  const [status, setStatus] = useState<ConnectionStatus>({ connected: false })
  const [recording, setRecording] = useState<RecordingState>({ isRecording: false, duration: 0 })
  const [settings, setSettings] = useState<Settings | null>(null)
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null)
  const [transcript, setTranscript] = useState<string>('')
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [log, setLog] = useState<string[]>([])

  const addLog = (message: string) => {
    setLog(prev => [...prev.slice(-19), `${new Date().toLocaleTimeString()}: ${message}`])
  }

  // Initialize connection to Python
  useEffect(() => {
    async function init() {
      try {
        addLog('Initializing Python connection...')
        const result = await window.python.initialize()
        setStatus({
          connected: true,
          version: result.version,
          pythonVersion: result.pythonVersion,
          helperAvailable: result.helperAvailable,
        })
        addLog(`Connected! Python v${result.pythonVersion.split(' ')[0]}`)

        // Load settings
        const settingsResult = await window.python.getSettings()
        setSettings({
          language: settingsResult.language,
          whisperModel: settingsResult.whisperModel,
          ollamaModel: settingsResult.ollamaModel,
        })
        addLog(`Settings loaded: ${settingsResult.language}, ${settingsResult.whisperModel}`)

        // Check permission
        const permResult = await window.python.checkPermission()
        setPermissionGranted(permResult.granted)
        addLog(`Permission: ${permResult.granted ? 'granted' : 'denied'}`)
      } catch (error) {
        setStatus({ connected: false, error: String(error) })
        addLog(`Connection error: ${error}`)
      }
    }

    init()

    // Set up event listeners
    const unsubTranscribe = window.python.onTranscribeProgress((data) => {
      addLog(`Transcribe progress: ${JSON.stringify(data)}`)
    })

    const unsubError = window.python.onError((error) => {
      addLog(`Error: ${error.message}`)
    })

    return () => {
      unsubTranscribe()
      unsubError()
    }
  }, [])

  // Recording timer
  useEffect(() => {
    if (!recording.isRecording) return

    const interval = setInterval(() => {
      setRecording(prev => ({ ...prev, duration: prev.duration + 1 }))
    }, 1000)

    return () => clearInterval(interval)
  }, [recording.isRecording])

  const handleStartRecording = async () => {
    try {
      addLog('Starting recording...')
      const result = await window.python.startRecording()
      if (result.started) {
        setRecording({ isRecording: true, duration: 0 })
        addLog(`Recording started at ${result.actualSampleRate}Hz`)
      }
    } catch (error) {
      addLog(`Start recording error: ${error}`)
    }
  }

  const handleStopRecording = async () => {
    try {
      addLog('Stopping recording...')
      const result = await window.python.stopRecording()
      setRecording({ isRecording: false, duration: 0 })
      addLog(`Recording stopped: ${result.durationSec}s, ${result.audioLength} samples`)
    } catch (error) {
      addLog(`Stop recording error: ${error}`)
    }
  }

  const handleTranscribe = async () => {
    try {
      setIsTranscribing(true)
      addLog('Starting transcription...')
      const result = await window.python.transcribe()
      setTranscript(result.transcript)
      addLog(`Transcription complete: ${result.transcript.length} chars`)
    } catch (error) {
      addLog(`Transcription error: ${error}`)
    } finally {
      setIsTranscribing(false)
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="app">
      <header className="header">
        <div className="status-indicator">
          <span
            className={`status-dot ${
              status.connected ? (recording.isRecording ? 'recording' : 'connected') : 'disconnected'
            }`}
          />
          <span className="status-text">
            {status.connected
              ? recording.isRecording
                ? `Recording ${formatDuration(recording.duration)}`
                : 'Ready'
              : 'Connecting...'}
          </span>
        </div>
        <h1 className="title">Courier</h1>
      </header>

      <main className="main">
        <section className="connection-info">
          <h2>Connection Status</h2>
          {status.connected ? (
            <ul>
              <li>IPC Version: {status.version}</li>
              <li>Python: {status.pythonVersion?.split(' ')[0]}</li>
              <li>Audio Helper: {status.helperAvailable ? '✓ Available' : '✗ Missing'}</li>
              <li>Permission: {permissionGranted === null ? 'Checking...' : permissionGranted ? '✓ Granted' : '✗ Denied'}</li>
              <li>Language: {settings?.language}</li>
              <li>Whisper Model: {settings?.whisperModel}</li>
            </ul>
          ) : (
            <p className="error">{status.error || 'Connecting to Python...'}</p>
          )}
        </section>

        <section className="controls">
          <h2>Recording</h2>
          <div className="button-group">
            {recording.isRecording ? (
              <button onClick={handleStopRecording} className="btn btn-stop">
                Stop Recording
              </button>
            ) : (
              <button
                onClick={handleStartRecording}
                disabled={!status.connected || !permissionGranted}
                className="btn btn-start"
              >
                Start Recording
              </button>
            )}
            <button
              onClick={handleTranscribe}
              disabled={!status.connected || recording.isRecording || isTranscribing}
              className="btn btn-transcribe"
            >
              {isTranscribing ? 'Transcribing...' : 'Transcribe'}
            </button>
          </div>
        </section>

        {transcript && (
          <section className="transcript">
            <h2>Transcript</h2>
            <pre>{transcript}</pre>
          </section>
        )}

        <section className="log">
          <h2>Activity Log</h2>
          <div className="log-entries">
            {log.map((entry, i) => (
              <div key={i} className="log-entry">{entry}</div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
