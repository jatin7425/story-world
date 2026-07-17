-- gender: the user's stated gender, NULL until they set it.
-- avatar_gender: a randomly pre-assigned fallback bucket ('male' | 'female')
-- used to pick a gender-appropriate placeholder avatar while `gender` is
-- unset, so nobody goes without an avatar. avatar_seed picks which numbered
-- portrait within that bucket; it's re-rolled whenever gender changes so the
-- picture visibly updates.
ALTER TABLE users ADD COLUMN gender TEXT;
ALTER TABLE users ADD COLUMN avatar_gender TEXT NOT NULL DEFAULT 'male';
ALTER TABLE users ADD COLUMN avatar_seed INTEGER NOT NULL DEFAULT 0;

UPDATE users SET
  avatar_gender = CASE WHEN ABS(RANDOM() % 2) = 0 THEN 'male' ELSE 'female' END,
  avatar_seed = ABS(RANDOM() % 100);
