
import React from 'react';
import { BookOpen, Heart, ListChecks, Users, LogOut, LucideIcon, Settings, Calendar, Sparkles, Sun, Moon } from 'lucide-react';
import { TabType, UserProfile } from '../types';

interface NavigationProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
  user?: UserProfile | null;
  onLogout?: () => void;
  onEditProfile?: () => void;
  isDarkMode?: boolean;
  toggleTheme?: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentTab, onTabChange, user, onLogout, onEditProfile, isDarkMode, toggleTheme }) => {
  const tabs: { id: TabType; label: string; Icon: LucideIcon }[] = [
    { id: 'bible', label: 'Bíblia', Icon: BookOpen },
    { id: 'devotionals', label: 'Grupos', Icon: Users },
    { id: 'prayer', label: 'Oração', Icon: Heart },
    { id: 'plans', label: 'Planos', Icon: Calendar },
    { id: 'ai', label: 'Lumen AI', Icon: Sparkles },
    { id: 'routine', label: 'Rotina', Icon: ListChecks },
  ];

  return (
    <>
      {/* MOBILE: Bottom Navigation */}
      <nav 
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-navy-950/95 backdrop-blur-xl border-t border-slate-200 dark:border-navy-800 pb-safe z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.02)] transition-colors duration-300"
        aria-label="Navegação Principal"
      >
        <div className="flex items-center justify-between h-16 px-4" role="tablist">
          {tabs.map((tab) => {
            const isActive = currentTab === tab.id;
            const isAI = tab.id === 'ai';
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                aria-label={tab.label}
                onClick={() => onTabChange(tab.id)}
                className="relative flex flex-1 flex-col items-center justify-center h-full transition-all duration-200 focus:outline-none active:scale-95 gap-1"
              >
                {/* Active Indicator Background */}
                <div 
                  className={`absolute top-2 w-10 h-8 rounded-xl -z-10 transition-all duration-300 ${
                    isActive ? 'bg-navy-50 dark:bg-navy-800 scale-100 opacity-100' : 'scale-50 opacity-0'
                  }`}
                ></div>
                
                <div 
                  className={`transition-all duration-200 ${
                      isActive 
                      ? 'text-navy-900 dark:text-white -translate-y-0.5' 
                      : isAI ? 'text-gold-500' : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  <tab.Icon size={isActive ? 24 : 22} strokeWidth={isActive ? 2.5 : 2} aria-hidden="true" className={isAI && isActive ? "drop-shadow-sm text-gold-600 dark:text-gold-400" : ""} />
                </div>
                
                <span 
                  className={`text-[10px] leading-none transition-all duration-200 ${
                      isActive 
                      ? 'font-bold text-navy-900 dark:text-white' 
                      : 'font-medium text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* DESKTOP: Sidebar Navigation */}
      <nav className="hidden md:flex flex-col w-72 bg-white dark:bg-navy-950 border-r border-slate-200 dark:border-navy-800 h-full p-6 z-50 shadow-sm relative animate-slide-in-right transition-colors duration-300" aria-label="Navegação Principal Desktop">
         <div className="flex items-center gap-3 mb-10 px-2">
            <div className="w-10 h-10 bg-gradient-to-br from-navy-800 to-navy-900 dark:from-navy-700 dark:to-navy-800 rounded-xl flex items-center justify-center text-xl shadow-lg shadow-navy-900/10 active:scale-95 transition-transform duration-200" aria-hidden="true">
                🕊️
            </div>
            <div>
                <h1 className="text-xl font-serif font-bold text-navy-900 dark:text-white leading-none">Lumen</h1>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest mt-1">Super App</p>
            </div>
         </div>

         <div className="flex-1 space-y-2" role="tablist" aria-orientation="vertical">
             {tabs.map((tab) => {
                 const isActive = currentTab === tab.id;
                 const isAI = tab.id === 'ai';
                 return (
                     <button
                        key={tab.id}
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => onTabChange(tab.id)}
                        className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl transition-all duration-200 group focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 active:scale-95 ${
                            isActive 
                            ? 'bg-navy-50 dark:bg-navy-800 text-navy-900 dark:text-white shadow-sm' 
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-900 hover:text-navy-700 dark:hover:text-white'
                        }`}
                     >
                        <div className={`${isActive ? 'text-gold-600 dark:text-gold-400' : isAI ? 'text-gold-500' : 'text-slate-400 dark:text-slate-500 group-hover:text-navy-600 dark:group-hover:text-white'} transition-colors`}>
                            <tab.Icon size={24} aria-hidden="true" />
                        </div>
                        <span className={`font-bold text-sm ${isActive ? 'text-navy-900 dark:text-white' : ''}`}>
                            {tab.label}
                        </span>
                        {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-gold-500 animate-zoom-in"></div>}
                     </button>
                 );
             })}
         </div>

         <div className="pt-6 border-t border-slate-100 dark:border-navy-800 mt-4 space-y-4">
            {/* Theme Toggle */}
            <button
                onClick={toggleTheme}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50 dark:bg-navy-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-all active:scale-95"
            >
                <div className="flex items-center gap-3">
                    {isDarkMode ? <Moon size={18} className="text-gold-400" /> : <Sun size={18} className="text-gold-500" />}
                    <span className="text-sm font-medium">Modo {isDarkMode ? 'Escuro' : 'Claro'}</span>
                </div>
            </button>

            {user && (
                 <div className="flex items-center gap-3 px-2">
                     <div className="w-10 h-10 rounded-full bg-navy-100 dark:bg-navy-800 flex items-center justify-center text-navy-700 dark:text-navy-300 font-bold text-sm overflow-hidden border border-navy-200 dark:border-navy-700 transition-transform active:scale-95">
                         {user.avatar_url ? (
                             <img src={user.avatar_url} alt={`Foto de perfil de ${user.name}`} className="w-full h-full object-cover" />
                         ) : (
                             user.name?.charAt(0) || 'U'
                         )}
                     </div>
                     <div className="flex-1 overflow-hidden">
                         <p className="text-sm font-bold text-navy-900 dark:text-white truncate">{user.name}</p>
                         <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                     </div>
                     {onEditProfile && (
                         <button 
                            onClick={onEditProfile} 
                            className="p-1.5 text-slate-400 hover:text-navy-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-900 active:scale-90"
                            aria-label="Editar Perfil"
                         >
                             <Settings size={16} aria-hidden="true" />
                         </button>
                     )}
                 </div>
            )}
            
            {onLogout && (
                 <button 
                    onClick={onLogout}
                    className="w-full flex items-center justify-center gap-2 p-3 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 active:scale-95"
                 >
                     <LogOut size={16} aria-hidden="true" />
                     Sair da Conta
                 </button>
             )}
         </div>
      </nav>
    </>
  );
};
