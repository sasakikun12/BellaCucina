export function StatusBadge({ label, colorClasses }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${colorClasses}`}>
      {label}
    </span>
  );
}
