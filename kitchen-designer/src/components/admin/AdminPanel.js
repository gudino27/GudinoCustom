
// --------------------------------------
// import statements
//---------------------------------------

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Image,
  LogOut,
  Lock,
  IdCardLanyard,
  FileText,
  Users,
  Shield,
  BarChart3,
  MessageSquare,
  MessageCircle,
  Receipt,
  DollarSign,
  Languages,
  Clock,
  Instagram,
  Calendar,
  CalendarCheck,
  ChevronDown,
  Briefcase,
  Settings,
  Menu,
  X,
  Eye,
  Bell
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
// -------------------------------------------------
// Importing components for different functionalities
// These components will handle specific admin tasks
//  like price management, photo uploads,
//  employee management, etc
// -------------------------------------------------
import sessionManager from '../utils/sessionManager';
import PriceManagement from './PriceManagement';
import CategoryPhotoManager from './catergoryPhotoManager';
import EmployeeManager from './EmployeeManager';
import DesignViewer from '../design/DesignViewer';
import UserManagement from './UserManagement';
import AnalyticsDashboard from './AnalyticsDashboard';
import TestimonialManager from './TestimonialManager';
import InvoiceManager from './InvoiceManager';
import SmsRoutingManager from './SmsRoutingManager';
import SecurityMonitor from './SecurityMonitor';
import TimeClockManager from './TimeClockManager';
import NotificationsPanel from './NotificationsPanel';
import InstagramManager from './InstagramManager';
import ProjectTimelineManager from './ProjectTimelineManager';
import ScheduleManager from './ScheduleManager';
import ShowroomManager from './ShowroomManager';
import PasswordChangeRequired from './PasswordChangeRequired';
import MainNavBar from '../ui/Navigation';
import '../css/admin.css';
import InvoiceIcon from './invoices/components/InvoiceIcon';
// ----------------------------------------------------
// Admin Panel Component
// This component handles the admin panel functionality
// including login, session management,
// and tab navigation
// It uses session management to maintain
// user authentication and provides access to different
// admin functionalities
// ----------------------------------------------------

