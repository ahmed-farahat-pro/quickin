import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { notifyNewChatMessage } from '@/lib/actions/notifications'

export interface BookingMessage {
  id: string
  booking_id: string
  sender_id: string
  message: string
  created_at: string
}

export function useBookingChat(bookingId: string) {
  const [messages, setMessages] = useState<BookingMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [bookingDetails, setBookingDetails] = useState<{ guest_id: string, host_id: string } | null>(null)
  const supabase = createClient()

  useEffect(() => {
    let isMounted = true

    const fetchUserAndMessages = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        
        if (isMounted) {
          setCurrentUserId(session.user.id)
        }

        // Fetch booking details to identify roles
        const { data: bookingData } = await supabase
          .from('bookings')
          .select('user_id, listing:listings(user_id)')
          .eq('id', bookingId)
          .single()

        if (isMounted && bookingData) {
          const listingData = Array.isArray(bookingData.listing) ? bookingData.listing[0] : bookingData.listing;
          setBookingDetails({
            guest_id: bookingData.user_id,
            host_id: listingData?.user_id || ''
          })
        }

        const { data, error } = await supabase
          .from('booking_messages')
          .select('*')
          .eq('booking_id', bookingId)
          .order('created_at', { ascending: true })

        if (error) throw error

        if (isMounted && data) {
          setMessages(data)
        }
      } catch (err: any) {
        console.error('Error fetching messages:', err)
        toast.error('Failed to load chat history')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    fetchUserAndMessages()

    const channel = supabase
      .channel(`chat_${bookingId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'booking_messages',
          filter: `booking_id=eq.${bookingId}`,
        },
        (payload) => {
          if (isMounted) {
            setMessages((prev) => [...prev, payload.new as BookingMessage])
          }
        }
      )
      .subscribe()

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
    }
  }, [bookingId, supabase])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || !currentUserId) return false

    try {
      const { error } = await supabase
        .from('booking_messages')
        .insert([
          {
            booking_id: bookingId,
            sender_id: currentUserId,
            message: text.trim(),
          }
        ])

      if (error) throw error

      // Trigger server action to send FCM push notification in the background
      notifyNewChatMessage(bookingId, currentUserId, text.trim()).catch((err) => {
        console.error('Failed to send push notification:', err)
      })

      return true
    } catch (err: any) {
      console.error('Error sending message:', err)
      toast.error('Failed to send message')
      return false
    }
  }, [bookingId, currentUserId, supabase])

  return {
    messages,
    isLoading,
    currentUserId,
    bookingDetails,
    sendMessage,
  }
}
