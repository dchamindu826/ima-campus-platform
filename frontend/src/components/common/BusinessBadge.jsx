import React from 'react';
import { FaPalette, FaChartLine, FaLaptopCode, FaBookOpen, FaLanguage, FaBuilding, FaBriefcase, FaStore, FaSuitcase, FaGlobe, FaHeadset } from 'react-icons/fa';

// A generic pool of icons and colors for future unknown businesses
const fallbackIcons = [FaBuilding, FaBriefcase, FaStore, FaSuitcase];
const fallbackColors = [
    'from-emerald-500 to-teal-600 text-white',
    'from-violet-500 to-purple-600 text-white',
    'from-amber-500 to-orange-600 text-white',
    'from-rose-500 to-red-600 text-white',
    'from-cyan-500 to-blue-600 text-white',
];

const getBusinessConfig = (bizString) => {
    if (!bizString || bizString === 'ALL' || bizString.toString().toLowerCase().includes('undefined') || bizString.toString().toLowerCase().includes('null')) {
        return { 
            Icon: FaGlobe, 
            label: 'GENERAL', 
            colors: 'from-slate-600 to-slate-800 text-white border-slate-500' 
        };
    }

    const lower = bizString.toLowerCase().trim();

    if (lower.includes('art')) {
        return { Icon: FaPalette, label: 'ART', colors: 'from-pink-500 to-purple-600 text-white border-pink-400' };
    }
    if (lower.includes('commerce')) {
        return { Icon: FaChartLine, label: 'COM', colors: 'from-blue-500 to-cyan-600 text-white border-blue-400' };
    }
    if (lower.includes('tech') || lower.includes('ටෙක්')) {
        return { Icon: FaLaptopCode, label: 'TECH', colors: 'from-teal-500 to-emerald-600 text-white border-teal-400' };
    }
    if (lower.includes('o/l') || lower.includes('ordinary')) {
        return { Icon: FaBookOpen, label: 'O/L', colors: 'from-orange-500 to-red-600 text-white border-orange-400' };
    }
    if (lower.includes('english')) {
        return { Icon: FaLanguage, label: 'ENG', colors: 'from-indigo-500 to-blue-600 text-white border-indigo-400' };
    }

    // Hash the string to pick a consistent fallback icon and color for future businesses
    let hash = 0;
    for (let i = 0; i < lower.length; i++) {
        hash = lower.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const iconIndex = Math.abs(hash) % fallbackIcons.length;
    const colorIndex = Math.abs(hash) % fallbackColors.length;

    // Try to get a short 3-4 letter abbreviation
    const words = bizString.split(' ').filter(w => w.length > 0);
    let label = bizString.substring(0, 3).toUpperCase();
    if (words.length > 1) {
        label = words.map(w => w[0]).join('').substring(0, 3).toUpperCase();
    }

    return {
        Icon: fallbackIcons[iconIndex],
        label: label,
        colors: `${fallbackColors[colorIndex]} border-white/20`
    };
};

const BusinessBadge = ({ businessType, role, className = '' }) => {
    if (role === 'CALLER' || role === 'CALL_CENTER') {
        return (
            <div className={`flex flex-wrap gap-1 ${className}`}>
                <span 
                    title="Call Center"
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shadow-sm border from-orange-500 to-amber-600 text-white border-orange-400`}
                >
                    <FaHeadset className="w-2.5 h-2.5" />
                    CALL CENTER
                </span>
            </div>
        );
    }

    if (!businessType) return null;

    // Sometimes users might have multiple businesses separated by comma (e.g., 'Art,Commerce')
    const bizList = businessType.split(',').map(b => b.trim()).filter(Boolean);

    return (
        <div className={`flex flex-wrap gap-1 ${className}`}>
            {bizList.map((biz, idx) => {
                const { Icon, label, colors } = getBusinessConfig(biz);
                return (
                    <span 
                        key={idx} 
                        title={biz}
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shadow-sm border ${colors}`}
                    >
                        <Icon className="w-2.5 h-2.5" />
                        {label}
                    </span>
                );
            })}
        </div>
    );
};

export default BusinessBadge;
