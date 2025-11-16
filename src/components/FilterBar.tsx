import { GuitarFilters, GuitarType } from '../types/guitar';
import { Filter, X } from 'lucide-react';
import { useState, useEffect } from 'react';

interface FilterBarProps {
  filters: GuitarFilters;
  brands: string[];
  onFilterChange: (filters: GuitarFilters) => void;
  minYear?: number;
  maxYear?: number;
}

export const FilterBar = ({ filters, brands, onFilterChange, minYear = 1950, maxYear = new Date().getFullYear() }: FilterBarProps) => {
  const [showFilters, setShowFilters] = useState(false);
  const [localYearMin, setLocalYearMin] = useState(filters.yearMin || minYear);
  const [localYearMax, setLocalYearMax] = useState(filters.yearMax || maxYear);

  useEffect(() => {
    setLocalYearMin(filters.yearMin || minYear);
    setLocalYearMax(filters.yearMax || maxYear);
  }, [filters.yearMin, filters.yearMax, minYear, maxYear]);

  const hasActiveFilters =
    filters.brand || filters.type || filters.yearMin || filters.yearMax;

  const clearFilters = () => {
    onFilterChange({});
  };

  const handleYearMinChange = (value: number) => {
    const newMin = Math.min(value, localYearMax);
    setLocalYearMin(newMin);
    onFilterChange({
      ...filters,
      yearMin: newMin === minYear ? undefined : newMin,
    });
  };

  const handleYearMaxChange = (value: number) => {
    const newMax = Math.max(value, localYearMin);
    setLocalYearMax(newMax);
    onFilterChange({
      ...filters,
      yearMax: newMax === maxYear ? undefined : newMax,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors ${
            showFilters
              ? 'border-primary-600 bg-primary-50 text-primary-700'
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <Filter className="w-4 h-4" />
          <span className="font-medium">Filters</span>
        </button>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <X className="w-4 h-4" />
            Clear filters
          </button>
        )}
      </div>

      {showFilters && (
        <div className="card p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <label className="label">Brand</label>
              <select
                value={filters.brand || ''}
                onChange={(e) =>
                  onFilterChange({ ...filters, brand: e.target.value || undefined })
                }
                className="input-field"
              >
                <option value="">All Brands</option>
                {brands.map((brand) => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Type</label>
              <select
                value={filters.type || ''}
                onChange={(e) =>
                  onFilterChange({
                    ...filters,
                    type: e.target.value ? (e.target.value as GuitarType) : undefined,
                  })
                }
                className="input-field"
              >
                <option value="">All Types</option>
                {Object.values(GuitarType).map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <label className="label mb-0">Year Range</label>
                <span className="text-sm font-semibold text-primary-700 bg-primary-50 px-3 py-1 rounded-full">
                  {localYearMin} - {localYearMax}
                </span>
              </div>
              <div className="relative h-6 flex items-center">
                {/* Track background */}
                <div className="absolute left-0 right-0 h-1.5 bg-gray-200 rounded-full"></div>

                {/* Active range highlight */}
                <div
                  className="absolute h-1.5 bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all duration-150"
                  style={{
                    left: `${((localYearMin - minYear) / (maxYear - minYear)) * 100}%`,
                    right: `${100 - ((localYearMax - minYear) / (maxYear - minYear)) * 100}%`,
                  }}
                ></div>

                {/* Min year slider */}
                <input
                  type="range"
                  min={minYear}
                  max={maxYear}
                  value={localYearMin}
                  onChange={(e) => handleYearMinChange(parseInt(e.target.value))}
                  className="absolute left-0 w-full appearance-none bg-transparent cursor-pointer z-10
                    [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:w-5
                    [&::-webkit-slider-thumb]:h-5
                    [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:bg-white
                    [&::-webkit-slider-thumb]:border-2
                    [&::-webkit-slider-thumb]:border-primary-600
                    [&::-webkit-slider-thumb]:shadow-lg
                    [&::-webkit-slider-thumb]:transition-all
                    [&::-webkit-slider-thumb]:hover:scale-110
                    [&::-webkit-slider-thumb]:hover:shadow-xl
                    [&::-webkit-slider-thumb]:active:scale-105
                    [&::-moz-range-thumb]:appearance-none
                    [&::-moz-range-thumb]:w-5
                    [&::-moz-range-thumb]:h-5
                    [&::-moz-range-thumb]:rounded-full
                    [&::-moz-range-thumb]:bg-white
                    [&::-moz-range-thumb]:border-2
                    [&::-moz-range-thumb]:border-primary-600
                    [&::-moz-range-thumb]:shadow-lg
                    [&::-moz-range-thumb]:transition-all
                    [&::-moz-range-thumb]:hover:scale-110
                    [&::-moz-range-thumb]:border-0"
                  style={{ height: '0px' }}
                />

                {/* Max year slider */}
                <input
                  type="range"
                  min={minYear}
                  max={maxYear}
                  value={localYearMax}
                  onChange={(e) => handleYearMaxChange(parseInt(e.target.value))}
                  className="absolute left-0 w-full appearance-none bg-transparent cursor-pointer z-10
                    [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:w-5
                    [&::-webkit-slider-thumb]:h-5
                    [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:bg-white
                    [&::-webkit-slider-thumb]:border-2
                    [&::-webkit-slider-thumb]:border-primary-600
                    [&::-webkit-slider-thumb]:shadow-lg
                    [&::-webkit-slider-thumb]:transition-all
                    [&::-webkit-slider-thumb]:hover:scale-110
                    [&::-webkit-slider-thumb]:hover:shadow-xl
                    [&::-webkit-slider-thumb]:active:scale-105
                    [&::-moz-range-thumb]:appearance-none
                    [&::-moz-range-thumb]:w-5
                    [&::-moz-range-thumb]:h-5
                    [&::-moz-range-thumb]:rounded-full
                    [&::-moz-range-thumb]:bg-white
                    [&::-moz-range-thumb]:border-2
                    [&::-moz-range-thumb]:border-primary-600
                    [&::-moz-range-thumb]:shadow-lg
                    [&::-moz-range-thumb]:transition-all
                    [&::-moz-range-thumb]:hover:scale-110
                    [&::-moz-range-thumb]:border-0"
                  style={{ height: '0px' }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
