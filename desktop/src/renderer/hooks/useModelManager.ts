import { useState, useCallback, useEffect, useRef } from "react"
import type { AvailableModel, DownloadedModel, DownloadProgress, ModelStatus } from "@/global"

// Default model for note enhancement (Apple Silicon MLX)
export const DEFAULT_MODEL_ID = "pdelobelle/fietje-2-chat-mlx-6Bit"

export type DownloadState = "idle" | "downloading" | "complete" | "error" | "cancelled"

interface ModelManagerState {
  // Model status
  isModelReady: boolean
  isChecking: boolean
  modelStatus: ModelStatus | null

  // Download state
  downloadState: DownloadState
  downloadProgress: number
  downloadedSize: string
  totalSize: string
  downloadSpeed: string
  downloadError: string | null
  downloadModelId: string | null

  // Available models
  availableModels: AvailableModel[]
  downloadedModels: DownloadedModel[]
}

interface UseModelManagerOptions {
  modelId?: string
  onDownloadComplete?: () => void
  onDownloadError?: (error: string) => void
}

export function useModelManager(options: UseModelManagerOptions = {}) {
  const { modelId = DEFAULT_MODEL_ID, onDownloadComplete, onDownloadError } = options

  const [state, setState] = useState<ModelManagerState>({
    isModelReady: false,
    isChecking: true,
    modelStatus: null,
    downloadState: "idle",
    downloadProgress: 0,
    downloadedSize: "",
    totalSize: "",
    downloadSpeed: "",
    downloadError: null,
    downloadModelId: null,
    availableModels: [],
    downloadedModels: [],
  })

  const progressListenerRef = useRef<(() => void) | null>(null)

  // Check if default model is downloaded
  const checkModelStatus = useCallback(async () => {
    setState((prev) => ({ ...prev, isChecking: true }))

    try {
      const { downloaded } = await window.python.isModelDownloaded({ modelId })
      const status = await window.python.getModelStatus({ modelId })

      setState((prev) => ({
        ...prev,
        isModelReady: downloaded,
        modelStatus: status,
        isChecking: false,
      }))

      return downloaded
    } catch (error) {
      console.error("Failed to check model status:", error)
      setState((prev) => ({ ...prev, isChecking: false }))
      return false
    }
  }, [modelId])

  // Load available and downloaded models
  const loadModels = useCallback(async () => {
    try {
      const [available, downloaded] = await Promise.all([
        window.python.getAvailableModels(),
        window.python.getDownloadedModels(),
      ])

      setState((prev) => ({
        ...prev,
        availableModels: available.models,
        downloadedModels: downloaded.models,
      }))
    } catch (error) {
      console.error("Failed to load models:", error)
    }
  }, [])

  // Start model download
  const downloadModel = useCallback(
    async (targetModelId?: string) => {
      const downloadModelId = targetModelId || modelId

      // Setup progress listener
      if (progressListenerRef.current) {
        progressListenerRef.current()
      }

      progressListenerRef.current = window.python.onDownloadProgress(
        (data: DownloadProgress) => {
          const modelIdFromEvent = data.modelId || downloadModelId
          if (data.complete) {
            setState((prev) => ({
              ...prev,
              downloadState: "complete",
              downloadProgress: 100,
              isModelReady: modelIdFromEvent === modelId ? true : prev.isModelReady,
              downloadModelId: modelIdFromEvent,
              // Optimistically add to downloaded models to prevent "Install" flash
              downloadedModels: prev.downloadedModels.some((m) => m.modelId === modelIdFromEvent)
                ? prev.downloadedModels
                : [...prev.downloadedModels, { modelId: modelIdFromEvent, size: prev.totalSize || "Unknown" }],
            }))
            loadModels() // Still refresh from backend to get accurate data
            onDownloadComplete?.()
          } else if (data.cancelled) {
            setState((prev) => ({
              ...prev,
              downloadState: "cancelled",
              downloadModelId: modelIdFromEvent,
            }))
          } else if (data.status === "failed") {
            setState((prev) => ({
              ...prev,
              downloadState: "error",
              downloadError: "Download failed. Please check your internet connection.",
              downloadModelId: modelIdFromEvent,
            }))
          } else {
            setState((prev) => ({
              ...prev,
              downloadState: "downloading",
              downloadProgress: data.progress || 0,
              downloadedSize: data.downloaded || "",
              totalSize: data.total || "",
              downloadSpeed: data.speed || "",
              downloadModelId: modelIdFromEvent,
            }))
          }
        }
      )

      setState((prev) => ({
        ...prev,
        downloadState: "downloading",
        downloadProgress: 0,
        downloadError: null,
        downloadModelId: downloadModelId,
      }))

      try {
        const result = await window.python.downloadModel({ modelId: downloadModelId })

        if (result.alreadyDownloaded) {
          setState((prev) => ({
            ...prev,
            downloadState: "complete",
            downloadProgress: 100,
            isModelReady: downloadModelId === modelId ? true : prev.isModelReady,
            downloadModelId: downloadModelId,
            // Optimistically add to downloaded models
            downloadedModels: prev.downloadedModels.some((m) => m.modelId === downloadModelId)
              ? prev.downloadedModels
              : [...prev.downloadedModels, { modelId: downloadModelId, size: "Unknown" }],
          }))
          loadModels()
          onDownloadComplete?.()
        }

        return result
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Download failed"

        setState((prev) => ({
          ...prev,
          downloadState: "error",
          downloadError: errorMessage,
          downloadModelId: downloadModelId,
        }))

        onDownloadError?.(errorMessage)
        throw error
      }
    },
    [modelId, onDownloadComplete, onDownloadError, loadModels]
  )

  // Cancel download
  const cancelDownload = useCallback(async () => {
    try {
      await window.python.cancelDownload()
      setState((prev) => ({
        ...prev,
        downloadState: "cancelled",
        downloadModelId: null,
      }))
    } catch (error) {
      console.error("Failed to cancel download:", error)
    }
  }, [])

  // Delete model
  const deleteModel = useCallback(
    async (targetModelId?: string) => {
      const deleteModelId = targetModelId || modelId

      try {
        const result = await window.python.deleteModel({ modelId: deleteModelId })

        if (result.deleted) {
          setState((prev) => ({
            ...prev,
            isModelReady: deleteModelId === modelId ? false : prev.isModelReady,
            downloadedModels: prev.downloadedModels.filter(
              (m) => m.modelId !== deleteModelId
            ),
          }))
        }

        return result.deleted
      } catch (error) {
        console.error("Failed to delete model:", error)
        return false
      }
    },
    [modelId]
  )

  // Reset download state
  const resetDownloadState = useCallback(() => {
    setState((prev) => ({
      ...prev,
      downloadState: "idle",
      downloadProgress: 0,
      downloadedSize: "",
      totalSize: "",
      downloadSpeed: "",
      downloadError: null,
      downloadModelId: null,
    }))
  }, [])

  // Check model status on mount
  useEffect(() => {
    checkModelStatus()
    loadModels()

    return () => {
      if (progressListenerRef.current) {
        progressListenerRef.current()
      }
    }
  }, [checkModelStatus, loadModels])

  // Keep model readiness in sync when downloads are triggered from another UI instance.
  useEffect(() => {
    const unsubscribe = window.python.onDownloadProgress((data) => {
      if (!data.complete || !data.modelId) return

      setState((prev) => ({
        ...prev,
        isModelReady: data.modelId === modelId ? true : prev.isModelReady,
        downloadedModels: prev.downloadedModels.some((m) => m.modelId === data.modelId)
          ? prev.downloadedModels
          : [...prev.downloadedModels, { modelId: data.modelId, size: "Unknown" }],
      }))

      // Refresh with backend truth (size/status) after optimistic UI update.
      void checkModelStatus()
      void loadModels()
    })

    return () => unsubscribe()
  }, [modelId, checkModelStatus, loadModels])

  return {
    ...state,
    isDownloading: state.downloadState === "downloading",
    hasDownloadError: state.downloadState === "error",
    isDownloadComplete: state.downloadState === "complete",
    isDownloadCancelled: state.downloadState === "cancelled",
    downloadingModelId: state.downloadModelId,
    checkModelStatus,
    downloadModel,
    cancelDownload,
    deleteModel,
    loadModels,
    resetDownloadState,
  }
}
