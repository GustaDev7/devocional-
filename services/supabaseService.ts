import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { UserProfile, PrayerRequest, StudyGroup, ChatMessage, ReadingPlan } from '../types';
import { GoogleGenAI } from "@google/genai";

// Credenciais fornecidas
const SUPABASE_URL = 'https://yyxfposhfurploozfegy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5eGZwb3NoZnVycGxvb3pmZWd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3ODcwNzYsImV4cCI6MjA4MDM2MzA3Nn0.FLC475deGtM9dukLT8gm80tlSWTYtyzKuDBhmO6FNhI';

class SupabaseService {
  private client: SupabaseClient;
  private isGuest: boolean = false;
  private genAI: GoogleGenAI;
  private guestId: string | null = null;
  private guestName: string | null = null;

  constructor() {
    this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    this.genAI = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    
    // Tenta recuperar sessão de visitante do storage para persistência durante refresh
    if (typeof window !== 'undefined') {
        const storedGuest = localStorage.getItem('lumen_guest_session');
        if (storedGuest) {
            try {
                const parsed = JSON.parse(storedGuest);
                this.guestId = parsed.id;
                this.guestName = parsed.name;
            } catch (e) {}
        }
    }
  }

  // --- AI Feature (Lumen) ---
  async askLumen(prompt: string): Promise<string> {
    try {
        const response = await this.genAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: "Você é o Lumen, um assistente teológico cristão acolhedor, sábio e sereno. Sua missão é ajudar o usuário a entender a Bíblia, oferecer conselhos baseados na fé cristã e explicar conceitos teológicos com clareza. Use referências bíblicas (livro, capítulo e versículo) sempre que possível. Formate sua resposta usando Markdown para melhor leitura (negrito para versículos, listas para pontos chave). Seja conciso, mas profundo. Se a pergunta não for sobre fé ou teologia, gentilmente traga o assunto de volta para uma perspectiva espiritual.",
            }
        });
        return response.text || "Desculpe, não consegui formular uma resposta no momento. Tente novamente.";
    } catch (error) {
        console.error("Lumen AI Error:", error);
        return "Estou tendo dificuldades para conectar com a sabedoria divina no momento. Por favor, verifique sua conexão ou tente mais tarde.";
    }
  }

  // --- Auth & Profile ---

  async signInWithEmail(email: string, password: string): Promise<{ user: UserProfile | null, error: any }> {
    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password
    });

    if (error) return { user: null, error };
    
    if (data.user) {
        this.isGuest = false;
        this.guestId = null;
        localStorage.removeItem('lumen_guest_session');
        return {
            user: {
                id: data.user.id,
                email: data.user.email || '',
                name: data.user.user_metadata?.full_name || 'Usuário',
                avatar_url: data.user.user_metadata?.avatar_url
            },
            error: null
        };
    }
    return { user: null, error: 'Erro desconhecido' };
  }

  async signUpWithEmail(email: string, password: string, name: string): Promise<{ user: UserProfile | null, error: any }> {
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: {
        data: {
            full_name: name,
        }
      }
    });

    if (error) return { user: null, error };

    if (data.user) {
        this.isGuest = false;
        return {
            user: {
                id: data.user.id,
                email: data.user.email || '',
                name: name,
                avatar_url: ''
            },
            error: null
        };
    }

    return { user: null, error: null };
  }

  async resetPassword(email: string): Promise<{ error: any }> {
      const { error } = await this.client.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
      });
      return { error };
  }

  async signInAsGuest(): Promise<UserProfile> {
      this.isGuest = true;
      
      // Gera ou recupera identidade única para o visitante
      if (!this.guestId) {
          const randomSuffix = Math.floor(Math.random() * 10000);
          this.guestId = `guest-${Date.now()}-${randomSuffix}`;
          this.guestName = `Visitante ${randomSuffix}`;
          
          localStorage.setItem('lumen_guest_session', JSON.stringify({
              id: this.guestId,
              name: this.guestName
          }));
      }

      return {
          id: this.guestId,
          email: 'visitante@lumen.app',
          name: this.guestName || 'Visitante',
          avatar_url: undefined
      };
  }

  async signOut(): Promise<void> {
    this.isGuest = false;
    this.guestId = null;
    localStorage.removeItem('lumen_guest_session');
    await this.client.auth.signOut();
  }

  async getCurrentUser(): Promise<UserProfile | null> {
    if (this.isGuest && this.guestId) {
        return {
            id: this.guestId,
            email: 'visitante@lumen.app',
            name: this.guestName || 'Visitante',
            avatar_url: undefined
        };
    }

    const { data: { session } } = await this.client.auth.getSession();
    
    if (session?.user) {
      return {
        id: session.user.id,
        email: session.user.email || '',
        name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Usuário',
        avatar_url: session.user.user_metadata?.avatar_url
      };
    }
    return null;
  }

  async updateProfile(name: string, avatarUrl?: string): Promise<{ error: any }> {
      // Permitir que visitantes editem nome localmente para o chat
      if (this.isGuest && this.guestId) {
          this.guestName = name;
          // Se for visitante, não temos auth.users para atualizar, mas podemos simular atualização local
          localStorage.setItem('lumen_guest_session', JSON.stringify({
              id: this.guestId,
              name: this.guestName
          }));
          return { error: null };
      }

      const updates: any = {
          data: { full_name: name }
      };
      if (avatarUrl) {
          updates.data.avatar_url = avatarUrl;
      }

      const { error } = await this.client.auth.updateUser(updates);
      return { error };
  }

  async uploadFile(file: File, path: string): Promise<string | null> {
      // Visitantes também podem enviar imagens se o RLS permitir (que liberamos no SQL)
      // O path deve ser ajustado para não conflitar
      const safePath = this.isGuest ? `guests/${path}` : path;
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${safePath}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await this.client.storage
          .from('lumen-media')
          .upload(fileName, file);

      if (uploadError) {
          console.error("Erro upload:", uploadError);
          return null;
      }

      const { data } = this.client.storage
          .from('lumen-media')
          .getPublicUrl(fileName);

      return data.publicUrl;
  }

  // --- Reading Plans ---

  async fetchReadingPlans(): Promise<ReadingPlan[]> {
    if (this.isGuest) return [];

    const user = await this.getCurrentUser();
    if (!user) return [];

    // 1. Busca todos os planos
    const { data: allPlans, error: plansError } = await this.client
        .from('reading_plans')
        .select('*');

    if (plansError) {
        console.error("Erro ao buscar planos:", plansError);
        return [];
    }

    // 2. Busca progresso do usuário
    const { data: userProgress, error: progressError } = await this.client
        .from('user_plans')
        .select('*')
        .eq('user_id', user.id);

    if (progressError) console.error("Erro ao buscar progresso:", progressError);

    // 3. Combina os dados
    const userProgressMap = new Map();
    userProgress?.forEach((up: any) => userProgressMap.set(up.plan_id, up));

    return allPlans.map((plan: any) => {
        const progress = userProgressMap.get(plan.id);
        return {
            id: plan.id,
            title: plan.title,
            description: plan.description,
            total_days: plan.total_days,
            category: plan.category,
            image_gradient: plan.image_gradient,
            completed_days: progress ? progress.completed_days : 0,
            is_active: progress ? progress.is_active : false
        } as ReadingPlan;
    });
  }

  async startPlan(planId: string): Promise<void> {
    if (this.isGuest) return;
    const user = await this.getCurrentUser();
    if (!user) return;

    const { error } = await this.client.from('user_plans').upsert({
        user_id: user.id,
        plan_id: planId,
        is_active: true,
        updated_at: new Date().toISOString()
    }, { onConflict: 'user_id, plan_id' });

    if (error) console.error("Erro ao iniciar plano:", error);
  }

  async updatePlanProgress(planId: string, completedDays: number): Promise<void> {
    if (this.isGuest) return;
    const user = await this.getCurrentUser();
    if (!user) return;

    const { error } = await this.client.from('user_plans').update({
        completed_days: completedDays,
        updated_at: new Date().toISOString()
    }).eq('user_id', user.id).eq('plan_id', planId);

    if (error) console.error("Erro ao atualizar progresso:", error);
  }

  // --- Prayers ---

  async fetchPrayers(): Promise<PrayerRequest[]> {
    const { data, error } = await this.client
      .from('prayers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
        console.error("Erro ao buscar orações:", error);
        return [];
    }
    
    if (!data || data.length === 0) return [];
    return data as PrayerRequest[];
  }

  async createPrayer(text: string, isAnonymous: boolean): Promise<PrayerRequest> {
    const user = await this.getCurrentUser();
    
    const newPrayer = {
      user_id: user?.id, 
      author_name: isAnonymous ? '' : (user?.name || 'Anônimo'),
      request_text: text,
      is_anonymous: isAnonymous,
      status: 'pending',
      prayed_count: 0
    };

    const { data, error } = await this.client
      .from('prayers')
      .insert(newPrayer)
      .select()
      .single();

    if (error) throw error;
    return data as PrayerRequest;
  }

  async incrementPrayerCount(prayerId: string): Promise<void> {
    const { data: prayer } = await this.client.from('prayers').select('prayed_count').eq('id', prayerId).single();
    if (prayer) {
        await this.client.from('prayers').update({ prayed_count: prayer.prayed_count + 1 }).eq('id', prayerId);
    }
  }

  // --- Groups ---

  async fetchGroups(): Promise<StudyGroup[]> {
    const { data, error } = await this.client
      .from('study_groups')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) return [];
    return data as StudyGroup[];
  }

  async createGroup(name: string, description: string): Promise<StudyGroup> {
    const user = await this.getCurrentUser();

    const { data, error } = await this.client
      .from('study_groups')
      .insert({
        name,
        description,
        members_count: 1,
        created_by: user?.id
      })
      .select()
      .single();

    if (error) {
        throw error;
    }
    return data as StudyGroup;
  }

  async updateGroup(groupId: string, name: string, description: string): Promise<StudyGroup> {
      const { data, error } = await this.client
          .from('study_groups')
          .update({ name, description })
          .eq('id', groupId)
          .select()
          .single();
      if (error) throw error;
      return data as StudyGroup;
  }

  async deleteGroup(groupId: string): Promise<void> {
      const { error } = await this.client.from('study_groups').delete().eq('id', groupId);
      if (error) throw error;
  }


  // --- Chat ---

  async fetchMessages(groupId: string): Promise<ChatMessage[]> {
    const { data, error } = await this.client
      .from('messages')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true });

    if (error || !data) return [];

    const currentUser = await this.getCurrentUser();

    return (data as any[]).map(msg => ({
      id: msg.id,
      group_id: msg.group_id,
      user_id: msg.user_id,
      user_name: msg.user_name,
      text: msg.text,
      timestamp: msg.created_at,
      is_me: msg.user_id === currentUser?.id,
      reply_to_id: msg.reply_to_id,
      reply_to_user: msg.reply_to_user,
      reply_to_text: msg.reply_to_text,
      reactions: msg.reactions || {},
      user_avatar: msg.user_avatar, 
      image_url: msg.image_url
    }));
  }

  subscribeToGroupMessages(
      groupId: string, 
      onNewMessage: (msg: ChatMessage) => void,
      onTyping?: (user: { name: string, avatar?: string }) => void
  ): RealtimeChannel {
      console.log(`Subscribing to chat group: ${groupId}`);
      const channel = this.client.channel(`public:messages:group_id=eq.${groupId}`);

      channel
          .on(
              'postgres_changes',
              { event: 'INSERT', schema: 'public', table: 'messages', filter: `group_id=eq.${groupId}` },
              async (payload) => {
                  const newMsg = payload.new as any;
                  const currentUser = await this.getCurrentUser();
                  
                  onNewMessage({
                      id: newMsg.id,
                      group_id: newMsg.group_id,
                      user_id: newMsg.user_id,
                      user_name: newMsg.user_name,
                      text: newMsg.text,
                      timestamp: newMsg.created_at,
                      is_me: newMsg.user_id === currentUser?.id,
                      reply_to_id: newMsg.reply_to_id,
                      reply_to_user: newMsg.reply_to_user,
                      reply_to_text: newMsg.reply_to_text,
                      reactions: newMsg.reactions || {},
                      user_avatar: newMsg.user_avatar,
                      image_url: newMsg.image_url
                  });
              }
          )
          .on(
              'broadcast', 
              { event: 'typing' }, 
              async ({ payload }) => {
                  const currentUser = await this.getCurrentUser();
                  if (payload.userId !== currentUser?.id && onTyping) {
                      onTyping(payload);
                  }
              }
          )
          .subscribe((status) => {
              if (status === 'SUBSCRIBED') {
                  console.log('Realtime conectado!');
              }
          });

      return channel;
  }

  async sendTypingEvent(channel: RealtimeChannel, user: UserProfile): Promise<void> {
      await channel.send({
          type: 'broadcast',
          event: 'typing',
          payload: { 
              userId: user.id,
              name: user.name, 
              avatar: user.avatar_url 
          }
      });
  }

  unsubscribe(channel: RealtimeChannel) {
      this.client.removeChannel(channel);
  }

  async sendMessage(
      groupId: string, 
      text: string, 
      replyTo?: {id: string, user: string, text: string},
      imageUrl?: string,
      userOverride?: UserProfile 
  ): Promise<ChatMessage> {
    const user = userOverride || await this.getCurrentUser();
    if (!user) throw new Error("Usuário não autenticado");

    const newMessage = {
      group_id: groupId,
      user_id: user.id,
      user_name: user.name || 'Usuário',
      text: text,
      reply_to_id: replyTo?.id,
      reply_to_user: replyTo?.user,
      reply_to_text: replyTo?.text,
      user_avatar: user.avatar_url,
      image_url: imageUrl
    };

    // INSERÇÃO REAL. Se falhar, lançará erro e o UI saberá.
    const { data, error } = await this.client
      .from('messages')
      .insert(newMessage)
      .select()
      .single();

    if (error) {
        console.error("Erro real no envio:", error);
        throw error;
    }

    return {
        id: data.id,
        ...newMessage,
        timestamp: data.created_at,
        is_me: true
    };
  }

  // --- Bible Features ---

  async fetchBibleNotes(): Promise<Record<string, string>> {
    const user = await this.getCurrentUser();
    if (!user) return {};
    
    const { data } = await this.client.from('bible_notes').select('verse_key, note_text').eq('user_id', user.id);
    const notes: Record<string, string> = {};
    data?.forEach((n: any) => notes[n.verse_key] = n.note_text);
    return notes;
  }

  async saveBibleNote(verseKey: string, text: string): Promise<void> {
    const user = await this.getCurrentUser();
    if (!user) return;
    await this.client.from('bible_notes').upsert({ user_id: user.id, verse_key: verseKey, note_text: text }, { onConflict: 'user_id, verse_key' });
  }

  async deleteBibleNote(verseKey: string): Promise<void> {
    const user = await this.getCurrentUser();
    if (!user) return;
    await this.client.from('bible_notes').delete().match({ user_id: user.id, verse_key: verseKey });
  }

  async fetchBibleHighlights(): Promise<Record<string, string>> {
    const user = await this.getCurrentUser();
    if (!user) return {};
    
    const { data } = await this.client.from('bible_highlights').select('verse_key, color').eq('user_id', user.id);
    const highlights: Record<string, string> = {};
    data?.forEach((h: any) => highlights[h.verse_key] = h.color);
    return highlights;
  }

  async saveBibleHighlight(verseKey: string, color: string): Promise<void> {
    const user = await this.getCurrentUser();
    if (!user) return;
    await this.client.from('bible_highlights').upsert({ user_id: user.id, verse_key: verseKey, color: color }, { onConflict: 'user_id, verse_key' });
  }

  async deleteBibleHighlight(verseKey: string): Promise<void> {
    const user = await this.getCurrentUser();
    if (!user) return;
    await this.client.from('bible_highlights').delete().match({ user_id: user.id, verse_key: verseKey });
  }

  // --- Habits ---

  async fetchTodayHabits(): Promise<string[]> {
    const user = await this.getCurrentUser();
    if (!user) return [];
    
    const today = new Date().toISOString().split('T')[0];
    const { data } = await this.client.from('user_habits').select('habit_id').eq('user_id', user.id).eq('date', today);
    return data?.map((h: any) => h.habit_id) || [];
  }

  async toggleHabit(habitId: string, completed: boolean): Promise<void> {
    const user = await this.getCurrentUser();
    if (!user) return;
    
    const today = new Date().toISOString().split('T')[0];
    if (completed) {
        await this.client.from('user_habits').upsert({ user_id: user.id, habit_id: habitId, date: today }, { onConflict: 'user_id, habit_id, date' });
    } else {
        await this.client.from('user_habits').delete().match({ user_id: user.id, habit_id: habitId, date: today });
    }
  }

  // --- Chat Reactions ---

  async reactToMessage(messageId: string, emoji: string): Promise<void> {
    const user = await this.getCurrentUser();
    if (!user) return;

    const { data } = await this.client.from('message_reactions').select('*').match({ message_id: messageId, user_id: user.id, emoji }).single();
    
    if (data) {
        await this.client.from('message_reactions').delete().match({ id: data.id });
    } else {
        await this.client.from('message_reactions').insert({ message_id: messageId, user_id: user.id, emoji });
    }
  }
}

export const supabase = new SupabaseService();
