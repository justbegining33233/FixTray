// Enhanced Search and Filter Component
// Makes it easy for users to find and filter content

'use client';

import { useState, useEffect, useRef } from 'react';
import {
  FaSearch,
  FaFilter,
  FaTimes,
  FaSort,
  FaChevronDown,
  FaCalendarAlt,
  FaMapMarkerAlt,
  FaCheck
} from 'react-icons/fa';

interface FilterOption {
  id: string;
  label: string;
  value: string | number;
  count?: number;
}

interface FilterGroup {
  id: string;
  label: string;
  options: FilterOption[];
  type: 'single' | 'multiple';
  allowSearch?: boolean;
}

interface SearchAndFilterProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  onFilter: (filters: Record<string, any>) => void;
  onSort?: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  filterGroups?: FilterGroup[];
  sortOptions?: { id: string; label: string }[];
  showDateRange?: boolean;
  showLocationFilter?: boolean;
  className?: string;
}

export default function SearchAndFilter({
  placeholder = 'Search...',
  onSearch,
  onFilter,
  onSort,
  filterGroups = [],
  sortOptions = [],
  showDateRange = false,
  showLocationFilter = false,
  className = ''
}: SearchAndFilterProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [location, setLocation] = useState('');

  const searchTimeoutRef = useRef<NodeJS.Timeout>(undefined);
  const filterRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      onSearch(searchQuery);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, onSearch]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFilterChange = (groupId: string, value: any, type: 'single' | 'multiple') => {
    const newFilters = { ...activeFilters };

    if (type === 'single') {
      if (newFilters[groupId] === value) {
        delete newFilters[groupId];
      } else {
        newFilters[groupId] = value;
      }
    } else {
      if (!newFilters[groupId]) {
        newFilters[groupId] = [];
      }

      const index = newFilters[groupId].indexOf(value);
      if (index > -1) {
        newFilters[groupId].splice(index, 1);
        if (newFilters[groupId].length === 0) {
          delete newFilters[groupId];
        }
      } else {
        newFilters[groupId].push(value);
      }
    }

    // Include date range and location if applicable
    if (showDateRange && (dateRange.start || dateRange.end)) {
      newFilters.dateRange = dateRange;
    }
    if (showLocationFilter && location) {
      newFilters.location = location;
    }

    setActiveFilters(newFilters);
    onFilter(newFilters);
  };

  const handleSortChange = (newSortBy: string) => {
    const newSortOrder = sortBy === newSortBy && sortOrder === 'desc' ? 'asc' : 'desc';
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    setIsSortOpen(false);

    if (onSort) {
      onSort(newSortBy, newSortOrder);
    }
  };

  const clearFilters = () => {
    setActiveFilters({});
    setDateRange({ start: '', end: '' });
    setLocation('');
    onFilter({});
  };

  const clearSearch = () => {
    setSearchQuery('');
    onSearch('');
  };

  const getActiveFilterCount = () => {
    let count = Object.keys(activeFilters).length;
    if (showDateRange && (dateRange.start || dateRange.end)) count++;
    if (showLocationFilter && location) count++;
    return count;
  };

  const hasActiveFilters = getActiveFilterCount() > 0;

  return (
    <div className={`rounded-lg p-4" style={{background:"rgba(10,16,32,0.68)",border:"1px solid rgba(255,255,255,0.08)"}} ${className}`}>
      {/* Search Bar */}
      <div className="flex items-center space-x-4 mb-4">
        <div className="flex-1 relative">
          <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder={placeholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <FaTimes className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Button */}
        {filterGroups.length > 0 && (
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`flex items-center space-x-2 px-4 py-2 border rounded-lg transition-colors ${
                hasActiveFilters
                  ? 'border-[#e5332a] bg-[rgba(229,51,42,0.1)] text-[#e5332a]'
                  : 'border-[rgba(255,255,255,0.12)] text-[#94a3b8] hover:bg-[rgba(255,255,255,0.06)]'
              }`}
            >
              <FaFilter className="w-4 h-4" />
              <span>Filters</span>
              {hasActiveFilters && (
                <span className="text-white text-xs rounded-full w-5 h-5 flex items-center justify-center" style={{background:'#e5332a'}}>
                  {getActiveFilterCount()}
                </span>
              )}
              <FaChevronDown className={`w-3 h-3 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Filter Dropdown */}
            {isFilterOpen && (
              <div className="absolute top-full mt-2 right-0 w-80 rounded-lg shadow-lg z-50" style={{background:"rgba(10,16,32,0.95)",border:"1px solid rgba(255,255,255,0.1)"}}>
                <div className="p-4 max-h-96 overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">Filters</h3>
                    {hasActiveFilters && (
                      <button
                        onClick={clearFilters}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        Clear all
                      </button>
                    )}
                  </div>

                  {/* Date Range Filter */}
                  {showDateRange && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <FaCalendarAlt className="inline w-4 h-4 mr-1" />
                        Date Range
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          value={dateRange.start}
                          onChange={(e) => {
                            const newRange = { ...dateRange, start: e.target.value };
                            setDateRange(newRange);
                            handleFilterChange('dateRange', newRange, 'single');
                          }}
                          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                        <input
                          type="date"
                          value={dateRange.end}
                          onChange={(e) => {
                            const newRange = { ...dateRange, end: e.target.value };
                            setDateRange(newRange);
                            handleFilterChange('dateRange', newRange, 'single');
                          }}
                          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                      </div>
                    </div>
                  )}

                  {/* Location Filter */}
                  {showLocationFilter && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <FaMapMarkerAlt className="inline w-4 h-4 mr-1" />
                        Location
                      </label>
                      <input
                        type="text"
                        placeholder="Enter location..."
                        value={location}
                        onChange={(e) => {
                          setLocation(e.target.value);
                          handleFilterChange('location', e.target.value, 'single');
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      />
                    </div>
                  )}

                  {/* Filter Groups */}
                  {filterGroups.map((group) => (
                    <div key={group.id} className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {group.label}
                      </label>
                      <div className="space-y-2">
                        {group.options.map((option) => {
                          const isSelected = group.type === 'single'
                            ? activeFilters[group.id] === option.value
                            : activeFilters[group.id]?.includes(option.value);

                          return (
                            <label
                              key={option.id}
                              className="flex items-center space-x-2 cursor-pointer hover:bg-[rgba(255,255,255,0.06)] p-1 rounded"
                            >
                              <input
                                type={group.type === 'single' ? 'radio' : 'checkbox'}
                                name={group.id}
                                value={option.value}
                                checked={isSelected}
                                onChange={() => handleFilterChange(group.id, option.value, group.type)}
                                className="text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-700">{option.label}</span>
                              {option.count !== undefined && (
                                <span className="text-xs text-[#94a3b8] px-2 py-1 rounded-full" style={{background:"rgba(255,255,255,0.08)"}}>
                                  {option.count}
                                </span>
                              )}
                              {isSelected && (
                                <FaCheck className="w-3 h-3 text-blue-600" />
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sort Button */}
        {sortOptions.length > 0 && onSort && (
          <div className="relative" ref={sortRef}>
            <button
              onClick={() => setIsSortOpen(!isSortOpen)}
              className="flex items-center space-x-2 px-4 py-2 border border-[rgba(255,255,255,0.12)] rounded-lg text-[#94a3b8] hover:bg-[rgba(255,255,255,0.06)] transition-colors"
            >
              <FaSort className="w-4 h-4" />
              <span>Sort</span>
              <FaChevronDown className={`w-3 h-3 transition-transform ${isSortOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Sort Dropdown */}
            {isSortOpen && (
              <div className="absolute top-full mt-2 right-0 w-48 rounded-lg shadow-lg z-50" style={{background:"rgba(10,16,32,0.95)",border:"1px solid rgba(255,255,255,0.1)"}}>
                <div className="py-2">
                  {sortOptions.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => handleSortChange(option.id)}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-[rgba(255,255,255,0.06)] transition-colors ${
                        sortBy === option.id ? 'text-[#e5332a] bg-[rgba(229,51,42,0.08)]' : 'text-[#94a3b8]'
                      }`}
                    >
                      {option.label}
                      {sortBy === option.id && (
                        <span className="ml-2">
                          {sortOrder === 'desc' ? '↓' : '↑'}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-600">Active filters:</span>

          {Object.entries(activeFilters).map(([groupId, value]) => {
            const group = filterGroups.find(g => g.id === groupId);
            if (!group) return null;

            if (Array.isArray(value)) {
              return value.map((val) => {
                const option = group.options.find(o => o.value === val);
                return option ? (
                  <span
                    key={`${groupId}-${val}`}
                    className="inline-flex items-center space-x-1 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full"
                  >
                    <span>{option.label}</span>
                    <button
                      onClick={() => handleFilterChange(groupId, val, 'multiple')}
                      className="hover:text-blue-600"
                    >
                      <FaTimes className="w-3 h-3" />
                    </button>
                  </span>
                ) : null;
              });
            } else {
              const option = group.options.find(o => o.value === value);
              return option ? (
                <span
                  key={`${groupId}-${value}`}
                  className="inline-flex items-center space-x-1 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full"
                >
                  <span>{option.label}</span>
                  <button
                    onClick={() => handleFilterChange(groupId, value, 'single')}
                    className="hover:text-blue-600"
                  >
                    <FaTimes className="w-3 h-3" />
                  </button>
                </span>
              ) : null;
            }
          })}

          {(showDateRange && (dateRange.start || dateRange.end)) && (
            <span className="inline-flex items-center space-x-1 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
              <span>
                {dateRange.start && dateRange.end
                  ? `${dateRange.start} to ${dateRange.end}`
                  : dateRange.start
                    ? `From ${dateRange.start}`
                    : `Until ${dateRange.end}`
                }
              </span>
              <button
                onClick={() => {
                  setDateRange({ start: '', end: '' });
                  handleFilterChange('dateRange', { start: '', end: '' }, 'single');
                }}
                className="hover:text-blue-600"
              >
                <FaTimes className="w-3 h-3" />
              </button>
            </span>
          )}

          {(showLocationFilter && location) && (
            <span className="inline-flex items-center space-x-1 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
              <span>{location}</span>
              <button
                onClick={() => {
                  setLocation('');
                  handleFilterChange('location', '', 'single');
                }}
                className="hover:text-blue-600"
              >
                <FaTimes className="w-3 h-3" />
              </button>
            </span>
          )}

          <button
            onClick={clearFilters}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}