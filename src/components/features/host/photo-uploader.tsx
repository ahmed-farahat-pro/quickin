'use client'

import { useCallback, useEffect, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import Image from 'next/image'
import { X, Upload, Home, Bed, Bath, Tv, Utensils, Armchair, Grid, Loader2 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from '@/lib/utils'
import { MAX_LISTING_PHOTOS } from '@/lib/constants'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

export interface ListingImageFile
{
  file: File
  preview: string
  category: string
  id: string
}

interface PhotoUploaderProps
{
  value: ListingImageFile[]
  onChange: (files: ListingImageFile[]) => void
  maxFiles?: number
}

export function PhotoUploader({ value, onChange, maxFiles = MAX_LISTING_PHOTOS }: PhotoUploaderProps)
{
  const t = useTranslations('dashboardListingManage.settings.photos')
  
  // Added by Shafra for HEIC file conversion
  const [isConverting, setIsConverting] = useState(false)

  const CATEGORIES = [
    { value: 'exterior', label: t('categories.exterior'), icon: Home },
    { value: 'living', label: t('categories.living'), icon: Tv },
    { value: 'bedroom', label: t('categories.bedroom'), icon: Bed },
    { value: 'kitchen', label: t('categories.kitchen'), icon: Utensils },
    { value: 'bathroom', label: t('categories.bathroom'), icon: Bath },
    { value: 'interior', label: t('categories.interior'), icon: Armchair },
    { value: 'other', label: t('categories.other'), icon: Grid },
  ]

  const onDrop = useCallback(async (acceptedFiles: File[]) =>
  {
    const remainingSlots = maxFiles - value.length;
    const filesToProcess = acceptedFiles.slice(0, remainingSlots);

    // Added by Shafra to identify if any files need conversion
    const needsConversion = filesToProcess.some(f => 
      f.type === 'image/heic' || 
      f.type === 'image/heif' || 
      f.name.toLowerCase().endsWith('.heic') || 
      f.name.toLowerCase().endsWith('.heif')
    );

    let processedFiles: File[];

    if (needsConversion) {
      setIsConverting(true);
      try {
        const heic2any = (await import('heic2any')).default;
        
        processedFiles = await Promise.all(filesToProcess.map(async (file) => {
          if (
            file.type === 'image/heic' || 
            file.type === 'image/heif' || 
            file.name.toLowerCase().endsWith('.heic') || 
            file.name.toLowerCase().endsWith('.heif')
          ) {
            try {
              const result = await heic2any({
                blob: file,
                toType: 'image/jpeg',
                quality: 0.9
              });
              
              const convertedBlob = Array.isArray(result) ? result[0] : result;
              return new File([convertedBlob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { 
                type: 'image/jpeg' 
              });
            } catch (err) {
              console.error(`Failed to convert ${file.name}:`, err);
              toast.error(`Failed to convert ${file.name}`);
              return file;
            }
          }
          return file;
        }));
      } catch (err) {
        console.error('Failed to load heic2any:', err);
        toast.error('Image conversion service unavailable');
        processedFiles = filesToProcess;
      } finally {
        setIsConverting(false);
      }
    } else {
      processedFiles = filesToProcess;
    }
    // Added by Shafra to identify if any files need conversion

    const newFiles = processedFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      category: 'other', // Default category
      id: Math.random().toString(36).substring(7)
    }))

    onChange([...value, ...newFiles])
  }, [value, onChange, maxFiles])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.heic', '.heif']
    },
    maxFiles: maxFiles - value.length,
    disabled: value.length >= maxFiles,
    multiple: true
  })

  // Cleanup previews on unmount
  useEffect(() =>
  {
    return () => value.forEach(file => URL.revokeObjectURL(file.preview))
  }, [value])

  const removeFile = (id: string) =>
  {
    onChange(value.filter(file => file.id !== id))
  }

  const updateCategory = (id: string, category: string) =>
  {
    onChange(value.map(file =>
      file.id === id ? { ...file, category } : file
    ))
  }

  return (
    <div className="space-y-6">
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-primary rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ease-in-out",
          isDragActive ? "bg-primary/5" : "border-dashed border-primary/50 hover:border-solid hover:border-primary",
          value.length >= maxFiles && "opacity-50 cursor-not-allowed"
        )}
      >
        <input {...getInputProps()} />
    {/* // Added by Shafra to identify if any files need conversion */}
        <div className="flex flex-col items-center justify-center gap-2">
          {isConverting ? (
            <div className="flex flex-col items-center gap-2 animate-in fade-in zoom-in duration-300">
              <div className="bg-primary/10 p-4 rounded-full">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
              <p className="text-lg font-medium text-primary">
                {t('converting')}
              </p>
            </div>
        // Added by Shafra to identify if any files need conversion
          ) : (
            <>
              <div className="bg-primary/10 p-4 rounded-full">
                <Upload className="w-8 h-8 text-primary" />
              </div>
              <p className="text-lg font-medium text-primary">
                {isDragActive ? t('dropActive') : t('dropInactive')}
              </p>
              <p className="text-sm text-primary/50">
                {t('clickToSelect')}
              </p>
            </>
          )}
        </div>
      </div>

      {value.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {value.map((file) => (
            <div key={file.id} className="group relative rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
              {/* Image Preview */}
              <div className="relative aspect-[4/3]">
                <Image
                  src={file.preview}
                  alt="Preview"
                  fill
                  className="object-cover"
                />
                <button
                  onClick={() => removeFile(file.id)}
                  className="absolute top-2 right-2 p-1 bg-white/80 hover:bg-white rounded-full text-red-500 transition-colors shadow-sm"
                  type="button"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Category Selector */}
              <div className="p-3 bg-white">
                <Select
                  value={file.category}
                  onValueChange={(val) => updateCategory(file.id, val)}
                >
                  <SelectTrigger className="w-full text-xs h-8">
                    <SelectValue placeholder={t('category')} />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        <div className="flex items-center gap-2">
                          <cat.icon className="w-3 h-3 text-muted-foreground" />
                          <span>{cat.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

