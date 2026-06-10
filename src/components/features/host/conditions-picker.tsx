'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Clock, Check, AlertCircle } from 'lucide-react'

interface Condition {
  id: string
  name: string
  description: string | null
  icon_url: string | null
  is_approved: boolean
  is_system: boolean
  created_by: string | null
}

interface ConditionsPickerProps {
  listingId: string
  selectedConditionIds: string[]
  onConditionsChange: (conditionIds: string[]) => void
}

export function ConditionsPicker({ 
  listingId, 
  selectedConditionIds, 
  onConditionsChange 
}: ConditionsPickerProps) {
  const [conditions, setConditions] = useState<Condition[]>([])
  const [myPendingConditions, setMyPendingConditions] = useState<Condition[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newConditionName, setNewConditionName] = useState('')
  const [newConditionDescription, setNewConditionDescription] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  useEffect(() => {
    loadConditions()
  }, [])

  async function loadConditions() {
    const supabase = createClient()
    
    // Fetch approved conditions
    const { data: approvedData, error: approvedError } = await supabase
      .from('listing_conditions')
      .select('*')
      .or('is_approved.eq.true,is_system.eq.true')
      .order('is_system', { ascending: false })
      .order('name')
    
    if (approvedError) {
      console.error('Error fetching conditions:', approvedError)
    } else {
      setConditions(approvedData || [])
    }

    // Fetch user's pending conditions
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: pendingData } = await supabase
        .from('listing_conditions')
        .select('*')
        .eq('created_by', user.id)
        .eq('is_approved', false)
      
      setMyPendingConditions(pendingData || [])
    }

    setLoading(false)
  }

  async function handleAddCondition() {
    if (!newConditionName.trim()) {
      toast.error('Please enter a condition name')
      return
    }

    setIsAdding(true)
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error('Please log in')
      setIsAdding(false)
      return
    }

    const { data, error } = await supabase
      .from('listing_conditions')
      .insert({
        name: newConditionName.trim(),
        description: newConditionDescription.trim() || null,
        created_by: user.id,
        is_approved: false,
        is_system: false
      })
      .select()
      .single()

    if (error) {
      console.error('Error adding condition:', error)
      toast.error('Failed to add condition')
    } else {
      toast.success('Condition submitted for approval!')
      setNewConditionName('')
      setNewConditionDescription('')
      setShowAddForm(false)
      setMyPendingConditions(prev => [...prev, data])
    }

    setIsAdding(false)
  }

  function toggleCondition(conditionId: string) {
    if (selectedConditionIds.includes(conditionId)) {
      onConditionsChange(selectedConditionIds.filter(id => id !== conditionId))
    } else {
      onConditionsChange([...selectedConditionIds, conditionId])
    }
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading conditions...</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Listing Conditions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Select conditions that guests must agree to before booking.
        </p>

        {/* Approved/System Conditions */}
        <div className="space-y-2">
          {conditions.map((condition) => (
            <div key={condition.id} className="flex items-start gap-3 p-2 rounded hover:bg-muted/50">
              <Checkbox
                id={condition.id}
                checked={selectedConditionIds.includes(condition.id)}
                onCheckedChange={() => toggleCondition(condition.id)}
              />
              <div className="flex-1">
                <Label htmlFor={condition.id} className="cursor-pointer flex items-center gap-2">
                  {condition.name}
                  {condition.is_system && (
                    <Badge variant="secondary" className="text-xs">System</Badge>
                  )}
                </Label>
                {condition.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{condition.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* User's Pending Conditions */}
        {myPendingConditions.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-sm font-medium mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Pending Approval
            </p>
            <div className="space-y-2">
              {myPendingConditions.map((condition) => (
                <div key={condition.id} className="flex items-start gap-3 p-2 rounded bg-muted/30 opacity-60">
                  <Checkbox disabled checked={false} />
                  <div className="flex-1">
                    <Label className="text-muted-foreground">
                      {condition.name}
                      <Badge variant="outline" className="text-xs ml-2">Awaiting approval</Badge>
                    </Label>
                    {condition.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{condition.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add Custom Condition */}
        <div className="pt-2 border-t">
          {!showAddForm ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddForm(true)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Custom Condition
            </Button>
          ) : (
            <div className="space-y-3">
              <div>
                <Label htmlFor="conditionName">Condition Name</Label>
                <Input
                  id="conditionName"
                  value={newConditionName}
                  onChange={(e) => setNewConditionName(e.target.value)}
                  placeholder="e.g., No shoes inside"
                />
              </div>
              <div>
                <Label htmlFor="conditionDesc">Description (optional)</Label>
                <Input
                  id="conditionDesc"
                  value={newConditionDescription}
                  onChange={(e) => setNewConditionDescription(e.target.value)}
                  placeholder="Brief explanation..."
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleAddCondition}
                  disabled={isAdding}
                >
                  {isAdding ? 'Submitting...' : 'Submit for Approval'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowAddForm(false)
                    setNewConditionName('')
                    setNewConditionDescription('')
                  }}
                >
                  Cancel
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Custom conditions need admin approval before they become available for use.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
