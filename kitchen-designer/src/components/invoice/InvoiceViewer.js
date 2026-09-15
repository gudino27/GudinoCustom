import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Download,
  FileText,
  Building,
  User,
  Calendar,
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  Phone,
  Mail,
  Receipt,
  ChevronRight
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import SEO from '../ui/SEO';

const InvoiceViewer = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { t, currentLanguage } = useLanguage();
  const locale = currentLanguage === 'es' ? 'es-US' : 'en-US';
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const API_BASE = process.env.REACT_APP_API_URL || 'https://api.gudinocustom.com';

  useEffect(() => {
    fetchInvoice();
  }, [token]);

  const fetchInvoice = async () => {
    try {
      const response = await fetch(`${API_BASE}/invoice/${token}`);
      if (response.ok) {
        const data = await response.json();
        setInvoice(data);
      } else {
        // Errors are kept as translation keys so they follow the language switch
        setError('invoice.errorNotFound');
      }
    } catch (error) {
      console.error('Error fetching invoice:', error);
      setError('invoice.errorLoad');
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async () => {
    try {
      const response = await fetch(`${API_BASE}/invoice/${token}/pdf`);

      if (response.ok) {
        const pdfBlob = await response.blob();
        const url = window.URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `invoice-${invoice.invoice_number}.pdf`;
        document.body.appendChild(link);
        link.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
      } else {
        alert(t('invoice.pdfGenerateFailed'));
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert(t('invoice.pdfDownloadFailed'));
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid': return 'text-green-700';
      case 'overdue': return 'text-red-600';
      case 'pending': return 'text-yellow-700';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'paid': return <CheckCircle className="inline w-5 h-5" />;
      case 'overdue': return <XCircle className="inline w-5 h-5" />;
      case 'pending': return <Clock className="inline w-5 h-5" />;
      default: return <AlertCircle className="inline w-5 h-5" />;
    }
  };

  // Falls back to the raw value if the backend ever sends a status or method we don't have a key for
  const getStatusLabel = (status) =>
    t(`invoice.status.${status}`, status.charAt(0).toUpperCase() + status.slice(1));

  const getMethodLabel = (method) =>
    t(`invoice.method.${method}`, String(method || '').replace('_', ' '));

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <SEO title={t('invoice.title')} />
        <main id="main-content" tabIndex={-1} className="text-center">
          <h1 className="sr-only">{t('invoice.title')}</h1>
          <div role="status">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" aria-hidden="true"></div>
            <p className="text-gray-600">{t('invoice.loading')}</p>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <SEO title={t('invoice.notFoundTitle')} />
        <main id="main-content" tabIndex={-1} className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('invoice.notFoundTitle')}</h1>
          <p className="text-gray-600 mb-6">{t(error)}</p>
          <p className="text-sm text-gray-600">
            {t('invoice.notFoundHelp')}
          </p>
        </main>
      </div>
    );
  }

  const clientName = invoice.is_business 
    ? invoice.company_name 
    : `${invoice.first_name} ${invoice.last_name}`;

  const totalPaid = invoice.payments?.reduce((sum, payment) => sum + parseFloat(payment.payment_amount), 0) || 0;
  const remainingBalance = invoice.total_amount - totalPaid;

  return (
    <div className="min-h-screen" style={{backgroundColor: 'rgba(110, 110, 110, 0.1)'}}>
      <SEO title={t('invoice.pageTitle', { number: invoice.invoice_number })} />
      <main id="main-content" tabIndex={-1}>
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-600 to-gray-800  shadow-sm" style={{borderBottom: '2px solid rgba(110, 110, 110, 0.3)'}}>
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold" style={{color: 'rgba(255, 255, 255, 1)'}}>
                {t('invoice.pageTitle', { number: invoice.invoice_number })}
              </h1>
              <p className="flex items-center gap-2 mt-1 " style={{fontWeight:'bold',color: 'rgba(255, 255, 255, 1)'}}>
                Gudino Custom Cabinets
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={downloadPDF}
                className="text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm"
                style={{backgroundColor: 'rgba(110, 110, 110, 0.8)', border: '1px solid rgba(110, 110, 110, 1)'}}
                onMouseOver={(e) => e.target.style.backgroundColor = 'rgba(110, 110, 110, 1)'}
                onMouseOut={(e) => e.target.style.backgroundColor = 'rgba(110, 110, 110, 0.8)'}
              >
                <Download size={16} aria-hidden="true" />
                {t('invoice.downloadPdf')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Status and Basic Info */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6" style={{border: '1px solid rgba(110, 110, 110, 0.3)'}}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Status */}
            <div className="text-center md:text-left">
              <p className="text-sm mb-1" style={{color: 'rgba(110, 110, 110, 1)'}}>{t('invoice.status')}</p>
              <p className={`text-lg font-semibold ${getStatusColor(invoice.status)} flex items-center gap-2 justify-center md:justify-start`}>
                {getStatusIcon(invoice.status)}
                {getStatusLabel(invoice.status)}
              </p>
            </div>

            {/* Invoice Date */}
            <div className="text-center md:text-left">
              <p className="text-sm mb-1" style={{color: 'rgba(110, 110, 110, 1)'}}>{t('invoice.invoiceDate')}</p>
              <p className="text-lg font-semibold flex items-center gap-2 justify-center md:justify-start" style={{color: 'rgba(0, 0, 0, 1)'}}>
                <Calendar className="w-4 h-4" aria-hidden="true" />
                {new Date(invoice.invoice_date).toLocaleDateString(locale)}
              </p>
            </div>

            {/* Due Date */}
            <div className="text-center md:text-left">
              <p className="text-sm mb-1" style={{color: 'rgba(110, 110, 110, 1)'}}>{t('invoice.dueDate')}</p>
              <p className="text-lg font-semibold flex items-center gap-2 justify-center md:justify-start" style={{color: 'rgba(0, 0, 0, 1)'}}>
                <Clock className="w-4 h-4" aria-hidden="true" />
                {new Date(invoice.due_date).toLocaleDateString(locale)}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Bill To */}
            <div className="bg-white rounded-lg shadow-sm p-6" style={{border: '1px solid rgba(110, 110, 110, 0.3)'}}>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{color: 'rgba(0, 0, 0, 1)', borderBottom: '2px solid rgba(110, 110, 110, 0.3)', paddingBottom: '8px'}}>
                {invoice.is_business ? <Building className="w-5 h-5" aria-hidden="true" /> : <User className="w-5 h-5" aria-hidden="true" />}
                {t('invoice.billTo')}
              </h2>
              <div className="space-y-2">
                <p className="font-semibold" style={{color: 'rgba(0, 0, 0, 1)'}}>{clientName}</p>
                {invoice.email && (
                  <p className="flex items-center gap-2" style={{color: 'rgba(0, 0, 0, 0.8)'}}>
                    <Mail className="w-4 h-4" aria-hidden="true" />
                    {invoice.email}
                  </p>
                )}
                {invoice.phone && (
                  <p className="flex items-center gap-2" style={{color: 'rgba(0, 0, 0, 0.8)'}}>
                    <Phone className="w-4 h-4" aria-hidden="true" />
                    {invoice.phone}
                  </p>
                )}
                {invoice.address && (
                  <p style={{color: 'rgba(0, 0, 0, 0.8)'}}>{invoice.address}</p>
                )}
                {invoice.tax_exempt_number && (
                  <p className="text-sm" style={{color: 'rgba(110, 110, 110, 1)'}}>
                    {t('invoice.taxExempt')}: {invoice.tax_exempt_number}
                  </p>
                )}
              </div>
            </div>

            {/* Line Items */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden" style={{border: '1px solid rgba(110, 110, 110, 0.3)'}}>
              <div className="px-6 py-4 border-b" style={{backgroundColor: 'rgba(110, 110, 110, 0.1)', borderBottom: '1px solid rgba(110, 110, 110, 0.3)'}}>
                <h2 className="text-lg font-semibold flex items-center gap-2" style={{color: 'rgba(0, 0, 0, 1)'}}>
                  <FileText className="w-5 h-5" aria-hidden="true" />
                  {t('invoice.items')}
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-md font-medium text-gray-500 uppercase" style={{ border: '0.25px solid #000000ff',color: '#000000ff', fontWeight: 'bold'}}>
                        {t('invoice.col.description')}
                      </th>
                      <th scope="col" className="px-6 py-3 text-center text-md font-medium text-gray-500 uppercase" style={{ border: '0.25px solid #000000ff',color: '#000000ff', fontWeight: 'bold'}}>
                        {t('invoice.col.qty')}
                      </th>
                      <th scope="col" className="px-10 py-3 text-right text-md font-medium text-gray-500 uppercase" style={{border: '0.25px solid #000000ff',color: '#000000ff', fontWeight: 'bold', whiteSpace: 'nowrap'}}>
                        {t('invoice.col.unitPrice')}
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-md font-medium text-gray-500 uppercase" style={{border: '0.25px solid #000000ff',color: '#000000ff', fontWeight: 'bold'}}>
                        {t('invoice.col.total')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {invoice.line_items?.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4"style={{backgroundColor: 'rgba(110,110,110,0.25)', border: '0.5px solid #000000ff', verticalAlign: 'top'}}>
                          <div>
                            {item.title && (
                              <p className="font-semibold text-gray-900 mb-1">{item.title}</p>
                            )}
                            <p className="text-gray-700">{item.description}</p>
                            {item.notes && (
                              <p className="text-sm text-gray-600 mt-1">{item.notes}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center text-gray-900"style={{backgroundColor: 'rgba(110,110,110,0.25)', border: '0.5px solid #000000ff', verticalAlign: 'top'}}>
                          {item.quantity}
                        </td>
                        <td className="px-6 py-4 text-right text-gray-900"style={{backgroundColor: 'rgba(110,110,110,0.25)', border: '0.5px solid #000000ff', verticalAlign: 'top', whiteSpace: 'nowrap'}}>
                          ${parseFloat(item.unit_price || 0).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-gray-900"style={{backgroundColor: 'rgba(110,110,110,0.25)', border: '0.5px solid #000000ff', verticalAlign: 'top'}}>
                          ${((item.quantity || 0) * parseFloat(item.unit_price || 0)).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Notes */}
            {invoice.notes && (
              <div className="bg-white rounded-lg shadow-sm p-6" style={{border: '1px solid rgba(110, 110, 110, 0.3)'}}>
                <h2 className="text-lg font-semibold mb-4" style={{color: 'rgba(0, 0, 0, 1)', borderBottom: '2px solid rgba(110, 110, 110, 0.3)', paddingBottom: '8px'}}>{t('invoice.additionalNotes')}</h2>
                <div className="p-4 rounded-r-lg" style={{backgroundColor: 'rgba(110, 110, 110, 0.1)', borderLeft: '4px solid rgba(110, 110, 110, 1)'}}>
                  <p className="whitespace-pre-wrap" style={{color: 'rgba(0, 0, 0, 0.8)'}}>{invoice.notes}</p>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Invoice Total */}
            <div className="bg-white rounded-lg shadow-sm p-6" style={{border: '1px solid rgba(110, 110, 110, 0.3)'}}>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{color: 'rgba(0, 0, 0, 1)', borderBottom: '2px solid rgba(110, 110, 110, 0.3)', paddingBottom: '8px'}}>
                <DollarSign className="w-5 h-5" aria-hidden="true" />
                {t('invoice.summary')}
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span style={{color: 'rgba(110, 110, 110, 1)'}}>{t('invoice.subtotal')}:</span>
                  <span className="font-medium" style={{color: 'rgba(0, 0, 0, 1)'}}>${(invoice.subtotal || 0).toFixed(2)}</span>
                </div>
                {(invoice.discount_amount || 0) > 0 && (
                  <div className="flex justify-between text-green-700">
                    <span style={{color: 'rgba(110, 110, 110, 1)'}}>{t('invoice.discount')}:</span>
                    <span style={{color: 'rgba(0, 0, 0, 1)'}}>-${(invoice.discount_amount || 0).toFixed(2)}</span>
                  </div>
                )}
                {(invoice.markup_amount || 0) > 0 && (
                  <div className="flex justify-between">
                    <span style={{color: 'rgba(110, 110, 110, 1)'}}>{t('invoice.markup')}:</span>
                    <span style={{color: 'rgba(0, 0, 0, 1)'}}>${(invoice.markup_amount || 0).toFixed(2)}</span>
                  </div>
                )}
                {(invoice.tax_amount || 0) > 0 && (
                  <div className="flex justify-between">
                    <span style={{color: 'rgba(110, 110, 110, 1)'}}>{t('invoice.tax', { rate: ((invoice.tax_rate || 0)).toFixed(2) })}:</span>
                    <span style={{color: 'rgba(0, 0, 0, 1)'}}>${(invoice.tax_amount || 0).toFixed(2)}</span>
                  </div>
                )}
                <div className="pt-3" style={{borderTop: '1px solid rgba(110, 110, 110, 0.5)'}}>
                  <div className="flex justify-between text-lg font-semibold">
                    <span style={{color: 'rgba(0, 0, 0, 1)'}}>{t('invoice.total')}:</span>
                    <span style={{color: 'rgba(110, 110, 110, 1)'}}>${(invoice.total_amount || 0).toFixed(2)}</span>
                  </div>
                </div>
                {totalPaid > 0 && (
                  <>
                    <div className="flex justify-between text-green-700">
                      <span style={{color: 'rgba(110, 110, 110, 1)'}}>{t('invoice.amountPaid')}:</span>
                      <span style={{color: 'rgba(0, 0, 0, 1)'}}>-${(totalPaid || 0).toFixed(2)}</span>
                    </div>
                    <div className="pt-3" style={{borderTop: '1px solid rgba(110, 110, 110, 0.5)'}}>
                      <div className="flex justify-between text-lg font-semibold">
                        <span style={{color: 'rgba(0, 0, 0, 1)'}}>{t('invoice.remainingBalance')}:</span>
                        <span className={(remainingBalance || 0) > 0 ? 'text-red-600' : 'text-green-700'}>
                          ${(remainingBalance || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Payment History */}
            {invoice.payments && invoice.payments.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6" style={{border: '1px solid rgba(110, 110, 110, 0.3)'}}>
                <h2 className="text-lg font-semibold mb-4" style={{color: 'rgba(0, 0, 0, 1)', borderBottom: '2px solid rgba(110, 110, 110, 0.3)', paddingBottom: '8px'}}>{t('invoice.paymentHistory')}</h2>
                <div className="space-y-3">
                  {invoice.payments.map((payment, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => navigate(`/invoice/${token}/payment/${payment.id}`)}
                      className="w-full rounded-lg p-3 text-left transition-all hover:shadow-md"
                      style={{
                        backgroundColor: 'rgba(110, 110, 110, 0.1)',
                        border: '1px solid rgba(110, 110, 110, 0.3)',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(110, 110, 110, 0.15)';
                        e.currentTarget.style.borderColor = 'rgba(110, 110, 110, 0.5)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(110, 110, 110, 0.1)';
                        e.currentTarget.style.borderColor = 'rgba(110, 110, 110, 0.3)';
                      }}
                    >
                      <span className="sr-only">{t('invoice.viewReceipt')}: </span>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium" style={{color: 'rgba(0, 0, 0, 1)'}}>
                            ${parseFloat(payment.payment_amount || 0).toFixed(2)}
                          </p>
                          <p className="text-sm" style={{color: 'rgba(89, 89, 89, 1)'}}>
                            {getMethodLabel(payment.payment_method)}
                            {payment.check_number && ` - ${t('invoice.checkNumber', { number: payment.check_number })}`}
                          </p>
                          {payment.notes && (
                            <p className="text-xs mt-1" style={{color: 'rgba(89, 89, 89, 1)'}}>{payment.notes}</p>
                          )}
                        </div>
                        <p className="text-sm" style={{color: 'rgba(89, 89, 89, 1)'}}>
                          {new Date(payment.payment_date).toLocaleDateString(locale)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Contact Information */}
            <div className="bg-white rounded-lg shadow-sm p-6" style={{border: '1px solid rgba(110, 110, 110, 0.3)'}}>
              <h2 className="text-lg font-semibold mb-4" style={{color: 'rgba(0, 0, 0, 1)', borderBottom: '2px solid rgba(110, 110, 110, 0.3)', paddingBottom: '8px'}}>{t('invoice.questions')}</h2>
              <div className="space-y-3">
                <p style={{color: 'rgba(110, 110, 110, 1)'}}>
                  {t('invoice.questionsText')}
                </p>
                <div className="space-y-2">
                  <p className="text-sm flex items-center gap-2" style={{color: 'rgba(0, 0, 0, 0.8)'}}>
                    <Mail className="w-4 h-4" aria-hidden="true" />
                    admin@gudinocustom.com
                  </p>
                  <p className="text-sm flex items-center gap-2" style={{color: 'rgba(0, 0, 0, 0.8)'}}>
                    <Phone className="w-4 h-4" aria-hidden="true" />
                    (509) 515-4090
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </main>
    </div>
  );
};

export default InvoiceViewer;