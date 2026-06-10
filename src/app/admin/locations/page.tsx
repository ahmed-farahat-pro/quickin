import { GeographyImport } from '@/components/admin/locations/geography-import'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import
{
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import
{
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import { getLocale } from 'next-intl/server'
import { EditableTranslation } from '@/components/admin/locations/editable-translation'
import { AddGeographyDialog } from '@/components/admin/locations/add-geography-dialog'

export const metadata = {
    title: 'Locations Management | Admin',
    description: 'Manage countries, states, and cities extensions for local overrides',
}

export default async function LocationsPage()
{
    const supabase = await createClient()
    const locale = await getLocale()

    // Fetch countries, states, and cities
    const { data: countries } = supabase
        ? await supabase.from('countries').select('*').order('name')
        : { data: [] }

    const { data: states } = supabase
        ? await supabase.from('states').select('*').order('name')
        : { data: [] }

    const { data: cities } = supabase
        ? await supabase.from('cities').select('*').limit(10000).order('name')
        : { data: [] }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Locations</h1>
                    <p className="text-muted-foreground">
                        Manage your localized geography extensions and extract real-world geography dynamically.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <AddGeographyDialog type="country" />
                    <GeographyImport />
                </div>
            </div>

            {!countries || countries.length === 0 ? (
                <div className="rounded-md border p-8 flex flex-col items-center justify-center text-center bg-muted/40 text-muted-foreground">
                    <h3 className="text-lg font-medium text-foreground mb-2">No Locations Imported Yet</h3>
                    <p className="max-w-md mx-auto mb-6">
                        Use the "Import Locations" button at the top to extract country, state, and city data from our global library into your database with automatic AI translations.
                    </p>
                </div>
            ) : (
                <div className="grid gap-6">
                    {countries.map((country: any) =>
                    {
                        const countryStates = states?.filter(s => s.country_iso2 === country.iso2) || []
                        const countryTranslations = country.translations as Record<string, string> || {}
                        const cName = (locale !== 'en' && countryTranslations[locale]) ? countryTranslations[locale] : country.name

                        // Default extra locale (opposite of current)
                        const editTargetLocale = locale === 'en' ? 'ar' : 'en'

                        return (
                            <Card key={country.id}>
                                <CardHeader className="pb-3 border-b">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="space-y-1">
                                            <CardTitle className="text-xl flex items-center gap-2">
                                                <span>{country.emoji}</span> {cName}
                                                <Badge variant={country.is_active ? "default" : "secondary"}>
                                                    {country.is_active ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </CardTitle>
                                            <CardDescription>
                                                ISO: {country.iso2} • {countryStates.length} Regions/States
                                            </CardDescription>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <AddGeographyDialog type="state" countryIso2={country.iso2} />
                                            <span className="text-sm font-medium text-muted-foreground ml-4">Translations:</span>
                                            <EditableTranslation
                                                table="countries"
                                                id={country.id}
                                                locale={editTargetLocale}
                                                initialValue={countryTranslations[editTargetLocale]}
                                            />
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-4 p-0 md:p-6">
                                    {countryStates.length > 0 ? (
                                        <Accordion type="single" collapsible className="w-full border rounded-md">
                                            {countryStates.map((state: any) =>
                                            {
                                                const stateTranslations = state.translations as Record<string, string> || {}
                                                const sName = (locale !== 'en' && stateTranslations[locale]) ? stateTranslations[locale] : state.name
                                                const stateCities = cities?.filter(c => c.state_iso2 === state.iso2 && c.country_iso2 === state.country_iso2) || []

                                                return (
                                                    <AccordionItem key={state.id} value={state.id.toString()}>
                                                        <div className="flex flex-1 items-center justify-between pr-4 group hover:bg-muted/30 transition-colors border-b">
                                                            <AccordionTrigger className="hover:no-underline py-3 px-4 flex-1 justify-start gap-4 border-b-0 border-transparent">
                                                                <span className="font-medium text-base">{sName}</span>
                                                                <Badge variant="secondary" className="font-mono text-xs">{state.iso2}</Badge>
                                                            </AccordionTrigger>
                                                            <div className="flex items-center gap-2">
                                                                <AddGeographyDialog type="city" countryIso2={state.country_iso2} stateIso2={state.iso2} />
                                                                <EditableTranslation
                                                                    table="states"
                                                                    id={state.id}
                                                                    locale={editTargetLocale}
                                                                    initialValue={stateTranslations[editTargetLocale]}
                                                                />
                                                                <Badge variant="outline" className="font-normal whitespace-nowrap">
                                                                    {stateCities.length} Cities
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                        <AccordionContent className="p-0 bg-muted/10">
                                                            {stateCities.length > 0 ? (
                                                                <div className="max-h-[400px] overflow-auto">
                                                                    <Table>
                                                                        <TableHeader className="sticky top-0 bg-background/95 backdrop-blur z-10 shadow-sm">
                                                                            <TableRow>
                                                                                <TableHead className="w-1/3 pl-6">City Name</TableHead>
                                                                                <TableHead className="w-[100px]">Type</TableHead>
                                                                                <TableHead>Coordinates</TableHead>
                                                                                <TableHead className="text-right pr-6">Translations ({editTargetLocale})</TableHead>
                                                                            </TableRow>
                                                                        </TableHeader>
                                                                        <TableBody>
                                                                            {stateCities.map((city: any) =>
                                                                            {
                                                                                const cityTranslations = city.translations as Record<string, string> || {}
                                                                                const cityName = (locale !== 'en' && cityTranslations[locale]) ? cityTranslations[locale] : city.name

                                                                                return (
                                                                                    <TableRow key={city.id}>
                                                                                        <TableCell className="font-medium pl-6">{cityName}</TableCell>
                                                                                        <TableCell>
                                                                                            <Badge variant={city.is_custom ? "secondary" : "outline"} className="text-[10px] uppercase">
                                                                                                {city.is_custom ? 'Custom' : 'System'}
                                                                                            </Badge>
                                                                                        </TableCell>
                                                                                        <TableCell className="text-xs text-muted-foreground font-mono">
                                                                                            {city.latitude && city.longitude
                                                                                                ? `${city.latitude.toFixed(4)}, ${city.longitude.toFixed(4)}`
                                                                                                : 'N/A'
                                                                                            }
                                                                                        </TableCell>
                                                                                        <TableCell className="text-right pr-6">
                                                                                            <div className="flex justify-end pr-2">
                                                                                                <EditableTranslation
                                                                                                    table="cities"
                                                                                                    id={city.id}
                                                                                                    locale={editTargetLocale}
                                                                                                    initialValue={cityTranslations[editTargetLocale]}
                                                                                                />
                                                                                            </div>
                                                                                        </TableCell>
                                                                                    </TableRow>
                                                                                )
                                                                            })}
                                                                        </TableBody>
                                                                    </Table>
                                                                </div>
                                                            ) : (
                                                                <div className="text-center p-6 border-y border-dashed bg-muted/20">
                                                                    <p className="text-sm text-muted-foreground">No cities registered under this region.</p>
                                                                </div>
                                                            )}
                                                        </AccordionContent>
                                                    </AccordionItem>
                                                )
                                            })}
                                        </Accordion>
                                    ) : (
                                        <p className="text-sm text-muted-foreground p-4 text-center">No regions found for this country.</p>
                                    )}
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
