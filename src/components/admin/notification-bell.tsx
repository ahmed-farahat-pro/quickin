'use client'

import * as React from 'react'
import { Bell, Check, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
    getStaffNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    type StaffNotification
} from '@/lib/supabase/staff-notifications'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { getMessagingInstance } from '@/lib/firebase/client'
import { getToken, onMessage } from 'firebase/messaging'

export function NotificationBell() {
    const [notifications, setNotifications] = React.useState<StaffNotification[]>([])
    const [unreadCount, setUnreadCount] = React.useState(0)
    const [isLoading, setIsLoading] = React.useState(true)
    const [isOpen, setIsOpen] = React.useState(false)
    const router = useRouter()
    const supabase = createClient()

    const fetchNotifications = React.useCallback(async () => {
        setIsLoading(true)
        const data = await getStaffNotifications()
        setNotifications(data)
        setUnreadCount(data.filter((n) => !n.is_read).length)
        setIsLoading(false)
    }, [])

    const initializeFirebaseMessaging = React.useCallback(async () => {
        try {
            const permission = await Notification.requestPermission()
            if (permission === 'granted') {
                const messaging = await getMessagingInstance()
                if (messaging) {
                    const token = await getToken(messaging, {
                        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
                    })

                    if (token) {
                        try {
                            const { data: { user } } = await supabase.auth.getUser();
                            if (user) {
                                // Save token to staff profile
                                await supabase
                                    .from('staff_profiles')
                                    .update({ fcm_token: token })
                                    .eq('id', user.id)
                            }
                        } catch (err) {
                            console.error("Error saving FCM token", err);
                        }
                    }

                    // Listen for foreground messages (Firebase requires this to be set up)
                    onMessage(messaging, (payload) => {
                        console.log("Foreground FCM message received:", payload);
                        // We don't need to show a toast here because Supabase Realtime already handles it 
                        // perfectly for our NotificationBell. We just need to register the listener.
                    });
                }
            }
        } catch (error) {
            console.error('An error occurred while requesting FCM permissions', error)
        }
    }, [supabase])

    React.useEffect(() => {
        fetchNotifications()
        initializeFirebaseMessaging()

        // Subscribe to new notifications with a unique channel name to prevent Strict Mode collisions
        const channel = supabase
            .channel(`admin-notifications-${Date.now()}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'staff_notifications',
                },
                (payload) => {
                    const newNotification = payload.new as StaffNotification
                    setNotifications((prev) => {
                        // Prevent duplicates in case of multiple fires
                        if (prev.some(n => n.id === newNotification.id)) return prev;
                        return [newNotification, ...prev].slice(0, 10);
                    })
                    setUnreadCount((prev) => prev + 1)

                    // Show toast for new booking
                    if (newNotification.type === 'new_booking') {
                        toast.info(newNotification.title, {
                            description: newNotification.message,
                            action: {
                                label: 'View',
                                onClick: () => router.push(`/admin/payments`), // Standard redirect for bookings/payments
                            },
                        })
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [fetchNotifications, supabase, router])

    const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        const success = await markNotificationAsRead(id)
        if (success) {
            setNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
            )
            setUnreadCount((prev) => Math.max(0, prev - 1))
        }
    }

    const handleMarkAllAsRead = async () => {
        const success = await markAllNotificationsAsRead()
        if (success) {
            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
            setUnreadCount(0)
        }
    }

    const handleNotificationClick = async (notification: StaffNotification) => {
        if (!notification.is_read) {
            const success = await markNotificationAsRead(notification.id)
            if (success) {
                setNotifications((prev) =>
                    prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
                )
                setUnreadCount((prev) => Math.max(0, prev - 1))
            }
        }

        setIsOpen(false)

        // Route based on notification type
        if (notification.type === 'new_booking') {
            router.push(`/admin/payments`)
        }
    }

    return (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <Badge
                            variant="destructive"
                            className="absolute -right-1 -top-1 h-5 w-5 justify-center rounded-full p-0 text-[10px]"
                        >
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </Badge>
                    )}
                    <span className="sr-only">Notifications</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[380px]">
                <div className="flex items-center justify-between px-4 py-2">
                    <DropdownMenuLabel className="p-0 font-semibold">Notifications</DropdownMenuLabel>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={handleMarkAllAsRead}
                        >
                            Mark all as read
                        </Button>
                    )}
                </div>
                <DropdownMenuSeparator />
                <ScrollArea className="h-[400px]">
                    {isLoading ? (
                        <div className="flex h-32 items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : notifications.length > 0 ? (
                        notifications.map((notification) => (
                            <DropdownMenuItem
                                key={notification.id}
                                className={cn(
                                    "flex flex-col items-start gap-1 p-4 cursor-pointer focus:bg-accent",
                                    !notification.is_read && "bg-blue-50/50"
                                )}
                                onClick={() => handleNotificationClick(notification)}
                            >
                                <div className="flex w-full items-start justify-between gap-2">
                                    <div className="font-semibold text-sm">{notification.title}</div>
                                    {notification.is_read && (
                                        <div className="h-5 w-5 flex items-center justify-center">
                                            <Check className="h-3 w-3 text-green-600" />
                                        </div>
                                    )}
                                </div>
                                <div className="text-xs text-muted-foreground line-clamp-2">
                                    {notification.message}
                                </div>
                                <div className="text-[10px] text-muted-foreground mt-1">
                                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                                </div>
                            </DropdownMenuItem>
                        ))
                    ) : (
                        <div className="flex h-32 flex-col items-center justify-center text-center p-4">
                            <Bell className="h-8 w-8 text-muted-foreground/30 mb-2" />
                            <p className="text-sm text-muted-foreground">No notifications yet</p>
                        </div>
                    )}
                </ScrollArea>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    className="w-full justify-center text-xs font-medium text-muted-foreground focus:bg-transparent cursor-default"
                >
                    Recent Activity
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
