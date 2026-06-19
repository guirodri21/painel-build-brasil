-- ============================================================
-- Build Brasil — MIGRATION 05: Agendamento de ordens
-- ============================================================
ALTER TABLE ordens ADD COLUMN IF NOT EXISTS data_agendada date;
ALTER TABLE ordens ADD COLUMN IF NOT EXISTS hora_agendada time;
CREATE INDEX IF NOT EXISTS idx_ordens_agenda ON ordens (data_agendada);
