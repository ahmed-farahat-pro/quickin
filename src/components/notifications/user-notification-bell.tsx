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
    getUserNotifications,
    markUserNotificationAsRead,
    markAllUserNotificationsAsRead,
    type UserNotification
} from '@/lib/supabase/user-notifications'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { getMessagingInstance } from '@/lib/firebase/client'
import { getToken, onMessage } from 'firebase/messaging'

export function UserNotificationBell() {
    const [notifications, setNotifications] = React.useState<UserNotification[]>([])
    const [unreadCount, setUnreadCount] = React.useState(0)
    const [isLoading, setIsLoading] = React.useState(true)
    const [isOpen, setIsOpen] = React.useState(false)
    const router = useRouter()
    const supabase = createClient()

    const fetchNotifications = React.useCallback(async () => {
        setIsLoading(true)
        const data = await getUserNotifications()
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
                                // Save token to profile
                                await supabase
                                    .from('profiles')
                                    .update({ fcm_token: token })
                                    .eq('id', user.id)
                            }
                        } catch (err) {
                            console.error("Error saving FCM token", err);
                        }
                    }

                    // Listen for foreground messages
                    onMessage(messaging, (payload) => {
                        console.log("Foreground FCM message received:", payload);
                    });
                }
            }
        } catch (error) {
            console.error('An error occurred while requesting FCM permissions', error)
        }
    }, [supabase])

    React.useEffect(() => {
        const setup = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                setIsLoading(false)
                return
            }

            fetchNotifications()
            initializeFirebaseMessaging()

            // Subscribe to new notifications just for this user
            const channel = supabase
                .channel(`user-notifications-${user.id}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'user_notifications',
                        filter: `user_id=eq.${user.id}`
                    },
                    (payload) => {
                        const newNotification = payload.new as UserNotification
                        setNotifications((prev) => {
                            if (prev.some(n => n.id === newNotification.id)) return prev;
                            return [newNotification, ...prev].slice(0, 10);
                        })
                        setUnreadCount((prev) => prev + 1)

                        // Show toast
                        toast.info(newNotification.title, {
                            description: newNotification.message,
                            action: {
                                label: 'View',
                                onClick: () => {
                                    if (newNotification.type === 'payment_approved') {
                                        router.push('/dashboard/trips')
                                    } else if (newNotification.type === 'payment_rejected') {
                                        router.push(`/listings/${newNotification.related_entity_id}`)
                                    }
                                },
                            },
                        })
                    }
                )
                .subscribe()

            return () => {
                supabase.removeChannel(channel)
            }
        }

        setup()
    }, [fetchNotifications, supabase, router, initializeFirebaseMessaging])

    const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        const success = await markUserNotificationAsRead(id)
        if (success) {
            setNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
            )
            setUnreadCount((prev) => Math.max(0, prev - 1))
        }
    }

    const handleMarkAllAsRead = async () => {
        const success = await markAllUserNotificationsAsRead()
        if (success) {
            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
            setUnreadCount(0)
        }
    }

    const handleNotificationClick = async (notification: UserNotification) => {
        if (!notification.is_read) {
            const success = await markUserNotificationAsRead(notification.id)
            if (success) {
                setNotifications((prev) =>
                    prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
                )
                setUnreadCount((prev) => Math.max(0, prev - 1))
            }
        }

        setIsOpen(false)

        if (notification.type === 'payment_approved') {
            router.push('/dashboard/trips')
        } else if (notification.type === 'payment_rejected') {
            router.push(`/listings/${notification.related_entity_id}`)
        }
    }

    return (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full">
                    <Bell className="h-5 w-5 text-muted-foreground" />
                    {unreadCount > 0 && (
                        <Badge
                            variant="destructive"
                            className="absolute -right-1 -top-1 h-4 w-4 justify-center rounded-full p-0 text-[9px] border-2 border-background"
                        >
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </Badge>
                    )}
                    <span className="sr-only">Notifications</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[380px] rounded-xl">
                <div className="flex items-center justify-between px-4 py-3">
                    <DropdownMenuLabel className="p-0 font-semibold text-base">Notifications</DropdownMenuLabel>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto p-0 text-xs text-blue-600 hover:text-blue-700 hover:bg-transparent"
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
                                    "flex flex-col items-start gap-1 p-4 cursor-pointer focus:bg-accent rounded-none border-b border-border/50 last:border-0",
                                    !notification.is_read && "bg-blue-50/30"
                                )}
                                onClick={() => handleNotificationClick(notification)}
                            >
                                <div className="flex w-full items-start justify-between gap-2">
                                    <div className={cn("text-sm", notification.is_read ? "text-muted-foreground" : "font-semibold")}>
                                        {notification.title}
                                    </div>
                                    {!notification.is_read && (
                                        <div className="h-2 w-2 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                                    )}
                                </div>
                                <div className={cn("text-sm line-clamp-2", notification.is_read ? "text-muted-foreground/80" : "text-muted-foreground")}>
                                    {notification.message}
                                </div>
                                <div className="text-xs text-muted-foreground/70 mt-1">
                                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                                </div>
                            </DropdownMenuItem>
                        ))
                    ) : (
                        <div className="flex h-40 flex-col items-center justify-center text-center p-4">
                            <div className="bg-muted h-12 w-12 rounded-full flex items-center justify-center mb-3">
                                <Bell className="h-6 w-6 text-muted-foreground/50" />
                            </div>
                            <p className="text-sm font-medium">No notifications yet</p>
                            <p className="text-xs text-muted-foreground mt-1">When you get updates, they'll show up here</p>
                        </div>
                    )}
                </ScrollArea>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
