import React, { useEffect } from 'react';
import { Printer, X, CheckCircle2, User, BookOpen, Calendar, CreditCard, Sparkles } from 'lucide-react';
import { printThermalReceipt, parseMultiClassReceiptItems } from '../../utils/thermalReceiptPrinter';
import toast from 'react-hot-toast';

export default function ThermalReceiptModal({
  isOpen,
  onClose,
  receiptData,
  autoPrint = false
}) {
  useEffect(() => {
    if (isOpen && autoPrint && receiptData) {
      const timer = setTimeout(() => {
        handleDirectPrint();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoPrint, receiptData]);

  if (!isOpen || !receiptData) return null;

  const handleDirectPrint = async () => {
    const success = await printThermalReceipt(receiptData);
    if (success) {
      toast.success('Sent to 80mm receipt printer!', { icon: '🖨️' });
    }
  };

  const {
    receiptNo = `REC-${Date.now().toString().slice(-6)}`,
    studentId = '-',
    studentName = 'Student',
    guardianPhone = '',
    className = 'Class Fee',
    month = '',
    cardType = 'FULL',
    paymentMethod = 'CASH',
    paidDate = new Date(),
    cashierName = 'Cashier / Staff',
    amount = 0
  } = receiptData;

  const displayAmount = receiptData.displayAmount || receiptData.totalAmount || receiptData.amount || amount || 0;

  const dateObj = paidDate ? new Date(paidDate) : new Date();
  const dateStr = isNaN(dateObj.getTime()) 
    ? new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
    : dateObj.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

  let activeCashier = cashierName;
  if (!activeCashier || activeCashier.includes('Cashier') || activeCashier.includes('Staff') || activeCashier.includes('Manager')) {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      const name = u.name || u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username;
      if (name && name.trim()) activeCashier = name.trim();
    } catch (e) {}
  }

  const isExpense = receiptData.isExpense || receiptData.type === 'EXPENSE' || (receiptNo && String(receiptNo).startsWith('EXP-'));
  const showStudentSection = !isExpense && (studentId && studentId !== '-' && studentName && studentName !== 'Student');

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#12131e] border border-white/20 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col text-white relative">
        
        {/* Header */}
        <div className="p-4 px-6 border-b border-white/10 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Printer size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold">{isExpense ? '80mm Expense Voucher' : '80mm Thermal Receipt'}</h3>
              <p className="text-[11px] text-white/50">Xprinter XP-80C Thermal POS Slip</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-xl transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Realistic 80mm Thermal Slip Preview */}
        <div className="p-5 overflow-y-auto max-h-[60vh] bg-gradient-to-b from-[#0e0f17] to-[#161724] flex justify-center">
          <div className="w-[300px] bg-white text-black p-4 rounded-sm shadow-2xl text-[11px] leading-tight select-none border-t-4 border-dashed border-neutral-400 relative font-sans">
            
            {/* Institute Brand */}
            <div className="text-center pb-2">
              <div className="flex justify-center mb-1">
                <img src="/logo.png" alt="IMA Logo" className="h-9 w-auto object-contain filter grayscale contrast-125" onError={(e) => e.target.style.display='none'} />
              </div>
              <div className="text-sm font-black tracking-wider uppercase">IMA CAMPUS</div>
              <div className="text-[10px] font-bold text-neutral-800">Higher Education Center</div>
              <div className="text-[9px] text-neutral-600 font-medium">Hotline: 0716909030 | www.imacampus.online</div>
              <div className="text-[11px] font-extrabold mt-1.5 uppercase border-y border-black py-0.5">{isExpense ? 'OFFICIAL EXPENSE VOUCHER' : 'OFFICIAL PAYMENT RECEIPT'}</div>
            </div>

            {/* Meta */}
            <div className="space-y-0.5 text-[10px] my-2 border-b border-dashed border-neutral-400 pb-2">
              <div className="flex justify-between">
                <span className="text-neutral-600">{isExpense ? 'Voucher No:' : 'Receipt No:'}</span>
                <span className="font-bold">{receiptNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Date:</span>
                <span>{dateStr}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">{isExpense ? 'Issued By:' : 'Cashier:'}</span>
                <span className="font-bold">{activeCashier}</span>
              </div>
            </div>

            {/* Student Info */}
            {showStudentSection && (
              <div className="space-y-0.5 text-[10px] my-2 border-b border-dashed border-neutral-400 pb-2">
                <div className="flex justify-between">
                  <span className="text-neutral-600">Student ID:</span>
                  <span className="font-bold">{studentId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Student Name:</span>
                  <span className="font-bold">{studentName}</span>
                </div>
              </div>
            )}

            {/* Items */}
            <div className="my-2 border-b-2 border-dashed border-black pb-2">
              <div className="text-[10px] font-bold uppercase mb-1">{isExpense ? 'Expense Details:' : 'Items Paid:'}</div>
              {parseMultiClassReceiptItems(receiptData).map((it, i) => {
                const isSpecial = it.cardType && (it.cardType.includes('HALF') || it.cardType.includes('FREE'));
                return (
                  <div key={i} className="mb-1.5">
                    <div className="flex justify-between font-bold text-[11px] items-start gap-2">
                      <span className="leading-tight flex-1">{it.description}</span>
                      {it.amount !== null && it.amount !== undefined && (
                        <span className="shrink-0 whitespace-nowrap">Rs. {Number(it.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      )}
                    </div>
                    {(it.month || isSpecial) && (
                      <div className="text-[9px] text-neutral-700 mt-0.5">
                        {it.month ? `Month: ${it.month}` : ''}{isSpecial ? ` | [${it.cardType.includes('HALF') ? 'HALF CARD' : 'FREE CARD'}]` : ''}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Total */}
            <div className="my-2 space-y-1">
              <div className="flex justify-between text-xs font-black">
                <span>{isExpense ? 'TOTAL EXPENSE:' : 'TOTAL PAID:'}</span>
                <span>Rs. {Number(displayAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-neutral-600">Status:</span>
                <span className={`font-bold ${isExpense ? 'text-emerald-700' : (receiptData.status === 'PARTIAL' ? 'text-amber-700' : 'text-emerald-700')}`}>
                  {isExpense ? 'COMPLETED ✓' : (receiptData.status === 'PARTIAL' ? 'PARTIAL PAYMENT' : (receiptData.status || 'PAID ✓'))}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center text-[8px] text-neutral-600 border-t border-dashed border-neutral-400 pt-2 mt-2">
              <div>{isExpense ? 'Official Campus Expense Record' : 'Keep this receipt for entrance & card verification.'}</div>
              <div className="font-bold text-neutral-800 mt-0.5">Thank you for studying with IMA Campus!</div>
            </div>

          </div>
        </div>

        {/* Actions Footer */}
        <div className="p-4 bg-white/5 border-t border-white/10 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-white/70 hover:text-white bg-white/5 hover:bg-white/10 transition-all"
          >
            Close
          </button>
          
          <button
            type="button"
            onClick={handleDirectPrint}
            className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Printer size={16} />
            <span>Print Receipt (Xprinter 80mm)</span>
          </button>
        </div>

      </div>
    </div>
  );
}
