import React from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  
  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };
  
  return (
    <div style={{ position: 'fixed', top: '10px', right: '10px', zIndex: 1000 }}>
      <button 
        onClick={() => changeLanguage('en')}
        style={{ 
          margin: '0 5px', 
          padding: '5px 10px',
          backgroundColor: i18n.language === 'en' ? '#007bff' : '#f8f9fa',
          color: i18n.language === 'en' ? 'white' : 'black',
          border: '1px solid #ccc',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        EN
      </button>
      <button 
        onClick={() => changeLanguage('he')}
        style={{ 
          margin: '0 5px', 
          padding: '5px 10px',
          backgroundColor: i18n.language === 'he' ? '#007bff' : '#f8f9fa',
          color: i18n.language === 'he' ? 'white' : 'black',
          border: '1px solid #ccc',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        עבר
      </button>
    </div>
  );
};

export default LanguageSwitcher;
