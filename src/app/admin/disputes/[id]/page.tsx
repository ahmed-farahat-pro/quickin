import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { DisputeDetailClient } from './dispute-detail-client'

interface PageProps {
  params: Promise<{ id: string }>
}

async function getDisputeData(disputeId: string) {
  const supabase = await createClient()
  if (!supabase) return null

  // Get dispute with parties
  const { data: dispute, error } = await supabase
    .from('disputes')
    .select(`
      *,
      guest:profiles!disputes_guest_id_fkey(id, full_name, email),
      host:profiles!disputes_host_id_fkey(id, full_name, email)
    `)
    .eq('id', disputeId)
    .single()

  if (error || !dispute) return null

  // Get dispute messages
  let messages: any[] = []
  try {
    const { data } = await supabase
      .from('dispute_messages')
      .select('*')
      .eq('dispute_id', disputeId)
      .order('created_at', { ascending: true })
    
    messages = data || []
  } catch {
    // Table might not exist
  }

  return { dispute, messages }
}

export default async function DisputeDetailPage({ params }: PageProps) {
  const { id } = await params
  const data = await getDisputeData(id)

  if (!data) {
    notFound()
  }

  return <DisputeDetailClient dispute={data.dispute} messages={data.messages} />
}
