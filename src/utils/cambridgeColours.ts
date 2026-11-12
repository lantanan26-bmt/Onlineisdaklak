export interface CambridgeCrayon {
  id: string; // 'yellow' | 'red' | 'blue' | 'green' | 'pink' | 'purple' | 'orange' | 'brown' | 'black' | 'eraser'
  name: string; // Tên hiển thị
  enName: string;
  hex: string;
  borderHex: string;
  textColor: string;
}

export const CAMBRIDGE_CRAYONS: CambridgeCrayon[] = [
  { id: 'yellow', name: 'Vàng', enName: 'Yellow', hex: '#facc15', borderHex: '#ca8a04', textColor: '#854d0e' },
  { id: 'red', name: 'Đỏ', enName: 'Red', hex: '#ef4444', borderHex: '#b91c1c', textColor: '#ffffff' },
  { id: 'blue', name: 'Xanh dương', enName: 'Blue', hex: '#3b82f6', borderHex: '#1d4ed8', textColor: '#ffffff' },
  { id: 'green', name: 'Xanh lá', enName: 'Green', hex: '#22c55e', borderHex: '#15803d', textColor: '#ffffff' },
  { id: 'pink', name: 'Hồng', enName: 'Pink', hex: '#ec4899', borderHex: '#be185d', textColor: '#ffffff' },
  { id: 'purple', name: 'Tím', enName: 'Purple', hex: '#a855f7', borderHex: '#7e22ce', textColor: '#ffffff' },
  { id: 'orange', name: 'Cam', enName: 'Orange', hex: '#f97316', borderHex: '#c2410c', textColor: '#ffffff' },
  { id: 'brown', name: 'Nâu', enName: 'Brown', hex: '#854d0e', borderHex: '#543007', textColor: '#ffffff' },
  { id: 'black', name: 'Đen', enName: 'Black', hex: '#1e293b', borderHex: '#0f172a', textColor: '#ffffff' },
  { id: 'eraser', name: 'Tẩy màu', enName: 'Eraser', hex: '#f8fafc', borderHex: '#94a3b8', textColor: '#475569' }
];

// Normalize color names/hex codes to a canonical color ID
export const normalizeColour = (input?: string | null): string => {
  if (!input) return '';
  const s = input.trim().toLowerCase();

  if (s.includes('yellow') || s.includes('vàng') || s === '#facc15' || s === '#eab308' || s === '#fbbf24') return 'yellow';
  if (s.includes('red') || s.includes('đỏ') || s === '#ef4444' || s === '#dc2626' || s === '#f87171') return 'red';
  if (s.includes('blue') || s.includes('xanh dương') || s === '#3b82f6' || s === '#2563eb' || s === '#60a5fa') return 'blue';
  if (s.includes('green') || s.includes('xanh lá') || s === '#22c55e' || s === '#16a34a' || s === '#4ade80') return 'green';
  if (s.includes('pink') || s.includes('hồng') || s === '#ec4899' || s === '#db2777' || s === '#f472b6') return 'pink';
  if (s.includes('purple') || s.includes('tím') || s === '#a855f7' || s === '#9333ea' || s === '#c084fc') return 'purple';
  if (s.includes('orange') || s.includes('cam') || s === '#f97316' || s === '#ea580c' || s === '#fb923c') return 'orange';
  if (s.includes('brown') || s.includes('nâu') || s === '#854d0e' || s === '#713f12' || s === '#a16207') return 'brown';
  if (s.includes('black') || s.includes('đen') || s === '#1e293b' || s === '#0f172a' || s === '#000000') return 'black';
  if (s.includes('eraser') || s.includes('tẩy') || s.includes('white') || s.includes('trắng') || s === '#ffffff') return 'eraser';

  return s;
};

// Check if user colored answer matches target
export const isColorMatch = (userColor?: string | null, targetColor?: string | null): boolean => {
  if (!userColor || !targetColor) return false;
  const u = normalizeColour(userColor);
  const t = normalizeColour(targetColor);
  if (u === 'eraser' || !u) return false;
  return u === t;
};

