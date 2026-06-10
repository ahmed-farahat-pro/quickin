INSERT INTO attributes (code, label, category_id, type_id, icon_class, is_highlighted, is_approved, is_enabled, is_filterable)
VALUES 
('beach_access', 'Beach Access', '4a730e84-9006-4b20-8f15-42a5345e54da', '5659ec98-5333-428f-8834-3473879d91a5', 'lucide:waves', true, true, true, true),
('garden', 'Garden', '4a730e84-9006-4b20-8f15-42a5345e54da', '5659ec98-5333-428f-8834-3473879d91a5', 'lucide:flower-2', true, true, true, true),
('hot_tub', 'Hot Tub', 'f3293592-76d5-4813-b123-a57b5b800b7a', '5659ec98-5333-428f-8834-3473879d91a5', 'lucide:droplets', true, true, true, true),
('fireplace', 'Fireplace', 'f3293592-76d5-4813-b123-a57b5b800b7a', '5659ec98-5333-428f-8834-3473879d91a5', 'lucide:flame', true, true, true, true),
('boat_dock', 'Boat Dock', '0bd971df-2c44-4b0c-9fa7-1b2ba696f6ea', '5659ec98-5333-428f-8834-3473879d91a5', 'lucide:anchor', true, true, true, true)
ON CONFLICT (code) DO NOTHING;;
