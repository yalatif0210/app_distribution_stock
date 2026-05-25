-- Remplace la contrainte unique sur code seul par une contrainte composite (code, programme_id)
-- Deux produits peuvent avoir le même code s'ils appartiennent à des programmes différents
ALTER TABLE produits DROP CONSTRAINT IF EXISTS produits_code_key;
ALTER TABLE produits ADD CONSTRAINT produits_code_programme_unique UNIQUE (code, programme_id);
