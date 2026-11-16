import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';
import { hasVietnameseChars, translateViToEn } from '../utils/i18nEngine';

export type UILanguage = 'en' | 'vi';

const STORAGE_KEY = 'ismart_ui_lang';

interface LanguageContextValue {
  lang: UILanguage;
  setLang: (next: UILanguage) => void;
  toggleLang: () => void;
  t: (viText: string, enText?: string) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'en',
  setLang: () => {},
  toggleLang: () => {},
  t: (viText, enText) => enText || translateViToEn(viText),
});

const sourceTextMap = new WeakMap<Text, string>();
const writtenEnMap = new WeakMap<Text, string>();

const TRANSLATED_ATTRS = ['placeholder', 'title', 'aria-label'] as const;
const sourceAttrMap = new WeakMap<Element, Record<string, string>>();
const writtenAttrMap = new WeakMap<Element, Record<string, string>>();

function isPreservedNode(node: Node | null): boolean {
  let cur: Node | null = node;
  while (cur) {
    if (cur.nodeType === Node.ELEMENT_NODE) {
      const el = cur as Element;
      const tag = el.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'PRE' || tag === 'NOSCRIPT') {
        return true;
      }
      if (el.getAttribute('data-preserve-content') === 'true') {
        return true;
      }
    }
    cur = cur.parentNode;
  }
  return false;
}

function processTextNode(node: Text, lang: UILanguage, observerPauseRef: { paused: boolean }) {
  if (node.parentElement?.tagName === 'TEXTAREA') {
    return;
  }
  if (isPreservedNode(node)) {
    const saved = sourceTextMap.get(node);
    if (saved !== undefined && node.nodeValue !== saved) {
      observerPauseRef.paused = true;
      node.nodeValue = saved;
      writtenEnMap.delete(node);
      observerPauseRef.paused = false;
    }
    return;
  }

  const currentVal = node.nodeValue ?? '';
  if (!currentVal.trim()) return;

  const lastWritten = writtenEnMap.get(node);
  let sourceVal = sourceTextMap.get(node);

  // If React updated the text node content (or we haven't seen it yet), capture fresh source
  if (sourceVal === undefined || (lastWritten !== undefined && currentVal !== lastWritten && currentVal !== sourceVal)) {
    sourceVal = currentVal;
    sourceTextMap.set(node, sourceVal);
  }

  if (lang === 'en') {
    if (!hasVietnameseChars(sourceVal)) return;
    const translated = translateViToEn(sourceVal);
    if (translated !== currentVal) {
      observerPauseRef.paused = true;
      writtenEnMap.set(node, translated);
      node.nodeValue = translated;
      observerPauseRef.paused = false;
    } else {
      writtenEnMap.set(node, translated);
    }
  } else {
    // Restore original Vietnamese source
    if (sourceVal !== undefined && currentVal !== sourceVal) {
      observerPauseRef.paused = true;
      node.nodeValue = sourceVal;
      writtenEnMap.delete(node);
      observerPauseRef.paused = false;
    }
  }
}

