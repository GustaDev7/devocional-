
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { GoogleGenAI } from "@google/genai";
import { UserProfile, BibleVerse, Devotional, PrayerRequest, StudyGroup, ChatMessage, ReadingPlan, Habit } from '../types';
import { DAILY_VERSES } from './mockData';

// Hardcoded credentials for immediate connection
// Note: In a production build, these should ideally be in a .env file.
const SUPABASE_URL = "https://yyxfposhfurploozfegy.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5eGZwb3NoZnVycGxvb3pmZWd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3ODcwNzYsImV4cCI6MjA4MDM2MzA3Nn0.FLC475deGtM9dukLT8gm80tlSWTYtyzKuDBhmO6FNhI";
const API_KEY = process.env.API_KEY;

class SupabaseService {
  private supabase: SupabaseClient | null = null;
  private ai: GoogleGenAI;
  private guestUser: UserProfile | null = null;
  private realtimeChannel: RealtimeChannel | null = null;

  constructor() {
    if (SUPABASE_URL && SUPABASE_KEY) {
        try {
            this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true
                }
            });
        } catch (e) {
            console.error("Failed to initialize Supabase client:", e);
        }
    } else {
        console.warn("Supabase credentials missing! App running in limited mode.");
    }
    
    // Initialize AI safely
    // If API_KEY is missing, AI features will simply fail gracefully when called
    this.ai = new GoogleGenAI({ apiKey: API_KEY || '' });
  }

  isConfigured(): boolean {
      return !!this.supabase;
  }

  // --- Auth ---
  async getCurrentUser(): Promise<UserProfile | null> {
    if (!this.supabase) return this.guestUser;

    try {
        const { data: { session }, error } = await this.supabase.auth.getSession();
        if (session?.user) {
            return {
                id: session.user.id,
                email: session.user.email || '',
                name: session.user.user_metadata?.name || session.user.email?.split('@')[0],
                avatar_url: session.user.user_metadata?.avatar_url
            };
        }
    } catch (e) {
        console.error("Session check failed", e);
    }
    return this.guestUser;
  }

  async signInWithEmail(email: string, password: string): Promise<{ user: UserProfile | null, error: any }> {
    if (!this.supabase) return { user: null, error: { message: 'System not configured: Missing Supabase Credentials' } };

    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (data.user) {
        return { 
            user: { 
                id: data.user.id, 
                email: data.user.email!, 
                name: data.user.user_metadata.name,
                avatar_url: data.user.user_metadata.avatar_url
            }, 
            error: null 
        };
    }
    return { user: null, error };
  }

  async signUpWithEmail(email: string, password: string, name: string): Promise<{ user: UserProfile | null, error: any }> {
     if (!this.supabase) return { user: null, error: { message: 'System not configured: Missing Supabase Credentials' } };

     const { data, error } = await this.supabase.auth.signUp({
         email,
         password,
         options: {
             data: { name }
         }
     });

     if (data.user) {
         return { 
             user: { 
                 id: data.user.id, 
                 email: data.user.email!, 
                 name: name,
                 avatar_url: '' 
             }, 
             error: null 
         };
     }
     return { user: null, error };
  }

  async resetPassword(email: string): Promise<{ error: any }> {
      if (!this.supabase) return { error: { message: 'System not configured' } };
      const { error } = await this.supabase.auth.resetPasswordForEmail(email);
      return { error };
  }

  async signInAsGuest(): Promise<UserProfile> {
      // Gera ID aleatório para permitir múltiplos visitantes conversando
      const randomId = Math.floor(Math.random() * 10000);
      this.guestUser = { 
          id: `guest-${randomId}`, 
          email: `visitante${randomId}@lumen.app`, 
          name: `Visitante ${randomId}`,
          avatar_url: '' 
      };
      return this.guestUser;
  }

  async signOut(): Promise<void> {
      if (this.supabase) await this.supabase.auth.signOut();
      this.guestUser = null;
  }

  async updateProfile(name: string, avatarUrl?: string): Promise<{ error: any }> {
      if (!this.supabase) return { error: null };
      
      const { data: { user } } = await this.supabase.auth.getUser();
      if (user) {
          const { error } = await this.supabase.auth.updateUser({
              data: { name, avatar_url: avatarUrl }
          });
          return { error };
      } else if (this.guestUser) {
          this.guestUser.name = name;
          if (avatarUrl) this.guestUser.avatar_url = avatarUrl;
      }
      return { error: null };
  }

  async uploadFile(file: File, path: string): Promise<string | null> {
      if (!this.supabase) return null;
      
      // Upload to 'lumen-media' bucket
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${path}/${fileName}`;

      const { error: uploadError } = await this.supabase.storage
          .from('lumen-media')
          .upload(filePath, file);

      if (uploadError) {
          console.error("Upload error:", uploadError);
          return null;
      }

      const { data } = this.supabase.storage.from('lumen-media').getPublicUrl(filePath);
      return data.publicUrl;
  }

  // --- Bible ---
  async fetchBibleNotes(): Promise<Record<string, string>> {
      if (!this.supabase) return {};
      const user = await this.getCurrentUser();
      if (!user) return {};

      const { data } = await this.supabase.from('bible_notes').select('verse_key, note_content').eq('user_id', user.id);
      
      const notes: Record<string, string> = {};
      data?.forEach((item: any) => {
          notes[item.verse_key] = item.note_content;
      });
      return notes;
  }

  async saveBibleNote(key: string, text: string): Promise<void> {
      if (!this.supabase) return;
      const user = await this.getCurrentUser();
      if (!user) return;

      await this.supabase.from('bible_notes').upsert({ user_id: user.id, verse_key: key, note_content: text }, { onConflict: 'user_id, verse_key' });
  }

  async deleteBibleNote(key: string): Promise<void> {
      if (!this.supabase) return;
      const user = await this.getCurrentUser();
      if (!user) return;
      await this.supabase.from('bible_notes').delete().match({ user_id: user.id, verse_key: key });
  }

  async fetchBibleHighlights(): Promise<Record<string, string>> {
      if (!this.supabase) return {};
      const user = await this.getCurrentUser();
      if (!user) return {};

      const { data } = await this.supabase.from('bible_highlights').select('verse_key, color').eq('user_id', user.id);
      
      const highlights: Record<string, string> = {};
      data?.forEach((item: any) => {
          highlights[item.verse_key] = item.color;
      });
      return highlights;
  }

  async saveBibleHighlight(key: string, color: string): Promise<void> {
      if (!this.supabase) return;
      const user = await this.getCurrentUser();
      if (!user) return;
      
      // Delete existing first to avoid duplicate errors if upsert not perfect
      await this.deleteBibleHighlight(key);
      await this.supabase.from('bible_highlights').insert({ user_id: user.id, verse_key: key, color });
  }

  async deleteBibleHighlight(key: string): Promise<void> {
      if (!this.supabase) return;
      const user = await this.getCurrentUser();
      if (!user) return;
      await this.supabase.from('bible_highlights').delete().match({ user_id: user.id, verse_key: key });
  }

  // --- Prayers ---
  async fetchPrayers(): Promise<PrayerRequest[]> {
      if (!this.supabase) return [];
      
      const { data, error } = await this.supabase
          .from('prayers')
          .select('*')
          .order('created_at', { ascending: false });

      if (error) console.error("Error fetching prayers:", error);
      return data || [];
  }

  async incrementPrayerCount(id: string): Promise<void> {
      if (!this.supabase) return;
      
      // Get current count first
      const { data } = await this.supabase.from('prayers').select('prayed_count').eq('id', id).single();
      if (data) {
          await this.supabase.from('prayers').update({ prayed_count: data.prayed_count + 1 }).eq('id', id);
      }
  }

  async createPrayer(text: string, isAnonymous: boolean): Promise<PrayerRequest> {
      if (!this.supabase) throw new Error("No DB");
      const user = await this.getCurrentUser();
      if (!user) throw new Error("User required");

      const newPrayer = {
          user_id: user.id,
          author_name: user.name,
          request_text: text,
          is_anonymous: isAnonymous,
          status: 'pending',
          prayed_count: 0
      };

      const { data, error } = await this.supabase.from('prayers').insert(newPrayer).select().single();
      if (error) throw error;
      return data;
  }

  // --- Habits ---
  async fetchTodayHabits(): Promise<string[]> {
      if (!this.supabase) return [];
      const user = await this.getCurrentUser();
      if (!user) return [];

      const today = new Date().toISOString().split('T')[0];
      const { data } = await this.supabase.from('user_habits')
        .select('habit_id')
        .eq('user_id', user.id)
        .eq('completed_date', today);
      
      return data?.map((h: any) => h.habit_id) || [];
  }

  async toggleHabit(id: string, state: boolean): Promise<void> {
      if (!this.supabase) return;
      const user = await this.getCurrentUser();
      if (!user) return;
      const today = new Date().toISOString().split('T')[0];

      if (state) {
          await this.supabase.from('user_habits').insert({ user_id: user.id, habit_id: id, completed_date: today });
      } else {
          await this.supabase.from('user_habits').delete().match({ user_id: user.id, habit_id: id, completed_date: today });
      }
  }

  // --- Plans ---
  async fetchReadingPlans(): Promise<ReadingPlan[]> {
      if (!this.supabase) return [];
      const user = await this.getCurrentUser();
      
      const { data: plans, error } = await this.supabase.from('reading_plans').select('*');
      if (error) return [];

      // If user is logged in, merge with progress
      let userProgress: any[] = [];
      if (user) {
          const { data } = await this.supabase.from('user_plans').select('*').eq('user_id', user.id);
          userProgress = data || [];
      }

      return plans.map((plan: any) => {
          const progress = userProgress.find(p => p.plan_id === plan.id);
          return {
              ...plan,
              completed_days: progress ? progress.completed_days : 0,
              is_active: progress ? progress.is_active : false
          };
      });
  }

  async startPlan(id: string): Promise<void> {
      if (!this.supabase) return;
      const user = await this.getCurrentUser();
      if (!user) return;

      await this.supabase.from('user_plans').insert({ user_id: user.id, plan_id: id, completed_days: 0, is_active: true });
  }

  async updatePlanProgress(planId: string, day: number): Promise<void> {
      if (!this.supabase) return;
      const user = await this.getCurrentUser();
      if (!user) return;

      await this.supabase.from('user_plans')
        .update({ completed_days: day })
        .match({ user_id: user.id, plan_id: planId });
  }

  // --- Groups ---
  async fetchGroups(): Promise<StudyGroup[]> {
      if (!this.supabase) return [];
      const { data, error } = await this.supabase.from('study_groups').select('*').order('created_at');
      if (error) {
          console.error(error);
          return [];
      }
      return data || [];
  }
  
  async createGroup(name: string, description: string): Promise<StudyGroup> {
      if (!this.supabase) throw new Error("No DB");
      const user = await this.getCurrentUser();
      
      const newGroup = {
          name,
          description,
          members_count: 1,
          created_by: user?.id || 'guest'
      };

      const { data, error } = await this.supabase.from('study_groups').insert(newGroup).select().single();
      if (error) throw error;
      return data;
  }

  async updateGroup(groupId: string, name: string, description: string): Promise<StudyGroup> {
      if (!this.supabase) throw new Error("No DB");
      const { data, error } = await this.supabase.from('study_groups')
          .update({ name, description })
          .eq('id', groupId)
          .select()
          .single();
      
      if (error) throw error;
      return data;
  }

  async deleteGroup(groupId: string): Promise<void> {
      if (!this.supabase) return;

      // Manually delete messages first as a safety measure
      await this.supabase.from('messages').delete().eq('group_id', groupId);

      const { error } = await this.supabase.from('study_groups').delete().eq('id', groupId);
      if (error) throw error;
  }

  // --- Chat (Realtime) ---
  subscribeToGroupMessages(groupId: string, callback: (msg: ChatMessage) => void, onTyping?: (user: {name: string, avatar?: string}) => void): void {
      if (!this.supabase) return;

      // Unsubscribe existing
      if (this.realtimeChannel) {
          this.supabase.removeChannel(this.realtimeChannel);
      }

      this.realtimeChannel = this.supabase.channel(`group-${groupId}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `group_id=eq.${groupId}` }, 
          (payload) => {
              const msg = payload.new as ChatMessage;
              callback(msg);
          })
          .on('broadcast', { event: 'typing' }, (payload) => {
              if (onTyping && payload.payload.user) {
                  onTyping(payload.payload.user);
              }
          })
          .subscribe((status) => {
              console.log("Realtime status:", status);
          });
  }

  async sendTypingEvent(groupId: string, user: UserProfile): Promise<void> {
      if (!this.realtimeChannel) return;
      await this.realtimeChannel.send({
          type: 'broadcast',
          event: 'typing',
          payload: { user: { name: user.name, avatar: user.avatar_url } }
      });
  }

  async fetchMessages(groupId: string): Promise<ChatMessage[]> {
      if (!this.supabase) return [];
      
      const { data, error } = await this.supabase
          .from('messages')
          .select('*')
          .eq('group_id', groupId)
          .order('timestamp', { ascending: true });
      
      if (error) return [];
      return data as ChatMessage[];
  }

  async sendMessage(groupId: string, text: string, user: UserProfile, replyTo?: ChatMessage, imageUrl?: string): Promise<ChatMessage> {
      if (!this.supabase) throw new Error("No DB");
      
      const newMessage = {
          group_id: groupId,
          user_id: user.id,
          user_name: user.name,
          user_avatar: user.avatar_url,
          text,
          image_url: imageUrl,
          timestamp: new Date().toISOString(),
          reply_to_id: replyTo?.id,
          reply_to_user: replyTo?.user_name,
          reply_to_text: replyTo?.text
      };

      const { data, error } = await this.supabase.from('messages').insert(newMessage).select().single();
      if (error) throw error;
      return data;
  }

  async reactToMessage(messageId: string, reaction: string, userId: string): Promise<void> {
      if (!this.supabase) return;
      
      const { data: currentMsg } = await this.supabase.from('messages').select('reactions').eq('id', messageId).single();
      if (currentMsg) {
          const reactions = currentMsg.reactions || {};
          reactions[userId] = reaction;
          
          await this.supabase.from('messages').update({ reactions }).eq('id', messageId);
      }
  }

  // --- AI ---
  async askLumen(question: string): Promise<string> {
    try {
        const response = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: question,
             config: {
                systemInstruction: "Você é Lumen, um assistente cristão amigável, sábio e teologicamente fundamentado. Use a Bíblia como base para suas respostas. Se for uma pergunta teológica, formate a resposta usando Markdown, com negrito para pontos chave e listas quando apropriado.",
             },
        });
        
        return response.text || "Paz seja convosco. Não consegui formular uma resposta no momento.";
    } catch (e) {
        console.error("Gemini Error:", e);
        return "Desculpe, estou tendo dificuldades para conectar com minha sabedoria agora. Tente novamente mais tarde.";
    }
  }
}

export const supabase = new SupabaseService();
