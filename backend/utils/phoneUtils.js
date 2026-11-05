function normalizePhone(phone) {
    if (!phone) return null;
    let [baseNumber, ...rest] = String(phone).split('_');
    let suffix = rest.length > 0 ? '_' + rest.join('_') : '';
    
    // Remove non-numeric characters from base
    let cleanBase = baseNumber.replace(/[^0-9]/g, '');
    
    if (cleanBase.startsWith('07')) {
        cleanBase = '94' + cleanBase.slice(1);
    } else if (cleanBase.length === 9 && cleanBase.startsWith('7')) {
        cleanBase = '94' + cleanBase;
    }
    
    return cleanBase + suffix;
}

module.exports = {
    normalizePhone
};
