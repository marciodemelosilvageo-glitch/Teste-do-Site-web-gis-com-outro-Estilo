// supabase/functions/admin-users/index.ts
// Edge Function do Supabase para administração segura de usuários com Service Role Key
// Atualizada com o Catálogo Unificado de Poderes, Delegação Granular (can_grant) e Proteção do Master
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
  "Access-Control-Max-Age": "86400",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Token de autorização não fornecido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Cliente com token do chamador para validar sessão e identidade
    const supabaseCaller = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerUser }, error: callerError } = await supabaseCaller.auth.getUser();
    if (callerError || !callerUser) {
      return new Response(JSON.stringify({ error: "Sessão inválida ou expirada" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Cliente com Service Role para executar operações administrativas e consultas seguras
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Buscar perfil do chamador
    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", callerUser.id)
      .single();

    if (profileError || !callerProfile || !callerProfile.is_active) {
      return new Response(JSON.stringify({ error: "Perfil não encontrado ou conta desativada" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isMaster = callerProfile.role === "master";

    // Funções auxiliares de checagem no Banco
    const checkCan = async (capabilityKey: string): Promise<boolean> => {
      if (isMaster) return true;
      const { data, error } = await supabaseAdmin.rpc("can", {
        p_capability: capabilityKey,
        p_user_id: callerUser.id,
      });
      return !error && data === true;
    };

    const checkCanGrant = async (capabilityKey: string): Promise<boolean> => {
      if (isMaster) return true;
      const { data, error } = await supabaseAdmin.rpc("can_grant", {
        p_capability: capabilityKey,
        p_user_id: callerUser.id,
      });
      return !error && data === true;
    };

    const checkCanManageTarget = async (targetUserId: string): Promise<boolean> => {
      if (isMaster) {
        // Se o alvo for master e NÃO for o próprio chamador, nem outro master pode alterar!
        const { data: target } = await supabaseAdmin
          .from("profiles")
          .select("role")
          .eq("id", targetUserId)
          .maybeSingle();
        if (target && target.role === "master" && targetUserId !== callerUser.id) {
          return false;
        }
        return true;
      }
      const { data, error } = await supabaseAdmin.rpc("can_manage_target", {
        p_manager_id: callerUser.id,
        p_target_user_id: targetUserId,
      });
      return !error && data === true;
    };

    const logAudit = async (entry: {
      targetType: "user" | "base_role" | "global";
      targetId: string;
      capabilityKey: string;
      action: "grant_use" | "revoke_use" | "grant_delegate" | "revoke_delegate" | "set_deny" | "remove_override";
      beforeState?: any;
      afterState?: any;
      reason?: string;
    }) => {
      await supabaseAdmin.from("capability_audit_logs").insert({
        performed_by: callerUser.id,
        performed_by_name: callerProfile.name || callerProfile.username,
        target_type: entry.targetType,
        target_id: entry.targetId,
        capability_key: entry.capabilityKey,
        action: entry.action,
        before_state: entry.beforeState || null,
        after_state: entry.afterState || null,
        reason: entry.reason || null,
      });
    };

    const { action, payload } = await req.json();

    // ==========================================
    // AÇÃO: CRIAR NOVO USUÁRIO
    // ==========================================
    if (action === "create_user") {
      const hasPerm = await checkCan("admin:users:create");
      if (!hasPerm) {
        return new Response(JSON.stringify({ error: "Acesso negado: Você não possui permissão para criar usuários" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { username, password, name, role = "user", department, customCapabilities = [] } = payload;

      if (!username || !password || !name) {
        return new Response(JSON.stringify({ error: "Preencha todos os campos obrigatórios (login, senha e nome)" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (password.trim().length < 8) {
        return new Response(JSON.stringify({ error: "A senha inicial deve ter no mínimo 8 caracteres" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validações de papel
      if (role === "master" && !isMaster) {
        return new Response(JSON.stringify({ error: "Apenas um Administrador Master pode criar outro Master" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (role === "manager") {
        const canPromote = await checkCan("admin:users:promote_manager");
        if (!canPromote) {
          return new Response(JSON.stringify({ error: "Você não possui permissão para criar contas com o papel de Gerente" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Validação estrita de repasse: Ninguém pode repassar o que não tem can_grant!
      if (!isMaster && Array.isArray(customCapabilities) && customCapabilities.length > 0) {
        for (const cap of customCapabilities) {
          const capKey = typeof cap === "string" ? cap : cap.key;
          const allowedToGrant = await checkCanGrant(capKey);
          if (!allowedToGrant) {
            return new Response(
              JSON.stringify({ error: `Você não possui permissão para repassar a capacidade: "${capKey}"` }),
              { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      }

      const syntheticEmail = `${username.toLowerCase().trim()}@usuarios.webgis`;

      // 1. Criação no Supabase Auth com senha hash segura
      const { data: authCreated, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: syntheticEmail,
        password: password.trim(),
        email_confirm: true,
        user_metadata: { name: name.trim(), username: username.toLowerCase().trim() },
      });

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 2. Inserção do perfil na tabela public.profiles
      const { data: newProfile, error: insertProfileError } = await supabaseAdmin
        .from("profiles")
        .insert({
          id: authCreated.user.id,
          username: username.toLowerCase().trim(),
          name: name.trim(),
          role: role,
          department: department ? department.trim() : "",
          is_active: true,
          must_change_password: true,
          created_by: callerProfile.username || callerProfile.name,
        })
        .select()
        .single();

      if (insertProfileError) {
        await supabaseAdmin.auth.admin.deleteUser(authCreated.user.id);
        return new Response(JSON.stringify({ error: insertProfileError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 3. Se for Gerente, criar escopo inicial padrão (equipe dele)
      if (role === "manager") {
        await supabaseAdmin.from("user_delegation_scopes").insert({
          manager_id: authCreated.user.id,
          scope_type: "team_only",
          updated_by: callerUser.id,
        });
      }

      // 4. Inserir capacidades individuais concedidas (se houver)
      if (Array.isArray(customCapabilities) && customCapabilities.length > 0) {
        const rowsToInsert = customCapabilities.map((cap: any) => ({
          user_id: authCreated.user.id,
          capability_key: typeof cap === "string" ? cap : cap.key,
          can_use: cap.can_use !== false,
          can_grant: cap.can_grant === true,
          effect: cap.effect || "allow",
          granted_by: callerUser.id,
        }));
        await supabaseAdmin.from("user_capabilities").insert(rowsToInsert);
      }

      // 5. Registrar na auditoria
      await logAudit({
        targetType: "user",
        targetId: authCreated.user.id,
        capabilityKey: `role:${role}`,
        action: "grant_use",
        afterState: { username, role, department },
        reason: "Criação de nova conta de usuário",
      });

      return new Response(JSON.stringify({ success: true, profile: newProfile }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==========================================
    // AÇÃO: RESETAR SENHA DE USUÁRIO
    // ==========================================
    if (action === "reset_password") {
      const hasPerm = await checkCan("admin:users:reset_password");
      if (!hasPerm) {
        return new Response(JSON.stringify({ error: "Você não possui permissão para redefinir senhas" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { userId, newPassword } = payload;
      if (!newPassword || newPassword.trim().length < 8) {
        return new Response(JSON.stringify({ error: "A nova senha deve ter no mínimo 8 caracteres" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verificar alcance sobre o alvo
      const canManage = await checkCanManageTarget(userId);
      if (!canManage) {
        return new Response(
          JSON.stringify({ error: "Usuário alvo fora do seu alcance de gerenciamento ou é uma conta Master protegida" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Atualiza no Supabase Auth
      const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: newPassword.trim(),
      });

      if (resetError) {
        return new Response(JSON.stringify({ error: resetError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Obriga a troca no próximo acesso
      await supabaseAdmin.from("profiles").update({ must_change_password: true }).eq("id", userId);

      await logAudit({
        targetType: "user",
        targetId: userId,
        capabilityKey: "account:change_own_password",
        action: "grant_use",
        reason: "Redefinição de senha provisória pelo painel administrativo",
      });

      return new Response(JSON.stringify({ success: true, message: "Senha redefinida com sucesso" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==========================================
    // AÇÃO: ATIVAR / BLOQUEAR CONTA
    // ==========================================
    if (action === "toggle_status") {
      const hasPerm = await checkCan("admin:users:block");
      if (!hasPerm) {
        return new Response(JSON.stringify({ error: "Você não possui permissão para bloquear ou ativar contas" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { userId, isActive } = payload;

      const canManage = await checkCanManageTarget(userId);
      if (!canManage) {
        return new Response(
          JSON.stringify({ error: "Usuário alvo fora do seu alcance ou é uma conta Master protegida" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: updError } = await supabaseAdmin.from("profiles").update({ is_active: isActive }).eq("id", userId);
      if (updError) {
        return new Response(JSON.stringify({ error: updError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Se a conta for desativada/bloqueada, revoga as sessões no Supabase Auth via banimento
      if (!isActive) {
        try {
          await supabaseAdmin.auth.admin.updateUserById(userId, {
            ban_duration: "876000h", // Invalida tokens de refresh e derruba sessões
          });
        } catch (banErr) {
          console.warn("Erro ao revogar sessão de usuário no Auth:", banErr);
        }
      } else {
        // Ao reativar a conta, remove o banimento no Supabase Auth
        try {
          await supabaseAdmin.auth.admin.updateUserById(userId, {
            ban_duration: "none",
          });
        } catch (unbanErr) {
          console.warn("Erro ao remover banimento no Auth:", unbanErr);
        }
      }

      await logAudit({
        targetType: "user",
        targetId: userId,
        capabilityKey: "account:access",
        action: isActive ? "grant_use" : "revoke_use",
        afterState: { isActive },
        reason: isActive ? "Conta ativada" : "Conta bloqueada",
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==========================================
    // AÇÃO: EXCLUIR CONTA
    // ==========================================
    if (action === "delete_user") {
      const hasPerm = await checkCan("admin:users:delete");
      if (!hasPerm) {
        return new Response(JSON.stringify({ error: "Você não possui permissão para excluir contas" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { userId } = payload;

      const canManage = await checkCanManageTarget(userId);
      if (!canManage) {
        return new Response(
          JSON.stringify({ error: "Usuário alvo fora do seu alcance ou é uma conta Master protegida" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: delError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (delError) {
        return new Response(JSON.stringify({ error: delError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await logAudit({
        targetType: "user",
        targetId: userId,
        capabilityKey: "account:lifecycle",
        action: "revoke_use",
        reason: "Conta excluída permanentemente",
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==========================================
    // AÇÃO: CONCEDER OU ALTERAR CAPACIDADES DE USUÁRIO
    // ==========================================
    if (action === "update_user_capabilities") {
      const { targetUserId, capabilities } = payload;

      if (!targetUserId || !Array.isArray(capabilities)) {
        return new Response(JSON.stringify({ error: "Parâmetros inválidos" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const canManage = await checkCanManageTarget(targetUserId);
      if (!canManage) {
        return new Response(
          JSON.stringify({ error: "Usuário alvo fora do seu alcance ou é uma conta Master protegida" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validação de can_grant para cada capacidade modificada
      if (!isMaster) {
        for (const cap of capabilities) {
          const allowedToGrant = await checkCanGrant(cap.key);
          if (!allowedToGrant) {
            return new Response(
              JSON.stringify({ error: `Você não possui autorização para delegar a capacidade: "${cap.key}"` }),
              { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      }

      // Aplicar cada alteração
      for (const cap of capabilities) {
        if (cap.removeOverride) {
          await supabaseAdmin
            .from("user_capabilities")
            .delete()
            .eq("user_id", targetUserId)
            .eq("capability_key", cap.key);

          await logAudit({
            targetType: "user",
            targetId: targetUserId,
            capabilityKey: cap.key,
            action: "remove_override",
            reason: "Removida exceção individual (retornou ao perfil base)",
          });
        } else {
          await supabaseAdmin.from("user_capabilities").upsert({
            user_id: targetUserId,
            capability_key: cap.key,
            can_use: cap.can_use !== false,
            can_grant: cap.can_grant === true,
            effect: cap.effect || "allow",
            granted_by: callerUser.id,
            updated_at: new Date().toISOString(),
          });

          await logAudit({
            targetType: "user",
            targetId: targetUserId,
            capabilityKey: cap.key,
            action: cap.effect === "deny" ? "set_deny" : "grant_use",
            afterState: cap,
            reason: "Alteração de capacidade individual do usuário",
          });
        }
      }

      return new Response(JSON.stringify({ success: true, message: "Capacidades atualizadas com sucesso" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==========================================
    // AÇÃO: EDITAR PODERES DE PERFIL BASE (MASTER)
    // ==========================================
    if (action === "update_role_capabilities") {
      const hasPerm = await checkCan("admin:roles:manage");
      if (!hasPerm) {
        return new Response(
          JSON.stringify({ error: "Apenas o Administrador Master pode gerenciar os poderes dos perfis base" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { roleId, capabilities } = payload;
      if (!roleId || !Array.isArray(capabilities)) {
        return new Response(JSON.stringify({ error: "Parâmetros inválidos" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      for (const cap of capabilities) {
        await supabaseAdmin.from("role_capabilities").upsert({
          role_id: roleId,
          capability_key: cap.key,
          can_use: cap.can_use !== false,
          can_grant: cap.can_grant === true,
          effect: cap.effect || "allow",
          updated_at: new Date().toISOString(),
        });

        await logAudit({
          targetType: "base_role",
          targetId: roleId,
          capabilityKey: cap.key,
          action: cap.effect === "deny" ? "set_deny" : "grant_use",
          afterState: cap,
          reason: `Atualização de poderes do perfil base ${roleId}`,
        });
      }

      return new Response(JSON.stringify({ success: true, message: "Perfil base atualizado com sucesso" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==========================================
    // AÇÃO: CONSULTAR PODERES EFETIVOS
    // ==========================================
    if (action === "get_effective_capabilities") {
      const { targetUserId } = payload || {};
      const queryUserId = targetUserId || callerUser.id;

      const { data, error } = await supabaseAdmin.rpc("get_effective_capabilities", {
        p_user_id: queryUserId,
      });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, capabilities: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação não reconhecida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "Erro interno do servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
