'use client'

import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { searchListings } from "@/app/admin/destinations/actions"
import { Badge } from "@/components/ui/badge"

interface Listing {
  id: string
  title: string
  city: string | null
  country: string | null
}

interface ListingPickerProps {
  value: string[]
  onChange: (value: string[]) => void
}

export function ListingPicker({ value, onChange }: ListingPickerProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<Listing[]>([])
  const [selectedListings, setSelectedListings] = React.useState<Listing[]>([])
  const [loading, startTransition] = React.useTransition()

  // Debounced search via server action
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length > 2) {
        startTransition(async () => {
          const data = await searchListings(query)
          setResults(data as Listing[])
        })
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  const handleSelect = (listing: Listing) => {
    if (!value.includes(listing.id)) {
      onChange([...value, listing.id])
      setSelectedListings(prev => [...prev, listing])
    }
    setOpen(false)
  }

  const handleRemove = (id: string) => {
    onChange(value.filter(v => v !== id))
    setSelectedListings(prev => prev.filter(l => l.id !== id))
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {value.map((id) => {
            const displayTitle = selectedListings.find(l => l.id === id)?.title || id
            return (
                <Badge key={id} variant="secondary" className="gap-1 pr-1">
                    {displayTitle}
                    <button
                        onClick={() => handleRemove(id)}
                        className="ml-1 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-full"
                        aria-label={`Remove ${displayTitle}`}
                    >
                        <X className="h-3 w-3" />
                    </button>
                </Badge>
            )
        })}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            Select listings...
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0">
          <Command shouldFilter={false}>
            <CommandInput 
                placeholder="Search listings by title..." 
                value={query}
                onValueChange={setQuery}
            />
            <CommandList>
                {loading && <div className="py-6 text-center text-sm">Searching...</div>}
                {!loading && results.length === 0 && <CommandEmpty>No listings found.</CommandEmpty>}
                <CommandGroup>
                {results.map((listing) => (
                    <CommandItem
                    key={listing.id}
                    value={listing.id}
                    onSelect={() => handleSelect(listing)}
                    >
                    <Check
                        className={cn(
                        "mr-2 h-4 w-4",
                        value.includes(listing.id) ? "opacity-100" : "opacity-0"
                        )}
                    />
                    <div className="flex flex-col">
                        <span>{listing.title}</span>
                        <span className="text-xs text-muted-foreground">{listing.city}, {listing.country}</span>
                    </div>
                    </CommandItem>
                ))}
                </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
