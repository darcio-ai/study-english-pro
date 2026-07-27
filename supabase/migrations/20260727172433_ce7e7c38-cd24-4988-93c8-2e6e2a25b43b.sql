ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en';
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en';
ALTER TABLE public.reading_texts ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en';
ALTER TABLE public.user_progress ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'en';

CREATE INDEX IF NOT EXISTS lessons_lang_track_level_idx ON public.lessons (language, track, level);
CREATE INDEX IF NOT EXISTS exercises_lang_track_level_idx ON public.exercises (language, track, level);
CREATE INDEX IF NOT EXISTS exercises_lang_mode_level_idx ON public.exercises (language, mode, level);
CREATE INDEX IF NOT EXISTS reading_texts_lang_track_level_idx ON public.reading_texts (language, track, level);