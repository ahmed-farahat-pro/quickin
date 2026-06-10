import { createClient } from './client'

export interface UserNotification {
    id: string
    user_id: string
    type: string
    title: string
    message: string
    related_entity_id: string | null
    related_entity_type: string | null
    is_read: boolean
    created_at: string
}

export async function getUserNotifications(limit = 10) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit)

    if (error) {
        console.error('Error fetching user notifications:', error)
        return []
    }

    return data as UserNotification[]
}

export async function markUserNotificationAsRead(id: string) {
    const supabase = createClient()
    const { error } = await supabase
        .from('user_notifications')
        .update({ is_read: true })
        .eq('id', id)

    if (error) {
        console.error('Error marking user notification as read:', error)
        return false
    }

    return true
}

export async function markAllUserNotificationsAsRead() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const { error } = await supabase
        .from('user_notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false)

    if (error) {
        console.error('Error marking all user notifications as read:', error)
        return false
    }

    return true
}
