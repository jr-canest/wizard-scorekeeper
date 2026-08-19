export default function ConfirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="card-gold bg-[#0d1426] p-6 max-w-sm w-full pop-in">
        <h3 className="font-display font-semibold text-[22px] leading-none text-cream-bright mb-2.5">{title}</h3>
        <p className="text-navy-200 text-sm mb-6">{message}</p>
        <div className="flex gap-2.5">
          <button onClick={onCancel} className="btn-secondary flex-1 h-12 text-[15px]">
            {cancelLabel}
          </button>
          <button onClick={onConfirm} className="btn-gold flex-1 h-12 text-base">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
