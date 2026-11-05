require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const xlsx = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const prisma = new PrismaClient();
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/uploads', express.static('uploads'));

const upload = multer({ dest: 'uploads/' });

const API_PASSWORD = 'AISLipTest#2026';

// Middleware for Basic Auth
const checkAuth = (req, res, next) => {
  const password = req.headers['x-api-password'];
  if (password === API_PASSWORD) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// 1. Auth Endpoint
app.post('/api/auth', (req, res) => {
  const { password } = req.body;
  if (password === API_PASSWORD) {
    res.json({ success: true, token: API_PASSWORD });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

// 2. Fetch Students
app.get('/api/students', checkAuth, async (req, res) => {
  try {
    const students = await prisma.mockStudent.findMany({
      orderBy: { id: 'desc' },
      include: { payments: { orderBy: { id: 'desc' } } }
    });
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Student
app.put('/api/students/:id', checkAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, subject, feeAmount } = req.body;
    const updated = await prisma.mockStudent.update({
      where: { id: parseInt(id) },
      data: { 
        name: name !== undefined ? name : undefined,
        subject: subject !== undefined ? subject : undefined,
        feeAmount: feeAmount !== undefined ? parseFloat(feeAmount) : undefined
      }
    });
    res.json({ success: true, updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2.1 Create Custom Student
app.post('/api/students', checkAuth, async (req, res) => {
  try {
    const { name, subject, feeAmount, batch, phone } = req.body;
    const studentId = 'STU-' + Math.floor(1000 + Math.random() * 9000); // Generate random STU ID
    
    const student = await prisma.mockStudent.create({
      data: {
        studentId,
        name,
        subject,
        feeAmount: parseFloat(feeAmount),
        batch: batch || null,
        phone: phone || null
      }
    });
    res.json({ success: true, student });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Upload Statement (Excel/CSV)
app.post('/api/upload-statement', checkAuth, upload.single('statement'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    const workbook = xlsx.readFile(req.file.path);
    let data = [];
    
    // Process ALL sheets in the workbook
    for (const sheetName of workbook.SheetNames) {
      let sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
      sheetData = sheetData.map(row => ({ ...row, __sheetName: sheetName }));
      data = data.concat(sheetData);
    }
    
    const batchId = Date.now().toString();
    const rows = [];
    
    for (const row of data) {
      // Find keys case-insensitively to handle variations like "Transaction Date", "Referance"
      const getVal = (possibleKeys) => {
        const key = Object.keys(row).find(k => 
          possibleKeys.some(pk => k.toLowerCase().includes(pk.toLowerCase()))
        );
        return key ? row[key] : '';
      };

      let date = getVal(['date', 'txn date', 'value date', 'time']);
      const desc = getVal(['desc', 'particular', 'narration', 'detail', 'remark']);
      const ref = getVal(['ref', 'transaction id', 'trace', 'journal', 'chq']);
      let amtStr = getVal(['amount', 'amt', 'credit', 'cr', 'deposit', 'value']);

      // Excel dates can be numeric (e.g. 46213)
      if (typeof date === 'number') {
        const jsDate = new Date((date - (25567 + 2)) * 86400 * 1000); // Excel epoch conversion
        date = jsDate.toISOString().split('T')[0];
      }
      
      const amt = parseFloat(String(amtStr).replace(/,/g, '')) || 0;
      
      if (date && (ref || desc) && amt) {
        rows.push({
          uploadBatchId: batchId,
          date: String(date),
          description: String(desc),
          referenceNo: String(ref),
          amount: amt,
          sheetName: row.__sheetName || null
        });
      }
    }
    
    console.log(`[UPLOAD-STATEMENT] Processed ${data.length} raw rows. Found ${rows.length} valid rows.`);
    if (data.length > 0 && rows.length === 0) {
        console.log(`[UPLOAD-STATEMENT] First raw row keys:`, Object.keys(data[0]));
        console.log(`[UPLOAD-STATEMENT] First raw row values:`, Object.values(data[0]));
    }
    
    if (rows.length > 0) {
      await prisma.statementRow.createMany({ data: rows });
    }
    
    res.json({ success: true, rowsInserted: rows.length, batchId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Fetch Statements
app.get('/api/statements', checkAuth, async (req, res) => {
  try {
    const rows = await prisma.statementRow.findMany({
      orderBy: { id: 'desc' }
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4.1 Delete All Statements
app.delete('/api/statements', checkAuth, async (req, res) => {
  try {
    await prisma.statementRow.deleteMany({});
    res.json({ success: true, message: 'All statements erased' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Upload Slip (No AI Verification yet)
app.post('/api/upload-slip', checkAuth, upload.single('slip'), async (req, res) => {
  try {
    const { studentId } = req.body;
    if (!req.file || !studentId) {
      return res.status(400).json({ error: 'Missing slip or studentId' });
    }
    const payment = await prisma.mockPayment.create({
      data: {
        studentId: parseInt(studentId),
        slipUrl: `/api/uploads/${req.file.filename}`,
        status: 'PENDING',
        remark: 'Slip uploaded. Awaiting Verification.'
      }
    });
    res.json({ success: true, payment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5.1 AI Slip Verification Endpoint (Single)
const fs = require('fs');
const path = require('path');

function fileToGenerativePart(filePath, mimeType) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(filePath)).toString("base64"),
      mimeType
    },
  };
}

app.post('/api/verify-payment/:id', checkAuth, async (req, res) => {
  try {
    const paymentId = parseInt(req.params.id);
    const payment = await prisma.mockPayment.findUnique({ where: { id: paymentId } });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    
    if (payment.status !== 'PENDING') {
       return res.json({ success: true, payment });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
      You are a highly accurate Bank Slip Verification AI. 
      Analyze the attached bank slip image. 
      Extract the following fields and return ONLY a valid JSON object. No markdown formatting like \`\`\`json.
      If a field is not found, return null for that field.
      
      {
        "is_valid_bank_slip": true, // CRITICAL: Set to false if this is a selfie, a generic photo, a screen recording, or NOT a valid bank transaction receipt/slip. Only true if it is a clear bank deposit slip or online transfer screenshot.
        "date": "YYYY-MM-DD", // CRITICAL: If the date on the slip is in DD/MM/YY or MM/DD/YY format (e.g. 05/07/26), assume the LAST two digits are the year (2026). Do NOT extract 2005 as the year.
        "amount": 1500, // Number format without commas
        "referenceNo": "123456789", // Extract the reference number, trace number, or transaction ID.
        "bankName": "Bank Name",
        "depositorName": "Name of depositor or sender",
        "accountNumber": "Account number",
        "remark": "Any remarks, narration, or description",
        "branch": "Branch name or code",
        "all_text_tokens": ["word1", "word2", "1234", "A0001931"] // CRITICAL: Extract EVERY SINGLE string of text, number, and identifier visible on the slip into this array. This is used for advanced matching.
      }
    `;

    let extractedData = null;
    let isFake = false;

    try {
      // payment.slipUrl is like /api/uploads/filename
      const filename = payment.slipUrl.split('/').pop();
      const filePath = path.join(__dirname, 'uploads', filename);
      
      // Determine mimetype from extension roughly, though Gemini can often handle general images
      const ext = path.extname(filename).toLowerCase();
      let mimeType = 'image/jpeg';
      if (ext === '.png') mimeType = 'image/png';
      else if (ext === '.webp') mimeType = 'image/webp';
      
      const imagePart = fileToGenerativePart(filePath, mimeType);
      const result = await model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const text = response.text().trim().replace(/```json/g, '').replace(/```/g, '');
      extractedData = JSON.parse(text);
      if (extractedData.is_valid_bank_slip === false) {
          isFake = true;
      }
    } catch (e) {
      console.error("AI Extraction Error:", e);
      return res.status(500).json({ error: "AI Processing Failed" });
    }

    // Validation / Tallying Logic
    let status = isFake ? 'REJECTED' : 'PENDING';
    let matchedRowId = null;
    let aiRemark = isFake 
      ? 'Automated Verification Unsuccessful.\n• Issue: Irregularities detected in document structure.\n• Reason: May not be a genuine transaction receipt.\n• Decision: Rejected.' 
      : `Automated Verification Unsuccessful.\n• Extracted Amount: LKR ${extractedData?.amount || 'N/A'}\n• Extracted Ref: ${extractedData?.referenceNo || 'N/A'}\n• Status: Failed to authenticate\n• Reason: Do not correspond to any pending target statement entries.\n• Decision: Skipped for manual review.`;

    if (!isFake && extractedData && extractedData.amount) {
      const slipAmount = parseFloat(extractedData.amount);
      const slipDateObj = extractedData.date ? new Date(extractedData.date) : null;
      
      const statements = await prisma.statementRow.findMany({
        where: { isMatched: false }
      });
      
      console.log(`[VERIFY-PAYMENT] Payment ID: ${paymentId}. Extracted Amount: ${slipAmount}. Date: ${extractedData.date}`);

      for (const row of statements) {
        if (row.amount === slipAmount) {
          console.log(`[VERIFY-PAYMENT] Found matching amount in row ${row.id}: ${row.amount}. Row date: ${row.date}, Slip date: ${extractedData.date}`);
          let dateMatch = false;
          if (!slipDateObj || !row.date) {
             dateMatch = true;
          } else {
             const rowDateObj = new Date(row.date);
             if (!isNaN(rowDateObj.getTime()) && !isNaN(slipDateObj.getTime())) {
                 const diffTime = Math.abs(rowDateObj - slipDateObj);
                 const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                 if (diffDays <= 2) {
                     dateMatch = true;
                 } else {
                     const rowM = rowDateObj.getMonth();
                     const rowD = rowDateObj.getDate();
                     const rowY = rowDateObj.getFullYear();
                     
                     let slipM = slipDateObj.getMonth();
                     let slipD = slipDateObj.getDate();
                     let slipY = slipDateObj.getFullYear();
                     
                     // If AI extracted a year < 2010 but the day is > 20, it likely read YY/MM/DD as DD/MM/YY
                     // e.g. 05/07/26 parsed as 2005-07-26 instead of 2026-07-05
                     if (slipY < 2010 && slipD > 20) {
                         slipY = 2000 + slipD;
                         slipD = slipDateObj.getFullYear() % 100;
                     }
                     
                     if (rowM === slipD - 1 && rowD === slipM + 1 && rowY === slipY) {
                         dateMatch = true; // Handle MM/DD swap
                     } else if (rowY === slipY && rowM === slipM && Math.abs(rowD - slipD) <= 2) {
                         dateMatch = true; // Handle fixed year mismatch but close days
                     }
                 }
              } else {
                dateMatch = true; 
             }
          }

          console.log(`[VERIFY-PAYMENT] dateMatch for row ${row.id}: ${dateMatch}`);

          if (dateMatch) {
            const remainingSlipData = [
                extractedData.referenceNo,
                extractedData.depositorName,
                extractedData.remark,
                extractedData.bankName,
                extractedData.accountNumber,
                extractedData.branch,
                ...(extractedData.all_text_tokens || [])
            ].filter(Boolean).map(s => String(s).toLowerCase().trim());
            
            const statementData = [
                row.referenceNo,
                row.description
            ].filter(Boolean).map(s => String(s).toLowerCase().trim());

            let oneAdditionalMatchFound = false;
            
            for (const slipVal of remainingSlipData) {
                if (slipVal.length < 4) continue;
                if (slipVal.length < 6 && !/\d/.test(slipVal)) continue; // Must be at least 6 chars if no digits, or 4 chars if it has digits
                
                for (const stmtVal of statementData) {
                    if (stmtVal.includes(slipVal) || slipVal.includes(stmtVal)) {
                        console.log(`[VERIFY-PAYMENT] Match found! slipVal: "${slipVal}" stmtVal: "${stmtVal}"`);
                        oneAdditionalMatchFound = true;
                        break;
                    }
                }
                if (oneAdditionalMatchFound) break;
            }

            console.log(`[VERIFY-PAYMENT] oneAdditionalMatchFound for row ${row.id}: ${oneAdditionalMatchFound}`);

            if (oneAdditionalMatchFound) {
              status = 'VERIFIED';
              aiRemark = `Automated Verification Successful.\n• Extracted Amount: LKR ${extractedData.amount || 'N/A'}\n• Extracted Ref: ${extractedData.referenceNo || 'N/A'}\n• Matched Target: Row ID #${row.id}\n• Decision: Verified & Reconciled.`;
              matchedRowId = row.id;
              // Mark row as matched
              await prisma.statementRow.update({
                where: { id: row.id },
                data: { isMatched: true }
              });
              break;
            }
          }
        }
      }
    }

    // Update existing payment
    const updatedPayment = await prisma.mockPayment.update({
      where: { id: paymentId },
      data: {
        status,
        remark: aiRemark,
        extractedDate: extractedData ? extractedData.date : null,
        extractedAmount: extractedData && extractedData.amount ? parseFloat(extractedData.amount) : null,
        extractedRefNo: extractedData ? extractedData.referenceNo : null,
        matchedRowId
      }
    });

    res.json({ success: true, payment: updatedPayment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});



// 6. Bulk AI Slip Verification
app.post('/api/verify-bulk', checkAuth, upload.array('slips', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No slips uploaded' });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
      You are a highly accurate Bank Slip Verification AI. 
      Analyze the attached bank slip image. 
      Extract the following fields and return ONLY a valid JSON object. No markdown formatting like \`\`\`json.
      If a field is not found, return null for that field.
      
      {
        "is_valid_bank_slip": true, // CRITICAL: Set to false if this is a selfie, a generic photo, a screen recording, or NOT a valid bank transaction receipt/slip. Only true if it is a clear bank deposit slip or online transfer screenshot.
        "date": "YYYY-MM-DD",
        "amount": 1500, // Number format without commas
        "referenceNo": "123456789", // Extract the reference number, trace number, or transaction ID.
        "bankName": "Bank Name",
        "depositorName": "Name of depositor or sender",
        "accountNumber": "Account number",
        "remark": "Any remarks, narration, or description",
        "branch": "Branch name or code",
        "studentNameOrId": "Any name, STU-XXX or phone number found on slip"
      }
    `;

    const results = [];

    // Process each file (In a real app, this should be sent to a queue, but we'll do it sequentially/concurrently here for demo)
    for (const file of req.files) {
      try {
        const imagePart = fileToGenerativePart(file.path, file.mimetype);
        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const text = response.text().trim().replace(/```json/g, '').replace(/```/g, '');
        
        const extractedData = JSON.parse(text);
        const isFake = extractedData.is_valid_bank_slip === false;

        let status = isFake ? 'REJECTED' : 'PENDING';
        let matchedRowId = null;

        if (!isFake && extractedData && extractedData.amount) {
          const slipAmount = parseFloat(extractedData.amount);
          const slipDateObj = extractedData.date ? new Date(extractedData.date) : null;
          
          const statements = await prisma.statementRow.findMany({
            where: { isMatched: false }
          });
          
          for (const row of statements) {
            if (row.amount === slipAmount) {
              let dateMatch = false;
              if (!slipDateObj || !row.date) {
                 dateMatch = true;
              } else {
                 const rowDateObj = new Date(row.date);
                 if (!isNaN(rowDateObj.getTime()) && !isNaN(slipDateObj.getTime())) {
                    const diffTime = Math.abs(rowDateObj - slipDateObj);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                    if (diffDays <= 2) {
                        dateMatch = true;
                    } else {
                        const rowM = rowDateObj.getMonth();
                        const rowD = rowDateObj.getDate();
                        const slipM = slipDateObj.getMonth();
                        const slipD = slipDateObj.getDate();
                        if (rowM === slipD - 1 && rowD === slipM + 1 && rowDateObj.getFullYear() === slipDateObj.getFullYear()) {
                            dateMatch = true; // Handle MM/DD swap
                        }
                    }
                 } else {
                    dateMatch = true; 
                 }
              }

              if (dateMatch) {
                const remainingSlipData = [
                    extractedData.referenceNo,
                    extractedData.depositorName,
                    extractedData.remark,
                    extractedData.bankName,
                    extractedData.accountNumber,
                    extractedData.branch
                ].filter(Boolean).map(s => String(s).toLowerCase().trim());
                
                const statementData = [
                    row.referenceNo,
                    row.description
                ].filter(Boolean).map(s => String(s).toLowerCase().trim());

                let oneAdditionalMatchFound = false;
                
                for (const slipVal of remainingSlipData) {
                    if (slipVal.length < 3) continue;
                    for (const stmtVal of statementData) {
                        if (stmtVal.includes(slipVal) || slipVal.includes(stmtVal)) {
                            oneAdditionalMatchFound = true;
                            break;
                        }
                    }
                    if (oneAdditionalMatchFound) break;
                }

                if (oneAdditionalMatchFound) {
                  status = 'VERIFIED';
                  matchedRowId = row.id;
                  await prisma.statementRow.update({
                    where: { id: row.id },
                    data: { isMatched: true }
                  });
                  break;
                }
              }
            }
          }
        }
        
        let studentId = null;
        if (extractedData.studentNameOrId) {
          const possibleId = String(extractedData.studentNameOrId).toLowerCase();
          const students = await prisma.mockStudent.findMany();
          const match = students.find(s => 
            s.studentId.toLowerCase().includes(possibleId) || 
            (s.phone && s.phone.includes(possibleId)) ||
            s.name.toLowerCase().includes(possibleId)
          );
          if (match) {
            studentId = match.id;
          }
        }
        
        if (studentId) {
          await prisma.mockPayment.create({
            data: {
              studentId: studentId,
              slipUrl: `/uploads/${file.filename}`, // dummy URL for now
              status,
              extractedDate: extractedData.date,
              extractedAmount: extractedData.amount ? parseFloat(extractedData.amount) : null,
              extractedRefNo: extractedData.referenceNo,
              matchedRowId
            }
          });
        }
        
        results.push({
          fileName: file.originalname,
          status,
          extractedData
        });
      } catch (err) {
        results.push({
          fileName: file.originalname,
          status: 'ERROR',
          error: err.message
        });
      }
    }

    res.json({ success: true, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Start Server
const PORT = process.env.PORT || 5005;
app.post("/api/manual-verify", checkAuth, async (req, res) => {
  const { paymentId, status, remark } = req.body;
  try {
    const payment = await prisma.mockPayment.findUnique({ where: { id: parseInt(paymentId) } });
    if (!payment) return res.status(404).json({ error: "Payment not found" });

    let finalRemark = remark || '';

    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      
      const prompt = `You are a professional administrative assistant handling bank slip verifications.
      The administrator has manually reviewed a payment slip and marked it as: ${status}.
      The administrator's brief note was: "${remark || 'No specific note provided'}".
      Write a concise, highly professional remark (maximum 2 sentences) explaining this decision. 
      Do not use markdown. Start with "Manual Verification: " if approved, or "Manual Rejection: " if rejected.`;
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      finalRemark = response.text().trim();
    } catch (e) {
      console.error("AI Remark Generation Error:", e);
      finalRemark = `Manual ${status}: ${remark || 'Processed by admin'}`;
    }

    await prisma.mockPayment.update({
      where: { id: parseInt(paymentId) },
      data: {
        status,
        remark: finalRemark,
        isManual: true
      }
    });
    res.json({ success: true, remark: finalRemark });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a slip's details
app.put("/api/payments/:id", checkAuth, async (req, res) => {
  const { extractedRefNo, extractedAmount, status } = req.body;
  try {
    await prisma.mockPayment.update({
      where: { id: parseInt(req.params.id) },
      data: {
        extractedRefNo,
        extractedAmount: extractedAmount ? parseFloat(extractedAmount) : null,
        status
      }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a slip
app.delete("/api/payments/:id", checkAuth, async (req, res) => {
  try {
    await prisma.mockPayment.delete({
      where: { id: parseInt(req.params.id) }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verify all pending slips
app.post("/api/verify-pending-slips", checkAuth, async (req, res) => {
  try {
    const pendingSlips = await prisma.mockPayment.findMany({
      where: { status: 'PENDING' }
    });
    
    let processed = 0;
    
    // Process them sequentially to avoid rate limits
    for (const payment of pendingSlips) {
      let newStatus = 'PENDING';
      let matchedRowId = null;
      
      // Simple mock AI wait
      await new Promise(r => setTimeout(r, 500));
      
      if (payment.extractedRefNo && payment.extractedAmount) {
        const statements = await prisma.statementRow.findMany({
          where: { isMatched: false }
        });
        
        for (const row of statements) {
          if (row.amount === payment.extractedAmount && 
             (row.referenceNo.includes(payment.extractedRefNo) || 
              row.description.includes(payment.extractedRefNo))) {
            newStatus = 'VERIFIED';
            matchedRowId = row.id;
            
            await prisma.statementRow.update({
              where: { id: row.id },
              data: { isMatched: true }
            });
            break;
          }
        }
      }
      
      let remark = payment.remark;
      
      if (newStatus === 'PENDING') {
        newStatus = 'REJECTED'; 
        remark = `Automated Verification Unsuccessful.\n• Extracted Amount: LKR ${payment.extractedAmount || 'N/A'}\n• Extracted Ref: ${payment.extractedRefNo || 'N/A'}\n• Status: Failed to authenticate\n• Reason: Do not correspond to any pending target statement entries.\n• Decision: Skipped for manual review.`;
      } else if (newStatus === 'VERIFIED') {
        remark = `Automated Verification Successful.\n• Extracted Amount: LKR ${payment.extractedAmount}\n• Extracted Ref: ${payment.extractedRefNo}\n• Matched Target: Row ID #${matchedRowId}\n• Decision: Verified & Reconciled.`;
      }
      
      await prisma.mockPayment.update({
        where: { id: payment.id },
        data: {
          status: newStatus,
          remark,
          matchedRowId
        }
      });
      processed++;
    }
    
    res.json({ success: true, processed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Lumi B2B Backend running on port ${PORT}`);
});
