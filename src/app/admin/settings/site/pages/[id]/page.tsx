import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { PageEditor } from './_components/page-editor'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Edit Custom Page | Admin Dashboard',
  description: 'Create or edit a custom page for the site.',
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function CustomPageEditorPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  if (!supabase) {
    return <div>Supabase not configured</div>
  }

  let pageData = null

  if (id !== 'new') {
    const { data, error } = await supabase
      .from('custom_pages')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      notFound()
    }
    pageData = data
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">
          {id === 'new' ? 'Create Custom Page' : 'Edit Custom Page'}
        </h2>
      </div>
      <PageEditor initialData={pageData} />
    </div>
  )
}
