import React from 'react';
import {
  X,
  Crown,
  Briefcase,
  User,
  ShieldCheck,
  Calendar,
  Clock,
  Activity,
  Lock,
  Users
} from 'lucide-react';
import { RegisteredUser, ActivityLog } from '../../services/adminService';

interface AdminUserDetailModalProps {
  user: RegisteredUser | null;
  onClose: () => void;
  allUsers: RegisteredUser[];
  logs: ActivityLog[];
  isMaster: boolean;
}

export const AdminUserDetailModal: React.FC<AdminUserDetailModalProps> = ({
  user,
  onClose,
  allUsers,
  logs,
  isMaster
}) => {
  if (!user) return null;

  const isUserMaster = user.role === 'master' || (user.role as any) === 'admin';
  const isUserManager = user.role === 'manager';

  // Membros criados por este gerente (se for gerente)
  const teamMembers = allUsers.filter(u => 
    (u.createdBy || '').toLowerCase() === user.username.toLowerCase()
  );

  // Histórico de atividades recentes deste usuário
  const cleanUser = user.username.toLowerCase().replace(/^@/, '');
  const cleanName = user.name.toLowerCase();
  const cleanId = user.id.toLowerCase();

  const userLogs = logs.filter(l => {
    const sId = (l.sessionId || '').toLowerCase().replace(/^@/, '');
    const act = (l.action || '').toLowerCase();
    const det = (l.details || '').toLowerCase();
    return (
      sId === cleanUser ||
      sId.includes(cleanUser) ||
      sId === cleanId ||
      act.includes(cleanUser) ||
      det.includes(cleanUser) ||
      act.includes(cleanName) ||
      det.includes(cleanName)
    );
  }).slice(0, 8);

  return (
    <div className="fixed inset-0 z-[10000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div 
        className="w-full max-w-xl bg-white dark:bg-[#1c1c1e] rounded-3xl border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho da Ficha */}
        <div className="p-5 border-b border-black/[0.05] dark:border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-base shrink-0 shadow-xs ${
              isUserMaster
                ? 'bg-indigo-600 text-white'
                : isUserManager
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-700 text-white'
            }`}>
              {isUserMaster ? <Crown className="w-6 h-6" /> : isUserManager ? <Briefcase className="w-6 h-6" /> : user.name.charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                  {user.name}
                </h3>
                {isUserMaster ? (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300">
                    Master
                  </span>
                ) : isUserManager ? (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-teal-100 text-teal-700 dark:bg-teal-950/80 dark:text-teal-300">
                    Gerente
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    Usuário Comum
                  </span>
                )}
              </div>
              <p className="text-xs font-mono text-slate-400 dark:text-slate-500">
                @{user.username}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo com Rolagem */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Informações Cadastrais */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 bg-black/[0.02] dark:bg-white/[0.02] rounded-xl space-y-0.5">
              <span className="text-[10px] text-slate-400 font-medium">Departamento</span>
              <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">{user.department || 'Não informado'}</div>
            </div>

            <div className="p-3 bg-black/[0.02] dark:bg-white/[0.02] rounded-xl space-y-0.5">
              <span className="text-[10px] text-slate-400 font-medium">Status da Conta</span>
              <div className="font-semibold flex items-center gap-1.5">
                {user.isActive === false ? (
                  <span className="text-rose-600 dark:text-rose-400 font-bold">• Bloqueado</span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">• Ativo</span>
                )}
              </div>
            </div>

            <div className="p-3 bg-black/[0.02] dark:bg-white/[0.02] rounded-xl space-y-0.5">
              <span className="text-[10px] text-slate-400 font-medium">Criado por</span>
              <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">@{user.createdBy || 'Sistema'}</div>
            </div>

            <div className="p-3 bg-black/[0.02] dark:bg-white/[0.02] rounded-xl space-y-0.5">
              <span className="text-[10px] text-slate-400 font-medium">Último Acesso</span>
              <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                {user.lastLogin ? new Date(user.lastLogin).toLocaleString('pt-BR') : 'Nunca acessou'}
              </div>
            </div>
          </div>

          {/* Segurança: Nunca exibir senhas */}
          <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 rounded-xl flex items-center gap-2.5 text-emerald-800 dark:text-emerald-300">
            <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div className="text-[11px] leading-relaxed">
              <span className="font-bold">Senha Segura: </span>
              As credenciais são protegidas com hash criptográfico irreversível no Supabase Auth e nunca são expostas.
            </div>
          </div>

          {/* Se for Gerente: Equipe Gerenciada */}
          {isUserManager && (
            <div className="space-y-2 pt-1 border-t border-black/[0.04] dark:border-white/[0.04]">
              <div className="flex items-center justify-between">
                <span className="font-bold uppercase tracking-wider text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-teal-600" />
                  Membros da Equipe ({teamMembers.length})
                </span>
              </div>

              {teamMembers.length === 0 ? (
                <div className="p-4 text-center text-slate-400 bg-black/[0.02] dark:bg-white/[0.02] rounded-xl">
                  Nenhum usuário criado por este gerente até o momento.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {teamMembers.map(m => (
                    <div key={m.id} className="p-2 bg-black/[0.02] dark:bg-white/[0.02] rounded-lg flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{m.name}</span>
                        <span className="text-slate-400 text-[11px] ml-1.5">@{m.username}</span>
                      </div>
                      <span className="text-[10px] text-slate-400">{m.department || 'Geral'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Atividades Recentes do Usuário */}
          <div className="space-y-2 pt-1 border-t border-black/[0.04] dark:border-white/[0.04]">
            <span className="font-bold uppercase tracking-wider text-[11px] text-slate-400 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-blue-500" />
              Histórico Recente de Atividades
            </span>

            {userLogs.length === 0 ? (
              <div className="p-4 text-center text-slate-400 bg-black/[0.02] dark:bg-white/[0.02] rounded-xl">
                Nenhuma atividade recente registrada para este usuário.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-44 overflow-y-auto">
                {userLogs.map(l => (
                  <div key={l.id} className="p-2 bg-black/[0.02] dark:bg-white/[0.02] rounded-lg text-xs flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800 dark:text-slate-200 truncate">{l.action}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{l.formattedDate} {l.details && `• ${l.details}`}</div>
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/10 text-slate-600 dark:text-slate-300 shrink-0">
                      {l.category}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Rodapé */}
        <div className="p-4 border-t border-black/[0.05] dark:border-white/[0.06] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
