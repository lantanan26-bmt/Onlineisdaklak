import { Question, ExamPart } from './types';
import { svgToDataUrl } from './demoData';
import { DEFAULT_CAMBRIDGE_COLORING_SCENE } from './utils/cambridgeColours';

// High-fidelity SVG graphics matching the Grade 2 Advanced English Exam
export const GRADE2_MEDIA = {
  // Page 1: Backyard Party Scene
  partyBackyard: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520" width="800" height="520">
      <defs>
        <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#bae6fd"/>
          <stop offset="100%" stop-color="#e0f2fe"/>
        </linearGradient>
        <linearGradient id="grassGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#86efac"/>
          <stop offset="100%" stop-color="#4ade80"/>
        </linearGradient>
      </defs>
      <!-- Background Sky -->
      <rect width="800" height="300" fill="url(#skyGrad)"/>
      <!-- Sun -->
      <circle cx="710" cy="70" r="32" fill="#facc15" stroke="#f59e0b" stroke-width="4"/>
      <!-- Soft Clouds -->
      <path d="M600 90 Q620 70 650 75 Q680 70 700 95 Q700 115 670 120 L610 120 Z" fill="#ffffff" opacity="0.85"/>
      <path d="M410 70 Q430 50 460 55 Q490 50 510 75 Q510 95 480 100 L420 100 Z" fill="#ffffff" opacity="0.85"/>
      <!-- Green Hills & Tree on Left -->
      <circle cx="100" cy="220" r="140" fill="#22c55e" opacity="0.4"/>
      <circle cx="160" cy="180" r="110" fill="#16a34a" opacity="0.5"/>
      <!-- Garden Fence -->
      <g stroke="#cbd5e1" stroke-width="6" fill="#f8fafc">
        <rect x="20" y="190" width="16" height="80" rx="3"/>
        <rect x="50" y="190" width="16" height="80" rx="3"/>
        <rect x="80" y="190" width="16" height="80" rx="3"/>
        <rect x="110" y="190" width="16" height="80" rx="3"/>
        <rect x="250" y="190" width="16" height="80" rx="3"/>
        <rect x="280" y="190" width="16" height="80" rx="3"/>
        <rect x="310" y="190" width="16" height="80" rx="3"/>
        <rect x="340" y="190" width="16" height="80" rx="3"/>
        <rect x="370" y="190" width="16" height="80" rx="3"/>
        <rect x="400" y="190" width="16" height="80" rx="3"/>
        <rect x="430" y="190" width="16" height="80" rx="3"/>
        <rect x="460" y="190" width="16" height="80" rx="3"/>
        <rect x="490" y="190" width="16" height="80" rx="3"/>
        <rect x="520" y="190" width="16" height="80" rx="3"/>
      </g>
      <!-- House wall on right -->
      <rect x="680" y="140" width="120" height="200" fill="#fde68a" stroke="#d97706" stroke-width="3"/>
      <!-- Lawn -->
      <rect y="240" width="800" height="280" fill="url(#grassGrad)"/>

      <!-- Big Tree Trunk & Leaves -->
      <path d="M 80 500 Q 90 280 60 160 Q 120 180 130 500 Z" fill="#92400e"/>
      <circle cx="80" cy="140" r="70" fill="#15803d"/>
      <circle cx="130" cy="120" r="55" fill="#16a34a"/>
      <circle cx="40" cy="130" r="50" fill="#22c55e"/>

      <!-- Birthday Picnic Table -->
      <rect x="330" y="340" width="230" height="90" rx="14" fill="#ec4899" stroke="#db2777" stroke-width="4"/>
      <!-- Banner on Table: HAPPY BIRTHDAY -->
      <rect x="345" y="355" width="200" height="28" rx="8" fill="#ffffff" stroke="#ec4899" stroke-width="2"/>
      <text x="445" y="375" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="14" fill="#e11d48">★ HAPPY BIRTHDAY ★</text>
      <!-- Table Legs -->
      <rect x="350" y="420" width="16" height="60" fill="#9a3412"/>
      <rect x="520" y="420" width="16" height="60" fill="#9a3412"/>

      <!-- Food on Table: Cake, Pizza, Juice -->
      <ellipse cx="400" cy="335" rx="30" ry="12" fill="#78350f"/>
      <rect x="375" y="305" width="50" height="25" rx="6" fill="#854d0e"/>
      <circle cx="400" cy="298" r="4" fill="#ef4444"/>
      <text x="400" y="322" text-anchor="middle" font-size="10" font-weight="bold" fill="#fef08a">CAKE</text>

      <ellipse cx="480" cy="335" rx="36" ry="14" fill="#fb923c" stroke="#c2410c" stroke-width="3"/>
      <circle cx="475" cy="333" r="4" fill="#b91c1c"/>
      <circle cx="490" cy="335" r="4" fill="#b91c1c"/>
      <text x="480" y="338" text-anchor="middle" font-size="9" font-weight="900" fill="#fff">PIZZA</text>

      <!-- 1. Ben: Boy Flying Diamond Kite -->
      <g id="benKite">
        <!-- String -->
        <line x1="280" y1="280" x2="480" y2="120" stroke="#0f172a" stroke-width="2" stroke-dasharray="2 3"/>
        <!-- Diamond Kite -->
        <polygon points="480,90 515,120 480,150 445,120" fill="#38bdf8" stroke="#0284c7" stroke-width="3"/>
        <line x1="480" y1="90" x2="480" y2="150" stroke="#0284c7" stroke-width="2"/>
        <line x1="445" y1="120" x2="515" y2="120" stroke="#0284c7" stroke-width="2"/>
        <!-- Kite Tail with bows -->
        <path d="M 480 150 Q 500 170 510 200" stroke="#f43f5e" stroke-width="2" fill="none"/>
        <circle cx="490" cy="165" r="3" fill="#f43f5e"/>
        <circle cx="505" cy="185" r="3" fill="#f43f5e"/>
        <!-- Boy Ben figure -->
        <circle cx="280" cy="275" r="16" fill="#fde047" stroke="#ca8a04" stroke-width="2"/>
        <rect x="270" y="291" width="20" height="28" rx="4" fill="#ea580c"/>
        <rect x="270" y="319" width="8" height="22" fill="#1e293b"/>
        <rect x="282" y="319" width="8" height="22" fill="#1e293b"/>
        <text x="280" y="355" text-anchor="middle" font-size="11" font-weight="900" fill="#1e293b">Ben</text>
      </g>

      <!-- 2. Amy: Girl Playing Guitar on Grass -->
      <g id="amyGuitar">
        <circle cx="160" cy="370" r="18" fill="#fed7aa" stroke="#ea580c" stroke-width="2"/>
        <rect x="148" y="388" width="24" height="30" rx="6" fill="#f43f5e"/>
        <!-- Guitar -->
        <ellipse cx="175" cy="410" rx="14" ry="20" fill="#d97706" stroke="#78350f" stroke-width="2" transform="rotate(-30 175 410)"/>
        <rect x="175" y="380" width="5" height="40" fill="#92400e" transform="rotate(-30 175 380)"/>
        <text x="160" y="445" text-anchor="middle" font-size="11" font-weight="900" fill="#1e293b">Amy</text>
      </g>

      <!-- 3. Lily: Girl in Pink Dress near Pool -->
      <g id="lilyGirl">
        <circle cx="610" cy="340" r="16" fill="#fed7aa" stroke="#f97316" stroke-width="2"/>
        <polygon points="610,356 595,405 625,405" fill="#f472b6" stroke="#db2777" stroke-width="2"/>
        <line x1="602" y1="405" x2="602" y2="425" stroke="#1e293b" stroke-width="4"/>
        <line x1="618" y1="405" x2="618" y2="425" stroke="#1e293b" stroke-width="4"/>
        <text x="610" y="440" text-anchor="middle" font-size="11" font-weight="900" fill="#1e293b">Lily</text>
      </g>

      <!-- 4. Tom: Boy in Inflatable Blue Pool with Toy Boat -->
      <g id="tomPool">
        <!-- Inflatable Round Pool -->
        <ellipse cx="710" cy="420" rx="55" ry="32" fill="#38bdf8" stroke="#0284c7" stroke-width="6"/>
        <ellipse cx="710" cy="422" rx="46" ry="24" fill="#0284c7" opacity="0.6"/>
        <!-- Boy in Pool -->
        <circle cx="700" cy="405" r="14" fill="#fed7aa" stroke="#ca8a04" stroke-width="2"/>
        <!-- Toy Sailboat -->
        <polygon points="730,410 745,410 740,420 725,420" fill="#dc2626"/>
        <polygon points="735,395 735,410 745,410" fill="#ffffff"/>
        <text x="710" y="470" text-anchor="middle" font-size="11" font-weight="900" fill="#1e293b">Tom</text>
      </g>

      <!-- 5. Kate / Running boy & Puppy on Grass -->
      <g id="kateBoy">
        <circle cx="210" cy="440" r="15" fill="#fde047" stroke="#ca8a04" stroke-width="2"/>
        <rect x="202" y="455" width="16" height="24" fill="#16a34a" rx="4"/>
        <!-- Puppy -->
        <ellipse cx="240" cy="470" rx="14" ry="10" fill="#b45309"/>
        <circle cx="250" cy="465" r="7" fill="#b45309"/>
        <text x="210" y="495" text-anchor="middle" font-size="11" font-weight="900" fill="#1e293b">Kate</text>
      </g>

      <!-- 6. Daniel: Sitting at Wooden Desk Painting Rainbow -->
      <g id="danielPaint">
        <rect x="630" y="450" width="80" height="40" rx="6" fill="#b45309"/>
        <circle cx="660" cy="445" r="14" fill="#fed7aa"/>
        <path d="M 645 440 Q 660 425 675 440" stroke="#f43f5e" stroke-width="4" fill="none"/>
        <path d="M 647 444 Q 660 431 673 444" stroke="#38bdf8" stroke-width="4" fill="none"/>
        <text x="670" y="505" text-anchor="middle" font-size="11" font-weight="900" fill="#1e293b">Daniel</text>
      </g>
    </svg>
  `),

  // Page 2: Kim's Birthday Party Scene
  kimParty: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 420" width="700" height="420">
      <rect width="700" height="420" fill="#fff7ed"/>
      <!-- Bunting Banners -->
      <path d="M 20 40 Q 350 90 680 40" stroke="#ea580c" stroke-width="3" fill="none"/>
      <polygon points="100,52 130,56 115,85" fill="#ef4444"/>
      <polygon points="190,62 220,65 205,95" fill="#f59e0b"/>
      <polygon points="280,68 310,70 295,100" fill="#10b981"/>
      <polygon points="370,70 400,68 385,100" fill="#3b82f6"/>
      <polygon points="460,65 490,62 475,95" fill="#8b5cf6"/>
      <polygon points="550,56 580,52 565,85" fill="#ec4899"/>

      <!-- Wall Banner: HAPPY 8TH BIRTHDAY KIM -->
      <rect x="180" y="90" width="340" height="38" rx="10" fill="#fbbf24" stroke="#d97706" stroke-width="3"/>
      <text x="350" y="115" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="18" fill="#9a3412">
        ★ HAPPY 8TH BIRTHDAY KIM ★
      </text>

      <!-- Table in Foreground -->
      <ellipse cx="350" cy="330" rx="290" ry="85" fill="#fed7aa" stroke="#ea580c" stroke-width="5"/>

      <!-- Center Cake with '8' and 'KIM' -->
      <g transform="translate(300, 210)">
        <ellipse cx="50" cy="70" rx="55" ry="18" fill="#ec4899"/>
        <rect x="-5" y="25" width="110" height="45" fill="#f472b6" rx="6"/>
        <ellipse cx="50" cy="25" rx="55" ry="18" fill="#fbcfe8"/>
        <!-- Candle with number 8 -->
        <rect x="42" y="-15" width="16" height="32" rx="4" fill="#38bdf8"/>
        <text x="50" y="10" text-anchor="middle" font-weight="900" font-size="20" fill="#1e3a8a">8</text>
        <!-- Flame -->
        <circle cx="50" cy="-22" r="7" fill="#fbbf24"/>
        <circle cx="50" cy="-24" r="3" fill="#ef4444"/>
        <!-- Name KIM on cake -->
        <text x="50" y="55" text-anchor="middle" font-weight="900" font-size="16" fill="#ffffff">KIM</text>
      </g>

      <!-- Kim behind cake -->
      <circle cx="350" cy="180" r="32" fill="#fed7aa" stroke="#c2410c" stroke-width="3"/>
      <circle cx="350" cy="140" r="12" fill="#ec4899"/>
      <text x="350" y="185" text-anchor="middle" font-weight="bold" font-size="12" fill="#7c2d12">Kim (8)</text>

      <!-- Plate with 6 Cookies -->
      <ellipse cx="200" cy="340" rx="50" ry="22" fill="#ffffff" stroke="#cbd5e1" stroke-width="3"/>
      <circle cx="180" cy="335" r="7" fill="#d97706"/>
      <circle cx="198" cy="333" r="7" fill="#d97706"/>
      <circle cx="216" cy="335" r="7" fill="#d97706"/>
      <circle cx="188" cy="345" r="7" fill="#d97706"/>
      <circle cx="206" cy="345" r="7" fill="#d97706"/>
      <circle cx="224" cy="345" r="7" fill="#d97706"/>
      <text x="200" y="375" text-anchor="middle" font-size="11" font-weight="bold" fill="#78350f">6 Cookies</text>

      <!-- Kim's Puppy Ben by the table -->
      <g transform="translate(500, 310)">
        <ellipse cx="25" cy="20" rx="20" ry="14" fill="#b45309"/>
        <circle cx="40" cy="10" r="12" fill="#b45309"/>
        <circle cx="44" cy="7" r="3" fill="#000"/>
        <text x="25" y="45" text-anchor="middle" font-size="11" font-weight="bold" fill="#78350f">Puppy (Ben)</text>
      </g>

      <!-- Friends clapping -->
      <circle cx="150" cy="200" r="26" fill="#fde047"/>
      <circle cx="230" cy="190" r="26" fill="#fed7aa"/>
      <circle cx="470" cy="190" r="26" fill="#fed7aa"/>
      <circle cx="550" cy="200" r="26" fill="#fde047"/>
    </svg>
  `),

  // Pets for Part 3
  petPuppy: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" width="200" height="160">
      <rect width="200" height="160" rx="16" fill="#fef3c7"/>
      <ellipse cx="100" cy="95" rx="42" ry="28" fill="#d97706"/>
      <circle cx="75" cy="65" r="26" fill="#d97706"/>
      <ellipse cx="58" cy="65" rx="8" ry="16" fill="#92400e"/>
      <circle cx="70" cy="60" r="4" fill="#1e293b"/>
      <circle cx="62" cy="72" r="5" fill="#0f172a"/>
      <text x="100" y="145" text-anchor="middle" font-weight="bold" font-size="14" fill="#78350f">A. Puppy (Dog)</text>
    </svg>
  `),
  petTurtle: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" width="200" height="160">
      <rect width="200" height="160" rx="16" fill="#ecfdf5"/>
      <ellipse cx="105" cy="90" rx="46" ry="32" fill="#15803d" stroke="#14532d" stroke-width="3"/>
      <!-- Shell Patterns -->
      <ellipse cx="105" cy="90" rx="32" ry="20" fill="#22c55e"/>
      <circle cx="60" cy="92" r="16" fill="#16a34a"/>
      <circle cx="55" cy="88" r="3" fill="#0f172a"/>
      <!-- Legs -->
      <ellipse cx="80" cy="120" rx="10" ry="6" fill="#16a34a"/>
      <ellipse cx="130" cy="120" rx="10" ry="6" fill="#16a34a"/>
      <text x="100" y="145" text-anchor="middle" font-weight="bold" font-size="14" fill="#166534">B. Turtle</text>
    </svg>
  `),
  petFish: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" width="200" height="160">
      <rect width="200" height="160" rx="16" fill="#eff6ff"/>
      <ellipse cx="100" cy="80" rx="44" ry="26" fill="#38bdf8" stroke="#0284c7" stroke-width="3"/>
      <polygon points="144,80 170,60 170,100" fill="#f59e0b"/>
      <circle cx="75" cy="76" r="5" fill="#0f172a"/>
      <text x="100" y="140" text-anchor="middle" font-weight="bold" font-size="14" fill="#0369a1">C. Fish</text>
    </svg>
  `),

  // Activities
  actKite: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" width="200" height="160">
      <rect width="200" height="160" rx="16" fill="#f0f9ff"/>
      <polygon points="100,20 125,55 100,90 75,55" fill="#f43f5e" stroke="#be123c" stroke-width="2"/>
      <line x1="100" y1="90" x2="110" y2="120" stroke="#0f172a" stroke-width="2"/>
      <circle cx="110" cy="125" r="10" fill="#fed7aa"/>
      <text x="100" y="150" text-anchor="middle" font-weight="bold" font-size="13" fill="#0369a1">A. Flying a kite</text>
    </svg>
  `),
  actTennis: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" width="200" height="160">
      <rect width="200" height="160" rx="16" fill="#fefce8"/>
      <circle cx="110" cy="55" r="28" fill="none" stroke="#ca8a04" stroke-width="4"/>
      <line x1="90" y1="75" x2="65" y2="110" stroke="#854d0e" stroke-width="6"/>
      <circle cx="140" cy="45" r="8" fill="#84cc16"/>
      <text x="100" y="150" text-anchor="middle" font-weight="bold" font-size="13" fill="#854d0e">B. Playing tennis</text>
    </svg>
  `),
  actPainting: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" width="200" height="160">
      <rect width="200" height="160" rx="16" fill="#faf5ff"/>
      <!-- Easel -->
      <line x1="80" y1="30" x2="60" y2="120" stroke="#78350f" stroke-width="4"/>
      <line x1="120" y1="30" x2="140" y2="120" stroke="#78350f" stroke-width="4"/>
      <rect x="70" y="40" width="60" height="45" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
      <path d="M 80 70 Q 100 50 120 70" stroke="#ec4899" stroke-width="4" fill="none"/>
      <text x="100" y="150" text-anchor="middle" font-weight="bold" font-size="13" fill="#6b21a8">C. Painting picture</text>
    </svg>
  `),

  // Foods
  foodPizza: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" width="200" height="160">
      <rect width="200" height="160" rx="16" fill="#fff7ed"/>
      <path d="M 40 40 Q 100 25 160 40 L 100 125 Z" fill="#f59e0b" stroke="#b45309" stroke-width="4"/>
      <path d="M 40 40 Q 100 25 160 40" stroke="#d97706" stroke-width="12" fill="none"/>
      <circle cx="90" cy="65" r="7" fill="#dc2626"/>
      <circle cx="115" cy="75" r="6" fill="#dc2626"/>
      <circle cx="100" cy="95" r="5" fill="#dc2626"/>
      <text x="100" y="148" text-anchor="middle" font-weight="bold" font-size="13" fill="#9a3412">A. Pizza</text>
    </svg>
  `),
  foodSpaghetti: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" width="200" height="160">
      <rect width="200" height="160" rx="16" fill="#fef2f2"/>
      <ellipse cx="100" cy="95" rx="65" ry="24" fill="#ffffff" stroke="#cbd5e1" stroke-width="4"/>
      <ellipse cx="100" cy="88" rx="48" ry="18" fill="#fde047" stroke="#ca8a04" stroke-width="2"/>
      <circle cx="100" cy="85" r="14" fill="#dc2626"/>
      <text x="100" y="148" text-anchor="middle" font-weight="bold" font-size="13" fill="#991b1b">B. Spaghetti</text>
    </svg>
  `),
  foodPopcorn: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" width="200" height="160">
      <rect width="200" height="160" rx="16" fill="#fffbeb"/>
      <polygon points="75,50 125,50 115,120 85,120" fill="#ef4444" stroke="#b91c1c" stroke-width="2"/>
      <line x1="95" y1="50" x2="95" y2="120" stroke="#ffffff" stroke-width="6"/>
      <line x1="105" y1="50" x2="105" y2="120" stroke="#ffffff" stroke-width="6"/>
      <ellipse cx="100" cy="45" rx="28" ry="14" fill="#fef08a"/>
      <text x="100" y="148" text-anchor="middle" font-weight="bold" font-size="13" fill="#9a3412">C. Popcorn</text>
    </svg>
  `),

  // Marine Animals
  marineShark: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" width="200" height="160">
      <rect width="200" height="160" rx="16" fill="#f0f9ff"/>
      <path d="M 60 90 Q 90 40 140 60 Q 155 70 140 85 Q 100 95 60 90 Z" fill="#64748b" stroke="#334155" stroke-width="3"/>
      <!-- Fin -->
      <polygon points="100,50 115,25 125,55" fill="#475569"/>
      <!-- Splash -->
      <ellipse cx="100" cy="110" rx="45" ry="12" fill="#38bdf8" opacity="0.6"/>
      <text x="100" y="145" text-anchor="middle" font-weight="bold" font-size="13" fill="#1e293b">A. Shark</text>
    </svg>
  `),
  marineDolphin: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" width="200" height="160">
      <rect width="200" height="160" rx="16" fill="#e0f2fe"/>
      <path d="M 45 105 Q 85 30 140 60 Q 160 75 145 90 Q 90 95 45 105 Z" fill="#0284c7" stroke="#0369a1" stroke-width="3"/>
      <polygon points="95,45 110,25 115,50" fill="#0284c7"/>
      <!-- Snout -->
      <path d="M 140 60 L 165 65 L 145 75 Z" fill="#0284c7"/>
      <!-- Water splash -->
      <ellipse cx="100" cy="115" rx="50" ry="12" fill="#7dd3fc"/>
      <text x="100" y="145" text-anchor="middle" font-weight="bold" font-size="13" fill="#0369a1">B. Dolphin</text>
    </svg>
  `),
  marineWhale: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" width="200" height="160">
      <rect width="200" height="160" rx="16" fill="#eff6ff"/>
      <path d="M 50 90 Q 80 50 140 55 Q 160 85 130 100 Q 80 105 50 90 Z" fill="#1d4ed8" stroke="#1e40af" stroke-width="3"/>
      <!-- Spout -->
      <path d="M 115 50 Q 110 25 100 20" stroke="#38bdf8" stroke-width="3" fill="none"/>
      <path d="M 120 50 Q 125 25 135 20" stroke="#38bdf8" stroke-width="3" fill="none"/>
      <text x="100" y="145" text-anchor="middle" font-weight="bold" font-size="13" fill="#1e40af">C. Whale</text>
    </svg>
  `),

  // Reading & Writing Part 1: Tick or Cross
  readBalloon: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 180" width="200" height="180">
      <rect width="200" height="180" rx="16" fill="#fdf2f8"/>
      <!-- Balloon -->
      <ellipse cx="100" cy="75" rx="42" ry="50" fill="#ec4899" stroke="#db2777" stroke-width="3"/>
      <ellipse cx="88" cy="60" rx="10" ry="16" fill="#fbcfe8" opacity="0.6"/>
      <polygon points="96,125 104,125 100,132" fill="#db2777"/>
      <!-- String -->
      <path d="M 100 132 Q 90 145 105 160" stroke="#94a3b8" stroke-width="2" fill="none"/>
    </svg>
  `),
  readRadioWave: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 180" width="200" height="180">
      <rect width="200" height="180" rx="16" fill="#eff6ff"/>
      <!-- Big crashing ocean wave -->
      <path d="M 30 140 Q 70 140 100 110 Q 140 70 160 40 Q 140 50 120 70 Q 90 100 30 140 Z" fill="#0284c7"/>
      <path d="M 160 40 Q 145 40 130 55" stroke="#ffffff" stroke-width="6" fill="none"/>
      <path d="M 20 150 Q 100 130 180 150" stroke="#38bdf8" stroke-width="8" fill="none"/>
      <text x="100" y="170" text-anchor="middle" font-size="11" font-weight="bold" fill="#0369a1">[Picture: Ocean Wave]</text>
    </svg>
  `),
  readRacket: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 180" width="200" height="180">
      <rect width="200" height="180" rx="16" fill="#f8fafc"/>
      <!-- Tennis racket -->
      <ellipse cx="120" cy="65" rx="36" ry="44" fill="#ffffff" stroke="#334155" stroke-width="4" transform="rotate(35 120 65)"/>
      <line x1="95" y1="95" x2="50" y2="155" stroke="#0f172a" stroke-width="8" stroke-linecap="round"/>
      <!-- Grip -->
      <line x1="60" y1="140" x2="48" y2="156" stroke="#ef4444" stroke-width="9"/>
      <!-- Net strings -->
      <line x1="95" y1="65" x2="145" y2="65" stroke="#94a3b8" stroke-width="1.5"/>
      <line x1="120" y1="30" x2="120" y2="100" stroke="#94a3b8" stroke-width="1.5"/>
    </svg>
  `),
  readWaterfall: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 180" width="200" height="180">
      <rect width="200" height="180" rx="16" fill="#f0fdf4"/>
      <!-- Mountains -->
      <polygon points="20,150 70,40 120,150" fill="#15803d"/>
      <polygon points="80,150 140,50 190,150" fill="#166534"/>
      <!-- Waterfall stream -->
      <path d="M 95 65 L 115 65 L 120 150 L 90 150 Z" fill="#38bdf8"/>
      <line x1="100" y1="70" x2="100" y2="145" stroke="#ffffff" stroke-width="2"/>
      <line x1="110" y1="70" x2="110" y2="145" stroke="#ffffff" stroke-width="2"/>
      <!-- Pool at bottom -->
      <ellipse cx="105" cy="150" rx="40" ry="12" fill="#0284c7"/>
    </svg>
  `),

  // Reading & Writing Part 3: Unscramble Pictures
  scrambleValley: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 160" width="260" height="160">
      <rect width="260" height="160" rx="14" fill="#ecfdf5"/>
      <!-- Sky -->
      <rect width="260" height="80" fill="#bae6fd"/>
      <!-- Left & Right Mountains -->
      <polygon points="-20,160 50,40 130,160" fill="#16a34a"/>
      <polygon points="130,160 210,35 280,160" fill="#15803d"/>
      <!-- Valley River flowing in middle -->
      <path d="M 130 110 Q 125 130 140 160 L 120 160 Q 115 135 125 110 Z" fill="#0284c7"/>
      <!-- Sun -->
      <circle cx="130" cy="40" r="14" fill="#facc15"/>
    </svg>
  `),
  scrambleBeach: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 160" width="260" height="160">
      <rect width="260" height="160" rx="14" fill="#eff6ff"/>
      <!-- Sky & Sun -->
      <rect width="260" height="90" fill="#bae6fd"/>
      <circle cx="210" cy="40" r="16" fill="#f59e0b"/>
      <!-- Ocean -->
      <rect y="80" width="260" height="40" fill="#0284c7"/>
      <!-- Golden Beach Sand -->
      <path d="M 0 160 L 0 115 Q 120 100 260 130 L 260 160 Z" fill="#fde047"/>
      <!-- Palm Tree -->
      <path d="M 40 150 Q 55 100 45 70" stroke="#78350f" stroke-width="6" fill="none"/>
      <circle cx="45" cy="65" r="22" fill="#16a34a"/>
    </svg>
  `),
  scrambleGuitar: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 160" width="260" height="160">
      <rect width="260" height="160" rx="14" fill="#fffbeb"/>
      <!-- Acoustic Guitar lying diagonally -->
      <g transform="translate(130, 80) rotate(-25)">
        <ellipse cx="-40" cy="0" rx="36" ry="26" fill="#d97706" stroke="#92400e" stroke-width="3"/>
        <ellipse cx="-15" cy="0" rx="22" ry="18" fill="#d97706" stroke="#92400e" stroke-width="3"/>
        <circle cx="-30" cy="0" r="10" fill="#1e293b"/>
        <!-- Neck -->
        <rect x="-15" y="-6" width="90" height="12" fill="#78350f"/>
        <!-- Head -->
        <rect x="75" y="-9" width="22" height="18" rx="3" fill="#92400e"/>
        <!-- Strings -->
        <line x1="-30" y1="-2" x2="85" y2="-2" stroke="#ffffff" stroke-width="1.5"/>
        <line x1="-30" y1="2" x2="85" y2="2" stroke="#ffffff" stroke-width="1.5"/>
      </g>
    </svg>
  `),
  scrambleIsland: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 160" width="260" height="160">
      <rect width="260" height="160" rx="14" fill="#e0f2fe"/>
      <!-- Ocean -->
      <rect y="70" width="260" height="90" fill="#0284c7"/>
      <!-- Island mound -->
      <ellipse cx="130" cy="115" rx="65" ry="22" fill="#fde047" stroke="#ca8a04" stroke-width="3"/>
      <!-- Palm Trees on Island -->
      <path d="M 120 115 Q 125 80 115 65" stroke="#78350f" stroke-width="5" fill="none"/>
      <circle cx="115" cy="60" r="18" fill="#16a34a"/>
      <path d="M 140 115 Q 145 85 150 70" stroke="#78350f" stroke-width="4" fill="none"/>
      <circle cx="150" cy="65" r="14" fill="#22c55e"/>
    </svg>
  `),

  // Word Bank Images for Part 4
  wordSea: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120" width="160" height="120">
      <rect width="160" height="120" rx="12" fill="#e0f2fe"/>
      <path d="M 10 70 Q 50 50 80 70 Q 110 90 150 70" stroke="#0284c7" stroke-width="6" fill="none"/>
      <path d="M 10 90 Q 50 70 80 90 Q 110 110 150 90" stroke="#0369a1" stroke-width="6" fill="none"/>
      <circle cx="130" cy="30" r="14" fill="#facc15"/>
    </svg>
  `),
  wordBirthday: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120" width="160" height="120">
      <rect width="160" height="120" rx="12" fill="#fdf2f8"/>
      <rect x="45" y="55" width="70" height="35" rx="6" fill="#ec4899"/>
      <circle cx="60" cy="45" r="4" fill="#ef4444"/>
      <circle cx="80" cy="45" r="4" fill="#3b82f6"/>
      <circle cx="100" cy="45" r="4" fill="#10b981"/>
      <text x="80" y="80" text-anchor="middle" font-size="12" font-weight="900" fill="#fff">PARTY</text>
    </svg>
  `),
  wordPasta: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120" width="160" height="120">
      <rect width="160" height="120" rx="12" fill="#fff7ed"/>
      <ellipse cx="80" cy="70" rx="55" ry="22" fill="#fef08a" stroke="#d97706" stroke-width="3"/>
      <circle cx="70" cy="65" r="8" fill="#dc2626"/>
      <circle cx="95" cy="68" r="8" fill="#dc2626"/>
    </svg>
  `),
  wordSinging: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120" width="160" height="120">
      <rect width="160" height="120" rx="12" fill="#faf5ff"/>
      <circle cx="80" cy="45" r="20" fill="#fed7aa"/>
      <ellipse cx="80" cy="50" rx="5" ry="6" fill="#dc2626"/>
      <!-- Mic -->
      <line x1="95" y1="55" x2="110" y2="70" stroke="#334155" stroke-width="4"/>
      <circle cx="95" cy="55" r="5" fill="#64748b"/>
      <!-- Notes -->
      <text x="120" y="40" font-size="16" fill="#8b5cf6">♪</text>
      <text x="50" y="40" font-size="16" fill="#8b5cf6">♫</text>
    </svg>
  `),
  wordDolphin: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120" width="160" height="120">
      <rect width="160" height="120" rx="12" fill="#e0f2fe"/>
      <path d="M 30 80 Q 60 25 110 50 Q 130 60 120 75 Q 80 80 30 80 Z" fill="#0284c7"/>
      <polygon points="75,40 85,25 90,45" fill="#0284c7"/>
      <circle cx="105" cy="55" r="3" fill="#fff"/>
    </svg>
  `),

  // Ben's Party Beach Scene for Part 4
  benPartyBeach: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 360" width="700" height="360">
      <rect width="700" height="360" fill="#eff6ff"/>
      <rect width="700" height="180" fill="#bae6fd"/>
      <circle cx="620" cy="50" r="30" fill="#facc15"/>
      <rect y="160" width="700" height="60" fill="#0284c7"/>
      <!-- Dolphin in distance -->
      <path d="M 520 180 Q 545 150 565 170" stroke="#38bdf8" stroke-width="5" fill="none"/>
      <!-- Beach Sand -->
      <rect y="210" width="700" height="150" fill="#fde047"/>
      <!-- Happy Birthday banner -->
      <rect x="230" y="30" width="240" height="36" rx="8" fill="#ef4444"/>
      <text x="350" y="54" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="16" fill="#ffffff">
        ★ HAPPY BIRTHDAY BEN! ★
      </text>
      <!-- Party Picnic Table -->
      <ellipse cx="350" cy="270" rx="200" ry="45" fill="#fed7aa" stroke="#ea580c" stroke-width="4"/>
      <text x="350" y="275" text-anchor="middle" font-weight="900" font-size="14" fill="#9a3412">
        Cake &amp; Pasta on Beach Table
      </text>
    </svg>
  `),

  // Example images for Cambridge Reading & Writing Part 1: Tick or Cross
  examplePizza: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 140" width="160" height="140">
      <defs>
        <radialGradient id="cheeseGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#fef08a"/>
          <stop offset="100%" stop-color="#f59e0b"/>
        </radialGradient>
      </defs>
      <rect width="160" height="140" rx="14" fill="#fffbeb"/>
      <!-- Pizza Crust -->
      <path d="M 25 22 Q 80 8 135 22 L 80 128 Z" fill="#d97706" stroke="#b45309" stroke-width="4"/>
      <!-- Pizza Cheese Slice -->
      <path d="M 32 26 Q 80 16 128 26 L 80 120 Z" fill="url(#cheeseGrad)"/>
      <!-- Pepperoni slices -->
      <circle cx="80" cy="46" r="12" fill="#dc2626" stroke="#991b1b" stroke-width="2"/>
      <circle cx="55" cy="55" r="10" fill="#dc2626" stroke="#991b1b" stroke-width="2"/>
      <circle cx="102" cy="58" r="10" fill="#dc2626" stroke="#991b1b" stroke-width="2"/>
      <circle cx="78" cy="85" r="11" fill="#dc2626" stroke="#991b1b" stroke-width="2"/>
      <!-- Herbs -->
      <circle cx="68" cy="35" r="2.5" fill="#15803d"/>
      <circle cx="95" cy="38" r="2.5" fill="#15803d"/>
      <circle cx="68" cy="70" r="2.5" fill="#15803d"/>
      <circle cx="92" cy="74" r="2.5" fill="#15803d"/>
    </svg>
  `),
  examplePuppyCat: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 140" width="160" height="140">
      <rect width="160" height="140" rx="14" fill="#fefce8"/>
      <!-- Ears -->
      <polygon points="40,55 52,18 72,45" fill="#ea580c"/>
      <polygon points="46,50 54,26 67,44" fill="#fed7aa"/>
      <polygon points="120,55 108,18 88,45" fill="#ea580c"/>
      <polygon points="114,50 106,26 93,44" fill="#fed7aa"/>
      <!-- Cat Head -->
      <ellipse cx="80" cy="62" rx="42" ry="34" fill="#f97316"/>
      <!-- White cheeks / muzzle -->
      <ellipse cx="70" cy="72" rx="14" ry="10" fill="#ffffff"/>
      <ellipse cx="90" cy="72" rx="14" ry="10" fill="#ffffff"/>
      <!-- Big cute eyes -->
      <ellipse cx="64" cy="58" rx="8" ry="9" fill="#0284c7"/>
      <circle cx="66" cy="56" r="3" fill="#ffffff"/>
      <ellipse cx="96" cy="58" rx="8" ry="9" fill="#0284c7"/>
      <circle cx="98" cy="56" r="3" fill="#ffffff"/>
      <!-- Nose & mouth -->
      <polygon points="78,68 82,68 80,71" fill="#ec4899"/>
      <path d="M 75 73 Q 80 77 80 73 Q 80 77 85 73" stroke="#7c2d12" stroke-width="2" fill="none"/>
      <!-- Whiskers -->
      <line x1="42" y1="68" x2="24" y2="65" stroke="#fed7aa" stroke-width="2"/>
      <line x1="42" y1="74" x2="24" y2="76" stroke="#fed7aa" stroke-width="2"/>
      <line x1="118" y1="68" x2="136" y2="65" stroke="#fed7aa" stroke-width="2"/>
      <line x1="118" y1="74" x2="136" y2="76" stroke="#fed7aa" stroke-width="2"/>
      <!-- Body -->
      <ellipse cx="80" cy="108" rx="30" ry="24" fill="#ea580c"/>
      <ellipse cx="80" cy="110" rx="18" ry="18" fill="#ffffff"/>
      <!-- Paws -->
      <circle cx="68" cy="126" r="9" fill="#ffffff"/>
      <circle cx="92" cy="126" r="9" fill="#ffffff"/>
    </svg>
  `),

  // Example image for Tick / Cross (Part 5)
  exampleBanana: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" width="200" height="160">
      <rect width="200" height="160" rx="16" fill="#fefce8"/>
      <path d="M 40 110 Q 70 135 120 120 Q 160 100 170 50 Q 155 75 110 85 Q 65 95 40 110 Z" fill="#fde047" stroke="#ca8a04" stroke-width="3"/>
      <circle cx="38" cy="112" r="4" fill="#854d0e"/>
      <circle cx="170" cy="50" r="3" fill="#65a30d"/>
      <text x="100" y="145" text-anchor="middle" font-weight="900" font-size="14" fill="#854d0e">Banana (Quả chuối)</text>
    </svg>
  `),

  // Example image for Unscramble (Part 7: duck)
  exampleDuck: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" width="200" height="160">
      <rect width="200" height="160" rx="16" fill="#f0fdf4"/>
      <ellipse cx="110" cy="95" rx="42" ry="26" fill="#facc15" stroke="#ca8a04" stroke-width="3"/>
      <circle cx="75" cy="70" r="22" fill="#facc15" stroke="#ca8a04" stroke-width="3"/>
      <polygon points="55,68 35,74 55,80" fill="#f97316"/>
      <circle cx="70" cy="65" r="3.5" fill="#0f172a"/>
      <path d="M 100 88 Q 125 80 135 98 Q 115 105 100 88 Z" fill="#eab308"/>
      <path d="M 40 125 Q 100 115 160 125" stroke="#38bdf8" stroke-width="3" fill="none"/>
      <text x="100" y="148" text-anchor="middle" font-weight="900" font-size="14" fill="#854d0e">Duck (Con vịt)</text>
    </svg>
  `)
};

