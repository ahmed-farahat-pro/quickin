'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createTicket(subject: string, message: string) {
  const supabase = await createClient()
  if (!supabase) throw new Error('Database client not available.')
  
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('You must be logged in to create a support ticket.')
  }

  const { data: ticket, error: ticketError } = await supabase
    .from('support_tickets')
    .insert({
      user_id: user.id,
      subject,
      status: 'open'
    })
    .select()
    .single()

  if (ticketError) throw new Error(ticketError.message)

  const { error: messageError } = await supabase
    .from('support_messages')
    .insert({
      ticket_id: ticket.id,
      sender_id: user.id,
      message
    })

  if (messageError) throw new Error(messageError.message)

  revalidatePath('/help')
  return ticket
}

export async function addMessageToTicket(ticketId: string, message: string) {
  const supabase = await createClient()
  if (!supabase) throw new Error('Database client not available.')
  
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('You must be logged in to reply to a support ticket.')
  }

  const { error } = await supabase
    .from('support_messages')
    .insert({
      ticket_id: ticketId,
      sender_id: user.id,
      message
    })

  if (error) throw new Error(error.message)

  revalidatePath('/help')
}

export async function getUserTickets() {
  const supabase = await createClient()
  if (!supabase) return null
  
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: tickets, error } = await supabase
    .from('support_tickets')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) throw new Error(error.message)
  return tickets
}

export async function getTicketMessages(ticketId: string) {
  const supabase = await createClient()
  if (!supabase) return null
  
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: messages, error } = await supabase
    .from('support_messages')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return messages
}
