
import { BibleVerse, Devotional, PrayerRequest, StudyGroup, ChatMessage, ReadingPlan } from '../types';

export const BIBLE_BOOKS = [
  // Antigo Testamento
  { name: 'Gênesis', chapters: 50, testment: 'VT' },
  { name: 'Êxodo', chapters: 40, testment: 'VT' },
  { name: 'Levítico', chapters: 27, testment: 'VT' },
  { name: 'Números', chapters: 36, testment: 'VT' },
  { name: 'Deuteronômio', chapters: 34, testment: 'VT' },
  { name: 'Josué', chapters: 24, testment: 'VT' },
  { name: 'Juízes', chapters: 21, testment: 'VT' },
  { name: 'Rute', chapters: 4, testment: 'VT' },
  { name: '1 Samuel', chapters: 31, testment: 'VT' },
  { name: '2 Samuel', chapters: 24, testment: 'VT' },
  { name: '1 Reis', chapters: 22, testment: 'VT' },
  { name: '2 Reis', chapters: 25, testment: 'VT' },
  { name: '1 Crônicas', chapters: 29, testment: 'VT' },
  { name: '2 Crônicas', chapters: 36, testment: 'VT' },
  { name: 'Esdras', chapters: 10, testment: 'VT' },
  { name: 'Neemias', chapters: 13, testment: 'VT' },
  { name: 'Ester', chapters: 10, testment: 'VT' },
  { name: 'Jó', chapters: 42, testment: 'VT' },
  { name: 'Salmos', chapters: 150, testment: 'VT' },
  { name: 'Provérbios', chapters: 31, testment: 'VT' },
  { name: 'Eclesiastes', chapters: 12, testment: 'VT' },
  { name: 'Cânticos', chapters: 8, testment: 'VT' },
  { name: 'Isaías', chapters: 66, testment: 'VT' },
  { name: 'Jeremias', chapters: 52, testment: 'VT' },
  { name: 'Lamentações', chapters: 5, testment: 'VT' },
  { name: 'Ezequiel', chapters: 48, testment: 'VT' },
  { name: 'Daniel', chapters: 12, testment: 'VT' },
  { name: 'Oseias', chapters: 14, testment: 'VT' },
  { name: 'Joel', chapters: 3, testment: 'VT' },
  { name: 'Amós', chapters: 9, testment: 'VT' },
  { name: 'Obadias', chapters: 1, testment: 'VT' },
  { name: 'Jonas', chapters: 4, testment: 'VT' },
  { name: 'Miqueias', chapters: 7, testment: 'VT' },
  { name: 'Naum', chapters: 3, testment: 'VT' },
  { name: 'Habacuque', chapters: 3, testment: 'VT' },
  { name: 'Sofonias', chapters: 3, testment: 'VT' },
  { name: 'Ageu', chapters: 2, testment: 'VT' },
  { name: 'Zacarias', chapters: 14, testment: 'VT' },
  { name: 'Malaquias', chapters: 4, testment: 'VT' },
  // Novo Testamento
  { name: 'Mateus', chapters: 28, testment: 'NT' },
  { name: 'Marcos', chapters: 16, testment: 'NT' },
  { name: 'Lucas', chapters: 24, testment: 'NT' },
  { name: 'João', chapters: 21, testment: 'NT' },
  { name: 'Atos', chapters: 28, testment: 'NT' },
  { name: 'Romanos', chapters: 16, testment: 'NT' },
  { name: '1 Coríntios', chapters: 16, testment: 'NT' },
  { name: '2 Coríntios', chapters: 13, testment: 'NT' },
  { name: 'Gálatas', chapters: 6, testment: 'NT' },
  { name: 'Efésios', chapters: 6, testment: 'NT' },
  { name: 'Filipenses', chapters: 4, testment: 'NT' },
  { name: 'Colossenses', chapters: 4, testment: 'NT' },
  { name: '1 Tessalonicenses', chapters: 5, testment: 'NT' },
  { name: '2 Tessalonicenses', chapters: 3, testment: 'NT' },
  { name: '1 Timóteo', chapters: 6, testment: 'NT' },
  { name: '2 Timóteo', chapters: 4, testment: 'NT' },
  { name: 'Tito', chapters: 3, testment: 'NT' },
  { name: 'Filemom', chapters: 1, testment: 'NT' },
  { name: 'Hebreus', chapters: 13, testment: 'NT' },
  { name: 'Tiago', chapters: 5, testment: 'NT' },
  { name: '1 Pedro', chapters: 5, testment: 'NT' },
  { name: '2 Pedro', chapters: 3, testment: 'NT' },
  { name: '1 João', chapters: 5, testment: 'NT' },
  { name: '2 João', chapters: 1, testment: 'NT' },
  { name: '3 João', chapters: 1, testment: 'NT' },
  { name: 'Judas', chapters: 1, testment: 'NT' },
  { name: 'Apocalipse', chapters: 22, testment: 'NT' },
];

export const DAILY_VERSES = [
    {
        text: "Porque eu bem sei os pensamentos que tenho a vosso respeito, diz o Senhor; pensamentos de paz, e não de mal, para vos dar o fim que esperais.",
        reference: "Jeremias 29:11"
    },
    {
        text: "Tudo posso naquele que me fortalece.",
        reference: "Filipenses 4:13"
    },
    {
        text: "O Senhor é o meu pastor, nada me faltará.",
        reference: "Salmos 23:1"
    }
];

export const EMOTIONAL_COMPASS = [
  { id: 'ansioso', label: 'Ansioso', emoji: '😰', verse: 'Lançando sobre ele toda a vossa ansiedade, porque ele tem cuidado de vós.', ref: '1 Pedro 5:7', action: 'Respire fundo 3 vezes e entregue o controle a Deus.' },
  { id: 'grato', label: 'Grato', emoji: '🙏', verse: 'Em tudo dai graças, porque esta é a vontade de Deus em Cristo Jesus para convosco.', ref: '1 Tessalonicenses 5:18', action: 'Liste 3 coisas boas que aconteceram hoje.' },
  { id: 'triste', label: 'Triste', emoji: '😢', verse: 'Perto está o Senhor dos que têm o coração quebrantado.', ref: 'Salmos 34:18', action: 'Ouça um louvor que toque seu coração.' },
  { id: 'cansado', label: 'Cansado', emoji: '😫', verse: 'Vinde a mim, todos os que estais cansados e oprimidos, e eu vos aliviarei.', ref: 'Mateus 11:28', action: 'Feche os olhos por 1 minuto e imagine Jesus te abraçando.' },
  { id: 'feliz', label: 'Feliz', emoji: '😊', verse: 'Alegrai-vos sempre no Senhor; outra vez digo, alegrai-vos.', ref: 'Filipenses 4:4', action: 'Compartilhe sua alegria com alguém agora.' },
];

export const MOCK_DEVOTIONALS: Devotional[] = [];
export const MOCK_PRAYERS: PrayerRequest[] = []; 
export const MOCK_GROUPS: StudyGroup[] = []; 
export const MOCK_MESSAGES: ChatMessage[] = [];
export const READING_PLANS: ReadingPlan[] = [];
