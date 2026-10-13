import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { findPublicRoute, localizePath, splitLanguagePath } from '../../seo/site';

// Keeps the address and the site language in step on public pages, so the
// language a page is shown in always matches its URL (and its hreflang):
//  - /es/... is Spanish: a Spanish search result or shared link opens in Spanish
//  - a public page without the prefix, opened by a visitor whose saved choice
//    is Spanish, moves to its /es/ address (replace: no extra history entry)
// Admin, token and settings pages have no language in the URL and keep
// following the saved choice, as before.
// Runs on address changes only; LanguageSelector navigates when the visitor
// picks a language, so a manual choice is never undone here.
export default function UrlLanguageSync() {
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  const { currentLanguage, changeLanguage } = useLanguage();

  const latest = useRef({});
  latest.current = { currentLanguage, changeLanguage, navigate, search, hash };

  useEffect(() => {
    const { lang, basePath } = splitLanguagePath(pathname);
    if (!findPublicRoute(basePath)) return;
    const current = latest.current;

    if (lang === 'es') {
      if (current.currentLanguage !== 'es') current.changeLanguage('es');
    } else if (current.currentLanguage === 'es') {
      current.navigate(localizePath(pathname, 'es') + current.search + current.hash, { replace: true });
    }
  }, [pathname]);

  return null;
}
