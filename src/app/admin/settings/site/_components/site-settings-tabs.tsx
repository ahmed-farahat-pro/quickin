'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SiteSettingsForm } from './site-settings-form'
import { PagesManager } from './pages-manager'
import { BannersManager } from './banners-manager'
import { SiteSettings } from '@/types/site-settings'
import { Database } from '@/types/supabase'

type CustomPage = Database['public']['Tables']['custom_pages']['Row']

interface SiteSettingsTabsProps {
  initialSettings: SiteSettings
  initialPages: CustomPage[]
}

export function SiteSettingsTabs({ initialSettings, initialPages }: SiteSettingsTabsProps) {
  return (
    <Tabs defaultValue="general" className="w-full">
      <TabsList className="grid w-full grid-cols-3 lg:w-[600px]">
        <TabsTrigger value="general">General Settings</TabsTrigger>
        <TabsTrigger value="banners">Banners</TabsTrigger>
        <TabsTrigger value="pages">Custom Pages</TabsTrigger>
      </TabsList>
      
      <TabsContent value="general" className="mt-6">
        <SiteSettingsForm initialData={initialSettings} pages={initialPages} />
      </TabsContent>
      
      <TabsContent value="banners" className="mt-6">
        <BannersManager initialData={initialSettings.banners_config || []} />
      </TabsContent>

      <TabsContent value="pages" className="mt-6">
        <PagesManager initialPages={initialPages} />
      </TabsContent>
    </Tabs>
  )
}
