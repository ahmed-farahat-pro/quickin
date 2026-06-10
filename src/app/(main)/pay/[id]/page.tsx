'use client'

import { useState, use, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Upload, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { uploadHandoffReceipt } from '@/lib/supabase/bookings'
import { createClient } from '@/lib/supabase/client'

export default function MobilePaymentPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter()
    const { id: sessionId } = use(params)

    const [file, setFile] = useState<File | null>(null)
    const [preview, setPreview] = useState<string | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)

    // Auto-redirect after a few seconds of success
    useEffect(() => {
        if (isSuccess) {
            const timer = setTimeout(() => {
                // Redirect the mobile browser somewhere safe, like home, since they are unauthenticated
                router.push('/')
            }, 5000)
            return () => clearTimeout(timer)
        }
    }, [isSuccess, router])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0]
        if (selected) {
            setFile(selected)
            setPreview(URL.createObjectURL(selected))
        }
    }

    const handleUpload = async () => {
        if (!file || !sessionId) return

        setIsUploading(true)

        try {
            const formData = new FormData()
            formData.append('sessionId', sessionId)
            formData.append('file', file)

            const result = await uploadHandoffReceipt(formData)

            if (result.error || !result.receiptUrl) {
                toast.error(result.error)
                return
            }

            // Broadcast success to desktop
            const supabase = createClient()
            const channel = supabase.channel(`handoff-${sessionId}`)

            await new Promise((resolve) => {
                channel.subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        channel.send({
                            type: 'broadcast',
                            event: 'upload-success',
                            payload: { url: result.receiptUrl }
                        }).then(() => resolve(true))
                    }
                })
            })

            setIsSuccess(true)
            toast.success('Receipt uploaded successfully! You can close this window.')

            setTimeout(() => {
                supabase.removeChannel(channel)
            }, 1000)

        } catch (error) {
            console.error('Upload failed:', error)
            toast.error('Failed to upload receipt. Please try again.')
        } finally {
            setIsUploading(false)
        }
    }

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
                <Card className="w-full max-w-sm border-primary/20 shadow-lg">
                    <CardContent className="pt-6 flex flex-col items-center text-center space-y-4">
                        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="w-8 h-8 text-primary" />
                        </div>
                        <h2 className="text-xl font-semibold">Payment Completed!</h2>
                        <p className="text-muted-foreground text-sm">
                            Your receipt has been securely uploaded and linked to your booking.
                            You may now close this window and return to your desktop.
                        </p>
                        <Button variant="outline" className="mt-4 w-full" onClick={() => router.push('/')}>
                            Return Home
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center p-4">
            <Card className="w-full max-w-md shadow-md border-t-4 border-t-primary">
                <CardHeader className="text-center pb-2">
                    <CardTitle className="text-2xl font-bold">Complete Payment</CardTitle>
                    <p className="text-sm text-muted-foreground mt-2">
                        Upload the receipt screenshot from your mobile wallet application below.
                    </p>
                </CardHeader>
                <CardContent className="space-y-6 pt-4">
                    <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 bg-muted/50 transition-colors hover:bg-muted/80">
                        {preview ? (
                            <div className="space-y-4 w-full flex flex-col items-center">
                                <div className="relative w-full max-w-[240px] aspect-3/4 rounded-lg overflow-hidden border shadow-sm">
                                    <img src={preview} alt="Receipt preview" className="w-full h-full object-cover" />
                                </div>
                                <Button variant="outline" size="sm" onClick={() => { setFile(null); setPreview(null); }}>
                                    Choose a different file
                                </Button>
                            </div>
                        ) : (
                            <div className="text-center space-y-4 w-full">
                                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                                    <Upload className="w-6 h-6 text-primary" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-medium">Select Receipt Image</p>
                                    <p className="text-xs text-muted-foreground">PNG, JPG or JPEG allowed</p>
                                </div>
                                <div className="grid w-full items-center gap-1.5 pt-2">
                                    <Label htmlFor="mobile-receipt-upload" className="sr-only">Receipt Image</Label>
                                    <Input
                                        id="mobile-receipt-upload"
                                        type="file"
                                        accept="image/*"
                                        className="cursor-pointer file:cursor-pointer"
                                        onChange={handleFileChange}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <Button
                        className="w-full h-12 text-base font-medium"
                        onClick={handleUpload}
                        disabled={!file || isUploading}
                    >
                        {isUploading ? (
                            <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Uploading...
                            </>
                        ) : (
                            'Submit Receipt'
                        )}
                    </Button>
                </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground text-center mt-6 max-w-xs">
                Secure mobile payment gateway • Your desktop screen will update automatically.
            </p>
        </div>
    )
}
