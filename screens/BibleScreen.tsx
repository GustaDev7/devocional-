
import React, { useState, useEffect, useRef } from 'react';
import { BIBLE_BOOKS } from '../services/mockData';
import { supabase } from '../services/supabaseService';
import { Share2, PenLine, Highlighter, X, ChevronDown, Search, ChevronLeft, ChevronRight, Loader2, ArrowLeft, ArrowRight, Book, Save, Trash2, MessageSquareText, Check, Copy, Ban, CornerDownLeft, Volume2, Play, Pause, Square } from 'lucide-react';
import { BibleVerse } from '../types';

const HIGHLIGHT_COLORS = [
  { id: 'yellow', value: '#fef3c7', border: '#fcd34d' }, // amber-100
  { id: 'green', value: '#dcfce7', border: '#86efac' }, // green-100
  { id: 'blue', value: '#dbeafe', border: '#93c5fd' }, // blue-100
  { id: 'rose', value: '#ffe4e6', border: '#fda4af' }, // rose-100
  { id: 'purple', value: '#f3e8ff', border: '#d8b4fe' }, // purple-100
];

const BIBLE_VERSIONS = [
  { id: 'almeida', label: 'ARA', name: 'Almeida Revista e Atualizada' },
  { id: 'nvi', label: 'NVI', name: 'Nova Versão Internacional' },
  { id: 'ntlh', label: 'NTLH', name: 'Nova Tradução na Linguagem de Hoje' },
  { id: 'acf', label: 'ACF', name: 'Almeida Corrigida Fiel' },
  { id: 'kjv', label: 'KJV', name: 'King James Version (Inglês)' },
];

// Dados simulados para demonstração da busca textual
const MOCK_SEARCH_RESULTS: Record<string, {book: string, chapter: number, verse: number, text: string}[]> = {
  'amor': [
    { book: '1 Coríntios', chapter: 13, verse: 4, text: 'O amor é sofredor, é benigno; o amor não é invejoso; o amor não trata com leviandade, não se ensoberbece.' },
    { book: '1 Coríntios', chapter: 13, verse: 13, text: 'Agora, pois, permanecem a fé, a esperança e o amor, estes três, mas o maior destes é o amor.' },
    { book: '1 João', chapter: 4, verse: 8, text: 'Aquele que não ama não conhece a Deus; porque Deus é amor.' },
    { book: 'Provérbios', chapter: 10, verse: 12, text: 'O ódio excita contendas, mas o amor cobre todas as transgressões.' },
  ],
  'paz': [
    { book: 'João', chapter: 14, verse: 27, text: 'Deixo-vos a paz, a minha paz vos dou; não vo-la dou como o mundo a dá. Não se turbe o vosso coração, nem se atemorize.' },
    { book: 'Filipenses', chapter: 4, verse: 7, text: 'E a paz de Deus, que excede todo o entendimento, guardará os vossos corações e os vossos sentimentos em Cristo Jesus.' },
  ],
  'luz': [
    { book: 'Salmos', chapter: 119, verse: 105, text: 'Lâmpada para os meus pés é tua palavra, e luz para o meu caminho.' },
    { book: 'Mateus', chapter: 5, verse: 14, text: 'Vós sois a luz do mundo; não se pode esconder uma cidade edificada sobre um monte.' },
  ]
};

