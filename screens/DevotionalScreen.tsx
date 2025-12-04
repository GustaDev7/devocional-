
import React, { useState, useEffect, useRef } from 'react';
import { MOCK_DEVOTIONALS, DAILY_VERSES } from '../services/mockData';
import { supabase } from '../services/supabaseService';
import { StudyGroup, ChatMessage, UserProfile } from '../types';
import { PlayCircle, CheckCircle2, Calendar, Users, MessageCircle, ChevronRight, ArrowLeft, Send, Plus, X, Loader2, BookOpen, Share2, Palette, Download, Check, Sparkles, Image as ImageIcon, MoreVertical, Trash2, Pencil, Heart, Flame, Reply, Smile } from 'lucide-react';
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
  // currentUser is now passed via props as 'user'
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Chat Feature State
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null);
  const [isSendingImage, setIsSendingImage] = useState(false);

  // Modal State
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [isEditGroupModalOpen, setIsEditGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isGroupMenuOpen, setIsGroupMenuOpen] = useState(false);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);

  useEffect(() => {
    if (activeTab === 'groups') loadGroups();
  }, [activeTab]);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let intervalId: ReturnType<typeof setInterval>;

    if (activeGroup) {
      setMessages([]);
      loadMessages(activeGroup.id).then(() => setTimeout(scrollToBottom, 100));

      try {
          channel = supabase.subscribeToGroupMessages(activeGroup.id, (newMsg) => {
              setMessages(prev => {
                  const existing = prev.find(p => p.id === newMsg.id);
                  if (existing) return prev;
                  // Se for update (reaction), a lógica seria diferente, mas simplificado aqui
                  return [...prev, newMsg];
              });
              if (shouldScrollToBottom()) setTimeout(scrollToBottom, 100);
          });
      } catch (e) { console.error("Erro realtime:", e); }
      
      intervalId = setInterval(() => loadMessages(activeGroup.id, true), 3000);
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

  const loadMessages = async (groupId: string, silent = false) => {
    const fetchedMessages = await supabase.fetchMessages(groupId);
    setMessages(prev => {
        // Simple diff check to allow reaction updates
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
      user_avatar: user.avatar_url // Uses the latest avatar from props
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0] && activeGroup && user) {
          setIsSendingImage(true);
          const file = e.target.files[0];
          
          try {
            // Upload
            const publicUrl = await supabase.uploadFile(file, `chat/${activeGroup.id}`);
            if (publicUrl) {
                // Send Message with Image
                await supabase.sendMessage(activeGroup.id, "Imagem", undefined, publicUrl);
                // Refresh will happen via polling/subscription
            }
          } catch(err) {
              console.error("Erro upload chat", err);
              alert("Erro ao enviar imagem");
          } finally {
              setIsSendingImage(false);
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

  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); };
  const shouldScrollToBottom = () => {
      if (!chatContainerRef.current) return true;
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      return scrollHeight - scrollTop - clientHeight < 150;
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

  // ---------------- RENDER ----------------

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      {/* HEADER */}
      <header className={`bg-white/80 backdrop-blur-xl border-b border-slate-100 pt-12 md:pt-6 pb-4 px-6 md:px-10 sticky top-0 z-20 transition-all ${activeGroup ? 'bg-white shadow-sm' : ''}`}>
        {activeGroup ? (
            <div className="flex items-center gap-4 animate-in slide-in-from-left duration-300 max-w-5xl mx-auto w-full">
                <button onClick={() => { setActiveGroup(null); setIsGroupMenuOpen(false); }} className="w-10 h-10 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-navy-900 transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <div className="flex-1">
                    <h1 className="text-lg font-bold text-navy-900 leading-tight truncate pr-4">{activeGroup.name}</h1>
                    <span className="text-xs text-green-600 flex items-center gap-1.5 font-medium mt-0.5">Online agora</span>
                </div>
                <div className="relative">
                    <button onClick={() => setIsGroupMenuOpen(!isGroupMenuOpen)} className="text-navy-900 p-2 hover:bg-slate-50 rounded-full"><MoreVertical size={20} /></button>
                    {isGroupMenuOpen && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setIsGroupMenuOpen(false)}></div>
                            <div className="absolute right-0 top-full mt-2 w-40 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-20 animate-in fade-in zoom-in-95 duration-200">
                                <button onClick={openEditModal} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2"><Pencil size={14} /> Editar</button>
                                <button onClick={handleDeleteGroup} disabled={isDeletingGroup} className="w-full text-left px-4 py-2.5 text-xs font-bold text-rose-500 hover:bg-rose-50 flex items-center gap-2">{isDeletingGroup ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Excluir</button>
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
                         <button onClick={() => { setNewGroupName(''); setNewGroupDesc(''); setIsCreateGroupModalOpen(true); }} className="bg-navy-900 text-white p-3 rounded-2xl hover:bg-navy-800 transition-all shadow-lg flex items-center gap-2 px-5"><Plus size={20} /><span className="hidden md:inline font-bold text-sm">Novo Grupo</span></button>
                    )}
                </div>
                <div className="bg-slate-100/80 p-1.5 rounded-2xl flex relative overflow-hidden max-w-md">
                    <button onClick={() => setActiveTab('daily')} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 z-10 flex items-center justify-center gap-2 ${activeTab === 'daily' ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500'}`}><BookOpen size={16} /> Diário</button>
                    <button onClick={() => setActiveTab('groups')} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 z-10 flex items-center justify-center gap-2 ${activeTab === 'groups' ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500'}`}><Users size={16} /> Grupos</button>
                </div>
            </div>
        )}
      </header>

      <div className="flex-1 overflow-hidden relative">
        {/* DAILY TAB */}
        {activeTab === 'daily' && !activeGroup && (
            <div className="h-full overflow-y-auto px-6 md:px-10 py-6 w-full no-scrollbar pb-32 animate-in fade-in slide-in-from-right-8 duration-500">
                <div className="max-w-7xl mx-auto space-y-8">
                    {/* Verse Hero */}
                    <div className="w-full relative group cursor-pointer" onClick={() => setIsStudioOpen(true)}>
                        <div className="absolute inset-0 bg-gold-400 rounded-[2rem] blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
                        <div className="relative bg-gradient-to-br from-navy-900 to-navy-800 rounded-[2rem] p-8 md:p-10 text-white overflow-hidden shadow-2xl">
                             <h2 className="font-serif text-2xl md:text-4xl leading-snug font-bold mb-6 text-center md:text-left">"{todaysVerse.text}"</h2>
                             <p className="text-gold-400 font-bold tracking-wide text-sm md:text-base">— {todaysVerse.reference}</p>
                        </div>
                    </div>
                    {/* Devotionals Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {MOCK_DEVOTIONALS.map((devotional) => {
                            const isRead = readIds.has(devotional.id);
                            return (
                                <div key={devotional.id} className={`bg-white rounded-[1.5rem] p-6 shadow-soft border border-slate-50 hover:shadow-lg relative overflow-hidden flex flex-col h-full ${isRead ? 'opacity-70' : ''}`}>
                                    <h2 className="text-2xl font-bold text-navy-900 mb-3 font-serif leading-tight">{devotional.title}</h2>
                                    <div className="prose prose-slate prose-sm text-slate-600 leading-relaxed mb-6 font-serif line-clamp-4 flex-1">{devotional.text_content}</div>
                                    <button onClick={() => toggleRead(devotional.id)} className="w-full bg-navy-50 hover:bg-navy-900 hover:text-white text-navy-900 py-3.5 rounded-xl font-bold text-sm">
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
            <div className="h-full overflow-y-auto px-6 md:px-10 py-6 w-full no-scrollbar pb-32 animate-in fade-in slide-in-from-left-8 duration-500">
                <div className="max-w-7xl mx-auto space-y-4">
                    {groups.map((group) => (
                        <button key={group.id} onClick={() => setActiveGroup(group)} className="w-full bg-white p-5 rounded-[1.25rem] border border-slate-100 shadow-soft hover:shadow-lg hover:-translate-y-1 transition-all duration-300 text-left flex items-start gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-navy-800 to-navy-900 text-white flex items-center justify-center font-bold text-lg shadow-md shrink-0">{group.name.charAt(0).toUpperCase()}</div>
                            <div className="flex-1">
                                <h3 className="font-bold text-navy-900 text-base mb-1">{group.name}</h3>
                                <p className="text-sm text-slate-500 line-clamp-1">{group.description}</p>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        )}

        {/* CHAT INTERFACE */}
        {activeGroup && (
            <div className="flex flex-col h-full bg-[#f0f2f5] relative animate-in zoom-in-95 duration-300">
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                
                <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-48 md:pb-32 relative z-10 scroll-smooth">
                    <div className="max-w-4xl mx-auto w-full">
                        {messages.map((msg, index) => {
                            const isMe = msg.is_me;
                            const isSequence = index > 0 && messages[index - 1].user_id === msg.user_id;
                            const reactionCounts = groupReactions(msg.reactions);

                            return (
                                <div key={msg.id} className={`flex gap-3 max-w-[85%] md:max-w-[70%] ${isMe ? 'self-end flex-row-reverse ml-auto' : 'self-start flex-row'} group`}>
                                    {!isMe && !isSequence ? (
                                        <div className="w-8 h-8 rounded-full bg-white border border-slate-100 shadow-sm text-navy-900 flex items-center justify-center text-[10px] font-bold shrink-0 self-end mb-1 overflow-hidden">
                                            {msg.user_avatar ? <img src={msg.user_avatar} alt="" className="w-full h-full object-cover"/> : getInitials(msg.user_name)}
                                        </div>
                                    ) : !isMe && isSequence ? ( <div className="w-8 shrink-0"></div> ) : null}

                                    <div className="relative">
                                        <div 
                                            className={`px-4 py-3 shadow-sm relative text-sm leading-relaxed break-words cursor-pointer transition-all active:scale-[0.98] ${isMe ? 'bg-navy-900 text-white rounded-2xl rounded-tr-sm' : 'bg-white text-navy-900 rounded-2xl rounded-tl-sm border border-slate-100'}`}
                                            onClick={() => setActiveReactionMsgId(activeReactionMsgId === msg.id ? null : msg.id)}
                                        >
                                            {/* Reply Context */}
                                            {msg.reply_to_text && (
                                                <div className={`mb-2 text-xs p-2 rounded-lg border-l-2 opacity-80 ${isMe ? 'bg-navy-800 border-gold-400' : 'bg-slate-50 border-gold-400 text-slate-500'}`}>
                                                    <span className="font-bold block mb-0.5">{msg.reply_to_user}</span>
                                                    <span className="line-clamp-1">{msg.reply_to_text}</span>
                                                </div>
                                            )}

                                            {!isMe && !isSequence && <span className="block text-[10px] font-bold text-gold-600 mb-1 uppercase">{msg.user_name}</span>}
                                            
                                            {/* Image Message */}
                                            {msg.image_url ? (
                                                <img src={msg.image_url} alt="Sent" className="rounded-lg max-w-full mb-1 border border-black/10" loading="lazy" />
                                            ) : (
                                                msg.text
                                            )}
                                        </div>

                                        {/* Reactions Display */}
                                        {reactionCounts.length > 0 && (
                                            <div className={`absolute -bottom-3 ${isMe ? 'right-0' : 'left-0'} flex gap-1`}>
                                                {reactionCounts.map(r => (
                                                    <div key={r.emoji} className="bg-white border border-slate-100 rounded-full px-1.5 py-0.5 text-[10px] shadow-sm flex items-center gap-0.5">
                                                        <span>{r.emoji}</span><span className="font-bold text-slate-500">{r.count}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        
                                        {/* Context Menu */}
                                        {activeReactionMsgId === msg.id && (
                                            <div className={`absolute -top-10 ${isMe ? 'right-0' : 'left-0'} bg-white rounded-full shadow-xl border border-slate-100 p-1 flex items-center gap-1 z-20 animate-in zoom-in duration-200`}>
                                                <button onClick={() => handleReaction(msg.id, '🙏')} className="p-1.5 hover:bg-slate-100 rounded-full text-lg">🙏</button>
                                                <button onClick={() => handleReaction(msg.id, '❤️')} className="p-1.5 hover:bg-slate-100 rounded-full text-lg">❤️</button>
                                                <button onClick={() => handleReaction(msg.id, '🔥')} className="p-1.5 hover:bg-slate-100 rounded-full text-lg">🔥</button>
                                                <div className="w-px h-4 bg-slate-200 mx-1"></div>
                                                <button onClick={() => { setReplyTo(msg); setActiveReactionMsgId(null); }} className="p-1.5 hover:bg-slate-100 rounded-full"><Reply size={16} className="text-slate-500" /></button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                <div className="absolute bottom-20 md:bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md px-4 py-3 border-t border-slate-200 flex flex-col justify-center pb-safe z-30">
                    {replyTo && (
                        <div className="max-w-4xl mx-auto w-full mb-2 bg-slate-100 p-2 rounded-xl flex justify-between items-center border-l-4 border-gold-500">
                            <div className="text-xs text-slate-500">
                                <span className="font-bold text-navy-900 block">Respondendo a {replyTo.user_name}</span>
                                <span className="line-clamp-1">{replyTo.text}</span>
                            </div>
                            <button onClick={() => setReplyTo(null)}><X size={16} className="text-slate-400" /></button>
                        </div>
                    )}
                    <div className="flex items-center gap-3 w-full max-w-4xl mx-auto">
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2.5 bg-slate-100 rounded-full text-slate-400 hover:text-navy-900 hover:bg-slate-200 transition-colors"
                        >
                            {isSendingImage ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                        </button>
                        <form onSubmit={handleSendMessage} className="flex-1 flex gap-2 relative">
                            <input 
                                type="text" 
                                className="w-full bg-slate-100 rounded-2xl pl-5 pr-12 py-3.5 outline-none focus:ring-2 focus:ring-navy-900/10 focus:bg-white border border-transparent focus:border-navy-900/10 text-sm text-navy-900 placeholder:text-slate-500 transition-all shadow-inner"
                                placeholder={user?.email === 'visitante@lumen.app' ? "Visitantes apenas observam..." : "Digite sua mensagem..."}
                                value={newMessageText}
                                onChange={(e) => setNewMessageText(e.target.value)}
                                disabled={user?.email === 'visitante@lumen.app'}
                            />
                            <button type="submit" disabled={(!newMessageText.trim() && !isSendingImage) || user?.email === 'visitante@lumen.app'} className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-navy-900 hover:bg-navy-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition-all shadow-md active:scale-90"><Send size={16} className="ml-0.5" /></button>
                        </form>
                    </div>
                </div>
            </div>
        )}

        {/* MODALS (Group Create/Edit & Studio) */}
        {isCreateGroupModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-navy-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden p-6 space-y-5 animate-in zoom-in-95">
                    <h3 className="text-navy-900 font-bold text-lg">Novo Grupo</h3>
                    <input type="text" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-sm outline-none" placeholder="Nome" autoFocus />
                    <textarea value={newGroupDesc} onChange={(e) => setNewGroupDesc(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-sm outline-none h-24 resize-none" placeholder="Descrição" />
                    <div className="flex gap-2">
                        <button onClick={() => setIsCreateGroupModalOpen(false)} className="flex-1 py-3 rounded-xl text-slate-500 font-bold text-sm bg-slate-100">Cancelar</button>
                        <button onClick={handleCreateGroup} disabled={isCreatingGroup} className="flex-1 py-3 rounded-xl text-white font-bold text-sm bg-navy-900">{isCreatingGroup ? '...' : 'Criar'}</button>
                    </div>
                </div>
            </div>
        )}
        
        {isStudioOpen && (
             <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md animate-in fade-in duration-300">
                <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
                    <div className="px-5 py-4 flex justify-between items-center border-b border-slate-100 bg-white z-10">
                        <h3 className="text-navy-900 font-bold text-lg flex items-center gap-2">Criar Imagem</h3>
                        <button onClick={() => setIsStudioOpen(false)} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400"><X size={20} /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50 flex flex-col items-center">
                        <div className={`w-full aspect-square rounded-2xl shadow-2xl p-8 flex flex-col justify-center items-center text-center relative overflow-hidden transition-all duration-500 ${selectedTheme.class}`}>
                            <div className="relative z-10"><h2 className="font-serif text-2xl font-bold leading-tight mb-6">"{todaysVerse.text}"</h2><p className="font-sans text-sm font-bold tracking-widest uppercase opacity-70">{todaysVerse.reference}</p></div>
                        </div>
                    </div>
                    <div className="p-6 bg-white border-t border-slate-100 space-y-6">
                        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">{THEMES.map(theme => (<button key={theme.id} onClick={() => setSelectedTheme(theme)} className={`w-12 h-12 rounded-full shrink-0 border-2 transition-all ${theme.class} ${selectedTheme.id === theme.id ? 'ring-2 ring-offset-2 ring-navy-900 scale-110 border-transparent' : 'border-slate-200'}`} />))}</div>
                        <button onClick={handleShareImage} disabled={isSharing} className="w-full bg-navy-900 hover:bg-navy-800 text-white font-bold py-4 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 active:scale-[0.98]">{isSharing ? <Loader2 className="animate-spin" size={20} /> : showShareSuccess ? 'Compartilhado!' : 'Compartilhar'}</button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
