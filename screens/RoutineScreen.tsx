
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseService';
import { Habit } from '../types';
import { Check, Sun, Book, Moon, Heart, Loader2, LogOut } from 'lucide-react';

interface RoutineScreenProps {
  onLogout: () => void;
}

export const RoutineScreen: React.FC<RoutineScreenProps> = ({ onLogout }) => {
  const [habits, setHabits] = useState<Habit[]>([
    { id: 'bible_reading', label: 'Leitura Bíblica', completed: false, icon: 'book' },
    { id: 'morning_prayer', label: 'Oração da Manhã', completed: false, icon: 'sun' },
    { id: 'prayer_wall', label: 'Intercessão (Mural)', completed: false, icon: 'heart' },
    { id: 'night_gratitude', label: 'Gratidão Noturna', completed: false, icon: 'moon' },
  ]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
      const loadHabits = async () => {
          try {
              const completedIds = await supabase.fetchTodayHabits();
              setHabits(prev => prev.map(h => ({
                  ...h,
                  completed: completedIds.includes(h.id)
              })));
          } catch (error) {
              console.error("Failed to load habits", error);
          } finally {
              setLoading(false);
          }
      };
      loadHabits();
  }, []);

  const completedCount = habits.filter(h => h.completed).length;
  const progress = Math.round((completedCount / habits.length) * 100);

  const toggleHabit = async (id: string) => {
    const habit = habits.find(h => h.id === id);
    if (!habit) return;

    const newState = !habit.completed;
    
    setHabits(habits.map(h => 
      h.id === id ? { ...h, completed: newState } : h
    ));

    try {
        await supabase.toggleHabit(id, newState);
    } catch (error) {
        console.error("Failed to toggle habit", error);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'book': return <Book size={20} className="text-blue-500" aria-hidden="true" />;
      case 'sun': return <Sun size={20} className="text-orange-500" aria-hidden="true" />;
      case 'moon': return <Moon size={20} className="text-indigo-500" aria-hidden="true" />;
      case 'heart': return <Heart size={20} className="text-rose-500" aria-hidden="true" />;
      default: return <Check size={20} aria-hidden="true" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-950 pb-20 animate-fade-in-up">
      <header className="px-6 py-8 bg-navy-900 text-white rounded-b-3xl shadow-lg mb-6 relative overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-40 h-40 bg-gold-500/10 rounded-full blur-2xl animate-pulse-subtle"></div>
        
        <div className="flex justify-between items-start mb-2 relative z-10">
            <div>
                <h1 className="text-2xl font-bold mb-1">Minha Rotina</h1>
                <p className="text-navy-200 text-sm mb-6">Construindo hábitos de fé.</p>
            </div>
            <button 
                onClick={onLogout}
                className="p-2.5 bg-white/10 rounded-xl text-navy-100 hover:bg-white/20 hover:text-white transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                title="Sair da conta"
                aria-label="Sair da conta"
            >
                <LogOut size={18} aria-hidden="true" />
            </button>
        </div>
        
        <div className="bg-navy-800/80 backdrop-blur-sm rounded-xl p-4 flex items-center gap-4 relative z-10 border border-white/5" role="group" aria-label="Progresso Diário">
          <div className="relative w-16 h-16 flex items-center justify-center shrink-0" aria-hidden="true">
             <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path className="text-navy-950" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                <path className="text-gold-400 transition-all duration-1000 ease-out" strokeDasharray={`${progress}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
             </svg>
             <span className="absolute text-sm font-bold text-white">{progress}%</span>
          </div>
          <div>
            <div className="text-sm font-medium text-white">Progresso Diário</div>
            <div className="text-xs text-navy-300 mt-1">
              {completedCount} de {habits.length} concluídos
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 max-w-xl mx-auto w-full space-y-3">
        {loading ? (
             <div className="flex justify-center pt-10">
                <Loader2 className="animate-spin text-navy-900 dark:text-white" size={32} aria-hidden="true" />
            </div>
        ) : (
            habits.map((habit) => (
            <button
                key={habit.id}
                onClick={() => toggleHabit(habit.id)}
                aria-pressed={habit.completed}
                className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all duration-300 group focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 active:scale-[0.98] ${
                habit.completed 
                    ? 'bg-white dark:bg-navy-900 border-green-200 dark:border-green-900/30 shadow-sm' 
                    : 'bg-white dark:bg-navy-900 border-slate-100 dark:border-navy-800 shadow-sm hover:border-gold-300 dark:hover:border-gold-600 hover:shadow-md hover:translate-x-1'
                }`}
            >
                <div className="flex items-center gap-4">
                <div className={`p-2.5 rounded-xl transition-colors ${habit.completed ? 'bg-slate-50 dark:bg-navy-800 grayscale opacity-70' : 'bg-slate-50 dark:bg-navy-800 group-hover:bg-gold-50 dark:group-hover:bg-gold-900/20'}`}>
                    {getIcon(habit.icon)}
                </div>
                <div className="text-left">
                    <p className={`font-medium text-sm transition-colors ${habit.completed ? 'text-slate-500 dark:text-slate-500 line-through decoration-slate-300 dark:decoration-slate-600' : 'text-navy-900 dark:text-white'}`}>
                    {habit.label}
                    </p>
                </div>
                </div>
                
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                habit.completed ? 'bg-green-500 border-green-500 scale-100' : 'border-slate-200 dark:border-navy-600 scale-90 group-hover:border-gold-400 dark:group-hover:border-gold-500'
                }`}>
                {habit.completed && <Check size={14} className="text-white" aria-hidden="true" />}
                </div>
            </button>
            ))
        )}

        {progress === 100 && !loading && (
          <div className="mt-8 p-6 bg-gold-100/50 dark:bg-gold-500/10 border border-gold-100 dark:border-gold-500/30 rounded-2xl text-center animate-zoom-in" role="status">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-white dark:bg-navy-900 rounded-full mb-3 shadow-sm text-2xl" aria-hidden="true">
                🏆
            </div>
            <h3 className="text-gold-800 dark:text-gold-400 font-bold mb-1">Parabéns!</h3>
            <p className="text-gold-700 dark:text-gold-300/80 text-xs">Você completou sua rotina espiritual de hoje.</p>
          </div>
        )}
      </div>
    </div>
  );
};
