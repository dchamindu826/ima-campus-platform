import api from '../api/axios';

export function getCanonicalPhone(phone) {
    if (!phone) return '';
    let digits = String(phone).split('_')[0].replace(/[^0-9]/g, '');
    if (digits.startsWith('94') && digits.length > 9) {
        digits = digits.substring(2);
    } else if (digits.startsWith('0') && digits.length > 9) {
        digits = digits.substring(1);
    }
    return digits;
}

export function getAvatarForPhone(phone) {
    const core = getCanonicalPhone(phone);
    if (!core) return { dpCode: '01.jpg', imagePath: 'chat_dps/01.jpg' };
    let hash = 0;
    for (let i = 0; i < core.length; i++) {
        hash = (hash * 31 + core.charCodeAt(i)) >>> 0;
    }
    const num = (hash % 20) + 1;
    const dpCode = `${String(num).padStart(2, '0')}.jpg`;
    return {
        dpCode,
        imagePath: `chat_dps/${dpCode}`
    };
}

export function resolveAvatarUrl(avatarOrImage, phone, backendBaseUrl = '') {
    let candidate = null;
    const isGood = (v) => v && v !== 'default.png' && v !== 'null' && v !== 'undefined' && String(v).trim() !== '';

    if (Array.isArray(avatarOrImage)) {
        for (const item of avatarOrImage) {
            if (isGood(item)) {
                candidate = item;
                break;
            }
        }
    } else if (isGood(avatarOrImage)) {
        candidate = avatarOrImage;
    }

    const raw = candidate || (phone ? getAvatarForPhone(phone).imagePath : 'chat_dps/01.jpg');
    if (!raw) return '';
    if (raw.startsWith('http')) return raw;
    const effectiveBase = backendBaseUrl || api?.defaults?.baseURL || '';
    const base = effectiveBase.replace(/\/api\/?$/, '');
    if (raw.startsWith('/')) return `${base}${raw}`;
    return `${base}/storage/images/${raw}`;
}
