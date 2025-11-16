import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Clock } from 'lucide-react';
import Fuse from 'fuse.js';

// Support both simple strings and rich suggestion objects
export type SuggestionItem = string | {
  label: string;
  context?: string; // e.g., "Solid Body • 1954-present • SSS/HSS"
  category?: string; // e.g., "Player Series", "American Professional"
};

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: SuggestionItem[];
  placeholder?: string;
  className?: string;
  required?: boolean;
  trackRecent?: boolean; // Enable recent items tracking
  recentKey?: string; // localStorage key for recent items (e.g., 'recent-brands')
  fuzzyMatch?: boolean; // Enable fuzzy matching (default: true)
}

export const AutocompleteInput = ({
  value,
  onChange,
  suggestions,
  placeholder,
  className = '',
  required = false,
  trackRecent = false,
  recentKey = 'recent-items',
  fuzzyMatch = true,
}: AutocompleteInputProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Normalize suggestions to objects
  const normalizedSuggestions = useMemo(() => {
    return suggestions.map(s =>
      typeof s === 'string' ? { label: s } : s
    );
  }, [suggestions]);

  // Get recent items from localStorage
  const recentItems = useMemo(() => {
    if (!trackRecent) return [];
    try {
      const stored = localStorage.getItem(recentKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }, [trackRecent, recentKey]);

  // Configure fuzzy search
  const fuse = useMemo(() => {
    if (!fuzzyMatch) return null;
    return new Fuse(normalizedSuggestions, {
      keys: ['label', 'context'],
      threshold: 0.3, // 0 = exact match, 1 = match anything
      includeScore: true,
      minMatchCharLength: 1,
    });
  }, [normalizedSuggestions, fuzzyMatch]);

  // Filter and sort suggestions
  const filteredSuggestions = useMemo(() => {
    if (!value || value.trim() === '') {
      // No search query - show all with recent items first
      const recent = normalizedSuggestions.filter(s => recentItems.includes(s.label));
      const rest = normalizedSuggestions.filter(s => !recentItems.includes(s.label));
      return [...recent, ...rest];
    }

    if (fuzzyMatch && fuse) {
      // Use fuzzy matching
      const results = fuse.search(value);
      return results.map(r => r.item);
    } else {
      // Simple substring matching
      return normalizedSuggestions.filter(s =>
        s.label.toLowerCase().includes(value.toLowerCase())
      );
    }
  }, [value, normalizedSuggestions, fuzzyMatch, fuse, recentItems]);

  // Group suggestions into recent and all
  const groupedSuggestions = useMemo(() => {
    if (!trackRecent || !value || value.trim() === '') {
      return { recent: [], all: filteredSuggestions };
    }

    const recent = filteredSuggestions.filter(s => recentItems.includes(s.label));
    const all = filteredSuggestions.filter(s => !recentItems.includes(s.label));

    return { recent, all };
  }, [filteredSuggestions, trackRecent, value, recentItems]);

  // Save to recent items
  const saveToRecent = (selectedValue: string) => {
    if (!trackRecent) return;

    try {
      const recent = recentItems.filter((item: string) => item !== selectedValue);
      recent.unshift(selectedValue);
      const updated = recent.slice(0, 5); // Keep only 5 most recent
      localStorage.setItem(recentKey, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save recent item:', error);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && dropdownRef.current) {
      const allChildren = Array.from(dropdownRef.current.querySelectorAll('[data-suggestion]'));
      const highlightedElement = allChildren[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setIsOpen(true);
    setHighlightedIndex(-1);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleSuggestionClick = (suggestion: { label: string }) => {
    onChange(suggestion.label);
    saveToRecent(suggestion.label);
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const totalSuggestions = groupedSuggestions.recent.length + groupedSuggestions.all.length;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < totalSuggestions - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < totalSuggestions) {
          const allSuggestions = [...groupedSuggestions.recent, ...groupedSuggestions.all];
          handleSuggestionClick(allSuggestions[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
      case 'Tab':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  // Highlight matching text
  const highlightMatch = (text: string, query: string) => {
    if (!query || !fuzzyMatch) return text;

    const index = text.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return text;

    return (
      <>
        {text.substring(0, index)}
        <span className="font-semibold text-primary-700">
          {text.substring(index, index + query.length)}
        </span>
        {text.substring(index + query.length)}
      </>
    );
  };

  const renderSuggestion = (suggestion: { label: string; context?: string; category?: string }, index: number, isRecent: boolean) => {
    return (
      <button
        key={`${isRecent ? 'recent' : 'all'}-${suggestion.label}-${index}`}
        data-suggestion
        type="button"
        onClick={() => handleSuggestionClick(suggestion)}
        className={`w-full text-left px-4 py-2.5 hover:bg-primary-50 transition-colors border-b border-gray-100 last:border-b-0 ${
          index === highlightedIndex ? 'bg-primary-100' : ''
        }`}
      >
        <div className="flex items-start gap-2">
          {isRecent && (
            <Clock className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900">
              {highlightMatch(suggestion.label, value)}
            </div>
            {suggestion.context && (
              <div className="text-xs text-gray-500 mt-0.5">
                {suggestion.context}
              </div>
            )}
          </div>
        </div>
      </button>
    );
  };

  const totalSuggestions = groupedSuggestions.recent.length + groupedSuggestions.all.length;

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`${className} pr-8`}
          required={required}
        />
        <ChevronDown
          className={`absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </div>

      {isOpen && totalSuggestions > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-80 overflow-y-auto"
        >
          {groupedSuggestions.recent.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50 border-b border-gray-200 sticky top-0">
                RECENTLY USED
              </div>
              {groupedSuggestions.recent.map((suggestion, index) =>
                renderSuggestion(suggestion, index, true)
              )}
            </>
          )}

          {groupedSuggestions.all.length > 0 && (
            <>
              {groupedSuggestions.recent.length > 0 && (
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50 border-b border-gray-200 sticky top-0">
                  ALL SUGGESTIONS
                </div>
              )}
              {groupedSuggestions.all.map((suggestion, index) =>
                renderSuggestion(suggestion, groupedSuggestions.recent.length + index, false)
              )}
            </>
          )}
        </div>
      )}

      {isOpen && value && totalSuggestions === 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg px-4 py-3 text-sm text-gray-500 italic"
        >
          No suggestions found. You can enter a custom value.
        </div>
      )}
    </div>
  );
};