function processElementAttributes(el: Element, lang: UILanguage, observerPauseRef: { paused: boolean }) {
  const tag = el.tagName;
  if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'PRE' || tag === 'NOSCRIPT') return;

  const preserved = isPreservedNode(el);
  let savedAttrs = sourceAttrMap.get(el);
  let writtenAttrs = writtenAttrMap.get(el);

  for (const attr of TRANSLATED_ATTRS) {
    const currentAttr = el.getAttribute(attr);
    if (currentAttr === null) continue;

    if (preserved) {
      if (savedAttrs && savedAttrs[attr] !== undefined && currentAttr !== savedAttrs[attr]) {
        observerPauseRef.paused = true;
        el.setAttribute(attr, savedAttrs[attr]);
        if (writtenAttrs) delete writtenAttrs[attr];
        observerPauseRef.paused = false;
      }
      continue;
    }

    const lastWritten = writtenAttrs?.[attr];
    let sourceAttr = savedAttrs?.[attr];

    if (sourceAttr === undefined || (lastWritten !== undefined && currentAttr !== lastWritten && currentAttr !== sourceAttr)) {
      if (!savedAttrs) {
        savedAttrs = {};
        sourceAttrMap.set(el, savedAttrs);
      }
      savedAttrs[attr] = currentAttr;
      sourceAttr = currentAttr;
    }

    if (lang === 'en') {
      if (!hasVietnameseChars(sourceAttr)) continue;
      const translated = translateViToEn(sourceAttr);
      if (!writtenAttrs) {
        writtenAttrs = {};
        writtenAttrMap.set(el, writtenAttrs);
      }
      writtenAttrs[attr] = translated;
      if (translated !== currentAttr) {
        observerPauseRef.paused = true;
        el.setAttribute(attr, translated);
        observerPauseRef.paused = false;
      }
    } else {
      if (sourceAttr !== undefined && currentAttr !== sourceAttr) {
        observerPauseRef.paused = true;
        el.setAttribute(attr, sourceAttr);
        if (writtenAttrs) delete writtenAttrs[attr];
        observerPauseRef.paused = false;
      }
    }
  }
}

function walkAndTranslate(root: Node, lang: UILanguage, observerPauseRef: { paused: boolean }) {
  if (root.nodeType === Node.TEXT_NODE) {
    processTextNode(root as Text, lang, observerPauseRef);
    return;
  }

  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) {
    return;
  }

  if (root.nodeType === Node.ELEMENT_NODE) {
    processElementAttributes(root as Element, lang, observerPauseRef);
  }

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    null
  );

  let current = walker.nextNode();
  while (current) {
    if (current.nodeType === Node.TEXT_NODE) {
      processTextNode(current as Text, lang, observerPauseRef);
    } else if (current.nodeType === Node.ELEMENT_NODE) {
      processElementAttributes(current as Element, lang, observerPauseRef);
    }
    current = walker.nextNode();
  }
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<UILanguage>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'vi') return 'vi';
    } catch {
      // ignore storage errors
    }
    return 'en';
  });

  const setLang = useCallback((next: UILanguage) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore storage errors
    }
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === 'en' ? 'vi' : 'en');
  }, [lang, setLang]);

  const t = useCallback(
    (viText: string, enText?: string) => {
      if (lang === 'vi') return viText;
      return enText || translateViToEn(viText);
    },
    [lang]
  );

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useLayoutEffect(() => {
    const root = document.getElementById('root') || document.body;
    if (!root) return;

    const pauseRef = { paused: false };
    walkAndTranslate(root, lang, pauseRef);

    let rafId: number | null = null;
    const pendingNodes = new Set<Node>();

    const flushPending = () => {
      rafId = null;
      if (pendingNodes.size === 0) return;
      const batch = Array.from(pendingNodes);
      pendingNodes.clear();
      for (const n of batch) {
        if (n.isConnected) {
          walkAndTranslate(n, lang, pauseRef);
        }
      }
    };

    const observer = new MutationObserver((mutations) => {
      if (pauseRef.paused) return;

      for (const m of mutations) {
        if (m.type === 'characterData') {
          if (m.target.nodeType === Node.TEXT_NODE) {
            processTextNode(m.target as Text, lang, pauseRef);
          }
        } else if (m.type === 'attributes') {
          if (m.target.nodeType === Node.ELEMENT_NODE) {
            processElementAttributes(m.target as Element, lang, pauseRef);
            if (m.attributeName === 'data-preserve-content') {
              walkAndTranslate(m.target, lang, pauseRef);
            }
          }
        } else if (m.type === 'childList') {
          for (let i = 0; i < m.addedNodes.length; i++) {
            const added = m.addedNodes[i];
            if (added.isConnected) {
              walkAndTranslate(added, lang, pauseRef);
              pendingNodes.add(added);
            }
          }
        }
      }

      if (pendingNodes.size > 0 && rafId === null) {
        rafId = window.requestAnimationFrame(flushPending);
      }
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'title', 'aria-label', 'data-preserve-content'],
    });

    return () => {
      observer.disconnect();
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage() {
  return useContext(LanguageContext);
}
