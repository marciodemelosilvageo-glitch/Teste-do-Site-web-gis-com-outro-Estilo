import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  Key,
  Ban,
  CheckCircle2,
  Trash2,
  Crown,
  Eye,
  EyeOff,
  UserCog
} from 'lucide-react';
import { RegisteredUser } from '../../services/adminService';

// ==========================================
// 1. MODAL DE REDEFINIÇÃO DE SENHA
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
    <div className="fixed inset-0 z-[10000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div 
        className="w-full max-w-sm bg-white dark:bg-[#1c1c1e] rounded-3xl border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden p-5 space-y-4 animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Key className="w-5 h-5" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Redefinir Senha
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              Para @{user.username} ({user.name})
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
              Nova Senha Provisória:
            </label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="Digitar nova senha (mín. 4 caracteres)..."
                className="w-full min-h-[40px] px-3 pr-10 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.1] text-xs text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-500/30"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
            <span className="font-bold">Aviso de Segurança: </span>
            O usuário será obrigado a cadastrar sua própria senha pessoal no primeiro acesso após a redefinição.
          </div>

          {error && (
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs rounded-xl font-medium">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/[0.04] dark:border-white/[0.04]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white cursor-pointer shadow-xs disabled:opacity-60"
            >
              {isSubmitting ? 'Salvando...' : 'Confirmar Redefinição'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// 2. MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE USUÁRIO
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
    <div className="fixed inset-0 z-[10000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div 
        className="w-full max-w-sm bg-white dark:bg-[#1c1c1e] rounded-3xl border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden p-5 space-y-4 animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Excluir Usuário Permanentemente?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {user.name} (@{user.username})
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          Esta ação é irreversível e removerá todos os acessos do usuário. Para confirmar, digite <span className="font-mono font-bold text-rose-600">@{user.username}</span> abaixo:
        </p>

        <input
          type="text"
          value={typedUser}
          onChange={(e) => setTypedUser(e.target.value)}
          placeholder={`Digite @${user.username} para confirmar...`}
          className="w-full min-h-[40px] px-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.1] text-xs text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-rose-500/30"
        />

        {error && (
          <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs rounded-xl font-medium">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/[0.04] dark:border-white/[0.04]">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!isMatch || isDeleting}
            className="px-4 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? 'Excluindo...' : 'Sim, Excluir'}
          </button>
        </div>
      </div>
    </div>
  );
};
