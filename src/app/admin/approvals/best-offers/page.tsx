import { createClient } from '@/lib/supabase/server'
import
{
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, History, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { BestOfferAdminActions } from './best-offer-admin-actions'

export const dynamic = 'force-dynamic'

async function getBestOffers()
{
    const supabase = await createClient()
    if (!supabase) return []

    const { data, error } = await supabase
        .from('listing_best_offers')
        .select(`
            id,
            start_date,
            end_date,
            status,
            offer_price,
            created_at,
            listing:listings!inner(
                id, 
                title, 
                user:profiles!listings_user_id_fkey(full_name, email)
            )
        `)
        .order('created_at', { ascending: false })
        .limit(50)

    if (error) {
        console.error('Error fetching best offers:', error)
        return []
    }

    return data
}

export default async function BestOffersApprovalsPage()
{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const offers = (await getBestOffers()) as any[]
    const pendingOffers = offers.filter(o => o.status === 'requested')
    const historyOffers = offers.filter(o => o.status !== 'requested')

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Best Offer Requests</h1>
                    <p className="text-muted-foreground">
                        Manage requests for "Best Offer" promotions.
                    </p>
                </div>
            </div>

            <Card className="border-yellow-500/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-yellow-500" />
                        Pending Requests
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Listing</TableHead>
                                <TableHead>Host</TableHead>
                                <TableHead>Dates</TableHead>
                                <TableHead>Duration</TableHead>
                                <TableHead>Offer Price</TableHead>
                                <TableHead>Requested</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {pendingOffers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        No pending requests found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                pendingOffers.map((offer) =>
                                {
                                    const start = new Date(offer.start_date)
                                    const end = new Date(offer.end_date)
                                    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
                                    const hostName = Array.isArray(offer.listing.user) ? offer.listing.user[0]?.full_name : offer.listing.user?.full_name
                                    const hostEmail = Array.isArray(offer.listing.user) ? offer.listing.user[0]?.email : offer.listing.user?.email

                                    return (
                                        <TableRow key={offer.id}>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium line-clamp-1">{offer.listing.title}</span>
                                                    <Link
                                                        href={`/listings/${offer.listing.id}`}
                                                        className="text-xs text-primary flex items-center gap-1 hover:underline mt-1"
                                                        target="_blank"
                                                    >
                                                        View Listing <ExternalLink className="h-3 w-3" />
                                                    </Link>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span>{hostName || 'Unknown'}</span>
                                                    <span className="text-xs text-muted-foreground">{hostEmail}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col text-sm">
                                                    <span className="font-medium">{format(start, 'MMM d')} - {format(end, 'MMM d, yyyy')}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{days} days</Badge>
                                            </TableCell>
                                            <TableCell>
                                                {offer.offer_price ? (
                                                    <span className="font-medium text-emerald-600">{offer.offer_price}/night</span>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {format(new Date(offer.created_at), 'MMM d, HH:mm')}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <BestOfferAdminActions offerId={offer.id} />
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <History className="h-5 w-5 text-muted-foreground" />
                        Recent History
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Listing</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Dates</TableHead>
                                <TableHead>Processed On</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {historyOffers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                        No history found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                historyOffers.map((offer) =>
                                {
                                    const start = new Date(offer.start_date)
                                    const end = new Date(offer.end_date)

                                    return (
                                        <TableRow key={offer.id} className="opacity-75">
                                            <TableCell className="font-medium">{offer.listing.title}</TableCell>
                                            <TableCell>
                                                <Badge variant={offer.status === 'approved' ? 'default' : 'secondary'} className={offer.status === 'rejected' ? 'bg-red-100 text-red-800 hover:bg-red-100' : ''}>
                                                    {offer.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {format(start, 'MMM d')} - {format(end, 'MMM d')}
                                                {offer.offer_price && (
                                                    <span className="text-emerald-600 ml-1 font-medium">({offer.offer_price}/night)</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {format(new Date(offer.updated_at || offer.created_at), 'MMM d, yyyy')}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
