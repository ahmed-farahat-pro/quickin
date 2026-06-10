'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from "zod"
import { Button } from '@/components/ui/button'
import
{
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import
{
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { upsertDestination } from '@/app/admin/destinations/actions'
import { SearchDestination } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { ListingPicker } from './listing-picker'
import LocationPicker from './location-picker'
// Import dynamic for LocationPicker to ensure it's client-side only if needed
import dynamic from 'next/dynamic'
import { Check, ChevronsUpDown, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
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

// Location Actions
import
{
    getCountriesAction,
    getStatesOfCountryAction,
    getCitiesOfStateAction,
    getAllCitiesOfCountryAction,
    type ICountry,
    type IState,
    type ICity
} from "@/lib/actions/location-actions"

const DynamicLocationPicker = dynamic(() => import('./location-picker'), {
    ssr: false,
    loading: () => <div className="h-[400px] w-full bg-muted animate-pulse rounded-md" />
})

const formSchema = z.object({
    id: z.string().optional(),
    label: z.string().min(2, { message: 'Label must be at least 2 characters.' }),
    description: z.string().optional().or(z.literal('')),
    label_ar: z.string().optional().or(z.literal('')),
    description_ar: z.string().optional().or(z.literal('')),
    image_url: z.string().optional().or(z.literal('')),
    type: z.enum(['city', 'area', 'curated']),
    country: z.string().default('Egypt'),
    include_surrounding: z.boolean().default(false),
    listing_ids: z.array(z.string()).default([]),
    is_active: z.boolean().default(true),
    lat: z.number(),
    lng: z.number(),
    radius_km: z.number().min(1)
})

interface DestinationFormProps
{
    initialData?: SearchDestination
}

export function DestinationForm({ initialData }: DestinationFormProps)
{
    const router = useRouter()
    const [uploading, setUploading] = useState(false)

    // Location States
    const [countries, setCountries] = useState<ICountry[]>([])
    const [states, setStates] = useState<IState[]>([])
    const [cities, setCities] = useState<ICity[]>([])

    const [openCountry, setOpenCountry] = useState(false)
    const [openState, setOpenState] = useState(false)
    const [openCity, setOpenCity] = useState(false)

    const [isLoadingCountries, setIsLoadingCountries] = useState(false)
    const [isLoadingStates, setIsLoadingStates] = useState(false)
    const [isLoadingCities, setIsLoadingCities] = useState(false)

    const [selectedCountryIso, setSelectedCountryIso] = useState<string>("")
    const [selectedStateIso, setSelectedStateIso] = useState<string>("")

    // Parse location point to lat/lng for form defaults
    // Assuming strict contract or default
    let defaultLat = 30.0444
    let defaultLng = 31.2357

    // Note: Parsing initialData location string (POINT(x y)) should technically be done here if possible to improve UX on edit
    // But for now sticking to what we have or letting the user re-pick if needed. 
    // If we had simple columns it would be easier.
    // We can try to regex it if it's WKT string.
    if (initialData?.location && typeof initialData.location === 'string' && initialData.location.startsWith('POINT')) {
        const match = initialData.location.match(/POINT\(([-0-9.]+) ([-0-9.]+)\)/)
        if (match) {
            defaultLng = parseFloat(match[1])
            defaultLat = parseFloat(match[2])
        }
    }

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            id: initialData?.id,
            label: initialData?.label || '',
            description: initialData?.description || '',
            label_ar: (initialData?.translations as any)?.ar?.label || '',
            description_ar: (initialData?.translations as any)?.ar?.description || '',
            image_url: initialData?.image_url || '',
            type: initialData?.type || 'city',
            country: initialData?.country || 'Egypt',
            include_surrounding: initialData?.include_surrounding || false,
            listing_ids: initialData?.listing_ids || [],
            is_active: initialData?.is_active ?? true,
            lat: defaultLat,
            lng: defaultLng,
            radius_km: initialData?.radius_km || 10
        } as any,
    })

    // Watchers
    const watchType = form.watch('type')
    const watchCountry = form.watch('country')

    // Fetch Countries
    useEffect(() =>
    {
        const fetchCountries = async () =>
        {
            setIsLoadingCountries(true)
            try {
                const data = await getCountriesAction()
                setCountries(data || [])

                // Try to set initial ISO from form value (whether initialData or default)
                const currentCountry = form.getValues('country')
                if (currentCountry) {
                    const c = data?.find(x => x.name === currentCountry)
                    if (c) setSelectedCountryIso(c.iso2)
                }
            } catch (e) {
                console.error(e)
            } finally {
                setIsLoadingCountries(false)
            }
        }
        fetchCountries()
    }, []) // Remove dependency on initialData to run once reliably, checking form state works because useForm initializes synchronous defaults

    // Fetch States when Country ISO changes
    useEffect(() =>
    {
        const fetchStates = async () =>
        {
            if (!selectedCountryIso) return
            setIsLoadingStates(true)
            try {
                const data = await getStatesOfCountryAction(selectedCountryIso)
                setStates(data || [])
            } catch (e) {
                console.error(e)
            } finally {
                setIsLoadingStates(false)
            }
        }
        fetchStates()
    }, [selectedCountryIso])

    // Fetch Cities when State ISO changes
    useEffect(() =>
    {
        const fetchCities = async () =>
        {
            // Optionally you could fallback to `getAllCitiesOfCountryAction` if no state, 
            // but performance wise it's safer to require state.
            if (!selectedCountryIso || !selectedStateIso) return
            setIsLoadingCities(true)
            try {
                const data = await getCitiesOfStateAction(selectedCountryIso, selectedStateIso)
                setCities(data || [])
            } catch (e) {
                console.error(e)
            } finally {
                setIsLoadingCities(false)
            }
        }
        fetchCities()
    }, [selectedCountryIso, selectedStateIso])


    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) =>
    {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(true)
        const supabase = createClient()
        const fileExt = file.name.split('.').pop()
        const fileName = `${Math.random()}.${fileExt}`
        const filePath = `destinations/${fileName}`

        const { error: uploadError } = await supabase.storage
            .from('destinations') // Using dedicated 'destinations' bucket
            .upload(filePath, file)

        if (uploadError) {
            toast.error('Error uploading image')
            console.error(uploadError)
            setUploading(false)
            return
        }

        const { data: { publicUrl } } = supabase.storage
            .from('destinations')
            .getPublicUrl(filePath)

        form.setValue('image_url', publicUrl)
        setUploading(false)
        toast.success('Image uploaded')
    }

    async function onSubmit(values: any)
    {
        try {
            // Create WKT Point
            const locationWKT = `POINT(${values.lng} ${values.lat})`

            const payload = {
                label: values.label,
                description: values.description,
                translations: {
                    ar: {
                        label: values.label_ar || '',
                        description: values.description_ar || ''
                    }
                },
                image_url: values.image_url,
                type: values.type,
                country: values.country,
                include_surrounding: values.include_surrounding,
                listing_ids: values.listing_ids,
                is_active: values.is_active,
                radius_km: values.radius_km,
                location: locationWKT,
                ...(values.id ? { id: values.id } : {})
            }

            const result = await upsertDestination(payload)

            if (result.error) {
                toast.error(result.error)
                return
            }

            toast.success('Destination saved')
            router.push('/admin/destinations')
            router.refresh()
        } catch (error) {
            console.error(error)
            toast.error('Something went wrong')
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 max-w-4xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">

                        {/* Type Selection */}
                        <FormField
                            control={form.control}
                            name="type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Type</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select type" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="city">City</SelectItem>
                                            <SelectItem value="area">Area</SelectItem>
                                            <SelectItem value="curated">Curated / Picked</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Country Dropdown */}
                        <FormField
                            control={form.control}
                            name="country"
                            render={({ field }) => (
                                <FormItem className="flex-1">
                                    <FormLabel>Country</FormLabel>
                                    <Popover open={openCountry} onOpenChange={setOpenCountry}>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    className={cn(
                                                        "w-full justify-between",
                                                        !field.value && "text-muted-foreground"
                                                    )}
                                                >
                                                    {field.value
                                                        ? countries.find((country) => country.name === field.value)?.name || field.value
                                                        : (isLoadingCountries ? "Loading countries..." : "Select country")}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[300px] p-0">
                                            <Command>
                                                <CommandInput placeholder="Search country..." />
                                                <CommandList>
                                                    <CommandEmpty>No country found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {countries.map((country) => (
                                                            <CommandItem
                                                                value={country.name}
                                                                key={country.id}
                                                                onSelect={() =>
                                                                {
                                                                    form.setValue("country", country.name)
                                                                    setSelectedCountryIso(country.iso2 || '')
                                                                    setStates([])
                                                                    setCities([])
                                                                    setSelectedStateIso("")
                                                                    setOpenCountry(false)
                                                                    // Optional: Center map on country
                                                                    if (country.latitude && country.longitude) {
                                                                        form.setValue('lat', parseFloat(country.latitude))
                                                                        form.setValue('lng', parseFloat(country.longitude))
                                                                        form.setValue('radius_km', 500) // Zoom out for country
                                                                    }
                                                                }}
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        "mr-2 h-4 w-4",
                                                                        country.name === field.value
                                                                            ? "opacity-100"
                                                                            : "opacity-0"
                                                                    )}
                                                                />
                                                                {country.emoji} {country.name}
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* State Dropdown (Only if picking a city/area) */}
                        {(watchType === 'city' || watchType === 'area') && (
                            <FormField
                                control={form.control}
                                name="description" // Using description field just as a placeholder since there is no state column.
                                render={({ field }) => (
                                    <FormItem className="flex-1">
                                        <FormLabel>State / Region</FormLabel>
                                        <Popover open={openState} onOpenChange={setOpenState}>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant="outline"
                                                        role="combobox"
                                                        className={cn(
                                                            "w-full justify-between",
                                                            !selectedStateIso && "text-muted-foreground"
                                                        )}
                                                        disabled={!selectedCountryIso || isLoadingStates}
                                                    >
                                                        {selectedStateIso
                                                            ? states.find((s) => s.iso2 === selectedStateIso)?.name || 'State selected'
                                                            : (isLoadingStates ? "Loading states..." : "Select state")}
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[300px] p-0">
                                                <Command>
                                                    <CommandInput placeholder="Search state..." />
                                                    <CommandList>
                                                        <CommandEmpty>No state found.</CommandEmpty>
                                                        <CommandGroup>
                                                            {states.map((state) => (
                                                                <CommandItem
                                                                    value={state.name}
                                                                    key={state.id}
                                                                    onSelect={() =>
                                                                    {
                                                                        setSelectedStateIso(state.iso2 || '')
                                                                        setOpenState(false)

                                                                        // Automatically fill label for region if it's an Area.
                                                                        if (watchType === 'area') {
                                                                            form.setValue("label", state.name)
                                                                        }

                                                                        // Move map
                                                                        if (state.latitude && state.longitude) {
                                                                            form.setValue('lat', parseFloat(state.latitude))
                                                                            form.setValue('lng', parseFloat(state.longitude))
                                                                            form.setValue('radius_km', 200)
                                                                        }
                                                                    }}
                                                                >
                                                                    <Check
                                                                        className={cn(
                                                                            "mr-2 h-4 w-4",
                                                                            selectedStateIso === state.iso2
                                                                                ? "opacity-100"
                                                                                : "opacity-0"
                                                                        )}
                                                                    />
                                                                    {state.name}
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                    </FormItem>
                                )}
                            />
                        )}

                        {/* Label (Name) - Conditional Input vs Dropdown */}
                        <FormField
                            control={form.control}
                            name="label"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Label {watchType === 'city' ? '(City)' : watchType === 'area' ? '(Area/Region)' : '(Name)'}</FormLabel>
                                    {watchType === 'city' && selectedStateIso ? (
                                        <Popover open={openCity} onOpenChange={setOpenCity}>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant="outline"
                                                        role="combobox"
                                                        className={cn(
                                                            "w-full justify-between",
                                                            !field.value && "text-muted-foreground"
                                                        )}
                                                        disabled={!selectedStateIso || isLoadingCities}
                                                    >
                                                        {field.value || (isLoadingCities ? "Loading cities..." : "Select city")}
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[300px] p-0">
                                                <Command>
                                                    <CommandInput placeholder="Search city..." />
                                                    <CommandList>
                                                        <CommandEmpty>No city found.</CommandEmpty>
                                                        <CommandGroup>
                                                            {cities.slice(0, 50).map((city) => ( // Limit to 50 for perf
                                                                <CommandItem
                                                                    value={city.name}
                                                                    key={city.id}
                                                                    onSelect={() =>
                                                                    {
                                                                        form.setValue("label", city.name)
                                                                        setOpenCity(false)
                                                                        // Auto-set coordinates
                                                                        if (city.latitude && city.longitude) {
                                                                            form.setValue('lat', parseFloat(city.latitude))
                                                                            form.setValue('lng', parseFloat(city.longitude))
                                                                            form.setValue('radius_km', 20) // Default radius for city
                                                                        }
                                                                    }}
                                                                >
                                                                    <Check
                                                                        className={cn(
                                                                            "mr-2 h-4 w-4",
                                                                            city.name === field.value
                                                                                ? "opacity-100"
                                                                                : "opacity-0"
                                                                        )}
                                                                    />
                                                                    {city.name}
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                    ) : (
                                        <FormControl>
                                            <Input placeholder="e.g. New Cairo" {...field} />
                                        </FormControl>
                                    )}
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Arabic Label */}
                        <FormField
                            control={form.control}
                            name="label_ar"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Label (Arabic)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="مثال: القاهرة الجديدة" dir="rtl" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Active & Include Surrounding */}
                        <div className="flex gap-4">
                            <FormField
                                control={form.control}
                                name="is_active"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-4 border rounded-md h-full mt-2 flex-1">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                        <div className="space-y-1 leading-none">
                                            <FormLabel>
                                                Active
                                            </FormLabel>
                                        </div>
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="include_surrounding"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                        <FormLabel>
                                            Include Surrounding Area
                                        </FormLabel>
                                        <FormDescription>
                                            If checked, search will include listings in nearby countries (cross-border). <br />
                                            If unchecked, it strictly filters only listings in the same Country.
                                        </FormDescription>
                                    </div>
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Destination description..." className="min-h-[100px]" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Arabic Description */}
                        <FormField
                            control={form.control}
                            name="description_ar"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description (Arabic)</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="وصف الوجهة..." className="min-h-[100px]" dir="rtl" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormItem>
                            <FormLabel>Image</FormLabel>
                            <div className="flex items-center gap-4">
                                {form.watch('image_url') && (
                                    <img src={form.watch('image_url')} alt="Preview" className="h-20 w-20 object-cover rounded-md" />
                                )}
                                <Input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    disabled={uploading}
                                />
                            </div>
                        </FormItem>
                    </div>

                    <div className="space-y-6">
                        {/* Map */}
                        <div className="rounded-lg overflow-hidden border">
                            <FormLabel className="p-2 block flex items-center gap-2">
                                <MapPin className="w-4 h-4" />
                                Location & Radius
                            </FormLabel>
                            <DynamicLocationPicker
                                value={{
                                    lat: form.watch('lat'),
                                    lng: form.watch('lng'),
                                    radius: form.watch('radius_km')
                                }}
                                onChange={(val) =>
                                {
                                    form.setValue('lat', val.lat)
                                    form.setValue('lng', val.lng)
                                    form.setValue('radius_km', val.radius)
                                }}
                            />
                        </div>

                        {form.watch('type') === 'curated' && (
                            <FormField
                                control={form.control}
                                name="listing_ids"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Specific Listings (Picked Stays)</FormLabel>
                                        <FormControl>
                                            <ListingPicker
                                                value={field.value}
                                                onChange={field.onChange}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            Override location search and show these specific listings.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}
                    </div>
                </div>

                <Button type="submit" disabled={uploading}>
                    {initialData ? 'Update Destination' : 'Create Destination'}
                </Button>
            </form>
        </Form>
    )
}
