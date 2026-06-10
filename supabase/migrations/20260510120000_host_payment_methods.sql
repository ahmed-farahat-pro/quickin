-- Migration: Host Payment Methods
-- Goal: Allow hosts to manage their mobile wallets, instapay, and bank accounts for payouts.

-- Expand payout_method_type enum if it exists, or create it
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payout_method_type') THEN
        ALTER TYPE public.payout_method_type ADD VALUE IF NOT EXISTS 'mobile_wallet';
        ALTER TYPE public.payout_method_type ADD VALUE IF NOT EXISTS 'orange_cash';
        ALTER TYPE public.payout_method_type ADD VALUE IF NOT EXISTS 'etisalat_cash';
        ALTER TYPE public.payout_method_type ADD VALUE IF NOT EXISTS 'we_pay';
    ELSE
        CREATE TYPE public.payout_method_type AS ENUM ('bank_transfer', 'vodafone_cash', 'instapay', 'mobile_wallet', 'orange_cash', 'etisalat_cash', 'we_pay');
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create host_payment_method_type enum
DO $$ BEGIN
    CREATE TYPE public.host_payment_method_type AS ENUM ('mobile_wallet', 'bank_account', 'instapay');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create host_payment_methods table
CREATE TABLE IF NOT EXISTS public.host_payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type public.host_payment_method_type NOT NULL,
    provider_name TEXT, -- e.g. 'Vodafone Cash', 'CIB', 'Instapay'
    account_number TEXT NOT NULL, -- Phone number, IBAN/Account No, or Instapay Address
    account_holder_name TEXT NOT NULL,
    bank_name TEXT, -- For bank accounts
    iban TEXT, -- For bank accounts
    swift_code TEXT, -- For bank accounts
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.host_payment_methods ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ BEGIN
    CREATE POLICY "Users can manage their own payment methods" ON public.host_payment_methods
        FOR ALL USING (auth.uid() = user_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Staff can view all host payment methods" ON public.host_payment_methods
        FOR SELECT USING (EXISTS (SELECT 1 FROM public.staff_profiles WHERE id = auth.uid()));
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_host_payment_methods_updated_at ON public.host_payment_methods;
CREATE TRIGGER update_host_payment_methods_updated_at
    BEFORE UPDATE ON public.host_payment_methods
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Add payment_method_id and payment_method_details to payouts
ALTER TABLE public.payouts ADD COLUMN IF NOT EXISTS payment_method_id UUID REFERENCES public.host_payment_methods(id) ON DELETE SET NULL;
ALTER TABLE public.payouts ADD COLUMN IF NOT EXISTS payment_method_details JSONB;

-- Function to handle single default payment method per user
CREATE OR REPLACE FUNCTION public.handle_default_payment_method()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.host_payment_methods
    SET is_default = false
    WHERE user_id = NEW.user_id AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_handle_default_payment_method ON public.host_payment_methods;
CREATE TRIGGER trg_handle_default_payment_method
  BEFORE INSERT OR UPDATE ON public.host_payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_default_payment_method();
