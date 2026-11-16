import React, { useEffect, useRef, useState } from 'react';
import { AppBranding } from '../types';

interface AdminBrandingModalProps {
  isOpen: boolean;
  branding: AppBranding;
  defaultBranding: AppBranding;
  onSave: (next: AppBranding) => void;
  onClose: () => void;
  showToast: (msg: string, type?: 'success' | 'warn' | 'error' | 'info') => void;
}

const MAX_LOGO_DATA_URL_LENGTH = 180000;
const MIN_LOGO_W = 24;
const MAX_LOGO_W = 260;
const MIN_LOGO_H = 24;
const MAX_LOGO_H = 104;

function clampW(w: number) {
  return Math.min(MAX_LOGO_W, Math.max(MIN_LOGO_W, Math.round(w)));
}

function clampH(h: number) {
  return Math.min(MAX_LOGO_H, Math.max(MIN_LOGO_H, Math.round(h)));
}

async function compressLogoImageFile(file: File): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không đọc được file ảnh.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('File ảnh không hợp lệ.'));
      img.onload = () => {
        const naturalW = img.width || 160;
        const naturalH = img.height || 160;
        const trySizes = [480, 320, 220, 140];
        const qualities = [0.9, 0.84, 0.76, 0.68];

        for (let i = 0; i < trySizes.length; i++) {
          const maxDim = trySizes[i];
          const scale = Math.min(1, maxDim / Math.max(naturalW, naturalH));
          const w = Math.max(1, Math.round(naturalW * scale));
          const h = Math.max(1, Math.round(naturalH * scale));

          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Trình duyệt không hỗ trợ xử lý ảnh Canvas.'));
            return;
          }
          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);

          // Try PNG first on initial pass to preserve transparent logos cleanly
          if (i <= 1) {
            const pngUrl = canvas.toDataURL('image/png');
            if (pngUrl.length <= MAX_LOGO_DATA_URL_LENGTH) {
              resolve({ dataUrl: pngUrl, width: naturalW, height: naturalH });
              return;
            }
          }

          const webpUrl = canvas.toDataURL('image/webp', qualities[i]);
          if (webpUrl.startsWith('data:image/webp') && webpUrl.length <= MAX_LOGO_DATA_URL_LENGTH) {
            resolve({ dataUrl: webpUrl, width: naturalW, height: naturalH });
            return;
          }

          const jpegUrl = canvas.toDataURL('image/jpeg', qualities[i]);
          if (jpegUrl.length <= MAX_LOGO_DATA_URL_LENGTH) {
            resolve({ dataUrl: jpegUrl, width: naturalW, height: naturalH });
            return;
          }
        }

        reject(new Error('Ảnh logo quá nặng, vui lòng chọn ảnh nhẹ hơn (khuyên dùng ảnh <= 1MB).'));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

type DragHandleMode = 'right' | 'bottom' | 'corner';

