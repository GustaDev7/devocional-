
import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../services/supabaseService';
import { AIChatMessage } from '../types';
import { Send, Sparkles, User, Loader2, Bot, Info } from 'lucide-react';

const SUGGESTIONS = [
  "O que a Bíblia diz sobre ansiedade?",
  "Explique a parábola do Filho Pródigo",
  "Como posso orar com mais fé?",
  "Quem foi o Apóstolo Paulo?",
];

export const AIScreen: React.FC = () => {
  const [messages, setMessages] = useState<AIChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: 'Olá! Sou o Lumen, seu assistente teológico. Como posso ajudar você a crescer na fé hoje?',
      timestamp: new Date().toISOString()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: AIChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: text,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // Placeholder for loading state
    const loadingId = 'loading-' + Date.now();
    setMessages(prev => [...prev, { id: loadingId, role: 'model', text: '', timestamp: new Date().toISOString(), is_loading: true }]);

    try {
      const responseText = await supabase.askLumen(text);
      
      setMessages(prev => prev.map(m => 
        m.id === loadingId 
          ? { ...m, text: responseText, is_loading: false } 
          : m
      ));
    } catch (error) {
       setMessages(prev => prev.map(m => 
        m.id === loadingId 
          ? { ...m, text: "Desculpe, tive um problema ao processar sua pergunta. Tente novamente.", is_loading: false } 
          : m
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const formatText = (text: string) => {
    // Simple markdown formatting for bold and lists
    return text.split('\n').map((line, i) => {
        if (line.startsWith('**') && line.endsWith('**')) {
            return <strong key={i} className="block mb-2 text-navy-900 dark:text-white">{line.replace(/\*\*/g, '')}</strong>;
        }
        if (line.includes('**')) {
             const parts = line.split('**');
             return (
                 <p key={i} className="mb-2">
                     {parts.map((part, idx) => idx % 2 === 1 ? <strong key={idx}>{part}</strong> : part)}
                 </p>
             )
        }
        if (line.startsWith('* ') || line.startsWith('- ')) {
            return <li key={i} className="ml-4 list-disc marker:text-gold-500 mb-1">{line.substring(2)}</li>
        }
        return <p key={i} className="mb-2 last:mb-0">{line}</p>;
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-950 relative animate-fade-in-up">
       {/* Background Decoration */}
       <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
           <div className="absolute -top-20 -right-20 w-96 h-96 bg-gold-400/10 rounded-full blur-3xl animate-pulse-subtle"></div>
           <div className="absolute top-40 -left-20 w-72 h-72 bg-navy-900/5 rounded-full blur-3xl animate-pulse-subtle"></div>
       </div>

       <header className="px-6 md:px-10 py-4 bg-white/80 dark:bg-navy-900/80 backdrop-blur-md sticky top-0 z-20 border-b border-slate-100 dark:border-navy-800 flex items-center gap-3">
           <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-navy-800 to-navy-900 dark:from-navy-700 dark:to-navy-800 flex items-center justify-center text-gold-400 shadow-lg shadow-navy-900/10 transition-transform hover:scale-105 duration-300">
               <Sparkles size={20} />
           </div>
           <div>
               <h1 className="text-lg font-bold text-navy-900 dark:text-white">Lumen AI</h1>
               <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Seu assistente teológico pessoal</p>
           </div>
       </header>

       <div className="flex-1 overflow-y-auto px-4 md:px-10 py-6 w-full relative z-10 pb-32 md:pb-4 scroll-smooth">
           <div className="max-w-3xl mx-auto space-y-6">
               {messages.map((msg) => (
                   <div key={msg.id} className={`flex gap-4 animate-fade-in-up ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                       <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-sm ${msg.role === 'user' ? 'bg-navy-100 dark:bg-navy-800 text-navy-800 dark:text-white' : 'bg-gold-100 dark:bg-gold-900/20 text-gold-700 dark:text-gold-400'}`}>
                           {msg.role === 'user' ? <User size={16} /> : <Bot size={18} />}
                       </div>
                       
                       <div className={`relative px-5 py-4 rounded-2xl shadow-sm text-sm leading-relaxed max-w-[85%] transition-transform hover:scale-[1.01] ${
                           msg.role === 'user' 
                           ? 'bg-navy-900 text-white rounded-tr-sm' 
                           : 'bg-white dark:bg-navy-900 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-navy-800 rounded-tl-sm'
                       }`}>
                           {msg.is_loading ? (
                               <div className="flex gap-1.5 h-4 items-center">
                                   <div className="w-2 h-2 bg-gold-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                   <div className="w-2 h-2 bg-gold-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                   <div className="w-2 h-2 bg-gold-400 rounded-full animate-bounce"></div>
                               </div>
                           ) : (
                               <div>{formatText(msg.text)}</div>
                           )}
                       </div>
                   </div>
               ))}
               <div ref={messagesEndRef} />
           </div>
       </div>

       {/* Suggestions (only show if few messages) */}
       {messages.length < 3 && (
           <div className="px-4 pb-2 max-w-3xl mx-auto w-full flex gap-2 overflow-x-auto no-scrollbar z-10 animate-fade-in fixed bottom-36 md:bottom-20 left-0 right-0 md:relative md:bottom-auto">
               {SUGGESTIONS.map((s, i) => (
                   <button 
                       key={i} 
                       onClick={() => handleSend(s)}
                       className="whitespace-nowrap px-4 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-full text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-gold-400 hover:text-navy-900 dark:hover:text-gold-400 transition-all shadow-sm flex-shrink-0 active:scale-95"
                   >
                       {s}
                   </button>
               ))}
           </div>
       )}

       <div className="fixed bottom-16 md:bottom-0 md:sticky left-0 right-0 md:w-full bg-white dark:bg-navy-900 border-t border-slate-100 dark:border-navy-800 p-4 z-30 pb-[env(safe-area-inset-bottom)]">
           <form 
               onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
               className="max-w-3xl mx-auto relative flex items-center gap-2"
           >
               <input 
                   type="text" 
                   value={input}
                   onChange={(e) => setInput(e.target.value)}
                   placeholder="Faça uma pergunta sobre a Bíblia..."
                   className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 rounded-2xl pl-5 pr-12 py-3.5 outline-none focus:ring-2 focus:ring-gold-400 focus:bg-white dark:focus:bg-navy-900 transition-all shadow-inner text-sm text-navy-900 dark:text-white placeholder:text-slate-400"
                   disabled={isLoading}
               />
               <button 
                   type="submit" 
                   disabled={!input.trim() || isLoading}
                   className="absolute right-2 p-2 bg-navy-900 dark:bg-gold-500 text-white rounded-xl hover:bg-navy-800 dark:hover:bg-gold-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
               >
                   {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
               </button>
           </form>
           <p className="text-[10px] text-center text-slate-400 dark:text-slate-500 mt-2 flex items-center justify-center gap-1">
               <Info size={10} /> O Lumen AI pode cometer erros. Verifique informações importantes.
           </p>
       </div>
    </div>
  );
};
