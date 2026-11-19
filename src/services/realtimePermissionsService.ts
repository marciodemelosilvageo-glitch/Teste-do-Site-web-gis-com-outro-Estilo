import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';
import { resetRpcCapabilitiesCheck } from './adminService';

export interface RealtimeSubscriptionOptions {
  userId?: string;
  userRole?: string;
  onPermissionsUpdated: (info?: { scope?: string; reason?: string; newRole?: string }) => void;
  onAccountBlocked?: (reason?: string) => void;
}

// Estado singleton da assinatura Realtime
let activeChannel: RealtimeChannel | null = null;
let fallbackIntervalId: any = null;
let debounceTimeout: any = null;
let lastKnownEpochs: Record<string, number> = {};
let isCheckingEpoch = false;
let isEpochTableAvailable: boolean | null = (() => {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const val = sessionStorage.getItem('webgis_epoch_table_available');
      if (val === 'false') return false;
      if (val === 'true') return true;
    }
  } catch {}
  return null;
})();
let isIntentionalClose = false;

/**
 * Consulta leve e rápida de fallback (apenas contadores da tabela permissions_epoch)
 * Retorna no máximo 1 a 3 linhas com inteiros, sem baixar tabelas pesadas.
 */
export const checkEpochFallbackAsync = async (
  userId?: string,
  userRole?: string,
  onPermissionsUpdated?: (info?: { scope?: string; reason?: string }) => void
): Promise<boolean> => {
  if (isCheckingEpoch || isEpochTableAvailable === false) return false;
  isCheckingEpoch = true;

  try {
    const scopes = ['global'];
    if (userRole) scopes.push(`role:${userRole}`);
    if (userId) scopes.push(`user:${userId}`);

    const { data, error, status } = await supabase
      .from('permissions_epoch')
      .select('scope, epoch')
      .in('scope', scopes);

    if (error) {
      if (status === 404 || error.code === '42P01' || error.message?.includes('not found') || error.message?.includes('does not exist')) {
        isEpochTableAvailable = false;
        try { sessionStorage.setItem('webgis_epoch_table_available', 'false'); } catch {}
        console.info('ℹ️ [REALTIME] Tabela permissions_epoch não detectada no Supabase. O sistema está operando em modo defensivo.');
      }
      return false;
    }

    isEpochTableAvailable = true;
    try { sessionStorage.setItem('webgis_epoch_table_available', 'true'); } catch {}

    if (!Array.isArray(data)) {
      return false;
    }

    let hasNewVersion = false;
    let changedScope = 'global';

    data.forEach((row: { scope: string; epoch: number }) => {
      const prev = lastKnownEpochs[row.scope];
      if (prev !== undefined && row.epoch > prev) {
        hasNewVersion = true;
        changedScope = row.scope;
      }
      lastKnownEpochs[row.scope] = row.epoch;
    });

    if (hasNewVersion && onPermissionsUpdated) {
      console.info(`[REALTIME FALLBACK] Detectada nova versão de permissões no escopo "${changedScope}". Recarregando...`);
      resetRpcCapabilitiesCheck();
      onPermissionsUpdated({ scope: changedScope, reason: 'fallback_epoch' });
      return true;
    }
  } catch (err) {
    // Falha silenciosa de rede no fallback
  } finally {
    isCheckingEpoch = false;
  }

  return false;
};

/**
 * Assina o canal Supabase Realtime para propagação de poderes em ~1 segundo.
 * Monitora permissions_epoch (global, papel e usuário) e o registro do usuário em profiles.
 */
