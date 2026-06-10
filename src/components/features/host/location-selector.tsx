"use client"

import * as React from "react"
import { Loader2, Check, ChevronsUpDown } from "lucide-react"
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

interface LocationSelectorProps
{
  countryValue: string
  stateValue: string
  cityValue: string
  onCountryChange: (name: string, isoCode: string, id?: string, lat?: number, lng?: number) => void
  onStateChange: (name: string, isoCode: string, id?: string, lat?: number, lng?: number) => void
  onCityChange: (name: string, id?: string, lat?: number, lng?: number) => void
  disabled?: boolean
}

export function LocationSelector({
  countryValue,
  stateValue,
  cityValue,
  onCountryChange,
  onStateChange,
  onCityChange,
  disabled = false
}: LocationSelectorProps)
{
  const [openCountry, setOpenCountry] = React.useState(false)
  const [openState, setOpenState] = React.useState(false)
  const [openCity, setOpenCity] = React.useState(false)

  const [selectedCountryIso, setSelectedCountryIso] = React.useState<string>("")
  const [selectedStateIso, setSelectedStateIso] = React.useState<string>("")

  const [countries, setCountries] = React.useState<ICountry[]>([])
  const [states, setStates] = React.useState<IState[]>([])
  const [cities, setCities] = React.useState<ICity[]>([])

  const [isLoadingCountries, setIsLoadingCountries] = React.useState(false)
  const [isLoadingStates, setIsLoadingStates] = React.useState(false)
  const [isLoadingCities, setIsLoadingCities] = React.useState(false)

  // 1. Fetch Countries on Mount
  React.useEffect(() =>
  {
    const fetchCountries = async () =>
    {
      setIsLoadingCountries(true)
      try {
        const data = await getCountriesAction()
        setCountries(data || [])
      } catch (error) {
        console.error("Failed to fetch countries", error)
      } finally {
        setIsLoadingCountries(false)
      }
    }
    fetchCountries()
  }, [])

  // 2. Fetch States when Country ISO changes
  React.useEffect(() =>
  {
    const fetchStates = async () =>
    {
      if (!selectedCountryIso) {
        setStates([])
        return
      }
      setIsLoadingStates(true)
      try {
        const data = await getStatesOfCountryAction(selectedCountryIso)
        setStates(data || [])
      } catch (error) {
        console.error("Failed to fetch states", error)
        setStates([])
      } finally {
        setIsLoadingStates(false)
      }
    }
    fetchStates()
  }, [selectedCountryIso])

  // 3. Fetch Cities when State ISO (or Country ISO) changes
  React.useEffect(() =>
  {
    const fetchCities = async () =>
    {
      if (!selectedCountryIso) {
        setCities([])
        return
      }
      setIsLoadingCities(true)
      try {
        let data: ICity[] = []
        if (selectedStateIso) {
          data = await getCitiesOfStateAction(selectedCountryIso, selectedStateIso)
        } else {
          // Fallback to all cities in country if no state selected (or if user clears state)
          data = await getAllCitiesOfCountryAction(selectedCountryIso)
        }
        setCities(data || [])
      } catch (error) {
        console.error("Failed to fetch cities", error)
        setCities([])
      } finally {
        setIsLoadingCities(false)
      }
    }
    // Only fetch if we have a country. 
    // If state changes to empty, we re-fetch all country cities (unless logic dictates otherwise)
    if (selectedCountryIso) {
      fetchCities()
    } else {
      setCities([])
    }
  }, [selectedCountryIso, selectedStateIso])

  // 4. Sync initial values and updates from parent (e.g. Map Reverse Geo)
  // We need to find the ISO code for the provided country name
  React.useEffect(() =>
  {
    if (countryValue && countries.length > 0) {
      const country = countries.find(c => c.name === countryValue)
      if (country && country.iso2 !== selectedCountryIso) {
        setSelectedCountryIso(country.iso2)
      }
    }
  }, [countryValue, countries, selectedCountryIso])

  React.useEffect(() =>
  {
    if (stateValue && selectedCountryIso && states.length > 0) {
      // Find state by name (exact match)
      const state = states.find(s => s.name === stateValue)
      if (state && state.iso2 !== selectedStateIso) {
        console.log("Syncing State from Prop:", state.name, state.iso2)
        setSelectedStateIso(state.iso2)
      }
    }
  }, [stateValue, selectedCountryIso, selectedStateIso, states])

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Country Selector */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Country</label>
        <Popover open={openCountry} onOpenChange={setOpenCountry}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={openCountry}
              className="w-full justify-between"
              disabled={disabled || isLoadingCountries}
            >
              {countryValue
                ? countryValue
                : (isLoadingCountries ? "Loading..." : "Select country...")}
              {isLoadingCountries ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0">
            <Command>
              <CommandInput placeholder="Search country..." />
              <CommandList>
                <CommandEmpty>No country found.</CommandEmpty>
                <CommandGroup>
                  {countries.map((country) => (
                    <CommandItem
                      key={country.iso2 || country.name}
                      value={country.name}
                      onSelect={(currentValue) =>
                      {
                        // currentValue comes lowercased from Shadcn.
                        // We find the original object by matching lowercased names.
                        const countryObj = countries.find(c => c.name.toLowerCase() === currentValue.toLowerCase())
                        if (countryObj) {
                          console.log("Country Selected:", countryObj.name, countryObj.iso2)
                          onCountryChange(
                            countryObj.name,
                            countryObj.iso2,
                            countryObj.id,
                            countryObj.latitude ? parseFloat(countryObj.latitude) : undefined,
                            countryObj.longitude ? parseFloat(countryObj.longitude) : undefined
                          )
                          setSelectedCountryIso(countryObj.iso2)
                          // Reset state and city local state
                          setStates([])
                          setCities([])
                          setSelectedStateIso("")
                        }
                        setOpenCountry(false)
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          countryValue === country.name ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="mr-2">{country.emoji}</span>
                      {country.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* State Selector */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">State / Region</label>
        <Popover open={openState} onOpenChange={setOpenState}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={openState}
              className="w-full justify-between"
              disabled={!selectedCountryIso || disabled || isLoadingStates}
            >
              {stateValue
                ? stateValue
                : ((isLoadingStates && selectedCountryIso) ? "Loading..." : "Select state...")}
              {isLoadingStates ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0">
            <Command>
              <CommandInput placeholder="Search state..." />
              <CommandList>
                <CommandEmpty>No state found.</CommandEmpty>
                <CommandGroup>
                  {states.map((state) => (
                    <CommandItem
                      key={state.iso2 || state.name}
                      value={state.name}
                      onSelect={(currentValue) =>
                      {
                        const stateObj = states.find(s => s.name.toLowerCase() === currentValue.toLowerCase())
                        if (stateObj) {
                          console.log("State Selected:", stateObj.name, stateObj.iso2)
                          onStateChange(
                            stateObj.name,
                            stateObj.iso2,
                            stateObj.id,
                            stateObj.latitude ? parseFloat(stateObj.latitude) : undefined,
                            stateObj.longitude ? parseFloat(stateObj.longitude) : undefined
                          )
                          setSelectedStateIso(stateObj.iso2)
                          setCities([])
                        }
                        setOpenState(false)
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          stateValue === state.name ? "opacity-100" : "opacity-0"
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
      </div>

      {/* City Selector */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">City</label>
        <Popover open={openCity} onOpenChange={setOpenCity}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={openCity}
              className="w-full justify-between"
              disabled={!selectedCountryIso || disabled || isLoadingCities}
            >
              {cityValue
                ? cityValue
                : (isLoadingCities ? "Loading..." : "Select city...")}
              {isLoadingCities ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0">
            <Command>
              <CommandInput placeholder="Search city..." />
              <CommandList>
                <CommandEmpty>No city found.</CommandEmpty>
                <CommandGroup>
                  {cities?.map((city) => (
                    <CommandItem
                      key={`${city.name}-${city.latitude}-${city.longitude}`}
                      value={city.name}
                      onSelect={(currentValue) =>
                      {
                        const cityObj = cities.find(c => c.name.toLowerCase() === currentValue.toLowerCase())
                        if (cityObj) {
                          onCityChange(
                            cityObj.name,
                            cityObj.id,
                            cityObj.latitude ? parseFloat(cityObj.latitude) : undefined,
                            cityObj.longitude ? parseFloat(cityObj.longitude) : undefined
                          )
                        } else {
                          onCityChange(currentValue, undefined, undefined, undefined)
                        }
                        setOpenCity(false)
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          cityValue === city.name ? "opacity-100" : "opacity-0"
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
      </div>
    </div>
  )
}
