import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Process a payout (mark as processing or complete)
export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
  }

  // Get current staff user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if user is staff
  const { data: staffProfile } = await supabase
    .from('staff_profiles')
    .select('id, role')
    .eq('id', user.id)
    .eq('is_active', true)
    .single()

  if (!staffProfile) {
    return NextResponse.json({ error: 'Staff access required' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { 
      payout_id, 
      action, // 'process', 'complete', 'fail', 'cancel'
      payout_method,
      payout_reference,
      notes,
      send_message = true
    } = body

    // Validate required fields
    if (!payout_id || !action) {
      return NextResponse.json({ 
        error: 'Missing required fields: payout_id, action' 
      }, { status: 400 })
    }

    const validActions = ['process', 'complete', 'fail', 'cancel']
    if (!validActions.includes(action)) {
      return NextResponse.json({ 
        error: `Action must be one of: ${validActions.join(', ')}` 
      }, { status: 400 })
    }

    // Get the payout record with transaction amounts
    const { data: payout, error: fetchError } = await supabase
      .from('payouts')
      .select(`
        *,
        host:profiles!payouts_host_id_fkey(id, full_name, email),
        transactions(id, amount, type)
      `)
      .eq('id', payout_id)
      .single()

    if (fetchError || !payout) {
      return NextResponse.json({ error: 'Payout not found' }, { status: 404 })
    }

    // Validate state transitions
    const validTransitions: Record<string, string[]> = {
      pending: ['process', 'cancel'],
      processing: ['complete', 'fail'],
    }

    if (!validTransitions[payout.status]?.includes(action)) {
      return NextResponse.json({ 
        error: `Cannot ${action} a payout with status "${payout.status}"` 
      }, { status: 400 })
    }

    // Determine new status
    const statusMap: Record<string, string> = {
      process: 'processing',
      complete: 'completed',
      fail: 'failed',
      cancel: 'cancelled',
    }
    const newStatus = statusMap[action]

    // Build update data
    const updateData: Record<string, unknown> = {
      status: newStatus,
      notes,
    }

    if (action === 'process') {
      updateData.processed_at = new Date().toISOString()
      updateData.processed_by = staffProfile.id
      if (payout_method) updateData.payout_method = payout_method
    }

    if (action === 'complete') {
      updateData.completed_at = new Date().toISOString()
      if (payout_reference) updateData.payout_reference = payout_reference
    }

    // Update the payout
    const { error: updateError } = await supabase
      .from('payouts')
      .update(updateData)
      .eq('id', payout_id)

    if (updateError) {
      console.error('Error updating payout:', updateError)
      return NextResponse.json({ error: 'Failed to update payout' }, { status: 500 })
    }

    // Compute payout amount from linked transactions
    const txAmounts = ((payout as any).transactions || []) as { amount: number }[]
    const payoutAmount = Math.abs(txAmounts.reduce((s: number, tx: { amount: number }) => s + tx.amount, 0))

    // Handle fund reversal if failed or cancelled
    if (action === 'fail' || action === 'cancel') {
        const withdrawalTx = ((payout as any).transactions || []).find((tx: any) => tx.type === 'withdrawal' && tx.amount < 0)
        
        if (withdrawalTx) {
            const adminClient = await createAdminClient()
            if (adminClient) {
                const { error: reversalError } = await adminClient
                    .from('transactions')
                    .insert({
                        user_id: payout.host_id,
                        type: 'reversal',
                        amount: Math.abs(withdrawalTx.amount),
                        payout_id: payout.id,
                        reversal_of_id: withdrawalTx.id,
                        notes: `Reversal of withdrawal due to ${action}: ${notes || 'Refused by admin'}`
                    })
                
                if (reversalError) {
                    console.error('Error creating reversal transaction:', reversalError)
                    return NextResponse.json({ 
                        error: 'Payout status updated but failed to return funds to wallet. Please contact engineering.',
                        details: reversalError.message 
                    }, { status: 500 })
                }
            } else {
                console.error('Failed to initialize admin client for reversal')
                return NextResponse.json({ error: 'System configuration error' }, { status: 500 })
            }
        }
    }

    // Send notification to host
    if (send_message && (action === 'complete' || action === 'fail' || action === 'cancel')) {
      const subject = action === 'complete'
        ? 'Payout Completed!'
        : action === 'fail' ? 'Payout Failed' : 'Payout Cancelled'

      const messageBody = action === 'complete'
        ? `Great news! Your payout of EGP ${payoutAmount.toFixed(0)} has been sent via ${payout_method?.replace('_', ' ') || 'your preferred method'}.\n\nReference: ${payout_reference || 'N/A'}\n\nThank you for being a host!`
        : action === 'fail' 
            ? `Unfortunately, we encountered an issue processing your payout of EGP ${payoutAmount.toFixed(0)}.\n\n${notes ? `Details: ${notes}\n\n` : ''}The funds have been returned to your wallet. Please ensuring your details are correct or contact support.`
            : `Your payout request of EGP ${payoutAmount.toFixed(0)} has been cancelled.\n\n${notes ? `Reason: ${notes}\n\n` : ''}The funds have been returned to your wallet.`

      await supabase
        .from('admin_messages')
        .insert({
          user_id: payout.host_id,
          category: action === 'complete' ? 'approval' : 'rejection',
          subject,
          body: messageBody,
          related_entity_type: 'payout',
          related_entity_id: payout_id,
          sent_by: staffProfile.id,
        })
    }

    // Create audit log
    await supabase
      .from('audit_logs')
      .insert({
        actor_id: user.id,
        actor_type: staffProfile.role === 'admin' ? 'admin' : 'staff',
        action: `payout.${action}`,
        entity_type: 'payout',
        entity_id: payout_id,
        entity_name: `EGP ${payoutAmount.toFixed(0)} to ${payout.host?.full_name || 'Unknown'}`,
        old_data: { status: payout.status },
        new_data: { status: newStatus, payout_method, payout_reference },
        notes: notes || `Payout ${action}ed`,
      })

    return NextResponse.json({ 
      success: true,
      status: newStatus,
    })
  } catch (error) {
    console.error('Error in PUT /api/admin/payouts/process:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Get payouts
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
  }

  // Check staff access
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: staffProfile } = await supabase
    .from('staff_profiles')
    .select('id')
    .eq('id', user.id)
    .eq('is_active', true)
    .single()

  if (!staffProfile) {
    return NextResponse.json({ error: 'Staff access required' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const hostId = searchParams.get('host_id')

  try {
    let query = supabase
      .from('payouts')
      .select(`
        *,
        host:profiles!payouts_host_id_fkey(full_name, email),
        processed_by_staff:staff_profiles!payouts_processed_by_fkey(display_name)
      `)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    if (hostId) {
      query = query.eq('host_id', hostId)
    }

    const { data: payouts, error } = await query.limit(100)

    if (error) {
      console.error('Error fetching payouts:', error)
      return NextResponse.json({ error: 'Failed to fetch payouts' }, { status: 500 })
    }

    return NextResponse.json({ payouts })
  } catch (error) {
    console.error('Error in GET /api/admin/payouts/process:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
