import { Suspense } from "react";
import { Navbar, Footer, BannersStack } from "@/components/layout";
import { ChatWidget } from "@/components/features/ai";
import { AuthModal } from "@/components/features/auth";
import { getAttributes, getDestinations } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "next-intl/server";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale()
  const attributes = await getAttributes()
  const destinations = await getDestinations(locale)
  
  const supabase = await createClient()
  const { data: siteSettings } = await supabase?.from('site_settings').select('navbar_config, footer_config, banners_config').eq('id', 1).single() || { data: null }

  return (
    <>
      <Navbar 
        attributes={attributes} 
        destinations={destinations}
        config={siteSettings?.navbar_config} 
      />
      <Suspense fallback={null}>
        <BannersStack banners={siteSettings?.banners_config || []} />
      </Suspense>
      <main className="flex-1">
        {children}
      </main>
      <Footer config={siteSettings?.footer_config} />
      <ChatWidget />
      <AuthModal />
    </>
  );
}
