ALTER TABLE music_training_tabs ADD COLUMN content_type TEXT DEFAULT 'image';
ALTER TABLE music_training_tabs ADD COLUMN exercise_data TEXT;
ALTER TABLE music_training_tabs ADD COLUMN target_bpm INTEGER;
ALTER TABLE music_training_tabs ADD COLUMN tuning TEXT;
