
import React, { useState, useEffect, useRef } from 'react';
import { MOCK_DEVOTIONALS, DAILY_VERSES } from '../services/mockData';
import { supabase } from '../services/supabaseService';
import { StudyGroup, ChatMessage, UserProfile } from '../types';
import { BookOpen, Users, ArrowLeft, Send, Plus, X, Loader2, Share2, Palette, MoreVertical, Trash2, Pencil, Heart, Reply, UploadCloud, AlertCircle, Sparkles, Check, ChevronRight } from 'lucide-react';
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
                      // Check for duplicates (existing ID or same content/user recent temp)
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setNewMessageText(e.target.value);
      if (channelRef && user) {
          supabase.sendTypingEvent(channelRef, user);
      }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSendMessage(e);
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

  const handleSendMessage = async (e: React.FormEvent | React.KeyboardEvent) => {
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
      const realMsg = await supabase.sendMessage(activeGroup.id, textToSend, replyContext, undefined, user);
      
      setMessages(prev => {
          // If Realtime already added the message (race condition), remove temp one
          const alreadyExists = prev.some(m => m.id === realMsg.id);
          if (alreadyExists) {
              return prev.filter(m => m.id !== tempId);
          }
          // Otherwise swap temp with real
          return prev.map(m => m.id === tempId ? realMsg : m);
      });

    } catch (error: any) {
      console.error("Erro ao enviar mensagem", error);
      // Remove a mensagem otimista em caso de erro
      setMessages(prev => prev.filter(m => m.id !== tempId));
      
      let errorMsg = "Não foi possível enviar a mensagem.";
      if (error?.code === '42501' || error?.code === '0A000') {
          errorMsg = "Erro de permissão no Banco de Dados. Por favor, rode o script SQL de correção.";
      }
      alert(errorMsg);
    }
  };

  const handleFileProcess = async (file: File) => {
    if (activeGroup && user) {
        setIsSendingImage(true);
        try {
          // Upload
          const publicUrl = await supabase.uploadFile(file, `chat/${activeGroup.id}`);
          if (publicUrl) {
              await supabase.sendMessage(activeGroup.id, "Imagem", undefined, publicUrl, user);
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

  if (activeGroup) {
    return (
      <div 
        className="flex flex-col h-full bg-slate-50 dark:bg-navy-950 relative animate-slide-in-right" 
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <header className="px-4 py-3 bg-white dark:bg-navy-900 border-b border-slate-100 dark:border-navy-800 flex items-center justify-between shadow-sm sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button 
                onClick={() => setActiveGroup(null)}
                className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 active:scale-95"
                aria-label="Voltar para grupos"
            >
              <ArrowLeft size={20} aria-hidden="true" />
            </button>
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gold-100 dark:bg-navy-800 flex items-center justify-center font-bold text-gold-600 dark:text-white shadow-sm ring-2 ring-white dark:ring-navy-700">
                    {activeGroup.name.substring(0, 1)}
                </div>
                <div>
                    <h2 className="font-bold text-navy-900 dark:text-white leading-tight">{activeGroup.name}</h2>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        <span className="text-xs text-green-600 dark:text-green-400 font-medium">Online agora</span>
                    </div>
                </div>
            </div>
          </div>
          <div className="relative">
              <button 
                  onClick={() => setIsGroupMenuOpen(!isGroupMenuOpen)}
                  className="p-2 text-slate-400 hover:text-navy-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800 rounded-full transition-colors active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                  aria-label="Opções do grupo"
              >
                  <MoreVertical size={20} aria-hidden="true" />
              </button>
              
              {isGroupMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsGroupMenuOpen(false)}></div>
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-navy-900 rounded-xl shadow-xl border border-slate-100 dark:border-navy-700 py-1 z-20 animate-zoom-in">
                        <button 
                            onClick={openEditModal}
                            className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 hover:text-navy-900 dark:hover:text-white flex items-center gap-2"
                        >
                            <Pencil size={16} /> Editar Grupo
                        </button>
                        <button 
                            onClick={handleDeleteGroup}
                            className="w-full text-left px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center gap-2"
                        >
                            <Trash2 size={16} /> Excluir Grupo
                        </button>
                    </div>
                  </>
              )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 w-full bg-chat-pattern relative" ref={chatContainerRef}>
            {/* Typing Indicator */}
            {typingUser && (
                <div className="fixed bottom-24 left-4 z-40 animate-fade-in-up">
                    <div className="bg-white/90 dark:bg-navy-800/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg border border-slate-100 dark:border-navy-700 flex items-center gap-3">
                         <div className="relative">
                             <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden ring-2 ring-white dark:ring-navy-600">
                                 {typingUser.avatar ? (
                                     <img src={typingUser.avatar} alt="Avatar" className="w-full h-full object-cover" />
                                 ) : (
                                     <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-500">
                                         {getInitials(typingUser.name)}
                                     </div>
                                 )}
                             </div>
                             <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white dark:border-navy-800 rounded-full"></div>
                         </div>
                         <div className="flex flex-col">
                             <span className="text-[10px] font-bold text-navy-900 dark:text-white leading-none mb-1">{typingUser.name}</span>
                             <div className="flex gap-1">
                                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                             </div>
                         </div>
                    </div>
                </div>
            )}

            <div className="max-w-2xl mx-auto space-y-6 pb-24 md:pb-4 pt-4">
                {messages.length === 0 ? (
                    <div className="text-center py-10 opacity-60">
                        <p className="text-slate-500 dark:text-slate-400 text-sm">Nenhuma mensagem ainda. Diga olá!</p>
                    </div>
                ) : (
                    messages.map((msg, idx) => {
                        const isSequential = idx > 0 && messages[idx - 1].user_id === msg.user_id;
                        const showAvatar = !isSequential || !msg.is_me;
                        const messageReactions = groupReactions(msg.reactions);

                        return (
                        <div key={msg.id} className={`flex flex-col ${msg.is_me ? 'items-end' : 'items-start'} animate-fade-in-up`}>
                            {/* Reply Context */}
                            {msg.reply_to_text && (
                                <div className={`mb-1 text-xs px-3 py-1.5 rounded-lg border-l-2 bg-slate-50/50 dark:bg-navy-800/50 border-slate-300 dark:border-navy-600 text-slate-500 dark:text-slate-400 max-w-[80%] truncate ${msg.is_me ? 'mr-10' : 'ml-10'}`}>
                                    <span className="font-bold mr-1">{msg.reply_to_user}:</span>
                                    {msg.reply_to_text}
                                </div>
                            )}

                            <div className={`flex gap-2 max-w-[85%] ${msg.is_me ? 'flex-row-reverse' : 'flex-row'}`}>
                                {/* Avatar */}
                                {showAvatar ? (
                                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-navy-800 overflow-hidden shrink-0 mt-1 shadow-sm border border-white dark:border-navy-700">
                                        {msg.user_avatar ? (
                                            <img src={msg.user_avatar} alt="Avatar" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                                {getInitials(msg.user_name)}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="w-8 shrink-0"></div>
                                )}

                                {/* Bubble */}
                                <div className="relative group">
                                    <div 
                                        className={`px-4 py-2.5 shadow-sm text-[15px] leading-relaxed relative ${
                                        msg.is_me 
                                            ? 'bg-navy-900 dark:bg-gold-600 text-white rounded-2xl rounded-tr-none' 
                                            : 'bg-white dark:bg-navy-800 text-navy-900 dark:text-slate-100 border border-slate-100 dark:border-navy-700 rounded-2xl rounded-tl-none'
                                        } ${isSequential ? 'mt-0.5' : 'mt-0'}`}
                                    >
                                        {!isSequential && !msg.is_me && (
                                            <p className="text-[10px] font-bold text-gold-600 dark:text-gold-400 mb-1 leading-none">{msg.user_name}</p>
                                        )}
                                        
                                        {msg.image_url ? (
                                            <img 
                                                src={msg.image_url} 
                                                alt="Imagem enviada" 
                                                className="max-w-full rounded-lg mb-1 cursor-pointer hover:opacity-90 transition-opacity border border-white/10"
                                                onClick={() => window.open(msg.image_url, '_blank')}
                                            />
                                        ) : (
                                            <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                                        )}
                                        
                                        <p className={`text-[9px] text-right mt-1 font-medium ${msg.is_me ? 'text-white/60' : 'text-slate-400'}`}>
                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>

                                    {/* Reactions Display */}
                                    {messageReactions.length > 0 && (
                                        <div className={`absolute -bottom-3 ${msg.is_me ? 'right-0' : 'left-0'} flex gap-1 z-10`}>
                                            {messageReactions.map(({emoji, count}) => (
                                                <div key={emoji} className="bg-white dark:bg-navy-700 shadow-sm border border-slate-100 dark:border-navy-600 rounded-full px-1.5 py-0.5 text-[10px] flex items-center gap-0.5 animate-zoom-in">
                                                    <span>{emoji}</span>
                                                    {count > 1 && <span className="font-bold text-slate-600 dark:text-slate-300">{count}</span>}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Context Menu Button (Desktop Hover) */}
                                    <button 
                                        onClick={() => setActiveReactionMsgId(activeReactionMsgId === msg.id ? null : msg.id)}
                                        className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full bg-slate-100 dark:bg-navy-700 text-slate-500 hover:text-navy-900 dark:hover:text-white shadow-sm ${msg.is_me ? '-left-10' : '-right-10'}`}
                                        aria-label="Reagir"
                                    >
                                        <Heart size={14} />
                                    </button>

                                    {/* Reaction Picker Popup */}
                                    {activeReactionMsgId === msg.id && (
                                        <div className={`absolute -top-12 ${msg.is_me ? 'right-0' : 'left-0'} bg-white dark:bg-navy-900 shadow-xl rounded-full p-1.5 flex gap-1 animate-zoom-in z-20 border border-slate-100 dark:border-navy-700`}>
                                            {['❤️', '🙏', '🔥', '😂', '👍'].map(emoji => (
                                                <button 
                                                    key={emoji} 
                                                    onClick={() => handleReaction(msg.id, emoji)}
                                                    className="w-8 h-8 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-full flex items-center justify-center text-lg transition-transform hover:scale-125 active:scale-95"
                                                >
                                                    {emoji}
                                                </button>
                                            ))}
                                            <div className="w-px h-6 bg-slate-100 dark:bg-navy-700 mx-1 self-center"></div>
                                            <button 
                                                onClick={() => { setReplyTo(msg); setActiveReactionMsgId(null); fileInputRef.current?.focus(); }}
                                                className="w-8 h-8 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-full flex items-center justify-center text-slate-500 hover:text-navy-900 transition-colors"
                                                title="Responder"
                                            >
                                                <Reply size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>
        </div>

        {/* Drag Overlay */}
        {isDragging && (
            <div className="absolute inset-0 z-50 bg-navy-900/60 backdrop-blur-sm flex items-center justify-center pointer-events-none animate-fade-in">
                <div className="bg-white dark:bg-navy-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center animate-bounce">
                    <UploadCloud size={48} className="text-gold-500 mb-4" />
                    <h3 className="text-xl font-bold text-navy-900 dark:text-white">Solte para enviar</h3>
                    <p className="text-slate-500 dark:text-slate-400">Envie sua imagem para o grupo</p>
                </div>
            </div>
        )}

        <div className="p-4 bg-white dark:bg-navy-900 border-t border-slate-100 dark:border-navy-800 sticky bottom-0 z-30 pb-safe">
            <div className="max-w-3xl mx-auto">
                {replyTo && (
                    <div className="flex items-center justify-between bg-slate-50 dark:bg-navy-800 px-4 py-2 rounded-t-xl border border-slate-200 dark:border-navy-700 border-b-0 animate-slide-in-right">
                        <div className="flex flex-col border-l-2 border-gold-500 pl-3">
                            <span className="text-xs font-bold text-gold-600 dark:text-gold-400">Respondendo a {replyTo.user_name}</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{replyTo.text || "Imagem"}</span>
                        </div>
                        <button onClick={() => setReplyTo(null)} className="p-1 hover:bg-slate-200 dark:hover:bg-navy-700 rounded-full text-slate-500 transition-colors">
                            <X size={16} />
                        </button>
                    </div>
                )}
                
                <form 
                    onSubmit={handleSendMessage}
                    className={`flex items-center gap-2 bg-slate-50 dark:bg-navy-950 p-2 rounded-3xl border border-slate-200 dark:border-navy-800 focus-within:ring-2 focus-within:ring-gold-400 focus-within:bg-white dark:focus-within:bg-navy-900 transition-all shadow-inner ${replyTo ? 'rounded-t-none' : ''}`}
                >
                    <button 
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-3 text-slate-400 hover:text-navy-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 active:scale-95"
                        aria-label="Adicionar mídia"
                    >
                        <Plus size={22} />
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleImageUpload}
                        aria-hidden="true"
                    />
                    
                    <input 
                        type="text" 
                        value={newMessageText}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder={isSendingImage ? "Enviando imagem..." : "Digite sua mensagem..."}
                        className="flex-1 bg-transparent outline-none text-navy-900 dark:text-white placeholder:text-slate-400 text-sm py-2"
                        disabled={isSendingImage}
                        autoFocus
                    />
                    
                    <button 
                        type="submit" 
                        disabled={(!newMessageText.trim() && !isSendingImage)}
                        className="p-3 bg-gold-500 text-white rounded-full hover:bg-gold-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-900"
                        aria-label="Enviar"
                    >
                        {isSendingImage ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} className="ml-0.5" />}
                    </button>
                </form>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-950 pb-20 animate-fade-in-up">
      <header className="px-6 md:px-10 py-8 pb-4 bg-white dark:bg-navy-900 sticky top-0 z-20 border-b border-slate-100 dark:border-navy-800">
        <div className="flex justify-between items-start max-w-6xl mx-auto w-full">
            <div>
                <h1 className="text-2xl font-bold text-navy-900 dark:text-white">Devocional</h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Conecte-se com a palavra e irmãos.</p>
            </div>
        </div>

        {/* BÚSSOLA EMOCIONAL */}
        <div className="mt-6 mb-4 max-w-6xl mx-auto w-full">
            {!selectedEmotion ? (
                <div className="animate-fade-in">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">Como está seu coração hoje?</p>
                    <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                        {Object.keys(EMOTIONAL_COMPASS).map(emotion => (
                            <button
                                key={emotion}
                                onClick={() => setSelectedEmotion(emotion as keyof typeof EMOTIONAL_COMPASS)}
                                className="px-4 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-full text-sm font-medium text-slate-600 dark:text-slate-300 hover:border-gold-400 hover:text-navy-900 dark:hover:text-white transition-all whitespace-nowrap active:scale-95 capitalize shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                            >
                                {emotion}
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                <div className={`rounded-2xl p-5 relative overflow-hidden animate-zoom-in shadow-soft border-l-4 ${EMOTIONAL_COMPASS[selectedEmotion].color.split(' ')[2].replace('border', 'border-l')}`}>
                    <div className={`absolute inset-0 opacity-20 ${EMOTIONAL_COMPASS[selectedEmotion].color}`}></div>
                    <button 
                        onClick={() => setSelectedEmotion(null)}
                        className="absolute top-3 right-3 p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                    >
                        <X size={16} className="text-slate-500 dark:text-slate-400" />
                    </button>
                    
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1 block">Para quando você está {selectedEmotion}</span>
                    <p className="font-serif text-lg font-bold mb-1 leading-snug">{EMOTIONAL_COMPASS[selectedEmotion].verse}</p>
                    <p className="text-xs font-bold opacity-60 mb-4">— {EMOTIONAL_COMPASS[selectedEmotion].ref}</p>
                    
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 bg-white/60 dark:bg-black/20 p-3 rounded-xl backdrop-blur-sm">
                            <div className="flex items-center gap-2 mb-1 text-xs font-bold opacity-70"><Heart size={12} /> Oração</div>
                            <p className="text-sm italic opacity-90">"{EMOTIONAL_COMPASS[selectedEmotion].prayer}"</p>
                        </div>
                        <div className="flex-1 bg-white/60 dark:bg-black/20 p-3 rounded-xl backdrop-blur-sm">
                            <div className="flex items-center gap-2 mb-1 text-xs font-bold opacity-70"><Sparkles size={12} /> Ação</div>
                            <p className="text-sm opacity-90">{EMOTIONAL_COMPASS[selectedEmotion].action}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>

        <div className="flex gap-6 mt-4 border-b border-slate-100 dark:border-navy-800 max-w-6xl mx-auto w-full">
            <button 
                onClick={() => setActiveTab('daily')}
                className={`pb-3 text-sm font-bold transition-all relative ${activeTab === 'daily' ? 'text-navy-900 dark:text-white' : 'text-slate-400 hover:text-slate-600'}`}
            >
                Diário
                {activeTab === 'daily' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gold-500 rounded-full animate-zoom-in"></div>}
            </button>
            <button 
                onClick={() => setActiveTab('groups')}
                className={`pb-3 text-sm font-bold transition-all relative ${activeTab === 'groups' ? 'text-navy-900 dark:text-white' : 'text-slate-400 hover:text-slate-600'}`}
            >
                Grupos de Estudo
                {activeTab === 'groups' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gold-500 rounded-full animate-zoom-in"></div>}
            </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 md:px-10 py-6 w-full no-scrollbar">
        <div className="max-w-6xl mx-auto w-full">
            {activeTab === 'daily' ? (
                <div className="space-y-8 pb-20 animate-slide-in-right">
                    {/* Verse of the Day Hero */}
                    <div className={`relative rounded-3xl p-8 overflow-hidden text-white shadow-xl group transition-all duration-500 hover:shadow-2xl hover:scale-[1.01] ${selectedTheme.class}`}>
                        <div className="absolute top-0 right-0 p-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-white/20 transition-colors"></div>
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-4">
                                <span className="text-xs font-bold bg-white/20 backdrop-blur-md px-3 py-1 rounded-full uppercase tracking-wider">Versículo do Dia</span>
                                <button 
                                    onClick={() => setIsStudioOpen(true)}
                                    className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors backdrop-blur-md active:scale-95"
                                    title="Criar Imagem"
                                >
                                    <Palette size={18} />
                                </button>
                            </div>
                            <h2 className="text-2xl md:text-3xl font-serif font-bold leading-relaxed mb-4">
                                "{todaysVerse.text}"
                            </h2>
                            <p className="text-sm font-bold opacity-80 border-l-2 border-gold-400 pl-3">
                                {todaysVerse.reference}
                            </p>
                            
                            <div className="mt-6 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-y-2 group-hover:translate-y-0">
                                <button onClick={() => setIsStudioOpen(true)} className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl text-sm font-bold backdrop-blur-sm transition-all active:scale-95">
                                    <Share2 size={16} /> Compartilhar
                                </button>
                            </div>
                        </div>
                    </div>

                    <h3 className="text-lg font-bold text-navy-900 dark:text-white flex items-center gap-2">
                        <BookOpen className="text-gold-500" size={20} /> Devocionais Recentes
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {MOCK_DEVOTIONALS.map(devotional => (
                            <button 
                                key={devotional.id}
                                onClick={() => toggleRead(devotional.id)}
                                className="text-left bg-white dark:bg-navy-900 p-6 rounded-2xl border border-slate-100 dark:border-navy-800 shadow-soft hover:shadow-lg transition-all duration-300 hover:border-gold-300 dark:hover:border-gold-600 group relative overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 active:scale-[0.99]"
                            >
                                <div className={`absolute top-0 left-0 w-1 h-full transition-colors ${readIds.has(devotional.id) ? 'bg-green-400' : 'bg-gold-400 group-hover:bg-gold-500'}`}></div>
                                <div className="flex justify-between items-start mb-3 pl-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 dark:bg-navy-800 px-2 py-1 rounded-md">
                                        {new Date(devotional.date).toLocaleDateString()}
                                    </span>
                                    {readIds.has(devotional.id) && (
                                        <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-zoom-in">
                                            <Check size={10} /> Lido
                                        </span>
                                    )}
                                </div>
                                <h4 className="text-lg font-bold text-navy-900 dark:text-white mb-2 pl-2 group-hover:text-gold-600 dark:group-hover:text-gold-400 transition-colors">{devotional.title}</h4>
                                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed line-clamp-3 mb-4 pl-2">
                                    {devotional.text_content}
                                </p>
                                <div className="pl-2 pt-3 border-t border-slate-50 dark:border-navy-800 flex justify-between items-center">
                                    <span className="text-xs font-bold text-navy-800 dark:text-slate-300">{devotional.reference_verse}</span>
                                    <span className="text-xs text-gold-600 dark:text-gold-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0 flex items-center gap-1">
                                        Ler agora <ArrowLeft className="rotate-180" size={12} />
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="animate-slide-in-right pb-20">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        <button 
                            onClick={() => setIsCreateGroupModalOpen(true)}
                            className="flex flex-col items-center justify-center p-8 bg-white dark:bg-navy-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-navy-700 text-slate-400 hover:text-gold-500 hover:border-gold-300 dark:hover:border-gold-600 hover:bg-gold-50/50 dark:hover:bg-navy-800 transition-all group focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 active:scale-95 h-full min-h-[160px]"
                        >
                            <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-navy-800 group-hover:bg-white dark:group-hover:bg-navy-700 flex items-center justify-center mb-3 transition-colors shadow-sm">
                                <Plus size={24} />
                            </div>
                            <span className="font-bold text-sm">Criar Novo Grupo</span>
                        </button>

                        {groups.map(group => (
                            <button 
                                key={group.id}
                                onClick={() => setActiveGroup(group)}
                                className="text-left bg-white dark:bg-navy-900 p-6 rounded-2xl border border-slate-100 dark:border-navy-800 shadow-soft hover:shadow-lg transition-all hover:-translate-y-1 group relative overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                            >
                                <div className="absolute top-0 right-0 p-16 bg-gradient-to-br from-gold-100 to-transparent dark:from-navy-800 opacity-0 group-hover:opacity-100 transition-opacity rounded-bl-full pointer-events-none"></div>
                                <div className="flex items-center gap-4 mb-4 relative z-10">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-navy-100 to-slate-100 dark:from-navy-800 dark:to-navy-700 flex items-center justify-center text-xl font-bold text-navy-700 dark:text-white shadow-inner">
                                        {group.name.substring(0, 1)}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-navy-900 dark:text-white text-lg leading-tight group-hover:text-gold-600 dark:group-hover:text-gold-400 transition-colors">{group.name}</h4>
                                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1 mt-1">
                                            <Users size={12} /> {group.members_count} membros
                                        </span>
                                    </div>
                                </div>
                                <p className="text-slate-600 dark:text-slate-400 text-sm line-clamp-2 relative z-10 pl-1 border-l-2 border-slate-100 dark:border-navy-700 group-hover:border-gold-300 transition-colors">
                                    {group.description}
                                </p>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* MODAL: IMAGE STUDIO */}
      {isStudioOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/80 backdrop-blur-sm animate-fade-in">
              <div className="bg-white dark:bg-navy-900 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl animate-zoom-in ring-1 ring-white/10">
                  <div className="p-4 border-b border-slate-100 dark:border-navy-800 flex justify-between items-center bg-slate-50 dark:bg-navy-800">
                      <h3 className="font-bold text-navy-900 dark:text-white flex items-center gap-2"><Palette size={18} className="text-gold-500"/> Estúdio Criativo</h3>
                      <button onClick={() => setIsStudioOpen(false)} className="p-1 hover:bg-slate-200 dark:hover:bg-navy-700 rounded-full transition-colors"><X size={20} className="text-slate-500" /></button>
                  </div>
                  
                  <div className="p-6 md:p-8 flex flex-col items-center gap-6">
                      <div className={`w-full aspect-square md:aspect-video rounded-2xl p-8 flex flex-col justify-center items-center text-center shadow-lg transition-all duration-500 ${selectedTheme.class} relative overflow-hidden group`}>
                          <div className="absolute inset-0 bg-black/10"></div>
                          <div className="relative z-10">
                              <p className="font-serif text-xl md:text-2xl font-bold leading-relaxed mb-4 drop-shadow-sm">"{todaysVerse.text}"</p>
                              <p className="text-sm font-bold opacity-80 uppercase tracking-widest">{todaysVerse.reference}</p>
                          </div>
                          <div className="absolute bottom-4 right-4 opacity-50 text-[10px] font-bold uppercase tracking-widest">Lumen App</div>
                      </div>

                      <div className="w-full">
                          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">Escolha um Tema</p>
                          <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                              {THEMES.map(theme => (
                                  <button 
                                      key={theme.id}
                                      onClick={() => setSelectedTheme(theme)}
                                      className={`w-12 h-12 rounded-full shrink-0 border-2 transition-all shadow-sm ${theme.class} ${selectedTheme.id === theme.id ? 'border-navy-900 dark:border-white scale-110 ring-2 ring-gold-400' : 'border-transparent opacity-70 hover:opacity-100 hover:scale-105'}`}
                                      aria-label={`Tema ${theme.name}`}
                                  />
                              ))}
                          </div>
                      </div>

                      <button 
                          onClick={handleShareImage}
                          disabled={isSharing}
                          className="w-full py-4 bg-navy-900 dark:bg-gold-500 text-white font-bold rounded-xl shadow-lg hover:bg-navy-800 dark:hover:bg-gold-600 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                      >
                          {isSharing ? <Loader2 className="animate-spin" /> : <><Share2 size={20} /> Compartilhar Imagem</>}
                      </button>
                      
                      {showShareSuccess && (
                          <div className="text-green-600 dark:text-green-400 text-sm font-bold flex items-center gap-2 animate-fade-in-up">
                              <Check size={16} /> Imagem salva na galeria!
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* MODAL: CREATE GROUP */}
      {isCreateGroupModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white dark:bg-navy-900 w-full max-w-md rounded-2xl shadow-xl p-6 animate-zoom-in ring-1 ring-white/10">
                  <h3 className="text-xl font-bold text-navy-900 dark:text-white mb-4">Novo Grupo de Estudo</h3>
                  <form onSubmit={handleCreateGroup} className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Nome do Grupo</label>
                          <input 
                              type="text" 
                              value={newGroupName}
                              onChange={e => setNewGroupName(e.target.value)}
                              className="w-full p-3 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-xl outline-none focus:ring-2 focus:ring-gold-400 text-navy-900 dark:text-white"
                              placeholder="Ex: Jovens em Cristo"
                              autoFocus
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Descrição</label>
                          <textarea 
                              value={newGroupDesc}
                              onChange={e => setNewGroupDesc(e.target.value)}
                              className="w-full p-3 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-xl outline-none focus:ring-2 focus:ring-gold-400 text-navy-900 dark:text-white resize-none h-24"
                              placeholder="Qual o propósito deste grupo?"
                          />
                      </div>
                      <div className="flex gap-3 pt-2">
                          <button 
                              type="button" 
                              onClick={() => setIsCreateGroupModalOpen(false)}
                              className="flex-1 py-3 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-navy-800 rounded-xl transition-colors"
                          >
                              Cancelar
                          </button>
                          <button 
                              type="submit" 
                              disabled={isCreatingGroup || !newGroupName.trim()}
                              className="flex-1 py-3 bg-navy-900 dark:bg-gold-500 text-white font-bold rounded-xl shadow-md hover:bg-navy-800 dark:hover:bg-gold-600 disabled:opacity-50 transition-all flex items-center justify-center"
                          >
                              {isCreatingGroup ? <Loader2 className="animate-spin" /> : 'Criar Grupo'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* MODAL: EDIT GROUP */}
      {isEditGroupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-navy-900 w-full max-w-md rounded-2xl shadow-xl p-6 animate-zoom-in ring-1 ring-white/10">
                <h3 className="text-xl font-bold text-navy-900 dark:text-white mb-4">Editar Grupo</h3>
                <form onSubmit={handleUpdateGroup} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Nome do Grupo</label>
                        <input 
                            type="text" 
                            value={newGroupName}
                            onChange={e => setNewGroupName(e.target.value)}
                            className="w-full p-3 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-xl outline-none focus:ring-2 focus:ring-gold-400 text-navy-900 dark:text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Descrição</label>
                        <textarea 
                            value={newGroupDesc}
                            onChange={e => setNewGroupDesc(e.target.value)}
                            className="w-full p-3 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-xl outline-none focus:ring-2 focus:ring-gold-400 text-navy-900 dark:text-white resize-none h-24"
                        />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button 
                            type="button" 
                            onClick={() => setIsEditGroupModalOpen(false)}
                            className="flex-1 py-3 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-navy-800 rounded-xl transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit" 
                            disabled={isCreatingGroup || !newGroupName.trim()}
                            className="flex-1 py-3 bg-navy-900 dark:bg-gold-500 text-white font-bold rounded-xl shadow-md hover:bg-navy-800 dark:hover:bg-gold-600 disabled:opacity-50 transition-all flex items-center justify-center"
                        >
                            {isCreatingGroup ? <Loader2 className="animate-spin" /> : 'Salvar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};
