import React, { useState, useEffect, useRef } from 'react';

interface AudioPlayerBoxProps {
  audio?: string;
  maxPlayCount?: number; // e.g. 2 times for standard exam, or undefined/0 for unlimited
  autoPlay?: boolean;
  isSubmitted?: boolean; // When finished, students can replay freely for review
  questionIndex: number;
  showToast: (msg: string, type?: 'success' | 'warn' | 'error' | 'info') => void;
}

export const AudioPlayerBox: React.FC<AudioPlayerBoxProps> = ({
  audio,
  maxPlayCount = 2,
  autoPlay = false,
  isSubmitted = false,
  questionIndex,
  showToast
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playCount, setPlayCount] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsIntervalRef = useRef<any>(null);
  const isTts = Boolean(audio && audio.startsWith('tts:'));

  // Reset or initialize play state when question changes
  useEffect(() => {
    // Stop any ongoing audio
    stopAudio();
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    // If auto-play is enabled and student hasn't exceeded play count
    if (autoPlay && audio && (maxPlayCount === 0 || playCount < maxPlayCount || isSubmitted)) {
      const timer = setTimeout(() => {
        handlePlay();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [questionIndex, audio]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (ttsIntervalRef.current) {
      clearInterval(ttsIntervalRef.current);
      ttsIntervalRef.current = null;
    }
  };

  const isLimitReached = !isSubmitted && maxPlayCount > 0 && playCount >= maxPlayCount;

  const handlePlay = () => {
    if (!audio) return;

    if (isLimitReached) {
      showToast(`Em đã nghe đủ ${maxPlayCount}/${maxPlayCount} lượt quy định cho câu này!`, 'warn');
      return;
    }

    if (isPlaying) {
      // Pause
      if (isTts) {
        window.speechSynthesis.pause();
      } else if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
      return;
    }

    // Play TTS
    if (isTts) {
      const text = audio.replace(/^tts:/, '').trim();
      if (!text) {
        showToast('Nội dung bài nghe rỗng!', 'warn');
        return;
      }

      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'en-US';
      utter.rate = 0.95;

      // Estimate duration based on word count (~150 words per minute)
      const words = text.split(/\s+/).length;
      const estimatedSec = Math.max(3, Math.round((words / 2.2) + 1));
      setDuration(estimatedSec);
      setCurrentTime(0);

      utter.onstart = () => {
        setIsPlaying(true);
        if (!isSubmitted && maxPlayCount > 0) {
          setPlayCount((prev) => prev + 1);
        }
        // Progress simulation for TTS
        let elapsed = 0;
        if (ttsIntervalRef.current) clearInterval(ttsIntervalRef.current);
        ttsIntervalRef.current = setInterval(() => {
          elapsed += 0.5;
          setCurrentTime(Math.min(estimatedSec, elapsed));
        }, 500);
      };

      utter.onend = () => {
        setIsPlaying(false);
        setCurrentTime(estimatedSec);
        if (ttsIntervalRef.current) {
          clearInterval(ttsIntervalRef.current);
          ttsIntervalRef.current = null;
        }
      };

      utter.onerror = () => {
        setIsPlaying(false);
        if (ttsIntervalRef.current) {
          clearInterval(ttsIntervalRef.current);
          ttsIntervalRef.current = null;
        }
      };

      window.speechSynthesis.speak(utter);
      return;
    }

    // Play standard audio file / URL
    if (audioRef.current) {
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          if (!isSubmitted && maxPlayCount > 0) {
            setPlayCount((prev) => prev + 1);
          }
        })
        .catch((err) => {
          console.error(err);
          showToast('Không thể phát file âm thanh này!', 'warn');
        });
    }
  };

  const handleReplay = () => {
    if (isLimitReached) {
      showToast(`Em đã nghe đủ ${maxPlayCount}/${maxPlayCount} lượt quy định!`, 'warn');
      return;
    }
    stopAudio();
    setIsPlaying(false);
    setCurrentTime(0);
    setTimeout(() => {
      handlePlay();
    }, 100);
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (!audio) return null;

  return (
    <div className="my-3 p-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-lg shadow-emerald-700/20 border border-emerald-400/40 select-none">
      {/* Hidden standard audio element for audio files */}
      {!isTts && (
        <audio
          ref={audioRef}
          src={audio}
          muted={isMuted}
          onTimeUpdate={() => {
            if (audioRef.current) {
              setCurrentTime(audioRef.current.currentTime);
            }
          }}
          onLoadedMetadata={() => {
            if (audioRef.current) {
              setDuration(audioRef.current.duration || 0);
            }
          }}
          onEnded={() => {
            setIsPlaying(false);
            if (audioRef.current) {
              setCurrentTime(audioRef.current.duration || 0);
            }
          }}
        />
      )}

      {/* Header bar: Badge, Question Title, Play Count Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white text-base shadow-xs animate-pulse">
            <i className="fa-solid fa-headphones"></i>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-black tracking-wide uppercase">
                BÀI NGHE - LISTEN CAREFULLY
              </span>
              {isTts && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-950/40 text-[10px] font-bold text-emerald-200 border border-white/20">
                  Giọng đọc AI
                </span>
              )}
            </div>
            <p className="text-[11px] text-emerald-100 font-medium">
              Lắng nghe thật kỹ nội dung âm thanh để chọn hoặc điền đáp án bên dưới
            </p>
          </div>
        </div>

        {/* Play Count Badge */}
        <div className="flex items-center gap-1.5">
          {maxPlayCount > 0 ? (
            <span
              className={`px-3 py-1 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs border ${
                isLimitReached
                  ? 'bg-amber-500/90 text-white border-amber-300'
                  : 'bg-white/20 text-white border-white/30'
              }`}
            >
              <i className="fa-solid fa-rotate"></i>
              <span>
                Lượt nghe: {playCount} / {maxPlayCount}
              </span>
              {isLimitReached && <i className="fa-solid fa-lock text-[10px]"></i>}
            </span>
          ) : (
            <span className="px-3 py-1 rounded-xl bg-white/20 text-white text-xs font-black border border-white/30">
              <i className="fa-solid fa-infinity mr-1"></i>Nghe tự do
            </span>
          )}
        </div>
      </div>

      {/* Main Controls Row */}
      <div className="pt-3 flex flex-col sm:flex-row items-center gap-3">
        {/* Play / Pause / Replay Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isLimitReached}
            onClick={handlePlay}
            className={`px-5 py-2.5 rounded-xl font-black text-sm flex items-center gap-2.5 shadow-md transition-all cursor-pointer active:scale-95 ${
              isLimitReached
                ? 'bg-white/20 text-white/50 cursor-not-allowed border border-white/10'
                : isPlaying
                ? 'bg-amber-400 hover:bg-amber-300 text-slate-900 border border-amber-200'
                : 'bg-white hover:bg-emerald-50 text-emerald-900 border border-white/80 hover:shadow-lg'
            }`}
          >
            <i className={`fa-solid ${isPlaying ? 'fa-pause text-base' : 'fa-play text-base text-emerald-700'}`}></i>
            <span>{isPlaying ? 'Tạm dừng' : isLimitReached ? 'Đã hết lượt' : 'Phát âm thanh'}</span>
          </button>

          <button
            type="button"
            disabled={isLimitReached}
            onClick={handleReplay}
            title="Nghe lại từ đầu"
            className="w-10 h-10 rounded-xl bg-white/15 hover:bg-white/25 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition cursor-pointer"
          >
            <i className="fa-solid fa-rotate-left"></i>
          </button>

          {!isTts && (
            <button
              type="button"
              onClick={() => setIsMuted((m) => !m)}
              title={isMuted ? 'Bật âm' : 'Tắt âm'}
              className="w-10 h-10 rounded-xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition cursor-pointer"
            >
              <i className={`fa-solid ${isMuted ? 'fa-volume-xmark text-amber-300' : 'fa-volume-high'}`}></i>
            </button>
          )}
        </div>

        {/* Animated Sound Waveform Indicator */}
        <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-950/30 border border-white/15">
          {[4, 12, 8, 16, 10, 14, 6, 18, 9, 13, 5].map((h, i) => (
            <span
              key={i}
              className="w-1 rounded-full bg-emerald-200 transition-all duration-200"
              style={{
                height: isPlaying ? `${Math.max(4, (h * (i % 2 === 0 ? 1.4 : 0.7)))}px` : '4px',
                opacity: isPlaying ? 0.9 : 0.4
              }}
            ></span>
          ))}
        </div>

        {/* Progress Bar & Time */}
        <div className="flex-1 w-full flex items-center gap-2.5">
          <span className="text-[11px] font-mono text-emerald-100 font-bold min-w-10 text-right">
            {formatTime(currentTime)}
          </span>
          <div className="flex-1 relative h-3 bg-emerald-950/40 rounded-full overflow-hidden border border-white/20">
            <div
              className="h-full bg-gradient-to-r from-emerald-300 to-amber-300 rounded-full transition-all duration-300"
              style={{
                width: duration > 0 ? `${Math.min(100, (currentTime / duration) * 100)}%` : '0%'
              }}
            ></div>
          </div>
          <span className="text-[11px] font-mono text-emerald-200 font-bold min-w-10">
            {duration > 0 ? formatTime(duration) : '--:--'}
          </span>
        </div>
      </div>

      {/* Helpful notification if play limit is reached */}
      {isLimitReached && (
        <div className="mt-3 p-2.5 rounded-xl bg-amber-500/20 border border-amber-300/40 text-amber-100 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <i className="fa-solid fa-circle-info text-amber-300 text-sm"></i>
          <span>
            Em đã nghe đủ {maxPlayCount}/{maxPlayCount} lượt quy định cho câu này. Hãy chọn hoặc điền đáp án theo những gì em đã nghe nhé!
          </span>
        </div>
      )}
    </div>
  );
};
