
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseService';
import { PrayerRequest } from '../types';
import { Heart, Plus, User, Loader2, Send, HandHeart } from 'lucide-react';

export const PrayerScreen: React.FC = () => {
  const [prayers, setPrayers] = useState<PrayerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  const [newRequestText, setNewRequestText] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchPrayers = async () => {
    setLoading(true);
    const data = await supabase.fetchPrayers();
    setPrayers(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchPrayers();
  }, []);

  const handlePrayClick = async (id: string) => {
    await supabase.incrementPrayerCount(id);
    setPrayers(curr => curr.map(p => {
      if (p.id === id) {
        return { ...p, prayed_count: p.prayed_count + 1, i_prayed: true };
      }
      return p;
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRequestText.trim()) return;
    
    setSubmitting(true);
    try {
        const newPrayer = await supabase.createPrayer(newRequestText, isAnonymous);
        setPrayers([newPrayer, ...prayers]);
        setNewRequestText('');
        setShowForm(false);
    } catch (error) {
        console.error("Erro ao criar oração", error);
        alert("Não foi possível enviar seu pedido. Tente novamente.");
    } finally {
        setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-950 pb-20 relative animate-fade-in-up">
      <header className="px-6 md:px-10 py-6 md:py-8 pb-2 bg-white dark:bg-navy-900 sticky top-0 z-20 border-b border-slate-100 dark:border-navy-800">
        <div className="flex justify-between items-center max-w-6xl mx-auto w-full">
          <div>
            <h1 className="text-2xl font-bold text-navy-900 dark:text-white">Mural de Oração</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Intercedendo uns pelos outros.</p>
          </div>
          <button 
            onClick={() => setShowForm(!showForm)}
            className="w-10 h-10 rounded-full bg-navy-900 dark:bg-gold-500 text-white flex items-center justify-center shadow-lg hover:bg-navy-800 dark:hover:bg-gold-600 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 active:scale-90"
            aria-label={showForm ? "Cancelar novo pedido" : "Criar novo pedido de oração"}
            aria-expanded={showForm}
          >
            {showForm ? <span className="text-xl font-bold" aria-hidden="true">−</span> : <Plus size={24} aria-hidden="true" />}
          </button>
        </div>
      </header>

      {showForm && (
        <div className="bg-white dark:bg-navy-900 px-6 md:px-10 py-4 border-b border-slate-100 dark:border-navy-800 animate-fade-in-up">
          <form onSubmit={handleSubmit} className="max-w-6xl mx-auto w-full">
            <textarea
              value={newRequestText}
              onChange={(e) => setNewRequestText(e.target.value)}
              placeholder="Como podemos orar por você hoje?"
              className="w-full p-3 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 text-navy-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent resize-none h-24 text-sm transition-all"
              autoFocus
              aria-label="Texto do pedido de oração"
            />
            <div className="flex justify-between items-center mt-3">
              <label className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-400 text-xs select-none">
                <input 
                  type="checkbox" 
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="rounded text-navy-900 dark:text-gold-500 focus:ring-gold-400 border-slate-300 dark:border-navy-600"
                />
                Postar como Anônimo
              </label>
              <button 
                type="submit" 
                disabled={submitting || !newRequestText.trim()}
                className="bg-gold-500 hover:bg-gold-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-900 active:scale-95"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}
                Enviar Pedido
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 md:px-10 py-4 w-full no-scrollbar">
        <div className="max-w-6xl mx-auto w-full h-full">
            {loading ? (
                <div className="flex justify-center pt-20">
                    <Loader2 className="animate-spin text-navy-900 dark:text-white" size={32} aria-hidden="true" />
                </div>
            ) : prayers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full max-h-[60vh] text-center px-4 animate-zoom-in duration-500">
                    <div className="w-24 h-24 bg-slate-100 dark:bg-navy-900 rounded-full flex items-center justify-center mb-6" aria-hidden="true">
                        <HandHeart size={48} className="text-slate-300 dark:text-slate-500" />
                    </div>
                    <h3 className="text-xl font-bold text-navy-900 dark:text-white mb-2">Seja o primeiro a pedir oração</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs mb-8">
                        Nossa comunidade está pronta para interceder por você. Compartilhe seu pedido ou agradecimento.
                    </p>
                    <button 
                        onClick={() => setShowForm(true)}
                        className="bg-navy-900 dark:bg-gold-500 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg hover:bg-navy-800 dark:hover:bg-gold-600 transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                    >
                        Criar Pedido de Oração
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20 animate-fade-in-up">
                    {prayers.map((prayer) => (
                        <div key={prayer.id} className="bg-white dark:bg-navy-900 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-navy-800 hover:shadow-md hover:scale-[1.01] transition-all duration-300 h-full flex flex-col group">
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${prayer.is_anonymous ? 'bg-slate-200 dark:bg-navy-800 text-slate-500 dark:text-slate-400' : 'bg-navy-100 dark:bg-navy-700 text-navy-800 dark:text-slate-200'}`} aria-hidden="true">
                                <User size={16} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-navy-900 dark:text-white">{prayer.is_anonymous ? 'Anônimo' : prayer.author_name}</p>
                                <p className="text-[10px] text-slate-400">
                                {new Date(prayer.created_at).toLocaleDateString('pt-BR')}
                                </p>
                            </div>
                            </div>
                            <div className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${prayer.status === 'answered' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'}`}>
                            {prayer.status === 'answered' ? 'Respondido' : 'Pendente'}
                            </div>
                        </div>
                        
                        <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed mb-4 line-clamp-4 hover:line-clamp-none transition-all flex-1">
                            {prayer.request_text}
                        </p>

                        <div className="flex justify-end mt-auto pt-4 border-t border-slate-50 dark:border-navy-800">
                            <button 
                            onClick={() => handlePrayClick(prayer.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 active:scale-90 ${
                                prayer.i_prayed 
                                ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50' 
                                : 'bg-slate-50 dark:bg-navy-800 text-slate-500 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-500 border border-transparent'
                            }`}
                            aria-label={prayer.i_prayed ? "Você já orou por este pedido" : "Orar por este pedido"}
                            >
                            <Heart size={16} className={prayer.i_prayed ? "fill-rose-600 dark:fill-rose-500" : ""} aria-hidden="true" />
                            <span className="text-xs font-semibold">
                                {prayer.i_prayed ? 'Você orou' : 'Orei por você'}
                            </span>
                            <span className="text-xs opacity-60 border-l border-current pl-1.5 ml-1">
                                {prayer.prayed_count}
                            </span>
                            </button>
                        </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
