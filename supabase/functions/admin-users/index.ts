// supabase/functions/admin-users/index.ts
// Edge Function do Supabase para administração segura de usuários com Service Role Key
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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

    // 1. Cliente com token do chamador para validar identidade
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

    // 2. Cliente com Service Role para executar operações administrativas
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Buscar perfil do chamador para verificar papel e permissões
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
    const isManager = callerProfile.role === "manager";

    if (!isMaster && !isManager) {
      return new Response(JSON.stringify({ error: "Acesso negado: permissão de administrador ou gerente necessária" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, payload } = await req.json();

    // ==========================================
    // AÇÃO: CRIAR NOVO USUÁRIO
    // ==========================================
    if (action === "create_user") {
      const { username, password, name, role, department, managerPermissions, customPermissions } = payload;

      if (!username || !password || !name) {
        return new Response(JSON.stringify({ error: "Preencha todos os campos obrigatórios (login, senha e nome)" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (isManager) {
        if (callerProfile.manager_permissions?.allowGenerateLogins === false) {
          return new Response(JSON.stringify({ error: "O Administrador Master não liberou permissão para você gerar logins" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (role !== "user" && !(role === "manager" && callerProfile.manager_permissions?.canCreateManagerRole)) {
          return new Response(JSON.stringify({ error: "Gerentes só podem criar usuários comuns" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const syntheticEmail = `${username.toLowerCase().trim()}@usuarios.webgis`;

      // 1. Criação no Supabase Auth com senha com hash seguro
      const { data: authCreated, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: syntheticEmail,
        password: password.trim(),
        email_confirm: true,
        user_metadata: { name, username: username.toLowerCase().trim() },
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
          role: role || "user",
          department: department ? department.trim() : "",
          is_active: true,
          must_change_password: true, // Obriga a troca no primeiro acesso
          created_by: callerProfile.username || callerProfile.name,
          manager_permissions: role === "manager" ? managerPermissions : null,
          custom_layer_permissions: customPermissions?.layers || null,
          custom_feature_permissions: customPermissions?.features || null,
          custom_address_columns_permissions: customPermissions?.addressColumns || null,
          custom_feature_properties_permissions: customPermissions?.featureProperties || null,
        })
        .select()
        .single();

      if (insertProfileError) {
        // Rollback do usuário de auth se falhar
        await supabaseAdmin.auth.admin.deleteUser(authCreated.user.id);
        return new Response(JSON.stringify({ error: insertProfileError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, profile: newProfile }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==========================================
    // AÇÃO: RESETAR SENHA DE USUÁRIO
    // ==========================================
    if (action === "reset_password") {
      const { userId, newPassword } = payload;

      if (!newPassword || newPassword.trim().length < 4) {
        return new Response(JSON.stringify({ error: "A nova senha deve ter no mínimo 4 caracteres" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (isManager) {
        if (!callerProfile.manager_permissions?.allowChangePasswords) {
          return new Response(JSON.stringify({ error: "Você não possui permissão para alterar senhas de usuários" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data: targetUser } = await supabaseAdmin.from("profiles").select("created_by, role").eq("id", userId).single();
        if (!targetUser || targetUser.created_by !== callerProfile.username || targetUser.role !== "user") {
          return new Response(JSON.stringify({ error: "Gerentes só podem alterar senhas de usuários criados por eles mesmos" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Atualiza a senha no Supabase Auth
      const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: newPassword.trim(),
      });

      if (resetError) {
        return new Response(JSON.stringify({ error: resetError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Marca para obrigar a troca no primeiro login
      await supabaseAdmin.from("profiles").update({ must_change_password: true }).eq("id", userId);

      return new Response(JSON.stringify({ success: true, message: "Senha redefinida com sucesso" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==========================================
    // AÇÃO: ATIVAR / BLOQUEAR CONTA
    // ==========================================
    if (action === "toggle_status") {
      const { userId, isActive } = payload;
      if (!isMaster) {
        return new Response(JSON.stringify({ error: "Apenas o Administrador Master pode ativar ou desativar contas" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updError } = await supabaseAdmin.from("profiles").update({ is_active: isActive }).eq("id", userId);
      if (updError) {
        return new Response(JSON.stringify({ error: updError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==========================================
    // AÇÃO: EXCLUIR CONTA
    // ==========================================
    if (action === "delete_user") {
      const { userId } = payload;
      if (!isMaster) {
        return new Response(JSON.stringify({ error: "Apenas o Administrador Master pode excluir contas" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: delError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (delError) {
        return new Response(JSON.stringify({ error: delError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==========================================
    // AÇÃO: ATUALIZAR PERFIL / PERMISSÕES (MASTER)
    // ==========================================
    if (action === "update_user") {
      const { userId, updates } = payload;
      if (!isMaster) {
        return new Response(JSON.stringify({ error: "Apenas o Administrador Master pode editar permissões de usuários" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: updatedProfile, error: updError } = await supabaseAdmin
        .from("profiles")
        .update({
          name: updates.name,
          role: updates.role,
          department: updates.department,
          manager_permissions: updates.managerPermissions,
          custom_layer_permissions: updates.customLayerPermissions,
          custom_feature_permissions: updates.customFeaturePermissions,
          custom_address_columns_permissions: updates.customAddressColumnsPermissions,
          custom_feature_properties_permissions: updates.customFeaturePropertiesPermissions,
          has_custom_permissions: updates.hasCustomPermissions,
          updated_at: new Date().toISOString()
        })
        .eq("id", userId)
        .select()
        .single();

      if (updError) {
        return new Response(JSON.stringify({ error: updError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, profile: updatedProfile }), {
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
