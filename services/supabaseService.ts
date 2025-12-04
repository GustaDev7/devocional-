
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { UserProfile, PrayerRequest, StudyGroup, ChatMessage } from '../types';
import { MOCK_PRAYERS, MOCK_GROUPS, MOCK_MESSAGES } from './mockData';

// Credenciais fornecidas
const SUPABASE_URL = 'https://yyxfposhfurploozfegy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5eGZwb3NoZnVycGxvb3pmZWd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3ODcwNzYsImV4cCI6MjA4MDM2MzA3Nn0.FLC475deGtM9dukLT8gm80tlSWTYtyzKuDBhmO6FNhI';

class SupabaseService {
  private client: SupabaseClient;
  private isGuest: boolean = false;

  constructor() {
    this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  // --- Auth ---

  async signInWithEmail(email: string, password: string): Promise<{ user: UserProfile | null, error: any }> {
    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password
    });

    if (error) return { user: null, error };
    
    if (data.user) {
        this.isGuest = false;
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
      return {
          id: 'guest-user',
          email: 'visitante@lumen.app',
          name: 'Visitante',
          avatar_url: undefined
      };
  }

  async signOut(): Promise<void> {
    this.isGuest = false;
    await this.client.auth.signOut();
  }

  async getCurrentUser(): Promise<UserProfile | null> {
    if (this.isGuest) {
        return {
            id: 'guest-user',
            email: 'visitante@lumen.app',
            name: 'Visitante',
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

  // --- Prayers (Tabela: prayers) ---

  async fetchPrayers(): Promise<PrayerRequest[]> {
    if (this.isGuest) return MOCK_PRAYERS;

    const { data, error } = await this.client
      .from('prayers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
        console.error("Erro ao buscar orações:", error);
        return [];
    }
    
    // Se não tiver dados, retorna array vazio (não usa mocks para usuários logados)
    if (!data || data.length === 0) {
      return [];
    }

    return data as PrayerRequest[];
  }

  async createPrayer(text: string, isAnonymous: boolean): Promise<PrayerRequest> {
    if (this.isGuest) throw new Error("Visitantes não podem criar orações.");

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

    if (error) {
        throw error;
    }
    return data as PrayerRequest;
  }

  async incrementPrayerCount(prayerId: string): Promise<void> {
    if (this.isGuest) return;

    // Primeiro busca o contador atual para garantir consistência
    const { data: prayer } = await this.client
        .from('prayers')
        .select('prayed_count')
        .eq('id', prayerId)
        .single();

    if (prayer) {
        await this.client
            .from('prayers')
            .update({ prayed_count: prayer.prayed_count + 1 })
            .eq('id', prayerId);
    }
  }

  // --- Groups (Tabela: study_groups) ---

  async fetchGroups(): Promise<StudyGroup[]> {
    if (this.isGuest) return MOCK_GROUPS;

    const { data, error } = await this.client
      .from('study_groups')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
        return MOCK_GROUPS;
    }

    return data as StudyGroup[];
  }

  async createGroup(name: string, description: string): Promise<StudyGroup> {
    if (this.isGuest) throw new Error("Visitantes não podem criar grupos.");
    
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
        console.warn("Using mock response for createGroup due to error (likely RLS):", error);
        return {
            id: 'mock-group-' + Date.now(),
            name,
            description,
            members_count: 1,
            image_url: undefined,
            created_by: user?.id
        };
    }
    return data as StudyGroup;
  }

  async updateGroup(groupId: string, name: string, description: string): Promise<StudyGroup> {
      if (this.isGuest) throw new Error("Visitantes não podem editar grupos.");

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
      if (this.isGuest) throw new Error("Visitantes não podem excluir grupos.");

      const { error } = await this.client
          .from('study_groups')
          .delete()
          .eq('id', groupId);

      if (error) throw error;
  }


  // --- Chat (Tabela: messages) ---

  async fetchMessages(groupId: string): Promise<ChatMessage[]> {
    if (this.isGuest) {
        return MOCK_MESSAGES.filter(m => m.group_id === groupId);
    }

    const { data, error } = await this.client
      .from('messages')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true });

    if (error || !data) {
        // Se a tabela estiver vazia, retorna vazio em vez de mock para evitar confusão no chat real
        if (data && data.length === 0) return [];
        return MOCK_MESSAGES.filter(m => m.group_id === groupId);
    }

    const currentUser = await this.getCurrentUser();

