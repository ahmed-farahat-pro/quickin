'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { createBan } from '@/app/admin/bans/actions'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function BanForm() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [users, setUsers] = React.useState<any[]>([])

  const [formData, setFormData] = React.useState({
    user_id: '',
    ban_type: 'temporary',
    reason: '',
    details: '',
    duration_days: 7,
  })

  React.useEffect(() => {
    const fetchUsers = async () => {
      const supabase = createClient()
      const { data } = await supabase.from('profiles').select('id, full_name, email').limit(100)
      if (data) setUsers(data)
    }
    fetchUsers()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({ ...prev, [name]: type === 'number' ? Number(value) : value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const payload: any = {
        user_id: formData.user_id,
        ban_type: formData.ban_type,
        reason: formData.reason,
        details: formData.details || null,
      }

      if (formData.ban_type === 'temporary') {
        payload.duration_days = formData.duration_days
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + formData.duration_days)
        payload.expires_at = expiresAt.toISOString()
      }

      const result = await createBan(payload)
      if (result.error) throw new Error(result.error)
      
      toast.success('User banned successfully')
      router.push('/admin/bans')
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Ban Details</CardTitle>
          <CardDescription>Issue a temporary or permanent platform ban for a user.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="user_id">Target User</Label>
            <Select value={formData.user_id} onValueChange={(v) => setFormData(p => ({...p, user_id: v}))} required>
              <SelectTrigger><SelectValue placeholder="Select user..." /></SelectTrigger>
              <SelectContent>
                {users.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.full_name || 'Unknown'} ({u.email})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ban Type</Label>
              <Select value={formData.ban_type} onValueChange={(v) => setFormData(p => ({...p, ban_type: v}))} required>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="temporary">Temporary</SelectItem>
                  <SelectItem value="permanent">Permanent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.ban_type === 'temporary' && (
              <div className="space-y-2">
                <Label htmlFor="duration_days">Duration (Days)</Label>
                <Input id="duration_days" name="duration_days" type="number" min={1} value={formData.duration_days} onChange={handleChange} required />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason (Short)</Label>
            <Input id="reason" name="reason" value={formData.reason} onChange={handleChange} placeholder="e.g. Terms of Service Violation" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="details">Internal Notes / Details</Label>
            <Textarea id="details" name="details" value={formData.details} onChange={handleChange} placeholder="Detailed explanation for staff..." rows={4} />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-4">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" variant="destructive" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Issue Ban
        </Button>
      </div>
    </form>
  )
}
