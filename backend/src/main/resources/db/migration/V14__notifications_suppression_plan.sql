-- Supprimer un plan (ou une de ses lignes) échouait dès qu'une notification y faisait
-- référence : c'est le cas de tout plan validé. Les notifications d'un plan supprimé
-- n'ont plus d'objet : elles sont supprimées avec lui.
ALTER TABLE notifications DROP CONSTRAINT notifications_plan_id_fkey;
ALTER TABLE notifications ADD CONSTRAINT notifications_plan_id_fkey
    FOREIGN KEY (plan_id) REFERENCES plans_reattribution(id) ON DELETE CASCADE;

ALTER TABLE notifications DROP CONSTRAINT notifications_ligne_plan_id_fkey;
ALTER TABLE notifications ADD CONSTRAINT notifications_ligne_plan_id_fkey
    FOREIGN KEY (ligne_plan_id) REFERENCES lignes_plan(id) ON DELETE CASCADE;
