'use client'

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TableProperties, LayoutList, GanttChart } from 'lucide-react'
import { AdminBooking } from './types'
import { TableView } from './views/table-view'
import { BoardView } from './views/board-view'
import { TimelineView } from './views/timeline-view'
import { BookingDetailSheet } from './booking-detail-sheet'

interface BookingsDashboardProps
{
  bookings: AdminBooking[]
}

export function BookingsDashboard({ bookings }: BookingsDashboardProps)
{
  const searchParams = useSearchParams()
  const router = useRouter()

  const defaultTab = searchParams.get('view') ?? 'table'

  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const selectedBooking = bookings.find((b) => b.id === selectedBookingId) ?? null

  function onSelectBooking(booking: AdminBooking)
  {
    setSelectedBookingId(booking.id)
    setSheetOpen(true)
  }

  function handleTabChange(value: string)
  {
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', value)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  return (
    <>
      <Tabs
        defaultValue={defaultTab}
        onValueChange={handleTabChange}
        className="w-full"
      >
        <TabsList>
          <TabsTrigger value="table" className="gap-2">
            <TableProperties className="size-4" />
            Table
          </TabsTrigger>
          <TabsTrigger value="board" className="gap-2">
            <LayoutList className="size-4" />
            Board
          </TabsTrigger>
          <TabsTrigger value="timeline" className="gap-2">
            <GanttChart className="size-4" />
            Timeline
          </TabsTrigger>
        </TabsList>

        <TabsContent value="table">
          <TableView bookings={bookings} onSelectBooking={onSelectBooking} />
        </TabsContent>

        <TabsContent value="board">
          <BoardView bookings={bookings} onSelectBooking={onSelectBooking} />
        </TabsContent>

        <TabsContent value="timeline">
          <TimelineView
            bookings={bookings}
            onSelectBooking={onSelectBooking}
          />
        </TabsContent>
      </Tabs>

      <BookingDetailSheet
        booking={selectedBooking}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  )
}
