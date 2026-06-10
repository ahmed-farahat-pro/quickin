import { createClient } from './client'

export interface StaffNotification {
    id: string
    type: string
    title: string
    message: string
    related_entity_id: string | null
    related_entity_type: string | null
    is_read: boolean
    created_at: string
}

export async function getStaffNotifications(limit = 10) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('staff_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

    if (error) {
        console.error('Error fetching notifications:', error)
        return []
    }

    return data as StaffNotification[]
}

export async function markNotificationAsRead(id: string) {
    const supabase = createClient()
    const { error } = await supabase
        .from('staff_notifications')
        .update({ is_read: true })
        .eq('id', id)

    if (error) {
        console.error('Error marking notification as read:', error)
        return false
    }

    return true
}

export async function markAllNotificationsAsRead() {
    const supabase = createClient()
    const { error } = await supabase
        .from('staff_notifications')
        .update({ is_read: true })
        .eq('is_read', false)

    if (error) {
        console.error('Error marking all notifications as read:', error)
        return false
    }

    return true
}
