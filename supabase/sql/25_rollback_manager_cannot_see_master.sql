-- ==============================================================================
-- SCRIPT 25 (ROLLBACK DO 24): RESTAURAR POLICIES ORIGINAIS DE LOGS E AUDITORIA
-- ==============================================================================
-- Restaura exatamente as policies de SELECT de webgis_logs e capability_audit_logs
-- definidas no script 18_security_hardening_rls_and_access.sql.
-- ==============================================================================

BEGIN;

DROP POLICY IF EXISTS "logs_select_isolated" ON public.webgis_logs;
CREATE POLICY "logs_select_isolated" ON public.webgis_logs
FOR SELECT TO authenticated
USING (
  actor_id = auth.uid()
  OR public.is_master()
  OR public.is_manager()
);

DROP POLICY IF EXISTS "capability_audit_select_admin" ON public.capability_audit_logs;
CREATE POLICY "capability_audit_select_admin" ON public.capability_audit_logs
FOR SELECT TO authenticated
USING (public.is_master() OR public.is_manager());

COMMIT;
