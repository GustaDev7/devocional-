
import React, { useState, useEffect } from 'react';
import { supabase } from './services/supabaseService';
import { UserProfile, TabType } from './types';
import { Navigation } from './components/Navigation';
import { BibleScreen } from './screens/BibleScreen';
import { DevotionalScreen } from './screens/DevotionalScreen';
import { PrayerScreen } from './screens/PrayerScreen';
import { RoutineScreen } from './screens/RoutineScreen';
import { Loader2, Mail, Lock, User, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState<TabType>('devotionals');

  // Auth Form State
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  
  useEffect(() => {
    const checkSession = async () => {
      try {
        const currentUser = await supabase.getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        console.error("Erro ao verificar sessão:", error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    setAuthSuccess('');

    try {
        if (authMode === 'login') {
            const { user: loggedUser, error } = await supabase.signInWithEmail(email, password);
            if (error) {
                setAuthError('Email ou senha inválidos. Tente novamente.');
            } else if (loggedUser) {
                setUser(loggedUser);
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
                // Se o Supabase retorna o usuário mas sem sessão ativa, provavelmente requer confirmação
                setUser(newUser);
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
      setAuthLoading(false);
  };

  const handleLogout = async () => {
      await supabase.signOut();
      setUser(null);
      setCurrentTab('devotionals');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-900 flex flex-col items-center justify-center">
        <div className="relative mb-4">
             <div className="absolute inset-0 bg-gold-400 rounded-full blur-xl opacity-20 animate-pulse"></div>
             <div className="w-16 h-16 bg-navy-800 rounded-2xl flex items-center justify-center relative z-10 border border-navy-700 shadow-xl">
                 <Sparkles className="text-gold-400" size={32} />
             </div>
        </div>
        <p className="text-gold-100 font-serif text-sm tracking-widest uppercase opacity-80 animate-pulse">Carregando Lumen...</p>
      </div>
    );
  }

  // Auth Screen
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center relative font-sans overflow-hidden bg-navy-900">
        {/* Animated Background */}
        <div className="absolute inset-0 z-0">
             <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-navy-800 via-navy-900 to-navy-950"></div>
             <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
             <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-gold-500/10 rounded-full blur-[120px] pointer-events-none"></div>
        </div>

        <div className="w-full max-w-[420px] px-6 animate-in fade-in zoom-in duration-700 relative z-10">
            <div className="text-center mb-10">
                <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-navy-800 to-navy-900 rounded-[2rem] ring-1 ring-white/10 mb-6 shadow-2xl shadow-black/40 relative group transition-transform hover:scale-105 duration-500">
                    <div className="absolute inset-0 bg-gold-400 rounded-[2rem] blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-500"></div>
                    <span className="text-5xl drop-shadow-md relative z-10 transform group-hover:rotate-12 transition-transform duration-500">🕊️</span>
                </div>
                <h1 className="text-5xl font-serif font-bold text-white mb-3 tracking-tight drop-shadow-sm">Lumen</h1>
                <p className="text-navy-100/80 font-light text-base max-w-[280px] mx-auto leading-relaxed">
                  {authMode === 'login' && 'Sua jornada espiritual diária, organizada e conectada.'}
                  {authMode === 'register' && 'Crie sua conta para salvar suas orações e progresso.'}
                  {authMode === 'forgot' && 'Recupere o acesso à sua conta.'}
                </p>
            </div>

            <div className="bg-white/95 backdrop-blur-xl rounded-[2rem] p-8 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] relative overflow-hidden ring-1 ring-white/20">
                {/* Decorative top accent */}
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-gold-300 via-gold-500 to-gold-300"></div>

                <form onSubmit={handleEmailAuth} className="space-y-5 pt-2">
                    {authMode === 'register' && (
                        <div className="space-y-2 animate-in slide-in-from-top-4 fade-in duration-300">
                            <label className="text-[11px] font-bold text-navy-600 uppercase ml-1 tracking-widest">Nome</label>
                            <div className="relative group">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-gold-500 transition-colors" size={20} />
                                <input 
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
                        <label className="text-[11px] font-bold text-navy-600 uppercase ml-1 tracking-widest">Email</label>
                        <div className="relative group">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-gold-500 transition-colors" size={20} />
                            <input 
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
                                <label className="text-[11px] font-bold text-navy-600 uppercase tracking-widest">Senha</label>
                                {authMode === 'login' && (
                                    <button 
                                        type="button"
                                        onClick={() => { setAuthMode('forgot'); setAuthError(''); }}
                                        className="text-[11px] font-bold text-gold-600 hover:text-gold-700 hover:underline transition-colors"
                                    >
                                        ESQUECEU?
                                    </button>
                                )}
                            </div>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-gold-500 transition-colors" size={20} />
                                <input 
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
                        <div className="flex items-start gap-3 text-rose-600 bg-rose-50 px-4 py-3 rounded-2xl text-xs font-medium border border-rose-100 animate-in slide-in-from-top-2 shadow-sm">
                            <AlertCircle size={18} className="shrink-0 mt-0.5" />
                            <span className="leading-relaxed">{authError}</span>
                        </div>
                    )}

                    {authSuccess && (
                        <div className="flex items-start gap-3 text-green-600 bg-green-50 px-4 py-3 rounded-2xl text-xs font-medium border border-green-100 animate-in slide-in-from-top-2 shadow-sm">
                            <Sparkles size={18} className="shrink-0 mt-0.5" />
                            <span className="leading-relaxed">{authSuccess}</span>
                        </div>
                    )}

                    <button 
                        type="submit"
                        disabled={authLoading}
                        className="w-full bg-gradient-to-r from-navy-900 to-navy-800 text-white font-bold py-4 rounded-2xl shadow-lg shadow-navy-900/20 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
                    >
                        {authLoading ? <Loader2 className="animate-spin" size={20} /> : (
                            <>
                                <span className="tracking-wide">
                                    {authMode === 'login' && 'ENTRAR'}
                                    {authMode === 'register' && 'CRIAR CONTA'}
                                    {authMode === 'forgot' && 'ENVIAR EMAIL'}
                                </span>
                                {authMode !== 'forgot' && <ArrowRight size={18} />}
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
                                className="w-full py-3 text-xs font-bold text-slate-400 hover:text-navy-600 hover:bg-slate-50 rounded-xl transition-all flex items-center justify-center gap-2 uppercase tracking-wide border border-transparent hover:border-slate-100"
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
                        className="text-sm text-slate-500 hover:text-navy-900 font-medium transition-colors"
                    >
                        {authMode === 'login' && (
                            <>Não tem uma conta? <span className="text-gold-600 font-bold ml-1">Cadastre-se</span></>
                        )}
                        {authMode === 'register' && (
                            <>Já tem uma conta? <span className="text-gold-600 font-bold ml-1">Entrar</span></>
                        )}
                        {authMode === 'forgot' && (
                            <span className="text-navy-900 font-bold flex items-center justify-center gap-2 hover:gap-3 transition-all"><ArrowRight className="rotate-180" size={16} /> Voltar para o Login</span>
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

  // Main App Layout (Responsive)
  return (
    <div className="h-screen w-full bg-slate-50 flex overflow-hidden">
        {/* Navigation - Sidebar on Desktop (md+), Bottom Bar on Mobile */}
        <Navigation 
            currentTab={currentTab} 
            onTabChange={setCurrentTab}
            user={user}
            onLogout={handleLogout}
        />
        
        {/* Main Content Area */}
        <main className="flex-1 h-full relative overflow-hidden flex flex-col">
            <div className="flex-1 h-full w-full overflow-hidden relative">
                {currentTab === 'bible' && <BibleScreen />}
                {currentTab === 'devotionals' && <DevotionalScreen />}
                {currentTab === 'prayer' && <PrayerScreen />}
                {currentTab === 'routine' && <RoutineScreen onLogout={handleLogout} />}
            </div>
        </main>
    </div>
  );
};

export default App;
