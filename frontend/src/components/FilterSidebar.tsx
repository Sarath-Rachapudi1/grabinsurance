interface Props {
  categories: string[];
  selected: Set<string>;
  onToggle: (category: string) => void;
  onClearAll: () => void;
}

export default function FilterSidebar({ categories, selected, onToggle, onClearAll }: Props) {
  return (
    <aside className="w-52 flex-shrink-0">
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="font-bold text-gray-800 text-sm">Filter</span>
          {selected.size > 0 && (
            <button
              onClick={onClearAll}
              className="text-xs text-green-600 hover:text-green-700 font-semibold"
            >
              Clear All
            </button>
          )}
        </div>

        {/* Category list */}
        <div className="px-4 py-3">
          <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider mb-2">
            Category
          </p>
          <ul className="space-y-2">
            {categories.map((cat) => (
              <li key={cat}>
                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={selected.has(cat)}
                    onChange={() => onToggle(cat)}
                    className="w-4 h-4 accent-green-600 cursor-pointer"
                  />
                  <span className="text-sm text-gray-700 group-hover:text-green-700 transition-colors">
                    {cat}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}