const AdminPanel = () => {
  const navigate = useNavigate();

  // Language context
  const { t, currentLanguage, changeLanguage } = useLanguage();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loginCredentials, setLoginCredentials] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState('prices');
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordChangeRequired, setShowPasswordChangeRequired] = useState(false);
  const [usernameForPasswordChange, setUsernameForPasswordChange] = useState('');
  const [openDropdown, setOpenDropdown] = useState(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Base API URL, can be set via environment variable
  // This allows flexibility for different environments (development, production, etc.)
  const API_BASE =  process.env.REACT_APP_API_URL || 'https://api.gudinocustom.com';
  //------------------------------------------------
  // useEffect hook to manage session initialization
  // and authentication
  // Initialize session and check authentication
  // status
  // This effect runs once on component mount to
  // check if the user is already authenticated
  // It also sets up a logout callback to clear
  // session data when the user logs out
  //------------------------------------------------
  useEffect(() => {
    const initAuth = async () => {
      // Try to restore session from cookie
      const session = sessionManager.initSession();

      if (session) {
        // Validate session with backend
        try {
          const response = await fetch(`${API_BASE}/api/auth/me`, {
            headers: {
              'Authorization': `Bearer ${session.token}`
            }
          });

          if (response.ok) {
            const data = await response.json();
            setUser(data.user);
            setToken(session.token);
            setIsAuthenticated(true);
            // Set default tab based on role
            if (data.user.role === 'employee') {
              setActiveTab('timeclock');
            }
          } else {
            sessionManager.clearSession();
          }
        } catch (error) {
          console.error('Session validation error:', error);
        }
      }

      setIsLoading(false);
    };

    // Set logout callback
    sessionManager.setLogoutCallback(() => {
      setIsAuthenticated(false);
      setUser(null);
      setToken(null);
    });

    initAuth();
  }, []);

  // Login handler
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');

    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(loginCredentials)
      });
      const data = await response.json();

      if (response.ok) {
        // Save session to cookie
        sessionManager.saveSession(data.user, data.token);

        setUser(data.user);
        setToken(data.token);
        setIsAuthenticated(true);

        // Set default tab based on role
        if (data.user.role === 'employee') {
          setActiveTab('timeclock');
        }

        // Clear form
        setLoginCredentials({ username: '', password: '' });
      } else if (response.status === 403 && data.mustChangePassword) {
        // Password change required
        setUsernameForPasswordChange(loginCredentials.username);
        setShowPasswordChangeRequired(true);
        setLoginError('');
      } else {
        setLoginError(data.error || 'Invalid credentials');
      }
    } catch (error) {
      console.error('Login error:', error);

      // Fallback for development
      if (loginCredentials.username === 'admin' && loginCredentials.password === 'testing') {
        const mockUser = { username: 'admin', role: 'admin' };
        const mockToken = 'development-token';

        sessionManager.saveSession(mockUser, mockToken);
        setUser(mockUser);
        setToken(mockToken);
        setIsAuthenticated(true);
      } else {
        setLoginError('Failed to connect to server');
      }
    }
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        headers: sessionManager.getAuthHeaders()
      });
    } catch (error) {
      console.error('Logout error:', error);
    }

    sessionManager.clearSession();
    setIsAuthenticated(false);
    setUser(null);
    setToken(null);
  };

  // Password change handlers
  const handlePasswordChanged = (newToken, userData) => {
    // Password changed successfully - log user in
    sessionManager.saveSession(userData, newToken);
    setUser(userData);
    setToken(newToken);
    setIsAuthenticated(true);
    setShowPasswordChangeRequired(false);
    setUsernameForPasswordChange('');
    setLoginCredentials({ username: '', password: '' });

    // Set default tab based on role
    if (userData.role === 'employee') {
      setActiveTab('timeclock');
    }
  };

  const handlePasswordChangeCancel = () => {
    setShowPasswordChangeRequired(false);
    setUsernameForPasswordChange('');
    setLoginCredentials({ username: '', password: '' });
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setResetMessage('');
    setLoginError('');

    if (!forgotPasswordEmail) {
      setLoginError('Please enter your email address');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email: forgotPasswordEmail }),
      });

      const data = await response.json();

      if (response.ok) {
        setResetMessage(data.message);
        setForgotPasswordEmail('');
      } else {
        setLoginError(data.error || 'Failed to send reset email');
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      setLoginError('Failed to send reset email. Please try again.');
    }
  };

  // Keep the unread count on the tab current, wherever the user is
  useEffect(() => {
    if (!token) return undefined;

    const fetchUnread = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/notifications`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) setUnreadCount(data.unreadCount);
      } catch (error) {
        console.error('Error fetching notifications:', error);
      }
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 60000);
    return () => clearInterval(interval);
  }, [token]);

  // Navigation structure with grouped tabs
  const getNavigationGroups = () => {
    const notificationsTab = {
      type: 'single',
      id: 'notifications',
      icon: Bell,
      label: unreadCount > 0
        ? `${t('admin.tabs.notifications')} (${unreadCount})`
        : t('admin.tabs.notifications')
    };

    // Employees only get access to time clock
    if (user?.role === 'employee') {
      return [
        { type: 'single', id: 'timeclock', icon: Clock, label: t('admin.tabs.timeclock') },
        notificationsTab
      ];
    }

    // Base navigation for admins
    const baseNav = [
      { type: 'single', id: 'prices', icon: DollarSign, label: t('admin.tabs.prices') },
      { type: 'single', id: 'photos', icon: Image, label: t('admin.tabs.photos') },
      { type: 'single', id: 'employees', icon: IdCardLanyard, label: t('admin.tabs.employees') },
      { type: 'single', id: 'timeclock', icon: Clock, label: t('admin.tabs.timeclock') },
      notificationsTab,
      { type: 'single', id: 'designs', icon: FileText, label: t('admin.tabs.designs') },
      { type: 'single', id: 'invoices', icon: Receipt, label: t('admin.tabs.invoices') },
      {
        type: 'group',
        id: 'client-tools',
        icon: Briefcase,
        label: t('admin.groups.clientTools'),
        items: [
          { id: 'testimonials', icon: MessageSquare, label: t('admin.tabs.testimonials') },
          { id: 'instagram', icon: Instagram, label: t('admin.tabs.instagram') },
          { id: 'timelines', icon: Calendar, label: t('admin.tabs.timelines') },
          { id: 'appointments', icon: CalendarCheck, label: t('admin.tabs.appointments') },
          { id: 'showroom', icon: Eye, label: t('admin.tabs.showroom') }
        ]
      }
    ];

    // Super admins get additional system tools group
    if (user?.role === 'super_admin') {
      return [
        ...baseNav,
        {
          type: 'group',
          id: 'system-admin',
          icon: Settings,
          label: t('admin.groups.systemAdmin'),
          items: [
            { id: 'users', icon: Users, label: t('admin.tabs.users') },
            { id: 'analytics', icon: BarChart3, label: t('admin.tabs.analytics') },
            { id: 'sms-routing', icon: MessageCircle, label: t('admin.tabs.sms-routing') },
            { id: 'security', icon: Shield, label: t('admin.tabs.security') }
          ]
        }
      ];
    }

    return baseNav;
  };

  // Toggle dropdown menu
  const toggleDropdown = (groupId) => {
    setOpenDropdown(openDropdown === groupId ? null : groupId);
  };

  // Handle tab selection and close dropdown
  const handleTabSelect = (tabId) => {
    setActiveTab(tabId);
    setOpenDropdown(null);
  };

  // Close dropdown when clicking outside (desktop only)
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Only close if clicking outside both desktop nav and mobile sidebar
      if (openDropdown && !event.target.closest('.admin-tab-glass') && !event.target.closest('.mobile-sidebar-nav')) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openDropdown]);

  // Login screen
  if (!isAuthenticated) {
    return (
      <><MainNavBar />
        <div className="min-h-screen bg-gray-100 flex items-center justify-center" style={{ backgroundColor: 'rgb(110, 110, 110)' }}>
          <div className="bg-white p-8 rounded-lg shadow-lg w-96">
            <div className="flex items-center justify-center mb-6">
              <Lock className="text-blue-600" size={48} />
            </div>
            <h2 className="text-2xl font-bold text-center mb-6">
              {showForgotPassword ? 'Reset Password' : 'Admin Login'}
            </h2>

            {!showForgotPassword ? (
              <form onSubmit={handleLogin}>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">{t('admin.username')}</label>
                  <input
                    type="text"
                    name="username"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    value={loginCredentials.username}
                    onChange={(e) => setLoginCredentials({ ...loginCredentials, username: e.target.value })}
                    className="w-full p-3 border rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder={t('admin.enterUsername')}
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">{t('admin.password')}</label>
                  <div className="relative flex items-center">
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      autoComplete="current-password"
                      value={loginCredentials.password}
                      onChange={(e) => setLoginCredentials({ ...loginCredentials, password: e.target.value })}
                      className="w-full p-3 pr-12 border rounded-lg focus:border-blue-500 focus:outline-none"
                      placeholder={t('admin.enterPassword')}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 flex items-center justify-center text-gray-500 hover:text-gray-700 focus:outline-none"
                      style={{ top: '50%', transform: 'translateY(-50%)' }}
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div className="mb-6 text-right">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    {t('admin.forgotPassword')}
                  </button>
                </div>
                {loginError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {loginError}
                  </div>
                )}
                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition"
                >
                  {t('admin.login')}
                </button>
              </form>
            ) : (
              <form onSubmit={handleForgotPassword}>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">{t('admin.emailAddress')}</label>
                  <input
                    type="email"
                    value={forgotPasswordEmail}
                    onChange={(e) => setForgotPasswordEmail(e.target.value)}
                    className="w-full p-3 border rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder={t('admin.enterEmailAddress')}
                    required />
                </div>
                {loginError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {loginError}
                  </div>
                )}
                {resetMessage && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                    {resetMessage}
                  </div>
                )}
                <div className="space-y-3">
                  <button
                    type="submit"
                    className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition"
                  >
                    {t('admin.sendResetLink')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setResetMessage('');
                      setLoginError('');
                      setForgotPasswordEmail('');
                    }}
                    className="w-full bg-gray-500 text-white py-3 rounded-lg hover:bg-gray-600 transition"
                  >
                    {t('admin.backToLogin')}
                  </button>
                </div>
              </form>
            )}

            <p className="text-xs text-gray-500 text-center mt-4">
              {showForgotPassword
                ? t('admin.enterEmail')
                : t('admin.contactAdmin')
              }
            </p>
          </div>

          {/* Password Change Required Modal */}
          {showPasswordChangeRequired && (
            <PasswordChangeRequired
              username={usernameForPasswordChange}
              onPasswordChanged={handlePasswordChanged}
              onCancel={handlePasswordChangeCancel}
            />
          )}
        </div></>
    );
  }


  // -----------------------------
  // Render the admin panel UI
  // This will display the header, navigation tabs, and content area based on the active tab
  // -----------------------------
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Main Navigation Bar */}
      <MainNavBar />
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="px-4 md:px-6 py-5 md:py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-0">
          <h1 className="text-xl md:text-2xl font-bold">{t('admin.title')}</h1>
          <div className="flex flex-wrap items-center gap-2 md:gap-4 w-full md:w-auto justify-between md:justify-end">
            <div className="flex items-center gap-2 order-1 md:order-2">
              <span className="text-sm md:text-medium text-gray-800">{t('admin.welcome')}</span>
              <span className="font-medium text-sm md:text-base">{user?.full_name || user?.username}</span>
              {user?.role === 'super_admin' && (
                <Shield className="text-purple-600" size={16} />
              )}
            </div>
            <div className="flex items-center gap-1 order-2 md:order-3">
              <select
                value={currentLanguage}
                onChange={(e) => changeLanguage(e.target.value)}
                className="p-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition cursor-pointer md:hidden"
                title="Change Language"
              >
                <option value="en">EN</option>
                <option value="es">ES</option>
              </select>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-600 hover:text-gray-900 transition"
                title={t('admin.logout')}
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Hamburger Menu */}
      <div className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">{t(`admin.tabs.${activeTab}`)}</h2>
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="p-2 hover:bg-gray-100 rounded-lg transition"
          aria-label="Open navigation menu"
        >
          <Menu size={24} className="text-gray-700" />
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div
        className={`fixed top-0 left-0 h-full w-72 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-50 md:hidden ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">{t('admin.title')}</h2>
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
            aria-label="Close navigation menu"
          >
            <X size={24} className="text-gray-700" />
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="mobile-sidebar-nav overflow-y-auto h-[calc(100%-5rem)] p-4">
          {getNavigationGroups().map((item) => {
            // Single tab
            if (item.type === 'single') {
              const Icon = item.icon;
              const isInvoice = item.id === 'invoices';
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    handleTabSelect(item.id);
                    setMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition ${
                    activeTab === item.id
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {isInvoice ? (
                    <InvoiceIcon size={20} />
                  ) : (
                    <Icon size={20} />
                  )}
                  <span>{item.label}</span>
                </button>
              );
            }

            // Grouped tabs
            const Icon = item.icon;
            const isOpen = openDropdown === item.id;
            const hasActiveChild = item.items.some(child => child.id === activeTab);

            return (
              <div key={item.id} className="mb-2">
                <button
                  onClick={() => toggleDropdown(item.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition ${
                    hasActiveChild
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {/* Dropdown Items */}
                {isOpen && (
                  <div className="mt-1 ml-4 space-y-1">
                    {item.items.map((child) => {
                      const ChildIcon = child.icon;
                      return (
                        <button
                          key={child.id}
                          onClick={() => {
                            handleTabSelect(child.id);
                            setMobileSidebarOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition ${
                            activeTab === child.id
                              ? 'bg-blue-50 text-blue-700 font-medium'
                              : 'text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <ChildIcon size={18} />
                          <span className="text-sm">{child.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Desktop Navigation Tabs with Glass Effect */}
      <div className="admin-nav-glass hidden md:block">
        <div className="px-4 md:px-6 py-2">
          <nav className="flex flex-wrap gap-1 md:gap-2 justify-start">
            {getNavigationGroups().map((item) => {
              // Single tab (not grouped)
              if (item.type === 'single') {
                const Icon = item.icon;
                const isInvoice = item.id === 'invoices';
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabSelect(item.id)}
                    className={`admin-tab-glass font-medium text-xs md:text-sm transition ${activeTab === item.id
                      ? 'active text-blue-700'
                      : 'text-gray-600 hover:text-gray-800'
                      }`}
                  >
                    <div className="flex items-center gap-1 md:gap-2 tab-content">
                      {isInvoice ? (
                        <InvoiceIcon size={16} className="md:w-[18px] md:h-[18px]" />
                      ) : (
                        <Icon size={16} className="md:w-[18px] md:h-[18px]" />
                      )}
                      <span className="hidden sm:inline">{item.label}</span>
                    </div>
                  </button>
                );
              }

              // Grouped tabs with dropdown
              const Icon = item.icon;
              const isOpen = openDropdown === item.id;
              const hasActiveChild = item.items.some(child => child.id === activeTab);

              return (
                <div key={item.id} className="relative">
                  <button
                    onClick={() => toggleDropdown(item.id)}
                    className={`admin-tab-glass font-medium text-xs md:text-sm transition ${hasActiveChild
                      ? 'active text-blue-700'
                      : 'text-gray-600 hover:text-gray-800'
                      }`}
                  >
                    <div className="flex items-center gap-1 md:gap-2 tab-content">
                      <Icon size={16} className="md:w-[18px] md:h-[18px]" />
                      <span className="hidden sm:inline">{item.label}</span>
                      <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {/* Dropdown Menu */}
                  {isOpen && (
                    <div className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[200px]" style={{ zIndex: 9999 }}>
                      {item.items.map((child) => {
                        const ChildIcon = child.icon;
                        return (
                          <button
                            key={child.id}
                            onClick={() => handleTabSelect(child.id)}
                            className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition ${activeTab === child.id
                              ? 'bg-blue-50 text-blue-700 font-medium'
                              : 'text-gray-700 hover:bg-gray-50'
                              }`}
                          >
                            <ChildIcon size={16} />
                            <span>{child.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1">
        {activeTab === 'prices' && (
          <div className="p-6">
            {/*
             Price Management Tab
             loaded in from a different component
             */}
            <PriceManagement token={token} API_BASE={API_BASE} userRole={user?.role} />
          </div>
        )}

        {/*
         Photo Management Tab
         loaded in from a different component
         */}
        {activeTab === 'photos' && (
          <CategoryPhotoManager token={token} API_BASE={API_BASE} />
        )}
        {/*
         Employee Management Tab
         This component will handle employee data management, including adding, editing, and deleting employees
        */}
        {activeTab === 'employees' && (<EmployeeManager token={token} API_BASE={API_BASE} />)}
        {/*
         Time Clock Tab
         This component will handle employee time tracking
        */}
        {activeTab === 'timeclock' && (<TimeClockManager token={token} API_BASE={API_BASE} user={user} />)}
        {activeTab === 'notifications' && (
          <NotificationsPanel token={token} API_BASE={API_BASE} onUnreadChange={setUnreadCount} t={t} />
        )}
        {/*
         Design Viewer Tab
        */}
        {activeTab === 'designs' && (<DesignViewer token={token} API_BASE={API_BASE} userRole={user?.role} />)}
        {/*
         Invoice Management Tab
        */}
        {activeTab === 'invoices' && (<InvoiceManager token={token} API_BASE={API_BASE} userRole={user?.role} />)}
        {/*
         Testimonial Management Tab
        */}
        {activeTab === 'testimonials' && (<TestimonialManager token={token} API_BASE={API_BASE} userRole={user?.role} />)}
        {/*
         Instagram Feed Management Tab
        */}
        {activeTab === 'instagram' && (<InstagramManager token={token} API_BASE={API_BASE} />)}
        {/*
         Project Timeline Management Tab
        */}
        {activeTab === 'timelines' && (<ProjectTimelineManager />)}
        {/*
         Schedule/Appointments Management Tab
        */}
        {activeTab === 'appointments' && (<ScheduleManager token={token} API_BASE={API_BASE} />)}
        {/*
         Virtual Showroom Management Tab
        */}
        {activeTab === 'showroom' && (<ShowroomManager token={token} API_BASE={API_BASE} />)}
        {/*
         User Management Tab
        */}
        {activeTab === 'users' && user?.role === 'super_admin' && (
          <UserManagement token={token} API_BASE={API_BASE} />
        )}
        {/*
         Analytics Tab
        */}
        {activeTab === 'analytics' && user?.role === 'super_admin' && (
          <AnalyticsDashboard />
        )}
        {/*
         SMS Routing Tab
        */}
        {activeTab === 'sms-routing' && user?.role === 'super_admin' && (
          <SmsRoutingManager token={token} API_BASE={API_BASE} />
        )}
        {/*
         Security Monitor Tab
        */}
        {activeTab === 'security' && user?.role === 'super_admin' && (
          <SecurityMonitor token={token} apiBase={API_BASE} />
        )}

      </div>
    </div>
  );
};

export default AdminPanel;
