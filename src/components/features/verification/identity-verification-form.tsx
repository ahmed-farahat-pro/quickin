'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import Image from 'next/image'
import { Upload, Check, X, Loader2, CreditCard, User, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface IdentityVerificationFormProps {
  userId: string
  onComplete?: () => void
}

interface UploadedFile {
  file: File | null
  preview: string | null
  uploaded: boolean
  url: string | null
}

const DOCUMENT_TYPES = [
  { 
    key: 'id_front' as const, 
    label: 'ID Card (Front)', 
    icon: CreditCard,
    description: 'Upload the front of your national ID or passport'
  },
  { 
    key: 'id_back' as const, 
    label: 'ID Card (Back)', 
    icon: CreditCard,
    description: 'Upload the back of your national ID'
  },
  { 
    key: 'selfie' as const, 
    label: 'Selfie Photo', 
    icon: User,
    description: 'Upload a clear photo of your face'
  },
]

type DocumentKey = 'id_front' | 'id_back' | 'selfie'

export function IdentityVerificationForm({ userId, onComplete }: IdentityVerificationFormProps) {
  const router = useRouter()
  const [documents, setDocuments] = useState<Record<DocumentKey, UploadedFile>>({
    id_front: { file: null, preview: null, uploaded: false, url: null },
    id_back: { file: null, preview: null, uploaded: false, url: null },
    selfie: { file: null, preview: null, uploaded: false, url: null },
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [currentStep, setCurrentStep] = useState<DocumentKey>('id_front')
  
  const supabase = createClient()

  const handleFileDrop = useCallback((key: DocumentKey, acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0]
      setDocuments(prev => ({
        ...prev,
        [key]: {
          file,
          preview: URL.createObjectURL(file),
          uploaded: false,
          url: null
        }
      }))
    }
  }, [])

  const removeFile = (key: DocumentKey) => {
    if (documents[key].preview) {
      URL.revokeObjectURL(documents[key].preview!)
    }
    setDocuments(prev => ({
      ...prev,
      [key]: { file: null, preview: null, uploaded: false, url: null }
    }))
  }

  const uploadDocument = async (key: DocumentKey): Promise<string | null> => {
    const doc = documents[key]
    if (!doc.file) return null

    const fileExt = doc.file.name.split('.').pop()
    const fileName = `${userId}/${key}.${fileExt}`
    
    const { data, error } = await supabase.storage
      .from('identity-documents')
      .upload(fileName, doc.file, { upsert: true })

    if (error) {
      console.error(`Error uploading ${key}:`, error)
      throw error
    }

    // Get the public URL (or signed URL for private bucket)
    const { data: urlData } = supabase.storage
      .from('identity-documents')
      .getPublicUrl(data.path)

    return urlData.publicUrl
  }

  const handleSubmit = async () => {
    // Validate all documents are selected
    const allSelected = DOCUMENT_TYPES.every(doc => documents[doc.key].file !== null)
    if (!allSelected) {
      toast.error('Please upload all required documents')
      return
    }

    setIsSubmitting(true)

    try {
      // Upload all documents
      const urls: Record<string, string | null> = {}
      
      for (const docType of DOCUMENT_TYPES) {
        // Optimistic update for UI feedback
        setDocuments(prev => ({
          ...prev,
          [docType.key]: { ...prev[docType.key], uploaded: true }
        }))
        
        const url = await uploadDocument(docType.key)
        urls[docType.key] = url
        
        setDocuments(prev => ({
          ...prev,
          [docType.key]: { ...prev[docType.key], url }
        }))
      }

      // Update profile with document URLs and set status to pending
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          id_front_url: urls.id_front,
          id_back_url: urls.id_back,
          selfie_url: urls.selfie,
          verification_status_id: 2, // pending
          verification_submitted_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (updateError) {
        throw updateError
      }

      toast.success('Documents submitted for verification!', {
        action: { label: "View Status", onClick: () => router.push('/dashboard/profile') }
      })
      setIsSuccess(true)
      router.refresh()
      onComplete?.()
    } catch (error) {
      console.error('Error submitting verification:', error)
      toast.error('Failed to submit documents. Please try again.', {
        action: { label: "Retry", onClick: () => handleSubmit() }
      })
      setIsSubmitting(false)
    } 
  }

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center animate-in fade-in duration-500">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Documents Submitted</h3>
        <p className="text-muted-foreground max-w-sm">
          Your documents have been securely submitted and are now under review. This usually takes 1-2 business days.
        </p>
      </div>
    )
  }

  const allDocumentsSelected = DOCUMENT_TYPES.every(doc => documents[doc.key].file !== null)
  const completedSteps = DOCUMENT_TYPES.filter(doc => documents[doc.key].file !== null).length

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {DOCUMENT_TYPES.map((doc, index) => (
          <div key={doc.key} className="flex items-center">
            <div 
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                documents[doc.key].file 
                  ? "bg-green-500 text-white" 
                  : currentStep === doc.key 
                    ? "bg-primary text-white" 
                    : "bg-muted text-muted-foreground"
              )}
            >
              {documents[doc.key].file ? <Check className="w-4 h-4" /> : index + 1}
            </div>
            {index < DOCUMENT_TYPES.length - 1 && (
              <div className={cn(
                "w-12 h-0.5 mx-1",
                documents[doc.key].file ? "bg-green-500" : "bg-muted"
              )} />
            )}
          </div>
        ))}
      </div>

      {/* Document upload cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {DOCUMENT_TYPES.map((docType) => (
          <DocumentUploadCard
            key={docType.key}
            docType={docType}
            document={documents[docType.key]}
            onDrop={(files) => handleFileDrop(docType.key, files)}
            onRemove={() => removeFile(docType.key)}
            isActive={currentStep === docType.key}
            onClick={() => setCurrentStep(docType.key)}
          />
        ))}
      </div>

      {/* Info message */}
      <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
        <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
        <div className="text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Why do we need this?</p>
          <p className="mt-1">
            Identity verification helps keep our community safe. Your documents are securely stored 
            and only reviewed by our verification team. This is required before you can book or list properties.
          </p>
        </div>
      </div>

      {/* Submit button */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSubmit}
          disabled={!allDocumentsSelected || isSubmitting}
          size="lg"
          className="min-w-[200px]"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              Submit for Verification
              <span className="ml-2 text-xs opacity-70">({completedSteps}/3)</span>
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

