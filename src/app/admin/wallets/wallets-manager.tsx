'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2, Edit2, CheckCircle2, XCircle } from 'lucide-react'
import Image from 'next/image'

export function WalletsManager({ initialWallets }: { initialWallets: any[] }) {
  const [wallets, setWallets] = useState(initialWallets)
  const [isLoading, setIsLoading] = useState(false)
  const [isEditing, setIsEditing] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const router = useRouter()
  const supabase = createClient()

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    setIsLoading(true)
    try {
      const { error } = await supabase
        .from('mobile_wallets')
        .update({ is_active: !currentStatus })
        .eq('id', id)

      if (error) throw error
      setWallets(wallets.map(w => w.id === id ? { ...w, is_active: !currentStatus } : w))
      toast.success('Wallet status updated')
    } catch (error: any) {
      toast.error(error.message || 'Failed to update status')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this wallet?')) return
    setIsLoading(true)
    try {
      const { error } = await supabase.from('mobile_wallets').delete().eq('id', id)
      if (error) throw error
      setWallets(wallets.filter(w => w.id !== id))
      toast.success('Wallet deleted')
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete wallet')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    setIsLoading(true)
    try {
      if (isEditing === 'new') {
        const { data, error } = await supabase
          .from('mobile_wallets')
          .insert([editForm])
          .select()
          .single()
        if (error) throw error
        setWallets([...wallets, data])
        toast.success('Wallet created')
      } else {
        const { data, error } = await supabase
          .from('mobile_wallets')
          .update(editForm)
          .eq('id', isEditing)
          .select()
          .single()
        if (error) throw error
        setWallets(wallets.map(w => w.id === isEditing ? data : w))
        toast.success('Wallet updated')
      }
      setIsEditing(null)
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || 'Failed to save wallet')
    } finally {
      setIsLoading(false)
    }
  }

  const startEdit = (wallet: any) => {
    setEditForm(wallet)
    setIsEditing(wallet.id)
  }

  const startNew = () => {
    setEditForm({
      provider_id: '',
      name: '',
      logo_url: '',
      qr_code: '',
      phone_number: '',
      is_active: true,
      sort_order: wallets.length + 1
    })
    setIsEditing('new')
  }

  if (isEditing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{isEditing === 'new' ? 'Add Mobile Wallet' : 'Edit Mobile Wallet'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Provider ID (Internal)</Label>
              <Input
                value={editForm.provider_id || ''}
                onChange={e => setEditForm({ ...editForm, provider_id: e.target.value })}
                placeholder="e.g. instapay"
                disabled={isEditing !== 'new'}
              />
            </div>
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input
                value={editForm.name || ''}
                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="e.g. InstaPay"
              />
            </div>
            <div className="space-y-2">
              <Label>Logo URL</Label>
              <Input
                value={editForm.logo_url || ''}
                onChange={e => setEditForm({ ...editForm, logo_url: e.target.value })}
                placeholder="/InstaPay-logobase.net.svg or URL"
              />
            </div>
            <div className="space-y-2">
              <Label>QR Code String</Label>
              <Input
                value={editForm.qr_code || ''}
                onChange={e => setEditForm({ ...editForm, qr_code: e.target.value })}
                placeholder="Optional data to generate QR"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input
                value={editForm.phone_number || ''}
                onChange={e => setEditForm({ ...editForm, phone_number: e.target.value })}
                placeholder="e.g. 01001234567"
              />
            </div>
            <div className="space-y-2">
              <Label>Sort Order</Label>
              <Input
                type="number"
                value={editForm.sort_order || 0}
                onChange={e => setEditForm({ ...editForm, sort_order: parseInt(e.target.value) })}
              />
            </div>
            <div className="flex items-center space-x-2 pt-8">
              <Switch
                checked={editForm.is_active}
                onCheckedChange={checked => setEditForm({ ...editForm, is_active: checked })}
              />
              <Label>Active</Label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsEditing(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={startNew}>
          <Plus className="mr-2 h-4 w-4" />
          Add Wallet
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {wallets.map((wallet) => (
          <Card key={wallet.id} className={wallet.is_active ? '' : 'opacity-60'}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 relative bg-muted rounded-md overflow-hidden">
                  {wallet.logo_url && (
                    <Image
                      src={wallet.logo_url}
                      alt={wallet.name}
                      fill
                      className="object-cover"
                    />
                  )}
                </div>
                <CardTitle className="text-base">{wallet.name}</CardTitle>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => startEdit(wallet)}>
                  <Edit2 className="h-4 w-4 text-muted-foreground" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(wallet.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Provider ID:</strong> {wallet.provider_id}</p>
                <p><strong>Phone:</strong> {wallet.phone_number || 'N/A'}</p>
                <p><strong>QR Configured:</strong> {wallet.qr_code ? 'Yes' : 'No'}</p>
                <div className="flex items-center justify-between pt-4">
                  <div className="flex items-center gap-2">
                    {wallet.is_active ? (
                      <Badge variant="outline" className="bg-green-100 text-green-800"><CheckCircle2 className="w-3 h-3 mr-1"/> Active</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-muted-foreground"><XCircle className="w-3 h-3 mr-1"/> Disabled</Badge>
                    )}
                  </div>
                  <Switch
                    checked={wallet.is_active}
                    onCheckedChange={() => handleToggleActive(wallet.id, wallet.is_active)}
                    disabled={isLoading}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
