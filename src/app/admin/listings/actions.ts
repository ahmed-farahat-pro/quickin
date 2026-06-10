'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function adminCreateListing(data: any) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Not authenticated' }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const {
    lifestyle_category_ids,
    listing_conditions,
    images,
    title_ar,
    description_ar,
    latitude,
    longitude,
    ...listingData
  } = data

  if (!listingData.user_id) listingData.user_id = user.id

  const { data: newListing, error } = await supabase
    .from('listings')
    .insert([{
      ...listingData,
      location_geo: `POINT(${longitude} ${latitude})`,
      translations: { ar: { title: title_ar, description: description_ar } },
    }])
    .select()
    .single()

  if (error) {
    console.error('Error creating listing:', error)
    return { error: error.message }
  }

  // Insert Images
  if (images && images.length > 0) {
    const imageInserts = images.map((img: any, index: number) => ({
      listing_id: newListing.id,
      url: img.url,
      category: img.category || 'other',
      order: index
    }))
    await supabase.from('listing_images').insert(imageInserts)
  }

  // Insert Lifestyles
  if (lifestyle_category_ids && lifestyle_category_ids.length > 0) {
    const lsInserts = lifestyle_category_ids.map((id: string, idx: number) => ({
      listing_id: newListing.id,
      lifestyle_category_id: id,
      is_primary: idx === 0
    }))
    await supabase.from('listing_lifestyles').insert(lsInserts)
  }

  // Insert Conditions
  if (listing_conditions && listing_conditions.length > 0) {
    for (const cond of listing_conditions) {
      let finalConditionId = cond
      if (cond.startsWith('new:')) {
        const name = cond.replace('new:', '')
        const { data: newCond } = await supabase
          .from('listing_conditions')
          .insert({ name, created_by: user.id, is_system: false })
          .select()
          .single()
        if (newCond) finalConditionId = newCond.id
      }
      await supabase.from('listing_condition_assignments').insert({
        listing_id: newListing.id,
        condition_id: finalConditionId
      })
    }
  }

  // Audit Log
  await supabase.rpc('create_audit_log', {
    p_action: 'listing.create',
    p_entity_type: 'listing',
    p_entity_id: newListing.id,
    p_entity_name: newListing.title,
    p_new_data: newListing,
    p_notes: 'Created via admin panel'
  })

  revalidatePath('/admin/listings')
  return { success: true, listing: newListing }
}

export async function adminUpdateListing(id: string, data: any) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Not authenticated' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: oldListing } = await supabase
    .from('listings')
    .select('*')
    .eq('id', id)
    .single()

  const {
    lifestyle_category_ids,
    listing_conditions,
    images,
    title_ar,
    description_ar,
    latitude,
    longitude,
    ...listingData
  } = data

  const { data: updatedListing, error } = await supabase
    .from('listings')
    .update({
      ...listingData,
      location_geo: `POINT(${longitude} ${latitude})`,
      translations: { ar: { title: title_ar, description: description_ar } },
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating listing:', error)
    return { error: error.message }
  }

  // Update Images
  await supabase.from('listing_images').delete().eq('listing_id', id)
  if (images && images.length > 0) {
    const imageInserts = images.map((img: any, index: number) => ({
      listing_id: id,
      url: img.url,
      category: img.category || 'other',
      order: index
    }))
    await supabase.from('listing_images').insert(imageInserts)
  }

  // Update Lifestyles
  await supabase.from('listing_lifestyles').delete().eq('listing_id', id)
  if (lifestyle_category_ids && lifestyle_category_ids.length > 0) {
    const lsInserts = lifestyle_category_ids.map((cid: string, idx: number) => ({
      listing_id: id,
      lifestyle_category_id: cid,
      is_primary: idx === 0
    }))
    await supabase.from('listing_lifestyles').insert(lsInserts)
  }

  // Update Conditions
  await supabase.from('listing_condition_assignments').delete().eq('listing_id', id)
  if (listing_conditions && listing_conditions.length > 0) {
    for (const cond of listing_conditions) {
      let finalConditionId = cond
      if (cond.startsWith('new:')) {
        const name = cond.replace('new:', '')
        const { data: newCond } = await supabase
          .from('listing_conditions')
          .insert({ name, created_by: user.id, is_system: false })
          .select()
          .single()
        if (newCond) finalConditionId = newCond.id
      }
      await supabase.from('listing_condition_assignments').insert({
        listing_id: id,
        condition_id: finalConditionId
      })
    }
  }

  // Audit Log
  await supabase.rpc('create_audit_log', {
    p_action: 'listing.update',
    p_entity_type: 'listing',
    p_entity_id: id,
    p_entity_name: updatedListing.title,
    p_old_data: oldListing,
    p_new_data: updatedListing,
    p_notes: 'Updated via admin panel'
  })

  revalidatePath('/admin/listings')
  revalidatePath(`/admin/listings/${id}/edit`)
  return { success: true, listing: updatedListing }
}

