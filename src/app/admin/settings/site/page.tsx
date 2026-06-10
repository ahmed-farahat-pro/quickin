import { Metadata } from 'next'
import { SiteSettingsTabs } from './_components/site-settings-tabs'
import { createClient } from '@/lib/supabase/server'
import { SiteSettings } from '@/types/site-settings'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Site Settings | Admin Dashboard',
  description: 'Manage homepage hero, navigation, global site settings, and custom pages.',
}

export default async function SiteSettingsPage() {
  const supabase = await createClient()
  
  if (!supabase) {
    return <div>Supabase not configured</div>
  }

  // Fetch Site Settings
  const { data: settings } = await supabase.from('site_settings').select('*').eq('id', 1).single()

  // Fetch Custom Pages
  const { data: pages } = await supabase.from('custom_pages').select('*').order('created_at', { ascending: false })

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Site Settings & Pages</h2>
      </div>
      <div className="h-full flex-1 flex-col space-y-8 flex">
        <SiteSettingsTabs 
          initialSettings={settings as SiteSettings} 
          initialPages={pages || []} 
        />
      </div>
    </div>
  )
}
