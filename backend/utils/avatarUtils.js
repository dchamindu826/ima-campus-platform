function getCanonicalPhone(phone) {
    if (!phone) return '';
    let digits = String(phone).split('_')[0].replace(/[^0-9]/g, '');
    if (digits.startsWith('94') && digits.length > 9) {
        digits = digits.substring(2);
    } else if (digits.startsWith('0') && digits.length > 9) {
        digits = digits.substring(1);
    }
    return digits;
}

function getAvatarForPhone(phone) {
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

module.exports = {
    getCanonicalPhone,
    getAvatarForPhone
};
