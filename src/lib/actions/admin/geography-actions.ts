'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getCountries,
} from "@countrystatecity/countries"
import { getStatesOfCountryAction, getCitiesOfStateAction } from "../location-actions"
import { geminiModel } from '@/lib/gemini/client'

// Utility to chunk arrays into smaller batches
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunked: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunked.push(array.slice(i, i + size));
  }
  return chunked;
}

// Prompt Gemini to translate an array of English names to Arabic
async function translateGeoNamesArabic(names: string[]): Promise<Record<string, string>> {
  if (names.length === 0) return {}

  try {
    const prompt = `
Translate the following geographical names from English to Arabic.
Return strictly valid JSON where the key is the English name and the value is the Arabic translation.
Do not include any other text, markdown formatting like \`\`\`json, or explanations. Just the raw JSON object.

Names to translate:
${JSON.stringify(names)}
    `
    const result = await geminiModel.generateContent(prompt);
    const text = result.response.text();
    
    // Clean up potential markdown formatting from Gemini
    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    try {
        const parsed = JSON.parse(cleanedText) as Record<string, string>;
        return parsed;
    } catch (parseError) {
        console.error("Failed to parse Gemini JSON:", cleanedText);
        return {};
    }
  } catch (error) {
    console.error("Gemini Translation Error:", error);
    return {};
  }
}

export async function getLibraryCountriesAction() {
    try {
        const countries = await getCountries()
        return countries || []
    } catch (error) {
        console.error("Failed to load countries from library:", error)
        return []
    }
}

export async function importCountryDataAction(rawCountryIso2: string) {
    try {
        const countryIso2 = typeof rawCountryIso2 === 'string' ? rawCountryIso2.trim().toUpperCase() : ''
        const supabase = createAdminClient()
        if (!supabase) throw new Error("Database connection failed")

        console.log("Attempting to import country with code:", JSON.stringify(countryIso2))
        const allCountries = await getCountries()
        const countryData = allCountries.find(c => c.iso2 === countryIso2)
        console.log("countryData returned:", countryData ? countryData.name : undefined)
        if (!countryData) throw new Error("Country not found in library")

        // 1. Translate Country
        let countryTranslations: Record<string, string> = {}
        const translatedCountryMap = await translateGeoNamesArabic([countryData.name])
        if (translatedCountryMap[countryData.name]) {
             countryTranslations = { ar: translatedCountryMap[countryData.name] }
        }

        // Insert Country
        const { error: countryErr } = await supabase.from('countries').upsert({
            iso2: (countryData as any).iso2,
            name: countryData.name,
            emoji: (countryData as any).emoji || '',
            latitude: countryData.latitude ? parseFloat(countryData.latitude) : null,
            longitude: countryData.longitude ? parseFloat(countryData.longitude) : null,
            translations: countryTranslations,
            is_active: true
        }, { onConflict: 'iso2' })

        if (countryErr) throw new Error(`Failed to insert country: ${countryErr.message}`)

        // 2. Fetch States
        const states = await getStatesOfCountryAction(countryIso2) || []
        console.log(`Found ${states.length} states for ${countryIso2}`)
        
        if (states.length > 0) {
            // Translate States in batches (e.g. 30 at a time)
            const stateNames = states.map(s => s.name)
            const stateChunks = chunkArray(stateNames, 30)
            
            let allStateTranslations: Record<string, string> = {}
            for (const chunk of stateChunks) {
                const map = await translateGeoNamesArabic(chunk)
                allStateTranslations = { ...allStateTranslations, ...map }
                // Small sleep to avoid rate limits
                await new Promise(r => setTimeout(r, 1000))
            }

            // Insert States
            const statesToInsert = states.map((s: any) => ({
                country_iso2: s.countryCode || s.country_code || countryIso2,
                iso2: s.isoCode || s.iso2,
                name: s.name,
                latitude: s.latitude ? parseFloat(s.latitude) : null,
                longitude: s.longitude ? parseFloat(s.longitude) : null,
                translations: allStateTranslations[s.name] ? { ar: allStateTranslations[s.name] } as any : {}
            }))

            const { error: stateErr } = await supabase.from('states').upsert(
                statesToInsert, 
                { onConflict: 'country_iso2, iso2' }
            )
            if (stateErr) console.error(`Error inserting states: ${stateErr.message}`)

            // 3. Fetch Cities
            let totalCitiesInserted = 0;
            for (const state of states) {
                const stateIso = (state as any).isoCode || (state as any).iso2
                const cities = await getCitiesOfStateAction(countryIso2, stateIso) || []
                if (cities.length === 0) continue

                // Translate Cities in batches (e.g. 50 at a time)
                const cityNames = Array.from(new Set(cities.map(c => c.name))) // Unique names
                const cityChunks = chunkArray(cityNames, 50)
                
                let allCityTranslations: Record<string, string> = {}
                for (const chunk of cityChunks) {
                    const map = await translateGeoNamesArabic(chunk)
                    allCityTranslations = { ...allCityTranslations, ...map }
                    await new Promise(r => setTimeout(r, 1000))
                }

                // Insert Cities
                const citiesToInsert = cities.map((c: any) => ({
                    country_iso2: c.countryCode || c.country_code || countryIso2,
                    state_iso2: c.stateCode || c.state_code,
                    name: c.name,
                    latitude: c.latitude ? parseFloat(c.latitude) : null,
                    longitude: c.longitude ? parseFloat(c.longitude) : null,
                    translations: allCityTranslations[c.name] ? { ar: allCityTranslations[c.name] } as any : {},
                    is_custom: false
                }))

                // Batch insert cities in chunks of 500 to avoid request size limits
                const dbCityChunks = chunkArray(citiesToInsert, 500)
                for (const chunk of dbCityChunks) {
                    const { error: cityErr } = await supabase.from('cities').insert(chunk)
                    if (cityErr) {
                         console.error(`Error inserting cities chunk: ${cityErr.message}`)
                    } else {
                         totalCitiesInserted += chunk.length
                    }
                }
            }
            console.log(`Inserted ${totalCitiesInserted} cities for ${countryIso2}`)
        }

        return { success: true, message: `Successfully imported data for ${countryData.name}` }
    } catch (error: any) {
        console.error("Import Data Action Error:", error)
        return { success: false, error: error.message || "Failed to import country data" }
    }
}

