
-- Replace existing policies with 4 Airbnb-matching ones
DELETE FROM cancellation_policies;

INSERT INTO cancellation_policies (code, label, description, full_refund_days_before, partial_refund_days_before, partial_refund_pct, no_refund_days_before, is_enabled, display_order, translations) VALUES
('flexible', 'Flexible',
 'Full refund at least 1 day before check-in. Partial refund within 1 day of check-in.',
 1, 0, 0, 0, true, 1,
 '{"ar": {"label": "مرن", "description": "استرداد كامل قبل يوم واحد على الأقل من تسجيل الوصول. استرداد جزئي خلال يوم واحد من تسجيل الوصول."}}'::jsonb),

('moderate', 'Moderate',
 'Full refund at least 5 days before check-in. Partial refund within 5 days of check-in.',
 5, 1, 50, 0, true, 2,
 '{"ar": {"label": "معتدل", "description": "استرداد كامل قبل 5 أيام على الأقل من تسجيل الوصول. استرداد جزئي خلال 5 أيام من تسجيل الوصول."}}'::jsonb),

('limited', 'Limited',
 'Full refund at least 14 days before check-in. Partial refund 7-14 days before check-in.',
 14, 7, 50, 7, true, 3,
 '{"ar": {"label": "محدود", "description": "استرداد كامل قبل 14 يومًا على الأقل من تسجيل الوصول. استرداد جزئي قبل 7-14 يومًا من تسجيل الوصول."}}'::jsonb),

('firm', 'Firm',
 'Full refund at least 30 days before check-in. Partial refund 7-30 days before check-in.',
 30, 7, 50, 7, true, 4,
 '{"ar": {"label": "صارم", "description": "استرداد كامل قبل 30 يومًا على الأقل من تسجيل الوصول. استرداد جزئي قبل 7-30 يومًا من تسجيل الوصول."}}'::jsonb);
;
