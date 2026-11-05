const { PrismaClient } = require('@prisma/client');
const prisma = require('../src/core/db');
const { google } = require('googleapis');
const path = require('path');

const getGSheetAuth = () => {
    const saPath = path.join(__dirname, '..', 'gsheet-service-account.json');
    try {
        const authClient = new google.auth.GoogleAuth({
            keyFile: saPath,
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
        return google.sheets({ version: 'v4', auth: authClient });
    } catch (e) {
        console.error("GSheet Auth Error:", e);
        return null;
    }
};

const fetchGSheetTransactions = async (targetBatchId = null) => {
    try {
        const configSetting = await prisma.appSetting.findUnique({ where: { key: 'GSHEET_CONFIGS' } });
        if (!configSetting || !configSetting.value) return { headers: [], rows: [] };

        const configs = JSON.parse(configSetting.value);
        let spreadsheetIds = [];
        
        for (const bizId in configs) {
            if (typeof configs[bizId] === 'object' && configs[bizId] !== null) {
                for (const batchId in configs[bizId]) {
                    if (targetBatchId && String(batchId) === String(targetBatchId)) {
                        if (Array.isArray(configs[bizId][batchId])) {
                            spreadsheetIds.push(...configs[bizId][batchId]);
                        }
                    }
                }
            }
        }

        if (spreadsheetIds.length === 0) return { headers: [], rows: [] };

        const sheets = getGSheetAuth();
        if (!sheets) return { headers: [], rows: [] };

        let allRows = [];

        for (const idString of spreadsheetIds) {
            const parts = idString.split('|');
            const spreadsheetId = parts[0];
            const targetGid = parts[1] || null;

            try {
                const sheetMetadata = await sheets.spreadsheets.get({ spreadsheetId });
                let sheetTitles = sheetMetadata.data.sheets.map(s => s.properties.title);
                
                if (targetGid) {
                    const matchingSheet = sheetMetadata.data.sheets.find(s => String(s.properties.sheetId) === String(targetGid));
                    if (matchingSheet) sheetTitles = [matchingSheet.properties.title];
                }
                
                if (sheetTitles.length > 0) {
                    const ranges = sheetTitles.map(t => `'${t}'!A:Z`);
                    const response = await sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges });
                    if (response.data.valueRanges) {
                        response.data.valueRanges.forEach((vr, i) => {
                            if (vr.values && vr.values.length > 0) {
                                let values = vr.values;
                                let headers = values[0].map(h => String(h).trim());
                                let dataRows = values.slice(1);
                                
                                dataRows.forEach((row, rowIndex) => {
                                    let rowObj = {
                                        _rowIndex: rowIndex + 2,
                                        _sheetName: sheetTitles[i],
                                        _spreadsheetId: spreadsheetId,
                                        isMatched: false
                                    };
                                    row.forEach((cell, cellIndex) => {
                                        if (headers[cellIndex]) {
                                            rowObj[headers[cellIndex]] = cell;
                                            if (String(cell).trim() === 'Verified') rowObj.isMatched = true;
                                        }
                                    });
                                    allRows.push(rowObj);
                                });
                            }
                        });
                    }
                }
            } catch (err) {
                console.error("GSheet fetch error:", err.message);
            }
        }

        return { rows: allRows };
    } catch (error) {
        console.error("fetchGSheetTransactions Error:", error);
        return { rows: [] };
    }
};

