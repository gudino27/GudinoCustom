import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Receipt, Download, CheckCircle, AlertCircle, ArrowLeft, Globe } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import SEO from '../ui/SEO';

const API_BASE = process.env.REACT_APP_API_URL || 'https://api.gudinocustom.com';

const ReceiptViewer = () => {
  const { token, paymentId } = useParams();
  const navigate = useNavigate();
  // The receipt used to keep its own EN/ES table and toggle; it now uses the site language
  const { t, currentLanguage, changeLanguage } = useLanguage();
  const locale = currentLanguage === 'es' ? 'es-ES' : 'en-US';
  const otherLanguage = currentLanguage === 'es' ? 'en' : 'es';
  const [receiptData, setReceiptData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchReceiptData();
  }, [token, paymentId]);

  const fetchReceiptData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE}/invoice/${token}/payment/${paymentId}`);

      if (!response.ok) {
        // Errors are kept as translation keys so they follow the language switch
        setError('receipt.errorNotFound');
        return;
      }

      const data = await response.json();
      setReceiptData(data);
    } catch (err) {
      console.error('Error fetching receipt:', err);
      setError('receipt.errorLoad');
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async (lang = 'en') => {
    try {
      const response = await fetch(`${API_BASE}/invoice/${token}/payment/${paymentId}/pdf?lang=${lang}`);

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${paymentId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error downloading PDF:', err);
      alert(t('receipt.downloadFailed'));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <SEO title={t('receipt.pageTitle')} />
        <main id="main-content" tabIndex={-1} className="text-center">
          <h1 className="sr-only">{t('receipt.pageTitle')}</h1>
          <div role="status">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" aria-hidden="true"></div>
            <p className="text-gray-600">{t('receipt.loading')}</p>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <SEO title={t('receipt.notFound')} />
        <main id="main-content" tabIndex={-1} className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
          <AlertCircle className="text-red-500 mx-auto mb-4" size={48} aria-hidden="true" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">{t('receipt.notFound')}</h1>
          <p className="text-gray-600 mb-6">{t(error)}</p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            style={{ minHeight: '44px' }}
          >
            {t('receipt.goHome')}
          </button>
        </main>
      </div>
    );
  }

  if (!receiptData) return null;

  const { payment, invoice, totals } = receiptData;
  const isPaidInFull = totals.is_paid_in_full;

  return (
    <div className="min-h-screen py-4 px-2" style={{ backgroundColor: 'rgba(110, 110, 110, 1)' }}>
      <SEO title={t('receipt.pageTitle')} />
      <main id="main-content" tabIndex={-1} className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-2">
          <div className="bg-gradient-to-r from-gray-600 to-gray-800 px-6 py-8 text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Receipt size={32} aria-hidden="true" />
                <h1 className="text-2xl font-bold">{t('receipt.pageTitle')}</h1>
              </div>
              <div className="flex items-center gap-3">
                {/* Language Toggle: label and tooltip are in the language being offered */}
                <button
                  type="button"
                  onClick={() => changeLanguage(otherLanguage)}
                  className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                  style={{ minHeight: '44px', minWidth: '44px' }}
                  lang={otherLanguage}
                  title={t('receipt.switchLanguage')}
                >
                  <Globe size={20} aria-hidden="true" />
                  <span className="text-sm font-medium">{otherLanguage.toUpperCase()}</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/invoice/${token}`)}
                  className="flex items-center gap-2 text-white hover:text-blue-100"
                  style={{ minHeight: '44px' }}
                  aria-label={t('receipt.viewInvoice')}
                >
                  <ArrowLeft size={20} aria-hidden="true" />
                  <span className="hidden sm:inline">{t('receipt.viewInvoice')}</span>
                </button>
              </div>
            </div>
            <p className="text-blue-100">Gudino Custom Woodworking</p>
          </div>

          {/* Payment Status Banner */}
          <div className={`px-6 py-1 ${isPaidInFull ? 'bg-green-50' : 'bg-yellow-50'}`}>
            <div className="flex items-center gap-3">
              <CheckCircle className={isPaidInFull ? 'text-green-600' : 'text-yellow-600'} size={24} aria-hidden="true" />
              <div>
                <p className={`font-semibold ${isPaidInFull ? 'text-green-900' : 'text-yellow-900'}`}>
                  {isPaidInFull ? t('receipt.paidInFull') : t('receipt.partialPayment')}
                </p>
                {!isPaidInFull && (
                  <p className="text-sm text-yellow-700">
                    {t('receipt.remainingBalance')}: ${totals.remaining_balance}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Payment Amount */}
          <div className="px-6 py-6 text-center border-b">
            <p className="text-gray-600 mb-2">{t('receipt.amountPaid')}</p>
            <p className="text-5xl font-bold text-black-600">${parseFloat(payment.amount).toFixed(2)}</p>
          </div>

          {/* Payment Details */}
          <div className="px-6 py-7 space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('receipt.paymentDetails')}</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">{t('receipt.invoiceNumberLabel')}</p>
                <p className="font-medium text-gray-900">#{invoice.invoice_number.split('-').pop()}</p>
              </div>

              <div>
                <p className="text-sm text-gray-600">{t('receipt.paymentDate')}</p>
                <p className="font-medium text-gray-900">
                  {new Date(payment.date).toLocaleDateString(locale, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600">{t('receipt.paymentMethod')}</p>
                <p className="font-medium text-gray-900 capitalize">
                  {t(`invoice.method.${payment.method}`, String(payment.method || '').replace('_', ' '))}
                </p>
              </div>

              {payment.check_number && (
                <div>
                  <p className="text-sm text-gray-600">{t('receipt.checkNumber')}</p>
                  <p className="font-medium text-gray-900">{payment.check_number}</p>
                </div>
              )}

              <div>
                <p className="text-sm text-gray-600">{t('receipt.totalPaid')}</p>
                <p className="font-medium text-gray-900">${totals.total_paid}</p>
              </div>

              <div>
                <p className="text-sm text-gray-600">{t('receipt.invoiceTotal')}</p>
                <p className="font-medium text-gray-900">${parseFloat(invoice.total_amount).toFixed(2)}</p>
              </div>
            </div>

            {payment.notes && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">{t('receipt.notes')}</p>
                <p className="text-gray-900">{payment.notes}</p>
              </div>
            )}
          </div>

          {/* Download Buttons: each one is labelled in the language of the PDF it downloads */}
          <div className="px-6 py-1 bg-gray-50 border-t">
            <p className="text-sm text-gray-600 mb-4">{t('receipt.downloadPrompt')}</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => downloadPDF('en')}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                style={{ minHeight: '44px' }}
              >
                <Download size={20} aria-hidden="true" />
                <span lang="en">{t('receipt.downloadEnglish')}</span>
              </button>
              <button
                type="button"
                onClick={() => downloadPDF('es')}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                style={{ minHeight: '44px' }}
              >
                <Download size={20} aria-hidden="true" />
                <span lang="es">{t('receipt.downloadSpanish')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-white text-md" style={{ fontWeight: "bold" }}>
          <p className="mb-1">Gudino Custom Woodworking</p>
          <p>{t('receipt.phone')}: (509) 515-4090</p>
          <p className="mt-1 text-md text-white" style={{ fontWeight: "bold" }}>
            {t('receipt.thankYou')}
          </p>
        </div>
      </main>
    </div>
  );
};

export default ReceiptViewer;
