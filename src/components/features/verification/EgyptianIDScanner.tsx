'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { Upload, Loader2, CheckCircle, AlertCircle, Camera, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface ScanResult {
  id_number?: string
  birth_date?: string
  governorate?: string
  gender?: string
  error?: string
}

interface EgyptianIDScannerProps {
  onIdDetected: (idNumber: string) => void
  onCancel: () => void
}

export function EgyptianIDScanner({ onIdDetected, onCancel }: EgyptianIDScannerProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(file: File) {
    setResult(null)
    setSelectedFile(file)
    setPreview(URL.createObjectURL(file))
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFileChange(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) handleFileChange(file)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(true)
  }

  function handleDragLeave() {
    setDragOver(false)
  }

  function clearSelection() {
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setSelectedFile(null)
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleScan() {
    if (!selectedFile) return
    setScanning(true)
    setResult(null)

    try {
      const form = new FormData()
      form.append('file', selectedFile)

      const resp = await fetch('/api/id-scan', {
        method: 'POST',
        body: form,
      })

      const data: ScanResult = await resp.json()
      setResult(data)

      if (data.id_number && !data.error) {
        // Short delay so the user sees the green result before the dialog closes
        setTimeout(() => onIdDetected(data.id_number!), 1200)
      }
    } catch {
      setResult({ error: 'Failed to reach the scanning service. Please try again.' })
    } finally {
      setScanning(false)
    }
  }

  const hasResult = !!result
  const isError = hasResult && (!!result.error || !result.id_number)
  const isSuccess = hasResult && !!result.id_number && !result.error

  return (
    <div className="space-y-4">
      {/* Upload area */}
      {!preview ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'relative flex flex-col items-center justify-center gap-3 rounded-[28px] border-2 border-dashed p-10 cursor-pointer transition-colors select-none',
            dragOver
              ? 'border-[#5B0F16] bg-[#5B0F16]/5'
              : 'border-muted-foreground/25 bg-[#F6F1E6] hover:border-[#5B0F16]/50 hover:bg-[#5B0F16]/5'
          )}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
            <Upload className="h-6 w-6 text-[#5B0F16]" />
          </div>
          <div className="text-center">
            <p className="font-medium text-foreground">Drop your ID card photo here</p>
            <p className="text-sm text-muted-foreground mt-0.5">or click to browse</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Camera className="h-3.5 w-3.5" />
            <span>JPEG, PNG, WEBP — front of Egyptian National ID</span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={handleInputChange}
            aria-label="Upload ID image"
          />
        </div>
      ) : (
        <div className="relative rounded-[28px] overflow-hidden bg-muted aspect-video">
          <Image
            src={preview}
            alt="ID card preview"
            fill
            className="object-contain"
          />
          {!scanning && (
            <button
              type="button"
              onClick={clearSelection}
              className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm text-red-500 hover:bg-white transition-colors"
              aria-label="Remove image"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Result cards */}
      {isSuccess && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-4 pb-4 space-y-3">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle className="h-5 w-5 shrink-0" />
              <span className="font-semibold text-sm">ID detected successfully</span>
            </div>
            <div className="text-center py-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">ID Number</p>
              <p className="text-2xl font-bold text-[#5B0F16] tracking-widest font-mono">{result.id_number}</p>
            </div>
            {(result.birth_date || result.governorate || result.gender) && (
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-green-100">
                {result.birth_date && (
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Birth Date</p>
                    <p className="text-sm font-medium">{result.birth_date}</p>
                  </div>
                )}
                {result.governorate && (
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Governorate</p>
                    <p className="text-sm font-medium">{result.governorate}</p>
                  </div>
                )}
                {result.gender && (
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Gender</p>
                    <p className="text-sm font-medium">{result.gender}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-2 text-red-700">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">Scan failed</p>
                <p className="text-sm text-red-600 mt-0.5">{result.error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={scanning}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleScan}
          disabled={!selectedFile || scanning}
          className="bg-[#5B0F16] hover:bg-[#5B0F16]/90 text-white min-w-[120px]"
        >
          {scanning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Scanning…
            </>
          ) : (
            'Scan ID'
          )}
        </Button>
      </div>
    </div>
  )
}
