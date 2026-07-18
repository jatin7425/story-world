-- AI-assisted age/content rating per story, shown to readers as an
-- informational badge (not an access gate — the site doesn't collect user
-- age, so this can't be enforced, only disclosed).
ALTER TABLE stories ADD COLUMN age_rating TEXT; -- 'all' | '13+' | '16+' | '18+'
ALTER TABLE stories ADD COLUMN age_rating_reason TEXT; -- short AI-written justification, shown to admin
ALTER TABLE stories ADD COLUMN age_rating_source TEXT; -- 'ai' | 'admin' (admin can override the AI's suggestion)
