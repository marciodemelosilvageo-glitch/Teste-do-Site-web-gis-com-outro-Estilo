-- ==============================================================================
-- SCRIPT 11: ROLLBACK DA FUNÇÃO RPC DE TELEMETRIA DE SESSÕES ATIVAS
-- ==============================================================================
-- Remove a função get_telemetry_active_sessions() criada pelo Script 10.
-- ==============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.get_telemetry_active_sessions();

NOTIFY pgrst, 'reload schema';

COMMIT;
