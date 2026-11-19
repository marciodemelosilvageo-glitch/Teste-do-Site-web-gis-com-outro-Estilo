import React, { useState } from 'react';
import {
  Key,
  Trash2,
  Eye,
  EyeOff,
  AlertTriangle
} from 'lucide-react';
import { RegisteredUser } from '../../services/adminService';
import { Banner } from './ui';

// ==========================================
// 1. MODAL DE REDEFINIÇÃO DE SENHA (ESTILO APPLE)
// ==========================================
interface ResetPasswordModalProps {
  user: RegisteredUser | null;
  onClose: () => void;
  onConfirm: (userId: string, newPass: string) => Promise<void>;
}

export const AdminResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  user,
  onClose,
  onConfirm
}) => {
  const [newPass, setNewPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPass.trim() || newPass.trim().length < 4) {
      setError('A nova senha deve ter no mínimo 4 caracteres.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await onConfirm(user.id, newPass.trim());
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao redefinir senha.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-black/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn select-none">
      <div 
        className="w-full max-w-sm bg-white dark:bg-[#1C1C1E] rounded-3xl border border-black/[0.08] dark:border-white/[0.08] shadow-2xl overflow-hidden p-6 space-y-4 animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] text-[#6C6C70] dark:text-[#98989D] flex items-center justify-center shrink-0">
            <Key className="w-5 h-5" strokeWidth={1.6} />
          </div>
          <div className="space-y-0.5 min-w-0">
            <h3 className="text-[17px] font-semibold text-slate-900 dark:text-slate-100">
              Redefinir Senha
            </h3>
            <p className="text-xs text-[#6C6C70] dark:text-[#98989D] truncate">
              Para @{user.username} ({user.name})
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#6C6C70] dark:text-[#98989D]">
              Nova Senha Provisória:
            </label>
            <div className="relative flex items-center">
              <input
                type={showPass ? 'text' : 'password'}
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="Mínimo 4 caracteres..."
                className="w-full min-h-[44px] px-3.5 pr-11 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-[#007AFF] dark:focus:border-[#0A84FF] transition-colors placeholder-[#8E8E93]"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-2.5 min-h-[36px] min-w-[36px] flex items-center justify-center text-[#8E8E93] hover:text-slate-900 dark:hover:text-white p-1 cursor-pointer"
                aria-label={showPass ? 'Ocultar senha' : 'Ver senha'}
              >
                {showPass ? <EyeOff className="w-4 h-4" strokeWidth={1.6} /> : <Eye className="w-4 h-4" strokeWidth={1.6} />}
              </button>
            </div>
          </div>

          <Banner
            message="O usuário será orientado a cadastrar sua própria senha definitiva no próximo acesso."
          />

          {error && (
            <div className="p-3 bg-black/[0.04] dark:bg-white/[0.06] border border-[#FF3B30]/30 text-[#FF3B30] dark:text-[#FF453A] text-xs rounded-xl font-medium">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-black/[0.05] dark:border-white/[0.06]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-medium text-[#6C6C70] dark:text-[#98989D] hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-[44px] px-5 py-2 rounded-xl text-xs font-semibold bg-[#007AFF] hover:bg-[#0062CC] dark:bg-[#0A84FF] dark:hover:bg-[#409CFF] text-white cursor-pointer shadow-xs disabled:opacity-50 transition-all"
            >
              {isSubmitting ? 'Salvando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// 2. MODAL DE CONFIRMAÇÃO DE EXCLUSÃO (ESTILO APPLE)
// ==========================================
interface DeleteUserModalProps {
  user: RegisteredUser | null;
  onClose: () => void;
  onConfirm: (userId: string) => Promise<void>;
}

export const AdminDeleteUserModal: React.FC<DeleteUserModalProps> = ({
  user,
  onClose,
  onConfirm
}) => {
  const [typedUser, setTypedUser] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const expectedUsername = user.username.toLowerCase();
  const isMatch = typedUser.trim().toLowerCase() === expectedUsername;

  const handleDelete = async () => {
    if (!isMatch) return;
    setIsDeleting(true);
    setError(null);
    try {
      await onConfirm(user.id);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao excluir usuário.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-black/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn select-none">
      <div 
        className="w-full max-w-sm bg-white dark:bg-[#1C1C1E] rounded-3xl border border-black/[0.08] dark:border-white/[0.08] shadow-2xl overflow-hidden p-6 space-y-4 animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] text-[#FF3B30] dark:text-[#FF453A] flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5" strokeWidth={1.6} />
          </div>
          <div className="space-y-0.5 min-w-0">
            <h3 className="text-[17px] font-semibold text-slate-900 dark:text-slate-100">
              Excluir Usuário?
            </h3>
            <p className="text-xs text-[#6C6C70] dark:text-[#98989D] truncate">
              {user.name} (@{user.username})
            </p>
          </div>
        </div>

        <p className="text-xs text-[#6C6C70] dark:text-[#98989D] leading-relaxed">
          Esta ação é irreversível e removerá todos os acessos vinculados. Para confirmar, digite <span className="font-mono font-semibold text-[#FF3B30] dark:text-[#FF453A]">@{user.username}</span> abaixo:
        </p>

        <input
          type="text"
          value={typedUser}
          onChange={(e) => setTypedUser(e.target.value)}
          placeholder={`Digite @${user.username} para confirmar...`}
          className="w-full min-h-[44px] px-3.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-[#FF3B30] dark:focus:border-[#FF453A] transition-colors placeholder-[#8E8E93]"
        />

        {error && (
          <div className="p-3 bg-black/[0.04] dark:bg-white/[0.06] border border-[#FF3B30]/30 text-[#FF3B30] dark:text-[#FF453A] text-xs rounded-xl font-medium">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-black/[0.05] dark:border-white/[0.06]">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-medium text-[#6C6C70] dark:text-[#98989D] hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!isMatch || isDeleting}
            className="min-h-[44px] px-5 py-2 rounded-xl text-xs font-semibold bg-[#FF3B30] hover:bg-[#D70015] dark:bg-[#FF453A] dark:hover:bg-[#FF3B30] text-white cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {isDeleting ? 'Excluindo...' : 'Excluir Conta'}
          </button>
        </div>
      </div>
    </div>
  );
};
