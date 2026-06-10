'use client'

import React, { useState } from 'react'
import { Button } from "@/components/ui/button"
import
{
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Check, ChevronsUpDown, Loader2, Globe, CheckCircle2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import
{
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import
{
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import { type ICountry } from "@countrystatecity/countries"
import { importCountryDataAction, getLibraryCountriesAction } from "@/lib/actions/admin/geography-actions"

export function GeographyImport()
{
    const [isOpen, setIsOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [progress, setProgress] = useState(0)
    const [openCombobox, setOpenCombobox] = useState(false)
    const [selectedIso, setSelectedIso] = useState<string>("")
    const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error', message: string }>({ type: 'idle', message: '' })

    const [countriesList, setAvailableCountries] = useState<any[]>([])

    // Load countries dynamically
    React.useEffect(() =>
    {
        // getLibraryCountriesAction is an async function from our server action
        const loadCountries = async () =>
        {
            try {
                const countries = await getLibraryCountriesAction()
                // We'll just force cast for the UI since we know the shape has isoCode and name
                setAvailableCountries(countries as any[])
            } catch (e) {
                console.error(e)
            }
        }
        loadCountries()
    }, [])

    const handleImport = async () =>
    {
        if (!selectedIso) return

        setIsLoading(true)
        setProgress(5) // Start with a small progress
        setStatus({ type: 'idle', message: 'Extracting and translating data. This may take several minutes for large countries...' })

        // Simulate progress slowly incrementing since we don't have SSE from the action
        const interval = setInterval(() =>
        {
            setProgress((prev) =>
            {
                // Don't go past 90% via simulation, leave 10% for success
                if (prev >= 90) return 90;
                // Slower increment as it gets higher
                const increment = prev < 50 ? Math.random() * 5 : prev < 75 ? Math.random() * 2 : Math.random() * 0.5;
                return prev + increment;
            });
        }, 1500)

        try {
            const result = await importCountryDataAction(selectedIso)

            if (result && result.success) {
                setProgress(100)
                setStatus({ type: 'success', message: result.message || 'Import completed successfully.' })
            } else {
                setProgress(0)
                setStatus({ type: 'error', message: result?.error || 'Failed to import country data.' })
            }
        } catch (error: any) {
            setProgress(0)
            setStatus({ type: 'error', message: error.message || 'An unexpected error occurred.' })
        } finally {
            clearInterval(interval)
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) =>
        {
            setIsOpen(open)
            if (!open) {
                // Reset state on close
                setSelectedIso("")
                setProgress(0)
                setStatus({ type: 'idle', message: '' })
            }
        }}>
            <DialogTrigger asChild>
                <Button suppressHydrationWarning variant="outline" className="gap-2">
                    <Globe className="h-4 w-4" />
                    Import Locations
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Import & Translate Geography</DialogTitle>
                    <DialogDescription>
                        Extract countries, states, and cities from the global library into our database. The system will automatically use AI to translate names to Arabic.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium">Select Country to Import</label>
                        <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={openCombobox}
                                    className="w-full justify-between"
                                    disabled={isLoading}
                                >
                                    {selectedIso
                                        ? (() =>
                                        {
                                            const c = countriesList.find((c) => c.iso2 === selectedIso);
                                            return c ? <span className="flex items-center gap-2"><span>{c.emoji}</span> {c.name}</span> : "Select a country...";
                                        })()
                                        : (countriesList.length === 0 ? "Loading countries..." : "Select a country...")}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-full p-0" style={{ width: 'var(--radix-popover-trigger-width)' }}>
                                <Command>
                                    <CommandInput placeholder="Search country..." />
                                    <CommandList>
                                        <CommandEmpty>No country found.</CommandEmpty>
                                        <CommandGroup>
                                            {countriesList.map((c, idx) => (
                                                <CommandItem
                                                    key={c.iso2 || `country-${idx}`}
                                                    value={c.name}
                                                    onSelect={() =>
                                                    {
                                                        setSelectedIso(c.iso2)
                                                        setOpenCombobox(false)
                                                    }}
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            selectedIso === c.iso2 ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    <span className="mr-2">{c.emoji}</span> {c.name}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    {(isLoading || progress > 0) && (
                        <div className="space-y-2">
                            <Progress value={progress} className="w-full h-2 transition-all duration-500" />
                            <p className="text-xs text-muted-foreground text-right">{Math.round(progress)}%</p>
                        </div>
                    )}

                    {status.message && (
                        <div className={`p-3 rounded-md text-sm flex items-start gap-2 ${status.type === 'error' ? 'bg-destructive/10 text-destructive' :
                            status.type === 'success' ? 'bg-green-50 text-green-700' :
                                'bg-muted text-muted-foreground'
                            }`}>
                            {status.type === 'error' && <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
                            {status.type === 'success' && <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />}
                            {status.type === 'idle' && isLoading && <Loader2 className="h-4 w-4 mt-0.5 animate-spin shrink-0" />}
                            <p>{status.message}</p>
                        </div>
                    )}

                    <Button
                        onClick={handleImport}
                        disabled={!selectedIso || isLoading}
                        className="w-full mt-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Processing Import...
                            </>
                        ) : (
                            'Start Import'
                        )}
                    </Button>

                    <p className="text-xs text-muted-foreground text-center">
                        Note: Importing countries with thousands of cities (like the US or India) might take a while due to AI translation rate limits. Please keep this dialog open.
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    )
}
