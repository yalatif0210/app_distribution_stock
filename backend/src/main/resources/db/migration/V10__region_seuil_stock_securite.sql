ALTER TABLE regions ADD COLUMN IF NOT EXISTS seuil_stock_securite_msd DECIMAL(4,1) DEFAULT 2.0;
UPDATE regions SET seuil_stock_securite_msd = 2.0 WHERE seuil_stock_securite_msd IS NULL;
ALTER TABLE regions ALTER COLUMN seuil_stock_securite_msd SET NOT NULL;
