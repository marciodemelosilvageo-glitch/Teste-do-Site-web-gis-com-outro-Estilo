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
  AlertTriangle
} from 'lucide-react';
import {
  FeaturePermissions,
  ManagerPermissions
} from '../../services/adminService';
import { dataSources } from '../../data';
import { Toggle, SegmentedControl } from './ui';

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
  const [customTab, setCustomTab] = useState<'features' | 'layers'>('features');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] bg-black/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn select-none">
      <div 
        className="w-full max-w-2xl bg-white dark:bg-[#1C1C1E] rounded-3xl border border-black/[0.08] dark:border-white/[0.08] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scaleUp my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho Apple com Alça no Mobile */}
        <div className="p-5 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] text-[#007AFF] dark:text-[#0A84FF] flex items-center justify-center shrink-0">
              {editingUserId ? <Sliders className="w-5 h-5" strokeWidth={1.6} /> : <UserPlus className="w-5 h-5" strokeWidth={1.6} />}
            </div>
            <div>
              <h3 className="text-[17px] font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
                {editingUserId ? 'Editar Usuário & Permissões' : 'Criar Novo Usuário'}
              </h3>
              <p className="text-xs text-[#6C6C70] dark:text-[#98989D] mt-0.5">
                {editingUserId ? 'Ajuste permissões e dados da conta.' : 'Defina os dados de acesso e cargo do usuário.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-[#8E8E93] hover:text-slate-900 dark:hover:text-white p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="Fechar"
            aria-label="Fechar formulário"
          >
            <X className="w-5 h-5" strokeWidth={1.6} />
          </button>
        </div>

        {/* Formulário com Rolagem */}
        <form onSubmit={onSave} className="flex-1 overflow-y-auto p-5 space-y-4">
          {userFormError && (
            <div className="p-3 bg-black/[0.04] dark:bg-white/[0.06] border border-[#FF3B30]/30 text-[#FF3B30] dark:text-[#FF453A] text-xs rounded-xl font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" strokeWidth={1.6} />
              <span>{userFormError}</span>
            </div>
          )}

          {/* Dados Principais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#6C6C70] dark:text-[#98989D]">
                Nome Completo: *
              </label>
              <input
                type="text"
                required
                value={userFormName}
                onChange={(e) => setUserFormName(e.target.value)}
                placeholder="Ex: Maria Santos..."
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-[#007AFF] dark:focus:border-[#0A84FF] transition-colors placeholder-[#8E8E93]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-[#6C6C70] dark:text-[#98989D]">
                Login / Usuário (@): *
              </label>
              <input
                type="text"
                required
                disabled={Boolean(editingUserId)}
                value={userFormUsername}
                onChange={(e) => setUserFormUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                placeholder="Ex: maria.santos"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] text-sm font-mono text-slate-900 dark:text-slate-100 outline-none focus:border-[#007AFF] dark:focus:border-[#0A84FF] transition-colors placeholder-[#8E8E93] disabled:opacity-50"
              />
            </div>

            {/* Senha (apenas na criação) */}
            {!editingUserId && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#6C6C70] dark:text-[#98989D]">
                  Senha Provisória Inicial: *
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={userFormPassword}
                    onChange={(e) => setUserFormPassword(e.target.value)}
                    placeholder="Mínimo 4 caracteres..."
                    className="w-full min-h-[44px] pl-3.5 pr-11 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-[#007AFF] dark:focus:border-[#0A84FF] transition-colors placeholder-[#8E8E93]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 min-h-[36px] min-w-[36px] flex items-center justify-center text-[#8E8E93] hover:text-slate-900 dark:hover:text-white p-1 cursor-pointer"
                    aria-label={showPassword ? 'Ocultar senha' : 'Ver senha'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" strokeWidth={1.6} /> : <Eye className="w-4 h-4" strokeWidth={1.6} />}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-[#6C6C70] dark:text-[#98989D]">
                Departamento / Setor:
              </label>
              <input
                type="text"
                value={userFormDepartment}
                onChange={(e) => setUserFormDepartment(e.target.value)}
                placeholder="Ex: Planejamento, Geoprocessamento..."
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-[#007AFF] dark:focus:border-[#0A84FF] transition-colors placeholder-[#8E8E93]"
              />
            </div>
          </div>

          {/* Seleção de Cargo / Papel Estilo Apple */}
          <div className="space-y-2 pt-2 border-t border-black/[0.05] dark:border-white/[0.06]">
            <label className="text-xs font-medium text-[#6C6C70] dark:text-[#98989D]">
              Cargo / Nível de Acesso:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setUserFormRole('user')}
                className={`min-h-[50px] p-3 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                  userFormRole === 'user'
                    ? 'border-[#007AFF] bg-[#007AFF]/10 dark:bg-[#0A84FF]/15 text-slate-900 dark:text-slate-100'
                    : 'border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.03] text-[#6C6C70] dark:text-[#98989D]'
                }`}
              >
                <User className={`w-4 h-4 shrink-0 ${userFormRole === 'user' ? 'text-[#007AFF] dark:text-[#0A84FF]' : 'text-[#8E8E93]'}`} strokeWidth={1.6} />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">Comum</div>
                  <div className="text-xs text-[#8E8E93]">Acesso padrão</div>
                </div>
              </button>

              {(isMaster || (isManager && canManagerCreateManagerRole)) && (
                <button
                  type="button"
                  onClick={() => setUserFormRole('manager')}
                  className={`min-h-[50px] p-3 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                    userFormRole === 'manager'
                      ? 'border-[#007AFF] bg-[#007AFF]/10 dark:bg-[#0A84FF]/15 text-slate-900 dark:text-slate-100'
                      : 'border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.03] text-[#6C6C70] dark:text-[#98989D]'
                  }`}
                >
                  <Briefcase className={`w-4 h-4 shrink-0 ${userFormRole === 'manager' ? 'text-[#007AFF] dark:text-[#0A84FF]' : 'text-[#8E8E93]'}`} strokeWidth={1.6} />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">Gerente</div>
                    <div className="text-xs text-[#8E8E93]">Gestão de equipe</div>
                  </div>
                </button>
              )}

              {isMaster && (
                <button
                  type="button"
                  onClick={() => setUserFormRole('master')}
                  className={`min-h-[50px] p-3 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                    userFormRole === 'master'
                      ? 'border-[#007AFF] bg-[#007AFF]/10 dark:bg-[#0A84FF]/15 text-slate-900 dark:text-slate-100'
                      : 'border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.03] text-[#6C6C70] dark:text-[#98989D]'
                  }`}
                >
                  <Crown className={`w-4 h-4 shrink-0 ${userFormRole === 'master' ? 'text-[#007AFF] dark:text-[#0A84FF]' : 'text-[#8E8E93]'}`} strokeWidth={1.6} />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">Master</div>
                    <div className="text-xs text-[#8E8E93]">Acesso irrestrito</div>
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Permissões Específicas do Gerente (Poderes do Gerente) */}
          {userFormRole === 'manager' && (
            <div className="p-4 bg-black/[0.02] dark:bg-white/[0.03] rounded-2xl border border-black/[0.06] dark:border-white/[0.08] space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#6C6C70] dark:text-[#98989D]">
                Poderes do Gerente
              </span>

              <div className="space-y-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#8E8E93]">Equipe e Contas</div>
                <div className="space-y-2 divide-y divide-black/[0.04] dark:divide-white/[0.06]">
                  <div className="pt-1.5">
                    <Toggle
                      label="Gerar logins"
                      checked={userFormManagerPerms.allowGenerateLogins !== false}
                      onChange={(checked) => setUserFormManagerPerms(prev => ({ ...prev, allowGenerateLogins: checked }))}
                    />
                  </div>

                  {isMaster && (
                    <>
                      <div className="pt-2">
                        <Toggle
                          label="Redefinir senhas"
                          checked={userFormManagerPerms.allowChangePasswords === true}
                          onChange={(checked) => setUserFormManagerPerms(prev => ({ ...prev, allowChangePasswords: checked }))}
                        />
                      </div>
                      <div className="pt-2">
                        <Toggle
                          label="Bloquear contas"
                          checked={userFormManagerPerms.allowBlockUsers === true}
                          onChange={(checked) => setUserFormManagerPerms(prev => ({ ...prev, allowBlockUsers: checked }))}
                        />
                      </div>
                      <div className="pt-2">
                        <Toggle
                          label="Excluir contas"
                          checked={userFormManagerPerms.allowDeleteUsers === true}
                          onChange={(checked) => setUserFormManagerPerms(prev => ({ ...prev, allowDeleteUsers: checked }))}
                        />
                      </div>
                      <div className="pt-2">
                        <Toggle
                          label="Promover a gerente"
                          checked={userFormManagerPerms.canCreateManagerRole === true}
                          onChange={(checked) => setUserFormManagerPerms(prev => ({ ...prev, canCreateManagerRole: checked }))}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {isMaster && (
                <>
                  <div className="space-y-2 pt-2 border-t border-black/[0.05] dark:border-white/[0.06]">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[#8E8E93]">Alcance de Contas</div>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-700 dark:text-slate-300 font-medium">Alcance na equipe</span>
                      <div className="flex items-center gap-1 bg-black/[0.04] dark:bg-white/[0.06] p-0.5 rounded-xl">
                        {(['team_only', 'all_users'] as const).map(sc => (
                          <button
                            key={sc}
                            type="button"
                            onClick={() => setUserFormManagerPerms(prev => ({ ...prev, scopeType: sc }))}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium cursor-pointer transition-colors ${
                              (userFormManagerPerms.scopeType || 'team_only') === sc
                                ? 'bg-white dark:bg-[#2C2C2E] text-slate-900 dark:text-white shadow-xs'
                                : 'text-[#6C6C70] dark:text-[#98989D]'
                            }`}
                          >
                            {sc === 'team_only' ? 'Somente equipe' : 'Todos'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2 divide-y divide-black/[0.04] dark:divide-white/[0.06]">
                      <div className="pt-1.5">
                        <Toggle
                          label="Gerenciar visitantes"
                          checked={userFormManagerPerms.allowManageVisitors === true}
                          onChange={(checked) => setUserFormManagerPerms(prev => ({ ...prev, allowManageVisitors: checked, allowViewAllVisitors: checked }))}
                        />
                      </div>
                      <div className="pt-2">
                        <Toggle
                          label="Gerenciar contas do site"
                          checked={userFormManagerPerms.allowManageSiteAccounts === true}
                          onChange={(checked) => setUserFormManagerPerms(prev => ({ ...prev, allowManageSiteAccounts: checked }))}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-black/[0.05] dark:border-white/[0.06]">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[#8E8E93]">Permissões Padrão</div>
                    <div className="space-y-2 divide-y divide-black/[0.04] dark:divide-white/[0.06]">
                      <div className="pt-1.5">
                        <Toggle
                          label="Editar permissões padrão de Visitantes"
                          checked={userFormManagerPerms.allowManageRolesVisitor === true}
                          onChange={(checked) => setUserFormManagerPerms(prev => ({ ...prev, allowManageRolesVisitor: checked }))}
                        />
                      </div>
                      <div className="pt-2">
                        <Toggle
                          label="Editar permissões padrão de Contas do Site"
                          checked={userFormManagerPerms.allowManageRolesSiteAccount === true}
                          onChange={(checked) => setUserFormManagerPerms(prev => ({ ...prev, allowManageRolesSiteAccount: checked }))}
                        />
                      </div>
                      <div className="pt-2">
                        <Toggle
                          label="Editar permissões padrão de Usuários"
                          checked={userFormManagerPerms.allowManageRolesUser === true}
                          onChange={(checked) => setUserFormManagerPerms(prev => ({ ...prev, allowManageRolesUser: checked }))}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-black/[0.05] dark:border-white/[0.06]">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[#8E8E93]">Auditoria e Simulação</div>
                    <div className="space-y-2 divide-y divide-black/[0.04] dark:divide-white/[0.06]">
                      <div className="pt-1.5">
                        <Toggle
                          label="Ver auditoria"
                          checked={userFormManagerPerms.allowViewLogs !== false}
                          onChange={(checked) => setUserFormManagerPerms(prev => ({ ...prev, allowViewLogs: checked }))}
                        />
                      </div>
                      <div className="pt-2">
                        <Toggle
                          label="Exportar auditoria"
                          checked={userFormManagerPerms.allowExportLogs !== false}
                          onChange={(checked) => setUserFormManagerPerms(prev => ({ ...prev, allowExportLogs: checked }))}
                        />
                      </div>
                      <div className="pt-2">
                        <Toggle
                          label="Simular visão"
                          checked={userFormManagerPerms.allowSimulateProfile !== false}
                          onChange={(checked) => setUserFormManagerPerms(prev => ({ ...prev, allowSimulateProfile: checked }))}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Permissões Customizadas (apenas Master) */}
          {isMaster && userFormRole === 'user' && (
            <div className="space-y-3 pt-2 border-t border-black/[0.05] dark:border-white/[0.06]">
              <Toggle
                label="Personalizar permissões individuais para este usuário"
                checked={userFormHasCustom}
                onChange={setUserFormHasCustom}
              />

              {userFormHasCustom && (
                <div className="p-4 bg-black/[0.02] dark:bg-white/[0.03] rounded-2xl border border-black/[0.06] dark:border-white/[0.08] space-y-3">
                  <SegmentedControl
                    size="sm"
                    options={[
                      { id: 'features', label: 'Ferramentas' },
                      { id: 'layers', label: 'Camadas' }
                    ]}
                    value={customTab}
                    onChange={(v) => setCustomTab(v as 'features' | 'layers')}
                  />

                  {customTab === 'features' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs max-h-48 overflow-y-auto pr-1">
                      {(Object.keys(userFormFeatures) as (keyof FeaturePermissions)[]).map(key => (
                        <div key={key} className="p-2.5 rounded-xl bg-white dark:bg-[#1C1C1E] border border-black/[0.05] dark:border-white/[0.06]">
                          <Toggle
                            label={String(key)}
                            checked={userFormFeatures[key] !== false}
                            onChange={(checked) => setUserFormFeatures(prev => ({ ...prev, [key]: checked }))}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs max-h-48 overflow-y-auto pr-1">
                      {dataSources.map(ds => (
                        <div key={ds.name} className="p-2.5 rounded-xl bg-white dark:bg-[#1C1C1E] border border-black/[0.05] dark:border-white/[0.06]">
                          <Toggle
                            label={ds.name}
                            checked={userFormLayers[ds.name] !== false}
                            onChange={(checked) => setUserFormLayers(prev => ({ ...prev, [ds.name]: checked }))}
                          />
                        </div>
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
              className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-medium text-[#6C6C70] dark:text-[#98989D] hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="min-h-[44px] px-5 py-2 rounded-xl text-xs font-semibold bg-[#007AFF] hover:bg-[#0062CC] dark:bg-[#0A84FF] dark:hover:bg-[#409CFF] text-white cursor-pointer shadow-xs disabled:opacity-50 transition-all"
            >
              {isSaving ? 'Salvando...' : editingUserId ? 'Salvar Alterações' : 'Criar Usuário'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
