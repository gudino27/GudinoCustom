import React, { useId, useLayoutEffect, useRef } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import '../css/quote-form.css';

// Asks before removing a pantry that has items standing against its walls:
// remove the pantry only (the items stay), remove the items too, or cancel.
// Same pattern as HousingDeleteDialog: a native <dialog> opened with
// showModal(), focus starts on Cancel, Escape cancels, and where focus goes
// afterwards is the page's call.
const PantryDeleteDialog = ({ request, onRemovePantry, onRemoveBoth, onCancel }) => {
  const { t } = useLanguage();
  const uid = useId().replace(/:/g, '');
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  const isOpen = !!request;

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const open = dialog.hasAttribute('open');
    if (isOpen && !open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
      if (cancelRef.current) cancelRef.current.focus();
    } else if (!isOpen && open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [isOpen]);

  const count = request ? request.items.length : 0;

  return (
    <dialog
      ref={dialogRef}
      className="quote-dialog"
      aria-labelledby={`${uid}-title`}
      aria-describedby={`${uid}-body`}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      {request && (
        <div className="bg-white rounded-lg max-w-md w-full mx-auto mt-24 mb-4 p-6 shadow-xl">
          <h2 id={`${uid}-title`} className="text-lg font-bold mb-2">
            {t('designer.confirmPantryDelete.title')}
          </h2>
          <p id={`${uid}-body`} className="text-sm text-gray-700 mb-5">
            {t('designer.confirmPantryDelete.body', { count })}
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={onRemovePantry}
              className="w-full p-3 min-h-12 rounded bg-red-50 text-red-800 border border-red-300 hover:bg-red-100 font-medium text-sm focus:outline-none focus:ring-4 focus:ring-blue-700 focus:ring-offset-2"
            >
              {t('designer.confirmPantryDelete.pantryOnly')}
            </button>
            <button
              type="button"
              onClick={onRemoveBoth}
              className="w-full p-3 min-h-12 rounded bg-red-700 text-white hover:bg-red-800 font-medium text-sm focus:outline-none focus:ring-4 focus:ring-blue-700 focus:ring-offset-2"
            >
              {t('designer.confirmPantryDelete.both', { count })}
            </button>
            <button
              ref={cancelRef}
              type="button"
              onClick={onCancel}
              className="w-full p-3 min-h-12 rounded bg-gray-100 text-gray-800 border border-gray-300 hover:bg-gray-200 font-medium text-sm focus:outline-none focus:ring-4 focus:ring-blue-700 focus:ring-offset-2"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
};

export default PantryDeleteDialog;
