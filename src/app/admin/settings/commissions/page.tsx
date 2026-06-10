import { getCommissionRates, getCommissionRateHistory } from '@/lib/actions/platform-settings'
import { CommissionsForm } from './commissions-form'

export const dynamic = 'force-dynamic'

export default async function SettingsCommissionsPage()
{
    const [rates, history] = await Promise.all([
        getCommissionRates(),
        getCommissionRateHistory()
    ])

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Commission Settings</h1>
                <p className="text-muted-foreground">
                    Manage the platform service fees for hosts and guests.
                </p>
            </div>

            <CommissionsForm
                currentRates={rates}
                history={history}
            />
        </div>
    )
}
