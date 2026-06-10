'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Heart } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface WishlistCardProps
{
    id: string
    name: string
    itemCount: number
    previewImages: string[]
}

export function WishlistCard({ id, name, itemCount, previewImages }: WishlistCardProps)
{
    return (
        <Link href={`/dashboard/wishlists/${id}`} className="group block">
            <div className="space-y-3">
                {/* Composite Preview Image - Airbnb Style */}
                <div className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-md group-hover:shadow-xl transition-all duration-300 ring-1 ring-border">
                    {previewImages.length === 0 ? (
                        <div className="absolute inset-0 bg-muted flex flex-col items-center justify-center gap-2">
                            <div className="h-12 w-12 rounded-full bg-background flex items-center justify-center">
                                <Heart className="h-6 w-6 text-muted-foreground/40" />
                            </div>
                        </div>
                    ) : previewImages.length === 1 ? (
                        <Image
                            src={previewImages[0]}
                            alt={name}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                    ) : (
                        <div className="flex h-full gap-[2px]">
                            <div className="relative flex-[2] h-full">
                                <Image
                                    src={previewImages[0]}
                                    alt={name}
                                    fill
                                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                            </div>
                            <div className="flex-1 flex flex-col gap-[2px]">
                                <div className="relative flex-1">
                                    <Image
                                        src={previewImages[1]}
                                        alt={name}
                                        fill
                                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                </div>
                                {previewImages[2] ? (
                                    <div className="relative flex-1">
                                        <Image
                                            src={previewImages[2]}
                                            alt={name}
                                            fill
                                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    </div>
                                ) : (
                                    <div className="flex-1 bg-muted" />
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Wishlist Info */}
                <div className="px-1">
                    <h3 className="text-lg font-semibold group-hover:underline decoration-2 underline-offset-4">{name}</h3>
                    <p className="text-muted-foreground font-medium">
                        {itemCount} {itemCount === 1 ? 'saved listing' : 'saved listings'}
                    </p>
                </div>
            </div>
        </Link>
    )
}
