
import React, { useState, useEffect, useRef } from 'react';
import { MOCK_DEVOTIONALS, DAILY_VERSES } from '../services/mockData';
import { supabase } from '../services/supabaseService';
import { StudyGroup, ChatMessage, UserProfile } from '../types';
import { PlayCircle, CheckCircle2, Calendar, Users, MessageCircle, ChevronRight, ArrowLeft, Send, Plus, X, Loader2, BookOpen, Share2, Palette, Download, Check, Sparkles, Image as ImageIcon, MoreVertical, Trash2, Pencil } from 'lucide-react';
import { RealtimeChannel } from '@supabase/supabase-js';

const THEMES = [
  { id: 'lumen', name: 'Lumen', class: 'bg-gradient-to-br from-navy-900 via-navy-800 to-navy-950 text-white' },
  { id: 'alvorada', name: 'Alvorada', class: 'bg-gradient-to-br from-orange-400 via-amber-500 to-gold-500 text-white' },
  { id: 'oceano', name: 'Oceano', class: 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white' },
  { id: 'real', name: 'Real', class: 'bg-gradient-to-br from-purple-700 to-pink-600 text-white' },
  { id: 'minimal', name: 'Minimal', class: 'bg-white border-2 border-slate-100 text-navy-900' },
];

export const DevotionalScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'daily' | 'groups'>('daily');
  const [readIds, setReadIds] = useState<Set<string>>(new Set(MOCK_DEVOTIONALS.filter(d => d.is_read).map(d => d.id)));

  // Verse of the Day & Studio State
  const [todaysVerse] = useState(DAILY_VERSES[0]); // Pega o primeiro como exemplo (em prod poderia ser randomico por dia)
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState(THEMES[0]);
  const [isSharing, setIsSharing] = useState(false);
  const [showShareSuccess, setShowShareSuccess] = useState(false);

  const toggleRead = (id: string) => {
    const newSet = new Set(readIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setReadIds(newSet);
  };

  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [activeGroup, setActiveGroup] = useState<StudyGroup | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // Create/Edit Group Modal State
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [isEditGroupModalOpen, setIsEditGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  
  // Group Actions Menu
  const [isGroupMenuOpen, setIsGroupMenuOpen] = useState(false);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);

  // Load user info for "is_me" logic
  useEffect(() => {
    supabase.getCurrentUser().then(setUser => setCurrentUser(setUser));
  }, []);

  useEffect(() => {
    if (activeTab === 'groups') {
      loadGroups();
    }
  }, [activeTab]);

  // CHAT LOGIC: Initial Load + Realtime Subscription + Backup Polling
  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let intervalId: ReturnType<typeof setInterval>;

    if (activeGroup) {
      // 1. Carga Inicial
      setMessages([]); // Limpa mensagens anteriores ao trocar de grupo
      loadMessages(activeGroup.id).then(() => {
          setTimeout(scrollToBottom, 100);
      });

      // 2. Realtime Subscription (Escuta novas mensagens)
      try {
          channel = supabase.subscribeToGroupMessages(activeGroup.id, (newMsg) => {
              // Adiciona mensagem se ela não existir (evita duplicatas da UI otimista)
              setMessages(prev => {
                  if (prev.some(m => m.id === newMsg.id)) return prev;
                  return [...prev, newMsg];
              });
              
              // Scroll suave se for nova mensagem
              if (shouldScrollToBottom()) {
                  setTimeout(scrollToBottom, 100);
              }
          });
      } catch (e) {
          console.error("Erro ao conectar realtime:", e);
      }
      
      // 3. Backup Polling (Sincroniza a cada 5s caso Realtime falhe ou desconecte)
      intervalId = setInterval(() => {
        loadMessages(activeGroup.id, true);
      }, 5000);
    }

    return () => {
      if (channel) supabase.unsubscribe(channel);
      if (intervalId) clearInterval(intervalId);
    };
  }, [activeGroup]);

  const loadGroups = async () => {
    const data = await supabase.fetchGroups();
    setGroups(data);
  };

  // Função inteligente para carregar mensagens sem resetar o scroll
  const loadMessages = async (groupId: string, silent = false) => {
    const fetchedMessages = await supabase.fetchMessages(groupId);
    
    setMessages(prev => {
        // Se tamanhos diferentes, ou o último ID for diferente, atualiza
        if (fetchedMessages.length !== prev.length || 
            (fetchedMessages.length > 0 && prev.length > 0 && fetchedMessages[fetchedMessages.length-1].id !== prev[prev.length-1].id)) {
            
            // Mantém mensagens otimistas que ainda não foram persistidas (ids temporários)
            const optimistics = prev.filter(p => p.id.startsWith('temp-'));
            
            // Cria um Map para remover duplicatas reais
            const msgMap = new Map();
            fetchedMessages.forEach(m => msgMap.set(m.id, m));
            
            // Re-adiciona otimistas que não colidem
            optimistics.forEach(op => {
                if (!msgMap.has(op.id)) msgMap.set(op.id, op);
            });

            return Array.from(msgMap.values()).sort((a: any, b: any) => 
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
        }
        return prev;
    });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim() || !activeGroup || !currentUser) return;

    const textToSend = newMessageText;
    setNewMessageText(''); // UX Instantânea

    // 1. UI Otimista (Mostra mensagem imediatamente)
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      group_id: activeGroup.id,
      user_id: currentUser.id,
      user_name: currentUser.name || 'Eu',
      text: textToSend,
      timestamp: new Date().toISOString(),
      is_me: true
    };
    
    setMessages(prev => [...prev, optimisticMsg]);
    setTimeout(scrollToBottom, 50);

    try {
      // 2. Envia para o servidor
      const realMsg = await supabase.sendMessage(activeGroup.id, textToSend);

      // 3. Substitui a mensagem otimista pela real (troca o ID)
      setMessages(prev => prev.map(m => m.id === tempId ? realMsg : m));
    } catch (error) {
      console.error("Erro ao enviar mensagem", error);
      // Opcional: Marcar mensagem com erro
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newGroupName.trim() || !newGroupDesc.trim()) return;

      setIsCreatingGroup(true);
      try {
          const newGroup = await supabase.createGroup(newGroupName, newGroupDesc);
          await loadGroups();
          setIsCreateGroupModalOpen(false);
          setNewGroupName('');
          setNewGroupDesc('');
          // Abre o grupo recém criado automaticamente
          setActiveGroup(newGroup);
      } catch (error) {
          console.error("Erro ao criar grupo", error);
      } finally {
          setIsCreatingGroup(false);
      }
  };

  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || !newGroupDesc.trim() || !activeGroup) return;

    setIsCreatingGroup(true);
    try {
        const updatedGroup = await supabase.updateGroup(activeGroup.id, newGroupName, newGroupDesc);
        
        // Atualiza lista local
        setGroups(prev => prev.map(g => g.id === updatedGroup.id ? updatedGroup : g));
        // Atualiza header
        setActiveGroup(updatedGroup);
        
        setIsEditGroupModalOpen(false);
        setIsGroupMenuOpen(false);
    } catch (error) {
        console.error("Erro ao atualizar grupo", error);
        alert("Erro ao atualizar grupo.");
    } finally {
        setIsCreatingGroup(false);
    }
  };

  const handleDeleteGroup = async () => {
      if (!activeGroup) return;
      if (!window.confirm("Tem certeza que deseja excluir este grupo? Todas as mensagens serão perdidas.")) return;

      setIsDeletingGroup(true);
      try {
          await supabase.deleteGroup(activeGroup.id);
          setGroups(prev => prev.filter(g => g.id !== activeGroup.id));
          setActiveGroup(null);
          setIsGroupMenuOpen(false);
      } catch (error) {
          console.error("Erro ao deletar grupo", error);
          alert("Erro ao excluir grupo.");
      } finally {
          setIsDeletingGroup(false);
      }
  };

  const openEditModal = () => {
      if (!activeGroup) return;
      setNewGroupName(activeGroup.name);
      setNewGroupDesc(activeGroup.description);
      setIsEditGroupModalOpen(true);
      setIsGroupMenuOpen(false);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const shouldScrollToBottom = () => {
      if (!chatContainerRef.current) return true;
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      // Se o usuário estiver perto do fundo (100px), rola. Se subiu para ler histórico, não rola.
      return scrollHeight - scrollTop - clientHeight < 150;
  };

  // Studio Logic
  const handleShareImage = async () => {
    setIsSharing(true);
    // Simula tempo de geração de imagem
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Versículo do Dia - Lumen',
                text: `"${todaysVerse.text}" - ${todaysVerse.reference}`
            });
            setShowShareSuccess(true);
        } catch (e) { console.log("Share dismissed"); }
    } else {
        // Fallback
        setShowShareSuccess(true);
    }
    
    setIsSharing(false);
    setTimeout(() => {
        setShowShareSuccess(false);
        setIsStudioOpen(false);
    }, 2000);
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const getInitials = (name: string) => {
      return name ? name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : 'U';
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      <header className={`bg-white/80 backdrop-blur-xl border-b border-slate-100 pt-12 md:pt-6 pb-4 px-6 md:px-10 sticky top-0 z-20 transition-all ${activeGroup ? 'bg-white shadow-sm' : ''}`}>
        {activeGroup ? (
            <div className="flex items-center gap-4 animate-in slide-in-from-left duration-300 max-w-5xl mx-auto w-full">
                <button onClick={() => { setActiveGroup(null); setIsGroupMenuOpen(false); }} className="w-10 h-10 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-navy-900 transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <div className="flex-1">
                    <h1 className="text-lg font-bold text-navy-900 leading-tight truncate pr-4">{activeGroup.name}</h1>
                    <span className="text-xs text-green-600 flex items-center gap-1.5 font-medium mt-0.5">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        Online agora
                    </span>
                </div>
                
                <div className="relative">
                    <button 
                        onClick={() => setIsGroupMenuOpen(!isGroupMenuOpen)}
                        className="text-navy-900 p-2 hover:bg-slate-50 rounded-full transition-colors"
                    >
                        <MoreVertical size={20} />
                    </button>

                    {isGroupMenuOpen && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setIsGroupMenuOpen(false)}></div>
                            <div className="absolute right-0 top-full mt-2 w-40 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-20 animate-in fade-in zoom-in-95 duration-200">
                                {/* Permite que qualquer pessoa veja e use os botões */}
                                <button 
                                    onClick={openEditModal}
                                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-navy-900 transition-colors flex items-center gap-2"
                                >
                                    <Pencil size={14} /> Editar
                                </button>
                                <button 
                                    onClick={handleDeleteGroup}
                                    disabled={isDeletingGroup}
                                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-rose-500 hover:bg-rose-50 transition-colors flex items-center gap-2"
                                >
                                    {isDeletingGroup ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                    Excluir
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        ) : (
            <div className="animate-in fade-in duration-300 max-w-7xl mx-auto w-full">
                <div className="flex flex-col md:flex-row md:justify-between md:items-end mb-6 gap-4">
                    <div>
                        <h1 className="text-3xl font-serif font-bold text-navy-900 tracking-tight">Comunidade</h1>
                        <p className="text-slate-500 text-sm mt-1 font-medium">Conecte-se e cresça em fé.</p>
                    </div>
                    {activeTab === 'groups' && (
                         <button 
                            onClick={() => {
                                setNewGroupName('');
                                setNewGroupDesc('');
                                setIsCreateGroupModalOpen(true);
                            }}
                            className="bg-navy-900 text-white p-3 rounded-2xl hover:bg-navy-800 transition-all shadow-lg shadow-navy-900/20 active:scale-95 flex items-center gap-2 px-5"
                         >
                            <Plus size={20} />
                            <span className="hidden md:inline font-bold text-sm">Novo Grupo</span>
                         </button>
                    )}
                </div>

                <div className="bg-slate-100/80 p-1.5 rounded-2xl flex relative overflow-hidden max-w-md">
                    <button 
                        onClick={() => setActiveTab('daily')}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 z-10 flex items-center justify-center gap-2 ${activeTab === 'daily' ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-navy-700'}`}
                    >
                        <BookOpen size={16} className={activeTab === 'daily' ? 'text-gold-500' : 'opacity-50'} />
                        Diário
                    </button>
                    <button 
                        onClick={() => setActiveTab('groups')}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 z-10 flex items-center justify-center gap-2 ${activeTab === 'groups' ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-navy-700'}`}
                    >
                        <Users size={16} className={activeTab === 'groups' ? 'text-gold-500' : 'opacity-50'} />
                        Grupos
                    </button>
                </div>
            </div>
        )}
      </header>

      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'daily' && !activeGroup && (
            <div className="h-full overflow-y-auto px-6 md:px-10 py-6 w-full no-scrollbar pb-32 animate-in fade-in slide-in-from-right-8 duration-500">
                <div className="max-w-7xl mx-auto space-y-8">
                    
                    {/* VERSE OF THE DAY HERO CARD */}
                    <div className="w-full relative group cursor-pointer" onClick={() => setIsStudioOpen(true)}>
                        <div className="absolute inset-0 bg-gold-400 rounded-[2rem] blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
                        <div className="relative bg-gradient-to-br from-navy-900 to-navy-800 rounded-[2rem] p-8 md:p-10 text-white overflow-hidden shadow-2xl">
                            {/* Decorative Elements */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                            <div className="absolute bottom-0 left-0 w-40 h-40 bg-gold-500/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2"></div>
                            
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex items-center gap-2 bg-white/10 backdrop-blur px-3 py-1.5 rounded-lg border border-white/10">
                                        <Sparkles size={14} className="text-gold-400" />
                                        <span className="text-[10px] font-bold tracking-widest uppercase">Versículo do Dia</span>
                                    </div>
                                    <button className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors backdrop-blur">
                                        <Share2 size={18} className="text-white" />
                                    </button>
                                </div>
                                
                                <h2 className="font-serif text-2xl md:text-4xl leading-snug font-bold mb-6 text-center md:text-left">
                                    "{todaysVerse.text}"
                                </h2>
                                
                                <div className="flex items-center justify-between">
                                    <p className="text-gold-400 font-bold tracking-wide text-sm md:text-base">— {todaysVerse.reference}</p>
                                    <div className="flex items-center gap-2 text-xs font-medium opacity-60 group-hover:opacity-100 transition-opacity">
                                        <Palette size={14} />
                                        <span>Criar Imagem</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {MOCK_DEVOTIONALS.map((devotional) => {
                            const isRead = readIds.has(devotional.id);
                            const dateObj = new Date(devotional.date);
                            const dateStr = dateObj.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });

                            return (
                                <div key={devotional.id} className={`bg-white rounded-[1.5rem] p-6 shadow-soft border border-slate-50 transition-all duration-500 hover:shadow-lg group relative overflow-hidden flex flex-col h-full ${isRead ? 'opacity-70' : ''}`}>
                                <div className={`absolute top-0 left-0 w-1.5 h-full transition-colors ${isRead ? 'bg-slate-200' : 'bg-gold-400'}`}></div>
                                <div className="flex justify-between items-start mb-4 pl-2">
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50 px-3 py-1.5 rounded-lg">
                                        <Calendar size={12} />
                                        {dateStr}
                                    </div>
                                    <button onClick={() => toggleRead(devotional.id)} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isRead ? 'bg-green-100 text-green-600' : 'bg-slate-50 text-slate-300 hover:bg-gold-50 hover:text-gold-500'}`}>
                                        <CheckCircle2 size={18} className={isRead ? "fill-current" : ""} />
                                    </button>
                                </div>
                                <div className="pl-2 flex-1 flex flex-col">
                                    <h2 className="text-2xl font-bold text-navy-900 mb-3 font-serif leading-tight group-hover:text-navy-800 transition-colors">{devotional.title}</h2>
                                    <div className="text-sm font-medium text-slate-500 mb-5 font-serif italic border-l-2 border-slate-200 pl-4 py-1">"{devotional.reference_verse}"</div>
                                    <div className="prose prose-slate prose-sm text-slate-600 leading-relaxed mb-6 font-serif line-clamp-4 group-hover:line-clamp-none transition-all flex-1">{devotional.text_content}</div>
                                    <button className="w-full flex items-center justify-center gap-2 bg-navy-50 hover:bg-navy-900 hover:text-white text-navy-900 py-3.5 rounded-xl transition-all font-bold text-sm tracking-wide group-hover:shadow-md mt-auto">
                                        <PlayCircle size={18} /> OUVIR DEVOCIONAL
                                    </button>
                                </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'groups' && !activeGroup && (
            <div className="h-full overflow-y-auto px-6 md:px-10 py-6 w-full no-scrollbar pb-32 animate-in fade-in slide-in-from-left-8 duration-500">
                <div className="max-w-7xl mx-auto space-y-4">
                    <div className="bg-gradient-to-br from-gold-50 to-orange-50 border border-gold-100 rounded-2xl p-5 mb-6 flex items-start gap-4 shadow-sm md:p-8">
                        <div className="bg-white p-3 rounded-full text-gold-600 shadow-sm shrink-0"><Users size={20} /></div>
                        <div>
                            <h3 className="text-base font-bold text-navy-900">Comunidade Viva</h3>
                            <p className="text-xs md:text-sm text-navy-700/80 mt-1 leading-relaxed font-medium">Participe dos grupos, compartilhe testemunhos e cresça em comunhão.</p>
                        </div>
                    </div>
                    {groups.length === 0 ? (
                        <div className="text-center py-20 flex flex-col items-center opacity-60">
                            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-5 animate-pulse"><MessageCircle size={32} className="text-slate-400" /></div>
                            <p className="text-navy-900 text-base font-bold">Nenhum grupo encontrado</p>
                            <p className="text-slate-400 text-sm mt-1 max-w-[200px]">Seja o primeiro a criar um grupo de estudos!</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {groups.map((group) => (
                                <button key={group.id} onClick={() => setActiveGroup(group)} className="w-full bg-white p-5 rounded-[1.25rem] border border-slate-100 shadow-soft hover:shadow-lg hover:-translate-y-1 hover:border-gold-200 transition-all duration-300 text-left group relative overflow-hidden h-full flex flex-col">
                                    <div className="absolute top-0 right-0 p-5 opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0 duration-300"><ChevronRight size={20} className="text-gold-500" /></div>
                                    <div className="flex items-start gap-4 mb-3">
                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-navy-800 to-navy-900 text-white flex items-center justify-center font-bold text-lg shadow-md group-hover:scale-110 transition-transform duration-300 shrink-0">{group.name.charAt(0).toUpperCase()}</div>
                                        <div className="flex-1 pr-4">
                                            <h3 className="font-bold text-navy-900 text-base mb-1 line-clamp-1">{group.name}</h3>
                                            <div className="flex items-center gap-3">
                                                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-bold uppercase tracking-wide">Estudo</span>
                                                <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium"><Users size={12} /> {group.members_count} membros</span>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-sm text-slate-500 line-clamp-2 pl-1 leading-relaxed border-t border-slate-50 pt-3 mt-auto">{group.description}</p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}

        {activeGroup && (
            <div className="flex flex-col h-full bg-[#f0f2f5] relative animate-in zoom-in-95 duration-300">
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

                <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-32 relative z-10 scroll-smooth">
                    <div className="max-w-4xl mx-auto w-full">
                        <div className="flex justify-center my-6">
                            <span className="text-[10px] bg-white/60 backdrop-blur shadow-sm text-slate-500 px-3 py-1 rounded-full uppercase font-bold tracking-widest border border-white/40">Hoje</span>
                        </div>

                        {messages.length === 0 && (
                            <div className="text-center py-20 opacity-50 flex flex-col items-center justify-center h-full">
                                <MessageCircle size={40} className="text-slate-300 mb-4" />
                                <p className="text-sm text-slate-500 font-medium">Inicie a conversa neste grupo.</p>
                            </div>
                        )}

                        {messages.map((msg, index) => {
                            const isMe = msg.is_me;
                            const isSequence = index > 0 && messages[index - 1].user_id === msg.user_id;
                            const isTemp = msg.id.startsWith('temp-');

                            return (
                                <div key={msg.id} className={`flex gap-3 max-w-[85%] md:max-w-[70%] ${isMe ? 'self-end flex-row-reverse ml-auto' : 'self-start flex-row'} animate-in slide-in-from-bottom-2 duration-300`}>
                                    {!isMe && !isSequence ? (
                                        <div className="w-8 h-8 rounded-full bg-white border border-slate-100 shadow-sm text-navy-900 flex items-center justify-center text-[10px] font-bold shrink-0 self-end mb-1">{getInitials(msg.user_name)}</div>
                                    ) : !isMe && isSequence ? ( <div className="w-8 shrink-0"></div> ) : null}

                                    <div className={`px-4 py-3 shadow-sm relative text-sm leading-relaxed break-words ${isMe ? 'bg-navy-900 text-white rounded-2xl rounded-tr-sm shadow-md' : 'bg-white text-navy-900 rounded-2xl rounded-tl-sm border border-slate-100'} ${isTemp ? 'opacity-70' : ''}`}>
                                        {!isMe && !isSequence && (
                                            <span className="block text-[10px] font-bold text-gold-600 mb-1 uppercase tracking-wide">{msg.user_name}</span>
                                        )}
                                        {msg.text}
                                        <div className="flex items-center justify-end gap-1 mt-1">
                                            <span className={`text-[9px] font-medium ${isMe ? 'text-white/60' : 'text-slate-400'}`}>{formatTime(msg.timestamp)}</span>
                                            {isTemp && <Loader2 size={8} className="animate-spin text-white/50" />}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md px-4 py-3 border-t border-slate-200 flex justify-center pb-safe z-30">
                    <div className="flex items-center gap-3 w-full max-w-4xl">
                        <button className="p-2.5 bg-slate-100 rounded-full text-slate-400 hover:text-navy-900 hover:bg-slate-200 transition-colors"><Plus size={20} /></button>
                        <form onSubmit={handleSendMessage} className="flex-1 flex gap-2 relative">
                            <input 
                                type="text" 
                                className="w-full bg-slate-100 rounded-2xl pl-5 pr-12 py-3.5 outline-none focus:ring-2 focus:ring-navy-900/10 focus:bg-white border border-transparent focus:border-navy-900/10 text-sm text-navy-900 placeholder:text-slate-500 transition-all shadow-inner"
                                placeholder={currentUser?.email === 'visitante@lumen.app' ? "Visitantes apenas observam..." : "Digite sua mensagem..."}
                                value={newMessageText}
                                onChange={(e) => setNewMessageText(e.target.value)}
                                disabled={currentUser?.email === 'visitante@lumen.app'}
                            />
                            <button type="submit" disabled={!newMessageText.trim() || currentUser?.email === 'visitante@lumen.app'} className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-navy-900 hover:bg-navy-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition-all shadow-md active:scale-90"><Send size={16} className="ml-0.5" /></button>
                        </form>
                    </div>
                </div>
            </div>
        )}

        {/* CREATE GROUP MODAL */}
        {isCreateGroupModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-navy-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 ring-1 ring-white/20">
                    <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
                        <h3 className="text-navy-900 font-bold text-lg">Novo Grupo</h3>
                        <button onClick={() => setIsCreateGroupModalOpen(false)} className="w-8 h-8 rounded-full bg-white text-slate-400 hover:text-navy-900 flex items-center justify-center shadow-sm transition-colors"><X size={18} /></button>
                    </div>
                    <form onSubmit={handleCreateGroup} className="p-6 space-y-5">
                        <div className="space-y-2">
                            <label className="block text-[11px] font-bold text-navy-900 uppercase tracking-widest">Nome do Grupo</label>
                            <input type="text" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-gold-200 focus:border-gold-400 font-medium" placeholder="Ex: Leitura de Provérbios" autoFocus />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-[11px] font-bold text-navy-900 uppercase tracking-widest">Descrição</label>
                            <textarea value={newGroupDesc} onChange={(e) => setNewGroupDesc(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-gold-200 focus:border-gold-400 resize-none h-28 font-medium" placeholder="Qual o propósito deste grupo?" />
                        </div>
                        <div className="pt-2">
                            <button type="submit" disabled={isCreatingGroup || !newGroupName.trim() || !newGroupDesc.trim()} className="w-full bg-navy-900 hover:bg-navy-800 disabled:opacity-50 text-white font-bold py-4 rounded-2xl shadow-xl shadow-navy-900/10 transition-all flex items-center justify-center gap-2 active:scale-[0.98]">
                                {isCreatingGroup ? <Loader2 size={20} className="animate-spin" /> : 'Criar Comunidade'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {/* EDIT GROUP MODAL */}
        {isEditGroupModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-navy-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 ring-1 ring-white/20">
                    <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
                        <h3 className="text-navy-900 font-bold text-lg">Editar Grupo</h3>
                        <button onClick={() => setIsEditGroupModalOpen(false)} className="w-8 h-8 rounded-full bg-white text-slate-400 hover:text-navy-900 flex items-center justify-center shadow-sm transition-colors"><X size={18} /></button>
                    </div>
                    <form onSubmit={handleUpdateGroup} className="p-6 space-y-5">
                        <div className="space-y-2">
                            <label className="block text-[11px] font-bold text-navy-900 uppercase tracking-widest">Nome do Grupo</label>
                            <input type="text" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-gold-200 focus:border-gold-400 font-medium" placeholder="Nome do Grupo" autoFocus />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-[11px] font-bold text-navy-900 uppercase tracking-widest">Descrição</label>
                            <textarea value={newGroupDesc} onChange={(e) => setNewGroupDesc(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-gold-200 focus:border-gold-400 resize-none h-28 font-medium" placeholder="Descrição" />
                        </div>
                        <div className="pt-2">
                            <button type="submit" disabled={isCreatingGroup || !newGroupName.trim() || !newGroupDesc.trim()} className="w-full bg-navy-900 hover:bg-navy-800 disabled:opacity-50 text-white font-bold py-4 rounded-2xl shadow-xl shadow-navy-900/10 transition-all flex items-center justify-center gap-2 active:scale-[0.98]">
                                {isCreatingGroup ? <Loader2 size={20} className="animate-spin" /> : 'Salvar Alterações'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {/* IMAGE CREATION STUDIO MODAL */}
        {isStudioOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md animate-in fade-in duration-300">
                <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
                    <div className="px-5 py-4 flex justify-between items-center border-b border-slate-100 bg-white z-10">
                        <h3 className="text-navy-900 font-bold text-lg flex items-center gap-2">
                            <ImageIcon size={18} className="text-gold-500" />
                            Criar Imagem
                        </h3>
                        <button onClick={() => setIsStudioOpen(false)} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-navy-900 transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50 flex flex-col items-center">
                        {/* Preview Area */}
                        <div 
                            className={`w-full aspect-square rounded-2xl shadow-2xl p-8 flex flex-col justify-center items-center text-center relative overflow-hidden transition-all duration-500 ${selectedTheme.class}`}
                        >
                            {/* Texture Overlay */}
                            <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] mix-blend-overlay pointer-events-none"></div>
                            
                            <div className="relative z-10">
                                <span className="inline-block mb-4 opacity-80">
                                    <Sparkles size={24} />
                                </span>
                                <h2 className="font-serif text-2xl md:text-3xl font-bold leading-tight mb-6">
                                    "{todaysVerse.text}"
                                </h2>
                                <p className="font-sans text-sm font-bold tracking-widest uppercase opacity-70">
                                    {todaysVerse.reference}
                                </p>
                            </div>

                            <div className="absolute bottom-4 left-0 right-0 text-center">
                                <p className="text-[10px] font-bold tracking-widest uppercase opacity-40">Lumen App</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 bg-white border-t border-slate-100 space-y-6">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Escolha um Tema</p>
                            <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                                {THEMES.map(theme => (
                                    <button
                                        key={theme.id}
                                        onClick={() => setSelectedTheme(theme)}
                                        className={`w-12 h-12 rounded-full shrink-0 border-2 transition-all ${theme.class} ${selectedTheme.id === theme.id ? 'ring-2 ring-offset-2 ring-navy-900 scale-110 border-transparent shadow-lg' : 'border-slate-200 hover:scale-105'}`}
                                        title={theme.name}
                                    />
                                ))}
                            </div>
                        </div>

                        <button 
                            onClick={handleShareImage}
                            disabled={isSharing}
                            className="w-full bg-navy-900 hover:bg-navy-800 text-white font-bold py-4 rounded-2xl shadow-xl shadow-navy-900/10 transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-70"
                        >
                            {isSharing ? (
                                <Loader2 className="animate-spin" size={20} />
                            ) : showShareSuccess ? (
                                <>
                                    <Check size={20} />
                                    <span>Compartilhado!</span>
                                </>
                            ) : (
                                <>
                                    {navigator.share ? <Share2 size={20} /> : <Download size={20} />}
                                    <span>{navigator.share ? 'Compartilhar' : 'Salvar Imagem'}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
