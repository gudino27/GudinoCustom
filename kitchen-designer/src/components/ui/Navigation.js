import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import LanguageSelector from './LanguageSelector';
import '../css/navigation.css';

const Navigation = () => {
    const location = useLocation();
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
        <nav className="navbar navbar-expand-lg" id="main-nav">
            <Link className={`navbar-brand ${isActive('/') ? 'active' : ''}`} to="/">
                <img src="/O.png" alt="Gudino Custom Woodworking Logo" width="250" height="60" />
            </Link>

            <button
                className="navbar-toggler"
                type="button"
                onClick={handleNavCollapse}
                aria-controls="navbarNav"
                aria-expanded={!isNavCollapsed}
                aria-label="Toggle navigation"
            >
                <span className="navbar-toggler-icon"></span>
            </button>

            <div className={`collapse navbar-collapse ${isNavCollapsed ? '' : 'show'}`} id="navbarNav">
                <div className="navbar-nav ms-auto">
                    <Link className={`nav-link text-white ${isActive('/portfolio') ? 'active' : ''}`} to="/portfolio" onClick={handleNavCollapse}>
                        <p>Portfolio</p>
                    </Link>
                    <Link className={`nav-link text-white ${isActive('/design') ? 'active' : ''}`} to="/design" onClick={handleNavCollapse}>
                        <p>Design</p>
                    </Link>
                    {showroomVisible && (
                        <Link className={`nav-link text-white ${isActive('/showroom') ? 'active' : ''}`} to="/showroom" onClick={handleNavCollapse}>
                            <p>Showroom</p>
                        </Link>
                    )}
                    <Link className={`nav-link text-white ${isActive('/about') ? 'active' : ''}`} to="/about" onClick={handleNavCollapse}>
                        <p>About</p>
                    </Link>
                    <Link className={`nav-link text-white ${isActive('/contact') ? 'active' : ''}`} to="/contact" onClick={handleNavCollapse}>
                        <p>Contact</p>
                    </Link>

                    <div className={`nav-item dropdown ${isActive('/cabinet-care') || isActive('/why-choose-us') || isActive('/book-appointment') || isActive('/hardware-catalog') ? 'active' : ''} ${isDropdownOpen ? 'show' : ''}`} style={{paddingRight:'30px'}}>
                        <button
                            className="nav-link dropdown-toggle text-white mx-3"
                            onClick={toggleDropdown}
                            aria-expanded={isDropdownOpen}
                        >
                            <p style={{ fontWeight:'200'}}>Cabinet 101</p>
                        </button>
                        <ul className={`dropdown-menu ${isDropdownOpen ? 'show' : ''}`}style={{marginLeft:'40px'}}>
                            <li>
                                <Link className="dropdown-item text-left" to="/cabinet-care" onClick={closeDropdown}style={{border:"1px solid #ffffff8a",textAlign:"center"}}>
                                    Cabinet Care
                                </Link>
                            </li>
                            <li>
                                <Link className="dropdown-item text-center" to="/hardware-catalog" onClick={closeDropdown}style={{border:"1px solid #ffffff8a",textAlign:"center"}}>
                                    Hardware Catalog
                                </Link>
                            </li>
                            <li>
                                <Link className="dropdown-item text-center" to="/why-choose-us" onClick={closeDropdown}style={{border:"1px solid #ffffff8a",textAlign:"center"}}>
                                    Why Choose Us
                                </Link>
                            </li>
                            <li>
                                <Link className="dropdown-item text-center" to="/book-appointment" onClick={closeDropdown}style={{border:"1px solid #ffffff8a",textAlign:"center"}}>
                                    Book Appointment
                                </Link>
                            </li>
                        </ul>
                    </div>

                    <Link className={`nav-link text-white ${isActive('/admin') ? 'active' : ''}`} to="/admin" onClick={handleNavCollapse}>
                        <p>Login</p>
                    </Link>
                    <div className="nav-item nav-divider">
                        <LanguageSelector className="nav-language-selector" />
                    </div>
                </div>
            </div>

        </nav >
    );
};

export default Navigation;