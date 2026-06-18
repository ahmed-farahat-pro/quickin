import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { UserDetailClient } from './user-detail-client'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

async function getUserData(userId: string) {
  const supabase = await createClient()
  if (!supabase) return null

  // Get user profile
  const { data: user, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, is_host, phone, bio, created_at')
    .eq('id', userId)
    .single()

  if (error || !user) return null

  // Get listings count
  const { count: listingsCount } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  // Get bookings count
  const { count: bookingsCount } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  // Get user listings
  const { data: listings } = await supabase
    .from('listings')
    .select('id, title, is_published, price_per_night, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)

  // Get warnings
  let warnings: any[] = []
  try {
    const { data } = await supabase
      .from('user_warnings')
      .select(`
        id,
        warning_level,
        reason,
        created_at,
        is_active,
        staff_id
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    // Get staff names for warnings
    if (data && data.length > 0) {
      const staffIds = [...new Set(data.map(w => w.staff_id))]
      const { data: staffData } = await supabase
        .from('staff_profiles')
        .select('id, full_name')
        .in('id', staffIds)
      
      const staffMap: Record<string, string> = {}
      staffData?.forEach(s => {
        staffMap[s.id] = s.full_name
      })
      
      warnings = data.map(w => ({
        ...w,
        staff_name: staffMap[w.staff_id] || null
      }))
    }
  } catch {
    // Table might not exist
  }

  // Get bans
  let bans: any[] = []
  try {
    const { data } = await supabase
      .from('user_bans')
      .select(`
        id,
        ban_type,
        reason,
        created_at,
        expires_at,
        unbanned_at,
        is_active,
        banned_by
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    if (data && data.length > 0) {
      const staffIds = [...new Set(data.map(b => b.banned_by))]
      const { data: staffData } = await supabase
        .from('staff_profiles')
        .select('id, full_name')
        .in('id', staffIds)
      
      const staffMap: Record<string, string> = {}
      staffData?.forEach(s => {
        staffMap[s.id] = s.full_name
      })
      
      bans = data.map(b => ({
        ...b,
        staff_name: staffMap[b.banned_by] || null
      }))
    }
  } catch {
    // Table might not exist
  }

  // Get admin messages
  let messages: any[] = []
  try {
    const { data } = await supabase
      .from('admin_messages')
      .select(`
        id,
        subject,
        message,
        category,
        created_at,
        is_read,
        staff_id
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    if (data && data.length > 0) {
      const staffIds = [...new Set(data.map(m => m.staff_id))]
      const { data: staffData } = await supabase
        .from('staff_profiles')
        .select('id, full_name')
        .in('id', staffIds)
      
      const staffMap: Record<string, string> = {}
      staffData?.forEach(s => {
        staffMap[s.id] = s.full_name
      })
      
      messages = data.map(m => ({
        ...m,
        staff_name: staffMap[m.staff_id] || null
      }))
    }
  } catch {
    // Table might not exist
  }

  return {
    user: {
      ...user,
      listings_count: listingsCount || 0,
      bookings_count: bookingsCount || 0,
    },
    warnings,
    bans,
    messages,
    listings: listings || [],
  }
}

export default async function UserDetailPage({ params }: PageProps) {
  const { id } = await params
  const data = await getUserData(id)

  if (!data) {
    notFound()
  }

  return <UserDetailClient {...data} />
}
