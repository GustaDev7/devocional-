
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseService';
import { StudyGroup, UserProfile, ChatMessage } from '../types';
import { Plus, Users, MoreVertical, X, Trash2, Edit2, ChevronRight, Loader2, Send, Image as ImageIcon, Bell, BellOff } from 'lucide-react';

interface DevotionalScreenProps {
  user: UserProfile | null;
}

export const DevotionalScreen: React.FC<DevotionalScreenProps> = ({ user }) => {
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeGroup, setActiveGroup] = useState<StudyGroup | null>(null);
  
  // Group Management State
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [isGroupMenuOpen, setIsGroupMenuOpen] = useState(false);
  const [isEditGroupModalOpen, setIsEditGroupModalOpen] = useState(false);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [typingUser, setTypingUser] = useState<{name: string, avatar?: string} | null>(null);
  const [isSending, setIsSending] = useState(false);
  
  // Notification State
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    loadGroups();
    
    // Check notification permission
    if ('Notification' in window) {
        if (Notification.permission === 'granted') {
            setNotificationsEnabled(true);
        }
    }

    // Initialize Notification Sound
    audioRef.current = new Audio('https://cdn.pixabay.com/download/audio/2022/03/24/audio_ff7d8a6057.mp3?filename=pop-39222.mp3');
    if(audioRef.current) audioRef.current.volume = 0.5;

  }, []);

  const requestNotificationPermission = async () => {
      if (!('Notification' in window)) return;
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
          setNotificationsEnabled(true);
          new Notification("Notificações Ativadas", {
              body: "Você receberá alertas de novas mensagens.",
              icon: '/pwa-192x192.png' // Fallback icon
          });
      }
  };

  const loadGroups = async () => {
    setLoading(true);
    try {
        const data = await supabase.fetchGroups();
        setGroups(data);
    } catch (error) {
        console.error(error);
    } finally {
        setLoading(false);
    }
  };

  // --- Group Actions ---
  const handleCreateGroup = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newGroupName.trim()) return;
      try {
          const group = await supabase.createGroup(newGroupName, newGroupDesc);
          setGroups([...groups, group]);
          setIsCreatingGroup(false);
          setNewGroupName('');
          setNewGroupDesc('');
      } catch (error) {
          console.error(error);
      }
  };

  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || !newGroupDesc.trim() || !activeGroup) return;
    try {
        const updatedGroup = await supabase.updateGroup(activeGroup.id, newGroupName, newGroupDesc);
        setGroups(prev => prev.map(g => g.id === updatedGroup.id ? updatedGroup : g));
        setActiveGroup(updatedGroup);
        setIsEditGroupModalOpen(false);
    } catch (error: any) { 
        alert(`Erro ao atualizar: ${error.message || 'Tente novamente.'}`); 
    }
  };

  const handleDeleteGroup = async () => {
      if (!activeGroup) return;
      
      const confirmDelete = window.confirm(
          `Tem certeza que deseja excluir o grupo "${activeGroup.name}"?`
      );
      
      if (!confirmDelete) return;

      setIsDeletingGroup(true);
      try {
          await supabase.deleteGroup(activeGroup.id);
          setGroups(prev => prev.filter(g => g.id !== activeGroup.id));
          setActiveGroup(null);
          setIsGroupMenuOpen(false);
      } catch (error: any) { 
          alert(`Erro ao excluir. ${error.message || 'Verifique se o banco de dados permite a exclusão.'}`); 
      } finally { 
          setIsDeletingGroup(false); 
      }
  };

  const openEditModal = () => {
      if (activeGroup) {
          setNewGroupName(activeGroup.name);
          setNewGroupDesc(activeGroup.description);
          setIsEditGroupModalOpen(true);
          setIsGroupMenuOpen(false);
      }
  };

  // --- Chat Logic ---
  useEffect(() => {
      if (activeGroup) {
          setMessages([]); 
          const loadMessages = async () => {
              const msgs = await supabase.fetchMessages(activeGroup.id);
              const uniqueMsgs = Array.from(new Map(msgs.map(m => [m.id, m])).values());
              setMessages(uniqueMsgs);
              scrollToBottom();
          };
          loadMessages();

          supabase.subscribeToGroupMessages(
              activeGroup.id, 
              (newMsg) => {
                  setMessages(prev => {
                      const exists = prev.some(m => m.id === newMsg.id);
                      if (exists) return prev;
                      
                      // NOTIFICATION LOGIC
                      if (user && newMsg.user_id !== user.id) {
                          // 1. Play Sound
                          audioRef.current?.play().catch(() => {});

                          // 2. Browser Notification (if hidden)
                          if (document.hidden && Notification.permission === 'granted') {
                              new Notification(newMsg.user_name, {
                                  body: newMsg.text,
                                  icon: newMsg.user_avatar || undefined,
                                  tag: 'lumen-chat'
                              });
                          }

                          // 3. Tab Title Flash
                          if (document.hidden) {
                              const originalTitle = document.title;
                              document.title = `(1) ${newMsg.user_name} enviou uma mensagem...`;
                              setTimeout(() => document.title = originalTitle, 4000);
                          }
                      }

                      return [...prev, newMsg];
                  });
                  scrollToBottom();
              },
              (userTyping) => {
                  setTypingUser(userTyping);
                  if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                  typingTimeoutRef.current = setTimeout(() => setTypingUser(null), 3000);
                  scrollToBottom();
              }
          );
      }
  }, [activeGroup, user]);

  const scrollToBottom = () => {
      setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setNewMessage(e.target.value);
      if (activeGroup && user) {
          supabase.sendTypingEvent(activeGroup.id, user);
      }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!newMessage.trim() || !activeGroup || !user) return;

      const tempId = `temp-${Date.now()}`;
      const msgText = newMessage.trim();
      setNewMessage('');
      setIsSending(true);

      const optimisticMsg: ChatMessage = {
          id: tempId,
          group_id: activeGroup.id,
          user_id: user.id,
          user_name: user.name || 'Eu',
          user_avatar: user.avatar_url,
          text: msgText,
          timestamp: new Date().toISOString(),
          is_me: true
      };
      setMessages(prev => [...prev, optimisticMsg]);
      scrollToBottom();

      try {
          const realMsg = await supabase.sendMessage(activeGroup.id, msgText, user);
          setMessages(prev => prev.map(m => m.id === tempId ? { ...realMsg, is_me: true } : m));
      } catch (error: any) {
          console.error("Failed to send", error);
          setMessages(prev => prev.filter(m => m.id !== tempId));
          
          let errorMsg = "Erro ao enviar mensagem.";
          if (error?.message?.includes("row-level security")) {
              errorMsg = "Erro de permissão no Banco de Dados. Rode o Script SQL de 'Limpeza Total' no Supabase.";
          }
          alert(errorMsg);
      } finally {
          setIsSending(false);
      }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0] && activeGroup && user) {
          const file = e.target.files[0];
          setIsSending(true);
          try {
              const url = await supabase.uploadFile(file, 'chat-images');
              if (url) {
                  await supabase.sendMessage(activeGroup.id, '📷 Imagem', user, undefined, url);
              }
          } catch (error) {
              console.error("Upload failed", error);
              alert("Erro ao enviar imagem.");
          } finally {
              setIsSending(false);
          }
      }
  };

  if (activeGroup) {
      return (
          <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-950 animate-slide-in-right">
              {/* Header do Chat */}
              <header className="px-4 py-3 bg-white dark:bg-navy-900 border-b border-slate-100 dark:border-navy-800 flex items-center justify-between sticky top-0 z-30 shadow-sm">
                  <div className="flex items-center gap-3">
                      <button onClick={() => setActiveGroup(null)} className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors">
                          <ChevronRight size={20} className="rotate-180 text-navy-900 dark:text-white" />
                      </button>
                      <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center text-white font-bold shadow-md">
                              {activeGroup.image_url ? (
                                  <img src={activeGroup.image_url} alt="" className="w-full h-full rounded-full object-cover" />
                              ) : (
                                  activeGroup.name.charAt(0).toUpperCase()
                              )}
                          </div>
                          <div>
                              <h1 className="font-bold text-navy-900 dark:text-white leading-tight">{activeGroup.name}</h1>
                              <p className="text-xs text-green-500 font-medium flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                  Online agora
                              </p>
                          </div>
                      </div>
                  </div>
                  <div className="flex items-center gap-1">
                      <button 
                        onClick={requestNotificationPermission}
                        className={`p-2 rounded-full transition-colors ${notificationsEnabled ? 'text-gold-500 bg-gold-50 dark:bg-gold-900/20' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800'}`}
                        title={notificationsEnabled ? "Notificações Ativas" : "Ativar Notificações"}
                      >
                          {notificationsEnabled ? <Bell size={20} /> : <BellOff size={20} />}
                      </button>
                      <div className="relative">
                        <button onClick={() => setIsGroupMenuOpen(!isGroupMenuOpen)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors">
                            <MoreVertical size={20} className="text-navy-900 dark:text-white" />
                        </button>
                        {isGroupMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setIsGroupMenuOpen(false)}></div>
                                <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-navy-900 rounded-xl shadow-xl border border-slate-100 dark:border-navy-800 py-1 z-20 animate-zoom-in">
                                    <button onClick={openEditModal} className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-navy-800 flex items-center gap-3 text-navy-900 dark:text-white transition-colors">
                                        <Edit2 size={16} /> Editar Grupo
                                    </button>
                                    <button onClick={handleDeleteGroup} className="w-full text-left px-4 py-3 text-sm hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center gap-3 text-rose-600 transition-colors">
                                        <Trash2 size={16} /> Excluir Grupo
                                    </button>
                                </div>
                            </>
                        )}
                      </div>
                  </div>
              </header>

              {/* Área de Mensagens */}
              <div className="flex-1 overflow-y-auto px-4 py-4 w-full bg-chat-pattern relative scroll-smooth pb-32 md:pb-4">
                  <div className="space-y-6">
                      {messages.map((msg, index) => {
                          const isMe = msg.user_id === user?.id || msg.is_me;
                          const showAvatar = !isMe && (index === 0 || messages[index - 1].user_id !== msg.user_id);
                          
                          return (
                              <div key={msg.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
                                  <div className={`flex max-w-[85%] md:max-w-[70%] gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                      {/* Avatar (Only for others) */}
                                      {!isMe && (
                                          <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-navy-700 shadow-sm mt-auto ${!showAvatar ? 'invisible' : ''} bg-white dark:bg-navy-800`}>
                                              {msg.user_avatar ? (
                                                  <img src={msg.user_avatar} alt={msg.user_name} className="w-full h-full object-cover" />
                                              ) : (
                                                  <span className="text-xs font-bold text-navy-900 dark:text-white">{msg.user_name.charAt(0)}</span>
                                              )}
                                          </div>
                                      )}

                                      <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                          {!isMe && showAvatar && (
                                              <span className="text-[10px] text-slate-500 dark:text-slate-400 ml-1 mb-1 font-medium">{msg.user_name}</span>
                                          )}
                                          
                                          <div 
                                              className={`px-4 py-3 shadow-sm relative text-sm leading-relaxed break-words ${
                                                  isMe 
                                                  ? 'bg-navy-900 dark:bg-gold-500 text-white rounded-2xl rounded-tr-none' 
                                                  : 'bg-white dark:bg-navy-800 text-navy-900 dark:text-slate-100 border border-slate-100 dark:border-navy-700 rounded-2xl rounded-tl-none'
                                              }`}
                                          >
                                              {msg.image_url && (
                                                  <img src={msg.image_url} alt="Enviada" className="max-w-full rounded-lg mb-2 cursor-pointer hover:opacity-90 transition-opacity" />
                                              )}
                                              {msg.text}
                                              <span className={`text-[9px] block text-right mt-1 opacity-60 font-medium ${isMe ? 'text-white/80' : 'text-slate-400'}`}>
                                                  {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                              </span>
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          );
                      })}
                      
                      {/* Typing Indicator */}
                      {typingUser && typingUser.name !== user?.name && (
                          <div className="flex justify-start animate-fade-in w-full">
                              <div className="flex items-end gap-2">
                                  <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-navy-800 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-navy-700">
                                      {typingUser.avatar ? (
                                          <img src={typingUser.avatar} alt="" className="w-full h-full object-cover" />
                                      ) : (
                                          <Users size={14} className="text-slate-500" />
                                      )}
                                  </div>
                                  <div className="bg-white dark:bg-navy-800 border border-slate-100 dark:border-navy-700 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                                  </div>
                                  <span className="text-xs text-slate-400 mb-1">{typingUser.name} digitando...</span>
                              </div>
                          </div>
                      )}
                      <div ref={messagesEndRef} />
                  </div>
              </div>

              {/* Input Area */}
              <div className="fixed bottom-16 md:bottom-0 md:sticky left-0 right-0 md:w-full bg-white dark:bg-navy-900 border-t border-slate-100 dark:border-navy-800 p-3 md:p-4 z-30 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] md:shadow-none pb-[env(safe-area-inset-bottom)]">
                  <form 
                      onSubmit={handleSendMessage}
                      onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage();
                          }
                      }}
                      className="max-w-4xl mx-auto flex items-end gap-2 md:gap-3 bg-slate-50 dark:bg-navy-950 p-2 rounded-3xl border border-slate-200 dark:border-navy-800 focus-within:border-gold-400 focus-within:ring-1 focus-within:ring-gold-400/50 transition-all shadow-sm"
                  >
                      <button 
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="p-2.5 text-slate-400 hover:text-navy-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-navy-800 rounded-full transition-colors active:scale-95"
                          title="Enviar Imagem"
                      >
                          <ImageIcon size={22} />
                      </button>
                      <input 
                          type="file" 
                          ref={fileInputRef} 
                          className="hidden" 
                          accept="image/*"
                          onChange={handleImageUpload}
                      />
                      
                      <input 
                          type="text" 
                          value={newMessage}
                          onChange={handleInputChange}
                          placeholder="Digite sua mensagem..."
                          className="flex-1 bg-transparent border-none outline-none py-3 text-sm md:text-base text-navy-900 dark:text-white placeholder:text-slate-400 max-h-24"
                          disabled={isSending}
                      />

                      <button 
                          type="submit" 
                          disabled={!newMessage.trim() || isSending}
                          className="p-3 bg-gold-500 hover:bg-gold-600 text-white rounded-full shadow-lg hover:shadow-gold-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-90 flex items-center justify-center aspect-square"
                      >
                          {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} className="ml-0.5" />}
                      </button>
                  </form>
              </div>

               {/* Edit Modal (Copied from list view for context) */}
               {isEditGroupModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-navy-900 w-full max-w-md rounded-2xl p-6 shadow-2xl animate-zoom-in">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg text-navy-900 dark:text-white">Editar Grupo</h3>
                            <button onClick={() => setIsEditGroupModalOpen(false)}><X size={20} className="text-slate-400" /></button>
                        </div>
                        <form onSubmit={handleUpdateGroup} className="space-y-4">
                            <input 
                                value={newGroupName} 
                                onChange={e => setNewGroupName(e.target.value)}
                                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 outline-none focus:ring-2 focus:ring-gold-400 dark:text-white"
                                placeholder="Nome do Grupo"
                            />
                            <textarea 
                                value={newGroupDesc} 
                                onChange={e => setNewGroupDesc(e.target.value)}
                                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 outline-none focus:ring-2 focus:ring-gold-400 dark:text-white"
                                placeholder="Descrição"
                            />
                            <button type="submit" className="w-full bg-navy-900 dark:bg-gold-500 text-white py-3 rounded-xl font-bold">Salvar</button>
                        </form>
                    </div>
                </div>
              )}
          </div>
      );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-950 pb-20 animate-fade-in-up">
        <header className="px-6 py-6 bg-white dark:bg-navy-900 sticky top-0 z-20 border-b border-slate-100 dark:border-navy-800">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h1 className="text-2xl font-bold text-navy-900 dark:text-white">Grupos de Estudo</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Comunidade e crescimento.</p>
                </div>
                <button onClick={() => setIsCreatingGroup(true)} className="p-2 bg-navy-900 dark:bg-gold-500 text-white rounded-full shadow-lg hover:scale-105 active:scale-95 transition-transform">
                    <Plus size={24} />
                </button>
            </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
             {loading ? (
                 <div className="flex justify-center pt-10"><Loader2 className="animate-spin text-navy-900 dark:text-white" /></div>
             ) : (
                 groups.map(group => (
                     <button key={group.id} onClick={() => setActiveGroup(group)} className="w-full bg-white dark:bg-navy-900 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-navy-800 flex items-center gap-4 hover:shadow-md transition-all text-left group">
                         <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center text-white font-bold text-lg group-hover:scale-110 transition-transform shadow-sm">
                             {group.image_url ? <img src={group.image_url} alt="" className="w-full h-full rounded-full object-cover" /> : group.name.charAt(0).toUpperCase()}
                         </div>
                         <div className="flex-1">
                             <h3 className="font-bold text-navy-900 dark:text-white">{group.name}</h3>
                             <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{group.description}</p>
                         </div>
                         <ChevronRight size={18} className="text-slate-300 dark:text-slate-600" />
                     </button>
                 ))
             )}
        </div>

        {/* Create Group Modal */}
        {isCreatingGroup && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/50 backdrop-blur-sm animate-fade-in">
                <div className="bg-white dark:bg-navy-900 w-full max-w-md rounded-2xl p-6 shadow-2xl animate-zoom-in">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg text-navy-900 dark:text-white">Novo Grupo</h3>
                        <button onClick={() => setIsCreatingGroup(false)}><X size={20} className="text-slate-400" /></button>
                    </div>
                    <form onSubmit={handleCreateGroup} className="space-y-4">
                        <input 
                            value={newGroupName} 
                            onChange={e => setNewGroupName(e.target.value)}
                            className="w-full p-3 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 outline-none focus:ring-2 focus:ring-gold-400 dark:text-white placeholder:text-slate-400"
                            placeholder="Nome do Grupo"
                            autoFocus
                        />
                        <textarea 
                            value={newGroupDesc} 
                            onChange={e => setNewGroupDesc(e.target.value)}
                            className="w-full p-3 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 outline-none focus:ring-2 focus:ring-gold-400 dark:text-white placeholder:text-slate-400"
                            placeholder="Descrição curta"
                        />
                        <button type="submit" className="w-full bg-navy-900 dark:bg-gold-500 text-white py-3 rounded-xl font-bold hover:opacity-90 transition-opacity">Criar Grupo</button>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
};
