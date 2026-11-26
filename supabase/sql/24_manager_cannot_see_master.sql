-- ==============================================================================
-- SCRIPT 24: OCULTAR COMPLETAMENTE O MASTER DO GERENTE EM LOGS E AUDITORIA
-- ==============================================================================
-- 1. webgis_logs (logs_select_isolated):
--    - is_master(): continua lendo tudo.
--    - is_manager(): só lê se tiver o poder 'admin:panel:access' (via public.can)
--      e somente entradas próprias ou de usuários permitidos por can_manage_target,
--      excluindo qualquer registro cujo autor ou user_role seja master/admin.
--    - Usuário comum (NOT is_manager()): continua lendo apenas actor_id = auth.uid().
-- 2. capability_audit_logs (capability_audit_select_admin):
--    - is_master(): continua lendo tudo.
--    - is_manager(): só lê se tiver 'admin:panel:access', apenas entradas próprias
--      ou de usuários gerenciados por can_manage_target, nunca onde o autor
--      (performed_by) ou o alvo (target_id) seja master/admin.
-- ==============================================================================

BEGIN;

-- 1. webgis_logs
DROP POLICY IF EXISTS "logs_select_isolated" ON public.webgis_logs;
CREATE POLICY "logs_select_isolated" ON public.webgis_logs
FOR SELECT TO authenticated
USING (
  public.is_master()
  OR (
    public.is_manager()
    AND public.can('admin:panel:access')
    AND (
      actor_id = auth.uid()
      OR (
        actor_id IS NOT NULL
        AND public.can_manage_target(auth.uid(), actor_id)
        AND COALESCE(lower(user_role), '') NOT IN ('master', 'admin')
      )
    )
  )
  OR (
    NOT public.is_manager()
    AND actor_id = auth.uid()
  )
);

-- 2. capability_audit_logs
DROP POLICY IF EXISTS "capability_audit_select_admin" ON public.capability_audit_logs;
CREATE POLICY "capability_audit_select_admin" ON public.capability_audit_logs
FOR SELECT TO authenticated
USING (
  public.is_master()
  OR (
    public.is_manager()
    AND public.can('admin:panel:access')
    AND (
      performed_by = auth.uid()
      OR (
        (
          performed_by IS NULL
          OR NOT EXISTS (
            SELECT 1 FROM public.profiles pm
            WHERE pm.id = performed_by
              AND lower(pm.role) IN ('master', 'admin')
          )
        )
        AND lower(COALESCE(performed_by_name, '')) NOT LIKE '%master%'
        AND lower(COALESCE(target_id, '')) NOT IN ('master', 'role:master', 'admin', 'role:admin')
        AND (
          (
            target_type = 'user'
            AND EXISTS (
              SELECT 1 FROM public.profiles pt
              WHERE (lower(pt.username) = lower(target_id) OR pt.id::text = target_id)
                AND lower(pt.role) NOT IN ('master', 'admin')
                AND public.can_manage_target(auth.uid(), pt.id)
            )
          )
          OR (
            target_type IN ('base_role', 'global')
            AND performed_by = auth.uid()
          )
        )
      )
    )
  )
);

COMMIT;
