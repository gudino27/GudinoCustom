import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { MessageSquare, ArrowRight } from 'lucide-react';

const DesignerOrContactChoice = ({ className = '', onQuickQuoteClick }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const handleQuickQuoteClick = () => {
    if (onQuickQuoteClick) return onQuickQuoteClick();
    navigate('/quick-quote');
  };

  const features = [
    t('choice.quickQuote.feature1'),
    t('choice.quickQuote.feature2'),
    t('choice.quickQuote.feature3'),
    t('choice.quickQuote.feature4'),
  ];

  return (
    <div className={`relative bg-white rounded-2xl shadow-lg border-2 border-gray-200 hover:border-gray-300 transition-all duration-300 overflow-hidden group flex flex-col ${className}`}>
      <div className="absolute top-4 right-4 bg-green-700 text-white text-xs font-bold px-3 py-1 rounded-full">
        {t('choice.quickQuote.badge')}
      </div>

      <div className="p-8 flex-1 flex flex-col">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-green-100 rounded-lg">
            <MessageSquare className="text-green-700" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">{t('choice.quickQuote.title')}</h2>
        </div>

        <p className="text-gray-700 mb-6">{t('choice.quickQuote.description')}</p>

        <ul className="space-y-3 mb-8 flex-1">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start gap-2">
              <svg aria-hidden="true" focusable="false" className="w-5 h-5 text-green-700 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-gray-700">{feature}</span>
            </li>
          ))}
        </ul>

        <button type="button" onClick={handleQuickQuoteClick} className="w-full bg-green-700 hover:bg-green-800 text-white font-semibold py-4 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 group-hover:shadow-lg">
          {t('choice.quickQuote.button')}
          <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      <div className="p-4 text-center text-sm text-gray-700 border-t border-gray-100">
        <p>{t('choice.unsure')}</p>
      </div>
    </div>
  );
};

export default DesignerOrContactChoice;