// Individual document upload card component
interface DocumentUploadCardProps {
  docType: typeof DOCUMENT_TYPES[number]
  document: UploadedFile
  onDrop: (files: File[]) => void
  onRemove: () => void
  isActive: boolean
  onClick: () => void
}

function DocumentUploadCard({ docType, document, onDrop, onRemove, isActive, onClick }: DocumentUploadCardProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp']
    },
    maxFiles: 1,
    disabled: document.uploaded
  })

  const Icon = docType.icon

  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all",
        isActive && !document.file && "ring-2 ring-primary",
        document.uploaded && "opacity-75"
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">{docType.label}</CardTitle>
          {document.file && (
            <Check className="w-4 h-4 text-green-500 ml-auto" />
          )}
        </div>
        <CardDescription className="text-xs">{docType.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {document.preview ? (
          <div className="relative aspect-[3/2] rounded-lg overflow-hidden bg-muted">
            <Image
              src={document.preview}
              alt={docType.label}
              fill
              className="object-cover"
            />
            {!document.uploaded && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove()
                }}
                className="absolute top-2 right-2 p-1 bg-white/90 hover:bg-white rounded-full text-red-500 transition-colors shadow-sm"
                type="button"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {document.uploaded && (
              <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                <Check className="w-8 h-8 text-green-600" />
              </div>
            )}
          </div>
        ) : (
          <div 
            {...getRootProps()} 
            className={cn(
              "aspect-[3/2] border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 transition-colors",
              isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
            )}
          >
            <input {...getInputProps()} />
            <Upload className="w-6 h-6 text-muted-foreground" />
            <p className="text-xs text-muted-foreground text-center px-2">
              {isDragActive ? "Drop here" : "Click or drag to upload"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