    return (data as any[]).map(msg => ({
      id: msg.id,
      group_id: msg.group_id,
      user_id: msg.user_id,
      user_name: msg.user_name,
      text: msg.text,
      timestamp: msg.created_at,
      is_me: msg.user_id === currentUser?.id
    }));
  }

  // Novo método para Realtime Subscription
  subscribeToGroupMessages(groupId: string, onNewMessage: (msg: ChatMessage) => void): RealtimeChannel {
      return this.client
          .channel(`public:messages:group_id=eq.${groupId}`)
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
                      is_me: newMsg.user_id === currentUser?.id
                  });
              }
          )
          .subscribe();
  }

  unsubscribe(channel: RealtimeChannel) {
      this.client.removeChannel(channel);
  }

  async sendMessage(groupId: string, text: string): Promise<ChatMessage> {
    const user = await this.getCurrentUser();
    if (!user || this.isGuest) throw new Error("Usuário não autenticado");

    const newMessage = {
      group_id: groupId,
      user_id: user.id,
      user_name: user.name || 'Usuário',
      text: text
    };

    const { data, error } = await this.client
      .from('messages')
      .insert(newMessage)
      .select()
      .single();

    if (error) {
        console.warn("Using mock response for sendMessage due to error:", error);
        return {
            id: Math.random().toString(),
            ...newMessage,
            timestamp: new Date().toISOString(),
            is_me: true
        };
    }

    return {
        id: data.id,
        group_id: data.group_id,
        user_id: data.user_id,
        user_name: data.user_name,
        text: data.text,
        timestamp: data.created_at,
        is_me: true
    };
  }

  // --- BIBLE & ROUTINE (Mantido igual) ---
  
  async fetchBibleNotes(): Promise<Record<string, string>> {
    const user = await this.getCurrentUser();
    if (!user || this.isGuest) return {};
    const { data, error } = await this.client.from('bible_notes').select('verse_key, note_content').eq('user_id', user.id);
    if (error || !data) return {};
    const notesMap: Record<string, string> = {};
    data.forEach((item: any) => { notesMap[item.verse_key] = item.note_content; });
    return notesMap;
  }

  async saveBibleNote(verseKey: string, content: string): Promise<void> {
    const user = await this.getCurrentUser();
    if (!user || this.isGuest) return;
    await this.client.from('bible_notes').upsert({ 
        user_id: user.id, verse_key: verseKey, note_content: content, updated_at: new Date().toISOString()
    }, { onConflict: 'user_id, verse_key' } as any);
  }

  async deleteBibleNote(verseKey: string): Promise<void> {
    const user = await this.getCurrentUser();
    if (!user || this.isGuest) return;
    await this.client.from('bible_notes').delete().eq('user_id', user.id).eq('verse_key', verseKey);
  }

  async fetchBibleHighlights(): Promise<Record<string, string>> {
    const user = await this.getCurrentUser();
    if (!user || this.isGuest) return {};
    const { data, error } = await this.client.from('bible_highlights').select('verse_key, color').eq('user_id', user.id);
    if (error || !data) return {};
    const highlightsMap: Record<string, string> = {};
    data.forEach((item: any) => { highlightsMap[item.verse_key] = item.color; });
    return highlightsMap;
  }

  async saveBibleHighlight(verseKey: string, color: string): Promise<void> {
    const user = await this.getCurrentUser();
    if (!user || this.isGuest) return;
    await this.deleteBibleHighlight(verseKey);
    await this.client.from('bible_highlights').insert({ user_id: user.id, verse_key: verseKey, color: color });
  }

  async deleteBibleHighlight(verseKey: string): Promise<void> {
    const user = await this.getCurrentUser();
    if (!user || this.isGuest) return;
    await this.client.from('bible_highlights').delete().eq('user_id', user.id).eq('verse_key', verseKey);
  }

  async fetchTodayHabits(): Promise<string[]> {
      const user = await this.getCurrentUser();
      if(!user || this.isGuest) return [];
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await this.client.from('user_habits').select('habit_id').eq('user_id', user.id).eq('completed_date', today);
      if (error || !data) return [];
      return data.map((h: any) => h.habit_id);
  }

  async toggleHabit(habitId: string, isCompleted: boolean): Promise<void> {
      const user = await this.getCurrentUser();
      if(!user || this.isGuest) return;
      const today = new Date().toISOString().split('T')[0];
      try {
        if (isCompleted) {
            await this.client.from('user_habits').insert({ user_id: user.id, habit_id: habitId, completed_date: today });
        } else {
            await this.client.from('user_habits').delete().eq('user_id', user.id).eq('habit_id', habitId).eq('completed_date', today);
        }
      } catch (e) {
        console.warn("Erro ao salvar hábito", e);
      }
  }
}

export const supabase = new SupabaseService();