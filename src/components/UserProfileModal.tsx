import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  User,
  Key,
  Lock,
  Eye,
  EyeOff,
  Check,
  Crown,
  Briefcase,
  UserCheck,
  AlertTriangle,
  Loader2,
  LogOut,
  Sparkles,
  Shield,
  Edit3
} from 'lucide-react';
import {
  RegisteredUser,
  UserRole,
  updateSelfAccountProfile,
  registerVisitorAsAccount,
  updateVisitorNameAndSession,
  isUsernameAvailableAsync,
  sanitizeUsername
} from '../services/adminService';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: RegisteredUser | null;
  userRole: UserRole;
  visitorDisplayName: string;
  sessionId: string;
  onUserUpdated: (user: RegisteredUser) => void;
  onVisitorNameUpdated: (newName: string) => void;
  onLogout: () => void;
  showToast: (msg: string) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  userRole,
  visitorDisplayName,
  sessionId,
  onUserUpdated,
  onVisitorNameUpdated,
  onLogout,
  showToast
}) => {
  const isRegistered = !!currentUser;
  const isMaster = userRole === 'master' || userRole === 'admin';
  const isManager = userRole === 'manager';

  // Estados para Usuário Cadastrado
  const [name, setName] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [usernameStatus, setUsernameStatus] = useState<{ checking: boolean; available: boolean | null; message: string | null }>({ checking: false, available: null, message: null });

  // Estados para Visitante (Criação de Conta Oficial)
  const [visitorFullName, setVisitorFullName] = useState<string>('');
  const [visitorUsernameInput, setVisitorUsernameInput] = useState<string>('');
  const [visitorPasswordInput, setVisitorPasswordInput] = useState<string>('');
  const [visitorConfirmPassword, setVisitorConfirmPassword] = useState<string>('');
  const [showVisitorPass, setShowVisitorPass] = useState<boolean>(false);
  const [showVisitorConfirmPass, setShowVisitorConfirmPass] = useState<boolean>(false);
  const [visitorUsernameStatus, setVisitorUsernameStatus] = useState<{ checking: boolean; available: boolean | null; message: string | null }>({ checking: false, available: null, message: null });

  // Estados de Controle / Feedback
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sincronizar dados quando o modal abre
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setShowPassword(false);
      setShowConfirmPassword(false);
      setShowVisitorPass(false);
      setShowVisitorConfirmPass(false);
      setNewPassword('');
      setConfirmPassword('');
      setUsernameStatus({ checking: false, available: null, message: null });
      setVisitorUsernameStatus({ checking: false, available: null, message: null });

      if (currentUser) {
        setName(currentUser.name || '');
        setUsername(currentUser.username || '');
      } else {
        setVisitorFullName(visitorDisplayName !== 'Visitante' && !visitorDisplayName.includes('Visitante') ? visitorDisplayName : '');
        setVisitorUsernameInput('');
        setVisitorPasswordInput('');
        setVisitorConfirmPassword('');
      }
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [isOpen, currentUser, visitorDisplayName]);

  // Checagem em tempo real de disponibilidade de username para usuário existente
  useEffect(() => {
    if (!isOpen || !currentUser) return;
    const clean = sanitizeUsername(username);
    if (!clean || clean.length < 3) {
      setUsernameStatus({ checking: false, available: null, message: null });
      return;
    }
    if (clean === sanitizeUsername(currentUser.username)) {
      setUsernameStatus({ checking: false, available: true, message: 'Seu nome de usuário atual' });
      return;
    }

    setUsernameStatus({ checking: true, available: null, message: 'Verificando disponibilidade...' });
    const timer = setTimeout(async () => {
      const res = await isUsernameAvailableAsync(clean, currentUser.id);
      if (res.available) {
        setUsernameStatus({ checking: false, available: true, message: 'Nome de usuário disponível!' });
      } else {
        setUsernameStatus({ checking: false, available: false, message: `O login "@${clean}" já está em uso por outra conta.` });
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [username, currentUser, isOpen]);

  // Checagem em tempo real de disponibilidade de username para visitante criando conta
  useEffect(() => {
    if (!isOpen || currentUser) return;
    const clean = sanitizeUsername(visitorUsernameInput);
    if (!clean || clean.length < 3) {
      setVisitorUsernameStatus({ checking: false, available: null, message: null });
      return;
    }

    setVisitorUsernameStatus({ checking: true, available: null, message: 'Verificando disponibilidade...' });
    const timer = setTimeout(async () => {
      const res = await isUsernameAvailableAsync(clean);
      if (res.available) {
        setVisitorUsernameStatus({ checking: false, available: true, message: 'Nome de usuário disponível para cadastro!' });
      } else {
        setVisitorUsernameStatus({ checking: false, available: false, message: `Não é permitido: o login "@${clean}" já está em uso.` });
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [visitorUsernameInput, currentUser, isOpen]);

  if (!isOpen) return null;

  // Handler para Salvar Alterações de Usuário Cadastrado
  const handleSaveRegisteredProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setErrorMessage(null);

    const cleanName = name.trim();
    const cleanUsername = sanitizeUsername(username);

    if (!cleanName) {
      setErrorMessage('Por favor, informe seu nome completo.');
      return;
    }
    if (!cleanUsername || cleanUsername.length < 3) {
      setErrorMessage('O nome de usuário deve ter pelo menos 3 caracteres.');
      return;
    }

    // Verificação estrita antes de enviar
    if (usernameStatus.available === false) {
      setErrorMessage(usernameStatus.message || 'Este nome de usuário já pertence a outra conta.');
      return;
    }

    if (newPassword.trim()) {
      if (newPassword.trim().length < 4) {
        setErrorMessage('A nova senha deve ter no mínimo 4 caracteres.');
        return;
      }
      if (newPassword.trim() !== confirmPassword.trim()) {
        setErrorMessage('As senhas digitadas não coincidem.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await updateSelfAccountProfile(currentUser.id, {
        name: cleanName,
        username: cleanUsername,
        newPassword: newPassword.trim() || undefined
      });

      if (res.success && res.user) {
        onUserUpdated(res.user);
        showToast('✅ Seus dados e senha foram atualizados e sincronizados no Supabase!');
        onClose();
      } else {
        setErrorMessage(res.error || 'Erro ao atualizar dados no banco de dados.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro de conexão ao salvar no banco de dados.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler para Visitante Criar uma Conta Oficial
  const handleCreateAccountFromVisitor = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanName = visitorFullName.trim();
    const cleanUser = sanitizeUsername(visitorUsernameInput);
    const cleanPass = visitorPasswordInput.trim();

    if (!cleanName) {
      setErrorMessage('Informe seu nome completo para a conta.');
      return;
    }
    if (!cleanUser || cleanUser.length < 3) {
      setErrorMessage('O nome de usuário deve ter pelo menos 3 caracteres.');
      return;
    }
    if (visitorUsernameStatus.available === false) {
      setErrorMessage(visitorUsernameStatus.message || `O nome de usuário "@${cleanUser}" já está em uso. Escolha outro.`);
      return;
    }
    if (!cleanPass || cleanPass.length < 4) {
      setErrorMessage('A senha deve ter no mínimo 4 caracteres.');
      return;
    }
    if (cleanPass !== visitorConfirmPassword.trim()) {
      setErrorMessage('A confirmação de senha não confere com a senha digitada.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await registerVisitorAsAccount(sessionId, {
        name: cleanName,
        username: cleanUser,
        password: cleanPass
      });

      if (res.success && res.user) {
        onUserUpdated(res.user);
        showToast(`🎉 Conta criada com sucesso! Bem-vindo(a), ${res.user.name}!`);
        onClose();
      } else {
        setErrorMessage(res.error || 'Erro ao criar conta no banco de dados.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro ao criar conta no Supabase.');
    } finally {
      setIsSubmitting(false);
    }
  };

    if (!isOpen) return null;

    return createPortal(
      <div 
        className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[9999] w-screen h-screen min-h-[100dvh] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
        onClick={onClose}
      >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-7 text-left space-y-5 max-h-[90vh] overflow-y-auto custom-scrollbar"
      >
        {/* CABEÇALHO DO MODAL */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black shadow-md ${
              isMaster 
                ? 'bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-red-600/20' 
                : (isManager 
                  ? 'bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-indigo-600/20' 
                  : (isRegistered
                    ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-emerald-600/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'))
            }`}>
              {isMaster ? <Crown className="w-6 h-6 text-amber-300" /> : (isManager ? <Briefcase className="w-5 h-5" /> : <User className="w-5 h-5" />)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
                  {isRegistered ? 'Sua Conta' : 'Criar Sua Conta'}
                </h3>
                {isMaster && (
                  <span className="bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-red-200 dark:border-red-800">
                    MASTER
                  </span>
                )}
                {isManager && (
                  <span className="bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                    GERENTE
                  </span>
                )}
                {!isMaster && !isManager && isRegistered && (
                  <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                    USUÁRIO
                  </span>
                )}
                {!isRegistered && (
                  <span className="bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                    CADASTRO
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isRegistered
                  ? `@${currentUser?.username} • Perfil sincronizado no Supabase`
                  : `Defina seu nome, usuário e senha para ter sua conta`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* FEEDBACK DE ERRO */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="p-3.5 bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/80 rounded-2xl text-xs font-bold flex items-start gap-2.5 animate-shake"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <span className="leading-snug">{errorMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CASO 1: USUÁRIO JÁ CADASTRADO (MASTER, GERENTE OU USUÁRIO COMUM) */}
        {isRegistered && (
          <form onSubmit={handleSaveRegisteredProfile} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Nome Completo:
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome completo"
                className="w-full bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Nome de Usuário (@login):
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-slate-400 font-mono text-xs font-bold">@</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="usuario"
                  className={`w-full bg-slate-50 dark:bg-slate-800/90 border rounded-xl pl-8 pr-3.5 py-2.5 text-xs sm:text-sm font-mono font-bold text-slate-900 dark:text-slate-100 outline-none transition-all ${
                    usernameStatus.available === false
                      ? 'border-red-500 ring-2 ring-red-500/30'
                      : usernameStatus.available === true && sanitizeUsername(username) !== sanitizeUsername(currentUser?.username || '')
                        ? 'border-emerald-500 ring-2 ring-emerald-500/30'
                        : 'border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-red-500'
                  }`}
                />
              </div>
              {usernameStatus.message && (
                <p className={`text-[11px] font-bold flex items-center gap-1 ${
                  usernameStatus.checking
                    ? 'text-slate-400'
                    : usernameStatus.available === false
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                }`}>
                  {usernameStatus.checking ? <Loader2 className="w-3 h-3 animate-spin" /> : (usernameStatus.available ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />)}
                  <span>{usernameStatus.message}</span>
                </p>
              )}
            </div>

            {/* SEÇÃO DE TROCA DE SENHA */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-500" />
                  Trocar Senha de Acesso
                </span>
                <span className="text-[11px] text-slate-400 font-normal">
                  Deixe em branco se não quiser mudar
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                  Nova Senha:
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Digitar nova senha..."
                    className="w-full bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl pl-3.5 pr-10 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {newPassword.trim().length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-1.5"
                >
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    Confirmar Nova Senha:
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repita a nova senha..."
                      className="w-full bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl pl-3.5 pr-10 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </motion.div>
              )}
            </div>

            {/* BOTÕES DE AÇÃO */}
            <div className="pt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Deseja realmente sair da sua conta e voltar para a tela inicial?')) {
                    onLogout();
                    onClose();
                  }
                }}
                className="px-3.5 py-2.5 bg-slate-100 hover:bg-red-50 dark:bg-slate-800 dark:hover:bg-red-950/40 text-slate-700 hover:text-red-600 dark:text-slate-300 dark:hover:text-red-400 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair</span>
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-md shadow-red-600/30 cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Salvando no Supabase...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Salvar Alterações</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* CASO 2: VISITANTE -> FORMULÁRIO DIRETO DE CRIAR CONTA OFICIAL */}
        {!isRegistered && (
          <div className="space-y-4">
            {/* Banner explicativo */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/20 p-3.5 rounded-2xl border border-amber-200 dark:border-amber-900/60 text-xs">
              <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-200">
                <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Crie seu Acesso Pessoal no WebGIS</span>
              </div>
              <p className="text-amber-950/80 dark:text-amber-300/80 text-[11px] mt-1 leading-relaxed">
                Ao cadastrar um nome de usuário e senha, você terá sua conta oficial salva e poderá acessar de qualquer dispositivo.
              </p>
            </div>

            {/* FORMULÁRIO DE CADASTRO OFICIAL */}
            <form onSubmit={handleCreateAccountFromVisitor} className="space-y-3.5 animate-fadeIn">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Seu Nome Completo:
                </label>
                <input
                  type="text"
                  value={visitorFullName}
                  onChange={(e) => setVisitorFullName(e.target.value)}
                  placeholder="Ex: Carlos da Silva"
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Nome de Usuário / Login:
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-400 font-mono text-xs font-bold">@</span>
                  <input
                    type="text"
                    value={visitorUsernameInput}
                    onChange={(e) => setVisitorUsernameInput(e.target.value)}
                    placeholder="carlos.silva"
                    required
                    className={`w-full bg-slate-50 dark:bg-slate-800/90 border rounded-xl pl-8 pr-3.5 py-2.5 text-xs sm:text-sm font-mono font-bold text-slate-900 dark:text-slate-100 outline-none transition-all ${
                      visitorUsernameStatus.available === false
                        ? 'border-red-500 ring-2 ring-red-500/30'
                        : visitorUsernameStatus.available === true
                          ? 'border-emerald-500 ring-2 ring-emerald-500/30'
                          : 'border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-red-500'
                    }`}
                  />
                </div>
                {visitorUsernameStatus.message && (
                  <p className={`text-[10px] font-bold flex items-center gap-1 ${
                    visitorUsernameStatus.checking
                      ? 'text-slate-400'
                      : visitorUsernameStatus.available === false
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {visitorUsernameStatus.checking ? <Loader2 className="w-3 h-3 animate-spin" /> : (visitorUsernameStatus.available ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />)}
                    <span>{visitorUsernameStatus.message}</span>
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Senha de Acesso:
                </label>
                <div className="relative">
                  <input
                    type={showVisitorPass ? "text" : "password"}
                    value={visitorPasswordInput}
                    onChange={(e) => setVisitorPasswordInput(e.target.value)}
                    placeholder="Mínimo 4 caracteres..."
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl pl-3.5 pr-10 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowVisitorPass(!showVisitorPass)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showVisitorPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Confirmar Senha:
                </label>
                <div className="relative">
                  <input
                    type={showVisitorConfirmPass ? "text" : "password"}
                    value={visitorConfirmPassword}
                    onChange={(e) => setVisitorConfirmPassword(e.target.value)}
                    placeholder="Repita a senha..."
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl pl-3.5 pr-10 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowVisitorConfirmPass(!showVisitorConfirmPass)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showVisitorConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onLogout();
                    onClose();
                  }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-md shadow-red-600/30 cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Cadastrando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Criar Minha Conta</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </motion.div>
    </div>,
    document.body
  );
};
