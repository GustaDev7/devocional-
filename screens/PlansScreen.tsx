
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseService';
import { ReadingPlan, PlanDay } from '../types';
import { getPlanDetails } from '../services/readingPlanData';
import { Calendar, CheckCircle2, ChevronRight, Play, ArrowLeft, Loader2, Check } from 'lucide-react';

export const PlansScreen: React.FC = () => {
  const [plans, setPlans] = useState<ReadingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [planDetails, setPlanDetails] = useState<PlanDay[]>([]);
  const activeDayRef = useRef<HTMLDivElement>(null);

  const loadPlans = async () => {
    setLoading(true);
    const data = await supabase.fetchReadingPlans();
    setPlans(data);
    setLoading(false);
  };

  useEffect(() => {
    loadPlans();
  }, []);

  useEffect(() => {
    if (selectedPlanId) {
        setPlanDetails(getPlanDetails(selectedPlanId));
        // Scroll to active day after render
        setTimeout(() => {
            activeDayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
    }
  }, [selectedPlanId]);

  const handleStartPlan = async (id: string) => {
    await supabase.startPlan(id);
    await loadPlans();
    setSelectedPlanId(id);
  };

  const handleDayClick = async (planId: string, day: number) => {
    const currentPlan = plans.find(p => p.id === planId);
    if (!currentPlan) return;

    // Se clicar em um dia futuro, assume que completou todos até ele?
    // Ou se clicar em um anterior, desmarca?
    // Simplificação: Clicar no dia X define o progresso para X. 
    // Se clicar no dia atual (já feito), volta para X-1.
    
    let newCompletedDays = day;
    if (day === currentPlan.completed_days) {
        newCompletedDays = day - 1; // Toggle off
    }

    // Otimistic Update Local
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, completed_days: newCompletedDays } : p));
    
    // DB Update
    await supabase.updatePlanProgress(planId, newCompletedDays);
  };

  const selectedPlan = plans.find(p => p.id === selectedPlanId);

  // --- RENDER DETAILED VIEW ---
  if (selectedPlanId && selectedPlan) {
      return (
          <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-950 animate-slide-in-right">
              <header className={`px-6 md:px-10 py-6 sticky top-0 z-20 border-b border-slate-100 dark:border-navy-800 flex items-center gap-4 bg-white dark:bg-navy-900 shadow-sm`}>
                  <button 
                    onClick={() => setSelectedPlanId(null)}
                    className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-navy-800 text-navy-900 dark:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 active:scale-90"
                    aria-label="Voltar para lista de planos"
                  >
                      <ArrowLeft size={22} />
                  </button>
                  <div className="flex-1">
                      <h1 className="text-lg font-bold text-navy-900 dark:text-white leading-tight">{selectedPlan.title}</h1>
                      <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 bg-slate-100 dark:bg-navy-800 rounded-full overflow-hidden max-w-[150px]">
                              <div className={`h-full bg-gradient-to-r ${selectedPlan.image_gradient}`} style={{ width: `${(selectedPlan.completed_days / selectedPlan.total_days) * 100}%` }}></div>
                          </div>
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{Math.round((selectedPlan.completed_days / selectedPlan.total_days) * 100)}%</span>
                      </div>
                  </div>
              </header>

              <div className="flex-1 overflow-y-auto px-4 md:px-10 py-6 w-full no-scrollbar">
                  <div className="max-w-3xl mx-auto space-y-3">
                        {planDetails.map((day) => {
                            const isCompleted = day.day <= selectedPlan.completed_days;
                            const isNext = day.day === selectedPlan.completed_days + 1;
                            
                            return (
                                <button
                                    key={day.day}
                                    onClick={() => handleDayClick(selectedPlan.id, day.day)}
                                    ref={isNext ? activeDayRef : null}
                                    className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all duration-200 group focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 active:scale-[0.99] ${
                                        isCompleted 
                                            ? 'bg-white dark:bg-navy-900 border-green-200 dark:border-green-900/30 opacity-60' 
                                            : isNext 
                                                ? 'bg-white dark:bg-navy-900 border-gold-300 dark:border-gold-600 shadow-md ring-1 ring-gold-100 dark:ring-gold-500/20 scale-[1.01]' 
                                                : 'bg-slate-50 dark:bg-navy-950 border-transparent hover:bg-white dark:hover:bg-navy-900 hover:border-slate-200 dark:hover:border-navy-800'
                                    }`}
                                >
                                    <div className="flex items-center gap-4 text-left">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                                            isCompleted ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' : isNext ? 'bg-gold-100 dark:bg-gold-500/20 text-gold-700 dark:text-gold-400' : 'bg-slate-200 dark:bg-navy-800 text-slate-500 dark:text-slate-400'
                                        }`}>
                                            {day.day}
                                        </div>
                                        <div>
                                            <p className={`font-medium ${isCompleted ? 'text-slate-500 dark:text-slate-500 line-through' : 'text-navy-900 dark:text-white'}`}>
                                                {day.readings}
                                            </p>
                                            {isNext && <span className="text-[10px] font-bold text-gold-600 dark:text-gold-400 uppercase tracking-wider">Leitura de Hoje</span>}
                                        </div>
                                    </div>

                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                        isCompleted ? 'bg-green-500 border-green-500' : 'border-slate-300 dark:border-navy-600 group-hover:border-gold-400'
                                    }`}>
                                        {isCompleted && <Check size={14} className="text-white" />}
                                    </div>
                                </button>
                            );
                        })}
                  </div>
              </div>
          </div>
      );
  }

  // --- RENDER LIST VIEW ---
  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-950 pb-20 animate-fade-in-up">
      <header className="px-6 md:px-10 py-8 bg-white dark:bg-navy-900 sticky top-0 z-20 border-b border-slate-100 dark:border-navy-800">
        <div className="max-w-6xl mx-auto w-full">
            <h1 className="text-2xl font-bold text-navy-900 dark:text-white">Planos de Leitura</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Jornadas estruturadas para crescimento espiritual.</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 md:px-10 py-8 w-full no-scrollbar">
        <div className="max-w-6xl mx-auto w-full space-y-8">
            
            {loading ? (
                <div className="flex justify-center pt-20">
                    <Loader2 className="animate-spin text-navy-900 dark:text-white" size={40} />
                </div>
            ) : (
                <>
                    {/* Featured / Active Plans */}
                    <section>
                        <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">Em andamento</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {plans.filter(p => p.is_active).map(plan => (
                                <button 
                                    key={plan.id} 
                                    onClick={() => setSelectedPlanId(plan.id)}
                                    className="bg-white dark:bg-navy-900 rounded-2xl p-6 shadow-soft border border-slate-100 dark:border-navy-800 flex flex-col justify-between h-52 relative overflow-hidden group hover:shadow-lg transition-all duration-300 hover:scale-[1.01] text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                                >
                                    <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${plan.image_gradient} opacity-10 rounded-bl-[100px] transition-transform group-hover:scale-110 duration-500`}></div>
                                    <div>
                                        <span className="text-[10px] font-bold bg-navy-50 dark:bg-navy-800 text-navy-900 dark:text-white px-2 py-1 rounded-md uppercase tracking-wider mb-2 inline-block">{plan.category}</span>
                                        <h3 className="text-xl font-bold text-navy-900 dark:text-white font-serif leading-tight pr-4">{plan.title}</h3>
                                        <p className="text-slate-500 dark:text-slate-400 text-xs mt-2 font-medium">{plan.completed_days} de {plan.total_days} dias concluídos</p>
                                    </div>
                                    
                                    <div className="w-full">
                                        <div className="h-2 w-full bg-slate-100 dark:bg-navy-800 rounded-full overflow-hidden mb-4">
                                            <div className={`h-full bg-gradient-to-r ${plan.image_gradient}`} style={{ width: `${(plan.completed_days / plan.total_days) * 100}%` }}></div>
                                        </div>
                                        <div className="flex items-center justify-between text-navy-900 dark:text-white font-bold text-sm">
                                            <span>Continuar Leitura</span>
                                            <ChevronRight size={18} className="text-gold-500" />
                                        </div>
                                    </div>
                                </button>
                            ))}
                            {plans.filter(p => p.is_active).length === 0 && (
                                <div className="col-span-1 md:col-span-2 py-12 text-center bg-white dark:bg-navy-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-navy-800 flex flex-col items-center justify-center">
                                    <Calendar size={32} className="text-slate-300 dark:text-slate-600 mb-3" />
                                    <p className="text-navy-900 dark:text-white font-bold">Nenhum plano ativo</p>
                                    <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Escolha um plano abaixo para começar sua jornada.</p>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Discover Plans */}
                    <section>
                        <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">Descobrir</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {plans.filter(p => !p.is_active).map(plan => (
                                <div key={plan.id} className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-100 dark:border-navy-800 shadow-sm hover:shadow-lg transition-all overflow-hidden flex flex-col group hover:scale-[1.02] duration-300 h-full">
                                    <div className={`h-28 bg-gradient-to-r ${plan.image_gradient} p-5 flex items-end relative`}>
                                        <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
                                        <h3 className="text-white font-bold font-serif text-lg leading-tight relative z-10 drop-shadow-md">{plan.title}</h3>
                                    </div>
                                    <div className="p-5 flex-1 flex flex-col">
                                        <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-6 flex-1">{plan.description}</p>
                                        
                                        <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-5 pt-4 border-t border-slate-50 dark:border-navy-800">
                                            <span className="flex items-center gap-1.5 bg-slate-50 dark:bg-navy-800 px-2 py-1 rounded-md"><Calendar size={12} /> {plan.total_days} dias</span>
                                            <span className="capitalize bg-slate-50 dark:bg-navy-800 px-2 py-1 rounded-md">{plan.category}</span>
                                        </div>
                                        
                                        <button 
                                            onClick={() => handleStartPlan(plan.id)}
                                            className="w-full py-3 border-2 border-navy-100 dark:border-navy-700 text-navy-900 dark:text-white font-bold rounded-xl hover:bg-navy-900 dark:hover:bg-white hover:text-white dark:hover:text-navy-900 hover:border-navy-900 dark:hover:border-white transition-all active:scale-95 flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                                        >
                                            <Play size={14} fill="currentColor" /> Iniciar Plano
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </>
            )}
        </div>
      </div>
    </div>
  );
};
