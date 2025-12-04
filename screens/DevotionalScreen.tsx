
import React, { useState, useEffect, useRef } from 'react';
import { MOCK_DEVOTIONALS, DAILY_VERSES } from '../services/mockData';
import { supabase } from '../services/supabaseService';
import { StudyGroup, ChatMessage, UserProfile } from '../types';
import { BookOpen, Users, ArrowLeft, Send, Plus, X, Loader2, Share2, Palette, MoreVertical, Trash2, Pencil, Heart, Reply, UploadCloud } from 'lucide-react';
import { RealtimeChannel } from '@supabase/supabase-js';

const THEMES = [
  { id: 'lumen', name: 'Lumen', class: 'bg-gradient-to-br from-navy-900 via-navy-800 to-navy-950 text-white' },
  { id: 'alvorada', name: 'Alvorada', class: 'bg-gradient-to-br from-orange-400 via-amber-500 to-gold-500 text-white' },
  { id: 'oceano', name: 'Oceano', class: 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white' },
  { id: 'real', name: 'Real', class: 'bg-gradient-to-br from-purple-700 to-pink-600 text-white' },
  { id: 'minimal', name: 'Minimal', class: 'bg-white border-2 border-slate-100 text-navy-900' },
];

interface DevotionalScreenProps {
  user: UserProfile | null;
}

export const DevotionalScreen: React.FC<DevotionalScreenProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'daily' | 'groups'>('daily');
  const [readIds, setReadIds] = useState<Set<string>>(new Set(MOCK_DEVOTIONALS.filter(d => d.is_read).map(d => d.id)));

  // Verse of the Day & Studio State
  const [todaysVerse] = useState(DAILY_VERSES[0]); 
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState(THEMES[0]);
  const [isSharing, setIsSharing] = useState(false);
  const [showShareSuccess, setShowShareSuccess] = useState(false);

  const toggleRead = (id: string) => {
    const newSet = new Set(readIds);
    if (newSet.has(id)) { newSet.delete(id); } else { newSet.add(id); }
    setReadIds(newSet);
  };

  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [activeGroup, setActiveGroup] = useState<StudyGroup | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Chat Feature State
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null);
  const [isSendingImage, setIsSendingImage] = useState(false);
  const [channelRef, setChannelRef] = useState<RealtimeChannel | null>(null);
  
  // UX Features: Drag & Drop + Typing
  const [isDragging, setIsDragging] = useState(false);
  
  // Track specific typing user
  const [typingUser, setTypingUser] = useState<{ name: string, avatar?: string } | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modal State
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [isEditGroupModalOpen, setIsEditGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isGroupMenuOpen, setIsGroupMenuOpen] = useState(false);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);

  // Emotional Compass State
  const [selectedEmotion, setSelectedEmotion] = useState<keyof typeof EMOTIONAL_COMPASS | null>(null);

  useEffect(() => {
    if (activeTab === 'groups') loadGroups();
  }, [activeTab]);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let intervalId: ReturnType<typeof setInterval>;

    if (activeGroup) {
      setMessages([]);
      loadMessages(activeGroup.id).then(() => setTimeout(scrollToBottom, 300));

      try {
          channel = supabase.subscribeToGroupMessages(
              activeGroup.id, 
              (newMsg) => {
                  // Stop typing indicator when message arrives
                  setTypingUser(null);
                  
                  setMessages(prev => {
                      const existing = prev.find(p => p.id === newMsg.id);
                      if (existing) return prev;
                      return [...prev, newMsg];
                  });
                  
                  if (shouldScrollToBottom()) {
                      setTimeout(scrollToBottom, 100);
                  }
              },
              (typingPayload) => {
                  setTypingUser({ name: typingPayload.name, avatar: typingPayload.avatar });
                  if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                  typingTimeoutRef.current = setTimeout(() => setTypingUser(null), 3000);
                  if (shouldScrollToBottom()) setTimeout(scrollToBottom, 100);
              }
          );
          setChannelRef(channel);
      } catch (e) { console.error("Erro realtime:", e); }
      
      // Polling como backup
      intervalId = setInterval(() => loadMessages(activeGroup.id, true), 3000);
    }

    return () => {
      if (channel) supabase.unsubscribe(channel);
      if (intervalId) clearInterval(intervalId);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [activeGroup]);

  // REMOVIDO: useEffect que simulava a "Karen" digitando. 
  // Agora só mostrará eventos reais vindos do Supabase.

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setNewMessageText(e.target.value);
      if (channelRef) {
          supabase.sendTypingEvent(channelRef);
      }
  };

  const loadGroups = async () => {
    const data = await supabase.fetchGroups();
    setGroups(data);
  };

  const loadMessages = async (groupId: string, silent = false) => {
    const fetchedMessages = await supabase.fetchMessages(groupId);
    setMessages(prev => {
        const isDifferent = JSON.stringify(prev) !== JSON.stringify(fetchedMessages);
        
        if (isDifferent) {
            const optimistics = prev.filter(p => p.id.startsWith('temp-'));
            const msgMap = new Map();
            fetchedMessages.forEach(m => msgMap.set(m.id, m));
            optimistics.forEach(op => { if (!msgMap.has(op.id)) msgMap.set(op.id, op); });

            return Array.from(msgMap.values()).sort((a: any, b: any) => 
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
        }
        return prev;
    });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessageText.trim() && !isSendingImage) || !activeGroup || !user) return;

    const textToSend = newMessageText;
    const replyContext = replyTo ? {
        id: replyTo.id,
        user: replyTo.user_name,
        text: replyTo.text
    } : undefined;

    setNewMessageText('');
    setReplyTo(null);

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      group_id: activeGroup.id,
      user_id: user.id,
      user_name: user.name || 'Eu',
      text: textToSend,
      timestamp: new Date().toISOString(),
      is_me: true,
      reply_to_id: replyContext?.id,
      reply_to_user: replyContext?.user,
      reply_to_text: replyContext?.text,
      user_avatar: user.avatar_url
    };
    
    setMessages(prev => [...prev, optimisticMsg]);
    setTimeout(scrollToBottom, 50);

    try {
      const realMsg = await supabase.sendMessage(activeGroup.id, textToSend, replyContext);
      setMessages(prev => prev.map(m => m.id === tempId ? realMsg : m));
    } catch (error) {
      console.error("Erro ao enviar mensagem", error);
    }
  };

  const handleFileProcess = async (file: File) => {
    if (activeGroup && user) {
        setIsSendingImage(true);
        try {
          // Upload
          const publicUrl = await supabase.uploadFile(file, `chat/${activeGroup.id}`);
          if (publicUrl) {
              await supabase.sendMessage(activeGroup.id, "Imagem", undefined, publicUrl);
              setTimeout(scrollToBottom, 500);
          }
        } catch(err) {
            console.error("Erro upload chat", err);
            alert("Erro ao enviar imagem");
        } finally {
            setIsSendingImage(false);
            setIsDragging(false);
        }
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) {
          await handleFileProcess(e.target.files[0]);
      }
  };

  // Drag and Drop Handlers
  const handleDragEnter = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Verificação simples para evitar flickers
      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
      setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
  };

  const handleDrop = async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          const file = e.dataTransfer.files[0];
          if (file.type.startsWith('image/')) {
              await handleFileProcess(file);
          } else {
              alert("Por favor, envie apenas imagens.");
          }
      }
  };

  const handleReaction = async (msgId: string, emoji: string) => {
      setActiveReactionMsgId(null);
      // Otimistic
      setMessages(prev => prev.map(m => {
          if (m.id === msgId && user) {
              const newReactions = { ...m.reactions };
              if (newReactions[user.id] === emoji) delete newReactions[user.id];
              else newReactions[user.id] = emoji;
              return { ...m, reactions: newReactions };
          }
          return m;
      }));
      await supabase.reactToMessage(msgId, emoji);
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newGroupName.trim() || !newGroupDesc.trim()) return;
      setIsCreatingGroup(true);
      try {
          const newGroup = await supabase.createGroup(newGroupName, newGroupDesc);
          await loadGroups();
          setIsCreateGroupModalOpen(false);
          setNewGroupName(''); setNewGroupDesc('');
          setActiveGroup(newGroup);
      } catch (error) { console.error(error); } finally { setIsCreatingGroup(false); }
  };

  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || !newGroupDesc.trim() || !activeGroup) return;
    setIsCreatingGroup(true);
    try {
        const updatedGroup = await supabase.updateGroup(activeGroup.id, newGroupName, newGroupDesc);
        setGroups(prev => prev.map(g => g.id === updatedGroup.id ? updatedGroup : g));
        setActiveGroup(updatedGroup);
        setIsEditGroupModalOpen(false);
    } catch (error) { alert("Erro ao atualizar."); } finally { setIsCreatingGroup(false); }
  };

  const handleDeleteGroup = async () => {
      if (!activeGroup) return;
      if (!window.confirm("Tem certeza?")) return;
      setIsDeletingGroup(true);
      try {
          await supabase.deleteGroup(activeGroup.id);
          setGroups(prev => prev.filter(g => g.id !== activeGroup.id));
          setActiveGroup(null);
      } catch (error) { alert("Erro ao excluir."); } finally { setIsDeletingGroup(false); }
  };

  const openEditModal = () => {
      if (!activeGroup) return;
      setNewGroupName(activeGroup.name);
      setNewGroupDesc(activeGroup.description);
      setIsEditGroupModalOpen(true);
      setIsGroupMenuOpen(false);
  };

  const scrollToBottom = () => { 
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); 
  };
  
  const shouldScrollToBottom = () => {
      if (!chatContainerRef.current) return true;
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      return scrollHeight - scrollTop - clientHeight < 300; // Aumentei a tolerância
  };

  const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : 'U';

  const groupReactions = (reactions: Record<string, string> = {}) => {
      const counts: Record<string, number> = {};
      Object.values(reactions).forEach(r => { counts[r] = (counts[r] || 0) + 1; });
      return Object.entries(counts).map(([emoji, count]) => ({ emoji, count }));
  };

  // Studio Logic
  const handleShareImage = async () => {
    setIsSharing(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setShowShareSuccess(true);
    setIsSharing(false);
    setTimeout(() => { setShowShareSuccess(false); setIsStudioOpen(false); }, 2000);
  };

  // Emotional Compass Data
  const EMOTIONAL_COMPASS = {
    ansioso: {
        verse: "Não andeis ansiosos por coisa alguma; antes em tudo sejam os vossos pedidos conhecidos diante de Deus...",
        ref: "Filipenses 4:6-7",
        prayer: "Senhor, acalma meu coração agitado. Entrego a Ti minhas preocupações.",
        action: "Respire fundo por 10 segundos e solte o ar devagar.",
        color: "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/40 dark:text-teal-200 dark:border-teal-800"
    },
    triste: {
        verse: "Perto está o Senhor dos que têm o coração quebrantado...",
        ref: "Salmos 34:18",
        prayer: "Pai, sinto-me só e triste. Envolve-me com Teu abraço de amor.",
        action: "Ouça um louvor que te traga paz.",
        color: "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-200 dark:border-indigo-800"
    },
    cansado: {
        verse: "Vinde a mim, todos os que estais cansados e oprimidos, e eu vos aliviarei.",
        ref: "Mateus 11:28",
        prayer: "Jesus, meu fardo está pesado. Troco meu cansaço pelo Teu descanso.",
        action: "Tire 15 minutos hoje para não fazer nada, apenas descansar em Deus.",
        color: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800"
    },
    grato: {
        verse: "Em tudo dai graças, porque esta é a vontade de Deus em Cristo Jesus para convosco.",
        ref: "1 Tessalonicenses 5:18",
        prayer: "Deus, obrigado por tudo o que tens feito. Tua fidelidade é grande!",
        action: "Mande uma mensagem para alguém dizendo que você é grato pela vida dela.",
        color: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-800"
    },
    feliz: {
        verse: "A alegria do Senhor é a vossa força.",
        ref: "Neemias 8:10",
        prayer: "Senhor, que minha alegria contagie outros e glorifique o Teu nome!",
        action: "Compartilhe uma boa notícia com alguém.",
        color: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/40 dark:text-rose-200 dark:border-rose-800"
    }
  };

  // ---------------- RENDER ----------------

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-950 relative animate-fade-in-up">
      {/* HEADER */}
      <header className={`bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl border-b border-slate-100 dark:border-navy-800 pt-4 md:pt-6 pb-4 px-6 md:px-10 sticky top-0 z-20 transition-all ${activeGroup ? 'bg-white dark:bg-navy-900 shadow-sm' : ''}`}>
        {activeGroup ? (
            <div className="flex items-center gap-4 animate-slide-in-right duration-300 max-w-5xl mx-auto w-full">
                <button onClick={() => { setActiveGroup(null); setIsGroupMenuOpen(false); }} className="w-10 h-10 rounded-full bg-slate-50 dark:bg-navy-800 hover:bg-slate-100 dark:hover:bg-navy-700 flex items-center justify-center text-navy-900 dark:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 active:scale-95" aria-label="Voltar para lista de grupos">
                    <ArrowLeft size={20} aria-hidden="true" />
                </button>
                <div className="flex-1">
                    <h1 className="text-lg font-bold text-navy-900 dark:text-white leading-tight truncate pr-4">{activeGroup.name}</h1>
                    <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1.5 font-medium mt-0.5">Online agora</span>
                </div>
                <div className="relative">
                    <button onClick={() => setIsGroupMenuOpen(!isGroupMenuOpen)} className="text-navy-900 dark:text-white p-2 hover:bg-slate-50 dark:hover:bg-navy-800 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 active:scale-95" aria-label="Opções do grupo" aria-haspopup="true" aria-expanded={isGroupMenuOpen}><MoreVertical size={20} aria-hidden="true" /></button>
                    {isGroupMenuOpen && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setIsGroupMenuOpen(false)}></div>
                            <div className="absolute right-0 top-full mt-2 w-40 bg-white dark:bg-navy-900 rounded-xl shadow-xl border border-slate-100 dark:border-navy-800 py-1.5 z-20 animate-zoom-in duration-200" role="menu">
                                <button onClick={openEditModal} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 flex items-center gap-2 focus:outline-none focus-bg-slate-50 dark:focus:bg-navy-800" role="menuitem"><Pencil size={14} aria-hidden="true" /> Editar</button>
                                <button onClick={handleDeleteGroup} disabled={isDeletingGroup} className="w-full text-left px-4 py-2.5 text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 flex items-center gap-2 focus:outline-none focus:bg-rose-50 dark:focus:bg-rose-900" role="menuitem">{isDeletingGroup ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Trash2 size={14} aria-hidden="true" />} Excluir</button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        ) : (
            <div className="animate-fade-in-up duration-300 max-w-7xl mx-auto w-full">
                <div className="flex flex-col md:flex-row md:justify-between md:items-end mb-6 gap-4">
                    <div>
                        <h1 className="text-3xl font-serif font-bold text-navy-900 dark:text-white tracking-tight">Comunidade</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">Conecte-se e cresça em fé.</p>
                    </div>
                    {activeTab === 'groups' && (
                         <button onClick={() => { setNewGroupName(''); setNewGroupDesc(''); setIsCreateGroupModalOpen(true); }} className="bg-navy-900 dark:bg-gold-500 text-white p-3 rounded-2xl hover:bg-navy-800 dark:hover:bg-gold-600 transition-all shadow-lg flex items-center gap-2 px-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 active:scale-95"><Plus size={20} aria-hidden="true" /><span className="hidden md:inline font-bold text-sm">Novo Grupo</span></button>
                    )}
                </div>
                <div className="bg-slate-100/80 dark:bg-navy-800/80 p-1.5 rounded-2xl flex relative overflow-hidden max-w-md" role="tablist">
                    <button onClick={() => setActiveTab('daily')} role="tab" aria-selected={activeTab === 'daily'} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 z-10 flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 ${activeTab === 'daily' ? 'bg-white dark:bg-navy-900 text-navy-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}><BookOpen size={16} aria-hidden="true" /> Diário</button>
                    <button onClick={() => setActiveTab('groups')} role="tab" aria-selected={activeTab === 'groups'} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 z-10 flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 ${activeTab === 'groups' ? 'bg-white dark:bg-navy-900 text-navy-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}><Users size={16} aria-hidden="true" /> Grupos</button>
                </div>
            </div>
        )}
      </header>

      <div className="flex-1 overflow-hidden relative">
        {/* DAILY TAB */}
        {activeTab === 'daily' && !activeGroup && (
            <div className="h-full overflow-y-auto px-6 md:px-10 py-6 w-full no-scrollbar pb-32 animate-fade-in-up duration-500">
                <div className="max-w-7xl mx-auto space-y-8">
                    
                    {/* Emotional Compass */}
                    <div className="bg-white dark:bg-navy-900 rounded-[2rem] p-6 shadow-soft border border-slate-50 dark:border-navy-800 relative overflow-hidden transition-all duration-300">
                        <div className="relative z-10">
                            <h2 className="text-lg font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2"><Heart size={18} className="text-gold-500 fill-gold-500" /> Como está seu coração hoje?</h2>
                            
                            {!selectedEmotion ? (
                                <div className="flex flex-wrap gap-2 animate-fade-in">
                                    {Object.keys(EMOTIONAL_COMPASS).map((emotion) => (
                                        <button
                                            key={emotion}
                                            onClick={() => setSelectedEmotion(emotion as keyof typeof EMOTIONAL_COMPASS)}
                                            className="px-4 py-2 rounded-full bg-slate-50 dark:bg-navy-800 hover:bg-navy-50 dark:hover:bg-navy-700 text-slate-600 dark:text-slate-300 hover:text-navy-900 dark:hover:text-white font-medium text-sm transition-all active:scale-95 border border-slate-200 dark:border-navy-700 hover:border-navy-200 dark:hover:border-navy-600 capitalize"
                                        >
                                            {emotion}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="animate-zoom-in">
                                    <div className={`p-5 rounded-2xl border mb-4 ${EMOTIONAL_COMPASS[selectedEmotion].color}`}>
                                        <p className="font-serif text-lg font-bold mb-2">"{EMOTIONAL_COMPASS[selectedEmotion].verse}"</p>
                                        <p className="text-xs font-bold uppercase tracking-widest opacity-70 mb-4">{EMOTIONAL_COMPASS[selectedEmotion].ref}</p>
                                        
                                        <div className="bg-white/50 dark:bg-black/20 rounded-xl p-3 mb-3">
                                            <p className="text-sm italic">💡 <span className="font-bold not-italic">Ação:</span> {EMOTIONAL_COMPASS[selectedEmotion].action}</p>
                                        </div>
                                        
                                        <p className="text-sm">🙏 <span className="font-bold">Oração:</span> {EMOTIONAL_COMPASS[selectedEmotion].prayer}</p>
                                    </div>
                                    <button 
                                        onClick={() => setSelectedEmotion(null)}
                                        className="text-xs font-bold text-slate-400 hover:text-navy-900 dark:hover:text-white transition-colors flex items-center gap-1"
                                    >
                                        <ArrowLeft size={12} /> Escolher outro sentimento
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Verse Hero */}
                    <div 
                        className="w-full relative group cursor-pointer active:scale-[0.99] transition-transform duration-300" 
                        onClick={() => setIsStudioOpen(true)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if(e.key === 'Enter' || e.key === ' ') setIsStudioOpen(true) }}
                        aria-label="Versículo do dia. Toque para criar imagem."
                    >
                        <div className="absolute inset-0 bg-gold-400 rounded-[2rem] blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
                        <div className="relative bg-gradient-to-br from-navy-900 to-navy-800 rounded-[2rem] p-8 md:p-10 text-white overflow-hidden shadow-2xl">
                             <div className="flex justify-between items-start mb-4">
                                <span className="text-[10px] font-bold bg-white/10 px-3 py-1 rounded-full uppercase tracking-widest">Versículo do Dia</span>
                                <Palette size={20} className="text-white/50 group-hover:text-gold-400 transition-colors" />
                             </div>
                             <h2 className="font-serif text-2xl md:text-3xl leading-snug font-bold mb-6 text-center md:text-left">"{todaysVerse.text}"</h2>
                             <p className="text-gold-400 font-bold tracking-wide text-sm md:text-base">— {todaysVerse.reference}</p>
                        </div>
                    </div>

                    {/* Devotionals Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {MOCK_DEVOTIONALS.map((devotional) => {
                            const isRead = readIds.has(devotional.id);
                            return (
                                <div key={devotional.id} className={`bg-white dark:bg-navy-900 rounded-[1.5rem] p-6 shadow-soft border border-slate-50 dark:border-navy-800 hover:shadow-lg transition-transform hover:scale-[1.02] duration-300 relative overflow-hidden flex flex-col h-full ${isRead ? 'opacity-70' : ''}`}>
                                    <h2 className="text-2xl font-bold text-navy-900 dark:text-white mb-3 font-serif leading-tight">{devotional.title}</h2>
                                    <div className="prose prose-slate prose-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6 font-serif line-clamp-4 flex-1">{devotional.text_content}</div>
                                    <button onClick={() => toggleRead(devotional.id)} className="w-full bg-navy-50 dark:bg-navy-800 hover:bg-navy-900 dark:hover:bg-gold-500 hover:text-white text-navy-900 dark:text-white py-3.5 rounded-xl font-bold text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 active:scale-95 transition-transform">
                                        {isRead ? 'LIDO' : 'LER DEVOCIONAL'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        )}

        {/* GROUPS TAB */}
        {activeTab === 'groups' && !activeGroup && (
            <div className="h-full overflow-y-auto px-6 md:px-10 py-6 w-full no-scrollbar pb-32 animate-fade-in-up duration-500">
                <div className="max-w-7xl mx-auto space-y-4">
                    {groups.map((group) => (
                        <button key={group.id} onClick={() => setActiveGroup(group)} className="w-full bg-white dark:bg-navy-900 p-5 rounded-[1.25rem] border border-slate-100 dark:border-navy-800 shadow-soft hover:shadow-lg hover:-translate-y-1 transition-all duration-300 text-left flex items-start gap-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 active:scale-[0.98]">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-navy-800 to-navy-900 text-white flex items-center justify-center font-bold text-lg shadow-md shrink-0" aria-hidden="true">{group.name.charAt(0).toUpperCase()}</div>
                            <div className="flex-1">
                                <h3 className="font-bold text-navy-900 dark:text-white text-base mb-1">{group.name}</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">{group.description}</p>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        )}

        {/* CHAT INTERFACE */}
        {activeGroup && (
            <div 
                className="flex flex-col h-full bg-[#f0f2f5] dark:bg-navy-950 relative animate-zoom-in duration-300"
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)', backgroundSize: '20px 20px', color: 'var(--tw-text-opacity, 1)' }}></div>
                
                {/* Drag Overlay */}
                {isDragging && (
                    <div className="absolute inset-0 z-50 bg-navy-900/80 backdrop-blur-sm flex flex-col items-center justify-center border-4 border-dashed border-gold-400 m-4 rounded-3xl animate-fade-in">
                        <UploadCloud size={64} className="text-gold-400 mb-4 animate-bounce" />
                        <h3 className="text-white text-2xl font-bold">Solte a imagem aqui</h3>
                        <p className="text-slate-300 mt-2">para enviar para o grupo</p>
                    </div>
                )}

                <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-48 md:pb-32 relative z-10 scroll-smooth">
                    <div className="max-w-4xl mx-auto w-full">
                        {messages.map((msg, index) => {
                            const isMe = msg.is_me;
                            const isSequence = index > 0 && messages[index - 1].user_id === msg.user_id;
                            const reactionCounts = groupReactions(msg.reactions);

                            return (
                                <div key={msg.id} className={`flex gap-3 max-w-[85%] md:max-w-[70%] ${isMe ? 'self-end flex-row-reverse ml-auto' : 'self-start flex-row'} group animate-fade-in-up`}>
                                    {!isMe ? (
                                        <div className={`w-8 h-8 rounded-full bg-white dark:bg-navy-800 border border-slate-100 dark:border-navy-700 shadow-sm text-navy-900 dark:text-white flex items-center justify-center text-[10px] font-bold shrink-0 self-end mb-1 overflow-hidden ${isSequence ? 'invisible' : ''}`}>
                                            {msg.user_avatar ? <img src={msg.user_avatar} alt="" className="w-full h-full object-cover"/> : getInitials(msg.user_name)}
                                        </div>
                                    ) : null}

                                    <div className="relative">
                                        <div 
                                            className={`px-4 py-3 shadow-sm relative text-sm leading-relaxed break-words cursor-pointer transition-all active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gold-400 ${isMe ? 'bg-navy-900 text-white rounded-2xl rounded-tr-sm' : 'bg-white dark:bg-navy-900 text-navy-900 dark:text-slate-100 rounded-2xl rounded-tl-sm border border-slate-100 dark:border-navy-800'}`}
                                            onClick={() => setActiveReactionMsgId(activeReactionMsgId === msg.id ? null : msg.id)}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    setActiveReactionMsgId(activeReactionMsgId === msg.id ? null : msg.id);
                                                }
                                            }}
                                            aria-label={`Mensagem de ${msg.user_name}: ${msg.text}. Toque para reagir.`}
                                        >
                                            {/* Reply Context */}
                                            {msg.reply_to_text && (
                                                <div className={`mb-2 text-xs p-2 rounded-lg border-l-2 opacity-80 ${isMe ? 'bg-navy-800 border-gold-400' : 'bg-slate-50 dark:bg-navy-950/50 border-gold-400 text-slate-500 dark:text-slate-400'}`}>
                                                    <span className="font-bold block mb-0.5">{msg.reply_to_user}</span>
                                                    <span className="line-clamp-1">{msg.reply_to_text}</span>
                                                </div>
                                            )}

                                            {!isMe && !isSequence && <span className="block text-[10px] font-bold text-gold-600 dark:text-gold-400 mb-1 uppercase">{msg.user_name}</span>}
                                            
                                            {/* Image Message */}
                                            {msg.image_url ? (
                                                <img src={msg.image_url} alt={`Imagem enviada por ${msg.user_name}`} className="rounded-lg max-w-full mb-1 border border-black/10" loading="lazy" />
                                            ) : (
                                                msg.text
                                            )}
                                        </div>

                                        {/* Reactions Display */}
                                        {reactionCounts.length > 0 && (
                                            <div className={`absolute -bottom-3 ${isMe ? 'right-0' : 'left-0'} flex gap-1`}>
                                                {reactionCounts.map(r => (
                                                    <div key={r.emoji} className="bg-white dark:bg-navy-800 border border-slate-100 dark:border-navy-700 rounded-full px-1.5 py-0.5 text-[10px] shadow-sm flex items-center gap-0.5 animate-zoom-in">
                                                        <span aria-hidden="true">{r.emoji}</span><span className="font-bold text-slate-500 dark:text-slate-400">{r.count}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        
                                        {/* Context Menu */}
                                        {activeReactionMsgId === msg.id && (
                                            <div className={`absolute -top-10 ${isMe ? 'right-0' : 'left-0'} bg-white dark:bg-navy-800 rounded-full shadow-xl border border-slate-100 dark:border-navy-700 p-1 flex items-center gap-1 z-20 animate-zoom-in duration-200`} role="menu">
                                                <button onClick={() => handleReaction(msg.id, '🙏')} className="p-1.5 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-full text-lg focus:outline-none focus-bg-slate-100 active:scale-90 transition-transform" aria-label="Reagir com Mãos em oração" role="menuitem">🙏</button>
                                                <button onClick={() => handleReaction(msg.id, '❤️')} className="p-1.5 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-full text-lg focus:outline-none focus-bg-slate-100 active:scale-90 transition-transform" aria-label="Reagir com Coração" role="menuitem">❤️</button>
                                                <button onClick={() => handleReaction(msg.id, '🔥')} className="p-1.5 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-full text-lg focus:outline-none focus-bg-slate-100 active:scale-90 transition-transform" aria-label="Reagir com Fogo" role="menuitem">🔥</button>
                                                <div className="w-px h-4 bg-slate-200 dark:bg-navy-600 mx-1"></div>
                                                <button onClick={() => { setReplyTo(msg); setActiveReactionMsgId(null); }} className="p-1.5 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-full focus:outline-none focus-bg-slate-100 active:scale-90 transition-transform" aria-label="Responder" role="menuitem"><Reply size={16} className="text-slate-500 dark:text-slate-400" /></button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        
                        {/* Typing Indicator with Name and Avatar */}
                        {typingUser && (
                            <div className="flex gap-3 items-end animate-fade-in-up duration-300 pl-1 mt-2">
                                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 flex items-center justify-center mb-1 overflow-hidden shadow-sm">
                                    {typingUser.avatar ? (
                                        <img src={typingUser.avatar} alt={typingUser.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{getInitials(typingUser.name)}</span>
                                    )}
                                </div>
                                <div className="flex flex-col gap-1">
                                    <div className="bg-white dark:bg-navy-900 border border-slate-100 dark:border-navy-800 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm w-fit">
                                        <div className="flex gap-1.5 h-2 items-center">
                                            <div className="w-1.5 h-1.5 bg-navy-400 dark:bg-slate-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                            <div className="w-1.5 h-1.5 bg-navy-400 dark:bg-slate-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                            <div className="w-1.5 h-1.5 bg-navy-400 dark:bg-slate-500 rounded-full animate-bounce"></div>
                                        </div>
                                    </div>
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium ml-1 animate-pulse">
                                        {typingUser.name} digitando...
                                    </span>
                                </div>
                            </div>
                        )}
                        
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                <div className="absolute bottom-20 md:bottom-0 left-0 right-0 bg-white/90 dark:bg-navy-950/90 backdrop-blur-md px-4 py-3 border-t border-slate-200 dark:border-navy-800 flex flex-col justify-center pb-safe z-30">
                    {replyTo && (
                        <div className="max-w-4xl mx-auto w-full mb-2 bg-slate-100 dark:bg-navy-900 p-2 rounded-xl flex justify-between items-center border-l-4 border-gold-500 animate-fade-in-up">
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                <span className="font-bold text-navy-900 dark:text-white block">Respondendo a {replyTo.user_name}</span>
                                <span className="line-clamp-1">{replyTo.text}</span>
                            </div>
                            <button onClick={() => setReplyTo(null)} aria-label="Cancelar resposta"><X size={16} className="text-slate-400 dark:text-slate-500" aria-hidden="true" /></button>
                        </div>
                    )}
                    <div className="flex items-center gap-3 w-full max-w-4xl mx-auto">
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} aria-hidden="true" />
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2.5 bg-slate-100 dark:bg-navy-800 rounded-full text-slate-400 dark:text-slate-500 hover:text-navy-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-navy-700 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 active:scale-95"
                            aria-label="Enviar Imagem"
                        >
                            {isSendingImage ? <Loader2 className="animate-spin" size={20} aria-hidden="true" /> : <Plus size={20} aria-hidden="true" />}
                        </button>
                        <form onSubmit={handleSendMessage} className="flex-1 flex gap-2 relative">
                            <input 
                                type="text" 
                                className="w-full bg-slate-100 dark:bg-navy-800 rounded-2xl pl-5 pr-12 py-3.5 outline-none focus:ring-2 focus:ring-navy-900/10 dark:focus:ring-gold-500/20 focus:bg-white dark:focus:bg-navy-900 border border-transparent focus:border-navy-900/10 dark:focus:border-gold-500/20 text-sm text-navy-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-500 transition-all shadow-inner"
                                placeholder={user?.email === 'visitante@lumen.app' ? "Visitantes apenas observam..." : "Digite sua mensagem..."}
                                value={newMessageText}
                                onChange={handleInputChange}
                                disabled={user?.email === 'visitante@lumen.app'}
                                aria-label="Digite sua mensagem"
                            />
                            <button type="submit" disabled={(!newMessageText.trim() && !isSendingImage) || user?.email === 'visitante@lumen.app'} className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-navy-900 dark:bg-gold-500 hover:bg-navy-800 dark:hover:bg-gold-600 disabled:bg-slate-300 dark:disabled:bg-navy-700 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition-all shadow-md active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400" aria-label="Enviar"><Send size={16} className="ml-0.5" aria-hidden="true" /></button>
                        </form>
                    </div>
                </div>
            </div>
        )}

        {/* MODALS (Group Create/Edit & Studio) */}
        {isCreateGroupModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-navy-900/60 backdrop-blur-sm animate-fade-in duration-300" role="dialog" aria-modal="true" aria-labelledby="create-group-title">
                <div className="bg-white dark:bg-navy-900 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden p-6 space-y-5 animate-zoom-in ring-1 ring-white/10">
                    <h3 id="create-group-title" className="text-navy-900 dark:text-white font-bold text-lg">Novo Grupo</h3>
                    <input type="text" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-2xl px-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-gold-400 text-navy-900 dark:text-white" placeholder="Nome" autoFocus aria-label="Nome do grupo" />
                    <textarea value={newGroupDesc} onChange={(e) => setNewGroupDesc(e.target.value)} className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-2xl px-4 py-3.5 text-sm outline-none h-24 resize-none focus:ring-2 focus:ring-gold-400 text-navy-900 dark:text-white" placeholder="Descrição" aria-label="Descrição do grupo" />
                    <div className="flex gap-2">
                        <button onClick={() => setIsCreateGroupModalOpen(false)} className="flex-1 py-3 rounded-xl text-slate-500 dark:text-slate-400 font-bold text-sm bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 active:scale-95 transition-transform">Cancelar</button>
                        <button onClick={handleCreateGroup} disabled={isCreatingGroup} className="flex-1 py-3 rounded-xl text-white font-bold text-sm bg-navy-900 dark:bg-gold-500 hover:bg-navy-800 dark:hover:bg-gold-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 active:scale-95 transition-transform">{isCreatingGroup ? '...' : 'Criar'}</button>
                    </div>
                </div>
            </div>
        )}
        
        {isStudioOpen && (
             <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md animate-fade-in duration-300" role="dialog" aria-modal="true" aria-labelledby="studio-title">
                <div className="w-full max-w-md bg-white dark:bg-navy-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-zoom-in duration-300 ring-1 ring-white/10">
                    <div className="px-5 py-4 flex justify-between items-center border-b border-slate-100 dark:border-navy-800 bg-white dark:bg-navy-900 z-10">
                        <h3 id="studio-title" className="text-navy-900 dark:text-white font-bold text-lg flex items-center gap-2">Criar Imagem</h3>
                        <button onClick={() => setIsStudioOpen(false)} className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-navy-800 flex items-center justify-center text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 active:scale-90 transition-transform" aria-label="Fechar"><X size={20} aria-hidden="true" /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-navy-950 flex flex-col items-center">
                        <div className={`w-full aspect-square rounded-2xl shadow-2xl p-8 flex flex-col justify-center items-center text-center relative overflow-hidden transition-all duration-500 ${selectedTheme.class}`}>
                            <div className="relative z-10"><h2 className="font-serif text-2xl font-bold leading-tight mb-6">"{todaysVerse.text}"</h2><p className="font-sans text-sm font-bold tracking-widest uppercase opacity-70">{todaysVerse.reference}</p></div>
                        </div>
                    </div>
                    <div className="p-6 bg-white dark:bg-navy-900 border-t border-slate-100 dark:border-navy-800 space-y-6">
                        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar" role="radiogroup" aria-label="Temas">{THEMES.map(theme => (<button key={theme.id} role="radio" aria-checked={selectedTheme.id === theme.id} aria-label={`Tema ${theme.name}`} onClick={() => setSelectedTheme(theme)} className={`w-12 h-12 rounded-full shrink-0 border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gold-400 active:scale-90 ${theme.class} ${selectedTheme.id === theme.id ? 'ring-2 ring-offset-2 ring-navy-900 dark:ring-white scale-110 border-transparent' : 'border-slate-200 dark:border-navy-700'}`} />))}</div>
                        <button onClick={handleShareImage} disabled={isSharing} className="w-full bg-navy-900 dark:bg-gold-500 hover:bg-navy-800 dark:hover:bg-gold-600 text-white font-bold py-4 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400">{isSharing ? <Loader2 className="animate-spin" size={20} aria-hidden="true" /> : showShareSuccess ? 'Compartilhado!' : 'Compartilhar'}</button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
