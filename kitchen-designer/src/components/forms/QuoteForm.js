import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import '../css/quote-form.css';

// Accepts anything that looks like name@domain.tld; the server validates properly.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const QuoteForm = ({
  isVisible,
  onClose,
  clientInfo,
  setClientInfo,
  kitchenData,
  bathroomData,
  calculateTotalPrice,
  onSendQuote
}) => {
  const { t } = useLanguage();
  // useId() contains colons, which are not valid in a URL fragment, and the
  // error summary links to each field with href="#id"
  const uid = useId().replace(/:/g, '');
  const dialogRef = useRef(null);
  const errorSummaryRef = useRef(null);
  // field name -> translation key of the message (kept as keys so the list
  // follows a language switch)
  const [fieldErrors, setFieldErrors] = useState({});
  // a failed send (network, server) — the page's own notice sits behind the modal
  const [sendError, setSendError] = useState(null);

  const nameId = `${uid}-name`;
  const emailId = `${uid}-email`;
  const phoneId = `${uid}-phone`;
  const methodId = `${uid}-method`;
  const commentsId = `${uid}-comments`;

  const errorKeys = Object.keys(fieldErrors);

  // Open and close the native dialog in step with the isVisible prop
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const isOpen = dialog.hasAttribute('open');
    if (isVisible && !isOpen) {
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        // browsers without <dialog>: show the panel, minus the inert backdrop
        dialog.setAttribute('open', '');
      }
    } else if (!isVisible) {
      setFieldErrors((prev) => (Object.keys(prev).length > 0 ? {} : prev));
      if (isOpen) {
        if (typeof dialog.close === 'function') {
          // close() also hands focus back to whatever opened the dialog
          dialog.close();
        } else {
          dialog.removeAttribute('open');
        }
      }
    }
  }, [isVisible]);

  // Send focus to the error summary whenever a send attempt fails
  useEffect(() => {
    if (Object.keys(fieldErrors).length > 0) {
      errorSummaryRef.current?.focus();
    }
  }, [fieldErrors]);

  const focusField = (event, id) => {
    event.preventDefault();
    document.getElementById(id)?.focus();
  };

  // Escape and the browser's own close button land here
  const handleDialogClose = () => {
    if (isVisible) {
      onClose();
    }
  };

  const handleSend = async () => {
    const errors = {};
    if (!(clientInfo.name || '').trim()) {
      errors[nameId] = 'forms.error.nameRequired';
    }
    if (!(clientInfo.email || '').trim()) {
      errors[emailId] = 'forms.error.emailRequired';
    } else if (!EMAIL_PATTERN.test(clientInfo.email.trim())) {
      errors[emailId] = 'forms.error.emailInvalid';
    }
    if (!(clientInfo.phone || '').trim()) {
      errors[phoneId] = 'forms.error.phoneRequired';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    setSendError(null);
    const result = await onSendQuote();
    if (result && result.success === false) {
      setSendError(result.message || t('designer.sendFailed'));
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="quote-dialog"
      aria-labelledby={`${uid}-title`}
      aria-describedby={`${uid}-intro`}
      onClose={handleDialogClose}
    >
      {isVisible && (
        <div className="bg-white rounded-lg max-w-md w-full mx-auto mt-24 mb-4 min-h-0">
          {/* Modal content */}
          <div className="p-6 pt-2 ">
            <h2 id={`${uid}-title`} className="text-xl font-bold mb-2">{t('quote.title')}</h2>
            <p id={`${uid}-intro`} className="text-sm text-gray-600 mb-3">
              {t('quote.intro')}
            </p>
            <p className="text-sm text-gray-600 mb-3">{t('a11y.requiredLegend')}</p>

            {sendError && (
              <div role="alert" className="mb-3 p-3 rounded bg-red-50 border border-red-200 text-sm text-red-700">
                {sendError}
              </div>
            )}
            {errorKeys.length > 0 && (
              <div
                ref={errorSummaryRef}
                role="alert"
                tabIndex={-1}
                className="mb-3 p-3 rounded bg-red-50 border border-red-200 text-sm text-red-700"
              >
                <p>{t('forms.errorSummary', { count: errorKeys.length })}</p>
                <ul className="list-disc list-inside mt-1">
                  {errorKeys.map((field) => (
                    <li key={field}>
                      <a className="underline" href={`#${field}`} onClick={(e) => focusField(e, field)}>
                        {t(fieldErrors[field])}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

          <div className="space-y-4">
          {/* Customer name input */}
          <div>
            <label htmlFor={nameId} className="block text-sm font-medium mb-1">
              {t('quote.name')} <span aria-hidden="true">*</span>
            </label>
            <input
              type="text"
              id={nameId}
              value={clientInfo.name}
              onChange={(e) => setClientInfo({ ...clientInfo, name: e.target.value })}
              className={`w-full p-2 border rounded ${fieldErrors[nameId] ? 'border-red-700' : 'border-gray-500'}`}
              required
              autoComplete="name"
              aria-invalid={fieldErrors[nameId] ? 'true' : undefined}
              aria-describedby={fieldErrors[nameId] ? `${nameId}-error` : undefined}
              placeholder={t('appointments.namePlaceholder')}
            />
            {fieldErrors[nameId] && (
              <p id={`${nameId}-error`} className="text-sm text-red-700 mt-1">{t(fieldErrors[nameId])}</p>
            )}
          </div>

          {/* Contact information - collect both email and phone */}
          <div>
            <label htmlFor={emailId} className="block text-sm font-medium mb-1">
              {t('quote.email')} <span aria-hidden="true">*</span>
            </label>
            <input
              type="email"
              id={emailId}
              value={clientInfo.email}
              onChange={(e) => setClientInfo({ ...clientInfo, email: e.target.value })}
              className={`w-full p-2 border rounded ${fieldErrors[emailId] ? 'border-red-700' : 'border-gray-500'}`}
              required
              autoComplete="email"
              aria-invalid={fieldErrors[emailId] ? 'true' : undefined}
              aria-describedby={fieldErrors[emailId] ? `${emailId}-error` : undefined}
              placeholder={t('appointments.emailPlaceholder')}
            />
            {fieldErrors[emailId] && (
              <p id={`${emailId}-error`} className="text-sm text-red-700 mt-1">{t(fieldErrors[emailId])}</p>
            )}
          </div>

          <div>
            <label htmlFor={phoneId} className="block text-sm font-medium mb-1">
              {t('quote.phone')} <span aria-hidden="true">*</span>
            </label>
            <input
              type="tel"
              id={phoneId}
              value={clientInfo.phone}
              onChange={(e) => setClientInfo({ ...clientInfo, phone: e.target.value })}
              className={`w-full p-2 border rounded ${fieldErrors[phoneId] ? 'border-red-700' : 'border-gray-500'}`}
              required
              autoComplete="tel"
              aria-invalid={fieldErrors[phoneId] ? 'true' : undefined}
              aria-describedby={
                fieldErrors[phoneId] ? `${phoneId}-hint ${phoneId}-error` : `${phoneId}-hint`
              }
            />
            <p id={`${phoneId}-hint`} className="text-xs text-gray-600 mt-1">{t('forms.phoneHint')}</p>
            {fieldErrors[phoneId] && (
              <p id={`${phoneId}-error`} className="text-sm text-red-700 mt-1">{t(fieldErrors[phoneId])}</p>
            )}
          </div>

          {/* Contact preference selector - now for preferred method only */}
          <div>
            <label htmlFor={methodId} className="block text-sm font-medium mb-1">
              {t('quote.contactMethod')} <span aria-hidden="true">*</span>
            </label>
            <select
              id={methodId}
              value={clientInfo.contactPreference}
              onChange={(e) => setClientInfo({ ...clientInfo, contactPreference: e.target.value })}
              className="w-full p-2 border border-gray-500 rounded"
              required
              aria-describedby={`${methodId}-hint`}
            >
              <option value="email">{t('quote.method.email')}</option>
              <option value="phone">{t('quote.method.phone')}</option>
              <option value="text">{t('quote.method.text')}</option>
            </select>
            <p id={`${methodId}-hint`} className="text-xs text-gray-600 mt-1">
              {t('quote.contactMethodHint')}
            </p>
          </div>

          {/* Room inclusion options */}
          <fieldset className="m-0 p-0 border-0 min-w-0">
            <legend className="float-none w-full block text-sm font-medium mb-2">{t('quote.includeLegend')}</legend>
            <div className="space-y-2">
              {/* Kitchen inclusion checkbox */}
              {kitchenData.elements.length > 0 && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={clientInfo.includeKitchen}
                    onChange={(e) => setClientInfo({ ...clientInfo, includeKitchen: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm">
                    {t('quote.includeKitchen', {
                      count: kitchenData.elements.length,
                      price: calculateTotalPrice(kitchenData).toFixed(2)
                    })}
                  </span>
                </label>
              )}
              {/* Bathroom inclusion checkbox */}
              {bathroomData.elements.length > 0 && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={clientInfo.includeBathroom}
                    onChange={(e) => setClientInfo({ ...clientInfo, includeBathroom: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm">
                    {t('quote.includeBathroom', {
                      count: bathroomData.elements.length,
                      price: calculateTotalPrice(bathroomData).toFixed(2)
                    })}
                  </span>
                </label>
              )}
            </div>
          </fieldset>

          {/* Additional comments field */}
          <div>
            <label htmlFor={commentsId} className="block text-sm font-medium mb-1">{t('quote.comments')}</label>
            <textarea
              id={commentsId}
              value={clientInfo.comments}
              onChange={(e) => setClientInfo({ ...clientInfo, comments: e.target.value })}
              className="w-full p-2 border border-gray-500 rounded h-24"
              placeholder={t('quote.commentsPlaceholder')}
            />
          </div>

          {/* Process information panel */}
          <div className="bg-blue-50 p-3 rounded text-sm text-blue-800">
            <p className="font-medium mb-1">{t('quote.nextTitle')}</p>
            <ul className="list-disc list-inside text-xs space-y-1">
              <li>{t('quote.next1')}</li>
              <li>{t('quote.next2')}</li>
              <li>{t('quote.next3')}</li>
            </ul>
          </div>

          {/* Modal action buttons */}
          <div className="flex gap-2 pt-6 mt-6 border-t border-gray-200">
            {/* Cancel button */}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 p-2 border border-gray-500 rounded hover:bg-gray-50"
            >
              {t('common.cancel')}
            </button>
            {/* Submit quote request button */}
            <button
              type="button"
              onClick={handleSend}
              className="flex-1 p-2 bg-blue-700 text-white rounded hover:bg-blue-800 flex items-center justify-center gap-2"
            >
              <Send size={16} />
              {t('quote.send')}
            </button>
          </div>
          </div>
        </div>
      </div>
      )}
    </dialog>
  );
};

export default QuoteForm;