export async function addGeographyAction(
    type: 'country' | 'state' | 'city',
    data: {
        name: string;
        iso2?: string;
        country_iso2?: string;
        state_iso2?: string;
        latitude?: number;
        longitude?: number;
        emoji?: string;
        translations?: Record<string, string>;
    }
) {
    try {
        const supabase = createAdminClient()
        if (!supabase) throw new Error("Database connection failed")

        const table = type === 'country' ? 'countries' : type === 'state' ? 'states' : 'cities'

        let insertData: any = {
            name: data.name,
            translations: data.translations || {},
        }

        if (data.latitude) insertData.latitude = data.latitude
        if (data.longitude) insertData.longitude = data.longitude

        if (type === 'country') {
            if (!data.iso2) throw new Error("Country ISO2 is required")
            insertData.iso2 = data.iso2.toUpperCase()
            insertData.emoji = data.emoji || ''
            insertData.is_active = true
        } else if (type === 'state') {
            if (!data.country_iso2 || !data.iso2) throw new Error("Country ISO2 and State ISO2 are required")
            insertData.country_iso2 = data.country_iso2.toUpperCase()
            insertData.iso2 = data.iso2.toUpperCase()
        } else if (type === 'city') {
            if (!data.country_iso2) throw new Error("Country ISO2 is required")
            insertData.country_iso2 = data.country_iso2.toUpperCase()
            insertData.state_iso2 = data.state_iso2 ? data.state_iso2.toUpperCase() : null
            insertData.is_custom = true
        }

        const { data: result, error } = await supabase.from(table).insert(insertData).select().single()

        if (error) throw new Error(`Failed to create ${type}: ${error.message}`)

        return { success: true, data: result }
    } catch (error: any) {
        console.error(`Add Geography Action Error (${type}):`, error)
        return { success: false, error: error.message || "Failed to create location" }
    }
}
