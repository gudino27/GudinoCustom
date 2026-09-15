// Appointment Cancellation/Reschedule Component
// Allows customers to cancel or reschedule their appointments using a token

import React, { useState, useEffect, useRef, useId } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import Navigation from '../ui/Navigation';
import Footer from '../ui/Footer';
import SEO from '../ui/SEO';
import { announce } from '../ui/LiveRegion';

const API_URL = process.env.REACT_APP_API_URL || 'https://api.gudinocustom.com';

function AppointmentCancel() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { t, currentLanguage } = useLanguage();
  const locale = currentLanguage === 'es' ? 'es-US' : 'en-US';
  const reasonId = useId();

  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [showReasonInput, setShowReasonInput] = useState(false);

  // Focus targets: swapping these views unmounts the button that was pressed
  const reasonRef = useRef(null);
  const cancelButtonRef = useRef(null);
  const cancelledHeadingRef = useRef(null);
  const prevShowReasonRef = useRef(showReasonInput);
  const cancelledHereRef = useRef(false);

  // Fetch appointment details
  useEffect(() => {
    fetchAppointment();
  }, [token]);

  // Opening or closing the reason form swaps the content: keep focus with it
  useEffect(() => {
    if (prevShowReasonRef.current === showReasonInput) return;
    prevShowReasonRef.current = showReasonInput;
    (showReasonInput ? reasonRef : cancelButtonRef).current?.focus();
  }, [showReasonInput]);

  // Only move focus when the cancellation happened here, not when the link was already used
  useEffect(() => {
    if (cancelled && cancelledHereRef.current) {
      cancelledHeadingRef.current?.focus();
    }
  }, [cancelled]);

  const fetchAppointment = async () => {
    try {
      const response = await fetch(`${API_URL}/api/appointments/by-token/${token}`);
      if (response.ok) {
        const data = await response.json();
        setAppointment(data);

        // Check if already cancelled
        if (data.status === 'cancelled') {
          setCancelled(true);
        }
      } else if (response.status === 404) {
        setError(t('appointments.notFound'));
      } else {
        setError(t('appointments.errorLoading'));
      }
    } catch (err) {
      console.error('Error fetching appointment:', err);
      setError(t('appointments.errorLoading'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    announce(t('appointments.cancelling'));
    try {
      const response = await fetch(`${API_URL}/api/appointments/cancel/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancellationReason })
      });

      if (response.ok) {
        cancelledHereRef.current = true;
        setCancelled(true);
      } else {
        const data = await response.json();
        setError(data.error || t('appointments.cancelFailed'));
      }
    } catch (err) {
      console.error('Cancel error:', err);
      setError(t('appointments.cancelFailed'));
    } finally {
      setCancelling(false);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(locale, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString(locale, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <SEO title={t('appointments.manageAppointment')} />
        <Navigation />
        <main id="main-content" tabIndex={-1} className="pt-24 pb-16 px-4">
          <div className="max-w-lg mx-auto text-center" role="status">
            <h1 className="sr-only">{t('appointments.manageAppointment')}</h1>
            <div className="animate-spin h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" aria-hidden="true"></div>
            <p className="mt-4 text-gray-600">{t('appointments.loading')}</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Error state
  if (error && !appointment) {
    return (
      <div className="min-h-screen bg-gray-50">
        <SEO title={t('appointments.manageAppointment')} />
        <Navigation />
        <main id="main-content" tabIndex={-1} className="pt-24 pb-16 px-4">
          <div className="max-w-lg mx-auto text-center">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4" aria-hidden="true">
              <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" focusable="false">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('appointments.error')}</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              {t('appointments.backToHome')}
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Already cancelled state
  if (cancelled) {
    return (
      <div className="min-h-screen bg-gray-50">
        <SEO title={t('appointments.appointmentCancelled')} />
        <Navigation />
        <main id="main-content" tabIndex={-1} className="pt-24 pb-16 px-4">
          <div className="max-w-lg mx-auto text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4" aria-hidden="true">
              <svg className="w-10 h-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" focusable="false">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 ref={cancelledHeadingRef} tabIndex={-1} className="text-2xl font-bold text-gray-900 mb-2 focus:outline-none">
              {t('appointments.appointmentCancelled')}
            </h1>
            <p className="text-gray-600 mb-6">
              {t('appointments.cancelledMessage')}
            </p>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => navigate('/book-appointment')}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                {t('appointments.bookNew')}
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="w-full px-6 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                {t('appointments.backToHome')}
              </button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO title={t('appointments.manageAppointment')} />
      <Navigation />

      <main id="main-content" tabIndex={-1} className="pt-24 pb-16 px-4">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
              {t('appointments.manageAppointment')}
            </h1>
          </div>

          {/* Appointment details card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="font-semibold text-gray-900 mb-4">{t('appointments.details')}</h2>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0" aria-hidden="true">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" focusable="false">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t('appointments.dateTime')}</p>
                  <p className="font-medium text-gray-900">
                    {formatDate(appointment.appointment_date)}
                  </p>
                  <p className="text-gray-700">{formatTime(appointment.appointment_date)}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0" aria-hidden="true">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" focusable="false">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t('appointments.type')}</p>
                  <p className="font-medium text-gray-900">
                    {t(`appointments.type.${appointment.appointment_type}`)}
                  </p>
                  <p className="text-gray-700">
                    {appointment.duration} {t('appointments.minutes')}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0" aria-hidden="true">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" focusable="false">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t('appointments.name')}</p>
                  <p className="font-medium text-gray-900">{appointment.client_name}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">{t('appointments.actions')}</h2>

            {error && (
              <div role="alert" className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 mb-4">
                {error}
              </div>
            )}

            {showReasonInput ? (
              <div className="space-y-4">
                <div>
                  <label htmlFor={reasonId} className="block text-sm font-medium text-gray-700 mb-1">
                    {t('appointments.cancelReason')}
                  </label>
                  <textarea
                    id={reasonId}
                    ref={reasonRef}
                    value={cancellationReason}
                    onChange={(e) => setCancellationReason(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-500 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder={t('appointments.cancelReasonPlaceholder')}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowReasonInput(false)}
                    className="flex-1 px-4 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  >
                    {t('appointments.back')}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={cancelling}
                    className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors
                      ${cancelling
                        ? 'bg-gray-400 text-white cursor-not-allowed'
                        : 'bg-red-600 text-white hover:bg-red-700'
                      }`}
                  >
                    {cancelling ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" aria-hidden="true"></span>
                        {t('appointments.cancelling')}
                      </span>
                    ) : (
                      t('appointments.confirmCancel')
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => navigate('/book-appointment', {
                    // Carry over what this page already knows, so it isn't asked again (WCAG 3.3.7)
                    state: { reschedule: { name: appointment.client_name, type: appointment.appointment_type } }
                  })}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {t('appointments.reschedule')}
                </button>

                <button
                  type="button"
                  ref={cancelButtonRef}
                  onClick={() => setShowReasonInput(true)}
                  className="w-full px-4 py-3 bg-white text-red-600 border border-red-300 rounded-lg font-medium hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  {t('appointments.cancelAppointment')}
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default AppointmentCancel;
