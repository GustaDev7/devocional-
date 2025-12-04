
import React, { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Minimize2, Maximize2, Music, CloudRain, Waves, Play, Pause } from 'lucide-react';

const TRACKS = [
  { id: 'piano', name: 'Piano Sereno', url: 'https://cdn.pixabay.com/download/audio/2022/03/10/audio_c8c8a73467.mp3?filename=calm-piano-music-137076.mp3' }, // Royalty free placeholder
  { id: 'rain', name: 'Chuva Suave', url: 'https://cdn.pixabay.com/download/audio/2022/02/16/audio_f5b5463032.mp3?filename=light-rain-ambient-114354.mp3' },
  { id: 'ocean', name: 'Oceano', url: 'https://cdn.pixabay.com/download/audio/2021/08/09/audio_03e679c5c5.mp3?filename=sea-waves-loop-119614.mp3' }
];

export const AmbientPlayer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(TRACKS[0]);
  const [volume, setVolume] = useState(0.5);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio(currentTrack.url);
    audioRef.current.loop = true;
    audioRef.current.volume = volume;

    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
        audioRef.current.src = currentTrack.url;
        if (isPlaying) {
            audioRef.current.play().catch(e => console.log("Audio play error", e));
        }
    }
  }, [currentTrack]);

  useEffect(() => {
      if (audioRef.current) {
          audioRef.current.volume = volume;
      }
  }, [volume]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
        audioRef.current.pause();
    } else {
        audioRef.current.play().catch(e => console.log("Audio play error", e));
    }
    setIsPlaying(!isPlaying);
  };

  const handleTrackChange = (track: typeof TRACKS[0]) => {
      setCurrentTrack(track);
      if (!isPlaying) {
          setIsPlaying(true);
      }
  };

  return (
    <div className={`fixed z-40 transition-all duration-500 ease-out ${
        isOpen 
        ? 'bottom-36 right-4 md:bottom-6 md:right-6 w-72' 
        : 'bottom-36 right-4 md:bottom-6 md:right-6 w-12 h-12 rounded-full hover:scale-105'
    }`}>
        {/* Minimized State */}
        {!isOpen && (
            <button 
                onClick={() => setIsOpen(true)}
                className={`w-full h-full rounded-full shadow-lg flex items-center justify-center transition-all ${
                    isPlaying 
                    ? 'bg-gold-500 text-white animate-spin-slow' 
                    : 'bg-white dark:bg-navy-800 text-slate-400 dark:text-slate-300'
                }`}
                aria-label="Abrir Player de Música"
            >
                <Music size={20} />
            </button>
        )}

        {/* Expanded State */}
        {isOpen && (
            <div className="bg-white/90 dark:bg-navy-900/90 backdrop-blur-xl border border-slate-100 dark:border-navy-700 rounded-2xl shadow-2xl overflow-hidden animate-zoom-in">
                <div className="p-4 border-b border-slate-100 dark:border-navy-800 flex justify-between items-center bg-white/50 dark:bg-navy-800/50">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-navy-900 dark:text-white uppercase tracking-wider">Modo Santuário</span>
                        {isPlaying && (
                             <div className="flex gap-0.5 items-end h-3">
                                 <div className="w-0.5 bg-gold-500 animate-[pulse_1s_ease-in-out_infinite] h-2"></div>
                                 <div className="w-0.5 bg-gold-500 animate-[pulse_1.5s_ease-in-out_infinite] h-3"></div>
                                 <div className="w-0.5 bg-gold-500 animate-[pulse_0.5s_ease-in-out_infinite] h-1.5"></div>
                             </div>
                        )}
                    </div>
                    <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-navy-900 dark:hover:text-white transition-colors">
                        <Minimize2 size={16} />
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    <div className="flex justify-center gap-4">
                        <button 
                            onClick={() => handleTrackChange(TRACKS[0])}
                            className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${currentTrack.id === 'piano' ? 'bg-navy-50 dark:bg-navy-800 text-gold-600 dark:text-gold-400' : 'text-slate-400 hover:text-navy-700 dark:hover:text-slate-200'}`}
                        >
                            <Music size={20} />
                            <span className="text-[9px] font-bold">Piano</span>
                        </button>
                        <button 
                            onClick={() => handleTrackChange(TRACKS[1])}
                            className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${currentTrack.id === 'rain' ? 'bg-navy-50 dark:bg-navy-800 text-gold-600 dark:text-gold-400' : 'text-slate-400 hover:text-navy-700 dark:hover:text-slate-200'}`}
                        >
                            <CloudRain size={20} />
                            <span className="text-[9px] font-bold">Chuva</span>
                        </button>
                        <button 
                            onClick={() => handleTrackChange(TRACKS[2])}
                            className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${currentTrack.id === 'ocean' ? 'bg-navy-50 dark:bg-navy-800 text-gold-600 dark:text-gold-400' : 'text-slate-400 hover:text-navy-700 dark:hover:text-slate-200'}`}
                        >
                            <Waves size={20} />
                            <span className="text-[9px] font-bold">Mar</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                         <button 
                            onClick={togglePlay}
                            className="w-10 h-10 rounded-full bg-navy-900 dark:bg-gold-500 text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
                         >
                             {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
                         </button>
                         <div className="flex-1 flex items-center gap-2">
                             <Volume2 size={14} className="text-slate-400" />
                             <input 
                                type="range" 
                                min="0" 
                                max="1" 
                                step="0.01" 
                                value={volume}
                                onChange={(e) => setVolume(parseFloat(e.target.value))}
                                className="w-full h-1 bg-slate-200 dark:bg-navy-700 rounded-lg appearance-none cursor-pointer accent-navy-900 dark:accent-gold-500"
                             />
                         </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
