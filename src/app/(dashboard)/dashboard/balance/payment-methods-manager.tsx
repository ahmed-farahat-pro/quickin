'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Wallet, Landmark, CreditCard, MoreVertical, Trash2, Check } from 'lucide-react'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { 
  HostPaymentMethod, 
  deleteHostPaymentMethod, 
  setHostDefaultPaymentMethod 
} from '@/lib/actions/payment-methods'
import { PaymentMethodDialog } from './payment-methods-dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface PaymentMethodsManagerProps {
  methods: HostPaymentMethod[]
}

export function PaymentMethodsManager({ methods }: PaymentMethodsManagerProps) {
  const t = useTranslations('dashboardPaymentMethods')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingMethod, setEditingMethod] = useState<HostPaymentMethod | null>(null)

  const handleAdd = () => {
    setEditingMethod(null)
    setIsDialogOpen(true)
  }

  const handleEdit = (method: HostPaymentMethod) => {
    setEditingMethod(method)
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('deleteConfirm'))) return

    try {
      const result = await deleteHostPaymentMethod(id)
      if (result.success) {
        toast.success(t('deleteSuccess') || 'Deleted')
      } else {
        toast.error(result.error || 'Error')
      }
    } catch (err) {
      toast.error('Unexpected error')
    }
  }

  const handleSetDefault = async (id: string) => {
    try {
      const result = await setHostDefaultPaymentMethod(id)
      if (result.success) {
        toast.success(t('success') || 'Updated')
      } else {
        toast.error(result.error || 'Error')
      }
    } catch (err) {
      toast.error('Unexpected error')
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'mobile_wallet': return <Wallet className="h-5 w-5" />
      case 'bank_account': return <Landmark className="h-5 w-5" />
      case 'instapay': return <CreditCard className="h-5 w-5" />
      default: return <Wallet className="h-5 w-5" />
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{t('title')}</h2>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>
        <Button onClick={handleAdd} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          {t('addMethod')}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {methods.length === 0 ? (
          <div className="col-span-full py-8 text-center border-2 border-dashed rounded-lg text-muted-foreground">
            {t('noMethods')}
          </div>
        ) : (
          methods.map((method) => (
            <Card key={method.id} className={cn("relative overflow-hidden", method.is_default && "border-primary")}>
              {method.is_default && (
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded-bl-lg font-medium">
                  {t('default')}
                </div>
              )}
              <CardHeader className="p-4 pb-0">
                <div className="flex items-center justify-between">
                  <div className="p-2 bg-muted rounded-full">
                    {getIcon(method.type)}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(method)}>
                        {t('form.submit')}
                      </DropdownMenuItem>
                      {!method.is_default && (
                        <DropdownMenuItem onClick={() => handleSetDefault(method.id)}>
                          {t('setDefault')}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem 
                        onClick={() => handleDelete(method.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t('delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <div className="font-medium text-sm">
                  {method.provider_name || t(`types.${method.type}`)}
                </div>
                <div className="text-xs text-muted-foreground mt-1 truncate">
                  {method.account_number}
                </div>
                <div className="text-xs font-medium mt-2">
                  {method.account_holder_name}
                </div>
                {method.bank_name && (
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {method.bank_name}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <PaymentMethodDialog 
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        initialData={editingMethod}
      />
    </div>
  )
}
