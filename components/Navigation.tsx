
import React from 'react';
import { BookOpen, Heart, ListChecks, Users, LogOut } from 'lucide-react';
import { TabType, UserProfile } from '../types';

interface NavigationProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
  user?: UserProfile | null;
  onLogout?: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentTab, onTabChange, user, onLogout }) => {
  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'bible', label: 'Bíblia', icon: <BookOpen size={22} strokeWidth={2.5} /> },
    { id: 'devotionals', label: 'Grupos', icon: <Users size={22} strokeWidth={2.5} /> },
    { id: 'prayer', label: 'Oração', icon: <Heart size={22} strokeWidth={2.5} /> },
    { id: 'routine', label: 'Rotina', icon: <ListChecks size={22} strokeWidth={2.5} /> },
  ];

  return (
    <>
      {/* MOBILE: Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-slate-200 pb-safe z-50">
        <div className="flex justify-around items-center h-20 px-2">
          {tabs.map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className="group flex flex-col items-center justify-center w-full h-full transition-all duration-300 relative"
              >
                <div 
                  className={`p-2 rounded-2xl transition-all duration-300 mb-1 ${
                      isActive 
                      ? 'text-navy-900 -translate-y-1' 
                      : 'text-slate-400 group-hover:text-navy-600'
                  }`}
                >
                  {tab.icon}
                  {isActive && (
                      <span className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-navy-900 rounded-full animate-in zoom-in"></span>
                  )}
                </div>
                <span 
                  className={`text-[10px] font-bold tracking-wide transition-all duration-300 ${
                      isActive 
                      ? 'opacity-100 text-navy-900' 
                      : 'opacity-0 h-0 group-hover:opacity-100 group-hover:h-auto text-slate-500'
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
      <nav className="hidden md:flex flex-col w-72 bg-white border-r border-slate-200 h-full p-6 z-50 shadow-sm relative">
         <div className="flex items-center gap-3 mb-10 px-2">
            <div className="w-10 h-10 bg-gradient-to-br from-navy-800 to-navy-900 rounded-xl flex items-center justify-center text-xl shadow-lg shadow-navy-900/10">
                🕊️
            </div>
            <div>
                <h1 className="text-xl font-serif font-bold text-navy-900 leading-none">Lumen</h1>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Super App</p>
            </div>
         </div>

         <div className="flex-1 space-y-2">
             {tabs.map((tab) => {
                 const isActive = currentTab === tab.id;
                 return (
                     <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl transition-all duration-300 group ${
                            isActive 
                            ? 'bg-navy-50 text-navy-900 shadow-sm' 
                            : 'text-slate-500 hover:bg-slate-50 hover:text-navy-700'
                        }`}
                     >
                        <div className={`${isActive ? 'text-gold-500' : 'text-slate-400 group-hover:text-navy-600'} transition-colors`}>
                            {React.cloneElement(tab.icon as React.ReactElement<any>, { size: 24 })}
                        </div>
                        <span className={`font-bold text-sm ${isActive ? 'text-navy-900' : ''}`}>
                            {tab.label}
                        </span>
                        {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-gold-500"></div>}
                     </button>
                 );
             })}
         </div>

         {user && (
             <div className="pt-6 border-t border-slate-100 mt-4">
                 <div className="flex items-center gap-3 mb-4 px-2">
                     <div className="w-10 h-10 rounded-full bg-navy-100 flex items-center justify-center text-navy-700 font-bold text-sm">
                         {user.name?.charAt(0) || 'U'}
                     </div>
                     <div className="flex-1 overflow-hidden">
                         <p className="text-sm font-bold text-navy-900 truncate">{user.name}</p>
                         <p className="text-xs text-slate-400 truncate">{user.email}</p>
                     </div>
                 </div>
                 {onLogout && (
                     <button 
                        onClick={onLogout}
                        className="w-full flex items-center justify-center gap-2 p-3 text-rose-500 hover:bg-rose-50 rounded-xl text-xs font-bold transition-colors"
                     >
                         <LogOut size={16} />
                         Sair da Conta
                     </button>
                 )}
             </div>
         )}
      </nav>
    </>
  );
};
