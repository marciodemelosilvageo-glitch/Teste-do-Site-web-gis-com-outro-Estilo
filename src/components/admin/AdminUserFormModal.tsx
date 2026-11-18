import React, { useState } from 'react';
import {
  X,
  UserPlus,
  Sliders,
  Crown,
  Briefcase,
  User,
  Eye,
  EyeOff,
  AlertTriangle,
  Lock,
  Layers,
  Wrench,
  Check
} from 'lucide-react';
import {
  FeaturePermissions,
  ManagerPermissions
} from '../../services/adminService';
import { dataSources } from '../../data';

interface AdminUserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  isMaster: boolean;
  isManager: boolean;
  canManagerCreateManagerRole: boolean;
  editingUserId: string | null;
  userFormName: string;
  setUserFormName: (v: string) => void;
  userFormUsername: string;
  setUserFormUsername: (v: string) => void;
  userFormPassword: string;
  setUserFormPassword: (v: string) => void;
  userFormRole: 'master' | 'manager' | 'user';
  setUserFormRole: (v: 'master' | 'manager' | 'user') => void;
  userFormDepartment: string;
  setUserFormDepartment: (v: string) => void;
  userFormManagerPerms: ManagerPermissions;
  setUserFormManagerPerms: React.Dispatch<React.SetStateAction<ManagerPermissions>>;
  userFormHasCustom: boolean;
  setUserFormHasCustom: (v: boolean) => void;
  userFormLayers: Record<string, boolean>;
  setUserFormLayers: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  userFormFeatures: FeaturePermissions;
  setUserFormFeatures: React.Dispatch<React.SetStateAction<FeaturePermissions>>;
  userFormError: string | null;
  onSave: (e: React.FormEvent) => Promise<void>;
  isSaving?: boolean;
}