export const getCrayonInfo = (colorIdOrHex?: string | null): CambridgeCrayon => {
  const norm = normalizeColour(colorIdOrHex);
  const found = CAMBRIDGE_CRAYONS.find((c) => c.id === norm);
  if (found) return found;

  return {
    id: colorIdOrHex || 'custom',
    name: colorIdOrHex || 'Tùy chỉnh',
    enName: colorIdOrHex || 'Custom',
    hex: colorIdOrHex || '#64748b',
    borderHex: '#475569',
    textColor: '#ffffff'
  };
};

// Default high-quality Cambridge Park/Beach Line-art SVG for coloring tests
export const DEFAULT_CAMBRIDGE_COLORING_SCENE = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520" width="800" height="520">
    <rect width="800" height="520" fill="#ffffff" stroke="#94a3b8" stroke-width="2"/>
    <!-- Sky & Hills -->
    <path d="M 0 320 Q 200 280 400 310 T 800 290 L 800 520 L 0 520 Z" fill="#fafafa" stroke="#334155" stroke-width="3"/>
    <path d="M 0 370 Q 300 340 550 380 T 800 360 L 800 520 L 0 520 Z" fill="#f8fafc" stroke="#334155" stroke-width="3"/>
    
    <!-- Water / Pond -->
    <path d="M 450 420 C 500 390, 700 390, 760 440 C 790 470, 720 510, 600 510 C 480 510, 420 450, 450 420 Z" fill="#ffffff" stroke="#334155" stroke-width="3.5" stroke-dasharray="6,3"/>
    <text x="610" y="460" font-family="sans-serif" font-size="12" font-weight="bold" fill="#64748b" text-anchor="middle">~ Pond / Water ~</text>

    <!-- Tree -->
    <path d="M 110 390 L 110 240 L 150 240 L 150 390 Z" fill="#ffffff" stroke="#334155" stroke-width="3.5"/>
    <!-- Tree Foliage -->
    <circle cx="130" cy="180" r="70" fill="#ffffff" stroke="#334155" stroke-width="3.5"/>
    <circle cx="85" cy="195" r="50" fill="#ffffff" stroke="#334155" stroke-width="3.5"/>
    <circle cx="175" cy="195" r="50" fill="#ffffff" stroke="#334155" stroke-width="3.5"/>
    <circle cx="130" cy="130" r="45" fill="#ffffff" stroke="#334155" stroke-width="3.5"/>

    <!-- Sun in sky -->
    <circle cx="700" cy="90" r="40" fill="#ffffff" stroke="#334155" stroke-width="3.5"/>
    <!-- Sun rays -->
    <line x1="700" y1="35" x2="700" y2="15" stroke="#334155" stroke-width="3.5" stroke-linecap="round"/>
    <line x1="700" y1="145" x2="700" y2="165" stroke="#334155" stroke-width="3.5" stroke-linecap="round"/>
    <line x1="645" y1="90" x2="625" y2="90" stroke="#334155" stroke-width="3.5" stroke-linecap="round"/>
    <line x1="755" y1="90" x2="775" y2="90" stroke="#334155" stroke-width="3.5" stroke-linecap="round"/>

    <!-- Park Bench -->
    <path d="M 270 360 L 370 360 L 370 375 L 270 375 Z" fill="#ffffff" stroke="#334155" stroke-width="3"/>
    <line x1="280" y1="375" x2="280" y2="410" stroke="#334155" stroke-width="4"/>
    <line x1="360" y1="375" x2="360" y2="410" stroke="#334155" stroke-width="4"/>
    <line x1="270" y1="340" x2="370" y2="340" stroke="#334155" stroke-width="3"/>
    <line x1="280" y1="340" x2="280" y2="360" stroke="#334155" stroke-width="3"/>
    <line x1="360" y1="340" x2="360" y2="360" stroke="#334155" stroke-width="3"/>

    <!-- Clouds -->
    <path d="M 280 100 Q 300 80 330 90 Q 360 70 390 90 Q 420 80 430 105 Q 440 130 410 130 L 290 130 Q 270 120 280 100 Z" fill="#ffffff" stroke="#334155" stroke-width="3"/>
  </svg>`
)}`;