export const AdminBrandingModal: React.FC<AdminBrandingModalProps> = ({
  isOpen,
  branding,
  defaultBranding,
  onSave,
  onClose,
  showToast,
}) => {
  const [appName, setAppName] = useState(branding.appName || defaultBranding.appName);
  const [appSubtitle, setAppSubtitle] = useState(branding.appSubtitle ?? defaultBranding.appSubtitle ?? '');
  const [logoText, setLogoText] = useState(branding.logoText || defaultBranding.logoText || 'iS');
  const [logoUrl, setLogoUrl] = useState<string | null>(branding.logoUrl ?? null);
  const [logoWidth, setLogoWidth] = useState<number>(clampW(branding.logoWidth ?? defaultBranding.logoWidth ?? 40));
  const [logoHeight, setLogoHeight] = useState<number>(clampH(branding.logoHeight ?? defaultBranding.logoHeight ?? 40));
  const [logoFit, setLogoFit] = useState<'contain' | 'cover' | 'fill'>(branding.logoFit || defaultBranding.logoFit || 'contain');
  const [lockRatio, setLockRatio] = useState<boolean>(false);
  const [lockedAspect, setLockedAspect] = useState<number>(1);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [activeDragMode, setActiveDragMode] = useState<DragHandleMode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const nextW = clampW(branding.logoWidth ?? defaultBranding.logoWidth ?? 40);
      const nextH = clampH(branding.logoHeight ?? defaultBranding.logoHeight ?? 40);
      setAppName(branding.appName || defaultBranding.appName);
      setAppSubtitle(branding.appSubtitle ?? defaultBranding.appSubtitle ?? '');
      setLogoText(branding.logoText || defaultBranding.logoText || 'iS');
      setLogoUrl(branding.logoUrl ?? null);
      setLogoWidth(nextW);
      setLogoHeight(nextH);
      setLogoFit(branding.logoFit || defaultBranding.logoFit || 'contain');
      setLockedAspect(nextW / Math.max(1, nextH));
    }
  }, [isOpen, branding, defaultBranding]);

  if (!isOpen) return null;

  const handleToggleLockRatio = (checked: boolean) => {
    setLockRatio(checked);
    if (checked) {
      setLockedAspect(logoWidth / Math.max(1, logoHeight));
    }
  };

  const handleChangeWidth = (nextRaw: number) => {
    const w = clampW(nextRaw);
    setLogoWidth(w);
    if (lockRatio && lockedAspect > 0) {
      setLogoHeight(clampH(w / lockedAspect));
    }
  };

  const handleChangeHeight = (nextRaw: number) => {
    const h = clampH(nextRaw);
    setLogoHeight(h);
    if (lockRatio && lockedAspect > 0) {
      setLogoWidth(clampW(h * lockedAspect));
    }
  };

  const handleStartDragResize = (mode: DragHandleMode, e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = logoWidth;
    const startH = logoHeight;
    const ratio = lockedAspect > 0 ? lockedAspect : startW / Math.max(1, startH);

    setActiveDragMode(mode);

    const handleMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      if (mode === 'right') {
        const w = clampW(startW + dx);
        setLogoWidth(w);
        if (lockRatio) setLogoHeight(clampH(w / ratio));
      } else if (mode === 'bottom') {
        const h = clampH(startH + dy);
        setLogoHeight(h);
        if (lockRatio) setLogoWidth(clampW(h * ratio));
      } else {
        const w = clampW(startW + dx);
        if (lockRatio) {
          setLogoWidth(w);
          setLogoHeight(clampH(w / ratio));
        } else {
          setLogoWidth(w);
          setLogoHeight(clampH(startH + dy));
        }
      }
    };

    const handleUp = () => {
      setActiveDragMode(null);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Vui lòng chọn đúng định dạng file ảnh (PNG, JPG, WEBP, SVG)!', 'warn');
      return;
    }

    setIsProcessingImage(true);
    try {
      const { dataUrl, width, height } = await compressLogoImageFile(file);
      setLogoUrl(dataUrl);
      const naturalAspect = width / Math.max(1, height);
      // Automatically fit wide banner logos nicely while letting Admin resize freely afterwards
      if (naturalAspect > 1.35) {
        const suggestedH = Math.max(40, logoHeight);
        const suggestedW = clampW(suggestedH * naturalAspect);
        setLogoHeight(clampH(suggestedH));
        setLogoWidth(suggestedW);
        setLockedAspect(naturalAspect);
      } else {
        setLockedAspect(naturalAspect);
      }
      showToast('Đã tải ảnh Logo! Bạn có thể kéo trực tiếp cạnh/góc logo hoặc chỉnh thanh trượt kích thước.', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể xử lý file ảnh Logo.', 'error');
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = appName.trim();
    if (!trimmedName) {
      showToast('Tên hệ thống không được để trống!', 'warn');
      return;
    }
    const trimmedLogoText = (logoText.trim() || defaultBranding.logoText || 'iS').slice(0, 8);
    onSave({
      appName: trimmedName.slice(0, 80),
      appSubtitle: appSubtitle.trim().slice(0, 200),
      logoText: trimmedLogoText,
      logoUrl: logoUrl || null,
      logoWidth: clampW(logoWidth),
      logoHeight: clampH(logoHeight),
      logoFit,
    });
    onClose();
  };

  const handleResetDefault = () => {
    setAppName(defaultBranding.appName);
    setAppSubtitle(defaultBranding.appSubtitle ?? '');
    setLogoText(defaultBranding.logoText || 'iS');
    setLogoUrl(null);
    setLogoWidth(40);
    setLogoHeight(40);
    setLogoFit('contain');
    setLockedAspect(1);
    showToast('Đã điền lại kích thước & thông tin mặc định. Nhấn "Lưu & Đồng bộ Cloud" để xác nhận.', 'info');
  };

  const applyPreset = (w: number, h: number) => {
    const cw = clampW(w);
    const ch = clampH(h);
    setLogoWidth(cw);
    setLogoHeight(ch);
    setLockedAspect(cw / Math.max(1, ch));
  };

  const previewName = appName.trim() || defaultBranding.appName;
  const previewSubtitle = appSubtitle.trim();
  const previewLogoText = (logoText.trim() || defaultBranding.logoText || 'iS').slice(0, 8);
  const fitClass = logoFit === 'fill' ? 'object-fill' : logoFit === 'cover' ? 'object-cover' : 'object-contain';
  const badgeFontSize = Math.max(13, Math.min(34, Math.round(Math.min(logoHeight * 0.48, logoWidth * 0.44))));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden my-auto">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-amber-50 via-white to-blue-50 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 border border-amber-300 flex items-center justify-center text-base shrink-0">
              <i className="fa-solid fa-crown"></i>
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                Tùy chỉnh Logo, Kích thước & Tên Hệ Thống
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Chỉ Admin có quyền thay đổi • Kéo trực tiếp viền logo hoặc chỉnh thanh trượt bên dưới
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer"
            title="Đóng"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* Interactive Live Preview with Drag Handles */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Xem trước & Kéo trực tiếp kích thước Logo:
              </span>
              <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                {logoWidth} × {logoHeight} px
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3.5 overflow-x-auto select-none">
              {/* Resizable Logo Box */}
              <div
                className={`relative shrink-0 rounded-xl transition-shadow ${
                  activeDragMode ? 'ring-2 ring-blue-500 shadow-lg' : 'ring-1 ring-blue-300/70 hover:ring-2 hover:ring-blue-500'
                }`}
                style={{ width: `${logoWidth}px`, height: `${logoHeight}px` }}
              >
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={previewName}
                    draggable={false}
                    className={`w-full h-full rounded-xl ${fitClass} bg-white border border-slate-200 p-0.5 shadow-sm`}
                  />
                ) : (
                  <div
                    className="w-full h-full rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-black shadow-md shadow-blue-500/20 px-1.5 text-center leading-none overflow-hidden"
                    style={{ fontSize: `${badgeFontSize}px` }}
                  >
                    {previewLogoText}
                  </div>
                )}

                {/* Right Edge Handle: Stretch horizontally */}
                <div
                  onPointerDown={(e) => handleStartDragResize('right', e)}
                  title="Kéo sang phải/trái để kéo dài hoặc thu gọn chiều ngang Logo"
                  className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-6 rounded-full bg-blue-600 hover:bg-blue-700 border-2 border-white shadow cursor-ew-resize flex items-center justify-center z-10"
                >
                  <span className="w-0.5 h-3 bg-white/90 rounded-full"></span>
                </div>

                {/* Bottom Edge Handle: Stretch vertically */}
                <div
                  onPointerDown={(e) => handleStartDragResize('bottom', e)}
                  title="Kéo xuống/lên để tăng hoặc giảm chiều cao Logo"
                  className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-6 h-3 rounded-full bg-blue-600 hover:bg-blue-700 border-2 border-white shadow cursor-ns-resize flex items-center justify-center z-10"
                >
                  <span className="h-0.5 w-3 bg-white/90 rounded-full"></span>
                </div>

                {/* Bottom-Right Corner Handle: Scale */}
                <div
                  onPointerDown={(e) => handleStartDragResize('corner', e)}
                  title="Kéo góc để phóng to hoặc thu nhỏ Logo"
                  className="absolute -bottom-2 -right-2 w-4 h-4 rounded-full bg-amber-500 hover:bg-amber-600 border-2 border-white shadow cursor-nwse-resize z-20"
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-extrabold text-slate-900 tracking-tight truncate">
                    {previewName}
                  </span>
                  <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                    ADMIN
                  </span>
                </div>
                {previewSubtitle && (
                  <p className="text-xs text-slate-500 truncate mt-0.5">{previewSubtitle}</p>
                )}
              </div>
            </div>
          </div>

          {/* Size & Stretch Controls */}
          <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200/80 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                <i className="fa-solid fa-up-right-and-down-left-from-center text-blue-600"></i>
                <span>Chỉnh kích thước & kéo dài Logo</span>
              </span>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={lockRatio}
                  onChange={(e) => handleToggleLockRatio(e.target.checked)}
                  className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                />
                <span>Khóa tỉ lệ khi chỉnh</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Width slider */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">Chiều ngang (Kéo dài):</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={MIN_LOGO_W}
                      max={MAX_LOGO_W}
                      value={logoWidth}
                      onChange={(e) => handleChangeWidth(Number(e.target.value) || MIN_LOGO_W)}
                      className="w-16 px-1.5 py-0.5 text-center rounded-lg border border-slate-300 bg-white text-xs font-black text-slate-900"
                    />
                    <span className="text-[11px] text-slate-500 font-semibold">px</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={MIN_LOGO_W}
                  max={MAX_LOGO_W}
                  value={logoWidth}
                  onChange={(e) => handleChangeWidth(Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>

              {/* Height slider */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">Chiều cao (To / Nhỏ):</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={MIN_LOGO_H}
                      max={MAX_LOGO_H}
                      value={logoHeight}
                      onChange={(e) => handleChangeHeight(Number(e.target.value) || MIN_LOGO_H)}
                      className="w-16 px-1.5 py-0.5 text-center rounded-lg border border-slate-300 bg-white text-xs font-black text-slate-900"
                    />
                    <span className="text-[11px] text-slate-500 font-semibold">px</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={MIN_LOGO_H}
                  max={MAX_LOGO_H}
                  value={logoHeight}
                  onChange={(e) => handleChangeHeight(Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              <span className="text-[11px] font-bold text-slate-500 mr-1">Cỡ nhanh:</span>
              {[
                { label: 'Nhỏ (36×36)', w: 36, h: 36 },
                { label: 'Chuẩn (40×40)', w: 40, h: 40 },
                { label: 'Vuông lớn (56×56)', w: 56, h: 56 },
                { label: 'Ngang vừa (110×44)', w: 110, h: 44 },
                { label: 'Banner dài (170×48)', w: 170, h: 48 },
              ].map((preset) => {
                const isActive = logoWidth === preset.w && logoHeight === preset.h;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyPreset(preset.w, preset.h)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                      isActive
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white hover:bg-blue-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* Image fit options when custom image is loaded */}
            {logoUrl && (
              <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-blue-200/70">
                <span className="text-[11px] font-bold text-slate-600">Kiểu hiển thị ảnh:</span>
                {[
                  { id: 'contain' as const, label: 'Vừa khung (Không méo)' },
                  { id: 'fill' as const, label: 'Kéo giãn khít khung' },
                  { id: 'cover' as const, label: 'Phủ đầy khung' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setLogoFit(opt.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                      logoFit === opt.id
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Logo Upload + Monogram */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                Ảnh Logo (Tùy chọn):
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={isProcessingImage}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-60"
                >
                  <i className={`fa-solid ${isProcessingImage ? 'fa-circle-notch fa-spin' : 'fa-image'}`}></i>
                  <span>{logoUrl ? 'Đổi ảnh Logo' : 'Tải ảnh Logo'}</span>
                </button>
                {logoUrl && (
                  <button
                    type="button"
                    onClick={() => setLogoUrl(null)}
                    className="px-2.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center gap-1 transition cursor-pointer"
                  >
                    <i className="fa-solid fa-trash-can"></i>
                    <span>Xóa ảnh</span>
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Hỗ trợ PNG, JPG, WEBP, SVG. Tự tối ưu để đồng bộ Cloud nhanh.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Chữ viết tắt trên Logo (khi chưa tải ảnh):
              </label>
              <input
                type="text"
                maxLength={8}
                value={logoText}
                onChange={(e) => setLogoText(e.target.value)}
                placeholder="Ví dụ: iS"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-slate-400">Tối đa 8 ký tự (mặc định: iS).</p>
            </div>
          </div>

          {/* App Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              Tên Hệ Thống / Trung Tâm / Trường (*):
            </label>
            <input
              type="text"
              required
              maxLength={80}
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              placeholder="Ví dụ: iSMART LMS"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Subtitle */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-700 block">
                Dòng mô tả phụ (hiển thị dưới tên trên trang Admin):
              </label>
              {appSubtitle.trim() && (
                <button
                  type="button"
                  onClick={() => setAppSubtitle('')}
                  className="px-2 py-0.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <i className="fa-solid fa-trash-can text-[10px]"></i>
                  <span>Xóa dòng này</span>
                </button>
              )}
            </div>
            <input
              type="text"
              maxLength={200}
              value={appSubtitle}
              onChange={(e) => setAppSubtitle(e.target.value)}
              placeholder="Ví dụ: Quản trị toàn diện: Ngân hàng đề... (hoặc để trống để ẩn/xóa)"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleResetDefault}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <i className="fa-solid fa-rotate-left"></i>
              <span>Khôi phục mặc định</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isProcessingImage}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs sm:text-sm shadow-md shadow-blue-600/20 flex items-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-60"
              >
                <i className="fa-solid fa-floppy-disk"></i>
                <span>Lưu & Đồng bộ Cloud</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
