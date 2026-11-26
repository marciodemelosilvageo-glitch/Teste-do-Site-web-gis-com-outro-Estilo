import React, { useState } from 'react';
import {
  RefreshCw,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import {
  AdminCard,
  SectionHeader,
  StatusDot
} from './ui';

interface AdminSystemSectionProps {
  isMaster: boolean;
  isManager?: boolean;
  onRefreshData: () => void | Promise<void>;
  onClearLogs: () => void;
  showToast: (msg: string) => void;
  totalLogsCount: number;
  totalSessionsCount: number;
  totalUsersCount: number;
}

export const AdminSystemSection: React.FC<AdminSystemSectionProps> = ({
  isMaster,
  onRefreshData,
  onClearLogs,
  showToast,
  totalLogsCount,
  totalSessionsCount,
  totalUsersCount
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showClearLogsConfirm, setShowClearLogsConfirm] = useState(false);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshData();
      showToast('Dados e permissões do sistema sincronizados com sucesso.');
    } catch {
      showToast('Erro ao sincronizar dados.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleConfirmClearLogs = () => {
    onClearLogs();
    setShowClearLogsConfirm(false);
    showToast('Histórico de logs de auditoria foi limpo.');
  };

  const isSupabaseConfigured = Boolean(supabase);

  return (
    <div className="space-y-6">
      {/* Informações da Plataforma (exclusivo Master) */}
      {isMaster && (
        <div className="space-y-2">
          <SectionHeader title="Informações do Ambiente" />

          <AdminCard className="p-0 overflow-hidden">
            <div className="divide-y divide-black/[0.06] dark:divide-white/[0.08]">
              {/* Linha 1: Versão */}
              <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs">
                <span className="text-[#6C6C70] dark:text-[#98989D]">Versão da Aplicação</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900 dark:text-white">WebGIS v1.0.0</span>
                  <span className="text-xs text-[#6C6C70] dark:text-[#98989D]">• Produção</span>
                </div>
              </div>

              {/* Linha 2: Banco de Dados */}
              <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs">
                <span className="text-[#6C6C70] dark:text-[#98989D]">Banco de Dados & Autenticação</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900 dark:text-white">Supabase</span>
                  <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                    <StatusDot status={isSupabaseConfigured ? 'online' : 'warning'} />
                    <span>{isSupabaseConfigured ? 'Conectado (RLS ativo)' : 'Offline'}</span>
                  </div>
                </div>
              </div>

              {/* Linha 3: Criptografia */}
              <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs">
                <span className="text-[#6C6C70] dark:text-[#98989D]">Segurança e Criptografia</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900 dark:text-white">SHA-256</span>
                  <span className="text-xs text-[#6C6C70] dark:text-[#98989D]">• Hash protegido</span>
                </div>
              </div>

              {/* Métricas do Sistema */}
              <div className="p-4 bg-black/[0.02] dark:bg-white/[0.02] grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <div className="text-xs text-[#6C6C70] dark:text-[#98989D]">Contas</div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">{totalUsersCount}</div>
                </div>
                <div>
                  <div className="text-xs text-[#6C6C70] dark:text-[#98989D]">Sessões</div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">{totalSessionsCount}</div>
                </div>
                <div>
                  <div className="text-xs text-[#6C6C70] dark:text-[#98989D]">Logs</div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">{totalLogsCount}</div>
                </div>
              </div>
            </div>
          </AdminCard>
        </div>
      )}

      {/* Ações de Manutenção / Sincronização */}
      <div className="space-y-2">
        {isMaster && <SectionHeader title="Ações de Manutenção" />}

        <AdminCard className="p-0 overflow-hidden">
          <div className="divide-y divide-black/[0.06] dark:divide-white/[0.08]">
            {/* Ação 1: Sincronizar e Recarregar */}
            <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
              <div className="min-w-0">
                <div className="font-semibold text-slate-900 dark:text-white">
                  Sincronizar Dados e Permissões
                </div>
                <div className="text-xs text-[#6C6C70] dark:text-[#98989D] mt-0.5">
                  Recarrega as permissões de camadas, ferramentas e usuários a partir do banco de dados.
                </div>
              </div>

              <button
                type="button"
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#007AFF] hover:bg-[#007AFF]/90 active:scale-95 text-white text-xs font-semibold flex items-center gap-2 transition-all shrink-0 cursor-pointer disabled:opacity-40"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Sincronizando...' : 'Sincronizar'}</span>
              </button>
            </div>

            {/* Ação 2: Limpar Logs de Auditoria (exclusivo Master) */}
            {isMaster && (
              <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 dark:text-white">
                    Limpar Histórico de Auditoria
                  </div>
                  <div className="text-xs text-[#6C6C70] dark:text-[#98989D] mt-0.5">
                    Esvazia a lista de registros de logs armazenados. Recomendado exportar o CSV antes de limpar.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowClearLogsConfirm(true)}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.1] text-[#FF3B30] text-xs font-semibold flex items-center gap-2 transition-all shrink-0 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Limpar Logs</span>
                </button>
              </div>
            )}
          </div>
        </AdminCard>
      </div>

      {/* Modal de Confirmação para Limpar Logs no Estilo Apple */}
      {showClearLogsConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/[0.08] dark:border-white/[0.12] p-5 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-black/[0.04] dark:bg-white/[0.08] text-[#FF3B30] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-[17px] font-semibold text-slate-900 dark:text-white">
                  Limpar Logs de Auditoria?
                </h3>
                <p className="text-xs text-[#6C6C70] dark:text-[#98989D] leading-relaxed">
                  Esta ação removerá todos os registros de histórico de atividades. Tem certeza de que deseja continuar?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/[0.08] dark:border-white/[0.08]">
              <button
                type="button"
                onClick={() => setShowClearLogsConfirm(false)}
                className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold text-[#6C6C70] dark:text-[#98989D] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmClearLogs}
                className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold bg-[#FF3B30] hover:bg-[#FF3B30]/90 text-white cursor-pointer shadow-xs active:scale-95 transition-all"
              >
                Sim, Limpar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
