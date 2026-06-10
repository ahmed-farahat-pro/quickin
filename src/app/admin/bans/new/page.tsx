import { BanForm } from '@/components/admin/bans/ban-form'

export default function NewBanPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Issue New Ban</h1>
        <p className="text-muted-foreground">
          Restrict a user's access to the platform due to policy violations.
        </p>
      </div>

      <div className="bg-card border rounded-lg p-6">
        <BanForm />
      </div>
    </div>
  )
}
