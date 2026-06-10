'use server'

import { createClient } from '@/lib/supabase/server'
import { getLocale } from 'next-intl/server'

// Define interfaces locally since we removed the library dependency
export interface ICountry {
  id: string
  name: string
  iso2: string
  emoji: string
  latitude: string
  longitude: string
}

export interface IState {
  id: string
  name: string
  iso2: string
  country_code: string
  latitude: string
  longitude: string
}

export interface ICity {
  id: string
  name: string
  country_code: string
  state_code: string
  latitude: string
  longitude: string
}

export async function getCountriesAction(): Promise<ICountry[]> {
  try {
    const supabase = await createClient()
    const locale = await getLocale()
    
    if (supabase) {
        const { data, error } = await supabase
          .from('countries')
          .select('*')
          .order('name')
          
        if (!error && data && data.length > 0) {
            return data.map(dbCountry => {
                let displayName = dbCountry.name
                if (locale !== 'en' && dbCountry.translations) {
                   const translations = dbCountry.translations as Record<string, string>
                   if (translations[locale]) {
                       displayName = translations[locale]
                   }
                }
                
                return {
                    id: dbCountry.id,
                    name: displayName,
                    iso2: dbCountry.iso2,
                    emoji: dbCountry.emoji || '',
                    latitude: dbCountry.latitude?.toString() || '',
                    longitude: dbCountry.longitude?.toString() || '',
                } as ICountry
            })
        }
    }

    return []
  } catch (error) {
    console.error("Server Action Error (getCountries):", error)
    return []
  }
}

export async function getStatesOfCountryAction(countryCode: string): Promise<IState[]> {
  if (!countryCode) return []

  try {
    const supabase = await createClient()
    const locale = await getLocale()

    if (supabase) {
        const { data, error } = await supabase
          .from('states')
          .select('*')
          .eq('country_iso2', countryCode)
          .order('name')
          
        if (!error && data && data.length > 0) {
            return data.map(state => {
                let displayName = state.name
                if (locale !== 'en' && state.translations) {
                   const translations = state.translations as Record<string, string>
                   if (translations[locale]) {
                       displayName = translations[locale]
                   }
                }
                
                return {
                    id: state.id,
                    name: displayName,
                    iso2: state.iso2,
                    country_code: state.country_iso2,
                    latitude: state.latitude?.toString() || '',
                    longitude: state.longitude?.toString() || ''
                } as IState
            })
        }
    }

    return []
  } catch (error) {
    console.error("Server Action Error (getStatesOfCountry):", error)
    return []
  }
}

export async function getCitiesOfStateAction(countryCode: string, stateCode: string): Promise<ICity[]> {
    if (!countryCode || !stateCode) return []

    try {
        const supabase = await createClient()
        const locale = await getLocale()

        if (supabase) {
            const { data, error } = await supabase
              .from('cities')
              .select('*')
              .eq('country_iso2', countryCode)
              .eq('state_iso2', stateCode)
              .order('name')
              
            if (!error && data && data.length > 0) {
                return data.map(city => {
                    let displayName = city.name
                    if (locale !== 'en' && city.translations) {
                       const translations = city.translations as Record<string, string>
                       if (translations[locale]) {
                           displayName = translations[locale]
                       }
                    }
                    return {
                        id: city.id,
                        name: displayName,
                        country_code: city.country_iso2,
                        state_code: city.state_iso2 || '',
                        latitude: city.latitude?.toString() || '',
                        longitude: city.longitude?.toString() || ''
                    } as unknown as ICity
                })
            }
        }
        
        return []
    } catch (error) {
        console.error("Server Action Error (getCitiesOfState):", error)
        return []
    }
}

export async function getAllCitiesOfCountryAction(countryCode: string): Promise<ICity[]> {
    if (!countryCode) return []

    try {
        const supabase = await createClient()
        const locale = await getLocale()

        if (supabase) {
            const { data, error } = await supabase
              .from('cities')
              .select('*')
              .eq('country_iso2', countryCode)
              .order('name')
              
            if (!error && data && data.length > 0) {
                return data.map(city => {
                    let displayName = city.name
                    if (locale !== 'en' && city.translations) {
                       const translations = city.translations as Record<string, string>
                       if (translations[locale]) {
                           displayName = translations[locale]
                       }
                    }
                    return {
                        id: city.id,
                        name: displayName,
                        country_code: city.country_iso2,
                        state_code: city.state_iso2 || '',
                        latitude: city.latitude?.toString() || '',
                        longitude: city.longitude?.toString() || ''
                    } as unknown as ICity
                })
            }
        }
        
        return []
    } catch (error) {
        console.error("Server Action Error (getAllCitiesOfCountry):", error)
        return []
    }
}
