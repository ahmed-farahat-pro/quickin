-- Create mobile_wallets table
CREATE TABLE IF NOT EXISTS public.mobile_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    logo_url TEXT NOT NULL,
    qr_code TEXT,
    phone_number TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.mobile_wallets ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Mobile wallets are viewable by everyone" ON public.mobile_wallets
    FOR SELECT USING (true);

CREATE POLICY "Mobile wallets are insertable by admins" ON public.mobile_wallets
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.staff_profiles
            WHERE staff_profiles.id = auth.uid()
            AND staff_profiles.role = 'admin'
        )
    );

CREATE POLICY "Mobile wallets are updatable by admins" ON public.mobile_wallets
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.staff_profiles
            WHERE staff_profiles.id = auth.uid()
            AND staff_profiles.role = 'admin'
        )
    );

CREATE POLICY "Mobile wallets are deletable by admins" ON public.mobile_wallets
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.staff_profiles
            WHERE staff_profiles.id = auth.uid()
            AND staff_profiles.role = 'admin'
        )
    );

-- Create trigger for updated_at
CREATE TRIGGER update_mobile_wallets_updated_at
    BEFORE UPDATE ON public.mobile_wallets
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Insert initial hardcoded values
INSERT INTO public.mobile_wallets (provider_id, name, logo_url, qr_code, phone_number, sort_order) VALUES
    ('instapay', 'InstaPay', '/InstaPay-logobase.net.svg', 'instapay_placeholder', NULL, 1),
    ('vodafone', 'Vodafone Cash', '/vodafone-cash.jpg', NULL, '01001234567', 2),
    ('orange', 'Orange Cash', '/orange-cash.png', 'orange_placeholder', '01201234567', 3),
    ('etisalat', 'e& Money', '/e&-money.png', NULL, '01101234567', 4),
    ('we', 'WE Pay', '/we-pay.png', 'wepay_placeholder', NULL, 5)
ON CONFLICT (provider_id) DO NOTHING;