export const BibleScreen: React.FC = () => {
  // Navigation State
  const [selectedBook, setSelectedBook] = useState(BIBLE_BOOKS[0]);
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [selectedVersion, setSelectedVersion] = useState(BIBLE_VERSIONS[0]);
  
  // Content State
  const [verses, setVerses] = useState<BibleVerse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [selectedVerseId, setSelectedVerseId] = useState<number | null>(null);

  // Notes & Highlights State
  const [userNotes, setUserNotes] = useState<Record<string, string>>({});
  const [userHighlights, setUserHighlights] = useState<Record<string, string>>({});
  
  // UI State
  const [isNoteEditorOpen, setIsNoteEditorOpen] = useState(false);
  const [currentNoteText, setCurrentNoteText] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<'book' | 'chapter'>('book');
  const [bookSearchQuery, setBookSearchQuery] = useState(''); 
  const [tempSelectedBook, setTempSelectedBook] = useState(BIBLE_BOOKS[0]);
  const [showToast, setShowToast] = useState(false);
  const [menuMode, setMenuMode] = useState<'main' | 'colors'>('main');
  const [isVersionMenuOpen, setIsVersionMenuOpen] = useState(false);

  // Text Search State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [textSearchQuery, setTextSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{book: string, chapter: number, verse: number, text: string}[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Audio / TTS State
  const [isAudioPlayerOpen, setIsAudioPlayerOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Load User Data from Supabase
  useEffect(() => {
    const loadUserData = async () => {
        try {
            const notes = await supabase.fetchBibleNotes();
            setUserNotes(notes);

            const highlights = await supabase.fetchBibleHighlights();
            setUserHighlights(highlights);
        } catch (e) {
            console.error("Erro ao carregar dados do usuário", e);
        }
    };
    loadUserData();

    // LocalStorage apenas para versão (preferência de UI)
    const savedVersion = localStorage.getItem('lumen_bible_version');
    if (savedVersion) {
        const found = BIBLE_VERSIONS.find(v => v.id === savedVersion);
        if (found) setSelectedVersion(found);
    }

    // Init Speech Synthesis
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        synthRef.current = window.speechSynthesis;
    }

    return () => {
        if (synthRef.current) {
            synthRef.current.cancel();
        }
    };
  }, []);

  // Fetch Bible Text from API
  useEffect(() => {
    const fetchChapter = async () => {
      handleStopAudio();
      setLoading(true);
      setError(false);
      setVerses([]);
      
      try {
        const apiVersion = selectedVersion.id === 'kjv' ? 'kjv' : 'almeida';
        const query = `${selectedBook.name} ${selectedChapter}`;
        const response = await fetch(`https://bible-api.com/${encodeURIComponent(query)}?translation=${apiVersion}`);
        
        if (!response.ok) throw new Error('Falha ao carregar');
        
        const data = await response.json();
        
        if (data.verses && Array.isArray(data.verses)) {
          const formattedVerses: BibleVerse[] = data.verses.map((v: any) => ({
            book: selectedBook.name,
            chapter: selectedChapter,
            verse: v.verse,
            text: v.text
          }));
          setVerses(formattedVerses);
          
          if (selectedVerseId) {
             setTimeout(() => {
                const element = document.getElementById(`verse-${selectedVerseId}`);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
             }, 500);
          }
        } else {
            setError(true);
        }
      } catch (err) {
        console.error(err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchChapter();
  }, [selectedBook, selectedChapter, selectedVersion]);

  // Helpers
  const getVerseKey = (verseNum: number) => `${selectedBook.name}-${selectedChapter}-${verseNum}`;

  // Smart Navigation Logic
  const currentBookIndex = BIBLE_BOOKS.findIndex(b => b.name === selectedBook.name);
  const isFirstChapter = currentBookIndex === 0 && selectedChapter === 1;
  const isLastChapter = currentBookIndex === BIBLE_BOOKS.length - 1 && selectedChapter === selectedBook.chapters;

  const handlePrevChapter = () => {
    setSelectedVerseId(null);
    if (selectedChapter > 1) {
      setSelectedChapter(c => c - 1);
    } else if (currentBookIndex > 0) {
      const prevBook = BIBLE_BOOKS[currentBookIndex - 1];
      setSelectedBook(prevBook);
      setSelectedChapter(prevBook.chapters);
    }
  };

  const handleNextChapter = () => {
    setSelectedVerseId(null);
    if (selectedChapter < selectedBook.chapters) {
      setSelectedChapter(c => c + 1);
    } else if (currentBookIndex < BIBLE_BOOKS.length - 1) {
      const nextBook = BIBLE_BOOKS[currentBookIndex + 1];
      setSelectedBook(nextBook);
      setSelectedChapter(1);
    }
  };

  // Handlers
  const handleVerseClick = (verseNum: number) => {
    if (selectedVerseId === verseNum) {
        setSelectedVerseId(null);
        setMenuMode('main');
    } else {
        setSelectedVerseId(verseNum);
        setMenuMode('main');
    }
  };

  const closeActionMenu = () => {
    setSelectedVerseId(null);
    setMenuMode('main');
  };

  // --- AUDIO / TTS HANDLERS ---
  const handleSpeakText = (text: string) => {
    if (!synthRef.current) return;
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = selectedVersion.id === 'kjv' ? 'en-US' : 'pt-BR';
    utterance.rate = playbackRate;
    
    utterance.onstart = () => { setIsPlaying(true); setIsPaused(false); };
    utterance.onend = () => { setIsPlaying(false); setIsPaused(false); setIsAudioPlayerOpen(false); };
    utterance.onerror = () => { setIsPlaying(false); setIsPaused(false); };

    utteranceRef.current = utterance;
    synthRef.current.speak(utterance);
    
    closeActionMenu();
    setIsAudioPlayerOpen(true);
  };

  const handleSpeakVerse = () => {
      if (!selectedVerseId) return;
      const verse = verses.find(v => v.verse === selectedVerseId);
      if (verse) handleSpeakText(`${selectedBook.name} ${selectedChapter}:${verse.verse}. ${verse.text}`);
  };

  const handleSpeakChapter = () => {
      if (verses.length === 0) return;
      const fullText = `${selectedBook.name} capítulo ${selectedChapter}. ` + 
                       verses.map(v => `Versículo ${v.verse}. ${v.text}`).join(' ');
      handleSpeakText(fullText);
  };

  const handleTogglePlayPause = () => {
      if (!synthRef.current) return;
      if (synthRef.current.paused) {
          synthRef.current.resume();
          setIsPaused(false);
          setIsPlaying(true);
      } else if (synthRef.current.speaking) {
          synthRef.current.pause();
          setIsPaused(true);
          setIsPlaying(false);
      }
  };

  const handleStopAudio = () => {
      if (synthRef.current) synthRef.current.cancel();
      setIsPlaying(false);
      setIsPaused(false);
      setIsAudioPlayerOpen(false);
  };

  const handleChangeSpeed = () => {
      const speeds = [0.75, 1, 1.25, 1.5, 2];
      const nextRate = speeds[(speeds.indexOf(playbackRate) + 1) % speeds.length];
      setPlaybackRate(nextRate);
      
      if (synthRef.current && (isPlaying || isPaused) && utteranceRef.current) {
           handleSpeakText(utteranceRef.current.text);
      }
  };

  // --- SHARE ---
  const handleShare = async () => {
    if (!selectedVerseId) return;
    const verseObj = verses.find(v => v.verse === selectedVerseId);
    if (!verseObj) return;

    const textToShare = `"${verseObj.text.trim()}"\n\n${selectedBook.name} ${selectedChapter}:${selectedVerseId} (${selectedVersion.label})\nvia App Lumen`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Palavra do Dia', text: textToShare });
        closeActionMenu();
      } catch (error) {}
    } else {
      navigator.clipboard.writeText(textToShare);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      closeActionMenu();
    }
  };

  // Highlight Handlers (Supabase)
  const handleColorSelect = async (colorValue: string | null) => {
    if (!selectedVerseId) return;
    const key = getVerseKey(selectedVerseId);
    
    // Otimistic Update
    const updatedHighlights = { ...userHighlights };
    if (colorValue) {
        updatedHighlights[key] = colorValue;
        supabase.saveBibleHighlight(key, colorValue); // Async call
    } else {
        delete updatedHighlights[key];
        supabase.deleteBibleHighlight(key); // Async call
    }

    setUserHighlights(updatedHighlights);
    closeActionMenu();
  };

  // Note Handlers (Supabase)
  const handleOpenNoteEditor = () => {
    if (!selectedVerseId) return;
    const key = getVerseKey(selectedVerseId);
    setCurrentNoteText(userNotes[key] || '');
    setIsNoteEditorOpen(true);
  };

  const handleSaveNote = async () => {
    if (!selectedVerseId) return;
    const key = getVerseKey(selectedVerseId);
    
    // Otimistic Update
    const updatedNotes = { ...userNotes };
    
    if (currentNoteText.trim()) {
      updatedNotes[key] = currentNoteText;
      await supabase.saveBibleNote(key, currentNoteText);
    } else {
      delete updatedNotes[key];
      await supabase.deleteBibleNote(key);
    }

    setUserNotes(updatedNotes);
    setIsNoteEditorOpen(false);
    closeActionMenu();
  };

  const handleDeleteNote = async () => {
    if (!selectedVerseId) return;
    const key = getVerseKey(selectedVerseId);
    
    const updatedNotes = { ...userNotes };
    delete updatedNotes[key];
    setUserNotes(updatedNotes);
    
    await supabase.deleteBibleNote(key);
    
    setIsNoteEditorOpen(false);
    closeActionMenu();
  };

  const handleBookSelect = (book: typeof BIBLE_BOOKS[0]) => {
    setTempSelectedBook(book);
    setModalStep('chapter');
    setBookSearchQuery('');
  };

  const handleChapterSelect = (chapter: number) => {
    setSelectedBook(tempSelectedBook);
    setSelectedChapter(chapter);
    setIsModalOpen(false);
    setModalStep('book');
    setSelectedVerseId(null);
  };

  const openModal = () => {
    setTempSelectedBook(selectedBook);
    setModalStep('book');
    setIsModalOpen(true);
    setBookSearchQuery('');
  };
  
  const handleVersionSelect = (version: typeof BIBLE_VERSIONS[0]) => {
    setSelectedVersion(version);
    localStorage.setItem('lumen_bible_version', version.id);
    setIsVersionMenuOpen(false);
  };

  // -- SEARCH LOGIC --
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textSearchQuery.trim()) return;

    setIsSearching(true);
    setSearchResults([]);
    setHasSearched(true);
    await new Promise(resolve => setTimeout(resolve, 800));

    const term = textSearchQuery.toLowerCase().trim();
    let results: {book: string, chapter: number, verse: number, text: string}[] = [];

    if (MOCK_SEARCH_RESULTS[term]) {
        results = MOCK_SEARCH_RESULTS[term];
    } else {
        Object.keys(MOCK_SEARCH_RESULTS).forEach(key => {
            if (term.includes(key)) results = [...results, ...MOCK_SEARCH_RESULTS[key]];
        });
    }
    setSearchResults(results);
    setIsSearching(false);
  };

  const handleSearchResultClick = (result: {book: string, chapter: number, verse: number}) => {
      const bookObj = BIBLE_BOOKS.find(b => b.name === result.book);
      if (bookObj) {
          setSelectedBook(bookObj);
          setSelectedChapter(result.chapter);
          setSelectedVerseId(result.verse);
          setIsSearchOpen(false);
          setSearchResults([]);
          setTextSearchQuery('');
          setHasSearched(false);
      }
  };

  const filteredBooks = BIBLE_BOOKS.filter(b => 
    b.name.toLowerCase().includes(bookSearchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-paper pb-20 md:pb-0 relative">
      
      {/* --- HEADER --- */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-100 px-4 md:px-8 py-3 flex justify-between items-center shadow-sm transition-all w-full">
        <div className="flex items-center gap-1 md:gap-2">
            <button 
                onClick={handlePrevChapter}
                disabled={isFirstChapter}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-500 hover:text-navy-900 hover:border-gold-400 hover:shadow-md transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
                <ChevronLeft size={20} />
            </button>

            <button 
              onClick={openModal}
              className="flex items-center gap-3 bg-slate-50 hover:bg-slate-100 pl-3 pr-4 py-2 rounded-full transition-all group border border-slate-200 hover:border-gold-300"
            >
              <div className="w-8 h-8 rounded-full bg-navy-900 text-white flex items-center justify-center shrink-0">
                <Book size={14} />
              </div>
              <div className="text-left flex flex-col leading-none">
                <span className="text-sm font-bold text-navy-900 group-hover:text-gold-600 transition-colors">
                  {selectedBook.name}
                </span>
                <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
                  Capítulo {selectedChapter}
                </span>
              </div>
              <ChevronDown size={14} className="text-slate-400 ml-1 group-hover:text-gold-500 transition-colors" />
            </button>

            <button 
                onClick={handleNextChapter}
                disabled={isLastChapter}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-500 hover:text-navy-900 hover:border-gold-400 hover:shadow-md transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
                <ChevronRight size={20} />
            </button>
        </div>
        
        <div className="flex items-center gap-2">
            <button
                onClick={() => setIsSearchOpen(true)}
                className="p-2 text-navy-900 hover:bg-slate-100 rounded-full transition-colors"
            >
                <Search size={20} />
            </button>
            
            <div className="relative">
              <button 
                onClick={() => setIsVersionMenuOpen(!isVersionMenuOpen)}
                className="text-[10px] font-bold text-navy-800 tracking-wider bg-gold-100 hover:bg-gold-200 px-2 py-1.5 rounded-md border border-gold-200 transition-colors flex items-center gap-1 min-w-[3rem] justify-center"
              >
                {selectedVersion.label}
                <ChevronDown size={10} />
              </button>
              
              {isVersionMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsVersionMenuOpen(false)}></div>
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-20 animate-in fade-in zoom-in-95 duration-200">
                     <div className="px-3 py-2 border-b border-slate-100">
                       <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Versão</span>
                     </div>
                     {BIBLE_VERSIONS.map((v) => (
                       <button
                         key={v.id}
                         onClick={() => handleVersionSelect(v)}
                         className={`w-full text-left px-4 py-2.5 text-xs font-medium hover:bg-slate-50 transition-colors flex items-center justify-between ${
                           selectedVersion.id === v.id ? 'text-navy-900 bg-slate-50' : 'text-slate-600'
                         }`}
                       >
                         {v.name}
                         {selectedVersion.id === v.id && <Check size={12} className="text-gold-500" />}
                       </button>
                     ))}
                  </div>
                </>
              )}
            </div>
        </div>
      </header>

      {/* --- CONTENT --- */}
      <div className="flex-1 overflow-y-auto px-5 py-6 w-full relative scroll-smooth">
        <div className="max-w-2xl mx-auto w-full">
            {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center pt-20 z-10">
                <div className="relative">
                    <div className="absolute inset-0 bg-gold-200 rounded-full blur-xl opacity-50 animate-pulse"></div>
                    <Loader2 className="animate-spin text-navy-900 relative z-10" size={40} />
                </div>
                <p className="text-xs text-navy-600 mt-4 font-medium tracking-wide uppercase animate-pulse">Carregando...</p>
            </div>
            ) : error ? (
            <div className="text-center mt-20 px-4 flex flex-col items-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400">
                    <X size={24} />
                </div>
                <p className="text-slate-600 mb-4 text-sm font-medium">Não foi possível carregar o texto sagrado.</p>
                <button 
                    onClick={() => setSelectedChapter(selectedChapter)} 
                    className="px-6 py-2 bg-navy-900 text-white text-sm rounded-full font-medium hover:bg-navy-800 transition-colors"
                >
                Tentar novamente
                </button>
            </div>
            ) : (
            <div className="space-y-6 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="text-center mb-8 border-b border-slate-100 pb-6 relative group">
                    <span className="text-xs font-bold text-gold-500 uppercase tracking-[0.2em] mb-2 block">
                        {selectedBook.name}
                    </span>
                    <h2 className="font-serif text-5xl font-bold text-navy-900">
                    {selectedChapter}
                    </h2>
                    <span className="text-[10px] text-slate-400 mt-2 block opacity-70">
                        {selectedVersion.name}
                    </span>

                    <button 
                    onClick={handleSpeakChapter}
                    className="absolute right-0 bottom-6 p-2 bg-slate-50 text-slate-400 hover:text-navy-900 hover:bg-gold-50 rounded-full transition-all opacity-0 group-hover:opacity-100"
                    title="Ouvir Capítulo"
                    >
                    <Volume2 size={20} />
                    </button>
                </div>
                
                <div className="space-y-4">
                    {verses.map((verse) => {
                    const verseKey = getVerseKey(verse.verse);
                    const hasNote = !!userNotes[verseKey];
                    const highlightColor = userHighlights[verseKey];
                    const isSelected = selectedVerseId === verse.verse;

                    return (
                        <div 
                            key={verse.verse} 
                            id={`verse-${verse.verse}`}
                            onClick={() => handleVerseClick(verse.verse)}
                            style={{ backgroundColor: highlightColor || (isSelected ? '#f8fafc' : 'transparent') }}
                            className={`font-serif text-[1.15rem] leading-[1.8] text-navy-900 cursor-pointer rounded-lg px-2 py-1 -mx-2 transition-all duration-200 relative group
                                ${isSelected && !highlightColor ? 'bg-slate-50 shadow-sm ring-1 ring-slate-200' : ''}
                                ${!isSelected && !highlightColor ? 'hover:bg-slate-50/50' : ''}
                                ${isSelected && highlightColor ? 'ring-2 ring-black/5 shadow-sm' : ''}
                            `}
                        >
                            <span className={`absolute left-0 top-3 text-[9px] font-sans font-bold select-none transition-colors ${isSelected ? 'text-navy-900' : 'text-slate-300 group-hover:text-slate-400'}`}>
                            {verse.verse}
                            </span>
                            
                            <div className="pl-6 relative">
                                {verse.text}
                                {hasNote && (
                                    <span className="inline-block ml-2 align-middle">
                                        <MessageSquareText size={14} className="text-navy-900 fill-white" />
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                    })}
                </div>
                
                <div className="flex justify-between items-center mt-12 pt-8 border-t border-slate-100">
                    <button 
                        disabled={isFirstChapter}
                        onClick={handlePrevChapter}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-600 hover:text-navy-900 hover:bg-slate-50 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <ArrowLeft size={18} /> 
                        <span className="hidden sm:inline">Anterior</span>
                    </button>
                    <div className="text-xs text-slate-300 font-medium">
                        {selectedBook.name} {selectedChapter}
                    </div>
                    <button 
                        disabled={isLastChapter}
                        onClick={handleNextChapter}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-600 hover:text-navy-900 hover:bg-slate-50 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <span className="hidden sm:inline">Próximo</span>
                        <ArrowRight size={18} />
                    </button>
                </div>
            </div>
            )}
        </div>
      </div>

      {/* --- TEXT SEARCH OVERLAY --- */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 bg-paper flex flex-col animate-in fade-in duration-200">
            <div className="bg-white px-4 py-3 border-b border-slate-100 shadow-sm flex items-center gap-3 shrink-0">
                <button 
                    onClick={() => setIsSearchOpen(false)}
                    className="p-2 -ml-2 text-slate-400 hover:text-navy-900 hover:bg-slate-100 rounded-full transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <form onSubmit={handleSearchSubmit} className="flex-1 relative">
                    <input
                        type="text"
                        placeholder="Buscar por texto (ex: amor, paz)..."
                        value={textSearchQuery}
                        onChange={(e) => setTextSearchQuery(e.target.value)}
                        autoFocus
                        className="w-full bg-slate-50 text-navy-900 rounded-xl py-3 pl-4 pr-12 outline-none border border-transparent focus:border-gold-300 focus:bg-white focus:ring-4 focus:ring-gold-100 transition-all text-base"
                    />
                    <button 
                        type="submit"
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-navy-900 text-white rounded-lg hover:bg-navy-800 transition-colors"
                        disabled={!textSearchQuery.trim()}
                    >
                        <Search size={16} />
                    </button>
                </form>
            </div>

            <div className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full">
                {isSearching ? (
                    <div className="flex flex-col items-center justify-center pt-20">
                        <Loader2 className="animate-spin text-navy-900 mb-2" size={32} />
                        <p className="text-slate-500 text-sm">Pesquisando nas escrituras...</p>
                    </div>
                ) : searchResults.length > 0 ? (
                    <div className="space-y-4 pb-20">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                            {searchResults.length} Resultados encontrados
                        </p>
                        {searchResults.map((result, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleSearchResultClick(result)}
                                className="w-full text-left bg-white p-5 rounded-xl border border-slate-100 shadow-sm hover:border-gold-300 hover:shadow-md transition-all group"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-bold text-navy-900 group-hover:text-gold-600 transition-colors">
                                        {result.book} {result.chapter}:{result.verse}
                                    </span>
                                    <CornerDownLeft size={14} className="text-slate-300 group-hover:text-gold-400" />
                                </div>
                                <p className="text-slate-600 font-serif text-sm leading-relaxed line-clamp-2">
                                    {result.text}
                                </p>
                            </button>
                        ))}
                    </div>
                ) : hasSearched ? (
                    <div className="text-center pt-20 px-6">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                            <Search size={24} />
                        </div>
                        <h3 className="text-navy-900 font-bold mb-2">Nenhum resultado</h3>
                        <p className="text-slate-500 text-sm mb-6">
                            Tente buscar por termos como "amor", "paz" ou "luz" para testar a funcionalidade.
                        </p>
                    </div>
                ) : (
                    <div className="text-center pt-20 px-6 opacity-60">
                         <p className="text-slate-400 text-sm">Digite uma palavra para buscar versículos.</p>
                    </div>
                )}
            </div>
        </div>
      )}

      {/* --- FLOATING ACTION MENU --- */}
      {selectedVerseId && !isNoteEditorOpen && !isSearchOpen && !isAudioPlayerOpen && (
        <div className="fixed bottom-24 md:bottom-10 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:max-w-sm bg-navy-900/95 backdrop-blur shadow-2xl rounded-2xl p-2 z-40 animate-in slide-in-from-bottom-5 fade-in duration-300 ring-1 ring-white/10">
           {menuMode === 'main' ? (
             <div className="flex justify-between items-center">
                <button className="flex-1 flex flex-col items-center gap-1 py-2 text-slate-300 hover:text-white transition-colors" onClick={() => setMenuMode('colors')}>
                  <Highlighter size={18} className={userHighlights[getVerseKey(selectedVerseId)] ? "text-gold-400 fill-gold-400" : ""} />
                  <span className="text-[9px] font-medium uppercase tracking-wide">Destacar</span>
                </button>
                <button className="flex-1 flex flex-col items-center gap-1 py-2 text-slate-300 hover:text-white transition-colors" onClick={handleOpenNoteEditor}>
                  <PenLine size={18} />
                  <span className="text-[9px] font-medium uppercase tracking-wide">
                      {userNotes[getVerseKey(selectedVerseId)] ? 'Editar' : 'Anotar'}
                  </span>
                </button>
                <button className="flex-1 flex flex-col items-center gap-1 py-2 text-slate-300 hover:text-white transition-colors" onClick={handleSpeakVerse}>
                  <Volume2 size={18} />
                  <span className="text-[9px] font-medium uppercase tracking-wide">Ouvir</span>
                </button>
                <button className="flex-1 flex flex-col items-center gap-1 py-2 text-slate-300 hover:text-white transition-colors" onClick={handleShare}>
                  {navigator.share ? <Share2 size={18} /> : <Copy size={18} />}
                  <span className="text-[9px] font-medium uppercase tracking-wide">
                      {navigator.share ? 'Enviar' : 'Copiar'}
                  </span>
                </button>
                <div className="w-px h-8 bg-white/10 mx-1"></div>
                <button onClick={closeActionMenu} className="p-3 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                  <X size={18} />
                </button>
             </div>
           ) : (
             <div className="flex items-center justify-between px-2 py-1 animate-in slide-in-from-bottom-2 fade-in">
                <button onClick={() => setMenuMode('main')} className="mr-3 p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white">
                    <ChevronLeft size={20} />
                </button>
                <div className="flex gap-3">
                    <button 
                        onClick={() => handleColorSelect(null)}
                        className="w-8 h-8 rounded-full border-2 border-slate-500 bg-transparent flex items-center justify-center text-slate-400 hover:border-white hover:text-white transition-all"
                        title="Remover destaque"
                    >
                        <Ban size={14} />
                    </button>
                    {HIGHLIGHT_COLORS.map(color => (
                        <button
                            key={color.id}
                            onClick={() => handleColorSelect(color.value)}
                            className="w-8 h-8 rounded-full shadow-sm transition-transform hover:scale-110 focus:scale-95"
                            style={{ backgroundColor: color.value, border: `2px solid ${color.border}` }}
                        />
                    ))}
                </div>
             </div>
           )}
        </div>
      )}

      {/* --- AUDIO PLAYER BAR --- */}
      {isAudioPlayerOpen && (
        <div className="fixed bottom-24 md:bottom-10 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:max-w-sm bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-100 rounded-2xl p-3 z-40 animate-in slide-in-from-bottom-5 fade-in duration-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
                 <div className="w-10 h-10 bg-navy-50 rounded-full flex items-center justify-center text-navy-900">
                    <Volume2 size={20} className={isPlaying ? "animate-pulse" : ""} />
                 </div>
                 <div className="flex flex-col">
                    <span className="text-xs font-bold text-navy-900">Lendo</span>
                    <span className="text-[10px] text-slate-500">
                        {selectedVerseId ? `Versículo ${selectedVerseId}` : 'Capítulo Completo'}
                    </span>
                 </div>
            </div>

            <div className="flex items-center gap-2">
                <button 
                    onClick={handleChangeSpeed}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-xs font-bold text-slate-500 transition-colors border border-slate-200"
                    title="Velocidade"
                >
                    {playbackRate}x
                </button>
                <button 
                    onClick={handleTogglePlayPause}
                    className="w-10 h-10 bg-navy-900 text-white rounded-full flex items-center justify-center hover:bg-navy-800 transition-all shadow-md active:scale-95"
                >
                    {isPaused || !isPlaying ? <Play size={18} className="ml-1" /> : <Pause size={18} />}
                </button>
                <button 
                    onClick={handleStopAudio}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors"
                >
                    <Square size={16} fill="currentColor" />
                </button>
            </div>
        </div>
      )}

      {/* --- TOAST --- */}
      {showToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-navy-800 text-white px-5 py-3 rounded-full shadow-xl z-[60] flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 border border-navy-700">
            <Check size={16} className="text-green-400" />
            <span className="text-xs font-medium tracking-wide">Versículo copiado para área de transferência</span>
        </div>
      )}

      {/* --- NOTE EDITOR MODAL --- */}
      {isNoteEditorOpen && selectedVerseId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h3 className="text-navy-900 font-bold">Minha Anotação</h3>
                        <p className="text-xs text-slate-500 mt-0.5">{selectedBook.name} {selectedChapter}:{selectedVerseId}</p>
                    </div>
                    <button onClick={() => setIsNoteEditorOpen(false)} className="text-slate-400 hover:text-navy-900 transition-colors">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-5">
                    <textarea 
                        className="w-full h-40 p-3 bg-slate-50 rounded-xl border border-slate-200 text-navy-900 placeholder:text-slate-400 resize-none outline-none focus:ring-2 focus:ring-gold-200 focus:border-gold-400 text-sm leading-relaxed"
                        placeholder="Escreva seus pensamentos sobre este versículo..."
                        value={currentNoteText}
                        onChange={(e) => setCurrentNoteText(e.target.value)}
                        autoFocus
                    />
                    <div className="flex gap-3 mt-4">
                        {userNotes[getVerseKey(selectedVerseId)] && (
                            <button 
                                onClick={handleDeleteNote}
                                className="px-4 py-2.5 rounded-xl border border-rose-100 text-rose-600 hover:bg-rose-50 font-medium text-sm flex items-center gap-2 transition-colors"
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                        <div className="flex-1 flex gap-3 justify-end">
                            <button 
                                onClick={() => setIsNoteEditorOpen(false)}
                                className="px-5 py-2.5 rounded-xl text-slate-600 font-medium text-sm hover:bg-slate-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleSaveNote}
                                className="px-6 py-2.5 rounded-xl bg-navy-900 text-white font-medium text-sm shadow-lg hover:bg-navy-800 active:scale-95 transition-all flex items-center gap-2"
                            >
                                <Save size={16} />
                                Salvar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* --- ROBUST SELECTION MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-50 animate-in slide-in-from-bottom-[5%] duration-300">
            <div className="bg-white px-4 py-3 border-b border-slate-200 shadow-sm flex items-center justify-between shrink-0 z-10">
                {modalStep === 'chapter' ? (
                    <button 
                        onClick={() => setModalStep('book')} 
                        className="p-2 -ml-2 text-slate-500 hover:text-navy-900 hover:bg-slate-100 rounded-full transition-colors flex items-center gap-1"
                    >
                        <ChevronLeft size={20} />
                        <span className="text-sm font-medium">Livros</span>
                    </button>
                ) : (
                    <div className="w-20"></div> 
                )}
                
                <h2 className="text-sm font-bold text-navy-900 uppercase tracking-widest">
                    {modalStep === 'book' ? 'Selecionar Livro' : tempSelectedBook.name}
                </h2>

                <button 
                    onClick={() => setIsModalOpen(false)} 
                    className="p-2 -mr-2 text-slate-400 hover:text-navy-900 hover:bg-slate-100 rounded-full transition-colors"
                >
                    <X size={20} />
                </button>
            </div>

            <div className="flex-1 overflow-hidden relative">
                {modalStep === 'book' ? (
                    <div className="flex flex-col h-full">
                        <div className="px-4 py-3 bg-white border-b border-slate-100">
                            <div className="relative group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-gold-500 transition-colors" size={18} />
                                <input 
                                    type="text" 
                                    placeholder="Buscar livro (ex: João)..." 
                                    value={bookSearchQuery}
                                    onChange={(e) => setBookSearchQuery(e.target.value)}
                                    className="w-full bg-slate-50 text-navy-900 rounded-xl py-3 pl-10 pr-4 outline-none border border-transparent focus:border-gold-300 focus:bg-white focus:ring-4 focus:ring-gold-100 transition-all placeholder:text-slate-400 text-base"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 scroll-smooth">
                            {filteredBooks.length === 0 && (
                                <div className="text-center py-20 text-slate-400 flex flex-col items-center">
                                    <Search size={32} className="mb-2 opacity-50" />
                                    <p>Nenhum livro encontrado</p>
                                </div>
                            )}
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pb-20">
                                {filteredBooks.map((book) => (
                                    <button
                                        key={book.name}
                                        onClick={() => handleBookSelect(book)}
                                        className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-100 shadow-sm hover:border-gold-300 hover:shadow-md active:scale-[0.98] transition-all text-left group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-1 h-8 rounded-full ${book.testment === 'VT' ? 'bg-navy-200' : 'bg-gold-400'}`}></div>
                                            <span className="font-semibold text-navy-800 group-hover:text-navy-900 text-lg">{book.name}</span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${book.testment === 'VT' ? 'bg-slate-100 text-slate-500' : 'bg-gold-50 text-gold-700'}`}>
                                                {book.testment}
                                            </span>
                                            <span className="text-[10px] text-slate-400 mt-1">{book.chapters} caps</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-full overflow-y-auto bg-slate-50">
                        <div className="p-6 pb-20 max-w-4xl mx-auto">
                            <p className="text-sm text-slate-500 mb-6 text-center font-medium">Escolha um capítulo para iniciar a leitura</p>
                            
                            <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
                                {Array.from({ length: tempSelectedBook.chapters }, (_, i) => i + 1).map((chap) => (
                                    <button
                                        key={chap}
                                        onClick={() => handleChapterSelect(chap)}
                                        className={`aspect-square rounded-2xl font-bold text-lg flex items-center justify-center transition-all duration-200 ${
                                            selectedChapter === chap && selectedBook.name === tempSelectedBook.name
                                                ? 'bg-navy-900 text-white shadow-lg ring-4 ring-navy-100'
                                                : 'bg-white text-navy-800 border border-slate-200 hover:border-gold-400 hover:text-gold-600 hover:shadow-md active:scale-95'
                                        }`}
                                    >
                                        {chap}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
      )}

    </div>
  );
};
