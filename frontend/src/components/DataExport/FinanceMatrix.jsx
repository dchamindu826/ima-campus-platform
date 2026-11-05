import React, { useState, useEffect } from 'react';
import axios from '../../api/axios';
import { 
  Loader2, AlertCircle, ChevronDown, TrendingUp, ChevronLeft, ChevronRight, 
  Search, Download, Building2, GraduationCap, Users, DollarSign, Sparkles, Layers, RefreshCw, FileSpreadsheet,
  BookOpen, FileText, Globe
} from 'lucide-react';
import toast from 'react-hot-toast';

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default function FinanceMatrix({ loggedInUser }) {
    const roleUpper = loggedInUser?.role ? String(loggedInUser.role).toUpperCase().replace(/[\s_-]+/g, '_') : '';
    const deptUpper = loggedInUser?.department ? String(loggedInUser.department).toUpperCase().replace(/[\s_-]+/g, '_') : '';
    const isSystemAdmin = ['SYSTEM_ADMIN', 'DIRECTOR', 'SUPER_ADMIN', 'ADMIN'].includes(roleUpper);
    const isFinanceDept = deptUpper === 'FINANCE' || roleUpper === 'FINANCE';

    const [businesses, setBusinesses] = useState([]);
    const [batches, setBatches] = useState([]);
    const [selectedBiz, setSelectedBiz] = useState(loggedInUser?.businessId ? String(loggedInUser.businessId) : '');
    const [selectedBatch, setSelectedBatch] = useState('');
    const [classType, setClassType] = useState('1'); // '1' = Theory Class, '2' = Paper Class, 'ALL' = Combined
    const [availableClassTypes, setAvailableClassTypes] = useState({ hasTheory: true, hasPaper: false });

    const [searchTerm, setSearchTerm] = useState('');
    const [enrollmentFilter, setEnrollmentFilter] = useState('ALL');
    const [currentMonthIndex, setCurrentMonthIndex] = useState(0);

    const [months, setMonths] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [studentsData, setStudentsData] = useState([]);
    const [grandTotal, setGrandTotal] = useState(0);

    const [visibleCount, setVisibleCount] = useState(50);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchInitialBiz = async () => {
            try {
                const bizRes = await axios.get('/admin/businesses');
                const fetchedBiz = bizRes.data?.businesses || bizRes.data || [];
                setBusinesses(fetchedBiz);
                if (fetchedBiz.length === 1) {
                    setSelectedBiz(fetchedBiz[0].id.toString());
                    fetchBatches(fetchedBiz[0].id.toString());
                } else if (selectedBiz) {
                    fetchBatches(selectedBiz);
                } else if (fetchedBiz.length > 0) {
                    setSelectedBiz(fetchedBiz[0].id.toString());
                    fetchBatches(fetchedBiz[0].id.toString());
                }
            } catch (e) { console.error(e); }
        };
        fetchInitialBiz();
    }, []);

    useEffect(() => {
        if (selectedBiz) {
            fetchBatches(selectedBiz);
            setSelectedBatch('');
            setClassType('1');
            resetMatrix();
        }
    }, [selectedBiz]);

    useEffect(() => {
        if (selectedBiz && selectedBatch) {
            fetchFinanceMatrixData(classType);
        } else {
            resetMatrix();
        }
    }, [selectedBatch, classType]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
            if (months.length === 0) return;

            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                setCurrentMonthIndex(prev => Math.max(0, prev - 1));
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                setCurrentMonthIndex(prev => Math.min(months.length - 1, prev + 1));
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [months]);

    const resetMatrix = () => {
        setMonths([]);
        setSubjects([]);
        setStudentsData([]);
        setGrandTotal(0);
        setVisibleCount(50);
        setSearchTerm('');
        setEnrollmentFilter('ALL');
        setCurrentMonthIndex(0);
    };

    const fetchBatches = async (bizId) => {
        try {
            const res = await axios.get(`/admin/batches/${bizId}`);
            setBatches(res.data.batches || res.data || []);
        } catch (err) { console.error(err); }
    };

    const fetchFinanceMatrixData = async (targetClassType = classType) => {
        setLoading(true);
        setError(null);
        try {
            const res = await axios.get('/admin/data-export/finance-matrix', {
                params: { businessId: selectedBiz, batchId: selectedBatch, classType: targetClassType }
            });
            setMonths(res.data.months || []);
            setSubjects(res.data.subjects || []);
            setStudentsData(res.data.students || []);
            setGrandTotal(res.data.grandTotal || 0);
            if (res.data.availableClassTypes) {
                setAvailableClassTypes(res.data.availableClassTypes);
            }
            setCurrentMonthIndex(0);
        } catch (err) {
            setError("Failed to fetch matrix calculation nodes.");
        } finally {
            setLoading(false);
        }
    };

    const handleLoadMore = () => {
        setVisibleCount(prev => prev + 50);
    };

    const formatCurrency = (val) => {
        const numericVal = Number(val);
        if (!numericVal || isNaN(numericVal) || numericVal === 0) {
            return <span className="text-slate-600 font-medium">-</span>;
        }
        return new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', minimumFractionDigits: 2 }).format(numericVal);
    };

    const filteredData = studentsData.filter(stu => {
        const term = searchTerm.toLowerCase();
        const matchesSearch = !term ||
            stu.studentName?.toLowerCase().includes(term) ||
            stu.studentNo?.toLowerCase().includes(term) ||
            stu.phone?.includes(term) ||
            stu.whatsapp?.includes(term) ||
            stu.address?.toLowerCase().includes(term);

        const matchesType = enrollmentFilter === 'ALL' ||
            (stu.type && stu.type.toUpperCase() === enrollmentFilter) ||
            (enrollmentFilter === 'ADJUSTED' && (stu.type === 'Adjusted' || stu.isAdjusted));

        return matchesSearch && matchesType;
    });

    const processedData = [...filteredData].sort((a, b) => {
        const typeOrder = { 'Full': 1, 'Monthly': 2, 'Installment': 3, 'Upgrade': 4, 'Hybrid': 5, 'Adjusted': 6 };
        const wA = typeOrder[a.type] || 99;
        const wB = typeOrder[b.type] || 99;
        if (wA !== wB) return wA - wB;
        const numA = parseInt(a.studentNo?.replace(/\D/g, '')) || a.id || 0;
        const numB = parseInt(b.studentNo?.replace(/\D/g, '')) || b.id || 0;
        return numA - numB;
    });

    const activeMonth = months[currentMonthIndex];

    const calculateColumnTotal = (subjectName) => {
        if (!activeMonth) return 0;
        return processedData.reduce((acc, stu) => {
            const studentTotal = stu.matrixValues?.[activeMonth.id]?.[subjectName]?.total || 0;
            return acc + studentTotal;
        }, 0);
    };

    const getSubjectBreakdown = (subjectName) => {
        const breakdown = {};
        if (!activeMonth) return breakdown;
        processedData.forEach(stu => {
            const val = stu.matrixValues?.[activeMonth.id]?.[subjectName];
            if (val && val.total > 0) {
                // Subject-wise: precisely identify student payment method for THIS subject (no mix needed under subject columns)
                let type = 'Other';
                if (val.Adjusted > 0) type = 'Adjusted';
                else if (val.Upgrade > 0) type = 'Upgrade';
                else if (val.Monthly > 0) type = 'Monthly';
                else if (val.Full > 0) type = 'Full';
                else if (val.Installment > 0) type = 'Installment';
                else type = stu.type || 'Other';

                if (!breakdown[type]) breakdown[type] = { count: 0, amount: 0 };
                breakdown[type].count++;
                breakdown[type].amount += val.total;
            }
        });
        return breakdown;
    };

    const getOverallActiveMonthBreakdown = () => {
        const breakdown = {};
        if (!activeMonth) return breakdown;
        processedData.forEach(stu => {
            let stuMonthTotal = 0;
            let hasAdjusted = false;
            let hasUpgrade = false;
            let hasMonthly = false;
            let hasFull = false;
            let hasInstallment = false;
            if (stu.matrixValues?.[activeMonth.id]) {
                subjects.forEach(sub => {
                    const v = stu.matrixValues[activeMonth.id][sub];
                    if (v && v.total > 0) {
                        stuMonthTotal += v.total;
                        if (v.Adjusted > 0) hasAdjusted = true;
                        if (v.Upgrade > 0) hasUpgrade = true;
                        if (v.Monthly > 0) hasMonthly = true;
                        if (v.Full > 0) hasFull = true;
                        if (v.Installment > 0) hasInstallment = true;
                    }
                });
            }
            if (stuMonthTotal > 0) {
                let type = 'Other';
                if (hasAdjusted) type = 'Adjusted';
                else if (stu.type === 'Hybrid') type = 'Hybrid';
                else if (hasUpgrade && !hasMonthly) type = 'Upgrade';
                else if (hasMonthly && !hasUpgrade && !hasFull && !hasInstallment) type = 'Monthly';
                else if (hasUpgrade) type = 'Upgrade';
                else if (hasMonthly && (hasFull || hasInstallment)) type = 'Hybrid';
                else if (hasFull) type = 'Full';
                else if (hasInstallment) type = 'Installment';
                else type = stu.type || 'Other';

                if (!breakdown[type]) breakdown[type] = { count: 0, amount: 0 };
                breakdown[type].count++;
                breakdown[type].amount += stuMonthTotal;
            }
        });
        return breakdown;
    };

    const activeMonthGrandTotal = (() => {
        const breakdown = getOverallActiveMonthBreakdown();
        return Object.values(breakdown).reduce((sum, item) => sum + item.amount, 0);
    })();

    // Export Current View (Exact Active Month Table + Bottom Revenue Breakdown)
    const exportCurrentViewToExcel = () => {
        if (processedData.length === 0) {
            toast.error("No data available to export in current view.");
            return;
        }

        const bizName = businesses.find(b => String(b.id) === String(selectedBiz))?.name || 'IMA Campus';
        const batchName = batches.find(b => String(b.id) === String(selectedBatch))?.name || `Batch ${selectedBatch}`;
        const classLabel = classType === '1' ? 'Theory Class' : classType === '2' ? 'Paper Class' : 'Combined (Theory & Paper)';
        const activeMonthName = activeMonth?.name || 'Active Month';
        const sheetName = (activeMonthName || 'Current_View').replace(/[*?:/[\]]/g, '').slice(0, 31);
        const totalCols = 8 + subjects.length + 2;

        const overallBreakdown = getOverallActiveMonthBreakdown();
        const overallTotal = Object.values(overallBreakdown).reduce((sum, item) => sum + item.amount, 0);

        let tableHtml = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
          <!--[if gte mso 9]>
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>${sheetName}</x:Name>
                  <x:WorksheetOptions>
                    <x:DisplayGridlines/>
                    <x:FreezePanes/>
                    <x:FrozenNoSplit/>
                    <x:SplitHeaderRowCount>4</x:SplitHeaderRowCount>
                    <x:SplitColumnNumber>2</x:SplitColumnNumber>
                  </x:WorksheetOptions>
                </x:ExcelWorksheet>
              </x:ExcelWorksheets>
            </x:ExcelWorkbook>
          </xml>
          <![endif]-->
          <style>
            table { border-collapse: collapse; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; width: 100%; }
            th, td { border: 1px solid #CBD5E1; padding: 6px 10px; vertical-align: middle; }
            .banner-title { background-color: #0F172A; color: #FFFFFF; font-size: 14pt; font-weight: 900; text-align: center; padding: 12px; }
            .banner-meta { background-color: #1E293B; color: #94A3B8; font-size: 10pt; font-weight: bold; text-align: center; padding: 6px; }
            .th-meta { background-color: #1E293B; color: #FFFFFF; font-weight: bold; text-align: center; font-size: 11pt; border: 1px solid #475569; }
            .th-sub { background-color: #334155; color: #F8FAFC; font-weight: bold; text-align: center; font-size: 10pt; border: 1px solid #64748B; }
            .th-total { background-color: #065F46; color: #FFFFFF; font-weight: bold; text-align: right; font-size: 11pt; border: 1px solid #059669; }
            .td-text { text-align: left; mso-number-format:"\\@"; }
            .td-center { text-align: center; mso-number-format:"\\@"; }
            .td-num { text-align: right; mso-number-format:"#,##0.00"; }
            .td-num-zero { text-align: right; color: #94A3B8; mso-number-format:"#,##0.00"; }
            .td-num-paid { text-align: right; font-weight: 600; background-color: #F0FDF4; color: #166534; mso-number-format:"#,##0.00"; }
            .row-even { background-color: #F8FAFC; }
            .row-odd { background-color: #FFFFFF; }
            .badge-full { background-color: #DCFCE7; color: #166534; font-weight: bold; text-align: center; }
            .badge-monthly { background-color: #DBEAFE; color: #1E40AF; font-weight: bold; text-align: center; }
            .badge-installment { background-color: #FEF3C7; color: #92400E; font-weight: bold; text-align: center; }
            .badge-hybrid { background-color: #F3E8FF; color: #6B21A8; font-weight: bold; text-align: center; }
            .badge-upgrade { background-color: #FFE4E6; color: #9F1239; font-weight: bold; text-align: center; }
            .badge-adjusted { background-color: #FEF3C7; color: #B45309; font-weight: bold; text-align: center; }
            .td-net-total { text-align: right; font-weight: bold; color: #065F46; background-color: #ECFDF5; mso-number-format:"#,##0.00"; }
            .row-total-revenue { background-color: #065F46; color: #FFFFFF; font-weight: 900; font-size: 12pt; }
            .row-total-revenue td { border: 2px solid #047857; color: #FFFFFF; font-weight: 900; background-color: #065F46; }
            .row-subtotal { background-color: #F1F5F9; font-weight: bold; color: #1E293B; }
          </style>
        </head>
        <body>
          <table>
            <!-- Row 1: Banner Title -->
            <tr>
              <th colspan="${totalCols}" class="banner-title">
                WEIGHTED REVENUE MATRIX [CURRENT VIEW] - ${escapeHtml(bizName.toUpperCase())} - ${escapeHtml(batchName.toUpperCase())}
              </th>
            </tr>
            
            <!-- Row 2: Banner Meta -->
            <tr>
              <th colspan="${totalCols}" class="banner-meta">
                Target Period: ${escapeHtml(activeMonthName)} | Classification: ${escapeHtml(classLabel)} | Students: ${processedData.length} | Active Month Revenue: Rs. ${overallTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} | Total Batch Revenue: Rs. ${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </th>
            </tr>
            
            <!-- Row 3: Blank Spacer -->
            <tr style="height: 8px;">
              <td colspan="${totalCols}" style="border: none; background: #FFFFFF;"></td>
            </tr>

            <!-- Header Row -->
            <tr>
              <th class="th-meta" style="min-width: 45px; text-align: center;">#</th>
              <th class="th-meta" style="min-width: 100px;">ID</th>
              <th class="th-meta" style="min-width: 220px;">Student Name</th>
              <th class="th-meta" style="min-width: 240px;">Address</th>
              <th class="th-meta" style="min-width: 90px;">Birth Year</th>
              <th class="th-meta" style="min-width: 120px;">Phone</th>
              <th class="th-meta" style="min-width: 120px;">WhatsApp</th>
              <th class="th-meta" style="min-width: 120px;">Type</th>
              ${subjects.map(sub => `<th class="th-sub" style="min-width: 130px;">${escapeHtml(sub)}</th>`).join('')}
              <th class="th-total" style="min-width: 130px;">This Month Total</th>
              <th class="th-total" style="min-width: 130px;">Batch Total Paid</th>
            </tr>

            <!-- Data Rows (Matching Current View Table) -->
            ${processedData.map((stu, idx) => {
                const isEven = idx % 2 === 0;
                const rowClass = isEven ? 'row-even' : 'row-odd';
                const isAdjusted = stu.type === 'Adjusted' || stu.isAdjusted;
                const isHybrid = !isAdjusted && stu.type === 'Hybrid';
                const typeBadgeClass = 
                    isAdjusted ? 'badge-adjusted' :
                    stu.type === 'Full' ? 'badge-full' :
                    stu.type === 'Monthly' ? 'badge-monthly' :
                    stu.type === 'Installment' ? 'badge-installment' :
                    stu.type === 'Hybrid' ? 'badge-hybrid' :
                    stu.type === 'Upgrade' ? 'badge-upgrade' : '';

                let activeMonthRowTotal = 0;
                if (activeMonth && stu.matrixValues?.[activeMonth.id]) {
                    subjects.forEach(sub => {
                        activeMonthRowTotal += (stu.matrixValues[activeMonth.id][sub]?.total || 0);
                    });
                }

                return `
                <tr class="${rowClass}">
                  <td class="td-center" style="font-weight: bold; color: #64748B;">${idx + 1}</td>
                  <td class="td-center" style="font-weight: bold;">${escapeHtml(stu.studentNo || '-')}</td>
                  <td class="td-text" style="font-weight: bold;">${escapeHtml(stu.studentName || '-')}</td>
                  <td class="td-text">${escapeHtml(stu.address || '-')}</td>
                  <td class="td-center">${escapeHtml(stu.birthYear || '-')}</td>
                  <td class="td-center">${escapeHtml(stu.phone || '-')}</td>
                  <td class="td-center">${escapeHtml(stu.whatsapp || '-')}</td>
                  <td class="${typeBadgeClass}">${escapeHtml(isAdjusted ? 'ADJUSTED' : (isHybrid ? 'MIXED PAY' : stu.type?.toUpperCase() || '-'))}</td>
                  ${subjects.map(sub => {
                      const cellData = activeMonth ? stu.matrixValues?.[activeMonth.id]?.[sub] : null;
                      if (!cellData || cellData.total === 0) {
                          return `<td class="td-num-zero">-</td>`;
                      } else {
                          let parts = [];
                          if (cellData.Full > 0) parts.push(`F: ${cellData.Full.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
                          if (cellData.Monthly > 0) parts.push(`M: ${cellData.Monthly.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
                          if (cellData.Installment > 0) parts.push(`I: ${cellData.Installment.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
                          if (cellData.Upgrade > 0) parts.push(`U: ${cellData.Upgrade.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
                          if (cellData.Adjusted > 0) parts.push(`Adj: ${cellData.Adjusted.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
                          return `<td class="td-num-paid" style="font-size: 9.5pt;">${parts.join(' | ')}</td>`;
                      }
                  }).join('')}
                  <td class="td-net-total">${Number(activeMonthRowTotal).toFixed(2)}</td>
                  <td class="td-net-total" style="background-color: #E0F2FE; color: #0369A1;">${Number(stu.totalPaid || 0).toFixed(2)}</td>
                </tr>
                `;
            }).join('')}

            <!-- Footer Row 1: Active Month Subject Revenue -->
            <tr class="row-total-revenue">
              <td colspan="8" style="text-align: right; padding-right: 15px; font-weight: 900;">MONTHLY SUBJECT REVENUE:</td>
              ${subjects.map(sub => {
                  const totalColVal = calculateColumnTotal(sub);
                  return `<td class="td-num" style="color: #FFFFFF; font-weight: 900;">${Number(totalColVal).toFixed(2)}</td>`;
              }).join('')}
              <td class="td-num" style="background-color: #047857; color: #FFFFFF; font-weight: 900; font-size: 12pt;">${Number(overallTotal).toFixed(2)}</td>
              <td class="td-num" style="background-color: #065F46; color: #FFFFFF; font-weight: 900; font-size: 12pt;">${Number(grandTotal).toFixed(2)}</td>
            </tr>

            <!-- Footer Breakdown Rows matching screen exactly: Monthly, Full, Adjusted, Upgrade, Mix -->
            ${['Monthly', 'Full', 'Adjusted', 'Upgrade', 'Hybrid'].map(planType => {
                const label = planType === 'Hybrid' ? 'Mix' : planType;
                const overallData = overallBreakdown[planType] || { count: 0, amount: 0 };
                return `
                <tr class="row-subtotal">
                  <td colspan="8" style="text-align: right; padding-right: 15px;">${escapeHtml(label)} (${overallData.count}):</td>
                  ${subjects.map(sub => {
                      const breakdown = getSubjectBreakdown(sub);
                      const subData = breakdown[planType] || { count: 0, amount: 0 };
                      return `<td class="td-num" style="font-size: 9pt;">${escapeHtml(label)} (${subData.count}): ${Number(subData.amount).toFixed(2)}</td>`;
                  }).join('')}
                  <td class="td-num" style="font-weight: bold; color: #065F46;">${Number(overallData.amount).toFixed(2)}</td>
                  <td class="td-num" style="color: #64748B;">-</td>
                </tr>
                `;
            }).join('')}

            ${processedData.length > Object.values(overallBreakdown).reduce((sum, item) => sum + item.count, 0) ? `
            <tr class="row-subtotal" style="color: #64748B;">
              <td colspan="8" style="text-align: right; padding-right: 15px;">Unpaid / Other Months (${processedData.length - Object.values(overallBreakdown).reduce((sum, item) => sum + item.count, 0)}):</td>
              ${subjects.map(() => `<td class="td-num" style="font-size: 9pt; color: #94A3B8;">-</td>`).join('')}
              <td class="td-num" style="color: #94A3B8;">0.00</td>
              <td class="td-num" style="color: #64748B;">-</td>
            </tr>
            ` : ''}

            <!-- Footer Row: Total Students -->
            <tr class="row-subtotal" style="background-color: #E2E8F0; font-weight: 900;">
              <td colspan="8" style="text-align: right; padding-right: 15px; color: #0F172A;">TOTAL STUDENTS:</td>
              ${subjects.map(sub => {
                  const breakdown = getSubjectBreakdown(sub);
                  const subTotalStudents = Object.values(breakdown).reduce((sum, item) => sum + item.count, 0);
                  return `<td class="td-num" style="font-size: 9.5pt; font-weight: 900; color: #0F172A; text-align: center;">${subTotalStudents} Students</td>`;
              }).join('')}
              <td class="td-num" style="font-weight: 900; color: #0F172A; text-align: right;">${processedData.length} Students (${Object.values(overallBreakdown).reduce((sum, item) => sum + item.count, 0)} Paid)</td>
              <td class="td-num" style="color: #64748B;">-</td>
            </tr>

          </table>
        </body>
        </html>
        `;

        const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const cleanBatch = batchName.replace(/[^a-zA-Z0-9_-]/g, '_');
        const cleanMonth = (activeMonthName || 'ActiveMonth').replace(/[^a-zA-Z0-9_-]/g, '_');
        link.download = `Current_View_Revenue_Matrix_${cleanBatch}_${cleanMonth}_${new Date().toISOString().split('T')[0]}.xls`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success(`Exported current view for ${activeMonthName} successfully!`, { icon: '📊' });
    };

    const exportToExcel = () => {
        if (processedData.length === 0) {
            toast.error("No data available to export.");
            return;
        }

        const typeTotals = {};
        const colTypeTotals = {};
        let overallGrandTotal = 0;

        months.forEach(m => {
            subjects.forEach(sub => {
                const key = `${m.id}_${sub}`;
                colTypeTotals[key] = { total: 0 };
            });
        });

        processedData.forEach(stu => {
            const type = stu.type || 'Other';
            if (!typeTotals[type]) typeTotals[type] = 0;
            
            const totalPaid = Number(stu.totalPaid || 0);
            overallGrandTotal += totalPaid;
            typeTotals[type] += totalPaid;

            months.forEach(m => {
                subjects.forEach(sub => {
                    const key = `${m.id}_${sub}`;
                    const cellData = stu.matrixValues?.[m.id]?.[sub];
                    if (cellData && cellData.total > 0) {
                        colTypeTotals[key].total += cellData.total;
                        let cellType = 'Other';
                        if (cellData.Adjusted > 0) cellType = 'Adjusted';
                        else if (cellData.Upgrade > 0) cellType = 'Upgrade';
                        else if (cellData.Monthly > 0) cellType = 'Monthly';
                        else if (cellData.Full > 0) cellType = 'Full';
                        else if (cellData.Installment > 0) cellType = 'Installment';
                        else cellType = type;

                        if (!colTypeTotals[key][cellType]) colTypeTotals[key][cellType] = 0;
                        colTypeTotals[key][cellType] += cellData.total;
                    }
                });
            });
        });

        const bizName = businesses.find(b => String(b.id) === String(selectedBiz))?.name || 'IMA Campus';
        const batchName = batches.find(b => String(b.id) === String(selectedBatch))?.name || `Batch ${selectedBatch}`;
        const classLabel = classType === '1' ? 'Theory Class' : classType === '2' ? 'Paper Class' : 'Combined (Theory & Paper)';
        const sheetName = classType === '1' ? 'Theory_Matrix' : classType === '2' ? 'Paper_Matrix' : 'Combined_Matrix';
        const totalCols = 8 + (months.length * subjects.length) + 1;

        let tableHtml = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
          <!--[if gte mso 9]>
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>${sheetName}</x:Name>
                  <x:WorksheetOptions>
                    <x:DisplayGridlines/>
                    <x:FreezePanes/>
                    <x:FrozenNoSplit/>
                    <x:SplitHeaderRowCount>5</x:SplitHeaderRowCount>
                    <x:SplitColumnNumber>3</x:SplitColumnNumber>
                  </x:WorksheetOptions>
                </x:ExcelWorksheet>
              </x:ExcelWorksheets>
            </x:ExcelWorkbook>
          </xml>
          <![endif]-->
          <style>
            table { border-collapse: collapse; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; width: 100%; }
            th, td { border: 1px solid #CBD5E1; padding: 6px 10px; vertical-align: middle; }
            
            /* Top Banner */
            .banner-title { background-color: #0F172A; color: #FFFFFF; font-size: 15pt; font-weight: 900; text-align: center; padding: 12px; }
            .banner-meta { background-color: #1E293B; color: #94A3B8; font-size: 10pt; font-weight: bold; text-align: center; padding: 6px; }
            
            /* Header Rows */
            .th-meta { background-color: #1E293B; color: #FFFFFF; font-weight: bold; text-align: center; font-size: 11pt; border: 1px solid #475569; }
            .th-month { background-color: #1E3A8A; color: #FFFFFF; font-weight: bold; text-align: center; font-size: 11pt; letter-spacing: 0.5px; border: 1px solid #3B82F6; }
            .th-sub { background-color: #334155; color: #F8FAFC; font-weight: bold; text-align: center; font-size: 10pt; border: 1px solid #64748B; }
            .th-total { background-color: #065F46; color: #FFFFFF; font-weight: bold; text-align: right; font-size: 11pt; border: 1px solid #059669; }
            
            /* Data Cells */
            .td-text { text-align: left; mso-number-format:"\\@"; }
            .td-center { text-align: center; mso-number-format:"\\@"; }
            .td-num { text-align: right; mso-number-format:"#,##0.00"; }
            .td-num-zero { text-align: right; color: #94A3B8; mso-number-format:"#,##0.00"; }
            .td-num-paid { text-align: right; font-weight: 600; background-color: #F0FDF4; color: #166534; mso-number-format:"#,##0.00"; }
            
            /* Zebra rows */
            .row-even { background-color: #F8FAFC; }
            .row-odd { background-color: #FFFFFF; }
            
            /* Student Type Badges */
            .badge-full { background-color: #DCFCE7; color: #166534; font-weight: bold; text-align: center; }
            .badge-monthly { background-color: #DBEAFE; color: #1E40AF; font-weight: bold; text-align: center; }
            .badge-installment { background-color: #FEF3C7; color: #92400E; font-weight: bold; text-align: center; }
            .badge-hybrid { background-color: #F3E8FF; color: #6B21A8; font-weight: bold; text-align: center; }
            .badge-upgrade { background-color: #FFE4E6; color: #9F1239; font-weight: bold; text-align: center; }
            
            /* Net Total Column */
            .td-net-total { text-align: right; font-weight: bold; color: #065F46; background-color: #ECFDF5; mso-number-format:"#,##0.00"; }
            
            /* Bottom Aggregates */
            .row-total-revenue { background-color: #065F46; color: #FFFFFF; font-weight: 900; font-size: 12pt; }
            .row-total-revenue td { border: 2px solid #047857; color: #FFFFFF; font-weight: 900; background-color: #065F46; }
            .row-subtotal { background-color: #F1F5F9; font-weight: bold; color: #1E293B; }
            .row-subtotal td { border: 1px solid #CBD5E1; }
          </style>
        </head>
        <body>
          <table>
            <!-- Row 1: Banner Title -->
            <tr>
              <th colspan="${totalCols}" class="banner-title">
                WEIGHTED REVENUE MATRIX - ${escapeHtml(bizName.toUpperCase())} - ${escapeHtml(batchName.toUpperCase())} [${escapeHtml(classLabel.toUpperCase())}]
              </th>
            </tr>
            
            <!-- Row 2: Banner Meta -->
            <tr>
              <th colspan="${totalCols}" class="banner-meta">
                Generated: ${new Date().toLocaleString()} | Classification: ${escapeHtml(classLabel)} | Total Enrolled: ${processedData.length} Students | Total Revenue: Rs. ${overallGrandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </th>
            </tr>
            
            <!-- Row 3: Blank Spacer -->
            <tr style="height: 8px;">
              <td colspan="${totalCols}" style="border: none; background: #FFFFFF;"></td>
            </tr>

            <!-- Row 4: 2-Tier Header 1 (Meta + Months) -->
            <tr>
              <th rowspan="2" class="th-meta" style="min-width: 45px; text-align: center;">#</th>
              <th rowspan="2" class="th-meta" style="min-width: 110px;">Student ID</th>
              <th rowspan="2" class="th-meta" style="min-width: 220px;">Student Name</th>
              <th rowspan="2" class="th-meta" style="min-width: 260px;">Address</th>
              <th rowspan="2" class="th-meta" style="min-width: 90px;">Birth Year</th>
              <th rowspan="2" class="th-meta" style="min-width: 130px;">Phone</th>
              <th rowspan="2" class="th-meta" style="min-width: 130px;">WhatsApp</th>
              <th rowspan="2" class="th-meta" style="min-width: 130px;">Enrollment Type</th>
              ${months.map(m => `
                <th colspan="${subjects.length}" class="th-month">${escapeHtml(m.name)}</th>
              `).join('')}
              <th rowspan="2" class="th-total" style="min-width: 140px;">Net Total Paid</th>
            </tr>

            <!-- Row 5: 2-Tier Header 2 (Subjects) -->
            <tr>
              ${months.map(() => subjects.map(sub => `
                <th class="th-sub" style="min-width: 100px;">${escapeHtml(sub)}</th>
              `).join('')).join('')}
            </tr>

            <!-- Data Rows -->
            ${processedData.map((stu, idx) => {
                const isEven = idx % 2 === 0;
                const rowClass = isEven ? 'row-even' : 'row-odd';
                const isHybrid = stu.type === 'Hybrid';
                const typeBadgeClass = 
                    stu.type === 'Full' ? 'badge-full' :
                    stu.type === 'Monthly' ? 'badge-monthly' :
                    stu.type === 'Installment' ? 'badge-installment' :
                    stu.type === 'Hybrid' ? 'badge-hybrid' :
                    stu.type === 'Upgrade' ? 'badge-upgrade' : '';

                return `
                <tr class="${rowClass}">
                  <td class="td-center" style="font-weight: bold; color: #64748B;">${idx + 1}</td>
                  <td class="td-center" style="font-weight: bold;">${escapeHtml(stu.studentNo || '-')}</td>
                  <td class="td-text" style="font-weight: bold;">${escapeHtml(stu.studentName || '-')}</td>
                  <td class="td-text">${escapeHtml(stu.address || '-')}</td>
                  <td class="td-center">${escapeHtml(stu.birthYear || '-')}</td>
                  <td class="td-center">${escapeHtml(stu.phone || '-')}</td>
                  <td class="td-center">${escapeHtml(stu.whatsapp || '-')}</td>
                  <td class="${typeBadgeClass}">${escapeHtml(isHybrid ? 'Hybrid (Mixed)' : (stu.type || '-'))}</td>
                  ${months.map(m => subjects.map(sub => {
                      const cellData = stu.matrixValues?.[m.id]?.[sub];
                      if (!cellData || cellData.total === 0) {
                          return `<td class="td-num-zero">0.00</td>`;
                      } else if (cellData.Adjusted > 0) {
                          return `<td class="td-num-paid" style="color: #D97706; font-weight: bold;">Adj:${Number(cellData.Adjusted).toFixed(0)}</td>`;
                      } else if (isHybrid || stu.type === 'Upgrade') {
                          let parts = [];
                          if (cellData.Full > 0) parts.push(`Full:${cellData.Full.toFixed(0)}`);
                          if (cellData.Monthly > 0) parts.push(`Mon:${cellData.Monthly.toFixed(0)}`);
                          if (cellData.Installment > 0) parts.push(`Inst:${cellData.Installment.toFixed(0)}`);
                          if (cellData.Upgrade > 0) parts.push(`Upg:${cellData.Upgrade.toFixed(0)}`);
                          return `<td class="td-num-paid" style="font-size: 9.5pt;">${parts.join(' | ')}</td>`;
                      } else {
                          return `<td class="td-num-paid">${Number(cellData.total).toFixed(2)}</td>`;
                      }
                  }).join('')).join('')}
                  <td class="td-net-total">${Number(stu.totalPaid || 0).toFixed(2)}</td>
                </tr>
                `;
            }).join('')}

            <!-- Summary Row 1: Total Revenue -->
            <tr class="row-total-revenue">
              <td colspan="8" style="text-align: right; padding-right: 15px; font-weight: 900;">TOTAL REVENUE:</td>
              ${months.map(m => subjects.map(sub => {
                  const val = colTypeTotals[`${m.id}_${sub}`]?.total || 0;
                  return `<td class="td-num" style="color: #FFFFFF; font-weight: 900;">${Number(val).toFixed(2)}</td>`;
              }).join('')).join('')}
              <td class="td-num" style="background-color: #047857; color: #FFFFFF; font-weight: 900; font-size: 12pt;">${Number(overallGrandTotal).toFixed(2)}</td>
            </tr>

            <!-- Summary Rows: Breakdown by Enrollment Type -->
            ${Object.keys(typeTotals).sort().map(type => {
                const label = type === 'Hybrid' ? 'Hybrid (Mixed) Total' : (type === 'Adjusted' ? 'Adjusted Payments Total' : `${type} Plan Total`);
                return `
                <tr class="row-subtotal">
                  <td colspan="8" style="text-align: right; padding-right: 15px;">${escapeHtml(label)}:</td>
                  ${months.map(m => subjects.map(sub => {
                      const val = colTypeTotals[`${m.id}_${sub}`]?.[type] || 0;
                      return `<td class="td-num">${Number(val).toFixed(2)}</td>`;
                  }).join('')).join('')}
                  <td class="td-num" style="font-weight: bold; color: #065F46;">${Number(typeTotals[type] || 0).toFixed(2)}</td>
                </tr>
                `;
            }).join('')}

          </table>
        </body>
        </html>
        `;

        const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const cleanBatch = batchName.replace(/[^a-zA-Z0-9_-]/g, '_');
        const cleanClass = classType === '1' ? 'Theory' : classType === '2' ? 'Paper' : 'All';
        link.download = `Weighted_Finance_Matrix_${cleanBatch}_${cleanClass}_${new Date().toISOString().split('T')[0]}.xls`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success("Styled Finance Matrix Excel exported successfully!");
    };

    const selectedBizName = businesses.find(b => String(b.id) === String(selectedBiz))?.name || 'Selected Business';
    const selectedBatchName = batches.find(b => String(b.id) === String(selectedBatch))?.name || 'Selected Batch';

    return (
        <div className="w-full mt-4 bg-slate-950/90 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden font-sans text-slate-200 flex flex-col backdrop-blur-xl">

            {/* Header Toolbar */}
            <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border-b border-slate-800/80 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 shadow-md">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 rounded-2xl shadow-lg shadow-emerald-500/10 text-emerald-400">
                        <TrendingUp size={28} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                            Weighted Student Revenue Matrix Center
                        </h2>
                        <p className="text-xs text-slate-400 mt-1 font-medium">
                            Real-time content hub pricing parameters & weighted subject revenue matrix engine.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                    {/* Business Selector */}
                    <div className="relative flex-1 sm:flex-initial min-w-[200px]">
                        <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                        <select
                            className="w-full bg-slate-900/90 border border-slate-700/80 hover:border-slate-600 rounded-2xl pl-10 pr-8 py-2.5 text-xs font-bold text-white outline-none cursor-pointer focus:border-emerald-500 transition-all appearance-none shadow-sm"
                            value={selectedBiz}
                            onChange={(e) => setSelectedBiz(e.target.value)}
                        >
                            <option value="">Choose Business...</option>
                            {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16} />
                    </div>

                    {/* Batch Selector */}
                    <div className="relative flex-1 sm:flex-initial min-w-[220px]">
                        <GraduationCap className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400 pointer-events-none" size={16} />
                        <select
                            className="w-full bg-slate-900/90 border border-emerald-500/40 hover:border-emerald-500 rounded-2xl pl-10 pr-8 py-2.5 text-xs font-bold text-emerald-300 outline-none cursor-pointer focus:border-emerald-400 disabled:opacity-40 transition-all appearance-none shadow-sm shadow-emerald-500/5"
                            value={selectedBatch}
                            onChange={(e) => setSelectedBatch(e.target.value)}
                            disabled={!selectedBiz}
                        >
                            <option value="">Choose Academic Batch...</option>
                            {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400 pointer-events-none" size={16} />
                    </div>

                    {/* Class Type Toggle (Theory / Paper / All) */}
                    {selectedBatch && (
                        <div className="flex items-center p-1 bg-slate-950/80 border border-slate-700/80 rounded-2xl shadow-inner gap-1">
                            <button
                                type="button"
                                onClick={() => setClassType('1')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    classType === '1'
                                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 ring-1 ring-blue-400/40'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                                }`}
                                title="Show Theory Class enrollments and payments"
                            >
                                <BookOpen size={13} />
                                <span>Theory Class</span>
                                {availableClassTypes.hasTheory && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>}
                            </button>

                            <button
                                type="button"
                                onClick={() => setClassType('2')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    classType === '2'
                                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md shadow-purple-500/25 ring-1 ring-purple-400/40'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                                }`}
                                title="Show Paper Class enrollments and payments"
                            >
                                <FileText size={13} />
                                <span>Paper Class</span>
                                {availableClassTypes.hasPaper && <span className="w-1.5 h-1.5 rounded-full bg-pink-400 inline-block animate-pulse"></span>}
                            </button>

                            <button
                                type="button"
                                onClick={() => setClassType('ALL')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    classType === 'ALL'
                                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/25 ring-1 ring-emerald-400/40'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                                }`}
                                title="Show Combined view of Theory and Paper classes"
                            >
                                <Globe size={13} />
                                <span>All</span>
                            </button>
                        </div>
                    )}

                    {/* Export Excel Buttons: Current View & Full Matrix */}
                    {studentsData.length > 0 && (
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={exportCurrentViewToExcel}
                                className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold px-4 py-2.5 rounded-2xl transition-all shadow-lg shadow-emerald-600/20 active:scale-95 cursor-pointer whitespace-nowrap"
                                title={`Export exact current view for ${activeMonth?.name || 'active month'} with all subjects, totals, and bottom revenue breakdown`}
                            >
                                <Download size={15} />
                                <span>Export Current View (.xls)</span>
                            </button>

                            <button
                                type="button"
                                onClick={exportToExcel}
                                className="flex items-center gap-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold px-3 py-2.5 rounded-2xl transition-all border border-slate-700 active:scale-95 cursor-pointer whitespace-nowrap"
                                title="Export complete multi-month matrix across all months"
                            >
                                <FileSpreadsheet size={15} />
                                <span>Full Matrix</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Stats Summary Grid (Only shown when matrix data exists) */}
            {studentsData.length > 0 && !loading && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-6 bg-slate-900/40 border-b border-slate-800/80">
                    <div className="bg-slate-900/80 border border-emerald-500/20 p-4 rounded-2xl flex items-center gap-4 shadow-lg shadow-emerald-500/5">
                        <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                            <DollarSign size={22} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-emerald-400/80 uppercase tracking-widest">Total Batch Revenue</p>
                            <h3 className="text-xl font-black text-emerald-300">{formatCurrency(grandTotal)}</h3>
                        </div>
                    </div>

                    <div className="bg-slate-900/80 border border-cyan-500/20 p-4 rounded-2xl flex items-center gap-4 shadow-lg shadow-cyan-500/5">
                        <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/20">
                            <TrendingUp size={22} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-cyan-400/80 uppercase tracking-widest">Active Month Revenue</p>
                            <h3 className="text-xl font-black text-cyan-300">{formatCurrency(activeMonthGrandTotal)}</h3>
                        </div>
                    </div>

                    <div className="bg-slate-900/80 border border-purple-500/20 p-4 rounded-2xl flex items-center gap-4 shadow-lg shadow-purple-500/5">
                        <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
                            <Users size={22} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-purple-400/80 uppercase tracking-widest">Enrolled Students</p>
                            <h3 className="text-xl font-black text-purple-300">{processedData.length} Students</h3>
                        </div>
                    </div>

                    <div className="bg-slate-900/80 border border-slate-700/60 p-4 rounded-2xl flex items-center gap-4 shadow-lg">
                        <div className={`p-3 rounded-xl border ${
                            classType === '2' 
                                ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' 
                                : classType === 'ALL'
                                ? 'bg-teal-500/10 text-teal-400 border-teal-500/20'
                                : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        }`}>
                            {classType === '2' ? <FileText size={22} /> : classType === 'ALL' ? <Globe size={22} /> : <BookOpen size={22} />}
                        </div>
                        <div className="overflow-hidden flex-1">
                            <div className="flex items-center justify-between gap-1">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{selectedBizName}</p>
                                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                                    classType === '2' 
                                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                                        : classType === 'ALL'
                                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                                        : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                }`}>
                                    {classType === '2' ? 'Paper Class' : classType === 'ALL' ? 'Combined View' : 'Theory Class'}
                                </span>
                            </div>
                            <h3 className="text-xs font-black text-white truncate mt-0.5">{selectedBatchName}</h3>
                        </div>
                    </div>
                </div>
            )}

            {/* Filter & Month Navigation Bar */}
            {studentsData.length > 0 && !loading && (
                <div className="p-4 bg-slate-900/60 border-b border-slate-800/80 flex flex-col md:flex-row gap-4 items-center justify-between z-10 relative">
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        {/* Live Search Input */}
                        <div className="relative w-full sm:w-[280px]">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search ID, Student Name, Phone..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-8 py-2 text-xs font-bold text-white outline-none focus:border-emerald-500 placeholder:text-slate-500 transition-all shadow-inner"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white bg-white/10 rounded-full w-4 h-4 flex items-center justify-center"
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        {/* Payment Type Dropdown */}
                        <select
                            value={enrollmentFilter}
                            onChange={(e) => setEnrollmentFilter(e.target.value)}
                            className="bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-xs font-bold text-slate-300 outline-none cursor-pointer focus:border-emerald-500 transition-all"
                        >
                            <option value="ALL">All Payment Types</option>
                            <option value="FULL">Full Cards Only</option>
                            <option value="INSTALLMENT">Installments Only</option>
                            <option value="MONTHLY">Monthly Cards Only</option>
                            <option value="UPGRADE">Upgraded Payments</option>
                            <option value="HYBRID">Hybrid (Mixed) Payments</option>
                            <option value="ADJUSTED">Adjusted Payments Only</option>
                        </select>
                    </div>

                    {/* Month Navigator */}
                    {months.length > 0 && (
                        <div className="flex items-center gap-3 bg-slate-950 px-4 py-1.5 rounded-2xl border border-slate-700/80 shadow-inner">
                            <button
                                disabled={currentMonthIndex === 0}
                                onClick={() => setCurrentMonthIndex(prev => prev - 1)}
                                className="p-1.5 text-emerald-400 hover:text-emerald-300 disabled:text-slate-700 disabled:cursor-not-allowed transition-all hover:bg-emerald-500/10 rounded-xl"
                                title="Previous Month"
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <div className="text-center min-w-[170px]">
                                <span className="text-[9px] uppercase font-black text-slate-500 tracking-widest block">TARGET MONTH PERIOD</span>
                                <span className="text-xs font-black text-white">{activeMonth?.name}</span>
                            </div>
                            <button
                                disabled={currentMonthIndex === months.length - 1}
                                onClick={() => setCurrentMonthIndex(prev => prev + 1)}
                                className="p-1.5 text-emerald-400 hover:text-emerald-300 disabled:text-slate-700 disabled:cursor-not-allowed transition-all hover:bg-emerald-500/10 rounded-xl"
                                title="Next Month"
                            >
                                <ChevronRight size={20} />
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Main Content Area */}
            <div className="w-full relative flex-1 bg-slate-950 flex flex-col">
                {/* Empty State when no batch is selected */}
                {!selectedBatch && !loading && (
                    <div className="p-16 text-center flex flex-col items-center justify-center gap-4 my-8">
                        <div className="p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl text-emerald-400 shadow-xl shadow-emerald-500/5 animate-pulse">
                            <Sparkles size={48} />
                        </div>
                        <h3 className="text-xl font-black text-white">Select Academic Batch to View Finance Matrix</h3>
                        <p className="text-xs text-slate-400 max-w-md">
                            Please select a Corporate Business and Academic Batch from the top header dropdowns to compile weighted student revenue metrics and payment matrices.
                        </p>
                    </div>
                )}

                {/* Table Data View */}
                {selectedBatch && (
                    <div className="overflow-auto custom-scrollbar relative max-h-[65vh] w-full">
                        {loading ? (
                            <div className="p-20 text-center flex flex-col items-center justify-center gap-3 bg-slate-950/80 backdrop-blur-sm z-50">
                                <Loader2 className="w-12 h-12 animate-spin text-emerald-400 mb-2" />
                                <p className="text-sm font-bold text-white">Compiling weighted revenue matrix nodes...</p>
                                <p className="text-xs text-slate-500">Calculating subject totals, student balances, and monthly payment distributions</p>
                            </div>
                        ) : error ? (
                            <div className="p-16 text-center text-rose-400 flex flex-col items-center justify-center gap-3">
                                <AlertCircle size={44} className="text-rose-500" />
                                <p className="text-base font-bold">{error}</p>
                                <button
                                    onClick={fetchFinanceMatrixData}
                                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all border border-slate-700"
                                >
                                    <RefreshCw size={14} /> Retry Loading
                                </button>
                            </div>
                        ) : studentsData.length === 0 ? (
                            <div className="p-16 text-center flex flex-col items-center justify-center gap-4 my-8">
                                <div className={`p-5 rounded-3xl border shadow-xl ${
                                    classType === '2'
                                        ? 'bg-purple-500/10 border-purple-500/20 text-purple-400 shadow-purple-500/5'
                                        : classType === 'ALL'
                                        ? 'bg-teal-500/10 border-teal-500/20 text-teal-400 shadow-teal-500/5'
                                        : 'bg-blue-500/10 border-blue-500/20 text-blue-400 shadow-blue-500/5'
                                }`}>
                                    {classType === '2' ? <FileText size={44} /> : classType === 'ALL' ? <Globe size={44} /> : <BookOpen size={44} />}
                                </div>
                                <h4 className="text-xl font-black text-white">
                                    No {classType === '2' ? 'Paper Class' : classType === '1' ? 'Theory Class' : ''} Revenue Records Found
                                </h4>
                                <p className="text-xs text-slate-400 max-w-md">
                                    {classType === '2'
                                        ? 'No Paper Class payments or course registrations were found for this batch yet. If this batch runs Theory classes, switch to Theory Class view.'
                                        : 'No Theory Class payments or course registrations were found for this batch yet. If this batch runs Paper classes, switch to Paper Class view.'}
                                </p>
                                <div className="flex items-center gap-3 mt-3">
                                    {classType !== '1' && (
                                        <button
                                            type="button"
                                            onClick={() => setClassType('1')}
                                            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/20 cursor-pointer"
                                        >
                                            Switch to Theory Class
                                        </button>
                                    )}
                                    {classType !== '2' && (
                                        <button
                                            type="button"
                                            onClick={() => setClassType('2')}
                                            className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-600/20 cursor-pointer"
                                        >
                                            Switch to Paper Class
                                        </button>
                                    )}
                                    {classType !== 'ALL' && (
                                        <button
                                            type="button"
                                            onClick={() => setClassType('ALL')}
                                            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                                        >
                                            View All (Combined)
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse min-w-max">
                                <thead>
                                    <tr className="bg-slate-900 text-xs font-black text-slate-400 uppercase tracking-wider h-[52px]">
                                        <th className="min-w-[50px] max-w-[50px] p-3.5 sticky left-0 top-0 bg-slate-900 z-[60] border-r border-b border-slate-800 text-center shadow-md">#</th>
                                        <th className="min-w-[90px] max-w-[90px] p-3.5 sticky left-[50px] top-0 bg-slate-900 z-[60] border-r border-b border-slate-800 text-center shadow-md">ID</th>
                                        <th className="min-w-[220px] max-w-[220px] p-3.5 sticky left-[140px] top-0 bg-slate-900 z-[60] border-r border-b border-slate-800 shadow-md">Student Info</th>
                                        <th className="min-w-[130px] max-w-[130px] p-3.5 sticky left-[360px] top-0 bg-slate-900 z-[60] border-r border-b border-slate-800 text-center shadow-md">Type</th>

                                        {subjects.map((sub, sIdx) => (
                                            <th
                                                key={sIdx}
                                                className={`min-w-[150px] max-w-[150px] whitespace-normal text-[12px] p-3.5 text-center border-b border-r border-slate-800 sticky top-0 font-bold text-white z-40 ${sIdx % 2 === 0 ? 'bg-slate-900' : 'bg-slate-900/80'}`}
                                            >
                                                {sub}
                                            </th>
                                        ))}
                                        <th className="min-w-[160px] max-w-[160px] p-3.5 text-right bg-emerald-950/90 text-emerald-400 font-black border-b border-slate-800 sticky top-0 right-0 z-50 backdrop-blur-md shadow-md">
                                            MONTHLY TOTAL
                                        </th>
                                    </tr>
                                </thead>

                                <tbody className="text-xs divide-y divide-slate-800/60 whitespace-nowrap">
                                    {processedData.slice(0, visibleCount).map((stu, idx) => {
                                        const isAdjusted = stu.type === 'Adjusted' || stu.isAdjusted;
                                        const isHybrid = !isAdjusted && stu.type === 'Hybrid';
                                        const rowClasses = isAdjusted
                                            ? "bg-amber-950/20 border-y border-amber-500/30 hover:bg-amber-900/30 transition-colors group relative"
                                            : isHybrid
                                            ? "bg-fuchsia-950/20 border-y border-fuchsia-500/30 hover:bg-fuchsia-900/30 transition-colors group relative"
                                            : "hover:bg-slate-800/40 transition-colors group";

                                        let activeMonthRowTotal = 0;
                                        if (activeMonth && stu.matrixValues?.[activeMonth.id]) {
                                            subjects.forEach(sub => {
                                                activeMonthRowTotal += (stu.matrixValues[activeMonth.id][sub]?.total || 0);
                                            });
                                        }

                                        return (
                                            <tr key={stu.id} className={rowClasses}>
                                                <td className={`p-3.5 font-bold text-center sticky left-0 z-20 border-r border-slate-800/80 transition-colors ${
                                                    isAdjusted ? 'text-amber-400 bg-slate-950 group-hover:bg-amber-950/80' :
                                                    isHybrid ? 'text-fuchsia-400 bg-slate-950 group-hover:bg-fuchsia-950/80' : 
                                                    'text-slate-400 bg-slate-950 group-hover:bg-slate-900'
                                                }`}>
                                                    {idx + 1}
                                                </td>
                                                <td className={`p-3.5 font-bold text-center sticky left-[50px] z-20 border-r border-slate-800/80 transition-colors ${
                                                    isAdjusted ? 'text-amber-400 bg-slate-950 group-hover:bg-amber-950/80' :
                                                    isHybrid ? 'text-fuchsia-400 bg-slate-950 group-hover:bg-fuchsia-950/80' : 
                                                    'text-emerald-400 bg-slate-950 group-hover:bg-slate-900'
                                                }`}>
                                                    {stu.studentNo}
                                                </td>
                                                <td className={`p-3.5 font-medium text-slate-200 sticky left-[140px] z-20 border-r border-slate-800/80 transition-colors ${
                                                    isAdjusted ? 'bg-slate-950 group-hover:bg-amber-950/80' :
                                                    isHybrid ? 'bg-slate-950 group-hover:bg-fuchsia-950/80' : 
                                                    'bg-slate-950 group-hover:bg-slate-900'
                                                }`}>
                                                    <div className="flex flex-col gap-1 whitespace-normal">
                                                        <span className="font-bold text-white text-[14px] line-clamp-1">{stu.studentName}</span>
                                                        <span className="text-[11px] text-slate-400">Birth Year: {stu.birthYear || '-'}</span>
                                                        <span className={`text-[11px] flex flex-col font-semibold ${
                                                            isAdjusted ? 'text-amber-400/80' :
                                                            isHybrid ? 'text-fuchsia-400/80' : 
                                                            'text-emerald-500/80'
                                                        }`}>
                                                            {stu.phone && <span>P: {stu.phone}</span>}
                                                            {stu.whatsapp && stu.whatsapp !== stu.phone && <span>W: {stu.whatsapp}</span>}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className={`p-3.5 border-r border-slate-800/80 text-center sticky left-[360px] z-20 shadow-[4px_0_10px_-3px_rgba(0,0,0,0.3)] transition-colors ${
                                                    isAdjusted ? 'bg-slate-950 group-hover:bg-amber-950/80' :
                                                    isHybrid ? 'bg-slate-950 group-hover:bg-fuchsia-950/80' : 
                                                    'bg-slate-950 group-hover:bg-slate-900'
                                                }`}>
                                                    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-black border shadow-sm inline-block ${
                                                        isAdjusted ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' :
                                                        stu.type === 'Hybrid' ? 'bg-fuchsia-500/20 border-fuchsia-500/40 text-fuchsia-300' :
                                                        stu.type === 'Full' ? 'bg-purple-500/20 border-purple-500/40 text-purple-300' :
                                                        stu.type === 'Monthly' ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' :
                                                        stu.type === 'Upgrade' ? 'bg-rose-500/20 border-rose-500/40 text-rose-300' :
                                                        'bg-amber-500/20 border-amber-500/40 text-amber-300'
                                                    }`}>
                                                        {isAdjusted ? 'ADJUSTED' : (stu.type === 'Hybrid' ? 'MIXED PAY' : stu.type?.toUpperCase())}
                                                    </span>
                                                    {isAdjusted && stu.originalType && (
                                                        <span className="block text-[9px] font-semibold text-amber-400/80 mt-0.5">
                                                            ({stu.originalType})
                                                        </span>
                                                    )}
                                                </td>

                                                {subjects.map((sub, sIdx) => {
                                                    const cellData = activeMonth ? stu.matrixValues?.[activeMonth.id]?.[sub] : null;
                                                    return (
                                                        <td key={sIdx} className={`p-2.5 align-middle text-center border-r border-slate-800/60 transition-colors ${sIdx % 2 === 0 ? 'bg-slate-950/30' : 'bg-slate-900/30'}`}>
                                                            {cellData && (cellData.Full > 0 || cellData.Monthly > 0 || cellData.Installment > 0 || cellData.Upgrade > 0 || cellData.Adjusted > 0) ? (
                                                                <div className="flex flex-col items-center gap-1 font-semibold">
                                                                    {cellData.Full > 0 && <span className="text-[11px] bg-purple-500/20 border border-purple-500/30 text-purple-300 px-2 py-0.5 rounded-md" title="Full Payment">F: {formatCurrency(cellData.Full)}</span>}
                                                                    {cellData.Monthly > 0 && <span className="text-[11px] bg-blue-500/20 border border-blue-500/30 text-blue-300 px-2 py-0.5 rounded-md" title="Monthly Payment">M: {formatCurrency(cellData.Monthly)}</span>}
                                                                    {cellData.Installment > 0 && <span className="text-[11px] bg-amber-500/20 border border-amber-500/30 text-amber-300 px-2 py-0.5 rounded-md" title="Installment Payment">I: {formatCurrency(cellData.Installment)}</span>}
                                                                    {cellData.Upgrade > 0 && <span className="text-[11px] bg-rose-500/20 border border-rose-500/30 text-rose-300 px-2 py-0.5 rounded-md" title="Upgraded Payment">U: {formatCurrency(cellData.Upgrade)}</span>}
                                                                    {cellData.Adjusted > 0 && <span className="text-[11px] bg-amber-500/20 border border-amber-500/30 text-amber-300 px-2 py-0.5 rounded-md" title="Adjusted Payment">Adj: {formatCurrency(cellData.Adjusted)}</span>}
                                                                </div>
                                                            ) : <span className="text-slate-600">-</span>}
                                                        </td>
                                                    );
                                                })}

                                                <td className={`p-3.5 text-right border-l sticky right-0 z-20 shadow-[-4px_0_10px_-3px_rgba(0,0,0,0.3)] ${
                                                    isAdjusted ? 'bg-amber-950/90 border-amber-500/30' :
                                                    isHybrid ? 'bg-fuchsia-950/90 border-fuchsia-500/30' : 
                                                    'bg-emerald-950/80 border-emerald-500/30'
                                                }`}>
                                                    <div className="flex flex-col items-end gap-1">
                                                        <span className={`text-[10px] font-bold tracking-wider uppercase ${
                                                            isAdjusted ? 'text-amber-400/80' :
                                                            isHybrid ? 'text-fuchsia-400/80' : 
                                                            'text-emerald-400/80'
                                                        }`}>THIS MONTH</span>
                                                        <span className={`font-black text-xs ${
                                                            isAdjusted ? 'text-amber-300' :
                                                            isHybrid ? 'text-fuchsia-300' : 
                                                            'text-emerald-300'
                                                        }`}>{formatCurrency(activeMonthRowTotal)}</span>
                                                        <div className="w-full h-px bg-slate-700/50 my-0.5"></div>
                                                        <span className={`text-[10px] font-bold tracking-wider uppercase ${
                                                            isAdjusted ? 'text-amber-400/80' :
                                                            isHybrid ? 'text-fuchsia-400/80' : 
                                                            'text-emerald-400/80'
                                                        }`}>TOTAL PAID</span>
                                                        <span className={`font-black text-xs ${
                                                            isAdjusted ? 'text-amber-100' :
                                                            isHybrid ? 'text-fuchsia-100' : 
                                                            'text-emerald-100'
                                                        }`}>{formatCurrency(stu.totalPaid)}</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    {/* Footer Summary Row */}
                                    <tr className="bg-slate-900 font-bold border-t-2 border-slate-700 text-white sticky bottom-0 z-30 align-top">
                                        <td className="p-4 text-left uppercase text-xs tracking-wider text-slate-400 bg-slate-900 sticky left-0 z-40 border-r border-slate-800 shadow-[4px_0_10px_-3px_rgba(0,0,0,0.3)]" colSpan={4}>
                                            <div className="flex flex-col gap-2">
                                                <span className="font-black text-white text-xs tracking-wider">MONTHLY SUBJECT REVENUE</span>
                                                {(() => {
                                                    const overall = getOverallActiveMonthBreakdown();
                                                    const overallTotal = Object.values(overall).reduce((sum, item) => sum + item.amount, 0);
                                                    const paidStudentCount = Object.values(overall).reduce((sum, item) => sum + item.count, 0);
                                                    const totalBatchStudents = processedData.length;
                                                    const unpaidOrLaterCount = Math.max(0, totalBatchStudents - paidStudentCount);
                                                    return (
                                                        <div className="flex flex-col gap-1.5 mt-1">
                                                            <span className="font-black text-emerald-400 text-base">{formatCurrency(overallTotal)}</span>
                                                            <div className="mt-2 pt-2.5 border-t border-slate-800 flex flex-col gap-1.5 text-[11px] font-normal text-left text-slate-400 tracking-normal normal-case">
                                                            {Object.entries(overall).sort((a,b) => b[1].amount - a[1].amount).map(([type, data]) => {
                                                                let colorClass = "text-slate-400";
                                                                if (type === 'Full') colorClass = "text-purple-400 font-bold";
                                                                else if (type === 'Monthly') colorClass = "text-blue-400 font-bold";
                                                                else if (type === 'Installment') colorClass = "text-amber-400 font-bold";
                                                                else if (type === 'Hybrid') colorClass = "text-fuchsia-400 font-bold";
                                                                else if (type === 'Upgrade') colorClass = "text-rose-400 font-bold";
                                                                else if (type === 'Adjusted') colorClass = "text-amber-400 font-bold";
                                                                const label = type === 'Hybrid' ? 'Mix' : type;
                                                                return (
                                                                    <div key={type} className="flex justify-between gap-4">
                                                                        <span className={colorClass}>{label} ({data.count}):</span>
                                                                        <span className="font-bold text-slate-200">{formatCurrency(data.amount)}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                            {unpaidOrLaterCount > 0 && (
                                                                <div className="flex justify-between gap-4 text-slate-500 font-medium pt-0.5 border-t border-slate-800/60">
                                                                    <span className="text-slate-500">Unpaid / Other Months ({unpaidOrLaterCount}):</span>
                                                                    <span className="text-slate-500 font-bold">{formatCurrency(0)}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="mt-2.5 pt-2 border-t border-slate-700/80 flex flex-col gap-1 text-xs font-black">
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-emerald-400 uppercase tracking-wider text-[11px]">Total Students:</span>
                                                                <span className="text-white bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 rounded-lg text-xs font-black shadow-sm">
                                                                    {totalBatchStudents} Students
                                                                </span>
                                                            </div>
                                                            {unpaidOrLaterCount > 0 && (
                                                                <div className="flex justify-between items-center text-[10px] font-semibold text-slate-400 tracking-normal normal-case">
                                                                    <span>Active Paid: <strong className="text-emerald-400">{paidStudentCount}</strong></span>
                                                                    <span>Unpaid / Other Months: <strong className="text-amber-400/90">{unpaidOrLaterCount}</strong></span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </td>
                                        {subjects.map((sub, sIdx) => {
                                            const totalColVal = calculateColumnTotal(sub);
                                            const breakdown = getSubjectBreakdown(sub);
                                            const subTotalStudents = Object.values(breakdown).reduce((sum, item) => sum + item.count, 0);
                                            return (
                                                <td
                                                    key={sIdx}
                                                    className={`p-3.5 text-center border-r border-slate-800 text-emerald-400 z-30 ${sIdx % 2 === 0 ? 'bg-slate-900' : 'bg-slate-900/90'}`}
                                                >
                                                    <div className="flex flex-col gap-1">
                                                        <span className="font-black text-xs text-emerald-300">{formatCurrency(totalColVal)}</span>
                                                        
                                                        <div className="mt-2.5 pt-2.5 border-t border-slate-800 flex flex-col gap-1 text-[10px] font-normal text-left text-slate-300">
                                                            {Object.entries(breakdown).sort((a,b) => b[1].amount - a[1].amount).map(([type, data]) => {
                                                                let colorClass = "text-slate-400";
                                                                if (type === 'Full') colorClass = "text-purple-400";
                                                                else if (type === 'Monthly') colorClass = "text-blue-400";
                                                                else if (type === 'Installment') colorClass = "text-amber-400";
                                                                else if (type === 'Hybrid') colorClass = "text-fuchsia-400";
                                                                else if (type === 'Upgrade') colorClass = "text-rose-400";
                                                                else if (type === 'Adjusted') colorClass = "text-amber-400";
                                                                const label = type === 'Hybrid' ? 'Mix' : (type === 'Installment' ? 'Instal' : type);
                                                                return (
                                                                    <div key={type} className="flex justify-between gap-2">
                                                                        <span className={colorClass}>{label} ({data.count}):</span>
                                                                        <span className="font-semibold">{formatCurrency(data.amount)}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                        <div className="mt-2 pt-2 border-t border-slate-800 flex justify-between items-center text-[10px] font-black">
                                                            <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Total Students:</span>
                                                            <span className="text-emerald-300 font-black bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded text-[10px]">
                                                                {subTotalStudents}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>
                                            );
                                        })}
                                        <td className="p-4 text-right text-emerald-300 bg-emerald-950 font-black text-sm sticky right-0 z-40 shadow-[-4px_0_10px_-3px_rgba(0,0,0,0.3)] border-l border-slate-800">
                                            <div className="flex flex-col items-end gap-1">
                                                <span className="text-[10px] text-emerald-400/80 font-bold uppercase tracking-wider">GRAND TOTAL REVENUE</span>
                                                <span>{formatCurrency(grandTotal)}</span>
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {/* Pagination / Load More Footer */}
                {processedData.length > visibleCount && !loading && (
                    <div className="p-4 bg-slate-900/80 border-t border-slate-800 flex justify-center">
                        <button
                            onClick={handleLoadMore}
                            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-bold px-5 py-2.5 rounded-2xl transition-all shadow-md active:scale-95 cursor-pointer"
                        >
                            <ChevronDown size={14} className="animate-bounce text-emerald-400" />
                            Load More Rows ({visibleCount} of {processedData.length})
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}