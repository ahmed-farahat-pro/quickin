'use client'

import { useState } from 'react'
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Check, X, Edit2, Plus, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { updateGeographyTranslationAction } from '@/lib/actions/admin/translation-actions'

interface EditableTranslationProps
{
    table: 'countries' | 'states' | 'cities'
    id: number
    locale: string
    initialValue?: string
}

export function EditableTranslation({ table, id, locale, initialValue = '' }: EditableTranslationProps)
{
    const [isEditing, setIsEditing] = useState(false)
    const [value, setValue] = useState(initialValue)
    const [isSaving, setIsSaving] = useState(false)

    const handleSave = async () =>
    {
        setIsSaving(true)
        const result = await updateGeographyTranslationAction(table, id, locale, value)
        setIsSaving(false)

        if (result?.success) {
            toast.success('Translation updated')
            setIsEditing(false)
        } else {
            toast.error(result?.error || 'Failed to update translation')
        }
    }

    if (isEditing) {
        return (
            <div className="flex items-center gap-1">
                <Input
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="h-6 text-xs w-[120px] px-2 py-1"
                    placeholder={`Transl. in ${locale}`}
                    autoFocus
                    onKeyDown={(e) =>
                    {
                        if (e.key === 'Enter') handleSave()
                        if (e.key === 'Escape') {
                            setValue(initialValue)
                            setIsEditing(false)
                        }
                    }}
                    disabled={isSaving}
                />
                <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={handleSave}
                    disabled={isSaving}
                >
                    {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                </Button>
                <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground hover:bg-muted"
                    onClick={() =>
                    {
                        setValue(initialValue)
                        setIsEditing(false)
                    }}
                    disabled={isSaving}
                >
                    <X className="h-3 w-3" />
                </Button>
            </div>
        )
    }

    if (initialValue) {
        return (
            <Badge
                variant="outline"
                className="text-xs font-normal group cursor-pointer hover:bg-accent flex items-center gap-1 pr-1"
                onClick={() => setIsEditing(true)}
            >
                <span>{locale}: {initialValue}</span>
                <Edit2 className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Badge>
        )
    }

    return (
        <Badge
            variant="secondary"
            className="text-xs font-normal border-dashed bg-transparent cursor-pointer hover:bg-accent flex items-center gap-1 pr-1 opacity-50 hover:opacity-100"
            onClick={() => setIsEditing(true)}
        >
            <Plus className="h-2.5 w-2.5" />
            <span>Add {locale}</span>
        </Badge>
    )
}
