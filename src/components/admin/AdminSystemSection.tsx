import React, { useState } from 'react';
import {
  Settings,
  Database,
  RefreshCw,
  Trash2,
  ShieldCheck,
  CheckCircle2,
  HardDrive,
  Info,
  AlertTriangle,
  Lock
} from 'lucide-react';
import { supabase } from '../../supabaseClient';

interface AdminSystemSectionProps {
  onRefreshData: () => void;
  onClearLogs: () => void;
  showToast: (msg: string) => void;
  totalLogsCount: number;
  totalSessionsCount: number;
  totalUsersCount: number;
}

export const AdminSystemSection: React.FC<AdminSystemSectionProps> = ({
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
    } catch (e) {
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
    <div className="space-y-5 animate-fadeIn">
      {/* Cabeçalho */}
      <div className="pb-1 border-b border-black/[0.04] dark:border-white/[0.06]">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          Sistema e Manutenção
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Diagnósticos da infraestrutura do WebGIS e operações administrativas exclusivas do Administrador Master.
        </p>
      </div>

      {/* Informações da Plataforma */}
      <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] p-4 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <Info className="w-4 h-4 text-blue-500" />
          <span>Informações do Ambiente</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 bg-black/[0.02] dark:bg-white/[0.02] rounded-xl">
            <div className="text-[11px] text-slate-400 dark:text-slate-500">Versão da Aplicação</div>
            <div className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">WebGIS v1.0.0</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Ambiente de Produção</div>
          </div>

          <div className="p-3 bg-black/[0.02] dark:bg-white/[0.02] rounded-xl">
            <div className="text-[11px] text-slate-400 dark:text-slate-500">Banco de Dados & Auth</div>
            <div className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5 flex items-center gap-1.5">
              <span>Supabase</span>
              {isSupabaseConfigured ? (
                <span className="w-2 h-2 rounded-full bg-emerald-500" title="Conectado" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-amber-500" title="Offline" />
              )}
            </div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">RLS e Edge Function ativos</div>
          </div>

          <div className="p-3 bg-black/[0.02] dark:bg-white/[0.02] rounded-xl">
            <div className="text-[11px] text-slate-400 dark:text-slate-500">Segurança de Dados</div>
            <div className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">Criptografia SHA-256</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Senhas protegidas em hash</div>
          </div>
        </div>

        <div className="pt-2 border-t border-black/[0.04] dark:border-white/[0.04] grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <span className="text-slate-400 dark:text-slate-500 text-[11px]">Contas: </span>
            <span className="font-bold text-slate-700 dark:text-slate-200">{totalUsersCount}</span>
          </div>
          <div>
            <span className="text-slate-400 dark:text-slate-500 text-[11px]">Sessões: </span>
            <span className="font-bold text-slate-700 dark:text-slate-200">{totalSessionsCount}</span>
          </div>
          <div>
            <span className="text-slate-400 dark:text-slate-500 text-[11px]">Logs: </span>
            <span className="font-bold text-slate-700 dark:text-slate-200">{totalLogsCount}</span>
          </div>
        </div>
      </div>

      {/* Ações de Manutenção Seguras */}
      <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] p-4 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <HardDrive className="w-4 h-4 text-slate-500" />
          <span>Ações de Manutenção do Sistema</span>
        </div>

        <div className="space-y-3">
          {/* Ação 1: Sincronizar e Recarregar */}
          <div className="p-3 bg-black/[0.02] dark:bg-white/[0.02] rounded-xl flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Sincronizar Dados e Permissões
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Recarrega as permissões de camadas, ferramentas e usuários a partir do Supabase.
              </div>
            </div>

            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Sincronizando...' : 'Sincronizar'}</span>
            </button>
          </div>

          {/* Ação 2: Limpar Logs de Auditoria */}
          <div className="p-3 bg-black/[0.02] dark:bg-white/[0.02] rounded-xl flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Limpar Histórico de Auditoria
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Esvazia a lista de registros de logs armazenados. Recomendado exportar o CSV antes de limpar.
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowClearLogsConfirm(true)}
              className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/70 border border-rose-200 dark:border-rose-900/60 text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpar Logs</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Confirmação para Limpar Logs */}
      {showClearLogsConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/10 dark:border-white/10 p-5 space-y-4 shadow-xl animate-scaleUp">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Limpar Logs de Auditoria?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Esta ação removerá todos os registros de histórico de atividades. Tem certeza de que deseja continuar?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/[0.04] dark:border-white/[0.04]">
              <button
                type="button"
                onClick={() => setShowClearLogsConfirm(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmClearLogs}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-xs"
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