export async function reviewListing(id: string, action: 'approve' | 'reject', notes?: string) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Not authenticated' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Check if staff/admin
  const { data: staffProfile } = await supabase
    .from('staff_profiles')
    .select('id, role')
    .eq('id', user.id)
    .eq('is_active', true)
    .single()

  if (!staffProfile) {
    return { error: 'Not authorized. Staff access required.' }
  }

  const { data: listing } = await supabase
    .from('listings')
    .select('id, title, user_id, is_published')
    .eq('id', id)
    .single()

  if (!listing) return { error: 'Listing not found' }

  const updateData: any = {
    review_status: action === 'approve' ? 'approved' : 'rejected',
    review_notes: notes || null
  }

  if (action === 'approve') {
    updateData.is_published = true
  }

  const { error: updateError } = await supabase
    .from('listings')
    .update(updateData)
    .eq('id', id)

  if (updateError) {
    console.error('Error updating listing review status:', updateError)
    return { error: updateError.message }
  }

  // Audit Log
  await supabase.from('audit_logs').insert({
    actor_id: user.id,
    actor_type: staffProfile.role === 'admin' ? 'admin' : 'staff',
    action: `listing.review_${action}`,
    action_category: 'content',
    entity_type: 'listing',
    entity_id: id,
    entity_name: listing.title,
    old_data: { is_published: listing.is_published },
    new_data: updateData,
    notes: notes || `Listing ${action}d`
  })

  // Notify the host
  const subject = action === 'approve' 
    ? 'Your Listing Has Been Approved' 
    : 'Your Listing Requires Changes'
  
  const messageBody = action === 'approve'
    ? `Good news! Your listing "${listing.title}" has been reviewed and published. It is now visible to guests.`
    : `Your listing "${listing.title}" requires some changes before it can be published.\n\n${notes ? `Reviewer Notes: ${notes}\n\n` : ''}Please make the necessary updates and resubmit.`

  await supabase.from('admin_messages').insert({
    user_id: listing.user_id,
    category: action === 'approve' ? 'approval' : 'notice',
    subject,
    body: messageBody,
    related_entity_type: 'listing',
    related_entity_id: id,
    sent_by: staffProfile.id,
  })

  revalidatePath('/admin/listings')
  revalidatePath(`/admin/listings/${id}/edit`)
  return { success: true }
}

export async function deleteListing(id: string) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Not authenticated' }

  // Check permissions (staff only)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Get listing details for audit log before deleting
  const { data: listing } = await supabase
    .from('listings')
    .select('*')
    .eq('id', id)
    .single()
  
  const { error } = await supabase
    .from('listings')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting listing:', error)
    return { error: error.message }
  }

  // Audit log
  if (listing) {
    await supabase.rpc('create_audit_log', {
      p_action: 'listing.delete',
      p_entity_type: 'listing',
      p_entity_id: id,
      p_entity_name: listing.title,
      p_old_data: listing,
      p_notes: 'Deleted via admin panel'
    })
  }

  revalidatePath('/admin/listings')
  return { success: true }
}
