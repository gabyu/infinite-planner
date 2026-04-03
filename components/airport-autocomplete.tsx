'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface Airport {
  ICAO: string;
  Name: string;
  Lat: number;
  Long: number;
}

interface AirportAutocompleteProps {
  value: string;
  onChange: (icao: string) => void;
  placeholder?: string;
  label?: string;
}

export default function AirportAutocomplete({
  value,
  onChange,
  placeholder = 'Search',
  label,
}: AirportAutocompleteProps) {
  const [airports, setAirports] = useState<Airport[]>([]);
  const [input, setInput] = useState(value);
  const [suggestions, setSuggestions] = useState<Airport[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load airports data once
  useEffect(() => {
    const loadAirports = async () => {
      try {
        const response = await fetch('/airports.json');
        const data: Airport[] = await response.json();
        setAirports(data);
        setLoading(false);
      } catch (error) {
        console.error('Failed to load airports:', error);
        setLoading(false);
      }
    };

    loadAirports();
  }, []);

  // Update input when value prop changes
  useEffect(() => {
    setInput(value);
  }, [value]);

  // Filter and search airports
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value.toUpperCase();
    setInput(query);

    if (query.length === 0) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    const filtered = airports.filter(
      (airport) =>
        airport.ICAO.includes(query) || airport.Name.toUpperCase().includes(query)
    );

    setSuggestions(filtered.slice(0, 10)); // Limit to 10 suggestions
    setIsOpen(true);
  };

  // Handle selection
  const handleSelect = (airport: Airport) => {
    setInput(airport.ICAO);
    onChange(airport.ICAO);
    setSuggestions([]);
    setIsOpen(false);
  };

  // Handle blur
  const handleBlur = () => {
    setTimeout(() => setIsOpen(false), 200);
  };

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading) {
    return (
      <div>
        {label && <label className="block text-sm font-medium mb-2">{label}</label>}
        <input
          type="text"
          disabled
          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500"
          placeholder="Loading airports..."
        />
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className="relative">
      {label && <label className="block text-sm font-medium mb-2">{label}</label>}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={handleInputChange}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          onBlur={handleBlur}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <ChevronDown
          size={18}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none"
        />
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-50 max-h-64 overflow-y-auto">
          {suggestions.map((airport) => (
            <button
              key={airport.ICAO}
              onClick={() => handleSelect(airport)}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 focus:outline-none focus:bg-blue-50 transition-colors"
            >
              <div className="font-semibold text-blue-600">{airport.ICAO}</div>
              <div className="text-sm text-gray-600">{airport.Name}</div>
            </button>
          ))}
        </div>
      )}

      {isOpen && input.length >= 2 && suggestions.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-50 p-3 text-gray-500 text-sm">
          No airports found
        </div>
      )}
    </div>
  );
}