export function getAdvancedGrade2Parts(): ExamPart[] {
  return [
    {
      id: "part-g2-1",
      section: "listening",
      title: "Part 1: Listen and Draw Lines",
      instructions: "Lắng nghe bài nói và nối tên từng bạn với nhân vật đúng trong tranh.",
      points: 1.0,
      audio: "tts:Part 1. Listen and draw lines. Look at the boy flying the blue kite. That is Ben.",
      maxPlayCount: 2,
      example: {
        title: "Ví dụ mẫu (Example): Listen and draw lines",
        questionText: "Look at the boy flying the blue kite in the backyard party. That is Ben.<br/>(Nhìn cậu bé đang thả con diều màu xanh da trời. Đó là bạn Ben).",
        img: GRADE2_MEDIA.partyBackyard,
        audio: "tts:Part 1. Look at the boy flying the blue kite. That is Ben. Can you see the line? This is an example. Now you listen and draw lines.",
        type: "connect-pairs",
        connectPair: {
          fromLabel: "Ben",
          toLabel: "P2",
          fromText: "Ben (Ví dụ mẫu)",
          toText: "Cậu bé thả diều xanh (Boy flying blue kite)",
          fromX: 300,
          fromY: 35,
          toX: 280,
          toY: 300,
          canvasWidth: 800,
          canvasHeight: 520
        },
        answerText: "Nối tên 'Ben' với hình cậu bé thả diều xanh",
        explanation: "Hướng dẫn: Lắng nghe tên nhân vật trong bài đọc và quan sát hành động của bạn đó trong tranh (bạn Ben đang thả diều màu xanh). Bấm vào tên bạn rồi bấm vào nhân vật để tạo đường kẻ nối."
      }
    },
    {
      id: "part-g2-2",
      section: "listening",
      title: "Part 2",
      instructions: "Read the questions. Listen and write a name or a number. There are two examples.",
      subInstructions: "Đọc câu hỏi. Lắng nghe và viết tên hoặc số thích hợp. Dưới đây là 2 ví dụ.",
      points: 1.0,
      maxPlayCount: 2,
      img: GRADE2_MEDIA.kimParty,
      imageTitle: "KIM'S BIRTHDAY PARTY",
      audio: "tts:Part 2. Look at the picture. Listen and look. There are two examples. Hello, what is the girl's name? Her name is Kim. How do you spell Kim? K - I - M. And how old is Kim? She is eight years old. Eight? Yes, that is right. Can you see the answers? Now you listen and write a name or a number. Question 1. What is Kim's sister's name? Her sister's name is May. How do you spell May? M - A - Y. Question 2. How many cookies are there? Look at the plate, there are six cookies. Six? Yes, six cookies. Question 3. What is Kim's puppy's name? His name is Ben. B - E - N. Question 4. How many kittens has Kim got? She has got two kittens at home. Two? Yes, two kittens.",
      audioScript: "Man: Hello, what is the girl's name?\nGirl: Her name is Kim.\nMan: How do you spell Kim?\nGirl: K - I - M.\nMan: And how old is Kim?\nGirl: She is eight years old. Eight? Yes, that is right.\n\nNow listen and write a name or a number.\n\n1. What is Kim's sister's name? May (M-A-Y)\n2. How many cookies are there? 6 cookies\n3. What is Kim's puppy's name? Ben (B-E-N)\n4. How many kittens has Kim got? 2 kittens",
      examplesList: [
        { question: "What is the girl's name?", answer: "Kim" },
        { question: "How old is Kim?", answer: "8" }
      ],
      example: {
        title: "Examples",
        questionText: "What is the girl's name? ➔ <strong>Kim</strong><br/>How old is Kim? ➔ <strong>8</strong>",
        audio: "tts:Hello, what is the girl's name? Her name is Kim. How do you spell Kim? K - I - M. And how old is Kim? She is eight years old. Eight? Yes, that is right.",
        type: "listen-write",
        answerText: "Kim | 8",
        explanation: "Hướng dẫn: Lắng nghe thật kỹ bài đọc. Khi người nói đánh vần tên từng chữ cái (như K-I-M) hoặc nói về con số (như eight / 8), em điền chữ hoặc số đó vào chỗ trống."
      }
    },
    {
      id: "part-g2-3",
      section: "listening",
      title: "Part 3: Multiple Choice",
      instructions: "Lắng nghe câu hỏi và chọn bức tranh đúng tương ứng.",
      points: 1.5,
      maxPlayCount: 2,
      example: {
        title: "Ví dụ mẫu (Example): Listen and choose the correct picture",
        questionText: "Which is Sue's pet? (Con thú cưng của bạn Sue là con nào?)",
        audio: "tts:Which is Sue's pet? Do you have a pet, Sue? Yes, I have a green turtle. A turtle? Yes, I love turtles.",
        type: "multiple-choice",
        options: [
          { text: "A. Dog (Chó)" },
          { text: "B. Turtle (Rùa)" },
          { text: "C. Fish (Cá)" }
        ],
        correctIndex: 1,
        answerText: "B. Turtle (Con rùa)",
        explanation: "Hướng dẫn: Lắng nghe bài đối thoại. Bạn Sue trả lời rằng bạn có một con rùa (green turtle). Bức tranh B vẽ con rùa, vì vậy em bấm chọn đáp án B."
      }
    },
    {
      id: "part-g2-4",
      section: "listening",
      title: "Part 4: Listen and Colour (Cambridge Exam)",
      instructions: "Lắng nghe bài audio về bức tranh nét không màu. Chọn đúng màu trong hộp bút chì màu và bấm vào từng chi tiết tương ứng trên tranh để tô màu.",
      points: 1.5,
      audio: "tts:Look at the picture. Listen and look. There is one example. Can you see the bird in the tree? Yes! Colour the bird blue. This is an example. Now you listen and colour the other things.",
      audioScript: "Man: Look at the picture. Listen and look. There is one example.\nMan: Can you see the bird in the tree?\nGirl: Yes! Can I colour it?\nMan: Colour the bird in the tree blue.\nGirl: Blue? Okay, a blue bird.\nMan: Look, the bird is blue. This is an example. Now you listen and colour.\n\n1. Man: Can you see the ball next to the water?\nGirl: Yes, I can.\nMan: Colour the ball next to the water yellow.\nGirl: Yellow? Okay, the ball next to the water is yellow.\n\n2. Man: Look at the dog next to the bench. It is sleeping.\nGirl: Can you colour the dog brown?\nMan: Yes, colour the dog brown.\n\n3. Man: Now look up. Can you find the balloon in the sky?\nGirl: Yes, a big round balloon!\nMan: Colour the balloon red.\nGirl: Red? I love red!\n\n4. Man: Look at the flower next to the big tree.\nGirl: Can I colour the flower pink?\nMan: Yes, colour the flower pink. What a pretty picture!",
      maxPlayCount: 2,
      example: {
        title: "Ví dụ mẫu (Example): Listen and colour",
        questionText: "Look at the bird in the tree. Colour the bird blue.<br/>(Nhìn chú chim trên cây. Chú chim đã được tô màu xanh dương làm ví dụ mẫu cho em).",
        img: DEFAULT_CAMBRIDGE_COLORING_SCENE,
        audio: "tts:Look at the picture. Listen and look. There is one example. Can you see the bird in the tree? Yes! Colour the bird blue. This is an example. Now you listen and colour the other things.",
        type: "listen-colour",
        colourItem: {
          label: "Con chim trên cây (Bird in the tree)",
          color: "#3b82f6",
          colorName: "Xanh dương (Blue)"
        },
        answerText: "Tô màu xanh dương cho chú chim trên cây",
        explanation: "Hướng dẫn: Em lắng nghe lời thoại trong bài nghe, xác định đồ vật hoặc con vật được nhắc tới, chọn cây bút chì màu đúng và bấm vào chi tiết đó trên tranh vẽ để tô màu. Chi tiết chú chim trên cây đã được tô sẵn màu xanh dương để làm mẫu!"
      }
    },
    {
      id: "part-g2-5",
      section: "reading-writing",
      title: "Part 1: Look and Read (Tick / Cross)",
      instructions: "Look and read. Put a tick (✓) or a cross (✗) in the box. There are two examples.",
      subInstructions: "Quan sát và đọc. Đánh dấu (✓) hoặc (✗) vào ô trống. Dưới đây là 2 ví dụ.",
      points: 1.0,
      examplesList: [
        {
          question: "This is a pizza.",
          answer: "✓",
          img: GRADE2_MEDIA.examplePizza,
          isTick: true
        },
        {
          question: "This is a puppy.",
          answer: "✗",
          img: GRADE2_MEDIA.examplePuppyCat,
          isTick: false
        }
      ],
      example: {
        title: "Examples: Put a tick (✓) or a cross (✗) in the box",
        questionText: "Ví dụ 1: This is a pizza. ➔ Đánh dấu tick <strong>[ ✓ ]</strong> vì câu đúng với tranh pizza.<br/>Ví dụ 2: This is a puppy. ➔ Đánh dấu cross <strong>[ ✗ ]</strong> vì hình là mèo con (không phải puppy cún con).",
        img: GRADE2_MEDIA.examplePizza,
        type: "tick-cross",
        isTick: true,
        answerText: "Ví dụ 1: ✓  |  Ví dụ 2: ✗",
        explanation: "Hướng dẫn: Quan sát kỹ bức tranh và câu miêu tả tiếng Anh bên cạnh. Nếu câu nói đúng với tranh thì bấm vào ô trống để hiện dấu TICK (✓). Nếu câu nói sai với tranh thì bấm vào ô trống để hiện dấu CROSS (✗)."
      }
    },
    {
      id: "part-g2-6",
      section: "reading-writing",
      title: "Part 2: Look and Read (Yes / No)",
      instructions: "Look and read. Write yes or no. There are two examples.",
      subInstructions: "Quan sát bức tranh bữa tiệc sinh nhật và trả lời yes hoặc no.",
      points: 1.0,
      img: GRADE2_MEDIA.partyBackyard,
      imageTitle: "THE BIRTHDAY PARTY",
      examplesList: [
        { question: "A girl is playing the guitar.", answer: "yes" },
        { question: "The puppy is on the table.", answer: "no" }
      ],
      example: {
        title: "Ví dụ mẫu (Examples): Look and read. Write Yes or No",
        questionText: "Quan sát bức tranh sinh nhật:<br/>• Ví dụ 1: A girl is playing the guitar. ➔ Chọn <strong>YES</strong> (vì trong tranh có bạn nữ đang chơi đàn).<br/>• Ví dụ 2: The puppy is on the table. ➔ Chọn <strong>NO</strong> (vì chú cún đang ở trên bãi cỏ, không ở trên bàn).",
        type: "yes-no",
        options: [
          { text: "YES" },
          { text: "NO" }
        ],
        correctIndex: 0,
        answerText: "YES",
        explanation: "Hướng dẫn: Nhìn bức tranh toàn cảnh và đọc câu miêu tả. Nếu nội dung câu đó có trong tranh thì chọn YES, nếu không có hoặc sai so với tranh thì chọn NO."
      }
    },
    {
      id: "part-g2-7",
      section: "reading-writing",
      title: "Part 3: Unscramble the Word",
      instructions: "Nhìn tranh và sắp xếp các chữ cái xáo trộn thành từ tiếng Anh đúng.",
      points: 1.2,
      example: {
        title: "Ví dụ mẫu (Example): Look at the letters. Write the word.",
        questionText: "Nhìn bức tranh con vịt và các chữ cái gợi ý: <strong>[ u / d / c / k ]</strong>.<br/>Từ tiếng Anh chỉ con vịt là: <strong>duck</strong>.",
        img: GRADE2_MEDIA.exampleDuck,
        type: "unscramble-word",
        unscrambleLetters: ["u", "d", "c", "k"],
        unscrambleTarget: "duck",
        answerText: "duck",
        explanation: "Hướng dẫn: Nhìn tranh để nhận biết từ tiếng Anh (con vịt là 'duck'). Bấm lần lượt các chữ cái d - u - c - k hoặc gõ trực tiếp chữ cái vào ô để ghép thành từ hoàn chỉnh."
      }
    },
    {
      id: "part-g2-8",
      section: "reading-writing",
      title: "Part 4: Story with Word Bank",
      instructions: "Đọc câu chuyện và chọn từ phù hợp trong ngân hàng từ để hoàn thành đoạn văn.",
      points: 0.9,
      example: {
        title: "Ví dụ mẫu (Example): Read this. Choose a word from the box.",
        questionText: "Đọc đoạn văn mở đầu câu chuyện:<br/>'Henry is eleven years old. Last week, he went on holiday with his family near the <strong>[ sea ]</strong>.'",
        type: "story-word-bank",
        storySnippet: "Henry went on holiday with his family near the [ sea ] (0)...",
        storyWord: "sea",
        answerText: "sea (ô ví dụ số 0)",
        explanation: "Hướng dẫn: Đọc kỹ câu chuyện. Ở mỗi chỗ trống được đánh số, em chọn một từ phù hợp nhất trong ngân hàng từ ở trên để điền vào. Từ đã điền ở câu ví dụ (như từ 'sea') sẽ bị gạch chéo và không dùng lại cho các câu khác."
      }
    }
  ];
}

