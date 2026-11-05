import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Check, AlertCircle, RefreshCw, Download, FileText, Sparkles,
  ChevronLeft, ChevronRight, ArrowLeft, ArrowRight, RotateCw, ZoomIn, ZoomOut,
  Maximize2, Minimize2, Undo2, Trash2, PenTool, Highlighter, CheckCircle2,
  XCircle, Circle, Type, Save, Award, Clock, User, Phone, MapPin,
  Share2, Eye, Layers, FileCheck, CheckSquare, MessageSquare, Plus, ExternalLink,
  MousePointer, HelpCircle, CheckCheck, Sliders, Eraser, Move
} from 'lucide-react';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import api from '../../api/axios';

export default function PaperMarkingStudio({
  submission,
  submissionsList = [],
  paperDetails,
  onClose,
  onGradeSaved,
  getBaseUrl
}) {
  // Current active submission (allows navigating through student queue)
  const [currentSub, setCurrentSub] = useState(submission);

  // Identify submission index in queue
  const currentIndex = useMemo(() => {
    if (!submissionsList || submissionsList.length === 0) return 0;
    const idx = submissionsList.findIndex(s => s.id === currentSub?.id);
    return idx >= 0 ? idx : 0;
  }, [submissionsList, currentSub]);

  // Extract pages (PDF or Images)
  const pages = useMemo(() => {
    if (!currentSub) return [];
    const list = [];
    const base = getBaseUrl();

    const formatUrl = (fileNameOrUrl) => {
      if (!fileNameOrUrl) return null;
      if (fileNameOrUrl.startsWith('http://') || fileNameOrUrl.startsWith('https://')) return fileNameOrUrl;
      if (fileNameOrUrl.startsWith('/storage/documents/')) return `${base}${fileNameOrUrl}`;
      if (fileNameOrUrl.startsWith('/')) return `${base}${fileNameOrUrl}`;
      return `${base}/storage/documents/${fileNameOrUrl}`;
    };

    // Check main answerFile
    if (currentSub.answerFile) {
      const isPdf = currentSub.answerFile.toLowerCase().endsWith('.pdf');
      list.push({
        id: 'main-file',
        type: isPdf ? 'pdf' : 'image',
        url: formatUrl(currentSub.answerFile),
        filename: currentSub.answerFile,
        name: isPdf ? 'PDF Answer Sheet' : 'Page 1'
      });
    }

    // Check answerImages
    let imgArray = [];
    if (Array.isArray(currentSub.answerImages)) {
      imgArray = currentSub.answerImages;
    } else if (typeof currentSub.answerImages === 'string') {
      try {
        imgArray = JSON.parse(currentSub.answerImages);
      } catch {
        if (currentSub.answerImages.trim()) imgArray = [currentSub.answerImages];
      }
    }

    if (Array.isArray(imgArray)) {
      imgArray.forEach((img, idx) => {
        const url = formatUrl(img);
        if (url && (!currentSub.answerFile || !currentSub.answerFile.includes(img))) {
          list.push({
            id: `img-${idx}`,
            type: 'image',
            url,
            filename: img,
            name: `Page ${list.length + 1}`
          });
        }
      });
    }

    return list;
  }, [currentSub, getBaseUrl]);

  // Active page index
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const activePage = pages[currentPageIndex] || null;

  // Viewport states: Zoom & Rotate
  const [zoomLevel, setZoomLevel] = useState(1.0); // 0.6 to 2.5
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Canvas Tools State
  // Tools: 'pan' | 'pen' | 'highlighter' | 'stamp-tick' | 'stamp-cross' | 'stamp-circle' | 'text' | 'eraser'
  const [activeTool, setActiveTool] = useState('pen');
  const [activeColor, setActiveColor] = useState('#EF4444'); // Default teacher red
  const [activeStrokeWidth, setActiveStrokeWidth] = useState(4); // 2, 4, 8

  // Per-page annotations: { [pageIndex]: Array<Stroke | Stamp | Text> }
  const [annotations, setAnnotations] = useState({});
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const currentPathRef = useRef([]);

  // PDF Interaction mode: 'draw' | 'scroll'
  const [pdfMode, setPdfMode] = useState('draw');

  // Question-by-Question Scoring State
  const [questionScores, setQuestionScores] = useState([]);
  const [structuredScore, setStructuredScore] = useState('');
  const [teacherFeedback, setTeacherFeedback] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Paper Marks Configuration
  const totalPaperMarks = paperDetails?.paper?.totalMarks || 100;
  const totalStructuredMarks = paperDetails?.paper?.totalStructuredMarks || (totalPaperMarks - (paperDetails?.paper?.totalMcqMarks || 0)) || totalPaperMarks;
  const passMarks = paperDetails?.paper?.passMarks || 40;
  const mcqScoreVal = parseFloat(currentSub?.mcqScore) || 0;
  const structuredScoreVal = parseFloat(structuredScore) || 0;
  const isBoth = paperDetails?.paper?.paperType === 'BOTH';

  // Initialize submission details and questions
  useEffect(() => {
    if (currentSub) {
      let initialQuestions = [];
      if (Array.isArray(currentSub.questionMarks) && currentSub.questionMarks.length > 0) {
        initialQuestions = currentSub.questionMarks.map((q, idx) => ({
          questionNo: q.questionNo || idx + 1,
          title: q.title || `Question ${String(q.questionNo || idx + 1).padStart(2, '0')}`,
          maxMarks: q.maxMarks !== undefined ? q.maxMarks : 25,
          marks: q.marks !== null && q.marks !== undefined ? String(q.marks) : '',
          remarks: q.remarks || ''
        }));
      } else {
        const qCount = paperDetails?.content?.questionCount || 4;
        const defaultPerQ = Math.round((totalStructuredMarks / (qCount || 1)) * 10) / 10;
        initialQuestions = Array.from({ length: qCount }, (_, i) => ({
          questionNo: i + 1,
          title: `Question ${String(i + 1).padStart(2, '0')}`,
          maxMarks: defaultPerQ,
          marks: '',
          remarks: ''
        }));
      }
      setQuestionScores(initialQuestions);

      setStructuredScore(
        currentSub.structuredScore !== null && currentSub.structuredScore !== undefined
          ? String(currentSub.structuredScore)
          : (currentSub.score !== null && currentSub.score !== undefined ? String(currentSub.score) : '')
      );
      setTeacherFeedback(currentSub.teacherFeedback || '');
      setCurrentPageIndex(0);
      setAnnotations({});
    }
  }, [currentSub, paperDetails, totalStructuredMarks]);

  // Real-time computed score & grade
  const computedTotalScore = useMemo(() => {
    if (isBoth) {
      return (mcqScoreVal + structuredScoreVal);
    }
    return structuredScoreVal;
  }, [isBoth, mcqScoreVal, structuredScoreVal]);

  const computedPercentage = useMemo(() => {
    if (!totalPaperMarks || totalPaperMarks <= 0) return 0;
    return Math.min(100, Math.round((computedTotalScore / totalPaperMarks) * 1000) / 10);
  }, [computedTotalScore, totalPaperMarks]);

  const computedGrade = useMemo(() => {
    const p = computedPercentage;
    if (p >= 75) return 'A';
    if (p >= 65) return 'B';
    if (p >= 50) return 'C';
    if (p >= 35) return 'S';
    return 'F';
  }, [computedPercentage]);

  // Synchronize canvas coordinate resolution
  const syncCanvasResolution = useCallback((imgElement) => {
    if (!canvasRef.current) return;
    if (imgElement && imgElement.naturalWidth && imgElement.naturalHeight) {
      canvasRef.current.width = imgElement.naturalWidth;
      canvasRef.current.height = imgElement.naturalHeight;
    } else {
      // High-res standard A4 coordinate space for PDF / default canvas
      canvasRef.current.width = 1200;
      canvasRef.current.height = 1600;
    }
  }, []);

  useEffect(() => {
    if (activePage?.type === 'pdf') {
      syncCanvasResolution(null);
    }
  }, [activePage, currentPageIndex, syncCanvasResolution]);

  // Redraw canvas whenever annotations change or page changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const pageAnn = annotations[currentPageIndex] || [];

    pageAnn.forEach(item => {
      if (item.type === 'path') {
        if (!item.points || item.points.length < 2) return;
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = item.color;
        ctx.lineWidth = item.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = item.isHighlighter ? 0.38 : 1.0;
        ctx.moveTo(item.points[0].x, item.points[0].y);
        for (let i = 1; i < item.points.length; i++) {
          ctx.lineTo(item.points[i].x, item.points[i].y);
        }
        ctx.stroke();
        ctx.restore();
      } else if (item.type === 'stamp') {
        ctx.save();
        if (item.stampType === 'tick') {
          // Clean, beautiful teacher tick with circular badge
          ctx.shadowColor = 'rgba(34, 197, 94, 0.4)';
          ctx.shadowBlur = 10;
          ctx.fillStyle = '#22C55E';
          ctx.beginPath();
          ctx.arc(item.x, item.y, 22, 0, Math.PI * 2);
          ctx.fill();

          ctx.shadowBlur = 0;
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 4.5;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(item.x - 9, item.y + 1);
          ctx.lineTo(item.x - 2, item.y + 8);
          ctx.lineTo(item.x + 10, item.y - 7);
          ctx.stroke();
        } else if (item.stampType === 'cross') {
          // Clean, beautiful teacher cross with circular badge
          ctx.shadowColor = 'rgba(239, 68, 68, 0.4)';
          ctx.shadowBlur = 10;
          ctx.fillStyle = '#EF4444';
          ctx.beginPath();
          ctx.arc(item.x, item.y, 22, 0, Math.PI * 2);
          ctx.fill();

          ctx.shadowBlur = 0;
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 4.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(item.x - 7, item.y - 7);
          ctx.lineTo(item.x + 7, item.y + 7);
          ctx.moveTo(item.x + 7, item.y - 7);
          ctx.lineTo(item.x - 7, item.y + 7);
          ctx.stroke();
        } else if (item.stampType === 'circle') {
          ctx.strokeStyle = item.color || '#EF4444';
          ctx.lineWidth = 4.5;
          ctx.beginPath();
          ctx.arc(item.x, item.y, 26, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      } else if (item.type === 'text') {
        ctx.save();
        ctx.font = 'bold 18px Inter, sans-serif';
        const textWidth = ctx.measureText(item.text).width;
        // Pill background
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(item.x - 8, item.y - 22, textWidth + 16, 32, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = item.color || '#FFFFFF';
        ctx.fillText(item.text, item.x, item.y);
        ctx.restore();
      }
    });
  }, [annotations, currentPageIndex]);

  // Pointer event helpers
  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handlePointerDown = (e) => {
    if (activeTool === 'pan') return;
    e.preventDefault();
    const coords = getCanvasCoords(e);

    // Stamps
    if (activeTool === 'stamp-tick' || activeTool === 'stamp-cross' || activeTool === 'stamp-circle') {
      const stampType = activeTool.replace('stamp-', '');
      const newStamp = {
        type: 'stamp',
        stampType,
        x: coords.x,
        y: coords.y,
        color: stampType === 'tick' ? '#22C55E' : '#EF4444'
      };
      setAnnotations(prev => ({
        ...prev,
        [currentPageIndex]: [...(prev[currentPageIndex] || []), newStamp]
      }));
      return;
    }

    // Text Note
    if (activeTool === 'text') {
      const note = window.prompt("Type guidance remark / correction note for student:");
      if (note && note.trim()) {
        const newText = {
          type: 'text',
          text: note.trim(),
          x: coords.x,
          y: coords.y,
          color: activeColor
        };
        setAnnotations(prev => ({
          ...prev,
          [currentPageIndex]: [...(prev[currentPageIndex] || []), newText]
        }));
      }
      return;
    }

    // Freehand drawing
    if (activeTool === 'pen' || activeTool === 'highlighter') {
      isDrawingRef.current = true;
      currentPathRef.current = [coords];

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx) {
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = activeColor;
        ctx.lineWidth = activeTool === 'highlighter' ? 22 : activeStrokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = activeTool === 'highlighter' ? 0.38 : 1.0;
        ctx.moveTo(coords.x, coords.y);
      }
    }
  };

  const handlePointerMove = (e) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    const coords = getCanvasCoords(e);
    currentPathRef.current.push(coords);

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx) {
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
    }
  };

  const handlePointerUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (currentPathRef.current.length > 0) {
      const newStroke = {
        type: 'path',
        color: activeColor,
        size: activeTool === 'highlighter' ? 22 : activeStrokeWidth,
        isHighlighter: activeTool === 'highlighter',
        points: [...currentPathRef.current]
      };
      setAnnotations(prev => ({
        ...prev,
        [currentPageIndex]: [...(prev[currentPageIndex] || []), newStroke]
      }));
    }
    currentPathRef.current = [];
  };

  const handleUndo = () => {
    setAnnotations(prev => {
      const currentList = prev[currentPageIndex] || [];
      if (currentList.length === 0) return prev;
      return {
        ...prev,
        [currentPageIndex]: currentList.slice(0, -1)
      };
    });
  };

  const handleClearPage = () => {
    if (window.confirm("Clear all ink markings and stamps on this page?")) {
      setAnnotations(prev => ({
        ...prev,
        [currentPageIndex]: []
      }));
    }
  };

  // Question Marks Stepper & Edit Handlers
  const handleQuestionMarkChange = (index, value) => {
    setQuestionScores(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], marks: value };
      const sum = updated.reduce((acc, q) => acc + (parseFloat(q.marks) || 0), 0);
      setStructuredScore(String(Math.round(sum * 10) / 10));
      return updated;
    });
  };

  const handleAdjustMarkStep = (index, delta) => {
    setQuestionScores(prev => {
      const updated = [...prev];
      const cur = parseFloat(updated[index].marks) || 0;
      const maxM = parseFloat(updated[index].maxMarks) || 25;
      const nextVal = Math.max(0, Math.min(maxM, Math.round((cur + delta) * 10) / 10));
      updated[index] = { ...updated[index], marks: String(nextVal) };
      const sum = updated.reduce((acc, q) => acc + (parseFloat(q.marks) || 0), 0);
      setStructuredScore(String(Math.round(sum * 10) / 10));
      return updated;
    });
  };

  const handleQuestionFieldChange = (index, field, value) => {
    setQuestionScores(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleAppendQuestionRemarkPreset = (index, presetText) => {
    setQuestionScores(prev => {
      const updated = [...prev];
      const existing = (updated[index].remarks || '').trim();
      updated[index] = {
        ...updated[index],
        remarks: existing ? `${existing} • ${presetText}` : presetText
      };
      return updated;
    });
  };

  const handleAddQuestion = () => {
    setQuestionScores(prev => {
      const nextNo = prev.length + 1;
      const defaultPerQ = Math.round((totalStructuredMarks / (nextNo || 1)) * 10) / 10;
      return [
        ...prev,
        {
          questionNo: nextNo,
          title: `Question ${String(nextNo).padStart(2, '0')}`,
          maxMarks: defaultPerQ,
          marks: '',
          remarks: ''
        }
      ];
    });
  };

  const handleRemoveQuestion = (index) => {
    setQuestionScores(prev => {
      if (prev.length <= 1) {
        toast.error("At least one question is required.");
        return prev;
      }
      const updated = prev.filter((_, i) => i !== index);
      const sum = updated.reduce((acc, q) => acc + (parseFloat(q.marks) || 0), 0);
      setStructuredScore(String(Math.round(sum * 10) / 10));
      return updated;
    });
  };

  // Submit Grade to Server
  const handleSaveGrade = async (advanceToNext = false) => {
    if (!currentSub) return;
    if (structuredScore === '' || isNaN(parseFloat(structuredScore))) {
      toast.error("Please enter awarded marks for the essay questions.");
      return;
    }

    try {
      setIsSaving(true);
      const cleanedQuestions = questionScores.map((q, idx) => ({
        questionNo: q.questionNo || idx + 1,
        title: q.title || `Question ${idx + 1}`,
        maxMarks: parseFloat(q.maxMarks) || 0,
        marks: q.marks !== '' ? parseFloat(q.marks) : 0,
        remarks: (q.remarks || '').trim()
      }));

      const res = await api.put(`/papers/submissions/${currentSub.id}/grade`, {
        score: parseFloat(structuredScore),
        teacherFeedback,
        questionMarks: cleanedQuestions
      });

      toast.success("Marks & question breakdown saved successfully! 🎯");
      if (onGradeSaved) onGradeSaved(res.data?.submission || currentSub);

      if (advanceToNext) {
        if (currentIndex < submissionsList.length - 1) {
          setCurrentSub(submissionsList[currentIndex + 1]);
        } else {
          toast.success("All student submissions in this batch have been evaluated!");
          onClose();
        }
      }
    } catch (err) {
      console.error("Save grade error:", err);
      toast.error(err.response?.data?.error || "Failed to save marks");
    } finally {
      setIsSaving(false);
    }
  };

  // Keyboard shortcut: Cmd/Ctrl + S to quick-save
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSaveGrade(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [structuredScore, teacherFeedback, questionScores, currentSub]);

  // Sinhala Feedback Presets
  const feedbackPresets = [
    { label: "⭐ විශිෂ්ට උත්සාහයක්!", text: "විශිෂ්ට පිළිතුරු සැපයීමක්! සියලු පියවර මැනවින් ඉදිරිපත් කර ඇත." },
    { label: "✍️ පියවර සම්පූර්ණ කරන්න", text: "අවසාන පිළිතුර නිවැරදි වුවද, අතරමැදි ගණනය කිරීම් පියවර පැහැදිලිව පෙන්විය යුතුය." },
    { label: "📐 සූත්‍ර/ඒකක නිවැරදි නැත", text: "භාවිත කර ඇති සූත්‍ර සහ පිළිතුරේ ඒකක (Units) පිළිබඳ සැලකිලිමත් වන්න." },
    { label: "⏱️ කාල කළමනාකරණය", text: "කාලය මනා ලෙස කළමනාකරණය කරමින් විභාගයේ සියලු ප්‍රශ්න වලට පිළිතුරු ලිවීමට පුරුදු වන්න." },
    { label: "📝 අත් අකුරු පිළිවෙළට ලියන්න", text: "පිළිතුරු පත්‍රයේ අත් අකුරු වඩාත් පැහැදිලිව හා පිළිවෙළකට ලිවීමට උත්සාහ කරන්න." }
  ];

  const handleAppendPreset = (text) => {
    setTeacherFeedback(prev => (prev ? `${prev}\n• ${text}` : `• ${text}`));
  };

  // Download raw answer sheet
  const handleDownloadAsPdf = async () => {
    if (currentSub?.answerFile && currentSub.answerFile.toLowerCase().endsWith('.pdf')) {
      const url = `${getBaseUrl()}/storage/documents/${currentSub.answerFile}`;
      window.open(url, '_blank');
      return;
    }

    const imagePages = pages.filter(p => p.type === 'image');
    if (imagePages.length === 0) {
      toast.error("No answer images found to download.");
      return;
    }

    const toastId = toast.loading('Compiling answer images into PDF...');
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 8;
      const printableWidth = pageWidth - (margin * 2);
      const printableHeight = pageHeight - (margin * 2);

      for (let i = 0; i < imagePages.length; i++) {
        if (i > 0) pdf.addPage('a4', 'portrait');
        const pageItem = imagePages[i];
        const img = new Image();
        img.crossOrigin = 'anonymous';

        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
          img.src = pageItem.url;
        });

        if (img.width && img.height) {
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = img.width;
          tempCanvas.height = img.height;
          const tempCtx = tempCanvas.getContext('2d');
          tempCtx.drawImage(img, 0, 0);
          const dataUrl = tempCanvas.toDataURL('image/jpeg', 0.92);

          const imgRatio = img.height / img.width;
          let renderWidth = printableWidth;
          let renderHeight = printableWidth * imgRatio;

          if (renderHeight > printableHeight) {
            renderHeight = printableHeight;
            renderWidth = printableHeight / imgRatio;
          }

          const offsetX = margin + (printableWidth - renderWidth) / 2;
          const offsetY = margin + (printableHeight - renderHeight) / 2;
          pdf.addImage(dataUrl, 'JPEG', offsetX, offsetY, renderWidth, renderHeight, undefined, 'FAST');
        }

        pdf.setFontSize(8);
        pdf.setTextColor(100);
        pdf.text(
          `${currentSub.student?.firstName || 'Student'} ${currentSub.student?.lastName || ''} (ID #${currentSub.student?.id || ''}) • Page ${i + 1} of ${imagePages.length}`,
          margin,
          pageHeight - 4
        );
      }

      const cleanStudent = `${currentSub.student?.firstName || 'Student'}_${currentSub.student?.lastName || ''}`.replace(/[^a-zA-Z0-9]/g, '_');
      pdf.save(`${cleanStudent}_AnswerSheet.pdf`);
      toast.success('Answer sheet downloaded!', { id: toastId });
    } catch (err) {
      toast.error('Failed to compile PDF: ' + err.message, { id: toastId });
    }
  };

  // Export marked PDF with ink annotations
  const handleExportMarkedPdf = async () => {
    const toastId = toast.loading('Exporting marked answer sheet with teacher ink...');
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 8;
      const printableWidth = pageWidth - (margin * 2);
      const printableHeight = pageHeight - (margin * 2);

      for (let i = 0; i < pages.length; i++) {
        if (i > 0) pdf.addPage('a4', 'portrait');
        const pageItem = pages[i];
        const compositeCanvas = document.createElement('canvas');
        compositeCanvas.width = 1600;
        compositeCanvas.height = 2260;
        const compCtx = compositeCanvas.getContext('2d');
        compCtx.fillStyle = '#ffffff';
        compCtx.fillRect(0, 0, compositeCanvas.width, compositeCanvas.height);

        if (pageItem.type === 'image') {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise(r => {
            img.onload = r;
            img.onerror = r;
            img.src = pageItem.url;
          });
          if (img.width && img.height) {
            compCtx.drawImage(img, 0, 0, compositeCanvas.width, compositeCanvas.height);
          }
        }

        const pageAnn = annotations[i] || [];
        pageAnn.forEach(item => {
          if (item.type === 'path') {
            if (!item.points || item.points.length < 2) return;
            compCtx.save();
            compCtx.beginPath();
            compCtx.strokeStyle = item.color;
            compCtx.lineWidth = item.size;
            compCtx.lineCap = 'round';
            compCtx.lineJoin = 'round';
            compCtx.globalAlpha = item.isHighlighter ? 0.38 : 1.0;
            compCtx.moveTo(item.points[0].x, item.points[0].y);
            for (let pIdx = 1; pIdx < item.points.length; pIdx++) {
              compCtx.lineTo(item.points[pIdx].x, item.points[pIdx].y);
            }
            compCtx.stroke();
            compCtx.restore();
          } else if (item.type === 'stamp') {
            compCtx.save();
            if (item.stampType === 'tick') {
              compCtx.fillStyle = '#22C55E';
              compCtx.beginPath();
              compCtx.arc(item.x, item.y, 24, 0, Math.PI * 2);
              compCtx.fill();
              compCtx.strokeStyle = '#FFFFFF';
              compCtx.lineWidth = 5;
              compCtx.lineCap = 'round';
              compCtx.beginPath();
              compCtx.moveTo(item.x - 10, item.y + 1);
              compCtx.lineTo(item.x - 2, item.y + 9);
              compCtx.lineTo(item.x + 11, item.y - 8);
              compCtx.stroke();
            } else if (item.stampType === 'cross') {
              compCtx.fillStyle = '#EF4444';
              compCtx.beginPath();
              compCtx.arc(item.x, item.y, 24, 0, Math.PI * 2);
              compCtx.fill();
              compCtx.strokeStyle = '#FFFFFF';
              compCtx.lineWidth = 5;
              compCtx.lineCap = 'round';
              compCtx.beginPath();
              compCtx.moveTo(item.x - 8, item.y - 8);
              compCtx.lineTo(item.x + 8, item.y + 8);
              compCtx.moveTo(item.x + 8, item.y - 8);
              compCtx.lineTo(item.x - 8, item.y + 8);
              compCtx.stroke();
            } else if (item.stampType === 'circle') {
              compCtx.strokeStyle = item.color || '#EF4444';
              compCtx.lineWidth = 5;
              compCtx.beginPath();
              compCtx.arc(item.x, item.y, 28, 0, Math.PI * 2);
              compCtx.stroke();
            }
            compCtx.restore();
          } else if (item.type === 'text') {
            compCtx.save();
            compCtx.font = 'bold 22px Inter, sans-serif';
            const textWidth = compCtx.measureText(item.text).width;
            compCtx.fillStyle = 'rgba(15, 23, 42, 0.9)';
            compCtx.beginPath();
            compCtx.roundRect(item.x - 10, item.y - 26, textWidth + 20, 36, 8);
            compCtx.fill();
            compCtx.fillStyle = item.color || '#FFFFFF';
            compCtx.fillText(item.text, item.x, item.y);
            compCtx.restore();
          }
        });

        const dataUrl = compositeCanvas.toDataURL('image/jpeg', 0.92);
        pdf.addImage(dataUrl, 'JPEG', margin, margin, printableWidth, printableHeight, undefined, 'FAST');
      }

      const cleanStudent = `${currentSub.student?.firstName || 'Student'}_${currentSub.student?.lastName || ''}`.replace(/[^a-zA-Z0-9]/g, '_');
      pdf.save(`${cleanStudent}_Marked_Evaluated.pdf`);
      toast.success('Marked answer sheet exported!', { id: toastId });
    } catch (err) {
      toast.error('Failed to export marked PDF: ' + err.message, { id: toastId });
    }
  };

  const studioJsx = (
    <div className="fixed inset-0 z-[9999999] bg-[#070B14] flex flex-col overflow-hidden text-slate-100 font-sans select-none animate-in fade-in duration-200">
      
      {/* ======================================================== */}
      {/* 1. TOP STUDIO CONTROL BAR */}
      {/* ======================================================== */}
      <header className="h-16 bg-[#0B111E]/95 backdrop-blur-xl border-b border-white/10 px-4 sm:px-6 flex items-center justify-between shrink-0 z-40">
        
        {/* Left: Exit & Student Info */}
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-bold transition-all border border-white/10 active:scale-95 shadow-sm"
            title="Exit Studio"
          >
            <ArrowLeft size={16} />
            <span>Exit Studio</span>
          </button>

          <div className="h-6 w-px bg-white/10 hidden sm:block" />

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-600/30 border border-purple-500/40 text-purple-300 font-black text-sm flex items-center justify-center shrink-0">
              {(currentSub.student?.firstName?.[0] || 'S').toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white truncate max-w-[160px] sm:max-w-[240px]">
                  {currentSub.student?.firstName} {currentSub.student?.lastName}
                </span>
                <span className="text-xs font-mono text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-lg border border-purple-500/20">
                  ID #{currentSub.student?.id}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-[220px] sm:max-w-none">
                {paperDetails?.title || 'Academic Paper'} • {pages.length} {pages.length === 1 ? 'Page' : 'Pages'}
              </p>
            </div>
          </div>
        </div>

        {/* Center: Page Stepper & Zoom Controls */}
        <div className="hidden lg:flex items-center gap-3 bg-black/50 border border-white/10 px-3 py-1.5 rounded-2xl shadow-inner">
          {/* Page Stepper */}
          <div className="flex items-center gap-1.5 pr-2 border-r border-white/10">
            <button
              disabled={currentPageIndex === 0}
              onClick={() => setCurrentPageIndex(p => Math.max(0, p - 1))}
              className="p-1 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-slate-300"
              title="Previous Page"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-bold text-white min-w-[70px] text-center">
              Page {currentPageIndex + 1} / {pages.length || 1}
            </span>
            <button
              disabled={currentPageIndex >= pages.length - 1}
              onClick={() => setCurrentPageIndex(p => Math.min(pages.length - 1, p + 1))}
              className="p-1 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-slate-300"
              title="Next Page"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setZoomLevel(z => Math.max(0.6, z - 0.15))}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white"
              title="Zoom Out"
            >
              <ZoomOut size={15} />
            </button>
            <span className="text-xs font-mono font-bold text-slate-300 min-w-[42px] text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel(z => Math.min(2.5, z + 0.15))}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white"
              title="Zoom In"
            >
              <ZoomIn size={15} />
            </button>
            <button
              onClick={() => setZoomLevel(1.0)}
              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white/5 hover:bg-white/10 text-slate-300"
            >
              Reset
            </button>
          </div>

          {/* Rotate 90° */}
          <button
            onClick={() => setRotation(r => (r + 90) % 360)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold ml-1"
            title="Rotate Page 90°"
          >
            <RotateCw size={13} />
            <span>{rotation}°</span>
          </button>
        </div>

        {/* Right: Student Queue & Exports */}
        <div className="flex items-center gap-2">
          {/* Student Queue Navigator */}
          <div className="hidden sm:flex items-center gap-1.5 bg-black/40 border border-white/10 px-2.5 py-1 rounded-xl">
            <button
              disabled={currentIndex === 0}
              onClick={() => {
                if (currentIndex > 0) setCurrentSub(submissionsList[currentIndex - 1]);
              }}
              className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-30 disabled:pointer-events-none"
              title="Previous Student"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="text-xs font-bold text-purple-300 px-1">
              Student {currentIndex + 1} / {submissionsList.length || 1}
            </span>
            <button
              disabled={currentIndex >= submissionsList.length - 1}
              onClick={() => {
                if (currentIndex < submissionsList.length - 1) setCurrentSub(submissionsList[currentIndex + 1]);
              }}
              className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-30 disabled:pointer-events-none"
              title="Next Student"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Download Original Sheet */}
          <button
            onClick={handleDownloadAsPdf}
            className="hidden md:flex items-center gap-1 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-bold border border-white/10 transition-all"
            title="Download student answer sheet"
          >
            <Download size={14} />
            <span>Download</span>
          </button>

          {/* Export Marked Sheet with Inks */}
          <button
            onClick={handleExportMarkedPdf}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40 text-xs font-bold transition-all shadow-lg active:scale-95"
            title="Export evaluated sheet with teacher stamps and drawings"
          >
            <FileCheck size={15} />
            <span>Export Marked PDF</span>
          </button>

          {/* Toggle Sidebar */}
          <button
            onClick={() => setIsSidebarOpen(o => !o)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 ml-1"
            title="Toggle Scoring Panel"
          >
            <Sliders size={16} />
          </button>
        </div>

      </header>

      {/* ======================================================== */}
      {/* 2. MAIN WORKSPACE: CANVAS STAGE & EVALUATION DOCK */}
      {/* ======================================================== */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* CENTER STAGE (THE PAPER CANVAS) */}
        <div className="flex-1 flex flex-col relative overflow-hidden bg-[#070B14]">
          
          {/* FLOATING TEACHER TOOL PALETTE (Apple Notes / Kami Style) */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-[#0E1526]/95 backdrop-blur-2xl border border-white/15 shadow-2xl rounded-2xl p-2 flex items-center gap-2">
            
            {/* Pan / Browse Mode */}
            <button
              onClick={() => setActiveTool('pan')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTool === 'pan'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              title="Pan & Scroll Document"
            >
              <MousePointer size={14} />
              <span>Pan</span>
            </button>

            {/* Red Pen */}
            <button
              onClick={() => { setActiveTool('pen'); setActiveColor('#EF4444'); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTool === 'pen'
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              title="Examiner Pen"
            >
              <PenTool size={14} />
              <span>Pen</span>
            </button>

            {/* Highlighter */}
            <button
              onClick={() => { setActiveTool('highlighter'); setActiveColor('#F59E0B'); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTool === 'highlighter'
                  ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              title="Highlighter"
            >
              <Highlighter size={14} />
              <span>Highlight</span>
            </button>

            <div className="h-4 w-px bg-white/10" />

            {/* Tick Stamp */}
            <button
              onClick={() => setActiveTool('stamp-tick')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTool === 'stamp-tick'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                  : 'text-emerald-400 hover:bg-emerald-500/10'
              }`}
              title="Drop Tick Stamp (✔)"
            >
              <CheckCircle2 size={15} />
              <span>Tick (✔)</span>
            </button>

            {/* Cross Stamp */}
            <button
              onClick={() => setActiveTool('stamp-cross')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTool === 'stamp-cross'
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                  : 'text-rose-400 hover:bg-rose-500/10'
              }`}
              title="Drop Cross Stamp (✖)"
            >
              <XCircle size={15} />
              <span>Cross (✖)</span>
            </button>

            {/* Circle Stamp */}
            <button
              onClick={() => setActiveTool('stamp-circle')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTool === 'stamp-circle'
                  ? 'bg-red-500/30 text-red-300 border border-red-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              title="Circle Mistake (⭕)"
            >
              <Circle size={14} />
              <span>Circle</span>
            </button>

            {/* Text Note */}
            <button
              onClick={() => setActiveTool('text')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTool === 'text'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              title="Add Guidance Note"
            >
              <Type size={14} />
              <span>Note</span>
            </button>

            <div className="h-4 w-px bg-white/10" />

            {/* Undo */}
            <button
              onClick={handleUndo}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all"
              title="Undo last marking"
            >
              <Undo2 size={15} />
            </button>

            {/* Clear Page */}
            <button
              onClick={handleClearPage}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-all"
              title="Clear all page markings"
            >
              <Trash2 size={15} />
            </button>

          </div>

          {/* CANVAS STAGE (SCROLLABLE & ZOOMABLE) */}
          <div className="flex-1 overflow-auto p-6 sm:p-10 flex items-center justify-center relative custom-scrollbar">
            
            {pages.length === 0 ? (
              <div className="text-center p-8 bg-slate-900/60 rounded-3xl border border-white/10 max-w-md space-y-3 shadow-2xl">
                <AlertCircle size={44} className="mx-auto text-amber-400" />
                <h3 className="text-lg font-black text-white">No Answer Sheet Attached</h3>
                <p className="text-xs text-slate-400">
                  This student has not uploaded an answer sheet (PDF or images) for this examination.
                </p>
              </div>
            ) : (
              /* REALISTIC A4 EXAM PAPER SHEET CONTAINER */
              <div
                style={{
                  transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.15s ease-out'
                }}
                className="relative bg-white rounded-2xl shadow-[0_30px_70px_rgba(0,0,0,0.85)] border border-slate-300 max-w-[880px] w-full min-h-[600px] overflow-hidden"
              >
                {/* 1. DOCUMENT RENDERING */}
                {activePage?.type === 'pdf' ? (
                  <div className="relative w-full h-[960px] bg-slate-900">
                    <iframe
                      src={`${activePage.url}#toolbar=0`}
                      title="PDF Document"
                      className="w-full h-full border-0"
                    />

                    {/* PDF Floating Control Bar */}
                    <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/90 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/20 shadow-2xl z-30">
                      <button
                        type="button"
                        onClick={() => setPdfMode(m => m === 'draw' ? 'scroll' : 'draw')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          pdfMode === 'draw'
                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                            : 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                        }`}
                        title={pdfMode === 'draw' ? 'Switch to PDF Scroll Mode' : 'Switch to Drawing Mode'}
                      >
                        {pdfMode === 'draw' ? (
                          <>
                            <PenTool size={13} />
                            <span>Marking Mode (Draw on PDF)</span>
                          </>
                        ) : (
                          <>
                            <MousePointer size={13} />
                            <span>Scroll Mode (Browse Pages)</span>
                          </>
                        )}
                      </button>

                      <a
                        href={activePage.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all border border-white/10"
                        title="Open full PDF in a new browser tab"
                      >
                        <ExternalLink size={13} />
                        <span>Open New Tab</span>
                      </a>
                    </div>
                  </div>
                ) : (
                  <img
                    src={activePage?.url}
                    alt={activePage?.name || 'Answer Sheet'}
                    onLoad={(e) => syncCanvasResolution(e.target)}
                    className="w-full h-auto object-contain block select-none pointer-events-none"
                  />
                )}

                {/* 2. INTERACTIVE ANNOTATION CANVAS OVERLAY */}
                <canvas
                  ref={canvasRef}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                  className={`absolute inset-0 w-full h-full z-20 touch-none ${
                    (activePage?.type === 'pdf' && pdfMode === 'scroll') || activeTool === 'pan'
                      ? 'pointer-events-none opacity-0'
                      : 'cursor-crosshair pointer-events-auto opacity-100'
                  }`}
                  style={{ touchAction: 'none' }}
                />

              </div>
            )}

          </div>

          {/* BOTTOM MULTI-PAGE THUMBNAIL STRIP */}
          {pages.length > 1 && (
            <div className="h-16 bg-[#0B111E]/95 border-t border-white/10 px-4 flex items-center justify-center gap-2 overflow-x-auto shrink-0 z-20">
              {pages.map((p, idx) => (
                <button
                  key={p.id}
                  onClick={() => setCurrentPageIndex(idx)}
                  className={`h-12 w-12 rounded-xl border-2 overflow-hidden shrink-0 transition-all relative ${
                    currentPageIndex === idx
                      ? 'border-purple-500 ring-2 ring-purple-500/50 scale-105'
                      : 'border-white/10 opacity-60 hover:opacity-100'
                  }`}
                >
                  {p.type === 'pdf' ? (
                    <div className="w-full h-full bg-slate-800 flex items-center justify-center text-xs font-black text-purple-300">
                      PDF
                    </div>
                  ) : (
                    <img src={p.url} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
                  )}
                  <span className="absolute bottom-0 right-0 bg-black/90 text-[10px] font-bold px-1.5 rounded-tl text-white">
                    {idx + 1}
                  </span>
                </button>
              ))}
            </div>
          )}

        </div>

        {/* ======================================================== */}
        {/* RIGHT: THE TEACHER'S EVALUATION & SCORING DOCK */}
        {/* ======================================================== */}
        {isSidebarOpen && (
          <aside className="w-full md:w-[410px] lg:w-[450px] bg-[#0A0E1A] border-l border-white/10 flex flex-col shrink-0 z-40 overflow-hidden shadow-2xl">
            
            {/* Dock Header with Student Switcher */}
            <div className="p-4 bg-black/40 border-b border-white/10 flex items-center justify-between shrink-0">
              <span className="text-xs font-black uppercase text-purple-300 tracking-wider flex items-center gap-2">
                <Award size={15} /> Examiner Scoring Console
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  disabled={currentIndex === 0}
                  onClick={() => {
                    if (currentIndex > 0) setCurrentSub(submissionsList[currentIndex - 1]);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1"
                >
                  <ChevronLeft size={13} /> Prev
                </button>
                <button
                  disabled={currentIndex >= submissionsList.length - 1}
                  onClick={() => {
                    if (currentIndex < submissionsList.length - 1) setCurrentSub(submissionsList[currentIndex + 1]);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1"
                >
                  Next <ChevronRight size={13} />
                </button>
              </div>
            </div>

            {/* Scrollable Middle Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5">
              
              {/* Score HUD Banner */}
              <div className="bg-gradient-to-br from-purple-950/40 via-indigo-950/30 to-black/60 border border-purple-500/30 p-4 sm:p-5 rounded-3xl relative overflow-hidden shadow-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-purple-300 block mb-1">
                      Overall Evaluated Score
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-black text-white">
                        {computedTotalScore.toFixed(1)}
                      </span>
                      <span className="text-sm font-bold text-slate-400">
                        / {totalPaperMarks} pts
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-400 block mb-1 uppercase tracking-wider">
                      Final Grade
                    </span>
                    <span className={`px-3.5 py-1.5 rounded-xl text-sm font-black border tracking-wider shadow-lg inline-block ${
                      computedGrade === 'A' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                      computedGrade === 'B' ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' :
                      computedGrade === 'C' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                      computedGrade === 'S' ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' :
                      'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    }`}>
                      GRADE {computedGrade}
                    </span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
                  <span>Pass Mark: <strong>{passMarks} pts</strong></span>
                  <span className={computedTotalScore >= passMarks ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                    {computedTotalScore >= passMarks ? '✔ Passed' : '✖ Needs Improvement'}
                  </span>
                </div>
              </div>

              {/* Part 1 MCQ Score (if BOTH) */}
              {isBoth && (
                <div className="bg-black/50 border border-white/10 p-4 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black uppercase text-emerald-400 block tracking-wider">
                      Part 1: MCQ Score (System Graded)
                    </span>
                    <span className="text-xl font-black text-white">
                      {mcqScoreVal} pts
                    </span>
                  </div>
                  <span className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-xl text-xs font-bold">
                    Auto-Calculated
                  </span>
                </div>
              )}

              {/* ESSAY QUESTIONS BREAKDOWN COLUMN (ප්‍රශ්න අනුව ලකුණු) */}
              <div className="bg-black/40 border border-white/10 p-4 sm:p-5 rounded-3xl space-y-4 shadow-xl">
                
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-wider text-purple-300 flex items-center gap-2">
                      <FileCheck size={17} />
                      <span>Essay Questions Marks</span>
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Enter marks and examiner remarks per question
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 text-xs font-bold transition-all active:scale-95 shadow-md"
                    title="Add another essay question"
                  >
                    <Plus size={14} />
                    <span>Add Question</span>
                  </button>
                </div>

                {/* List of Question Grading Cards */}
                <div className="space-y-3.5">
                  {questionScores.map((q, idx) => {
                    const awardedNum = parseFloat(q.marks) || 0;
                    const maxNum = parseFloat(q.maxMarks) || 25;
                    const isOverMax = maxNum > 0 && awardedNum > maxNum;
                    const pct = maxNum > 0 ? Math.min(100, Math.round((awardedNum / maxNum) * 100)) : 0;

                    return (
                      <div
                        key={idx}
                        className={`p-4 rounded-2xl border transition-all space-y-3 ${
                          isOverMax
                            ? 'bg-rose-950/20 border-rose-500/50'
                            : 'bg-white/[0.03] border-white/10 hover:border-purple-500/40'
                        }`}
                      >
                        {/* Top row: Badge, Title & Max Marks */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1">
                            <span className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-black flex items-center justify-center shrink-0">
                              Q{idx + 1}
                            </span>
                            <input
                              type="text"
                              value={q.title || `Question ${idx + 1}`}
                              onChange={(e) => handleQuestionFieldChange(idx, 'title', e.target.value)}
                              className="bg-transparent border-0 text-sm font-bold text-white focus:outline-none w-full"
                              placeholder={`Question ${idx + 1}`}
                            />
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-xs text-slate-400">Max:</span>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={q.maxMarks}
                              onChange={(e) => handleQuestionFieldChange(idx, 'maxMarks', e.target.value)}
                              className="w-16 bg-black/60 border border-white/15 rounded-lg px-2 py-1 text-xs text-center font-bold text-slate-200 focus:border-purple-400 focus:outline-none"
                            />
                            <span className="text-xs text-slate-400">pts</span>

                            {questionScores.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveQuestion(idx)}
                                className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all ml-1"
                                title="Remove question"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Middle row: Marks Input with +/- Steppers & Progress Bar */}
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 bg-black/60 border border-white/15 rounded-xl p-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleAdjustMarkStep(idx, -1)}
                              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 font-bold flex items-center justify-center text-sm"
                              title="Decrease mark by 1"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              max={q.maxMarks}
                              value={q.marks}
                              onChange={(e) => handleQuestionMarkChange(idx, e.target.value)}
                              placeholder="0.0"
                              className="w-16 bg-transparent text-center text-lg font-black text-white outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleAdjustMarkStep(idx, 1)}
                              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 font-bold flex items-center justify-center text-sm"
                              title="Increase mark by 1"
                            >
                              +
                            </button>
                          </div>

                          {/* Progress indicator */}
                          <div className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 flex flex-col justify-center">
                            <div className="flex justify-between items-center text-xs mb-1">
                              <span className="text-slate-400 font-semibold">Awarded</span>
                              <span className={`font-black ${
                                pct >= 75 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : 'text-rose-400'
                              }`}>
                                {awardedNum} / {maxNum} pts ({pct}%)
                              </span>
                            </div>
                            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Bottom row: Quick Preset Chips & Remark Input */}
                        <div className="space-y-2">
                          {/* Quick Chips */}
                          <div className="flex flex-wrap gap-1">
                            {[
                              { text: "Full marks ✔", color: "hover:bg-emerald-500/20 text-emerald-300" },
                              { text: "Steps missing ⚠️", color: "hover:bg-amber-500/20 text-amber-300" },
                              { text: "Formula error 📐", color: "hover:bg-rose-500/20 text-rose-300" },
                              { text: "Calculation mistake ✖", color: "hover:bg-rose-500/20 text-rose-300" },
                            ].map(chip => (
                              <button
                                key={chip.text}
                                type="button"
                                onClick={() => handleAppendQuestionRemarkPreset(idx, chip.text)}
                                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 transition-all ${chip.color}`}
                              >
                                + {chip.text}
                              </button>
                            ))}
                          </div>

                          {/* Custom Remark text field */}
                          <input
                            type="text"
                            value={q.remarks}
                            onChange={(e) => handleQuestionFieldChange(idx, 'remarks', e.target.value)}
                            placeholder="Add specific guidance remark for this question..."
                            className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-purple-400"
                          />
                        </div>

                        {isOverMax && (
                          <p className="text-xs text-rose-400 flex items-center gap-1 font-semibold">
                            <AlertCircle size={13} /> Mark exceeds maximum allocation ({q.maxMarks} pts)
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Auto-Sum Total Summary Row */}
                <div className="pt-2 border-t border-white/10 flex items-center justify-between bg-purple-950/20 p-3.5 rounded-2xl border border-purple-500/30">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-300 block">
                      Auto-Sum Total (Essay)
                    </span>
                    <span className="text-xs text-slate-400">
                      {questionScores.length} Questions Evaluated
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-white">
                      {structuredScore || 0}
                    </span>
                    <span className="text-xs font-bold text-slate-400 ml-1">
                      / {totalStructuredMarks} pts
                    </span>
                  </div>
                </div>

              </div>

              {/* Sinhala Quick Guidance Presets */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-300 block flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-400" />
                  Quick Sinhala Guidance Remarks:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {feedbackPresets.map(preset => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handleAppendPreset(preset.text)}
                      className="bg-white/5 hover:bg-purple-600/20 hover:border-purple-500/40 border border-white/10 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-all text-left"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Personalized Teacher's Feedback Box */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-slate-200 block">
                  Teacher's Overall Remarks & Personalized Advice:
                </label>
                <textarea
                  rows={4}
                  value={teacherFeedback}
                  onChange={(e) => setTeacherFeedback(e.target.value)}
                  placeholder="Write comprehensive advice or encouragement for this student..."
                  className="w-full bg-black/60 border border-white/15 rounded-2xl p-3.5 text-xs text-white placeholder-slate-400 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 resize-y"
                />
              </div>

            </div>

            {/* PINNED STICKY BOTTOM ACTION FOOTER (ALWAYS VISIBLE & UNCOVERED!) */}
            <div className="p-4 bg-[#080C16] border-t border-white/10 shadow-2xl flex flex-col gap-2 shrink-0 z-50">
              
              {/* Primary Save Marks Button */}
              <button
                onClick={() => handleSaveGrade(false)}
                disabled={isSaving}
                className="w-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black py-3.5 rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-purple-600/30 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isSaving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
                <span>Save Marks & Update Ranking</span>
              </button>

              {/* Secondary Save & Grade Next Student */}
              {currentIndex < submissionsList.length - 1 && (
                <button
                  onClick={() => handleSaveGrade(true)}
                  disabled={isSaving}
                  className="w-full bg-white/10 hover:bg-white/15 text-white font-bold py-2.5 rounded-2xl text-xs flex items-center justify-center gap-2 transition-all border border-white/10"
                >
                  <span>Save & Grade Next Student</span>
                  <ArrowRight size={15} />
                </button>
              )}

              <p className="text-[10px] text-center text-slate-500 font-mono">
                Press ⌘S / Ctrl+S to quick-save
              </p>

            </div>

          </aside>
        )}

      </div>

    </div>
  );

  return createPortal(studioJsx, document.body);
}