export const AdminUserFormModal: React.FC<AdminUserFormModalProps> = ({
  isOpen,
  onClose,
  isMaster,
  isManager,
  canManagerCreateManagerRole,
  editingUserId,
  userFormName,
  setUserFormName,
  userFormUsername,
  setUserFormUsername,
  userFormPassword,
  setUserFormPassword,
  userFormRole,
  setUserFormRole,
  userFormDepartment,
  setUserFormDepartment,
  userFormManagerPerms,
  setUserFormManagerPerms,
  userFormHasCustom,
  setUserFormHasCustom,
  userFormLayers,
  setUserFormLayers,
  userFormFeatures,
  setUserFormFeatures,
  userFormError,
  onSave,
  isSaving = false
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [customTab, setCustomTab] = useState<'layers' | 'features'>('features');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn select-none">
      <div 
        className="w-full max-w-2xl bg-white dark:bg-[#1c1c1e] rounded-3xl border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scaleUp my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="p-5 border-b border-black/[0.05] dark:border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#007AFF] text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
              {editingUserId ? <Sliders className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                {editingUserId ? 'Editar Usuário & Permissões' : 'Criar Novo Usuário'}
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {editingUserId ? 'Ajuste permissões individuais e dados da conta.' : 'Defina os dados de acesso e cargo do usuário.'}
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

        {/* Formulário com Rolagem */}
        <form onSubmit={onSave} className="flex-1 overflow-y-auto p-5 space-y-4">
          {userFormError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs rounded-xl font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{userFormError}</span>
            </div>
          )}

          {/* Dados Principais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                Nome Completo: *
              </label>
              <input
                type="text"
                required
                value={userFormName}
                onChange={(e) => setUserFormName(e.target.value)}
                placeholder="Ex: Maria Santos..."
                className="w-full min-h-[40px] px-3.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.1] text-xs text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#007AFF]/30"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                Login / Usuário (@): *
              </label>
              <input
                type="text"
                required
                disabled={Boolean(editingUserId)}
                value={userFormUsername}
                onChange={(e) => setUserFormUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                placeholder="Ex: maria.santos"
                className="w-full min-h-[40px] px-3.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.1] text-xs font-mono text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#007AFF]/30 disabled:opacity-50"
              />
            </div>

            {/* Senha (apenas na criação) */}
            {!editingUserId && (
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                  Senha Provisória Inicial: *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={userFormPassword}
                    onChange={(e) => setUserFormPassword(e.target.value)}
                    placeholder="Mínimo 4 caracteres..."
                    className="w-full min-h-[40px] pl-3.5 pr-10 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.1] text-xs text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#007AFF]/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                Departamento / Setor:
              </label>
              <input
                type="text"
                value={userFormDepartment}
                onChange={(e) => setUserFormDepartment(e.target.value)}
                placeholder="Ex: Planejamento, Geoprocessamento..."
                className="w-full min-h-[40px] px-3.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.1] text-xs text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#007AFF]/30"
              />
            </div>
          </div>

          {/* Seleção de Cargo / Papel */}
          <div className="space-y-1.5 pt-2 border-t border-black/[0.04] dark:border-white/[0.04]">
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
              Cargo / Nível de Acesso:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setUserFormRole('user')}
                className={`min-h-[44px] p-3 rounded-2xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                  userFormRole === 'user'
                    ? 'border-[#007AFF] bg-[#007AFF]/5 dark:bg-[#007AFF]/10 text-slate-900 dark:text-slate-100'
                    : 'border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] text-slate-600 dark:text-slate-400'
                }`}
              >
                <User className="w-4 h-4 text-slate-500 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-bold">Usuário Comum</div>
                  <div className="text-[10px] text-slate-400">Acesso padrão</div>
                </div>
              </button>

              {(isMaster || (isManager && canManagerCreateManagerRole)) && (
                <button
                  type="button"
                  onClick={() => setUserFormRole('manager')}
                  className={`min-h-[44px] p-3 rounded-2xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                    userFormRole === 'manager'
                      ? 'border-teal-500 bg-teal-500/5 dark:bg-teal-500/10 text-slate-900 dark:text-slate-100'
                      : 'border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Briefcase className="w-4 h-4 text-teal-600 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold">Gerente</div>
                    <div className="text-[10px] text-slate-400">Gestão de equipe</div>
                  </div>
                </button>
              )}

              {isMaster && (
                <button
                  type="button"
                  onClick={() => setUserFormRole('master')}
                  className={`min-h-[44px] p-3 rounded-2xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                    userFormRole === 'master'
                      ? 'border-indigo-500 bg-indigo-500/5 dark:bg-indigo-500/10 text-slate-900 dark:text-slate-100'
                      : 'border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Crown className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold">Master</div>
                    <div className="text-[10px] text-slate-400">Acesso irrestrito</div>
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Permissões Específicas do Gerente (quando role === manager) */}
          {userFormRole === 'manager' && (
            <div className="p-3.5 bg-black/[0.02] dark:bg-white/[0.02] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] space-y-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                Permissões Atribuídas a este Gerente
              </span>

              <div className="space-y-2">
                <label className="flex items-center justify-between text-xs cursor-pointer select-none">
                  <span>Permitir gerar novos logins de usuários</span>
                  <input
                    type="checkbox"
                    checked={userFormManagerPerms.allowGenerateLogins !== false}
                    onChange={(e) => setUserFormManagerPerms(prev => ({ ...prev, allowGenerateLogins: e.target.checked }))}
                    className="w-4 h-4 rounded text-[#007AFF]"
                  />
                </label>

                {isMaster && (
                  <>
                    <label className="flex items-center justify-between text-xs cursor-pointer select-none">
                      <span>Permitir criar outros Gerentes (além de usuários comuns)</span>
                      <input
                        type="checkbox"
                        checked={userFormManagerPerms.canCreateManagerRole === true}
                        onChange={(e) => setUserFormManagerPerms(prev => ({ ...prev, canCreateManagerRole: e.target.checked }))}
                        className="w-4 h-4 rounded text-[#007AFF]"
                      />
                    </label>

                    <label className="flex items-center justify-between text-xs cursor-pointer select-none">
                      <span>Permitir redefinir senhas dos usuários de sua equipe</span>
                      <input
                        type="checkbox"
                        checked={userFormManagerPerms.allowChangePasswords === true}
                        onChange={(e) => setUserFormManagerPerms(prev => ({ ...prev, allowChangePasswords: e.target.checked }))}
                        className="w-4 h-4 rounded text-[#007AFF]"
                      />
                    </label>

                    <label className="flex items-center justify-between text-xs cursor-pointer select-none">
                      <span>Permitir visualizar monitoramento de todos os visitantes</span>
                      <input
                        type="checkbox"
                        checked={userFormManagerPerms.allowViewAllVisitors === true}
                        onChange={(e) => setUserFormManagerPerms(prev => ({ ...prev, allowViewAllVisitors: e.target.checked }))}
                        className="w-4 h-4 rounded text-[#007AFF]"
                      />
                    </label>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Permissões Customizadas (apenas Master) */}
          {isMaster && userFormRole === 'user' && (
            <div className="space-y-3 pt-2 border-t border-black/[0.04] dark:border-white/[0.04]">
              <label className="flex items-center justify-between text-xs font-semibold cursor-pointer select-none">
                <span>Personalizar permissões individuais para este usuário</span>
                <input
                  type="checkbox"
                  checked={userFormHasCustom}
                  onChange={(e) => setUserFormHasCustom(e.target.checked)}
                  className="w-4 h-4 rounded text-[#007AFF]"
                />
              </label>

              {userFormHasCustom && (
                <div className="p-3 bg-black/[0.02] dark:bg-white/[0.02] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setCustomTab('features')}
                      className={`px-3 py-1 rounded-lg font-semibold ${customTab === 'features' ? 'bg-[#007AFF] text-white' : 'text-slate-500'}`}
                    >
                      Ferramentas
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomTab('layers')}
                      className={`px-3 py-1 rounded-lg font-semibold ${customTab === 'layers' ? 'bg-[#007AFF] text-white' : 'text-slate-500'}`}
                    >
                      Camadas
                    </button>
                  </div>

                  {customTab === 'features' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs max-h-48 overflow-y-auto">
                      {(Object.keys(userFormFeatures) as (keyof FeaturePermissions)[]).map(key => (
                        <label key={key} className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-[#1c1c1e] border border-black/[0.04] cursor-pointer">
                          <span className="truncate text-[11px] font-medium">{key}</span>
                          <input
                            type="checkbox"
                            checked={userFormFeatures[key] !== false}
                            onChange={(e) => setUserFormFeatures(prev => ({ ...prev, [key]: e.target.checked }))}
                            className="w-3.5 h-3.5 rounded text-[#007AFF]"
                          />
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs max-h-48 overflow-y-auto">
                      {dataSources.map(ds => (
                        <label key={ds.name} className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-[#1c1c1e] border border-black/[0.04] cursor-pointer">
                          <span className="truncate text-[11px] font-medium">{ds.name}</span>
                          <input
                            type="checkbox"
                            checked={userFormLayers[ds.name] !== false}
                            onChange={(e) => setUserFormLayers(prev => ({ ...prev, [ds.name]: e.target.checked }))}
                            className="w-3.5 h-3.5 rounded text-[#007AFF]"
                          />
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Rodapé de Ações do Modal */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-black/[0.05] dark:border-white/[0.06]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="min-h-[40px] px-5 py-2 rounded-xl text-xs font-bold bg-[#007AFF] hover:bg-[#0066d6] text-white cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isSaving ? 'Salvando...' : editingUserId ? 'Salvar Alterações' : 'Criar Usuário'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