const markPaymentOnGSheet = async (paymentId) => {
    try {
        const fullPayment = await prisma.payment.findUnique({
            where: { id: parseInt(paymentId) },
            include: {
                actionedUser: true,
                business: true,
                batch: true,
                student: true
            }
        });

        if (!fullPayment || !fullPayment.batchId) return;

        let cleanTxnId = '';
        if (fullPayment.remark) {
            // Try to extract txn ID from remark, e.g. "Reference: 12345" or similar
            let lines = fullPayment.remark.split('\n');
            for (let line of lines) {
                if (line.includes('Extracted ID:') || line.includes('Reference:')) {
                    const match = line.match(/(?:Extracted ID:|Reference:|Cleaned:)\s*([A-Za-z0-9]+)/i);
                    if (match) {
                        cleanTxnId = match[1].trim();
                        break;
                    }
                }
            }
        }
        
        // If no txnId found, we will still try to match by amount and date (though harder)
        const targetAmount = parseFloat(fullPayment.amount);
        const gSheetData = await fetchGSheetTransactions(fullPayment.batchId);
        const gRows = gSheetData.rows || [];
        
        if (gRows.length === 0) return;

        let matchedRow = null;
        let matchedRowIndex = -1;

        for (const row of gRows) {
            if (row.isMatched) continue;
            
            let hasMatchingAmount = false;
            for (const [key, val] of Object.entries(row)) {
                if (key.startsWith('_')) continue;
                let strVal = String(val).replace(/,/g, '');
                let match = strVal.match(/\d+(\.\d+)?/);
                let cAmt = match ? parseFloat(match[0]) : NaN;
                if (!isNaN(cAmt) && Math.abs(cAmt - targetAmount) <= 0.1) {
                    hasMatchingAmount = true;
                    break;
                }
            }
            if (!hasMatchingAmount) continue;

            const normRowRef = Object.values(row).join(' ').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            const numbersOnlyRef = normRowRef.replace(/[^0-9]/g, '');
            const cleanTxnAlphanumeric = cleanTxnId ? cleanTxnId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';
            const cleanTxnNumbers = cleanTxnId ? cleanTxnId.replace(/[^0-9]/g, '').replace(/^0+/, '') : '';
            
            let matchFound = false;
            if (cleanTxnAlphanumeric && cleanTxnAlphanumeric.length >= 4 && normRowRef.includes(cleanTxnAlphanumeric)) {
                matchFound = true;
            } else if (cleanTxnNumbers && cleanTxnNumbers.length >= 6 && numbersOnlyRef.includes(cleanTxnNumbers)) {
                matchFound = true;
            } else if (fullPayment.student) {
                const phoneMatch = fullPayment.student.phone.replace(/[^0-9]/g, '');
                if (phoneMatch && phoneMatch.length >= 7 && normRowRef.includes(phoneMatch)) matchFound = true;
                if (fullPayment.student.firstName && normRowRef.includes(fullPayment.student.firstName.toLowerCase())) matchFound = true;
            }

            if (matchFound) {
                matchedRow = row;
                matchedRowIndex = row._rowIndex;
                break;
            }
        }

        if (matchedRow && matchedRow._spreadsheetId) {
            const sheets = getGSheetAuth();
            if (!sheets) return;

            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: matchedRow._spreadsheetId,
                range: `'${matchedRow._sheetName}'!A1:Z1`,
            });

            if (response.data.values && response.data.values.length > 0) {
                const headers = response.data.values[0];
                const sysHeaders = ['Status', 'Verified by', 'Student Name', 'Number', 'Business', 'Batch', 'Subjects'];
                
                const getHeaderAliases = (sh) => {
                    const s = sh.toLowerCase();
                    if (s === 'student name') return ['student name', 'name', 'student'];
                    if (s === 'number') return ['number', 'phone', 'mobile', 'contact', 'whatsapp', 'phone number'];
                    if (s === 'batch') return ['batch', 'stream', 'course'];
                    if (s === 'business') return ['business', 'company', 'institute'];
                    if (s === 'subjects') return ['subjects', 'subject', 'class', 'classes'];
                    if (s === 'verified by') return ['verified by', 'actioned by', 'checked by'];
                    return [s];
                };

                let startColIndex = headers.length;
                const missingHeaders = sysHeaders.filter(sh => {
                    const aliases = getHeaderAliases(sh);
                    return !headers.find(h => h && aliases.includes(h.toString().trim().toLowerCase()));
                });

                if (missingHeaders.length > 0) {
                    const newHeaderRow = [...headers];
                    missingHeaders.forEach(sh => newHeaderRow.push(sh));
                    const endColLtr = String.fromCharCode(65 + newHeaderRow.length - 1);
                    
                    await sheets.spreadsheets.values.update({
                        spreadsheetId: matchedRow._spreadsheetId,
                        range: `'${matchedRow._sheetName}'!A1:${endColLtr}1`,
                        valueInputOption: 'USER_ENTERED',
                        requestBody: { values: [newHeaderRow] }
                    });
                    missingHeaders.forEach(sh => headers.push(sh));
                }

                    const statusStr = fullPayment.status === 1 ? 'Verified' : (fullPayment.status === 2 ? 'Rejected' : 'Pending');
                    const actionedByStr = fullPayment.actionedUser ? `${fullPayment.actionedUser.firstName} ${fullPayment.actionedUser.lastName}` : 'Manual Admin';
                    const studentNameStr = fullPayment.student ? `${fullPayment.student.firstName} ${fullPayment.student.lastName}` : 'N/A';
                    const numberStr = fullPayment.student ? fullPayment.student.phone : 'N/A';
                    const businessStr = fullPayment.business ? fullPayment.business.name : 'N/A';
                    const batchStr = fullPayment.batch ? fullPayment.batch.name : 'N/A';

                    const courses = await prisma.course.findMany({ select: { id: true, name: true } });
                    const courseMap = {};
                    courses.forEach(c => courseMap[c.id] = c.name);
                    
                    let subjectsStr = fullPayment.subjects || 'N/A';
                    if (typeof subjectsStr === 'string' && subjectsStr.trim().startsWith('[')) {
                        try {
                            const ids = JSON.parse(subjectsStr.trim());
                            if (Array.isArray(ids)) subjectsStr = ids.map(id => courseMap[id] || id).join(', ');
                        } catch (e) {}
                    }

                    const getColumnLetter = (colIndex) => {
                        let letter = '';
                        let temp = colIndex;
                        while (temp >= 0) {
                            letter = String.fromCharCode(temp % 26 + 65) + letter;
                            temp = Math.floor(temp / 26) - 1;
                        }
                        return letter;
                    };

                    const updateData = [];
                    sysHeaders.forEach((sh, idx) => {
                        const aliases = getHeaderAliases(sh);
                        let hIdx = headers.findIndex(h => h && aliases.includes(h.toString().trim().toLowerCase()));
                        const vals = [statusStr, actionedByStr, studentNameStr, numberStr, businessStr, batchStr, subjectsStr];
                        
                        if (hIdx === -1) {
                            hIdx = startColIndex++;
                            headers.push(sh); // in case we append multiple missing headers
                        }
                        
                        const colLetter = getColumnLetter(hIdx);
                        updateData.push({
                            range: `'${matchedRow._sheetName}'!${colLetter}${matchedRowIndex}`,
                            values: [[vals[idx]]]
                        });
                    });

                    await sheets.spreadsheets.values.batchUpdate({
                        spreadsheetId: matchedRow._spreadsheetId,
                        requestBody: {
                            valueInputOption: 'USER_ENTERED',
                            data: updateData
                        }
                    });

                    if (fullPayment.status === 1) {
                        try {
                            const sheetMetaResponse = await sheets.spreadsheets.get({ spreadsheetId: matchedRow._spreadsheetId });
                            const sheetId = sheetMetaResponse.data.sheets.find(s => s.properties.title === matchedRow._sheetName)?.properties.sheetId;
                            
                            if (sheetId !== undefined) {
                                await sheets.spreadsheets.batchUpdate({
                                    spreadsheetId: matchedRow._spreadsheetId,
                                    requestBody: {
                                        requests: [{
                                            repeatCell: {
                                                range: {
                                                    sheetId: sheetId,
                                                    startRowIndex: matchedRowIndex - 1,
                                                    endRowIndex: matchedRowIndex,
                                                    startColumnIndex: 0,
                                                    endColumnIndex: headers.length
                                                },
                                                cell: {
                                                    userEnteredFormat: {
                                                        backgroundColor: { red: 0.85, green: 0.93, blue: 0.83 }
                                                    }
                                                },
                                                fields: 'userEnteredFormat.backgroundColor'
                                            }
                                        }]
                                    }
                                });
                            }
                        } catch (e) {}
                    }
                    console.log('Successfully wrote back to GSheet manually.');
            }
        }
    } catch (e) {
        console.error("markPaymentOnGSheet Error:", e);
    }
};

module.exports = { markPaymentOnGSheet };
