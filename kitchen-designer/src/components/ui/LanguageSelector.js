import React, { useId } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

const LanguageSelector = ({ className = '' }) => {
  const { currentLanguage, changeLanguage, availableLanguages, t } = useLanguage();
  const selectId = useId();

  return (
    <div className={`relative ${className}`}>
      {/* The select shows each language's own name, so the label is visually hidden */}
      <label className="sr-only" htmlFor={selectId}>{t('language.select')}</label>
      <select
        id={selectId}
        value={currentLanguage}
        onChange={(e) => changeLanguage(e.target.value)}
        className="language-selector-glass"
        style={{
          background: 'rgba(255, 255, 255, 0.1)',
          border: '2px solid rgba(255, 255, 255, 0.3)',
          borderRadius: '12px',
          padding: window.innerWidth <= 768 ? '8px 12px' : '10px 15px',
          color: 'black',
          fontSize: window.innerWidth <= 768 ? '0.8rem' : '0.9rem',
          fontWeight: '600',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          outline: 'none',
          appearance: 'none',
          WebkitAppearance: 'none',
          MozAppearance: 'none',
          backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: window.innerWidth <= 768 ? 'right 8px center' : 'right 10px center',
          backgroundSize: window.innerWidth <= 768 ? '14px' : '16px',
          paddingRight: window.innerWidth <= 768 ? '30px' : '35px',
          minWidth: window.innerWidth <= 768 ? '100px' : '120px',
          width: className.includes('w-full') ? '100%' : 'auto'
        }}
        onMouseOver={(e) => {
          e.target.style.background = 'rgba(255, 255, 255, 0.2)';
          e.target.style.borderColor = 'rgba(255, 255, 255, 0.5)';
          e.target.style.transform = window.innerWidth <= 768 ? 'translateY(-1px)' : 'translateY(-2px)';
          e.target.style.boxShadow = window.innerWidth <= 768 ? '0 3px 10px rgba(0, 0, 0, 0.3)' : '0 5px 15px rgba(0, 0, 0, 0.3)';
        }}
        onMouseOut={(e) => {
          e.target.style.background = 'rgba(255, 255, 255, 0.1)';
          e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)';
          e.target.style.transform = 'translateY(0)';
          e.target.style.boxShadow = 'none';
        }}
      >
        {availableLanguages.map((lang) => (
          <option
            key={lang.code}
            value={lang.code}
            lang={lang.code}
            style={{
              background: 'white',
              color: 'black',
              padding: '10px'
            }}
          >
            {lang.nativeName}
          </option>
        ))}
      </select>
    </div>
  );
};

export default LanguageSelector;