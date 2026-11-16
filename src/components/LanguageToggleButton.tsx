import React from 'react';
import { Globe } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface LanguageToggleButtonProps {
  variant?: 'light' | 'dark';
  className?: string;
}

export const LanguageToggleButton: React.FC<LanguageToggleButtonProps> = ({
  variant = 'light',
  className = '',
}) => {
  const { lang, setLang } = useLanguage();

  const isDark = variant === 'dark';

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-xl p-1 border shadow-sm select-none shrink-0 ${
        isDark
          ? 'bg-slate-800/80 border-slate-700/80 text-slate-200 backdrop-blur-md'
          : 'bg-slate-100 border-slate-200 text-slate-700'
      } ${className}`}
      role="group"
      aria-label={lang === 'en' ? 'Language selector' : 'Chuyển đổi ngôn ngữ'}
      title={
        lang === 'en'
          ? 'Switch UI language (English / Vietnamese). Question & Part content stays intact.'
          : 'Chuyển đổi ngôn ngữ giao diện (Tiếng Anh / Tiếng Việt). Nội dung câu hỏi & Part giữ nguyên.'
      }
    >
      <span
        className={`pl-1.5 pr-0.5 flex items-center ${
          isDark ? 'text-blue-400' : 'text-blue-600'
        }`}
        aria-hidden="true"
      >
        <Globe className="w-3.5 h-3.5" />
      </span>

      <button
        type="button"
        onClick={() => setLang('en')}
        data-preserve-content="true"
        className={`px-2 py-1 rounded-lg text-[11px] font-black tracking-wide transition-all cursor-pointer ${
          lang === 'en'
            ? isDark
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-blue-700 shadow-sm border border-blue-200'
            : isDark
              ? 'text-slate-400 hover:text-white'
              : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        EN
      </button>

      <button
        type="button"
        onClick={() => setLang('vi')}
        data-preserve-content="true"
        className={`px-2 py-1 rounded-lg text-[11px] font-black tracking-wide transition-all cursor-pointer ${
          lang === 'vi'
            ? isDark
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-blue-700 shadow-sm border border-blue-200'
            : isDark
              ? 'text-slate-400 hover:text-white'
              : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        VI
      </button>
    </div>
  );
};