export const subscribeToPermissionsRealtime = (
  options: RealtimeSubscriptionOptions
): (() => void) => {
  const { userId, userRole, onPermissionsUpdated, onAccountBlocked } = options;

  // Limpeza de qualquer canal anterior
  unsubscribePermissionsRealtime();
  isIntentionalClose = false;

  // Executa uma primeira leitura dos contadores para estabelecer a linha de base (se a tabela estiver disponível)
  if (isEpochTableAvailable !== false) {
    checkEpochFallbackAsync(userId, userRole).catch(() => {});
  }

  const channelName = `webgis_perm_sync_${userId || 'visitor'}_${Date.now()}`;
  
  const triggerDebouncedUpdate = (info?: { scope?: string; reason?: string; newRole?: string }) => {
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }
    debounceTimeout = setTimeout(() => {
      resetRpcCapabilitiesCheck();
      onPermissionsUpdated(info);
    }, 150);
  };

  try {
    const channel = supabase.channel(channelName);

    // 1. Escuta mudanças na tabela permissions_epoch se ela estiver disponível ou ainda não testada
    if (isEpochTableAvailable !== false) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'permissions_epoch'
        },
        (payload: any) => {
          const record = payload.new || payload.old;
          const scope: string = record?.scope || '';
          const epoch: number = Number(record?.epoch) || 0;

          // Determina se a alteração é relevante para este cliente
          const isGlobal = scope === 'global';
          const isRole = userRole && (scope === `role:${userRole}` || scope === userRole);
          const isUser = userId && (scope === `user:${userId}` || scope === userId);

          if (isGlobal || isRole || isUser) {
            console.info(`⚡ [REALTIME] Permissões atualizadas no servidor (escopo: ${scope}, versão: ${epoch}) em tempo real!`);
            if (epoch > 0) {
              lastKnownEpochs[scope] = epoch;
            }
            triggerDebouncedUpdate({ scope, reason: 'realtime_epoch' });
          }
        }
      );
    }

    // 2. Se o usuário estiver autenticado, monitora seu registro em profiles para bloqueio imediato (is_active)
    if (userId) {
      channel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`
        },
        (payload: any) => {
          const newProfile = payload.new;
          if (!newProfile) return;

          // Se a conta foi inativada / suspensa pelo administrador: encerra a sessão na hora
          if (newProfile.is_active === false) {
            console.warn('🚨 [REALTIME] Conta de usuário desativada pelo Administrador!');
            if (onAccountBlocked) {
              onAccountBlocked('Conta desativada pelo Administrador');
            }
            return;
          }

          // Se o papel do usuário foi alterado (ex: promovido para gerente ou rebaixado)
          if (newProfile.role && newProfile.role !== userRole) {
            console.info(`⚡ [REALTIME] Papel do usuário alterado para "${newProfile.role}". Atualizando contexto...`);
            triggerDebouncedUpdate({ reason: 'role_changed', newRole: newProfile.role });
          }
        }
      );
    }

    // 3. Inscreve o canal e gerencia reconexão
    channel.subscribe((status: string, err?: any) => {
      if (status === 'SUBSCRIBED') {
        console.info(`🟢 [REALTIME] Conexão Realtime estabelecida com sucesso (${channelName}).`);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        if (!isIntentionalClose) {
          console.warn(`⚠️ [REALTIME] Status do canal: ${status}. Fallback leve ativo.`);
          if (err) console.warn(err);
        }
      } else if (status === 'CLOSED') {
        if (!isIntentionalClose) {
          console.warn(`⚠️ [REALTIME] Status do canal: CLOSED. Fallback leve ativo.`);
        }
      }
    });

    activeChannel = channel;

    // 4. Fallback leve periódico (a cada 45 segundos, apenas se tabela existir e aba visível)
    fallbackIntervalId = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden && isEpochTableAvailable !== false) {
        checkEpochFallbackAsync(userId, userRole, triggerDebouncedUpdate).catch(() => {});
      }
    }, 45000);

    // 5. Verificação rápida ao focar a aba, mudar visibilidade ou restabelecer conexão de rede
    const handleRecheck = () => {
      if (typeof document !== 'undefined' && !document.hidden && isEpochTableAvailable !== false) {
        checkEpochFallbackAsync(userId, userRole, triggerDebouncedUpdate).catch(() => {});
      }
    };

    window.addEventListener('focus', handleRecheck);
    document.addEventListener('visibilitychange', handleRecheck);
    window.addEventListener('online', handleRecheck);

    return () => {
      window.removeEventListener('focus', handleRecheck);
      document.removeEventListener('visibilitychange', handleRecheck);
      window.removeEventListener('online', handleRecheck);
      unsubscribePermissionsRealtime();
    };
  } catch (err) {
    console.warn('[REALTIME] Não foi possível inicializar canal Realtime. Fallback ativo:', err);
    return () => {};
  }
};

/**
 * Encerra a assinatura Realtime e limpa timers associados
 */
export const unsubscribePermissionsRealtime = () => {
  isIntentionalClose = true;
  if (debounceTimeout) {
    clearTimeout(debounceTimeout);
    debounceTimeout = null;
  }
  if (fallbackIntervalId) {
    clearInterval(fallbackIntervalId);
    fallbackIntervalId = null;
  }
  if (activeChannel) {
    try {
      supabase.removeChannel(activeChannel);
    } catch { }
    activeChannel = null;
  }
};
