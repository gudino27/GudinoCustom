import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import LanguageSelector from './LanguageSelector';
import { useLanguage } from '../../contexts/LanguageContext';
import '../css/navigation.css';

const Navigation = () => {
    const location = useLocation();
    const { t } = useLanguage();
    const [isNavCollapsed, setIsNavCollapsed] = useState(true);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [showroomVisible, setShowroomVisible] = useState(false);

    const API_URL = process.env.REACT_APP_API_URL || 'https://api.gudinocustom.com';

    // Fetch showroom visibility setting (with optimized polling)
    useEffect(() => {
        const fetchShowroomSettings = async () => {
            // Don't fetch if page is hidden (mobile battery optimization)
            if (document.hidden) return;

            try {
                const response = await fetch(`${API_URL}/api/showroom/public/settings`);
                if (response.ok) {
                    const settings = await response.json();
                    setShowroomVisible(settings?.showroom_visible === 1 || settings?.showroom_visible === true);
                }
            } catch (error) {
                // Silently fail - showroom stays hidden if settings can't be fetched
            }
        };

        // Fetch immediately on mount
        fetchShowroomSettings();

        // Poll every 5 minutes instead of 60 seconds (reduces mobile load)
        const interval = setInterval(() => {
            if (!document.hidden) {
                fetchShowroomSettings();
            }
        }, 300000); // 5 minutes

        // Also check when page becomes visible
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                fetchShowroomSettings();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [API_URL]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (isDropdownOpen && !event.target.closest('.dropdown')) {
                setIsDropdownOpen(false);
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [isDropdownOpen]);

    // Helper function to determine if a link is active
    const isActive = (path) => {
        if (path === '/' && location.pathname === '/') return true;
        if (path !== '/' && location.pathname.includes(path)) return true;
        return false;
    };

    // aria-current tells screen readers which link is the page they are on
    const currentPage = (path) => (isActive(path) ? 'page' : undefined);

    const handleNavCollapse = () => setIsNavCollapsed(!isNavCollapsed);

    const toggleDropdown = () => setIsDropdownOpen(!isDropdownOpen);

    const closeDropdown = () => {
        setIsDropdownOpen(false);
        // On mobile, also collapse the main nav
        if (window.innerWidth < 992) {
            handleNavCollapse();
        }
    };

    return (
        <>
        {/* First focusable element on every page, so keyboard users can jump the nav */}
        <a className="skip-link" href="#main-content">{t('a11y.skipToContent')}</a>
        <nav className="navbar navbar-expand-lg" id="main-nav" aria-label={t('nav.primary')}>
            <Link className={`navbar-brand ${isActive('/') ? 'active' : ''}`} to="/" aria-current={currentPage('/')}>
                <img src="/O.png" alt={t('nav.home')} width="250" height="60" />
            </Link>

            <button
                className="navbar-toggler"
                type="button"
                onClick={handleNavCollapse}
                aria-controls="navbarNav"
                aria-expanded={!isNavCollapsed}
                aria-label={t('nav.menu')}
            >
                <span className="navbar-toggler-icon"></span>
            </button>

            <div className={`collapse navbar-collapse ${isNavCollapsed ? '' : 'show'}`} id="navbarNav">
                <div className="navbar-nav ms-auto">
                    <Link className={`nav-link text-white ${isActive('/portfolio') ? 'active' : ''}`} to="/portfolio" onClick={handleNavCollapse} aria-current={currentPage('/portfolio')}>
                        <p>{t('nav.portfolio')}</p>
                    </Link>
                    <Link className={`nav-link text-white ${isActive('/design') ? 'active' : ''}`} to="/design" onClick={handleNavCollapse} aria-current={currentPage('/design')}>
                        <p>{t('nav.design')}</p>
                    </Link>
                    {showroomVisible && (
                        <Link className={`nav-link text-white ${isActive('/showroom') ? 'active' : ''}`} to="/showroom" onClick={handleNavCollapse} aria-current={currentPage('/showroom')}>
                            <p>{t('nav.showroom')}</p>
                        </Link>
                    )}
                    <Link className={`nav-link text-white ${isActive('/about') ? 'active' : ''}`} to="/about" onClick={handleNavCollapse} aria-current={currentPage('/about')}>
                        <p>{t('nav.about')}</p>
                    </Link>
                    <Link className={`nav-link text-white ${isActive('/contact') ? 'active' : ''}`} to="/contact" onClick={handleNavCollapse} aria-current={currentPage('/contact')}>
                        <p>{t('nav.contact')}</p>
                    </Link>

                    <div className={`nav-item dropdown ${isActive('/cabinet-care') || isActive('/why-choose-us') || isActive('/book-appointment') || isActive('/hardware-catalog') ? 'active' : ''} ${isDropdownOpen ? 'show' : ''}`} style={{paddingRight:'30px'}}>
                        <button
                            className="nav-link dropdown-toggle text-white mx-3"
                            type="button"
                            onClick={toggleDropdown}
                            aria-expanded={isDropdownOpen}
                            aria-controls="cabinet101-menu"
                        >
                            {/* a <p> is not valid inside a <button> */}
                            <span className="nav-toggle-label" style={{ fontWeight:'200'}}>{t('nav.cabinet101')}</span>
                        </button>
                        <ul className={`dropdown-menu ${isDropdownOpen ? 'show' : ''}`} id="cabinet101-menu" style={{marginLeft:'40px'}}>
                            <li>
                                <Link className="dropdown-item text-left" to="/cabinet-care" onClick={closeDropdown} aria-current={currentPage('/cabinet-care')} style={{border:"1px solid #ffffff8a",textAlign:"center"}}>
                                    {t('footer.cabinetCare')}
                                </Link>
                            </li>
                            <li>
                                <Link className="dropdown-item text-center" to="/hardware-catalog" onClick={closeDropdown} aria-current={currentPage('/hardware-catalog')} style={{border:"1px solid #ffffff8a",textAlign:"center"}}>
                                    {t('nav.hardwareCatalog')}
                                </Link>
                            </li>
                            <li>
                                <Link className="dropdown-item text-center" to="/why-choose-us" onClick={closeDropdown} aria-current={currentPage('/why-choose-us')} style={{border:"1px solid #ffffff8a",textAlign:"center"}}>
                                    {t('nav.whyChooseUs')}
                                </Link>
                            </li>
                            <li>
                                <Link className="dropdown-item text-center" to="/book-appointment" onClick={closeDropdown} aria-current={currentPage('/book-appointment')} style={{border:"1px solid #ffffff8a",textAlign:"center"}}>
                                    {t('nav.bookAppointment')}
                                </Link>
                            </li>
                        </ul>
                    </div>

                    <Link className={`nav-link text-white ${isActive('/admin') ? 'active' : ''}`} to="/admin" onClick={handleNavCollapse} aria-current={currentPage('/admin')}>
                        <p>{t('nav.login')}</p>
                    </Link>
                    <div className="nav-item nav-divider">
                        <LanguageSelector className="nav-language-selector" />
                    </div>
                </div>
            </div>

        </nav >
        </>
    );
};

export default Navigation;