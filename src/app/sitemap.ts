import { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'
import { getBaseUrl } from '@/lib/utils'

// Simple supabase client for build-time or static sitemap generation.
// We use the anon key so we only ever read public data. In the no-credentials
// local environment these vars are absent, so we skip the client entirely
// (creating one with an empty URL throws "supabaseUrl is required").
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl()
  const currentDate = new Date()

  const sitemapEntries: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/explore`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/services`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/signup`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ]

  // Without Supabase credentials (local launch), return the static pages above.
  if (!supabase) {
    return sitemapEntries
  }

  try {
    // 1. Fetch public active listings
    const { data: listings } = await supabase
      .from('listings')
      .select('id, updated_at')
      .eq('status', 'active')

    if (listings) {
      listings.forEach((listing) => {
        sitemapEntries.push({
          url: `${baseUrl}/listings/${listing.id}`,
          lastModified: new Date(listing.updated_at || currentDate),
          changeFrequency: 'daily',
          priority: 0.9,
        })
      })
    }

    // 2. Fetch published custom pages
    const { data: customPages } = await supabase
      .from('custom_pages')
      .select('slug, updated_at')
      .eq('is_published', true)

    if (customPages) {
      customPages.forEach((page) => {
        sitemapEntries.push({
          url: `${baseUrl}/${page.slug}`,
          lastModified: new Date(page.updated_at || currentDate),
          changeFrequency: 'weekly',
          priority: 0.7,
        })
      })
    }
  } catch (error) {
    console.error('Error generating sitemap:', error)
  }

  return sitemapEntries
}