// Generates the full 28-question Advanced Grade 2 English exam set
export function getAdvancedGrade2Questions(): Question[] {
  return [
    // ==========================================
    // LISTENING - PART 1 (4 questions)
    // "Listen and draw lines. There is one example."
    // ==========================================
    {
      sectionTitle: "LISTENING - Part 1 (4 questions)",
      exampleHint: "Example: Ben is flying the blue kite in the backyard.",
      q: "<strong>Part 1 (Q1 - Q4): Listen and draw lines.</strong><br/>Lắng nghe bài nói và nối tên từng bạn với đúng nhân vật trong bữa tiệc sinh nhật ngoài sân vườn.",
      img: GRADE2_MEDIA.partyBackyard,
      audio: "tts:Part 1. Listen and draw lines. There is one example. Look at the boy flying the blue kite. That is Ben. Can you see the line? Now listen and draw lines. One. Who is playing the guitar? That is Amy. Amy loves music. Two. Can you see Lily? Lily is wearing a pretty pink dress. Three. Look at Tom! Tom is playing with the toy boat in the water. Four. Kate is in a green shirt, running happily with the puppy.",
      type: "connect-pairs",
      connectPairs: {
        width: 800,
        height: 520,
        tolerance: 25,
        showLabels: true,
        defaultColor: "#2563eb",
        points: [
          // Top Names row
          { x: 160, y: 35, label: "Amy", text: "Amy", color: "#2563eb", r: 16 },
          { x: 300, y: 35, label: "Ben", text: "Ben (Ví dụ)", color: "#2563eb", r: 16 },
          { x: 440, y: 35, label: "Lily", text: "Lily", color: "#2563eb", r: 16 },
          { x: 570, y: 35, label: "Tom", text: "Tom", color: "#2563eb", r: 16 },
          { x: 700, y: 35, label: "Kate", text: "Kate", color: "#2563eb", r: 16 },

          // Characters in scene
          { x: 160, y: 400, label: "P1", text: "Girl playing guitar", color: "#2563eb", r: 16 },
          { x: 280, y: 300, label: "P2", text: "Boy flying kite", color: "#2563eb", r: 16 },
          { x: 610, y: 380, label: "P3", text: "Girl in pink dress", color: "#2563eb", r: 16 },
          { x: 710, y: 420, label: "P4", text: "Boy in water pool", color: "#2563eb", r: 16 },
          { x: 210, y: 460, label: "P5", text: "Child with puppy", color: "#2563eb", r: 16 }
        ],
        pairs: [
          ["Amy", "P1"],
          ["Ben", "P2"],
          ["Lily", "P3"],
          ["Tom", "P4"],
          ["Kate", "P5"]
        ],
        examplePair: ["Ben", "P2"],
        examplePairLabel: "★ Ví dụ mẫu: Ben ➔ Boy flying kite"
      }
    },

    // ==========================================
    // LISTENING - PART 2 (4 questions)
    // "Read the questions. Listen and write a name or a number."
    // ==========================================
    {
      partId: "part-g2-2",
      points: 0.25,
      sectionTitle: "LISTENING - Part 2 (4 questions)",
      exampleHint: "Examples: What is the girl's name? Kim | How old is Kim? 8",
      q: "1. What is Kim's sister's name?",
      img: GRADE2_MEDIA.kimParty,
      audio: "tts:Question 1. What is Kim's sister's name? Does Kim have a sister? Yes, she does. Her sister's name is May. How do you spell May? M - A - Y, May.",
      type: "listen-write",
      acceptableAnswers: ["May", "may"]
    },
    {
      partId: "part-g2-2",
      points: 0.25,
      sectionTitle: "LISTENING - Part 2 (4 questions)",
      exampleHint: "Examples: What is the girl's name? Kim | How old is Kim? 8",
      q: "2. How many cookies are there?",
      img: GRADE2_MEDIA.kimParty,
      audio: "tts:Question 2. How many cookies are there? Look at the plate, there are six cookies on the white plate. Six cookies.",
      type: "listen-write",
      acceptableAnswers: ["6", "six"]
    },
    {
      partId: "part-g2-2",
      points: 0.25,
      sectionTitle: "LISTENING - Part 2 (4 questions)",
      exampleHint: "Examples: What is the girl's name? Kim | How old is Kim? 8",
      q: "3. What is Kim's puppy's name?",
      img: GRADE2_MEDIA.kimParty,
      audio: "tts:Question 3. What is Kim's puppy's name? His name is Ben. B - E - N. Ben is a playful brown puppy.",
      type: "listen-write",
      acceptableAnswers: ["Ben", "ben"]
    },
    {
      partId: "part-g2-2",
      points: 0.25,
      sectionTitle: "LISTENING - Part 2 (4 questions)",
      exampleHint: "Examples: What is the girl's name? Kim | How old is Kim? 8",
      q: "4. How many kittens has Kim got?",
      img: GRADE2_MEDIA.kimParty,
      audio: "tts:Question 4. How many kittens has Kim got? Has Kim got any kittens? Yes, she has got two kittens at home. Two sweet kittens.",
      type: "listen-write",
      acceptableAnswers: ["2", "two"]
    },

    // ==========================================
    // LISTENING - PART 3 (4 questions)
    // "Listen and tick the box. There is one example."
    // ==========================================
    {
      sectionTitle: "LISTENING - Part 3 (4 questions)",
      exampleHint: "Example: What food is on the birthday table? A [✔] Pizza",
      q: "<strong>1. What pet does the girl have?</strong><br/>Lắng nghe và tích chọn con vật cưng của bạn nữ:",
      audio: "tts:Part 3. Listen and tick the box. Question 1. What pet does the girl have? Look, she has got a slow green turtle! That's her favourite pet.",
      type: "listening",
      options: [
        { text: "A. Puppy", img: GRADE2_MEDIA.petPuppy },
        { text: "B. Turtle", img: GRADE2_MEDIA.petTurtle },
        { text: "C. Fish", img: GRADE2_MEDIA.petFish }
      ],
      correctIndex: 1
    },
    {
      sectionTitle: "LISTENING - Part 3 (4 questions)",
      exampleHint: "Example: What food is on the birthday table? A [✔] Pizza",
      q: "<strong>2. What is Kim doing in the backyard?</strong><br/>Lắng nghe và tích chọn hoạt động của Kim:",
      audio: "tts:Question 2. What is Kim doing in the backyard? She is painting a colourful picture on the easel with her paints.",
      type: "listening",
      options: [
        { text: "A. Flying a kite", img: GRADE2_MEDIA.actKite },
        { text: "B. Playing tennis", img: GRADE2_MEDIA.actTennis },
        { text: "C. Painting picture", img: GRADE2_MEDIA.actPainting }
      ],
      correctIndex: 2
    },
    {
      sectionTitle: "LISTENING - Part 3 (4 questions)",
      exampleHint: "Example: What food is on the birthday table? A [✔] Pizza",
      q: "<strong>3. What does the boy think is yummy?</strong><br/>Lắng nghe và tích chọn món ăn mà cậu bé khen ngon:",
      audio: "tts:Question 3. What does the boy think is yummy? He thinks pizza is very yummy! He wants another slice of pizza.",
      type: "listening",
      options: [
        { text: "A. Pizza", img: GRADE2_MEDIA.foodPizza },
        { text: "B. Spaghetti", img: GRADE2_MEDIA.foodSpaghetti },
        { text: "C. Popcorn", img: GRADE2_MEDIA.foodPopcorn }
      ],
      correctIndex: 0
    },
    {
      sectionTitle: "LISTENING - Part 3 (4 questions)",
      exampleHint: "Example: What food is on the birthday table? A [✔] Pizza",
      q: "<strong>4. What can you see at the seaside?</strong><br/>Lắng nghe và tích chọn loài sinh vật nhìn thấy ở bờ biển:",
      audio: "tts:Question 4. What can you see at the seaside? Look at the sea! I can see a smart blue dolphin jumping out of the waves!",
      type: "listening",
      options: [
        { text: "A. Shark", img: GRADE2_MEDIA.marineShark },
        { text: "B. Dolphin", img: GRADE2_MEDIA.marineDolphin },
        { text: "C. Whale", img: GRADE2_MEDIA.marineWhale }
      ],
      correctIndex: 1
    },

    // ==========================================
    // LISTENING - PART 4 (4 questions)
    // "Listen and colour. There is one example."
    // ==========================================
    {
      partId: "part-g2-4",
      points: 1.5,
      sectionTitle: "LISTENING - Part 4: Listen and Colour",
      exampleHint: "Example: Look at the bird in the tree. Colour the bird blue.",
      q: "<strong>Listen and colour. (Nghe và tô màu trên tranh nét Cambridge)</strong><br/>Lắng nghe bài audio về bức tranh không màu. Chọn cây bút chì màu thích hợp và bấm vào các chi tiết trên tranh để tô màu theo đúng yêu cầu.",
      img: DEFAULT_CAMBRIDGE_COLORING_SCENE,
      audio: "tts:Look at the picture. Listen and look. There is one example. Can you see the bird in the tree? Yes! Colour the bird in the tree blue. Look, the bird is blue. This is an example. Now you listen and colour. One. Can you see the ball next to the water? Yes, I can. Colour the ball next to the water yellow. Two. Look at the dog next to the bench. It is sleeping. Colour the dog brown. Three. Now find the balloon in the sky. Colour the balloon red. Four. Look at the flower next to the big tree. Colour the flower pink.",
      audioScript: "Man: Look at the picture. Listen and look. There is one example.\nMan: Can you see the bird in the tree?\nGirl: Yes! Can I colour it?\nMan: Colour the bird in the tree blue.\nGirl: Blue? Okay, a blue bird.\nMan: Look, the bird is blue. This is an example. Now you listen and colour.\n\n1. Man: Can you see the ball next to the water?\nGirl: Yes, I can.\nMan: Colour the ball next to the water yellow.\nGirl: Yellow? Okay, the ball next to the water is yellow.\n\n2. Man: Look at the dog next to the bench. It is sleeping.\nGirl: Can you colour the dog brown?\nMan: Yes, colour the dog brown.\n\n3. Man: Now look up. Can you find the balloon in the sky?\nGirl: Yes, a big round balloon!\nMan: Colour the balloon red.\nGirl: Red? I love red!\n\n4. Man: Look at the flower next to the big tree.\nGirl: Can I colour the flower pink?\nMan: Yes, colour the flower pink. What a pretty picture!",
      maxPlayCount: 2,
      type: "listen-colour",
      listenColour: {
        width: 800,
        height: 520,
        exampleNote: "Ví dụ: Con chim trên cây đã được tô màu xanh dương (Blue)",
        items: [
          {
            id: "c1",
            label: "Con chim trên cây (Bird in the tree)",
            targetColor: "blue",
            targetColorName: "Màu xanh dương (Blue)",
            x: 130,
            y: 150,
            w: 70,
            h: 70,
            isExample: true
          },
          {
            id: "c2",
            label: "Quả bóng cạnh hồ nước (Ball next to the water)",
            targetColor: "yellow",
            targetColorName: "Màu vàng (Yellow)",
            x: 490,
            y: 440,
            w: 64,
            h: 64,
            isExample: false
          },
          {
            id: "c3",
            label: "Chú chó cạnh ghế đá (Dog next to the bench)",
            targetColor: "brown",
            targetColorName: "Màu nâu (Brown)",
            x: 395,
            y: 385,
            w: 68,
            h: 64,
            isExample: false
          },
          {
            id: "c4",
            label: "Bóng bay trên bầu trời (Balloon in the sky)",
            targetColor: "red",
            targetColorName: "Màu đỏ (Red)",
            x: 350,
            y: 110,
            w: 64,
            h: 64,
            isExample: false
          },
          {
            id: "c5",
            label: "Bông hoa cạnh gốc cây (Flower next to tree)",
            targetColor: "pink",
            targetColorName: "Màu hồng (Pink)",
            x: 210,
            y: 420,
            w: 60,
            h: 60,
            isExample: false
          }
        ]
      }
    },

    // ==========================================
    // READING AND WRITING - PART 1 (4 questions)
    // "Look and read. Put a tick (✔) or a cross (✘) in the box."
    // ==========================================
    {
      partId: "part-g2-5",
      points: 0.25,
      sectionTitle: "READING AND WRITING - Part 1 (4 questions)",
      exampleHint: "Examples: This is a pizza [✓] | This is a puppy [✗]",
      q: "This is a balloon.",
      img: GRADE2_MEDIA.readBalloon,
      type: "tick-cross",
      isTick: true
    },
    {
      partId: "part-g2-5",
      points: 0.25,
      sectionTitle: "READING AND WRITING - Part 1 (4 questions)",
      exampleHint: "Examples: This is a pizza [✓] | This is a puppy [✗]",
      q: "This is a radio.",
      img: GRADE2_MEDIA.readRadioWave,
      type: "tick-cross",
      isTick: false
    },
    {
      partId: "part-g2-5",
      points: 0.25,
      sectionTitle: "READING AND WRITING - Part 1 (4 questions)",
      exampleHint: "Examples: This is a pizza [✓] | This is a puppy [✗]",
      q: "This is a racket.",
      img: GRADE2_MEDIA.readRacket,
      type: "tick-cross",
      isTick: true
    },
    {
      partId: "part-g2-5",
      points: 0.25,
      sectionTitle: "READING AND WRITING - Part 1 (4 questions)",
      exampleHint: "Examples: This is a pizza [✓] | This is a puppy [✗]",
      q: "This is a waterfall.",
      img: GRADE2_MEDIA.readWaterfall,
      type: "tick-cross",
      isTick: true
    },

    // ==========================================
    // READING AND WRITING - PART 2 (4 questions)
    // "Look and read. Write yes or no."
    // ==========================================
    {
      partId: "part-g2-6",
      points: 0.25,
      sectionTitle: "READING AND WRITING - Part 2 (4 questions)",
      exampleHint: "Examples: A girl is playing the guitar (yes) | The puppy is on the table (no)",
      q: "A boy is flying a kite in the backyard.",
      img: GRADE2_MEDIA.partyBackyard,
      type: "yes-no",
      options: [
        { text: "yes (Đúng)", img: "" },
        { text: "no (Sai)", img: "" }
      ],
      correctIndex: 0
    },
    {
      partId: "part-g2-6",
      points: 0.25,
      sectionTitle: "READING AND WRITING - Part 2 (4 questions)",
      exampleHint: "Examples: A girl is playing the guitar (yes) | The puppy is on the table (no)",
      q: "There is a parrot at the party.",
      img: GRADE2_MEDIA.partyBackyard,
      type: "yes-no",
      options: [
        { text: "yes (Đúng)", img: "" },
        { text: "no (Sai)", img: "" }
      ],
      correctIndex: 1
    },
    {
      partId: "part-g2-6",
      points: 0.25,
      sectionTitle: "READING AND WRITING - Part 2 (4 questions)",
      exampleHint: "Examples: A girl is playing the guitar (yes) | The puppy is on the table (no)",
      q: "A girl is painting a picture.",
      img: GRADE2_MEDIA.partyBackyard,
      type: "yes-no",
      options: [
        { text: "yes (Đúng)", img: "" },
        { text: "no (Sai)", img: "" }
      ],
      correctIndex: 0
    },
    {
      partId: "part-g2-6",
      points: 0.25,
      sectionTitle: "READING AND WRITING - Part 2 (4 questions)",
      exampleHint: "Examples: A girl is playing the guitar (yes) | The puppy is on the table (no)",
      q: "A boy is eating pizza.",
      img: GRADE2_MEDIA.partyBackyard,
      type: "yes-no",
      options: [
        { text: "yes (Đúng)", img: "" },
        { text: "no (Sai)", img: "" }
      ],
      correctIndex: 0
    },

    // ==========================================
    // READING AND WRITING - PART 3 (Example + 4 questions)
    // "Look at the pictures. Look at the letters. Write the words."
    // ==========================================
    {
      partId: "part-g2-7",
      isExample: true,
      points: 0,
      sectionTitle: "READING AND WRITING - Part 3 (Ví dụ mẫu)",
      exampleHint: "Example: [Duck image] Letters: u, d, c, k => 'duck'",
      q: "Look at the picture and letters. Write the word: (Ví dụ: Con vịt)",
      img: GRADE2_MEDIA.exampleDuck,
      type: "unscramble-word",
      unscrambleTarget: "duck",
      answerText: "duck",
      acceptableAnswers: ["duck"],
      unscramble: {
        targetWord: "duck",
        scrambledLetters: ["u", "d", "c", "k"]
      }
    },
    {
      partId: "part-g2-7",
      points: 0.3,
      sectionTitle: "READING AND WRITING - Part 3 (4 questions)",
      exampleHint: "Example: [Duck image] Letters: u, d, c, k => 'duck'",
      q: "Look at the picture and letters. Write the word: (Thung lũng)",
      img: GRADE2_MEDIA.scrambleValley,
      type: "unscramble-word",
      unscrambleTarget: "valley",
      answerText: "valley",
      acceptableAnswers: ["valley"],
      unscramble: {
        targetWord: "valley",
        scrambledLetters: ["l", "l", "e", "a", "v", "y"]
      }
    },
    {
      partId: "part-g2-7",
      points: 0.3,
      sectionTitle: "READING AND WRITING - Part 3 (4 questions)",
      exampleHint: "Example: [Duck image] Letters: u, d, c, k => 'duck'",
      q: "Look at the picture and letters. Write the word: (Bãi biển)",
      img: GRADE2_MEDIA.scrambleBeach,
      type: "unscramble-word",
      unscrambleTarget: "beach",
      answerText: "beach",
      acceptableAnswers: ["beach"],
      unscramble: {
        targetWord: "beach",
        scrambledLetters: ["b", "c", "a", "e", "h"]
      }
    },
    {
      partId: "part-g2-7",
      points: 0.3,
      sectionTitle: "READING AND WRITING - Part 3 (4 questions)",
      exampleHint: "Example: [Duck image] Letters: u, d, c, k => 'duck'",
      q: "Look at the picture and letters. Write the word: (Cây đàn ghi-ta)",
      img: GRADE2_MEDIA.scrambleGuitar,
      type: "unscramble-word",
      unscrambleTarget: "guitar",
      answerText: "guitar",
      acceptableAnswers: ["guitar"],
      unscramble: {
        targetWord: "guitar",
        scrambledLetters: ["i", "u", "g", "t", "r", "a"]
      }
    },
    {
      partId: "part-g2-7",
      points: 0.3,
      sectionTitle: "READING AND WRITING - Part 3 (4 questions)",
      exampleHint: "Example: [Duck image] Letters: u, d, c, k => 'duck'",
      q: "Look at the picture and letters. Write the word: (Hòn đảo)",
      img: GRADE2_MEDIA.scrambleIsland,
      type: "unscramble-word",
      unscrambleTarget: "island",
      answerText: "island",
      acceptableAnswers: ["island"],
      unscramble: {
        targetWord: "island",
        scrambledLetters: ["l", "i", "d", "a", "s", "n"]
      }
    },

    // ==========================================
    // READING AND WRITING - PART 4 (4 questions)
    // "Read the text. Choose a word from the box. Write the correct word next to numbers (1)-(4)."
    // ==========================================
    {
      sectionTitle: "READING AND WRITING - Part 4 (4 questions)",
      exampleHint: "Example: (0) Today is Ben's birthday party.",
      q: "<strong>Part 4: Read the story 'Ben's Party' and choose words from the box.</strong><br/>Đọc đoạn văn, quan sát ngân hàng từ kèm hình ảnh và điền từ thích hợp vào các chỗ trống (1) - (4):",
      img: GRADE2_MEDIA.benPartyBeach,
      type: "story-word-bank",
      storyBank: {
        title: "Ben's Party",
        story: "Today is Ben's (0) birthday party. He is having a party at the beach. Everyone is sitting by the (1) _______. His friends are (2) _______ a song for him. At the party, they eat cake and (3) _______. One boy says “Look! I can see a (4) _______.”",
        example: { index: "0", word: "birthday", img: GRADE2_MEDIA.wordBirthday },
        words: [
          { id: "w1", word: "sea", img: GRADE2_MEDIA.wordSea },
          { id: "w2", word: "birthday", img: GRADE2_MEDIA.wordBirthday },
          { id: "w3", word: "pasta", img: GRADE2_MEDIA.wordPasta },
          { id: "w4", word: "singing", img: GRADE2_MEDIA.wordSinging },
          { id: "w5", word: "dolphin", img: GRADE2_MEDIA.wordDolphin }
        ],
        answers: {
          "0": "birthday",
          "1": "sea",
          "2": "singing",
          "3": "pasta",
          "4": "dolphin"
        },
        answerImages: {
          "0": GRADE2_MEDIA.wordBirthday,
          "1": GRADE2_MEDIA.wordSea,
          "2": GRADE2_MEDIA.wordSinging,
          "3": GRADE2_MEDIA.wordPasta,
          "4": GRADE2_MEDIA.wordDolphin
        }
      }
    }
  ].map((q: any): Question => {
    let partId = "part-g2-1";
    let points = 1.0;
    const title = q.sectionTitle || "";
    if (title.includes("LISTENING - Part 1")) {
      partId = "part-g2-1";
      points = 1.0;
    } else if (title.includes("LISTENING - Part 2")) {
      partId = "part-g2-2";
      points = 0.375;
    } else if (title.includes("LISTENING - Part 3")) {
      partId = "part-g2-3";
      points = 0.375;
    } else if (title.includes("LISTENING - Part 4")) {
      partId = "part-g2-4";
      points = 0.375;
    } else if (title.includes("READING AND WRITING - Part 1")) {
      partId = "part-g2-5";
      points = 0.3;
    } else if (title.includes("READING AND WRITING - Part 2")) {
      partId = "part-g2-6";
      points = 0.3;
    } else if (title.includes("READING AND WRITING - Part 3")) {
      partId = "part-g2-7";
      points = 0.3;
    } else if (title.includes("READING AND WRITING - Part 4")) {
      partId = "part-g2-8";
      points = 0.9;
    }
    return {
      ...q,
      partId: q.partId || partId,
      points: q.points ?? points
    } as Question;
  });
}

