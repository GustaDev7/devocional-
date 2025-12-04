
export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
}

export interface BibleVerse {
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

export interface Devotional {
  id: string;
  title: string;
  text_content: string;
  reference_verse: string;
  date: string; // ISO string
  audio_url?: string;
  is_read?: boolean;
}

export interface PrayerRequest {
  id: string;
  user_id: string;
  author_name?: string; // Empty if anonymous
  request_text: string;
  is_anonymous: boolean;
  status: 'pending' | 'answered';
  prayed_count: number;
  created_at: string;
  i_prayed?: boolean; // Local state tracking
}

export interface Habit {
  id: string;
  label: string;
  completed: boolean;
  icon: 'book' | 'sun' | 'moon' | 'heart';
}

export interface StudyGroup {
  id: string;
  name: string;
  description: string;
  members_count: number;
  image_url?: string;
  created_by?: string;
}

export interface ChatMessage {
  id: string;
  group_id: string;
  user_id: string;
  user_name: string;
  text: string;
  timestamp: string;
  is_me?: boolean; // Helper for UI
  reply_to_id?: string;
  reply_to_user?: string;
  reply_to_text?: string;
  reactions?: Record<string, string>; // userId -> reactionType
  user_avatar?: string; // Foto do usuário
  image_url?: string;   // Imagem enviada no chat
}

export interface ReadingPlan {
  id: string;
  title: string;
  description: string;
  total_days: number;
  completed_days: number;
  image_gradient: string;
  category: 'bible' | 'thematic' | 'emotional';
  is_active: boolean;
}

export interface PlanDay {
  day: number;
  readings: string; // ex: "Gênesis 1-3"
}

export interface AIChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  is_loading?: boolean;
}

export type TabType = 'bible' | 'devotionals' | 'prayer' | 'routine' | 'plans' | 'ai';