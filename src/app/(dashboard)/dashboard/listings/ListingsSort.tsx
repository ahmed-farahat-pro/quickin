'use client'
// Listings sort component


import
{
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'

export function ListingsSort()
{
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const t = useTranslations('dashboardListings.sort')
    const currentSort = searchParams.get('sort') || 'newest'

    const handleSortChange = (value: string) =>
    {
        const params = new URLSearchParams(searchParams)
        params.set('sort', value)
        router.push(`${pathname}?${params.toString()}`)
    }

    return (
        <Select value={currentSort} onValueChange={handleSortChange}>
            <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('placeholder')} />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="newest">{t('newest')}</SelectItem>
                <SelectItem value="oldest">{t('oldest')}</SelectItem>
                <SelectItem value="price_high">{t('priceHigh')}</SelectItem>
                <SelectItem value="price_low">{t('priceLow')}</SelectItem>
            </SelectContent>
        </Select>
    )
}
