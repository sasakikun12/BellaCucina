export function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-stone-900/50 p-4" onClick={onClose}>
      <div
        className={`max-h-[90vh] w-full ${wide ? "max-w-2xl" : "max-w-md"} overflow-y-auto rounded-xl bg-white p-6 shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-800">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
