import React, { createContext, useContext, useState, useEffect } from 'react';
import translations from '../utils/translations';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  // Try to get saved language from localStorage, default to browser language or English
  const getInitialLanguage = () => {
    const saved = localStorage.getItem('kitchen-designer-language');
    if (saved && (saved === 'en' || saved === 'es')) {
      return saved;
    }

    // Detect browser language
    const browserLang = navigator.language.toLowerCase();
    if (browserLang.startsWith('es')) {
      return 'es';
    }
    return 'en';
  };

  const [currentLanguage, setCurrentLanguage] = useState(getInitialLanguage);

  // Save language preference to localStorage, and keep <html lang> in step so
  // screen readers switch pronunciation with the content (WCAG 3.1.1)
  useEffect(() => {
    localStorage.setItem('kitchen-designer-language', currentLanguage);
    document.documentElement.setAttribute('lang', currentLanguage);
  }, [currentLanguage]);

  // Translation function with simple interpolation support
  // Usage:
  //   t('some.key') -> returns translation or key
  //   t('some.key', 'fallback') -> returns translation or fallback string
  //   t('some.key', { name: 'John' }) -> returns translation with {name} replaced
  const t = (key, fallback) => {
    const translation = translations[currentLanguage]?.[key];

    // Decide base string: prefer translation, then if fallback is a string use it, otherwise default to key
    const base = (translation !== undefined && translation !== null)
      ? translation
      : (typeof fallback === 'string' ? fallback : key);

    // If fallback is an object (interpolation values) and we have a base string, perform simple replacement
    if (base && fallback && typeof fallback === 'object' && !Array.isArray(fallback)) {
      return String(base).replace(/\{([a-zA-Z0-9_]+)\}/g, (m, p1) => {
        const v = fallback[p1];
        return v === undefined || v === null ? m : String(v);
      });
    }

    return base;
  };

  // Change language function
  const changeLanguage = (lang) => {
    if (lang === 'en' || lang === 'es') {
      setCurrentLanguage(lang);
    }
  };

  const value = {
    currentLanguage,
    // Alias: several components destructure `language`
    language: currentLanguage,
    changeLanguage,
    t,
    // nativeName is each language's own name, shown with a matching lang attribute
    availableLanguages: [
      { code: 'en', name: 'English', nativeName: 'English' },
      { code: 'es', name: 'Spanish', nativeName: 'Español' }
    ]
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export default LanguageContext;