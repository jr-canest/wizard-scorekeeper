export default function ConfirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-navy-800 border border-gold-700/50 rounded-xl p-6 max-w-sm w-full">
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <p className="text-gray-300 text-sm mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-lg bg-navy-600 text-gray-300 font-medium active:bg-navy-500"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="btn-gold flex-1 py-3 rounded-lg"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
