'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function updateGeographyTranslationAction(
    table: 'countries' | 'states' | 'cities',
    id: number,
    locale: string,
    translation: string
) {
    try {
        const supabase = createAdminClient()
        if (!supabase) throw new Error("Database connection failed")

        // 1. Fetch current translations
        const { data, error } = await supabase
            .from(table)
            .select('translations')
            .eq('id', id)
            .single()

        if (error) throw new Error(`Failed to fetch current translations: ${error.message}`)

        const currentTranslations = (data?.translations as Record<string, string>) || {}
        
        // 2. Update the specific locale
        const updatedTranslations = {
            ...currentTranslations,
            [locale]: translation.trim()
        }

        // If translation is empty, remove the key
        if (!translation.trim()) {
            delete updatedTranslations[locale]
        }

        // 3. Save back to the database
        const { error: updateError } = await supabase
            .from(table)
            .update({ translations: updatedTranslations })
            .eq('id', id)

        if (updateError) throw new Error(`Failed to update translation: ${updateError.message}`)

        revalidatePath('/admin/locations')
        revalidatePath('/[locale]/admin/locations')

        return { success: true }
    } catch (error: any) {
        console.error("updateGeographyTranslationAction Error:", error)
        return { success: false, error: error.message || "Failed to update translation" }
    }
}
