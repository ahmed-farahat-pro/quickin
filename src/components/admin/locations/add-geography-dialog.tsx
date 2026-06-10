'use client'

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2, Plus, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import
    {
        Dialog,
        DialogContent,
        DialogDescription,
        DialogFooter,
        DialogHeader,
        DialogTitle,
        DialogTrigger,
    } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { addGeographyAction } from "@/lib/actions/admin/geography-actions"
import { toast } from "sonner"

interface AddGeographyDialogProps
{
    type: 'country' | 'state' | 'city'
    countryIso2?: string
    stateIso2?: string
}

export function AddGeographyDialog({ type, countryIso2, stateIso2 }: AddGeographyDialogProps)
{
    const router = useRouter()
    const [open, setOpen] = React.useState(false)
    const [isLoading, setIsLoading] = React.useState(false)

    // Form State
    const [name, setName] = React.useState("")
    const [iso2, setIso2] = React.useState("")
    const [emoji, setEmoji] = React.useState("")
    const [latitude, setLatitude] = React.useState("")
    const [longitude, setLongitude] = React.useState("")

    const handleOpenChange = (newOpen: boolean) =>
    {
        setOpen(newOpen)
        if (!newOpen) {
            // Reset form
            setName("")
            setIso2("")
            setEmoji("")
            setLatitude("")
            setLongitude("")
        }
    }

    const handleSubmit = async (e: React.FormEvent) =>
    {
        e.preventDefault()

        if (!name.trim()) {
            toast.error("Name is required")
            return
        }

        if (type !== 'city' && !iso2.trim()) {
            toast.error("ISO2 Code is required")
            return
        }

        setIsLoading(true)

        try {
            const result = await addGeographyAction(type, {
                name: name.trim(),
                iso2: iso2.trim(),
                country_iso2: countryIso2,
                state_iso2: stateIso2,
                emoji: emoji.trim(),
                latitude: latitude ? parseFloat(latitude) : undefined,
                longitude: longitude ? parseFloat(longitude) : undefined,
            })

            if (!result.success) {
                throw new Error(result.error)
            }

            toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} added successfully!`)
            setOpen(false)
            router.refresh()
        } catch (error: any) {
            toast.error(error.message || `Failed to add ${type}`)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant={type === 'country' ? 'default' : 'outline'} size="sm" className="gap-2">
                    {type === 'country' ? <MapPin className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    Add {type.charAt(0).toUpperCase() + type.slice(1)}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Add New {type.charAt(0).toUpperCase() + type.slice(1)}</DialogTitle>
                        <DialogDescription>
                            Create a new custom location entry in the database.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">English Name *</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder={`Enter ${type} name`}
                                required
                            />
                        </div>

                        {type !== 'city' && (
                            <div className="grid gap-2">
                                <Label htmlFor="iso2">ISO Code * (Required)</Label>
                                <Input
                                    id="iso2"
                                    value={iso2}
                                    onChange={(e) => setIso2(e.target.value.toUpperCase())}
                                    placeholder={`e.g. ${type === 'country' ? 'US' : 'CA'}`}
                                    maxLength={5}
                                    required
                                />
                            </div>
                        )}

                        {type === 'country' && (
                            <div className="grid gap-2">
                                <Label htmlFor="emoji">Flag Emoji (Optional)</Label>
                                <Input
                                    id="emoji"
                                    value={emoji}
                                    onChange={(e) => setEmoji(e.target.value)}
                                    placeholder="e.g. 🇺🇸"
                                />
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="latitude">Latitude</Label>
                                <Input
                                    id="latitude"
                                    type="number"
                                    step="any"
                                    value={latitude}
                                    onChange={(e) => setLatitude(e.target.value)}
                                    placeholder="e.g. 37.7749"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="longitude">Longitude</Label>
                                <Input
                                    id="longitude"
                                    type="number"
                                    step="any"
                                    value={longitude}
                                    onChange={(e) => setLongitude(e.target.value)}
                                    placeholder="e.g. -122.4194"
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                "Save Location"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
