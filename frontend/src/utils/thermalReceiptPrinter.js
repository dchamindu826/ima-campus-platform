/**
 * Thermal Receipt Printer Utility for 80mm POS Thermal Printers (e.g. Xprinter XP-80C)
 * Standard roll width: 80mm (approx 72mm printable width)
 */

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generateThermalReceiptHtml(data = {}) {
  const {
    instituteName = 'IMA CAMPUS',
    instituteTagline = 'Higher Education Center',
    instituteContact = 'Hotline: 0716909030 | www.imacampus.online',
    receiptNo = `REC-${Date.now().toString().slice(-6)}`,
    date = new Date(),
    cashierName = 'Cashier / Staff',
    studentId = '-',
    studentName = 'Student',
    studentPhone = '',
    items = [], // Array of { description, month, cardType, amount }
    totalAmount = null,
    expectedFee = null,
    dueAmount = 0,
    status = 'PAID ✓',
    notes = 'Keep this receipt for entrance & card verification.'
  } = data;

  const isExpense = data.isExpense || data.type === 'EXPENSE' || (receiptNo && String(receiptNo).startsWith('EXP-'));

  let activeCashier = cashierName;
  if (!activeCashier || activeCashier.includes('Cashier') || activeCashier.includes('Staff') || activeCashier.includes('Manager')) {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      const name = u.name || u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username;
      if (name && name.trim()) activeCashier = name.trim();
    } catch (e) {}
  }

  const displayTotal = totalAmount !== null && totalAmount !== undefined ? totalAmount : (data.amount || 0);

  const formattedDate = date instanceof Date 
    ? date.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
    : String(date);

  const formattedTotal = Number(displayTotal).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const showStudentSection = !isExpense && (studentId && studentId !== '-' && studentName && studentName !== 'Student');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${isExpense ? 'Voucher' : 'Receipt'} - ${escapeHtml(receiptNo)}</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 0mm;
          }
          @media print {
            html, body {
              width: 76mm;
              margin: 0 auto;
              padding: 2mm 1mm;
              background: #ffffff !important;
              color: #000000 !important;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              font-size: 11.5px;
              line-height: 1.25;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
          body {
            width: 76mm;
            margin: 0 auto;
            padding: 3mm 2mm;
            background: #ffffff;
            color: #000000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            font-size: 11.5px;
            line-height: 1.25;
            box-sizing: border-box;
            -webkit-font-smoothing: antialiased;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-left { text-align: left; }
          .bold { font-weight: 700; }
          .logo-box {
            text-align: center;
            margin-bottom: 2px;
          }
          .logo-img {
            max-height: 42px;
            width: auto;
            margin: 0 auto;
            display: inline-block;
            filter: grayscale(100%) contrast(150%);
          }
          .title { font-size: 15px; font-weight: 900; letter-spacing: 0.5px; margin-bottom: 1px; }
          .subtitle { font-size: 10px; font-weight: 600; margin-bottom: 2px; }
          .contact { font-size: 9.5px; margin-bottom: 3px; font-weight: 500; }
          .receipt-heading {
            font-size: 11.5px;
            font-weight: 800;
            margin-top: 3px;
            border-top: 1px solid #000;
            border-bottom: 1px solid #000;
            padding: 2px 0;
            letter-spacing: 0.5px;
          }
          .divider-double { border-top: 2px dashed #000; margin: 5px 0; }
          .divider-single { border-top: 1px dashed #000; margin: 3px 0; }
          .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
          .item-row { margin-bottom: 4px; }
          .item-desc { font-weight: 700; }
          .item-meta { font-size: 9.5px; color: #111; margin-top: 1px; }
          .grand-total { font-size: 14px; font-weight: 900; margin: 5px 0; }
          .footer-note { font-size: 8.5px; line-height: 1.25; text-align: center; margin-top: 5px; }
          .cut-space { height: 20px; }
        </style>
      </head>
      <body>
        <!-- Header -->
        <div class="text-center">
          <div class="logo-box">
            <img src="/logo.png" class="logo-img" alt="IMA Logo" onerror="this.style.display='none'" />
          </div>
          <div class="title">${escapeHtml(instituteName)}</div>
          <div class="subtitle bold">${escapeHtml(instituteTagline)}</div>
          <div class="contact">${escapeHtml(instituteContact)}</div>
          <div class="receipt-heading">${isExpense ? 'OFFICIAL EXPENSE VOUCHER' : 'OFFICIAL PAYMENT RECEIPT'}</div>
        </div>

        <div class="divider-double"></div>

        <!-- Receipt Info -->
        <div class="row">
          <span>${isExpense ? 'Voucher No:' : 'Receipt No:'}</span>
          <span class="bold">${escapeHtml(receiptNo)}</span>
        </div>
        <div class="row">
          <span>Date & Time:</span>
          <span>${escapeHtml(formattedDate)}</span>
        </div>
        <div class="row">
          <span>${isExpense ? 'Issued By:' : 'Cashier:'}</span>
          <span class="bold">${escapeHtml(activeCashier)}</span>
        </div>

        ${showStudentSection ? `
        <div class="divider-single"></div>
        <!-- Student Info -->
        <div class="row">
          <span>Student ID:</span>
          <span class="bold">${escapeHtml(studentId)}</span>
        </div>
        <div class="row">
          <span>Student Name:</span>
          <span class="bold">${escapeHtml(studentName)}</span>
        </div>
        ` : ''}

        <div class="divider-double"></div>

        <!-- Payment / Expense Breakdown -->
        <div style="font-size: 10.5px; margin-bottom: 3px;" class="bold">${isExpense ? 'EXPENSE DETAILS:' : 'ITEMS PAID:'}</div>
        
        ${parseMultiClassReceiptItems(data).map(item => {
          const isSpecialCard = item.cardType && (
            item.cardType.includes('HALF') || 
            item.cardType.includes('FREE')
          );
          const cardLabel = isSpecialCard ? ` [${item.cardType.includes('HALF') ? 'HALF CARD' : 'FREE CARD'}]` : '';

          let cleanDesc = item.description || (isExpense ? 'Expense Entry' : 'Class Fee');
          cleanDesc = cleanDesc.replace(/^Class Fee\s*(\([^\)]+\))?\s*-\s*/i, '').trim() || cleanDesc;

          const amountDisplay = item.amount !== null && item.amount !== undefined 
            ? `Rs. ${Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}` 
            : '';

          return `
            <div class="item-row">
              <div class="row item-desc" style="align-items: flex-start; gap: 8px;">
                <span style="flex: 1; word-break: normal; overflow-wrap: break-word; font-weight: 700; line-height: 1.2;">${escapeHtml(cleanDesc)}</span>
                ${amountDisplay ? `<span class="text-right bold" style="white-space: nowrap;">${amountDisplay}</span>` : ''}
              </div>
              ${(item.month || cardLabel) ? `
              <div class="item-meta">
                ${item.month ? `Month: ${escapeHtml(item.month)}` : ''}${cardLabel}
              </div>` : ''}
            </div>
          `;
        }).join('')}

        <div class="divider-double"></div>

        <!-- Totals -->
        <div class="row grand-total">
          <span>${isExpense ? 'TOTAL EXPENSE:' : 'TOTAL PAID:'}</span>
          <span class="text-right">Rs. ${escapeHtml(formattedTotal)}</span>
        </div>
        <div class="row" style="font-size: 10.5px;">
          <span>Status:</span>
          <span class="bold">${isExpense ? 'COMPLETED ✓' : (status === 'PARTIAL' ? 'PARTIAL PAYMENT' : (status || 'PAID ✓'))}</span>
        </div>

        <div class="divider-single"></div>

        <!-- Footer -->
        <div class="footer-note">
          <div>${isExpense ? 'Official Campus Expense Record' : escapeHtml(notes)}</div>
          <div style="margin-top: 2px; font-weight: 700;">Thank you for studying with IMA Campus!</div>
        </div>

        <!-- Cutter clearance -->
        <div class="cut-space"></div>
      </body>
    </html>
  `;
}

/**
 * Triggers thermal receipt printing using a hidden iframe
 */
export function printThermalReceipt(receiptData) {
  return new Promise((resolve) => {
    try {
      const htmlContent = generateThermalReceiptHtml(receiptData);

      // Remove existing print iframe if any
      const existingIframe = document.getElementById('thermal-print-iframe');
      if (existingIframe) {
        existingIframe.remove();
      }

      // Create new hidden iframe
      const iframe = document.createElement('iframe');
      iframe.id = 'thermal-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      iframe.style.zIndex = '-9999';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentWindow || iframe.contentDocument;
      const doc = iframe.contentDocument || iframeDoc.document;

      doc.open();
      doc.write(htmlContent);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
          resolve(true);
        } catch (e) {
          console.error('Print iframe error:', e);
          resolve(false);
        }
      }, 250);
    } catch (err) {
      console.error('Failed to trigger receipt print:', err);
      resolve(false);
    }
  });
}

export function parseMultiClassReceiptItems(receiptData = {}) {
  const { items, className, amount, totalAmount, month, cardType } = receiptData;
  const displayAmount = totalAmount !== undefined && totalAmount !== null ? totalAmount : (amount || 0);

  let rawItems = [];
  if (Array.isArray(items) && items.length > 0) {
    rawItems = items;
  } else if (className) {
    rawItems = [{ description: className, amount: displayAmount, month, cardType }];
  } else {
    rawItems = [{ description: 'Class Fee', amount: displayAmount, month, cardType }];
  }

  const parsedList = [];

  rawItems.forEach(item => {
    const rawDesc = item.description || item.className || className || '';

    // Check if rawDesc contains lumped multi-class details
    if (rawDesc.includes('Multi-Class Fee') || (rawDesc.includes(' - ') && rawDesc.includes(','))) {
      let monthStr = item.month || month || '';
      const monthMatch = rawDesc.match(/Multi-Class Fee\s*\(([^\)]+)\)/i);
      if (monthMatch && !monthStr) {
        monthStr = monthMatch[1];
      }

      // Clean leading "Multi-Class Fee (Month) - "
      let cleanStr = rawDesc.replace(/^Multi-Class Fee\s*(\([^\)]+\))?\s*-\s*/i, '').trim();

      // Clean trailing student info "- PHY-STU-XXXX (Student Name)" or "(Student Name)"
      cleanStr = cleanStr.replace(/\s*-\s*(PHY-)?STU-\d+.*$/i, '').trim();
      cleanStr = cleanStr.replace(/\s*\([^\)]*?\)\s*$/, '').trim();

      // Split class names by ", " or " - , " or ","
      const classParts = cleanStr.split(/\s*(?:- ,|, |-)\s*/).map(s => s.trim()).filter(Boolean);

      // Group back parts that form full class names
      const classNames = [];
      let currentClass = [];

      classParts.forEach(p => {
        if (currentClass.length > 0 && (/^\d{4}/.test(p) || /^Grade/i.test(p) || /^A\/L/i.test(p))) {
          classNames.push(currentClass.join(' - '));
          currentClass = [p];
        } else {
          currentClass.push(p);
        }
      });
      if (currentClass.length > 0) {
        classNames.push(currentClass.join(' - '));
      }

      const finalClasses = classNames.length > 0 ? classNames : [cleanStr];

      if (finalClasses.length > 1) {
        const itemTotal = Number(item.amount !== undefined && item.amount !== null ? item.amount : displayAmount);
        const count = finalClasses.length;
        const baseAmount = Math.floor(itemTotal / count);
        const remainder = itemTotal - (baseAmount * count);

        finalClasses.forEach((cName, idx) => {
          const itemAmt = idx < remainder ? baseAmount + 1 : baseAmount;
          parsedList.push({
            description: `${idx + 1}. ${cName}`,
            month: monthStr,
            cardType: item.cardType && item.cardType !== 'MULTIPLE' ? item.cardType : '',
            amount: itemAmt
          });
        });
        return;
      }
    }

    // Normal single item cleaning
    let cleanSingle = rawDesc;
    cleanSingle = cleanSingle.replace(/^Class Fee\s*(\([^\)]+\))?\s*-\s*/i, '').trim();
    cleanSingle = cleanSingle.replace(/\s*-\s*(PHY-)?STU-\d+.*$/i, '').trim();
    cleanSingle = cleanSingle.replace(/\s*\([^\)]*?\)\s*$/, '').trim();

    parsedList.push({
      ...item,
      description: cleanSingle || rawDesc,
      month: item.month || month || '',
      amount: item.amount !== undefined && item.amount !== null ? item.amount : (rawItems.length === 1 ? displayAmount : null)
    });
  });

  return parsedList;
}
