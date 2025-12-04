import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './services/supabaseService';
import { UserProfile, TabType } from './types';
import { Navigation } from './components/Navigation';
import { BibleScreen } from './screens/BibleScreen';
import { DevotionalScreen } from './screens/DevotionalScreen';
import { PrayerScreen } from './screens/PrayerScreen';
import { RoutineScreen } from './screens/RoutineScreen';
import { PlansScreen } from './screens/PlansScreen';
import { AIScreen } from './screens/AIScreen';
import { AmbientPlayer } from './components/AmbientPlayer';
import { Loader2, Mail, Lock, User, ArrowRight, AlertCircle, Sparkles, X, Camera } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState<TabType>('devotionals');
  
  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('theme') === 'dark' || 
               (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    const initApp = async () => {
      // 1. Timer visual de 6 segundos (Splash Screen)
      const splashTimer = new Promise(resolve => setTimeout(resolve, 6000));
      
      // 2. Verificação de sessão em paralelo
      const sessionCheck = supabase.getCurrentUser();

      try {
        // Aguarda AMBOS terminarem (pelo menos 6s de espera)
        const [_, currentUser] = await Promise.all([splashTimer, sessionCheck]);
        
        setUser(currentUser);
        if (currentUser?.name) setProfileName(currentUser.name);
      } catch (error) {
        console.error("Erro ao verificar sessão:", error);
      } finally {
        setLoading(false);
      }
    };

    initApp();
  }, []);

  // Theme Effect
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(prev => !prev);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    setAuthSuccess('');

    try {
        if (authMode === 'login') {
            const { user: loggedUser, error } = await supabase.signInWithEmail(email, password);
            if (error) {
                if (error.message.includes("Email not confirmed")) {
                    setAuthError("Email não confirmado. Verifique sua caixa de entrada.");
                } else {
                    setAuthError('Email ou senha inválidos. Tente novamente.');
                }
            } else if (loggedUser) {
                setUser(loggedUser);
                setProfileName(loggedUser.name || '');
            }
        } else if (authMode === 'register') {
            if (!name.trim()) {
                setAuthError("Por favor, informe seu nome.");
                setAuthLoading(false);
                return;
            }
            if (password.length < 6) {
                setAuthError("A senha deve ter pelo menos 6 caracteres.");
                setAuthLoading(false);
                return;
            }
            const { user: newUser, error } = await supabase.signUpWithEmail(email, password, name);
            if (error) {
                setAuthError(error.message || 'Erro ao criar conta. Tente outro email.');
            } else if (newUser) {
                setUser(newUser);
                setProfileName(name);
                if (!newUser.id) {
                    setAuthSuccess("Conta criada! Verifique seu email para confirmar.");
                }
            }
        } else if (authMode === 'forgot') {
            if (!email) {
                setAuthError("Informe seu email para recuperação.");
                setAuthLoading(false);
                return;
            }
            const { error } = await supabase.resetPassword(email);
            if (error) {
                setAuthError("Não foi possível enviar o email de recuperação.");
            } else {
                setAuthSuccess("Instruções de recuperação enviadas para seu email.");
                setTimeout(() => setAuthMode('login'), 3000);
            }
        }
    } catch (err) {
        setAuthError('Ocorreu um erro inesperado. Tente novamente mais tarde.');
    } finally {
        setAuthLoading(false);
    }
  };

  const handleGuestLogin = async () => {
      setAuthLoading(true);
      const guestUser = await supabase.signInAsGuest();
      setUser(guestUser);
      setProfileName(guestUser.name || 'Visitante');
      setAuthLoading(false);
  };

  const handleLogout = async () => {
      await supabase.signOut();
      setUser(null);
      setCurrentTab('devotionals');
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      setProfileLoading(true);

      let newAvatarUrl = user.avatar_url;

      if (fileInputRef.current?.files?.[0]) {
          const file = fileInputRef.current.files[0];
          const uploadedUrl = await supabase.uploadFile(file, `avatars/${user.id}`);
          if (uploadedUrl) newAvatarUrl = uploadedUrl;
      }

      const { error } = await supabase.updateProfile(profileName, newAvatarUrl);
      
      if (!error) {
          setUser({ ...user, name: profileName, avatar_url: newAvatarUrl });
          setIsProfileModalOpen(false);
      } else {
          alert("Erro ao atualizar perfil.");
      }
      setProfileLoading(false);
  };

  if (loading) {
    return (
      <div className="h-[100dvh] bg-[#020617] relative overflow-hidden flex items-center justify-center font-sans" aria-live="polite">
        {/* TECH GRID FLOOR (Horizon) */}
        <div className="absolute inset-0 overflow-hidden opacity-30">
            <div className="perspective-grid w-full h-[200%] absolute top-0 left-0 bg-transparent"></div>
            <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-[#020617] to-transparent z-10"></div>
        </div>

        {/* BACKGROUND GLOW */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-blue-900/10 via-gold-900/10 to-blue-900/10 rounded-full blur-[80px] animate-pulse"></div>

        {/* THE DIVINE CROSS CONSTRUCTION */}
        <div className="relative z-20 w-64 h-64 flex items-center justify-center animate-cross-pulse">
            
            {/* Vertical Beam (Connects Heaven and Earth) */}
            <div className="absolute w-2 h-32 bg-gradient-to-b from-transparent via-gold-400 to-transparent rounded-full animate-draw-vertical origin-top shadow-[0_0_20px_rgba(251,191,36,0.6)]"></div>
            
            {/* Horizontal Beam (Connects People) */}
            <div className="absolute h-2 w-24 bg-gradient-to-r from-transparent via-gold-100 to-transparent rounded-full animate-draw-horizontal shadow-[0_0_20px_rgba(251,191,36,0.6)]"></div>

            {/* Center Core Spark */}
            <div className="absolute w-4 h-4 bg-white rounded-full blur-md animate-[ping_2s_infinite] opacity-80"></div>
            <div className="absolute w-1 h-1 bg-white rounded-full shadow-[0_0_30px_rgba(255,255,255,1)] z-30"></div>
        </div>

        {/* TEXT REVEAL */}
        <div className="absolute bottom-28 z-20 text-center space-y-3">
            <h1 className="text-5xl font-serif font-bold text-white tracking-tight animate-[fadeInUp_1s_ease-out_1.5s_forwards] opacity-0 drop-shadow-[0_0_15px_rgba(251,191,36,0.3)]">
                Lumen
            </h1>
            <div className="h-px w-0 mx-auto bg-gradient-to-r from-transparent via-gold-500 to-transparent animate-[drawH_1s_ease-out_2s_forwards]" style={{ maxWidth: '100px' }}></div>
            <p className="text-[10px] font-bold tracking-[0.5em] uppercase shimmer-text opacity-0 animate-[fadeIn_1s_ease-out_2.5s_forwards]">
                Tech &bull; Faith &bull; Light
            </p>
        </div>

        {/* LOADING BAR */}
        <div className="absolute bottom-0 left-0 h-0.5 bg-gold-600 shadow-[0_0_20px_#d97706] w-full origin-left animate-[gridMove_6s_linear_forwards]" style={{ animationName: 'widthGrow', animationDuration: '6s' }}></div>
        <style>{`@keyframes widthGrow { 0% { width: 0%; } 100% { width: 100%; } }`}</style>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center relative font-sans overflow-hidden bg-navy-900">
        <div className="absolute inset-0 z-0">
             <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-navy-800 via-navy-900 to-navy-950"></div>
             <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
             <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-gold-500/10 rounded-full blur-[120px] pointer-events-none"></div>
        </div>

        <div className="w-full max-w-[420px] px-6 animate-in fade-in zoom-in duration-700 relative z-10 overflow-y-auto max-h-screen py-8 no-scrollbar">
            <div className="text-center mb-10">
                <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-navy-800 to-navy-900 rounded-[2rem] ring-1 ring-white/10 mb-6 shadow-2xl shadow-black/40 relative group transition-transform hover:scale-105 duration-500">
                    <div className="absolute inset-0 bg-gold-400 rounded-[2rem] blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-500"></div>
                    <span className="text-5xl drop-shadow-md relative z-10 transform group-hover:rotate-12 transition-transform duration-500" aria-hidden="true">🕊️</span>
                </div>
                <h1 className="text-5xl font-serif font-bold text-white mb-3 tracking-tight drop-shadow-sm">Lumen</h1>
                <p className="text-navy-100/80 font-light text-base max-w-[280px] mx-auto leading-relaxed">
                  {authMode === 'login' && 'Sua jornada espiritual diária, organizada e conectada.'}
                  {authMode === 'register' && 'Crie sua conta para salvar suas orações e progresso.'}
                  {authMode === 'forgot' && 'Recupere o acesso à sua conta.'}
                </p>
            </div>

            <div className="bg-white/95 backdrop-blur-xl rounded-[2rem] p-8 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] relative overflow-hidden ring-1 ring-white/20">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-gold-300 via-gold-500 to-gold-300"></div>

                <form onSubmit={handleEmailAuth} className="space-y-5 pt-2">
                    {authMode === 'register' && (
                        <div className="space-y-2 animate-in slide-in-from-top-4 fade-in duration-300">
                            <label htmlFor="name-input" className="text-[11px] font-bold text-navy-600 uppercase ml-1 tracking-widest">Nome</label>
                            <div className="relative group">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-gold-500 transition-colors" size={20} aria-hidden="true" />
                                <input 
                                    id="name-input"
                                    type="text" 
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Seu nome completo"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-navy-900 outline-none focus:ring-4 focus:ring-gold-100 focus:border-gold-400 focus:bg-white transition-all placeholder:text-slate-400 text-sm font-medium"
                                />
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label htmlFor="email-input" className="text-[11px] font-bold text-navy-600 uppercase ml-1 tracking-widest">Email</label>
                        <div className="relative group">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-gold-500 transition-colors" size={20} aria-hidden="true" />
                            <input 
                                id="email-input"
                                type="email" 
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="seu@email.com"
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-navy-900 outline-none focus:ring-4 focus:ring-gold-100 focus:border-gold-400 focus:bg-white transition-all placeholder:text-slate-400 text-sm font-medium"
                            />
                        </div>
                    </div>

                    {authMode !== 'forgot' && (
                        <div className="space-y-2 animate-in slide-in-from-top-2 fade-in">
                            <div className="flex justify-between items-center px-1">
                                <label htmlFor="password-input" className="text-[11px] font-bold text-navy-600 uppercase tracking-widest">Senha</label>
                                {authMode === 'login' && (
                                    <button 
                                        type="button"
                                        onClick={() => { setAuthMode('forgot'); setAuthError(''); }}
                                        className="text-[11px] font-bold text-gold-600 hover:text-gold-700 hover:underline transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 rounded"
                                    >
                                        ESQUECEU?
                                    </button>
                                )}
                            </div>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-gold-500 transition-colors" size={20} aria-hidden="true" />
                                <input 
                                    id="password-input"
                                    type="password" 
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-navy-900 outline-none focus:ring-4 focus:ring-gold-100 focus:border-gold-400 focus:bg-white transition-all placeholder:text-slate-400 text-sm font-medium"
                                />
                            </div>
                        </div>
                    )}

                    {authError && (
                        <div className="flex items-start gap-3 text-rose-600 bg-rose-50 px-4 py-3 rounded-2xl text-xs font-medium border border-rose-100 animate-in slide-in-from-top-2 shadow-sm" role="alert">
                            <AlertCircle size={18} className="shrink-0 mt-0.5" aria-hidden="true" />
                            <span className="leading-relaxed">{authError}</span>
                        </div>
                    )}

                    {authSuccess && (
                        <div className="flex items-start gap-3 text-green-600 bg-green-50 px-4 py-3 rounded-2xl text-xs font-medium border border-green-100 animate-in slide-in-from-top-2 shadow-sm" role="status">
                            <Sparkles size={18} className="shrink-0 mt-0.5" aria-hidden="true" />
                            <span className="leading-relaxed">{authSuccess}</span>
                        </div>
                    )}

                    <button 
                        type="submit"
                        disabled={authLoading}
                        className="w-full bg-gradient-to-r from-navy-900 to-navy-800 text-white font-bold py-4 rounded-2xl shadow-lg shadow-navy-900/20 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                    >
                        {authLoading ? <Loader2 className="animate-spin" size={20} aria-hidden="true" /> : (
                            <>
                                <span className="tracking-wide">
                                    {authMode === 'login' && 'ENTRAR'}
                                    {authMode === 'register' && 'CRIAR CONTA'}
                                    {authMode === 'forgot' && 'ENVIAR EMAIL'}
                                </span>
                                {authMode !== 'forgot' && <ArrowRight size={18} aria-hidden="true" />}
                            </>
                        )}
                    </button>
                </form>

                {authMode !== 'forgot' && (
                    <>
                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-slate-200"></div>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-white px-3 text-slate-400 font-bold tracking-widest text-[10px]">Ou continue com</span>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <button 
                                onClick={handleGuestLogin}
                                className="w-full py-3 text-xs font-bold text-slate-400 hover:text-navy-600 hover:bg-slate-50 rounded-xl transition-all flex items-center justify-center gap-2 uppercase tracking-wide border border-transparent hover:border-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                            >
                                <span>Entrar como visitante</span>
                            </button>
                        </div>
                    </>
                )}

                <div className="mt-6 text-center pt-4 border-t border-slate-50">
                    <button 
                        onClick={() => {
                            if (authMode === 'login') setAuthMode('register');
                            else setAuthMode('login');
                            setAuthError('');
                            setAuthSuccess('');
                        }}
                        className="text-sm text-slate-500 hover:text-navy-900 font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 rounded"
                    >
                        {authMode === 'login' && (
                            <>Não tem uma conta? <span className="text-gold-600 font-bold ml-1">Cadastre-se</span></>
                        )}
                        {authMode === 'register' && (
                            <>Já tem uma conta? <span className="text-gold-600 font-bold ml-1">Entrar</span></>
                        )}
                        {authMode === 'forgot' && (
                            <span className="text-navy-900 font-bold flex items-center justify-center gap-2 hover:gap-3 transition-all"><ArrowRight className="rotate-180" size={16} aria-hidden="true" /> Voltar para o Login</span>
                        )}
                    </button>
                </div>
            </div>
            
            <div className="text-center mt-8 opacity-40 hover:opacity-80 transition-opacity cursor-default">
                 <p className="text-[10px] text-white/80 font-medium tracking-wider uppercase">© 2025 Lumen App</p>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-[100dvh] w-full flex overflow-hidden transition-colors duration-300 ${isDarkMode ? 'dark bg-navy-950 text-slate-200' : 'bg-slate-50 text-navy-900'}`}>
        <Navigation 
            currentTab={currentTab} 
            onTabChange={setCurrentTab}
            user={user}
            onLogout={handleLogout}
            onEditProfile={() => setIsProfileModalOpen(true)}
            isDarkMode={isDarkMode}
            toggleTheme={toggleTheme}
        />
        
        <main className="flex-1 h-full relative overflow-hidden flex flex-col pt-14 md:pt-0">
            <div className="flex-1 h-full w-full overflow-hidden relative">
                {currentTab === 'bible' && <BibleScreen />}
                {currentTab === 'devotionals' && <DevotionalScreen user={user} />}
                {currentTab === 'prayer' && <PrayerScreen />}
                {currentTab === 'plans' && <PlansScreen />}
                {currentTab === 'ai' && <AIScreen />}
                {currentTab === 'routine' && <RoutineScreen onLogout={handleLogout} />}
            </div>
            {/* Ambient Player Floating Button */}
            <AmbientPlayer />
        </main>

        {isProfileModalOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-navy-900/60 backdrop-blur-sm animate-in fade-in duration-300" role="dialog" aria-modal="true" aria-labelledby="edit-profile-title">
                <div className="bg-white dark:bg-navy-900 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 ring-1 ring-white/20 dark:ring-navy-700">
                    <div className="px-6 py-5 border-b border-slate-100 dark:border-navy-800 flex justify-between items-center bg-slate-50/80 dark:bg-navy-800/80">
                        <h3 id="edit-profile-title" className="text-navy-900 dark:text-white font-bold text-lg">Editar Perfil</h3>
                        <button onClick={() => setIsProfileModalOpen(false)} className="w-8 h-8 rounded-full bg-white dark:bg-navy-800 text-slate-400 hover:text-navy-900 dark:hover:text-white flex items-center justify-center shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400" aria-label="Fechar"><X size={18} aria-hidden="true" /></button>
                    </div>
                    <form onSubmit={handleProfileUpdate} className="p-8 flex flex-col items-center">
                        <button 
                            type="button"
                            className="relative group cursor-pointer mb-6 rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-gold-400" 
                            onClick={() => fileInputRef.current?.click()}
                            aria-label="Alterar foto de perfil"
                        >
                             <div className="w-24 h-24 rounded-full border-4 border-slate-100 dark:border-navy-700 overflow-hidden shadow-inner group-hover:border-gold-300 transition-colors">
                                 {user.avatar_url ? (
                                     <img src={user.avatar_url} alt={`Foto atual de ${user.name}`} className="w-full h-full object-cover" />
                                 ) : (
                                     <div className="w-full h-full bg-navy-100 dark:bg-navy-800 flex items-center justify-center text-navy-700 dark:text-navy-300 font-bold text-3xl">
                                         {user.name?.charAt(0) || 'U'}
                                     </div>
                                 )}
                             </div>
                             <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                 <Camera className="text-white" size={24} aria-hidden="true" />
                             </div>
                        </button>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept="image/*"
                            onChange={(e) => {
                                if(e.target.files?.[0]) {
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                    setUser({...user, avatar_url: ev.target?.result as string});
                                }
                                reader.readAsDataURL(e.target.files[0]);
                                }
                            }}
                            aria-hidden="true"
                            tabIndex={-1}
                        />

                        <div className="w-full space-y-2 mb-6">
                            <label htmlFor="profile-name-input" className="block text-[11px] font-bold text-navy-900 dark:text-slate-400 uppercase tracking-widest">Seu Nome</label>
                            <input 
                                id="profile-name-input"
                                type="text" 
                                value={profileName} 
                                onChange={(e) => setProfileName(e.target.value)} 
                                className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-2xl px-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-gold-200 focus:border-gold-400 font-medium text-center text-navy-900 dark:text-white" 
                                placeholder="Seu nome"
                            />
                        </div>

                        <button 
                            type="submit" 
                            disabled={profileLoading} 
                            className="w-full bg-navy-900 dark:bg-gold-500 hover:bg-navy-800 dark:hover:bg-gold-600 disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl shadow-xl shadow-navy-900/10 transition-all flex items-center justify-center gap-2 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                        >
                            {profileLoading ? <Loader2 size={20} className="animate-spin" aria-hidden="true" /> : 'Salvar Alterações'}
                        </button>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
};

export default App;