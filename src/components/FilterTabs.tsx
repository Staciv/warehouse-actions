import type { NotesFilter } from '../hooks/useNotes';

type FilterTabsProps = {
  active: NotesFilter;
  onChange: (value: NotesFilter) => void;
};

const filters: { id: NotesFilter; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'pinned', label: 'Избранные' },
  { id: 'archived', label: 'Архив' }
];

export function FilterTabs({ active, onChange }: FilterTabsProps) {
  return (
    <div className="tabs" role="tablist" aria-label="Фильтр заметок">
      {filters.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`tab ${active === item.id ? 'active' : ''}`}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
