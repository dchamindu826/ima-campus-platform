import React, { useState, useRef, useEffect } from 'react';
import { FaChevronDown } from 'react-icons/fa';

export default function CustomSelect({ options, value, onChange, placeholder = 'Select...', className = '' }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    const selectedOption = options.find(opt => String(opt.value) === String(value));

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <input type="hidden" name="staffId" value={value || ''} />
            <div 
                className="w-full bg-[#1e293b] border border-slate-600 text-slate-200 rounded-lg p-2 text-xs flex justify-between items-center cursor-pointer hover:border-emerald-500 hover:bg-[#273549] transition-all shadow-sm"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex-1 overflow-hidden whitespace-nowrap text-left pr-2 flex items-center gap-1.5 font-medium">
                    {selectedOption ? selectedOption.label : <span className="text-slate-400 font-medium">{placeholder}</span>}
                </div>
                <FaChevronDown className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-emerald-400' : ''}`} size={10} />
            </div>

            {isOpen && (
                <div className="absolute z-[9999] mt-1.5 w-full min-w-[220px] bg-[#0f172a] border border-slate-600 rounded-xl shadow-2xl shadow-black max-h-64 overflow-y-auto custom-scrollbar p-1 left-0">
                    {options.map((opt, idx) => (
                        <div 
                            key={idx}
                            className={`p-2 px-3 text-xs rounded-lg flex items-center gap-2 cursor-pointer transition-all ${String(opt.value) === String(value) ? 'bg-emerald-600/30 text-emerald-300 font-bold' : 'text-slate-200 hover:bg-[#1e293b] hover:text-white'}`}
                            onClick={() => {
                                onChange({ target: { value: opt.value, name: 'staffId' } });
                                setIsOpen(false);
                            }}
                        >
                            {opt.label}
                        </div>
                    ))}
                    {options.length === 0 && (
                        <div className="p-2.5 px-3 text-xs text-slate-400 italic">No options available</div>
                    )}
                </div>
            )}
        </div>
    );
}
