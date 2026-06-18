import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
import { getLocale } from 'next-intl/server'
import { Card, CardContent } from '@/components/ui/card'
import { DynamicPageRenderer } from '@/components/features/cms/dynamic-page-renderer'

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const locale = await getLocale()

  if (!supabase) return { title: 'QuickIn' }

  const { data: page } = await supabase
    .from('custom_pages')
    .select('title')
    .eq('slug', slug)
    .eq('is_published', true)
    .single()

  if (!page) {
    return {
      title: 'Page Not Found',
    }
  }

  const titleObj = page.title as any
  const title = (titleObj[locale] || titleObj.en || titleObj.ar || 'Page') + ' | QuickIn'

  return {
    title,
    openGraph: {
      title,
    },
    twitter: {
      card: 'summary_large_image',
      title,
    },
  }
}

export default async function CustomPage({ params }: PageProps) {
  const { slug } = await params
  const supabase = await createClient()
  const locale = await getLocale() as 'en' | 'ar'

  if (!supabase) notFound()

  const { data: page } = await supabase
    .from('custom_pages')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .single()

  if (!page) {
    notFound()
  }

  const titleObj = page.title as any
  const title = titleObj[locale] || titleObj.en || titleObj.ar

  return (
    <div className="container mx-auto py-12 px-4 max-w-4xl">
      <Card className="border-none shadow-none bg-transparent">
        <CardContent className="p-0">
          <h1 className="text-4xl font-bold mb-8">{title}</h1>
          <DynamicPageRenderer content={page.content as any[]} language={locale} />
        </CardContent>
      </Card>
    </div>
  )
}
