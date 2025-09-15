import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import locale files
import enCommon from '../locales/en/common.json';
import esCommon from '../locales/es/common.json';

const resources = {
  en: {
    common: enCommon
  },
  es: {
    common: esCommon
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'es', // Default language
    fallbackLng: 'en', // Fallback language
    debug: process.env.NODE_ENV === 'development',
    
    interpolation: {
      escapeValue: false, // React already does escaping
    },
    
    // Namespace configuration
    defaultNS: 'common',
    ns: ['common'],
    
    // Language detection
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    }
  });

export default i18n;