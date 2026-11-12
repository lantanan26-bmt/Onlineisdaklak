import React, { useState, useRef, useEffect } from 'react';

interface QuestionAudioEditorProps {
  audio?: string;
  audioScript?: string;
  maxPlayCount?: number;
  autoPlayAudio?: boolean;
  audioSpeed?: number;
  audioVoice?: string;
  onChange: (patch: {
    audio?: string;
    audioScript?: string;
    maxPlayCount?: number;
    autoPlayAudio?: boolean;
    audioSpeed?: number;
    audioVoice?: string;
  }) => void;
  showToast: (msg: string, type?: 'success' | 'warn' | 'error' | 'info') => void;
}

type AudioMode = 'tts' | 'record' | 'upload' | 'url';

export const QuestionAudioEditor: React.FC<QuestionAudioEditorProps> = ({
  audio = '',
  audioScript = '',
  maxPlayCount = 2,
  autoPlayAudio = false,
  audioSpeed = 1.0,
  audioVoice = 'en-US',
  onChange,
  showToast
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(Boolean(audio));
  const [mode, setMode] = useState<AudioMode>(() => {
    if (audio.startsWith('tts:')) return 'tts';
    if (audio.startsWith('data:audio/')) return 'upload';
    if (audio.startsWith('http')) return 'url';
    return 'tts';
  });

  // TTS state
  const [ttsText, setTtsText] = useState<string>(() => {
    if (audio.startsWith('tts:')) return audio.replace(/^tts:/, '');
    return audioScript || '';
  });

  // URL state
  const [urlInput, setUrlInput] = useState<string>(() => {
    if (audio.startsWith('http')) return audio;
    return '';
  });

  // Microphone Recording state
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordSeconds, setRecordSeconds] = useState<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<any>(null);

  // Preview playing state
  const [isPreviewPlaying, setIsPreviewPlaying] = useState<boolean>(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Sync internal state if audio prop changes externally
  useEffect(() => {
    if (audio.startsWith('tts:')) {
      setTtsText(audio.replace(/^tts:/, ''));
      setMode('tts');
      setIsOpen(true);
    } else if (audio.startsWith('http')) {
      setUrlInput(audio);
      setMode('url');
      setIsOpen(true);
    } else if (audio.startsWith('data:audio/')) {
      setMode('upload');
      setIsOpen(true);
    }
  }, [audio]);

  // Clean up recording & audio on unmount
  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Handle TTS Change
  const handleTtsChange = (text: string) => {
    setTtsText(text);
    if (text.trim()) {
      onChange({
        audio: `tts:${text.trim()}`,
        audioScript: text.trim(),
        audioSpeed,
        audioVoice
      });
    } else {
      onChange({ audio: '', audioScript: '' });
    }
  };

  // Preview TTS speech
  const handlePreviewTts = () => {
    const text = ttsText.trim() || 'Listen carefully and answer the question.';
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      showToast('Trình duyệt không hỗ trợ Web Speech Synthesis!', 'warn');
      return;
    }

    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = audioVoice || 'en-US';
    utter.rate = audioSpeed || 1.0;

    utter.onstart = () => setIsPreviewPlaying(true);
    utter.onend = () => setIsPreviewPlaying(false);
    utter.onerror = () => setIsPreviewPlaying(false);

    window.speechSynthesis.speak(utter);
    showToast('Đang phát giọng đọc mẫu TTS...', 'info');
  };

  // Stop preview
  const handleStopPreview = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
    }
    setIsPreviewPlaying(false);
  };

  // Preview standard audio
  const handlePreviewAudio = (audioSrc: string) => {
    if (!audioSrc) return;
    if (isPreviewPlaying) {
      handleStopPreview();
      return;
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.src = audioSrc;
      previewAudioRef.current
        .play()
        .then(() => setIsPreviewPlaying(true))
        .catch(() => showToast('Không thể phát file âm thanh này!', 'warn'));
    }
  };

  // Handle Microphone Recording
  const handleStartRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast('Trình duyệt chưa hỗ trợ hoặc bị chặn quyền Microphone!', 'error');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          onChange({ audio: base64Audio });
          showToast('Đã lưu bản ghi âm vào câu hỏi!', 'success');
        };
        reader.readAsDataURL(audioBlob);

        // Stop all audio tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setIsRecording(true);
      setRecordSeconds(0);

      recordTimerRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);

      showToast('Đang ghi âm giọng đọc của bạn...', 'info');
    } catch (err: any) {
      console.error(err);
      showToast('Lỗi micro: ' + (err.message || 'Không thể truy cập microphone'), 'error');
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
    }
  };

  // Handle Audio File Upload (MP3, WAV, etc.)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      showToast('File âm thanh phải ≤ 15MB!', 'warn');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      onChange({ audio: dataUrl });
      showToast(`Đã tải lên tệp âm thanh "${file.name}"!`, 'success');
    };
    reader.readAsDataURL(file);
  };

  // Handle URL change
  const handleUrlSave = () => {
    const cleanUrl = urlInput.trim();
    if (cleanUrl) {
      onChange({ audio: cleanUrl });
      showToast('Đã lưu đường dẫn URL âm thanh!', 'success');
    } else {
      onChange({ audio: '' });
    }
  };

  // Remove audio completely
  const handleRemoveAudio = () => {
    handleStopPreview();
    onChange({
      audio: '',
      audioScript: '',
      autoPlayAudio: false
    });
    setTtsText('');
    setUrlInput('');
    setIsOpen(false);
    showToast('Đã xóa âm thanh bài nghe khỏi câu hỏi!', 'info');
  };

  const hasAudio = Boolean(audio && audio.trim());

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4 space-y-3 transition-all">
      {/* Hidden audio element for preview */}
      <audio
        ref={previewAudioRef}
        onEnded={() => setIsPreviewPlaying(false)}
        onError={() => setIsPreviewPlaying(false)}
      />

      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs shadow-xs ${
              hasAudio ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
            }`}
          >
            <i className="fa-solid fa-headphones"></i>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-slate-800">
                Khung Âm Thanh Bài Nghe (Audio & Listening)
              </span>
              {hasAudio ? (
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-black">
                  Đã có bài nghe ({maxPlayCount > 0 ? `${maxPlayCount} lượt` : 'Tự do'})
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold">
                  Tùy chọn
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Thêm bài nghe bằng giọng đọc AI tự động (TTS), file MP3 tải lên hoặc ghi âm trực tiếp
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isOpen && !hasAudio && (
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <i className="fa-solid fa-plus"></i> Thêm Bài Nghe
            </button>
          )}

          {isOpen && (
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
            >
              <i className={`fa-solid ${isOpen ? 'fa-chevron-up' : 'fa-chevron-down'} mr-1`}></i>
              {isOpen ? 'Thu gọn' : 'Mở rộng'}
            </button>
          )}

          {hasAudio && (
            <button
              type="button"
              onClick={handleRemoveAudio}
              className="px-2.5 py-1 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50 border border-red-200 transition cursor-pointer flex items-center gap-1"
              title="Xóa âm thanh"
            >
              <i className="fa-solid fa-trash-can"></i> Xóa audio
            </button>
          )}
        </div>
      </div>

      {/* Expanded Editor Body */}
      {isOpen && (
        <div className="pt-2 border-t border-slate-200 space-y-3">
          {/* Mode Switcher Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-200/80 rounded-xl">
            <button
              type="button"
              onClick={() => setMode('tts')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer ${
                mode === 'tts'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <i className="fa-solid fa-wand-magic-sparkles text-emerald-600"></i>
              <span>Giọng đọc AI (TTS)</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('upload')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer ${
                mode === 'upload'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <i className="fa-solid fa-upload text-blue-600"></i>
              <span>Tải file MP3/WAV</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('record')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer ${
                mode === 'record'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <i className="fa-solid fa-microphone text-rose-600"></i>
              <span>Ghi âm Micro</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('url')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer ${
                mode === 'url'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <i className="fa-solid fa-link text-indigo-600"></i>
              <span>Link URL Audio</span>
            </button>
          </div>

          {/* Mode 1: TTS (Text-to-Speech) */}
          {mode === 'tts' && (
            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                  <span>Nội dung lời thoại bài nghe (Tiếng Anh):</span>
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={audioVoice}
                    onChange={(e) => {
                      const v = e.target.value;
                      onChange({ audioVoice: v });
                    }}
                    className="px-2 py-0.5 text-[11px] font-bold bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    <option value="en-US">Giọng Mỹ (en-US)</option>
                    <option value="en-GB">Giọng Anh (en-GB)</option>
                  </select>

                  <select
                    value={audioSpeed}
                    onChange={(e) => {
                      const sp = parseFloat(e.target.value);
                      onChange({ audioSpeed: sp });
                    }}
                    className="px-2 py-0.5 text-[11px] font-bold bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    <option value="0.8">Tốc độ: 0.8x (Chậm)</option>
                    <option value="0.95">Tốc độ: 0.95x (Vừa phải)</option>
                    <option value="1.0">Tốc độ: 1.0x (Chuẩn)</option>
                  </select>
                </div>
              </div>

              <textarea
                rows={3}
                value={ttsText}
                onChange={(e) => handleTtsChange(e.target.value)}
                placeholder="Nhập kịch bản bài nghe, ví dụ: Look at picture 1. Listen: The girl is playing guitar in the garden..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-sans leading-relaxed"
              />

              <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                <p className="text-[11px] text-slate-500">
                  💡 Hệ thống sẽ tự động chuyển văn bản trên thành giọng đọc tự nhiên cho học sinh nghe.
                </p>

                <div className="flex items-center gap-2">
                  {isPreviewPlaying ? (
                    <button
                      type="button"
                      onClick={handleStopPreview}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <i className="fa-solid fa-stop"></i> Dừng nghe thử
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePreviewTts}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <i className="fa-solid fa-play"></i> Nghe thử giọng đọc TTS
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Mode 2: Upload File */}
          {mode === 'upload' && (
            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2.5">
              <label className="block text-xs font-extrabold text-slate-700">
                Tải lên tệp âm thanh (MP3, WAV, M4A, OGG):
              </label>

              <div className="flex flex-wrap items-center gap-3">
                <label className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-2 cursor-pointer active:scale-95">
                  <i className="fa-solid fa-file-audio"></i>
                  <span>Chọn file âm thanh từ máy tính</span>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                {audio && !audio.startsWith('tts:') && (
                  <button
                    type="button"
                    onClick={() => handlePreviewAudio(audio)}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer border border-slate-300"
                  >
                    <i className={`fa-solid ${isPreviewPlaying ? 'fa-pause text-amber-600' : 'fa-play text-emerald-600'}`}></i>
                    <span>{isPreviewPlaying ? 'Tạm dừng nghe thử' : 'Nghe thử file'}</span>
                  </button>
                )}
              </div>

              {audio && audio.startsWith('data:audio/') && (
                <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-bold flex items-center justify-between">
                  <span>✅ Đã nhúng tệp âm thanh vào bài thi thành công.</span>
                  <span className="text-[10px] font-mono opacity-70">
                    {(audio.length / 1024).toFixed(1)} KB
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Mode 3: Record Microphone */}
          {mode === 'record' && (
            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-slate-700">
                  Ghi âm giọng đọc trực tiếp bằng Micro của giáo viên:
                </label>
                {isRecording && (
                  <span className="flex items-center gap-1.5 text-xs font-mono font-bold text-red-600 animate-pulse">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>
                    Đang ghi âm: {recordSeconds}s
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {!isRecording ? (
                  <button
                    type="button"
                    onClick={handleStartRecording}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-xs transition flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    <i className="fa-solid fa-microphone"></i> Bắt đầu ghi âm
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStopRecording}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-xs transition flex items-center gap-2 cursor-pointer active:scale-95 animate-bounce"
                  >
                    <i className="fa-solid fa-stop text-red-400"></i> Dừng & Lưu bản ghi
                  </button>
                )}

                {audio && !isRecording && (
                  <button
                    type="button"
                    onClick={() => handlePreviewAudio(audio)}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer border border-slate-300"
                  >
                    <i className={`fa-solid ${isPreviewPlaying ? 'fa-pause' : 'fa-play text-emerald-600'}`}></i>
                    <span>{isPreviewPlaying ? 'Dừng phát' : 'Nghe lại bản ghi'}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Mode 4: Online URL */}
          {mode === 'url' && (
            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2.5">
              <label className="block text-xs font-extrabold text-slate-700">
                Nhập đường dẫn URL âm thanh trực tuyến (MP3 / WAV):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/audio/unit1-listening.mp3"
                  className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
                <button
                  type="button"
                  onClick={handleUrlSave}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                >
                  Lưu link
                </button>
                {urlInput && (
                  <button
                    type="button"
                    onClick={() => handlePreviewAudio(urlInput)}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-200 transition cursor-pointer"
                  >
                    <i className="fa-solid fa-play text-emerald-600"></i>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Audio Playback Rules for Students */}
          <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-emerald-950">
                <i className="fa-solid fa-sliders mr-1 text-emerald-700"></i>Quy chế bài nghe cho học sinh:
              </span>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              {/* Max Play Count Setting */}
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-700">Số lượt nghe tối đa:</span>
                <select
                  value={maxPlayCount ?? 2}
                  onChange={(e) => onChange({ maxPlayCount: parseInt(e.target.value, 10) })}
                  className="px-2 py-1 font-bold bg-white border border-emerald-300 rounded-lg text-emerald-950 text-xs shadow-2xs"
                >
                  <option value={1}>1 lượt</option>
                  <option value={2}>2 lượt (Chuẩn khảo thí Cambridge/iSMART)</option>
                  <option value={3}>3 lượt</option>
                  <option value={0}>Không giới hạn (Tự do)</option>
                </select>
              </div>

              {/* Auto-Play Toggle */}
              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={Boolean(autoPlayAudio)}
                  onChange={(e) => onChange({ autoPlayAudio: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <span>Tự động phát khi học sinh mở câu này</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
