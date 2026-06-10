"use client"

import * as React from "react"
import { Check, ChevronsUpDown, X, Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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
import { Badge } from "@/components/ui/badge"

export interface Option
{
    label: string
    value: string
    description?: string
    icon?: React.ComponentType<{ className?: string }>
}

interface ComboboxMultiProps
{
    options: Option[]
    selected: string[]
    onChange: (selected: string[]) => void
    onCreate?: (value: string) => void
    placeholder?: string
    emptyText?: string
    className?: string
}

export function ComboboxMulti({
    options,
    selected,
    onChange,
    onCreate,
    placeholder = "Select items...",
    emptyText = "No item found.",
    className,
}: ComboboxMultiProps)
{
    const [open, setOpen] = React.useState(false)
    const [inputValue, setInputValue] = React.useState("")

    const handleUnselect = (item: string) =>
    {
        onChange(selected.filter((i) => i !== item))
    }

    const handleSelect = (value: string) =>
    {
        if (selected.includes(value)) {
            handleUnselect(value)
        } else {
            onChange([...selected, value])
        }
    }

    const handleCreate = () =>
    {
        if (onCreate && inputValue.trim()) {
            onCreate(inputValue.trim())
            setInputValue("")
        }
    }

    // Filter options to hide already selected ones from the dropdown if desired, 
    // or keep them to show checkmarks. Let's keep them to show checkmarks.

    return (
        <div className={cn("flex flex-col gap-2", className)}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between h-auto min-h-10 hover:bg-background"
                    >
                        <div className="flex flex-wrap gap-1 items-center">
                            {selected.length > 0 ? (
                                selected.map((itemValue) =>
                                {
                                    const option = options.find((o) => o.value === itemValue)
                                    // If option not found (maybe custom newly added), try to display value or find a way to get label
                                    // For custom values that haven't been added to 'options' yet, we might need to handle them.
                                    // But usually parent updates 'options' when 'onCreate' is called.
                                    const label = option?.label || itemValue
                                    return (
                                        <Badge key={itemValue} variant="secondary" className="mr-1 mb-1">
                                            {label}
                                            <div
                                                className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer"
                                                onKeyDown={(e) =>
                                                {
                                                    if (e.key === "Enter") {
                                                        handleUnselect(itemValue)
                                                    }
                                                }}
                                                onMouseDown={(e) =>
                                                {
                                                    e.preventDefault()
                                                    e.stopPropagation()
                                                }}
                                                onClick={() => handleUnselect(itemValue)}
                                            >
                                                <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                            </div>
                                        </Badge>
                                    )
                                })
                            ) : (
                                <span className="text-muted-foreground">{placeholder}</span>
                            )}
                        </div>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                    <Command>
                        <CommandInput
                            placeholder="Search..."
                            value={inputValue}
                            onValueChange={setInputValue}
                        />
                        <CommandList>
                            <CommandEmpty>{emptyText}</CommandEmpty>
                            <CommandGroup>
                                {options.map((option) => (
                                    <CommandItem
                                        key={option.value}
                                        value={option.label}
                                        onSelect={() =>
                                        {
                                            handleSelect(option.value)
                                        }}
                                        className="flex items-start gap-2 px-2 py-3"
                                    >
                                        <Check
                                            className={cn(
                                                "mt-1 h-4 w-4 shrink-0",
                                                selected.includes(option.value) ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        <div className="flex flex-col gap-0.5">
                                            <span className="font-medium">{option.label}</span>
                                            {option.description && (
                                                <span className="text-xs text-muted-foreground">{option.description}</span>
                                            )}
                                        </div>
                                    </CommandItem>
                                ))}
                                {onCreate && inputValue.trim() && !options.some(o => o.label.toLowerCase() === inputValue.trim().toLowerCase()) && (
                                    <CommandItem
                                        value={inputValue}
                                        onSelect={() => handleCreate()}
                                        className="text-muted-foreground italic cursor-pointer"
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Create "{inputValue}"
                                    </CommandItem>
                                )}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    )
}
