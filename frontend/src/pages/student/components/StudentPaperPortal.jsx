import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Clock, Calendar, CheckCircle2, 
  HelpCircle, ChevronLeft, ChevronRight, Send, RefreshCw, Award, 
  FileText, FileSignature, UploadCloud, Download, Check, 
  ArrowLeft, Grid, Play, AlertCircle, Trophy, Layers, CheckCircle,
  Image as ImageIcon, ZoomIn, Lock, Sparkles, AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../api/axios';

export default function StudentPaperPortal({ content, isOpen, onClose, onCompleted }) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paperData, setPaperData] = useState(null);
  const [submission, setSubmission] = useState(null);

  // Exam state: 'PRE_START' | 'COUNTDOWN_TO_START' | 'IN_PROGRESS' | 'INTERMISSION' | 'STRUCTURED_WRITING' | 'STRUCTURED_UPLOADING' | 'STRUCTURED_LOCKED' | 'SUBMITTED'
  const [examStatus, setExamStatus] = useState('PRE_START');
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({}); // { [questionId]: selectedOptionId }
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState(null);
  const [timeUntilStartSeconds, setTimeUntilStartSeconds] = useState(null);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [showMobilePalette, setShowMobilePalette] = useState(false);

  // For BOTH paper format: active section tab ('mcq' | 'structured')
  const [activeSectionTab, setActiveSectionTab] = useState('mcq');

  // Structured paper upload state
  const [answerFile, setAnswerFile] = useState(null);

  // Student Leaderboard Modal state
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [leaderboardMeta, setLeaderboardMeta] = useState(null);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);

  // Student Progress & Academic Level Modal state
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressData, setProgressData] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState(false);

  // Question Images / Figures Lightbox & Tab state
  const [activeFigureIdx, setActiveFigureIdx] = useState(0);
  const [lightboxState, setLightboxState] = useState(null); // { images: string[], currentIdx: number }

  const timerIntervalRef = useRef(null);

  const getGradeStyle = (grade) => {
    const g = (grade || '').trim().toUpperCase();
    if (g.startsWith('A')) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    if (g.startsWith('B')) return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    if (g.startsWith('C')) return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    if (g.startsWith('S') || g.startsWith('D')) return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
    return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
  };

  useEffect(() => {
    setActiveFigureIdx(0);
  }, [currentQuestionIdx]);

  useEffect(() => {
    if (isOpen && content?.id) {
      loadPaper();
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isOpen, content?.id]);

  const loadPaper = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/papers/content/${content.id}`);
      const data = res.data;
      setPaperData(data);
      
      const p = data.paper;
      const sub = data.userSubmission;
      const serverNow = new Date(data.serverTime || Date.now());

      const pType = p.paperType || (content.contentType === 'sPaper' ? 'STRUCTURED' : 'MCQ');

      if (sub) {
        setSubmission(sub);
        if (Array.isArray(sub.answers)) {
          const ansMap = {};
          sub.answers.forEach(a => {
            ansMap[a.questionId] = a.selectedOptionId;
          });
          setSelectedAnswers(ansMap);
        }

        const isFullySubmitted = (
          sub.status === 'SUBMITTED' || 
          sub.status === 'GRADED' || 
          sub.status === 'PENDING_EVALUATION' ||
          (pType === 'STRUCTURED' && Boolean(sub.structuredSubmittedAt || sub.submittedAt || sub.answerFile)) ||
          (pType === 'BOTH' && Boolean(sub.structuredSubmittedAt || (sub.mcqSubmittedAt && sub.answerFile)))
        );

        if (isFullySubmitted) {
          setExamStatus('SUBMITTED');
          setLoading(false);
          return;
        }
      }

      const mcqMode = p.mcqTimerMode || p.timerMode || 'FLEXIBLE';
      const mcqStart = p.mcqScheduledStartTime || p.scheduledStartTime;
      const mcqDurMins = parseInt((pType === 'MCQ' ? (p.durationMinutes || p.mcqDurationMinutes) : p.mcqDurationMinutes) || p.durationMinutes || 60, 10);

      const strMode = p.structuredTimerMode || p.timerMode || 'FLEXIBLE';
      const strStart = p.structuredScheduledStartTime || p.scheduledStartTime;
      const strDurMins = parseInt((pType === 'STRUCTURED' ? (p.durationMinutes || p.structuredDurationMinutes) : p.structuredDurationMinutes) || p.durationMinutes || 60, 10);
      const strUploadMins = parseInt(p.structuredUploadMinutes || 15, 10);
      const breakMins = parseInt(p.breakIntervalMinutes || 15, 10);

      if (pType === 'BOTH') {
        // Did student already submit Part 1 MCQ?
        if (sub && sub.mcqSubmittedAt) {
          // Part 1 MCQ is finished! Check Part 2 Structured:
          if (sub.structuredStartedAt) {
            const sStart = new Date(sub.structuredStartedAt);
            const writingEnd = new Date(sStart.getTime() + strDurMins * 60 * 1000);
            const uploadEnd = new Date(writingEnd.getTime() + strUploadMins * 60 * 1000);

            if (serverNow < writingEnd) {
              const diff = Math.floor((writingEnd.getTime() - serverNow.getTime()) / 1000);
              setTimeRemainingSeconds(diff);
              setExamStatus('STRUCTURED_WRITING');
            } else if (serverNow < uploadEnd) {
              const diff = Math.floor((uploadEnd.getTime() - serverNow.getTime()) / 1000);
              setTimeRemainingSeconds(diff);
              setExamStatus('STRUCTURED_UPLOADING');
            } else {
              setTimeRemainingSeconds(0);
              setExamStatus('STRUCTURED_LOCKED');
            }
          } else {
            // In Intermission!
            setExamStatus('INTERMISSION');
            if (strMode === 'SCHEDULED' && strStart) {
              const strStartTime = new Date(strStart);
              const diffToStart = Math.floor((strStartTime.getTime() - serverNow.getTime()) / 1000);
              setTimeUntilStartSeconds(Math.max(0, diffToStart));
            } else {
              const mcqSubAt = new Date(sub.mcqSubmittedAt);
              const breakEnd = new Date(mcqSubAt.getTime() + breakMins * 60 * 1000);
              const diffBreak = Math.floor((breakEnd.getTime() - serverNow.getTime()) / 1000);
              setTimeUntilStartSeconds(Math.max(0, diffBreak));
            }
          }
        } else {
          // Part 1 MCQ not submitted yet
          if (mcqMode === 'SCHEDULED' && mcqStart) {
            const startTime = new Date(mcqStart);
            const diffToStart = Math.floor((startTime.getTime() - serverNow.getTime()) / 1000);
            if (diffToStart > 0) {
              setTimeUntilStartSeconds(diffToStart);
              setExamStatus('COUNTDOWN_TO_START');
            } else {
              const mcqEndTime = new Date(startTime.getTime() + mcqDurMins * 60 * 1000);
              const diffToEnd = Math.floor((mcqEndTime.getTime() - serverNow.getTime()) / 1000);
              if (diffToEnd > 0) {
                setTimeRemainingSeconds(diffToEnd);
                setExamStatus('IN_PROGRESS');
              } else {
                setTimeRemainingSeconds(0);
                setExamStatus('INTERMISSION');
              }
            }
          } else {
            // Flexible MCQ
            if (sub && sub.status === 'IN_PROGRESS' && sub.startedAt) {
              const startedAt = new Date(sub.startedAt);
              const mcqEndTime = new Date(startedAt.getTime() + mcqDurMins * 60 * 1000);
              const diffToEnd = Math.floor((mcqEndTime.getTime() - serverNow.getTime()) / 1000);
              if (diffToEnd > 0) {
                setTimeRemainingSeconds(diffToEnd);
                setExamStatus('IN_PROGRESS');
              } else {
                setTimeRemainingSeconds(0);
                setExamStatus('INTERMISSION');
              }
            } else {
              setExamStatus('PRE_START');
            }
          }
        }
      } else if (pType === 'STRUCTURED') {
        // Structured Only
        if (strMode === 'SCHEDULED' && strStart) {
          const startTime = new Date(strStart);
          const diffToStart = Math.floor((startTime.getTime() - serverNow.getTime()) / 1000);
          if (diffToStart > 0) {
            setTimeUntilStartSeconds(diffToStart);
            setExamStatus('COUNTDOWN_TO_START');
          } else {
            const writingEnd = new Date(startTime.getTime() + strDurMins * 60 * 1000);
            const uploadEnd = new Date(writingEnd.getTime() + strUploadMins * 60 * 1000);
            if (serverNow < writingEnd) {
              const diff = Math.floor((writingEnd.getTime() - serverNow.getTime()) / 1000);
              setTimeRemainingSeconds(diff);
              setExamStatus('STRUCTURED_WRITING');
            } else if (serverNow < uploadEnd) {
              const diff = Math.floor((uploadEnd.getTime() - serverNow.getTime()) / 1000);
              setTimeRemainingSeconds(diff);
              setExamStatus('STRUCTURED_UPLOADING');
            } else {
              setTimeRemainingSeconds(0);
              setExamStatus('STRUCTURED_LOCKED');
            }
          }
        } else {
          // Flexible Structured
          if (sub && sub.status === 'IN_PROGRESS' && (sub.structuredStartedAt || sub.startedAt)) {
            const sStart = new Date(sub.structuredStartedAt || sub.startedAt);
            const writingEnd = new Date(sStart.getTime() + strDurMins * 60 * 1000);
            const uploadEnd = new Date(writingEnd.getTime() + strUploadMins * 60 * 1000);
            if (serverNow < writingEnd) {
              const diff = Math.floor((writingEnd.getTime() - serverNow.getTime()) / 1000);
              setTimeRemainingSeconds(diff);
              setExamStatus('STRUCTURED_WRITING');
            } else if (serverNow < uploadEnd) {
              const diff = Math.floor((uploadEnd.getTime() - serverNow.getTime()) / 1000);
              setTimeRemainingSeconds(diff);
              setExamStatus('STRUCTURED_UPLOADING');
            } else {
              setTimeRemainingSeconds(0);
              setExamStatus('STRUCTURED_LOCKED');
            }
          } else {
            setExamStatus('PRE_START');
          }
        }
      } else {
        // MCQ Only
        if (mcqMode === 'SCHEDULED' && mcqStart) {
          const startTime = new Date(mcqStart);
          const diffToStart = Math.floor((startTime.getTime() - serverNow.getTime()) / 1000);
          if (diffToStart > 0) {
            setTimeUntilStartSeconds(diffToStart);
            setExamStatus('COUNTDOWN_TO_START');
          } else {
            const mcqEndTime = new Date(startTime.getTime() + mcqDurMins * 60 * 1000);
            const diffToEnd = Math.floor((mcqEndTime.getTime() - serverNow.getTime()) / 1000);
            if (diffToEnd > 0) {
              setTimeRemainingSeconds(diffToEnd);
              setExamStatus('IN_PROGRESS');
            } else {
              setTimeRemainingSeconds(0);
              setExamStatus('SUBMITTED');
            }
          }
        } else {
          // Flexible MCQ
          if (sub && sub.status === 'IN_PROGRESS' && sub.startedAt) {
            const startedAt = new Date(sub.startedAt);
            const mcqEndTime = new Date(startedAt.getTime() + mcqDurMins * 60 * 1000);
            const diffToEnd = Math.floor((mcqEndTime.getTime() - serverNow.getTime()) / 1000);
            if (diffToEnd > 0) {
              setTimeRemainingSeconds(diffToEnd);
              setExamStatus('IN_PROGRESS');
            } else {
              setTimeRemainingSeconds(0);
              setExamStatus('SUBMITTED');
            }
          } else {
            setExamStatus('PRE_START');
          }
        }
      }

    } catch (err) {
      console.error("Failed to load student paper", err);
      toast.error("Failed to load exam details");
    } finally {
      setLoading(false);
    }
  };

  // Helper to configure intermission timer
  const setupIntermissionTimer = (currentSub) => {
    const p = paperData?.paper;
    if (!p) return;
    const strMode = p.structuredTimerMode || p.timerMode || 'FLEXIBLE';
    const strStart = p.structuredScheduledStartTime || p.scheduledStartTime;
    const breakMins = parseInt(p.breakIntervalMinutes || 15, 10);
    const now = Date.now();

    if (strMode === 'SCHEDULED' && strStart) {
      const startTime = new Date(strStart).getTime();
      const diffToStart = Math.max(0, Math.floor((startTime - now) / 1000));
      setTimeUntilStartSeconds(diffToStart);
    } else {
      const subTime = currentSub?.mcqSubmittedAt ? new Date(currentSub.mcqSubmittedAt).getTime() : now;
      const breakEnd = subTime + (breakMins * 60 * 1000);
      const diffBreak = Math.max(0, Math.floor((breakEnd - now) / 1000));
      setTimeUntilStartSeconds(diffBreak);
    }
  };

  // Live Timer Interval Engine
  useEffect(() => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    // 1. COUNTDOWN_TO_START (Scheduled MCQ or Standalone Structured)
    if (examStatus === 'COUNTDOWN_TO_START' && timeUntilStartSeconds !== null) {
      timerIntervalRef.current = setInterval(() => {
        setTimeUntilStartSeconds(prev => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current);
            const pType = paperData?.paper?.paperType || (content.contentType === 'sPaper' ? 'STRUCTURED' : 'MCQ');
            if (pType === 'STRUCTURED') {
              const durationSecs = ((paperData?.paper?.durationMinutes || paperData?.paper?.structuredDurationMinutes) || 60) * 60;
              setTimeRemainingSeconds(durationSecs);
              setExamStatus('STRUCTURED_WRITING');
              toast.success("Structured Exam has officially started. Writing phase is active.");
            } else {
              const durationSecs = ((paperData?.paper?.durationMinutes || paperData?.paper?.mcqDurationMinutes) || 60) * 60;
              setTimeRemainingSeconds(durationSecs);
              setExamStatus('IN_PROGRESS');
              toast.success("Exam has officially started.");
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    // 2. MCQ IN_PROGRESS
    if (examStatus === 'IN_PROGRESS' && timeRemainingSeconds !== null) {
      timerIntervalRef.current = setInterval(() => {
        setTimeRemainingSeconds(prev => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current);
            handleAutoSubmitOnTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    // 3. INTERMISSION (Between MCQ and Structured in BOTH mode)
    if (examStatus === 'INTERMISSION' && timeUntilStartSeconds !== null) {
      timerIntervalRef.current = setInterval(() => {
        setTimeUntilStartSeconds(prev => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    // 4. STRUCTURED WRITING
    if (examStatus === 'STRUCTURED_WRITING' && timeRemainingSeconds !== null) {
      timerIntervalRef.current = setInterval(() => {
        setTimeRemainingSeconds(prev => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current);
            const uploadSecs = (paperData?.paper?.structuredUploadMinutes || 15) * 60;
            setExamStatus('STRUCTURED_UPLOADING');
            toast("Writing duration completed! Dedicated upload window is now active.", {
              icon: '⏰',
              duration: 6000
            });
            return uploadSecs;
          }
          return prev - 1;
        });
      }, 1000);
    }

    // 5. STRUCTURED UPLOADING (Upload Buffer Window)
    if (examStatus === 'STRUCTURED_UPLOADING' && timeRemainingSeconds !== null) {
      timerIntervalRef.current = setInterval(() => {
        setTimeRemainingSeconds(prev => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current);
            if (answerFile) {
              toast.error("Upload window closing! Submitting selected answer sheet...", { duration: 4000 });
              handleSubmitExam();
            } else {
              setExamStatus('STRUCTURED_LOCKED');
              toast.error("Upload window expired. Submissions are now locked.", { duration: 5000 });
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [examStatus, timeUntilStartSeconds, timeRemainingSeconds, paperData, answerFile]);

  // Start Exam (Flexible mode - starts Part 1 or standalone paper)
  const handleStartExam = async () => {
    if (!paperData?.paper?.id) return;
    try {
      setLoading(true);
      const pType = paperData.paper.paperType || (content.contentType === 'sPaper' ? 'STRUCTURED' : 'MCQ');
      const res = await api.post(`/papers/${paperData.paper.id}/start`, {
        section: pType === 'STRUCTURED' ? 'STRUCTURED' : 'MCQ'
      });
      setSubmission(res.data.submission);

      if (pType === 'STRUCTURED') {
        const strDurSecs = ((paperData.paper.durationMinutes || paperData.paper.structuredDurationMinutes) || 60) * 60;
        setTimeRemainingSeconds(strDurSecs);
        setExamStatus('STRUCTURED_WRITING');
        toast.success("Structured Exam started. Writing phase is active.");
      } else {
        const mcqDurSecs = ((paperData.paper.durationMinutes || paperData.paper.mcqDurationMinutes) || 60) * 60;
        setTimeRemainingSeconds(mcqDurSecs);
        setExamStatus('IN_PROGRESS');
        toast.success("Exam started. Time is counting down.");
      }
    } catch (err) {
      console.error("Failed to start paper", err);
      toast.error(err.response?.data?.error || "Failed to start exam");
    } finally {
      setLoading(false);
    }
  };

  // Start Part 2 Structured Section (From Intermission in BOTH mode)
  const handleStartStructuredSection = async () => {
    if (!paperData?.paper?.id) return;
    try {
      setLoading(true);
      const res = await api.post(`/papers/${paperData.paper.id}/start`, { section: 'STRUCTURED' });
      setSubmission(res.data.submission);
      const strDurSecs = (paperData.paper.structuredDurationMinutes || paperData.paper.durationMinutes || 60) * 60;
      setTimeRemainingSeconds(strDurSecs);
      setExamStatus('STRUCTURED_WRITING');
      toast.success("Part 2: Structure Essay Section started! Writing time active.");
    } catch (err) {
      console.error("Failed to start structured section", err);
      toast.error(err.response?.data?.error || "Failed to start Part 2");
    } finally {
      setLoading(false);
    }
  };

  // Early unlock of upload window if student finishes writing before time
  const handleOpenUploadWindowEarly = () => {
    const uploadSecs = (paperData?.paper?.structuredUploadMinutes || 15) * 60;
    setTimeRemainingSeconds(uploadSecs);
    setExamStatus('STRUCTURED_UPLOADING');
    toast.success("Upload window activated! Attach your answer sheets now.");
  };

  // Answer Select for MCQ
  const handleSelectOption = (questionId, optionId) => {
    if (examStatus !== 'IN_PROGRESS') return;
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: optionId
    }));
  };

  // Submit Paper / Section Handler
  const handleSubmitExam = async () => {
    if (!paperData?.paper?.id) return;
    setSubmitting(true);
    setShowConfirmSubmit(false);
    try {
      const pType = paperData.paper.paperType || (content.contentType === 'sPaper' ? 'STRUCTURED' : 'MCQ');
      
      if (pType === 'BOTH') {
        if (examStatus === 'IN_PROGRESS') {
          // Submitting Part 1: MCQ section
          const answersArray = Object.keys(selectedAnswers).map(qId => ({
            questionId: parseInt(qId),
            selectedOptionId: selectedAnswers[qId]
          }));

          const res = await api.post(`/papers/${paperData.paper.id}/submit`, {
            section: 'MCQ',
            answers: answersArray
          });

          toast.success(`Part 1: MCQ completed! Score: ${res.data.mcqScore ?? res.data.score} marks.`);
          setSubmission(res.data.submission);
          setExamStatus('INTERMISSION');
          setupIntermissionTimer(res.data.submission);
          return;
        } else if (examStatus === 'STRUCTURED_WRITING' || examStatus === 'STRUCTURED_UPLOADING') {
          // Submitting Part 2: Structured section
          if (!answerFile && !submission?.answerFile) {
            toast.error("Please select your answer sheet file before submitting.");
            setSubmitting(false);
            return;
          }

          const formData = new FormData();
          formData.append('section', 'STRUCTURED');
          if (answerFile) {
            formData.append('answerFile', answerFile);
          }

          const res = await api.post(`/papers/${paperData.paper.id}/submit`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });

          toast.success("Structured paper submitted successfully!");
          setSubmission(res.data.submission);
          setExamStatus('SUBMITTED');
          loadPaper();
          if (onCompleted) onCompleted();
          return;
        }
      } else if (pType === 'MCQ') {
        const answersArray = Object.keys(selectedAnswers).map(qId => ({
          questionId: parseInt(qId),
          selectedOptionId: selectedAnswers[qId]
        }));

        const res = await api.post(`/papers/${paperData.paper.id}/submit`, {
          answers: answersArray
        });

        toast.success(`Exam submitted successfully. Score: ${res.data.score}%`);
        setSubmission(res.data.submission);
        setExamStatus('SUBMITTED');
        loadPaper();
        if (onCompleted) onCompleted();
      } else {
        // Standalone STRUCTURED
        if (!answerFile && !submission?.answerFile) {
          toast.error("Please select your answer sheet file before submitting.");
          setSubmitting(false);
          return;
        }

        const formData = new FormData();
        formData.append('section', 'STRUCTURED');
        if (answerFile) {
          formData.append('answerFile', answerFile);
        }

        const res = await api.post(`/papers/${paperData.paper.id}/submit`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        toast.success("Structured paper submitted successfully.");
        setSubmission(res.data.submission);
        setExamStatus('SUBMITTED');
        loadPaper();
        if (onCompleted) onCompleted();
      }
    } catch (err) {
      console.error("Failed to submit exam", err);
      const msg = err.response?.data?.error || "Failed to submit exam. Please try again.";
      toast.error(msg);
      if (err.response?.data?.locked) {
        setExamStatus('STRUCTURED_LOCKED');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const fetchStudentLeaderboard = async () => {
    if (!paperData?.paper?.id) return;
    try {
      setLoadingLeaderboard(true);
      const res = await api.get(`/papers/${paperData.paper.id}/leaderboard`);
      setLeaderboardData(res.data?.leaderboard || []);
      setLeaderboardMeta({
        paper: res.data?.paper,
        totalParticipants: res.data?.totalParticipants || res.data?.leaderboard?.length || 0,
        podium: res.data?.podium || [],
        myStanding: res.data?.myStanding || null
      });
      setShowLeaderboardModal(true);
    } catch (err) {
      console.error("Failed to load leaderboard", err);
      toast.error("Failed to load test leaderboard");
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  // Fetch Student Cumulative Paper Progress & Level
  const fetchStudentProgressModal = async () => {
    try {
      setLoadingProgress(true);
      setShowProgressModal(true);
      const res = await api.get('/papers/student/progress');
      setProgressData(res.data);
    } catch (err) {
      console.error("Failed to load progress", err);
      toast.error("Failed to load test performance history");
    } finally {
      setLoadingProgress(false);
    }
  };

  // Helper to determine student academic tier/level based on cumulative analytics
  const getStudentLevel = (overall) => {
    const avg = overall?.averagePercentage || 0;
    const count = overall?.totalTaken || 0;
    if (count === 0) {
      return { 
        level: 1, 
        title: 'Starter Scholar', 
        badge: '🌱 Level 1: Starter', 
        color: 'from-slate-700 to-slate-900 border-slate-600/50', 
        description: 'Complete your first paper test to earn your official rank level!' 
      };
    }
    if (avg >= 75 && count >= 3) {
      return { 
        level: 5, 
        title: 'Elite Master', 
        badge: '👑 Level 5: Elite Master', 
        color: 'from-amber-500/30 via-yellow-600/20 to-amber-950/40 border-amber-500/60 shadow-amber-500/20', 
        description: 'Outstanding mastery across all paper series! Consistent Grade-A performance.' 
      };
    }
    if (avg >= 65) {
      return { 
        level: 4, 
        title: 'Advanced Achiever', 
        badge: '⭐ Level 4: Advanced', 
        color: 'from-purple-600/30 via-indigo-600/20 to-purple-950/40 border-purple-500/60 shadow-purple-500/20', 
        description: 'Consistently strong marks! You are very close to Elite Master status.' 
      };
    }
    if (avg >= 50) {
      return { 
        level: 3, 
        title: 'Skilled Competitor', 
        badge: '🎯 Level 3: Competitor', 
        color: 'from-blue-600/30 via-cyan-600/20 to-blue-950/40 border-blue-500/60 shadow-blue-500/20', 
        description: 'Solid foundational marks. Focus on improving essay derivation steps.' 
      };
    }
    if (avg >= 35) {
      return { 
        level: 2, 
        title: 'Rising Apprentice', 
        badge: '⚡ Level 2: Apprentice', 
        color: 'from-emerald-600/30 via-teal-600/20 to-emerald-950/40 border-emerald-500/60 shadow-emerald-500/20', 
        description: 'Good foundation. Regular practice with time management will accelerate your marks.' 
      };
    }
    return { 
      level: 1, 
      title: 'Beginner Scholar', 
      badge: '🌱 Level 1: Starter', 
      color: 'from-slate-700/40 to-slate-900/60 border-slate-600/40', 
      description: 'Keep practicing consistently to level up your scores and climb the rankings!' 
    };
  };

  const handleAutoSubmitOnTimeout = () => {
    const pType = paperData?.paper?.paperType || (content.contentType === 'sPaper' ? 'STRUCTURED' : 'MCQ');
    if (pType === 'BOTH') {
      toast.error("MCQ duration completed. Submitting Part 1 answers...", { duration: 4000 });
    } else {
      toast.error("Exam duration completed. Submitting answers...", { duration: 4000 });
    }
    handleSubmitExam();
  };

  const formatSeconds = (totalSecs) => {
    if (totalSecs === null || totalSecs === undefined || totalSecs < 0) return '00:00:00';
    const hours = Math.floor(totalSecs / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const seconds = totalSecs % 60;
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatCountdownDays = (totalSecs) => {
    if (!totalSecs || totalSecs < 0) return '00h 00m 00s';
    const days = Math.floor(totalSecs / 86400);
    const hours = Math.floor((totalSecs % 86400) / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const seconds = totalSecs % 60;
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    }
    return `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
  };

  const formatDurationDisplay = (totalMins) => {
    const mins = parseInt(totalMins || 60, 10);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m (${mins} mins)`;
    if (h > 0) return `${h} Hour${h > 1 ? 's' : ''} (${mins} mins)`;
    return `${mins} Mins`;
  };

  if (!isOpen) return null;

  const questions = paperData?.paper?.questions || [];
  const currentQ = questions[currentQuestionIdx];
  const paperType = paperData?.paper?.paperType || (content.contentType === 'sPaper' ? 'STRUCTURED' : 'MCQ');
  const isMCQ = paperType === 'MCQ';
  const isStructured = paperType === 'STRUCTURED';
  const isBoth = paperType === 'BOTH';

  const answeredCount = Object.keys(selectedAnswers).filter(k => selectedAnswers[k] !== null && selectedAnswers[k] !== undefined).length;
  const unansweredCount = questions.length - answeredCount;

  const getBaseUrl = () => {
    let baseApiUrl = (api.defaults && api.defaults.baseURL) 
      ? api.defaults.baseURL.replace('/api', '') 
      : (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:5000');
    return baseApiUrl || 'http://localhost:5000';
  };

  const currentUserId = paperData?.userSubmission?.studentId || JSON.parse(localStorage.getItem('user') || '{}')?.student?.id || JSON.parse(localStorage.getItem('user') || '{}')?.id;

  const portalContent = (
    <div className="fixed inset-0 z-[99999999] w-screen h-[100dvh] bg-[#080d19]/95 backdrop-blur-3xl text-slate-100 flex flex-col overflow-hidden select-none font-sans">
      
      {/* 🌟 HEADER BAR 🌟 */}
      <header className="h-14 sm:h-16 px-4 sm:px-8 bg-white/[0.02] border-b border-white/10 flex items-center justify-between shrink-0 z-50">
        
        {/* Left: Back & Title with Logo */}
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 p-2 sm:p-2.5 rounded-xl transition-all active:scale-95 outline-none shrink-0"
            title="Exit Exam Portal"
          >
            <ArrowLeft size={16} className="sm:w-[18px] sm:h-[18px]" />
          </button>

          <img 
            src="/logo.png" 
            alt="IMA Campus" 
            className="h-7 sm:h-8 w-auto object-contain shrink-0 hidden xs:block" 
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border truncate ${
                (paperData?.paper?.category || 'WEEKLY') === 'MONTHLY'
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
              }`}>
                {(paperData?.paper?.category || 'WEEKLY') === 'MONTHLY' ? '🏆 Monthly Test' : '⚡ Weekly Test'}
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border truncate ${
                isMCQ ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                isStructured ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                'bg-blue-500/10 text-blue-400 border-blue-500/20'
              }`}>
                {isMCQ ? 'MCQ Examination' : isStructured ? 'Structure Essay' : 'Combined Test'}
              </span>
            </div>
            <h2 className="text-xs sm:text-base font-bold text-white truncate max-w-[170px] sm:max-w-sm md:max-w-md">
              {content?.title}
            </h2>
          </div>
        </div>

        {/* Right: Instructions, Timer & Actions */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          
          {/* Instructions Trigger Button */}
          <button
            onClick={() => setShowInstructionsModal(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-bold transition-all active:scale-95"
            title="View Exam Instructions"
          >
            <HelpCircle size={15} className="text-amber-400" />
            <span className="hidden sm:inline">Instructions</span>
          </button>

          {/* Real-Time Countdown Timer Pill */}
          {examStatus === 'IN_PROGRESS' && (
            <div className={`flex items-center gap-2 px-3.5 py-1.5 sm:py-2 rounded-full border transition-all shadow-md ${
              timeRemainingSeconds !== null && timeRemainingSeconds < 300 
                ? 'bg-red-500/20 text-red-400 border-red-500/50 shadow-red-500/30 animate-pulse' 
                : timeRemainingSeconds !== null && timeRemainingSeconds < 900
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-amber-500/20'
                : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-emerald-500/10'
            }`}>
              <Clock size={15} className={timeRemainingSeconds !== null && timeRemainingSeconds < 300 ? 'text-red-400 animate-spin' : timeRemainingSeconds !== null && timeRemainingSeconds < 900 ? 'text-amber-400' : 'text-emerald-400'} />
              <span className="font-sans font-black text-xs sm:text-sm tracking-wider">
                {isBoth ? 'Part 1: ' : ''}{formatSeconds(timeRemainingSeconds)}
              </span>
            </div>
          )}

          {examStatus === 'INTERMISSION' && (
            <div className="flex items-center gap-2 px-3.5 py-1.5 sm:py-2 rounded-full border transition-all shadow-md bg-blue-500/15 text-blue-300 border-blue-500/30 shadow-blue-500/10">
              <Sparkles size={15} className="text-blue-400" />
              <span className="font-sans font-black text-xs sm:text-sm tracking-wider">
                Break: {formatSeconds(timeUntilStartSeconds)}
              </span>
            </div>
          )}

          {examStatus === 'STRUCTURED_WRITING' && (
            <div className={`flex items-center gap-2 px-3.5 py-1.5 sm:py-2 rounded-full border transition-all shadow-md ${
              timeRemainingSeconds !== null && timeRemainingSeconds < 300 
                ? 'bg-red-500/20 text-red-400 border-red-500/50 shadow-red-500/30 animate-pulse' 
                : 'bg-purple-500/15 text-purple-300 border-purple-500/30 shadow-purple-500/10'
            }`}>
              <FileSignature size={15} className="text-purple-400" />
              <span className="font-sans font-black text-xs sm:text-sm tracking-wider">
                Writing: {formatSeconds(timeRemainingSeconds)}
              </span>
            </div>
          )}

          {examStatus === 'STRUCTURED_UPLOADING' && (
            <div className="flex items-center gap-2 px-3.5 py-1.5 sm:py-2 rounded-full border transition-all shadow-md bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-rose-500/30 animate-pulse">
              <UploadCloud size={15} className="text-rose-400 animate-bounce" />
              <span className="font-sans font-black text-xs sm:text-sm tracking-wider">
                Upload Window: {formatSeconds(timeRemainingSeconds)}
              </span>
            </div>
          )}

          {examStatus === 'COUNTDOWN_TO_START' && (
            <div className="flex items-center gap-2 px-3.5 py-1.5 sm:py-2 rounded-full border transition-all shadow-md bg-amber-500/15 text-amber-300 border-amber-500/30">
              <Calendar size={15} className="text-amber-400" />
              <span className="font-sans font-black text-xs sm:text-sm tracking-wider">
                Starts In: {formatCountdownDays(timeUntilStartSeconds)}
              </span>
            </div>
          )}

          {/* Mobile Question Palette Button (MCQ or BOTH during MCQ phase) */}
          {examStatus === 'IN_PROGRESS' && (isMCQ || isBoth) && (
            <button
              onClick={() => setShowMobilePalette(true)}
              className="lg:hidden bg-white/5 hover:bg-white/10 text-white font-bold p-2 sm:p-2.5 rounded-xl border border-white/10 flex items-center gap-1.5 text-xs transition-all active:scale-95"
              title="Question Palette"
            >
              <Grid size={15} className="text-emerald-400" />
              <span className="text-[11px] font-bold">{answeredCount}/{questions.length}</span>
            </button>
          )}

          {/* Close Button */}
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-white bg-white/5 hover:bg-red-500/20 border border-white/10 p-2 sm:p-2.5 rounded-xl transition-all outline-none"
            title="Close"
          >
            <X size={16} className="sm:w-[18px] sm:h-[18px]" />
          </button>
        </div>
      </header>

      {/* 🌟 BODY CONTAINER 🌟 */}
      <main className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
        
        {loading ? (
          <div className="flex flex-col items-center justify-center m-auto p-8 gap-4">
            <RefreshCw className="animate-spin text-rose-500" size={36} />
            <p className="text-slate-400 font-semibold text-sm">Preparing test environment...</p>
          </div>
        ) : (
          <div className="w-full flex-1 flex flex-col">
            
            {/* 🌟 STATE 1: PRE-START 🌟 */}
            {examStatus === 'PRE_START' && (
              <div className="w-full max-w-xl mx-auto my-auto p-4 sm:p-6 flex flex-col items-center text-center space-y-4 sm:space-y-5 animate-in fade-in">
                
                {/* Thumbnail Banner */}
                {content.thumbnail ? (
                  <div className="w-full max-w-sm sm:max-w-md aspect-[16/9] max-h-48 rounded-2xl overflow-hidden border border-white/15 shadow-2xl bg-white/[0.02] shrink-0">
                    <img src={`${getBaseUrl()}/storage/documents/${content.thumbnail}`} alt="Exam" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-full max-w-sm sm:max-w-md aspect-[16/9] max-h-36 rounded-2xl overflow-hidden border border-white/10 shadow-lg bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center shrink-0">
                    <Trophy size={40} className="text-amber-400/80" />
                  </div>
                )}

                {/* Title & Instructions */}
                <div className="space-y-1.5 max-w-md">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full inline-block">
                    Ready to Start
                  </span>
                  <h1 className="text-base sm:text-2xl font-black text-white leading-snug">
                    {content.title}
                  </h1>
                  <p className="text-slate-400 text-xs leading-relaxed line-clamp-3">
                    {paperData?.paper?.instructions || "Ensure you have a stable internet connection. When you click 'Start Exam Now', your countdown timer will begin immediately."}
                  </p>
                </div>

                {/* Metrics Grid */}
                {isBoth ? (
                  <div className="w-full max-w-md space-y-2.5">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl text-left">
                        <span className="text-[9px] font-black uppercase text-emerald-400">Part 1: MCQ</span>
                        <p className="text-xs font-bold text-white mt-0.5">{paperData?.paper?.mcqDurationMinutes || 0} mins • {paperData?.paper?.totalMcqMarks || 0} Marks</p>
                        <p className="text-[10px] text-slate-400">{questions.length} Questions</p>
                      </div>
                      <div className="bg-purple-500/10 border border-purple-500/20 p-2.5 rounded-xl text-left">
                        <span className="text-[9px] font-black uppercase text-purple-400">Part 2: Structured</span>
                        <p className="text-xs font-bold text-white mt-0.5">{paperData?.paper?.structuredDurationMinutes || 0} mins • {paperData?.paper?.totalStructuredMarks || 0} Marks</p>
                        <p className="text-[10px] text-slate-400">Essay / Hand-written</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="bg-white/[0.03] border border-white/10 p-2.5 rounded-xl text-left">
                        <p className="text-[9px] uppercase font-bold text-slate-400">Total Duration</p>
                        <p className="text-xs sm:text-sm font-bold text-white">{formatDurationDisplay(paperData?.paper?.durationMinutes || 60)}</p>
                      </div>
                      <div className="bg-white/[0.03] border border-white/10 p-2.5 rounded-xl text-left">
                        <p className="text-[9px] uppercase font-bold text-slate-400">Total Marks / Pass</p>
                        <p className="text-xs sm:text-sm font-bold text-white">{paperData?.paper?.totalMarks || 100} Marks ({paperData?.paper?.passMarks || 40}%)</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2.5 w-full max-w-md">
                    <div className="bg-white/[0.03] border border-white/10 p-2.5 sm:p-3 rounded-xl">
                      <Clock className="text-blue-400 mx-auto mb-1" size={18} />
                      <p className="text-[9px] uppercase font-bold text-slate-400">Duration</p>
                      <p className="text-xs sm:text-sm font-bold text-white">{formatDurationDisplay(paperData?.paper?.durationMinutes || 60)}</p>
                    </div>
                    <div className="bg-white/[0.03] border border-white/10 p-2.5 sm:p-3 rounded-xl">
                      <HelpCircle className="text-emerald-400 mx-auto mb-1" size={18} />
                      <p className="text-[9px] uppercase font-bold text-slate-400">Test Format</p>
                      <p className="text-xs sm:text-sm font-bold text-white">
                        {isMCQ ? `${questions.length} MCQs` : isStructured ? 'Structure Essay' : `${questions.length} MCQs + Essay`}
                      </p>
                    </div>
                    <div className="bg-white/[0.03] border border-white/10 p-2.5 sm:p-3 rounded-xl">
                      <Award className="text-amber-400 mx-auto mb-1" size={18} />
                      <p className="text-[9px] uppercase font-bold text-slate-400">Pass Mark</p>
                      <p className="text-xs sm:text-sm font-bold text-white">{paperData?.paper?.passMarks || 40}%</p>
                    </div>
                  </div>
                )}

                {/* Start Exam CTA Button */}
                <div className="w-full max-w-md pt-1">
                  <button
                    onClick={handleStartExam}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm uppercase tracking-wider py-3.5 rounded-xl shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.01] active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Play size={16} fill="currentColor" /> Start Exam Now
                  </button>
                </div>
              </div>
            )}

            {/* 🌟 STATE 2: COUNTDOWN TO START (Scheduled Start) 🌟 */}
            {examStatus === 'COUNTDOWN_TO_START' && (
              <div className="w-full max-w-lg mx-auto my-auto p-4 sm:p-6 flex flex-col items-center text-center space-y-4 sm:space-y-6 animate-in fade-in">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
                  <Calendar size={28} />
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full inline-block">
                    Synchronized Scheduled Exam
                  </span>
                  <h1 className="text-base sm:text-2xl font-black text-white">{content.title}</h1>
                  <p className="text-slate-400 text-xs max-w-sm mx-auto">
                    This paper is scheduled to start simultaneously for all registered students.
                  </p>
                </div>

                {/* Big Countdown Box */}
                <div className="w-full max-w-sm bg-white/[0.03] border border-amber-500/30 rounded-2xl p-5 sm:p-6 shadow-xl">
                  <p className="text-[10px] uppercase font-bold text-amber-300 tracking-wider mb-2">Exam Starts In</p>
                  <div className="font-sans font-black text-2xl sm:text-4xl text-white tracking-wider">
                    {formatCountdownDays(timeUntilStartSeconds)}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-3">
                    Questions unlock automatically when countdown reaches zero.
                  </p>
                </div>
              </div>
            )}

            {/* 🌟 STATE 3: MCQ IN PROGRESS (Part 1 in BOTH or Standalone MCQ) 🌟 */}
            {examStatus === 'IN_PROGRESS' && (
              <div className="flex-1 w-full max-w-7xl mx-auto p-3 sm:p-6 lg:p-8 flex flex-col lg:grid lg:grid-cols-4 gap-4 sm:gap-6 animate-in fade-in">
                
                {/* Main Question Area (Col 1-3) */}
                <div className="lg:col-span-3 space-y-4">
                  {/* Section Indicator Banner for BOTH mode */}
                  {isBoth && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-3 shadow-md">
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                        <div>
                          <p className="text-xs sm:text-sm font-extrabold text-white">Part 1 of 2: Multiple Choice Questions (MCQ)</p>
                          <p className="text-[10px] text-emerald-300">
                            Answer all questions. Once submitted, your intermission break begins before Part 2.
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-black uppercase text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1 rounded-lg shrink-0">
                        {paperData?.paper?.mcqDurationMinutes || 0}m • {paperData?.paper?.totalMcqMarks || 0} Marks
                      </span>
                    </div>
                  )}

                  {/* Optional MCQ Paper PDF Download Banner */}
                  {paperData?.paper?.mcqPaperFile && (
                    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-3 shadow-md">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText size={20} className="text-emerald-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-white truncate">Part 1: MCQ Question Paper (PDF)</p>
                          <p className="text-[10px] text-slate-400 truncate max-w-[200px] sm:max-w-none">{paperData.paper.mcqPaperFile}</p>
                        </div>
                      </div>
                      <a
                        href={`${getBaseUrl()}/storage/documents/${paperData.paper.mcqPaperFile}`}
                        target="_blank"
                        rel="noreferrer"
                        download
                        className="shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow active:scale-95"
                      >
                        <Download size={13} /> View / Download PDF
                      </a>
                    </div>
                  )}

                  {currentQ ? (
                    <div className="bg-white/[0.03] border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-7 md:p-8 space-y-5 sm:space-y-6 shadow-xl relative backdrop-blur-md h-auto">
                      
                      {/* Question Top Meta */}
                      <div className="flex items-center justify-between border-b border-white/5 pb-3">
                        <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
                          Question {currentQuestionIdx + 1} of {questions.length}
                        </span>
                        <span className="text-[11px] sm:text-xs font-semibold text-slate-400">
                          {selectedAnswers[currentQ.id] !== undefined ? 'Answered' : 'Not Answered'}
                        </span>
                      </div>

                      {/* Question Text */}
                      <div className="space-y-3">
                        <h3 className="text-sm sm:text-lg md:text-xl font-bold text-white leading-relaxed whitespace-pre-line">
                          {currentQ.questionText}
                        </h3>

                        {/* Question Figures / Diagrams */}
                        {(() => {
                          const qImages = (Array.isArray(currentQ.images) && currentQ.images.length > 0)
                            ? currentQ.images
                            : (currentQ.image ? [currentQ.image] : []);

                          if (qImages.length === 0) return null;

                          const activeImg = qImages[activeFigureIdx] || qImages[0];

                          return (
                            <div className="space-y-2.5 rounded-2xl border border-white/10 bg-black/40 p-3 sm:p-4">
                              {/* If multiple images, show tabs/pills */}
                              {qImages.length > 1 && (
                                <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                                  <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                                    {qImages.map((_, fIdx) => (
                                      <button
                                        key={fIdx}
                                        type="button"
                                        onClick={() => setActiveFigureIdx(fIdx)}
                                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                                          activeFigureIdx === fIdx
                                            ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                                            : 'bg-white/5 hover:bg-white/10 text-slate-300'
                                        }`}
                                      >
                                        <ImageIcon size={12} />
                                        <span>Figure {fIdx + 1}</span>
                                      </button>
                                    ))}
                                  </div>
                                  <span className="text-[10px] font-bold text-slate-400 shrink-0 bg-white/5 px-2 py-0.5 rounded-md">
                                    {activeFigureIdx + 1} of {qImages.length}
                                  </span>
                                </div>
                              )}

                              {/* Main Figure Display with click-to-zoom */}
                              <div 
                                onClick={() => setLightboxState({ images: qImages, currentIdx: activeFigureIdx })}
                                className="relative group cursor-pointer rounded-xl overflow-hidden max-h-72 sm:max-h-96 flex items-center justify-center p-2 bg-black/60 hover:border-emerald-500/50 border border-transparent transition-all shadow-inner"
                              >
                                <img 
                                  src={`${getBaseUrl()}/storage/documents/${activeImg}`} 
                                  alt={`Figure ${activeFigureIdx + 1}`} 
                                  className="max-h-64 sm:max-h-88 object-contain rounded-lg transition-transform duration-200 group-hover:scale-[1.01]" 
                                />
                                <div className="absolute top-2.5 right-2.5 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-lg text-white/90 text-xs flex items-center gap-1.5 opacity-85 group-hover:opacity-100 transition-opacity border border-white/10 shadow-lg">
                                  <ZoomIn size={13} className="text-emerald-400" />
                                  <span className="text-[11px] font-bold">Click to zoom</span>
                                </div>
                              </div>

                              {/* Thumbnail strip if > 1 */}
                              {qImages.length > 1 && (
                                <div className="flex items-center gap-2 pt-1 overflow-x-auto">
                                  {qImages.map((img, thumbIdx) => (
                                    <button
                                      key={thumbIdx}
                                      type="button"
                                      onClick={() => setActiveFigureIdx(thumbIdx)}
                                      className={`relative rounded-lg overflow-hidden border-2 h-14 w-14 shrink-0 transition-all ${
                                        activeFigureIdx === thumbIdx ? 'border-emerald-400 scale-105 shadow-md shadow-emerald-500/30' : 'border-white/10 opacity-60 hover:opacity-100'
                                      }`}
                                    >
                                      <img
                                        src={`${getBaseUrl()}/storage/documents/${img}`}
                                        alt={`Figure ${thumbIdx + 1}`}
                                        className="h-full w-full object-cover"
                                      />
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Options List */}
                      <div className="space-y-2.5 sm:space-y-3 pt-1">
                        {(currentQ.options || []).map((opt, optIdx) => {
                          const isSelected = selectedAnswers[currentQ.id] === opt.id;
                          return (
                            <button
                              key={opt.id || optIdx}
                              onClick={() => handleSelectOption(currentQ.id, opt.id)}
                              className={`w-full text-left p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all flex items-center gap-3 sm:gap-4 group ${
                                isSelected 
                                  ? 'bg-emerald-600/20 border-emerald-500 shadow-lg shadow-emerald-600/20 scale-[1.008]' 
                                  : 'bg-white/[0.02] border-white/10 hover:border-white/30 hover:bg-white/[0.05]'
                              }`}
                            >
                              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center font-sans font-bold text-xs sm:text-sm transition-all shrink-0 ${
                                isSelected 
                                  ? 'bg-emerald-500 text-black font-black shadow-md' 
                                  : 'bg-white/10 text-slate-400 border border-white/10 group-hover:border-white/30'
                              }`}>
                                {isSelected ? <Check size={16} /> : (optIdx + 1)}
                              </div>
                              <span className={`text-xs sm:text-base font-semibold leading-relaxed flex-1 ${isSelected ? 'text-white font-bold' : 'text-slate-300'}`}>
                                {opt.optionText}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Bottom Navigation Buttons */}
                      <div className="flex justify-between items-center pt-4 sm:pt-6 border-t border-white/10 gap-2">
                        <button
                          onClick={() => setCurrentQuestionIdx(prev => Math.max(0, prev - 1))}
                          disabled={currentQuestionIdx === 0}
                          className="bg-white/5 hover:bg-white/10 text-white font-bold px-3.5 sm:px-5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-all disabled:opacity-30 active:scale-95 border border-white/5"
                        >
                          <ChevronLeft size={16} /> <span className="hidden xs:inline">Previous</span>
                        </button>

                        <div className="flex gap-2.5">
                          {currentQuestionIdx < questions.length - 1 ? (
                            <button
                              onClick={() => setCurrentQuestionIdx(prev => Math.min(questions.length - 1, prev + 1))}
                              className="bg-white/10 hover:bg-white/20 text-white font-bold px-4 sm:px-6 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-all active:scale-95 border border-white/10"
                            >
                              Next <ChevronRight size={16} />
                            </button>
                          ) : isBoth ? (
                            <button
                              onClick={() => setShowConfirmSubmit(true)}
                              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black px-5 sm:px-7 py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all hover:scale-105 active:scale-95 border border-emerald-400/30"
                            >
                              Submit Part 1 (MCQ) & Proceed <ChevronRight size={16} />
                            </button>
                          ) : (
                            <button
                              onClick={() => setShowConfirmSubmit(true)}
                              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black px-5 sm:px-7 py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all hover:scale-105 active:scale-95 border border-emerald-400/30"
                            >
                              <Send size={14} /> Submit Exam
                            </button>
                          )}
                        </div>
                      </div>

                    </div>
                  ) : (
                    <p className="text-white text-center py-12">No questions found in this paper.</p>
                  )}
                </div>

                {/* Right Desktop Palette (Col 4) */}
                <div className="hidden lg:block lg:col-span-1 space-y-4">
                  <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-5 space-y-4 shadow-xl backdrop-blur-md sticky top-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
                      <span>Question Palette</span>
                      <span className="text-emerald-400 font-sans font-bold">{answeredCount}/{questions.length}</span>
                    </h4>

                    {/* Progress Bar */}
                    <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/10">
                      <div 
                        className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-300"
                        style={{ width: `${(answeredCount / Math.max(1, questions.length)) * 100}%` }}
                      />
                    </div>

                    {/* Grid Palette */}
                    <div className="grid grid-cols-5 gap-2 max-h-72 overflow-y-auto custom-scrollbar p-1">
                      {questions.map((q, idx) => {
                        const isAnswered = selectedAnswers[q.id] !== undefined && selectedAnswers[q.id] !== null;
                        const isCurrent = currentQuestionIdx === idx;
                        return (
                          <button
                            key={q.id || idx}
                            onClick={() => setCurrentQuestionIdx(idx)}
                            className={`h-9 rounded-xl font-sans font-bold text-xs transition-all flex items-center justify-center border ${
                              isCurrent 
                                ? 'border-emerald-500 ring-2 ring-emerald-500/50 text-white scale-105 z-10 bg-emerald-500/20 font-black' 
                                : isAnswered 
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm' 
                                  : 'bg-white/5 text-slate-400 border-white/10 hover:border-white/20'
                            }`}
                          >
                            {idx + 1}
                          </button>
                        );
                      })}
                    </div>

                    {/* Submit CTA */}
                    <button
                      onClick={() => setShowConfirmSubmit(true)}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider shadow-md transition-all active:scale-95"
                    >
                      {isBoth ? "Submit Part 1 & Proceed" : "Submit Exam"}
                    </button>
                  </div>
                </div>

              </div>
            )}

            {/* 🌟 STATE 4: INTERMISSION (Between Part 1 MCQ and Part 2 Structured in BOTH mode) 🌟 */}
            {examStatus === 'INTERMISSION' && (
              <div className="w-full max-w-2xl mx-auto my-auto p-4 sm:p-8 space-y-6 text-center animate-in fade-in">
                
                {/* Part 1 Completion Banner */}
                <div className="bg-gradient-to-b from-emerald-500/15 via-emerald-500/5 to-transparent border border-emerald-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-3">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                    <CheckCircle size={36} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/20 border border-emerald-500/30 px-3 py-1 rounded-full inline-block">
                    Part 1 Completed
                  </span>
                  <h2 className="text-xl sm:text-3xl font-black text-white">
                    MCQ Section Successfully Submitted!
                  </h2>
                  <p className="text-slate-300 text-xs sm:text-sm max-w-md mx-auto">
                    Your Part 1 answers are safely recorded. Score achieved:
                  </p>

                  <div className="bg-emerald-500/20 border border-emerald-500/40 rounded-2xl p-4 max-w-xs mx-auto">
                    <p className="text-[10px] font-black uppercase text-emerald-300">Part 1 MCQ Score</p>
                    <p className="text-3xl font-black text-white mt-0.5">
                      {submission?.mcqScore ?? submission?.score ?? 0} Marks
                    </p>
                    <p className="text-[11px] text-emerald-200 mt-0.5">
                      {submission?.correctAnswers || 0} of {questions.length} questions correct
                    </p>
                  </div>
                </div>

                {/* Part 2 Structured Section Preview & Countdown */}
                <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-xl space-y-5">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4 flex-wrap gap-2 text-left">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 bg-purple-500/20 border border-purple-500/30 px-2.5 py-0.5 rounded-md">
                        Upcoming: Part 2 of 2
                      </span>
                      <h3 className="text-base sm:text-lg font-black text-white mt-1">Structure Essay Section</h3>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-purple-300">
                        {paperData?.paper?.structuredDurationMinutes || 60}m Writing + {paperData?.paper?.structuredUploadMinutes || 15}m Upload
                      </span>
                      <p className="text-[10px] text-slate-400">{paperData?.paper?.totalStructuredMarks || 0} Marks</p>
                    </div>
                  </div>

                  {/* Scheduled vs Flexible Intermission Timer */}
                  {paperData?.paper?.structuredTimerMode === 'SCHEDULED' ? (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 space-y-3">
                      <div className="flex items-center justify-center gap-2 text-amber-300 text-xs font-bold uppercase tracking-wider">
                        <Calendar size={15} /> Synchronized Start: {paperData?.paper?.structuredScheduledStartTime ? new Date(paperData.paper.structuredScheduledStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Scheduled'}
                      </div>
                      
                      {timeUntilStartSeconds !== null && timeUntilStartSeconds > 0 ? (
                        <div className="space-y-1">
                          <p className="text-[10px] text-slate-400 uppercase font-bold">Structure Section Starts In</p>
                          <div className="font-sans font-black text-2xl sm:text-4xl text-white tracking-wider">
                            {formatCountdownDays(timeUntilStartSeconds)}
                          </div>
                          <p className="text-[11px] text-amber-300/80 pt-1">
                            The section will automatically unlock when countdown completes.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3 pt-1">
                          <p className="text-xs text-emerald-400 font-bold">Scheduled start time has arrived!</p>
                          <button
                            onClick={handleStartStructuredSection}
                            disabled={loading}
                            className="w-full bg-purple-600 hover:bg-purple-500 text-white font-extrabold py-3.5 rounded-xl text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-purple-600/30 transition-all hover:scale-[1.01] active:scale-95 flex items-center justify-center gap-2"
                          >
                            <Play size={16} fill="currentColor" /> Start Part 2: Structure Exam Now
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Flexible Mode Intermission */
                    <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-5 space-y-4">
                      <div className="flex items-center justify-center gap-2 text-purple-300 text-xs font-bold uppercase tracking-wider">
                        <Sparkles size={15} /> Recommended Break Time
                      </div>

                      {timeUntilStartSeconds !== null && timeUntilStartSeconds > 0 ? (
                        <div className="space-y-1">
                          <div className="font-sans font-black text-2xl sm:text-4xl text-white tracking-wider">
                            {formatSeconds(timeUntilStartSeconds)}
                          </div>
                          <p className="text-[11px] text-slate-300">
                            Take a break, stretch, and get your writing stationery ready.
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-300">
                          Recommended break time is up. Whenever you are ready, click below to start writing!
                        </p>
                      )}

                      <button
                        onClick={handleStartStructuredSection}
                        disabled={loading}
                        className="w-full bg-purple-600 hover:bg-purple-500 text-white font-extrabold py-3.5 rounded-xl text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-purple-600/30 transition-all hover:scale-[1.01] active:scale-95 flex items-center justify-center gap-2"
                      >
                        <Play size={16} fill="currentColor" /> Start Part 2: Structure Exam Now
                      </button>
                    </div>
                  )}

                </div>

              </div>
            )}

            {/* 🌟 STATE 5: STRUCTURED WRITING PHASE 🌟 */}
            {examStatus === 'STRUCTURED_WRITING' && (
              <div className="flex-1 w-full max-w-3xl mx-auto p-4 sm:p-8 flex flex-col justify-center space-y-5 animate-in fade-in">
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl sm:rounded-3xl p-5 sm:p-7 space-y-5 shadow-xl backdrop-blur-md">
                  
                  {/* Phase Header */}
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 bg-purple-500/20 border border-purple-500/30 px-2.5 py-0.5 rounded-md">
                        Step 1 of 2: Writing Duration
                      </span>
                      <h3 className="text-base sm:text-lg font-black text-white mt-1 flex items-center gap-2">
                        <FileSignature size={20} className="text-purple-400" /> Structure Essay Writing Phase
                      </h3>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Writing Time Left</p>
                      <p className="text-lg font-black text-purple-300 font-sans tracking-wider">
                        {formatSeconds(timeRemainingSeconds)}
                      </p>
                    </div>
                  </div>

                  {/* Master Question Sheet PDF */}
                  {((isBoth && paperData?.paper?.structuredPaperFile) || content.fileName) && (
                    <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-md">
                      <div className="flex items-center gap-3">
                        <FileText size={28} className="text-purple-400 shrink-0" />
                        <div>
                          <p className="text-xs sm:text-sm font-extrabold text-white">
                            Structure Essay Master Question Paper (PDF)
                          </p>
                          <p className="text-[11px] text-slate-400 truncate max-w-[200px] sm:max-w-none">
                            {(isBoth && paperData?.paper?.structuredPaperFile) ? paperData.paper.structuredPaperFile : content.fileName}
                          </p>
                        </div>
                      </div>
                      <a 
                        href={`${getBaseUrl()}/storage/documents/${(isBoth && paperData?.paper?.structuredPaperFile) ? paperData.paper.structuredPaperFile : content.fileName}`} 
                        target="_blank" 
                        rel="noreferrer" 
                        download
                        className="w-full sm:w-auto bg-purple-600 hover:bg-purple-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
                      >
                        <Download size={14} /> Download Question PDF
                      </a>
                    </div>
                  )}

                  {/* Instructions */}
                  <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl text-xs text-slate-300 space-y-2 leading-relaxed">
                    <p className="font-bold text-white flex items-center gap-1.5">
                      <FileSignature size={14} className="text-purple-400" /> Instructions for Handwritten Paper:
                    </p>
                    <p>1. Download the PDF above and write your detailed answers clearly on physical papers using a blue or black pen.</p>
                    <p>2. Clearly number each question and keep your handwriting legible.</p>
                    <p>3. When this writing countdown reaches 00:00, the <strong>Dedicated Upload Window ({paperData?.paper?.structuredUploadMinutes || 15} minutes)</strong> will activate automatically for photographing or scanning your work.</p>
                  </div>

                  {/* Finished writing early button */}
                  <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 bg-black/20 p-4 rounded-2xl border border-white/5">
                    <div>
                      <p className="text-xs font-bold text-white">Finished writing early?</p>
                      <p className="text-[10px] text-slate-400">You can open the dedicated photo/PDF upload window immediately.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenUploadWindowEarly}
                      className="bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 hover:border-purple-400 font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all shrink-0 active:scale-95"
                    >
                      <UploadCloud size={14} /> Open Upload Window Now
                    </button>
                  </div>

                </div>
              </div>
            )}

            {/* 🌟 STATE 6: STRUCTURED UPLOADING PHASE (Dedicated Upload Buffer Window) 🌟 */}
            {examStatus === 'STRUCTURED_UPLOADING' && (
              <div className="flex-1 w-full max-w-3xl mx-auto p-4 sm:p-8 flex flex-col justify-center space-y-5 animate-in fade-in">
                
                {/* URGENT Upload Warning Banner */}
                <div className="bg-gradient-to-r from-rose-500/20 via-rose-500/10 to-amber-500/20 border-2 border-rose-500/60 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-rose-500/30 text-rose-300 animate-pulse shrink-0">
                      <UploadCloud size={28} />
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-wider text-rose-400 bg-rose-500/20 border border-rose-500/30 px-2 py-0.5 rounded-md">
                        Strict Upload Buffer Active
                      </span>
                      <h3 className="text-base sm:text-lg font-black text-white mt-0.5">
                        Writing Finished — Upload Your Answer Sheet
                      </h3>
                      <p className="text-xs text-rose-200/80">
                        Uploads will be permanently locked once time reaches zero. Late uploads are rejected.
                      </p>
                    </div>
                  </div>

                  <div className="text-center sm:text-right shrink-0 bg-black/40 border border-rose-500/40 px-4 py-2 rounded-2xl">
                    <p className="text-[9px] uppercase font-bold text-rose-300">Upload Time Remaining</p>
                    <p className="text-2xl sm:text-3xl font-black text-rose-400 font-sans tracking-wider animate-pulse">
                      {formatSeconds(timeRemainingSeconds)}
                    </p>
                  </div>
                </div>

                <div className="bg-white/[0.03] border border-white/10 rounded-2xl sm:rounded-3xl p-5 sm:p-7 space-y-5 shadow-xl backdrop-blur-md">
                  {/* File Attachment Box */}
                  <div className="space-y-3">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                      Upload Answer Sheet (Single PDF or Images) *
                    </label>

                    <div className="border-2 border-dashed border-rose-500/40 hover:border-rose-500/70 rounded-2xl p-6 sm:p-8 text-center bg-rose-500/[0.03] transition-colors relative cursor-pointer group">
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        onChange={(e) => setAnswerFile(e.target.files[0])}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <UploadCloud size={36} className="mx-auto text-rose-400 mb-2 group-hover:scale-110 transition-transform" />
                      {answerFile ? (
                        <div>
                          <p className="text-sm font-black text-emerald-400 flex items-center justify-center gap-1.5">
                            <Check size={16} /> {answerFile.name}
                          </p>
                          <p className="text-xs text-slate-300 mt-0.5">
                            {(answerFile.size / 1024 / 1024).toFixed(2)} MB • Ready to submit
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-xs sm:text-sm font-extrabold text-white">Click or tap to upload answer PDF / image</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Supports PDF, PNG, JPG (Max 25MB)</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => setShowConfirmSubmit(true)}
                    disabled={submitting}
                    className="w-full bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 text-white font-black py-4 rounded-xl text-xs sm:text-sm uppercase tracking-wider shadow-xl shadow-purple-600/30 transition-all disabled:opacity-40 active:scale-95 flex items-center justify-center gap-2"
                  >
                    {submitting ? <RefreshCw className="animate-spin" size={18} /> : <><Send size={16} /> Submit Final Structured Answers</>}
                  </button>
                </div>
              </div>
            )}

            {/* 🌟 STATE 7: STRUCTURED LOCKED (Upload Buffer Expired) 🌟 */}
            {examStatus === 'STRUCTURED_LOCKED' && (
              <div className="w-full max-w-xl mx-auto my-auto p-4 sm:p-8 space-y-6 text-center animate-in fade-in">
                <div className="bg-red-500/10 border border-red-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-4">
                  <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-400 border border-red-500/40 flex items-center justify-center mx-auto shadow-lg shadow-red-500/20">
                    <Lock size={32} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-red-400 bg-red-500/20 border border-red-500/30 px-3 py-1 rounded-full inline-block">
                    Upload Window Closed
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black text-white">
                    Submissions are Now Permanently Locked
                  </h2>
                  <p className="text-slate-300 text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
                    The dedicated upload buffer window has expired. In accordance with exam integrity rules, late submissions cannot be accepted.
                    {isBoth && " Your Part 1 MCQ answers remain safely recorded."}
                  </p>

                  <button
                    onClick={() => setExamStatus('SUBMITTED')}
                    className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl text-xs sm:text-sm transition-all"
                  >
                    View Scorecard & Leaderboard
                  </button>
                </div>
              </div>
            )}

            {/* 🌟 STATE 4: SUBMITTED (SCORECARD, LEADERBOARD & QUESTION REVIEW) 🌟 */}
            {examStatus === 'SUBMITTED' && (
              <div className="w-full max-w-3xl mx-auto p-4 sm:p-6 space-y-5 sm:space-y-6 animate-in fade-in">
                
                {/* 1. SCORE BANNER */}
                {isMCQ ? (
                  <div className="bg-white/[0.03] border border-white/15 rounded-2xl sm:rounded-3xl p-5 sm:p-8 text-center space-y-4 shadow-xl relative overflow-hidden">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center mx-auto shadow-lg font-bold border-2 border-white/20">
                      <Award size={36} className="sm:w-10 sm:h-10" />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full inline-block ${
                          (submission?.score || 0) >= (paperData?.paper?.passMarks || 40)
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                            : 'bg-red-500/20 text-red-300 border border-red-500/40'
                        }`}>
                          {(submission?.score || 0) >= (paperData?.paper?.passMarks || 40) ? 'Exam Passed' : 'Exam Failed'}
                        </span>
                        {submission?.grade && (
                          <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-0.5 rounded-full inline-block border ${getGradeStyle(submission.grade)}`}>
                            Grade {submission.grade}
                          </span>
                        )}
                      </div>
                      <h2 className="text-2xl sm:text-4xl font-black text-white">{submission?.score || 0}%</h2>
                      <p className="text-slate-400 text-xs sm:text-sm">
                        You scored {submission?.correctAnswers || 0} out of {submission?.totalQuestions || questions.length} questions correctly.
                      </p>
                    </div>

                    {/* Stats Summary Grid */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-3 max-w-sm mx-auto pt-1">
                      <div className="bg-white/5 border border-white/10 p-2.5 rounded-xl">
                        <p className="text-[9px] uppercase font-bold text-slate-400">Total</p>
                        <p className="text-xs sm:text-sm font-bold text-white">{submission?.totalQuestions || questions.length}</p>
                      </div>
                      <div className="bg-emerald-500/10 border border-emerald-500/30 p-2.5 rounded-xl">
                        <p className="text-[9px] uppercase font-bold text-emerald-400">Correct</p>
                        <p className="text-xs sm:text-sm font-bold text-emerald-300">{submission?.correctAnswers || 0}</p>
                      </div>
                      <div className="bg-red-500/10 border border-red-500/30 p-2.5 rounded-xl">
                        <p className="text-[9px] uppercase font-bold text-red-400">Incorrect</p>
                        <p className="text-xs sm:text-sm font-bold text-red-300">{(submission?.totalQuestions || questions.length) - (submission?.correctAnswers || 0)}</p>
                      </div>
                    </div>
                  </div>
                ) : isStructured ? (
                  /* Structured Submission Receipt */
                  <div className="bg-white/[0.03] border border-white/10 rounded-2xl sm:rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-xl">
                    <CheckCircle2 size={44} className="text-emerald-400 mx-auto" />
                    <h2 className="text-lg sm:text-2xl font-black text-white">Structure Essay Paper Submitted</h2>
                    <p className="text-slate-300 text-xs sm:text-sm max-w-md mx-auto">
                      Your answer sheet has been securely submitted for lecturer evaluation.
                    </p>

                    {/* Submitted Answer File Card */}
                    {submission?.answerFile && (
                      <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 max-w-sm mx-auto flex items-center justify-between gap-3 text-left">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText size={20} className="text-purple-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">Uploaded Answer Sheet</p>
                            <p className="text-[10px] text-slate-400 truncate">{submission.answerFile}</p>
                            {(submission.submittedAt || submission.structuredSubmittedAt) && (
                              <p className="text-[9px] text-emerald-400 mt-0.5">
                                ✓ Uploaded on {new Date(submission.structuredSubmittedAt || submission.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            )}
                          </div>
                        </div>
                        <a
                          href={`${getBaseUrl()}/storage/documents/${submission.answerFile}`}
                          target="_blank"
                          rel="noreferrer"
                          download
                          className="shrink-0 bg-purple-600 hover:bg-purple-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 transition-all"
                        >
                          <Download size={13} /> View
                        </a>
                      </div>
                    )}

                    {submission?.score !== null && submission?.score !== undefined ? (
                      <div className="bg-purple-500/10 border border-purple-500/30 p-4 rounded-2xl max-w-sm mx-auto mt-2">
                        <p className="text-xs uppercase font-black text-purple-300 tracking-wider">Awarded Marks</p>
                        <p className="text-3xl font-black text-white mt-0.5">{submission.score} Marks</p>
                        {submission.grade && (
                          <span className={`text-xs font-black uppercase tracking-wider px-3.5 py-1 rounded-full inline-block border mt-2 ${getGradeStyle(submission.grade)}`}>
                            Grade {submission.grade}
                          </span>
                        )}
                        {submission.teacherFeedback && (
                          <p className="text-xs sm:text-sm text-slate-200 mt-2 italic bg-black/40 p-2.5 rounded-xl border border-white/5">
                            "{submission.teacherFeedback}"
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="inline-block bg-amber-500/20 text-amber-300 border border-amber-500/40 px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold mt-2">
                        ⏳ Pending Lecturer Evaluation
                      </span>
                    )}
                  </div>
                ) : (
                  /* BOTH Combined Paper Receipt */
                  <div className="bg-white/[0.03] border border-white/15 rounded-2xl sm:rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-xl">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center mx-auto shadow-lg">
                      <Award size={36} />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full inline-block bg-blue-500/20 text-blue-300 border border-blue-500/40">
                          Combined Exam Completed
                        </span>
                        {submission?.grade && (
                          <span className={`text-xs font-black uppercase tracking-wider px-3.5 py-1 rounded-full inline-block border ${getGradeStyle(submission.grade)}`}>
                            Grade {submission.grade}
                          </span>
                        )}
                      </div>
                      <h2 className="text-2xl sm:text-4xl font-black text-white">
                        {submission?.score !== null ? `${submission.score} Total Marks` : 'Exam Submitted'}
                      </h2>
                      <p className="text-slate-300 text-xs sm:text-sm">
                        Part 1 MCQs evaluated automatically. Part 2 essay evaluated by lecturer.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto pt-2">
                      <div className="bg-emerald-500/10 border border-emerald-500/30 p-3.5 rounded-2xl">
                        <span className="text-xs uppercase font-bold text-emerald-400 block">MCQ Score</span>
                        <span className="text-xl font-black text-white">{submission?.mcqScore !== null ? `${submission.mcqScore} pts` : '0 pts'}</span>
                        <span className="text-xs text-slate-400 block mt-0.5">({submission?.correctAnswers || 0}/{submission?.totalQuestions || questions.length} correct)</span>
                      </div>
                      <div className="bg-purple-500/10 border border-purple-500/30 p-3.5 rounded-2xl">
                        <span className="text-xs uppercase font-bold text-purple-400 block">Essay Score</span>
                        <span className="text-xl font-black text-white">
                          {submission?.structuredScore !== null ? `${submission.structuredScore} pts` : 'Pending'}
                        </span>
                        <span className="text-xs text-slate-400 block mt-0.5">Lecturer grading</span>
                      </div>
                    </div>

                    {/* Submitted Answer File Card for BOTH mode */}
                    {submission?.answerFile && (
                      <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 max-w-sm mx-auto flex items-center justify-between gap-3 text-left">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText size={20} className="text-purple-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">Uploaded Essay Sheet</p>
                            <p className="text-[10px] text-slate-400 truncate">{submission.answerFile}</p>
                            {(submission.submittedAt || submission.structuredSubmittedAt) && (
                              <p className="text-[9px] text-emerald-400 mt-0.5">
                                ✓ Uploaded on {new Date(submission.structuredSubmittedAt || submission.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            )}
                          </div>
                        </div>
                        <a
                          href={`${getBaseUrl()}/storage/documents/${submission.answerFile}`}
                          target="_blank"
                          rel="noreferrer"
                          download
                          className="shrink-0 bg-purple-600 hover:bg-purple-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 transition-all"
                        >
                          <Download size={13} /> View
                        </a>
                      </div>
                    )}

                    {submission?.teacherFeedback && (
                      <div className="bg-white/5 border border-white/10 p-3.5 rounded-2xl text-left max-w-md mx-auto">
                        <p className="text-xs uppercase font-bold text-slate-400">Lecturer Feedback:</p>
                        <p className="text-xs sm:text-sm text-slate-200 mt-1 italic">"{submission.teacherFeedback}"</p>
                      </div>
                    )}
                  </div>
                )}

                {/* 🌟 ESSAY QUESTIONS DETAILED MARKS BREAKDOWN COLUMN 🌟 */}
                {Array.isArray(submission?.questionMarks) && submission.questionMarks.length > 0 && (
                  <div className="bg-white/[0.04] border border-white/10 rounded-2xl sm:rounded-3xl p-5 sm:p-7 space-y-4 text-left shadow-2xl">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3 flex-wrap gap-2">
                      <div>
                        <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                          <FileText className="text-purple-400" size={18} />
                          Essay Question Marks Breakdown
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Detailed marks and remarks assigned by the Paper Guider
                        </p>
                      </div>
                      <span className="bg-purple-500/20 text-purple-300 border border-purple-500/40 px-3 py-1 rounded-xl text-xs font-bold">
                        {submission.questionMarks.length} Questions
                      </span>
                    </div>

                    <div className="space-y-3">
                      {submission.questionMarks.map((q, qIdx) => {
                        const awarded = parseFloat(q.marks) || 0;
                        const maxM = parseFloat(q.maxMarks) || 25;
                        const pct = maxM > 0 ? Math.min(100, Math.round((awarded / maxM) * 100)) : 0;

                        return (
                          <div 
                            key={qIdx} 
                            className="bg-black/40 border border-white/10 rounded-2xl p-4 hover:border-purple-500/40 transition-all space-y-2.5"
                          >
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <div className="flex items-center gap-2.5">
                                <span className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-black flex items-center justify-center">
                                  Q{q.questionNo || qIdx + 1}
                                </span>
                                <span className="text-sm font-bold text-white">
                                  {q.title || `Question ${qIdx + 1}`}
                                </span>
                              </div>

                              <div className="flex items-baseline gap-1.5">
                                <span className="text-xl sm:text-2xl font-black text-white">
                                  {awarded}
                                </span>
                                <span className="text-xs font-bold text-slate-400">
                                  / {maxM} pts
                                </span>
                                <span className={`text-xs font-black px-2.5 py-0.5 rounded-lg ml-2 border ${
                                  pct >= 75 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                                  pct >= 50 ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                                  'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                }`}>
                                  {pct}%
                                </span>
                              </div>
                            </div>

                            {/* Question Progress Bar */}
                            <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  pct >= 75 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' :
                                  pct >= 50 ? 'bg-gradient-to-r from-amber-500 to-yellow-400' :
                                  'bg-gradient-to-r from-rose-500 to-orange-400'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>

                            {/* Specific Remark */}
                            {q.remarks && (
                              <div className="bg-white/5 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-slate-300 flex items-center gap-1.5">
                                <span className="text-slate-400 font-bold">Feedback:</span>
                                <span>"{q.remarks}"</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Auto-sum verification row */}
                    <div className="bg-gradient-to-r from-purple-950/40 via-indigo-950/40 to-black/60 border border-purple-500/30 p-4 rounded-2xl flex items-center justify-between">
                      <div>
                        <span className="text-xs font-black uppercase tracking-wider text-purple-300 block">
                          Total Essay Score
                        </span>
                        <span className="text-xs text-slate-400">
                          Sum of marks from all questions above
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-black text-white">
                          {submission.structuredScore ?? submission.score}
                        </span>
                        <span className="text-xs font-bold text-slate-400 ml-1">
                          / {paperData?.paper?.totalStructuredMarks || paperData?.paper?.totalMarks || 100} pts
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. LEADERBOARD & PROGRESS ANALYTICS BUTTONS */}
                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  <button
                    onClick={fetchStudentLeaderboard}
                    disabled={loadingLeaderboard}
                    className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-black font-black px-6 sm:px-8 py-3.5 rounded-2xl text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-xl shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all"
                  >
                    {loadingLeaderboard ? <RefreshCw className="animate-spin" size={18} /> : <Trophy size={18} />}
                    View Test Leaderboard & Rankings
                  </button>

                  <button
                    onClick={fetchStudentProgressModal}
                    className="bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black px-6 sm:px-8 py-3.5 rounded-2xl text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-xl shadow-purple-600/25 hover:scale-105 active:scale-95 transition-all"
                  >
                    <Sparkles size={18} className="text-amber-300" />
                    My Progress & Academic Level
                  </button>
                </div>

                {/* 3. MCQ DETAILED QUESTION REVIEW (For MCQ or BOTH) */}
                {(isMCQ || isBoth) && questions.length > 0 && (
                  <div className="space-y-3 sm:space-y-4 pt-4 border-t border-white/10">
                    <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <HelpCircle className="text-indigo-400" size={16} /> Detailed Question Review
                    </h3>

                    <div className="space-y-2.5 sm:space-y-3">
                      {questions.map((q, idx) => {
                        const studentSelectedOptId = selectedAnswers[q.id];
                        const correctOpt = q.options.find(o => o.isCorrect);
                        const isStudentCorrect = studentSelectedOptId && correctOpt && studentSelectedOptId === correctOpt.id;

                        return (
                          <div 
                            key={q.id || idx} 
                            className={`border rounded-xl sm:rounded-2xl p-3.5 sm:p-4 space-y-2.5 ${
                              isStudentCorrect 
                                ? 'bg-emerald-500/[0.03] border-emerald-500/30' 
                                : 'bg-red-500/[0.03] border-red-500/30'
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                                isStudentCorrect ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
                              }`}>
                                Question #{idx + 1} • {isStudentCorrect ? 'Correct' : 'Incorrect'}
                              </span>
                            </div>

                            <p className="text-xs sm:text-sm font-bold text-white">{q.questionText}</p>

                            {/* Question Figures / Diagrams in Review Mode */}
                            {(() => {
                              const qImages = (Array.isArray(q.images) && q.images.length > 0)
                                ? q.images
                                : (q.image ? [q.image] : []);

                              if (qImages.length === 0) return null;

                              return (
                                <div className="flex flex-wrap gap-2.5 pt-1.5 pb-1">
                                  {qImages.map((img, imgIdx) => (
                                    <div
                                      key={imgIdx}
                                      onClick={() => setLightboxState({ images: qImages, currentIdx: imgIdx })}
                                      className="relative group cursor-pointer rounded-xl overflow-hidden border border-white/10 bg-black/60 p-1.5 hover:border-emerald-500/50 transition-all shadow-sm"
                                    >
                                      <img
                                        src={`${getBaseUrl()}/storage/documents/${img}`}
                                        alt={`Figure ${imgIdx + 1}`}
                                        className="h-28 sm:h-36 object-contain rounded-lg"
                                      />
                                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-[11px] font-bold rounded-lg backdrop-blur-[1px]">
                                        <ZoomIn size={14} className="text-emerald-400" />
                                        <span>Click to view</span>
                                      </div>
                                      <div className="absolute bottom-1 left-1 bg-black/80 px-2 py-0.5 rounded text-[9px] font-bold text-slate-300 border border-white/10">
                                        Figure {imgIdx + 1}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}

                            {/* Options */}
                            <div className="space-y-1.5 pt-1">
                              {q.options.map((opt, optIdx) => {
                                const wasChosen = studentSelectedOptId === opt.id;
                                const isCorrectAns = opt.isCorrect;

                                let optStyle = 'bg-white/[0.02] border-white/5 text-slate-400';
                                if (isCorrectAns) {
                                  optStyle = 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200 font-bold';
                                } else if (wasChosen && !isCorrectAns) {
                                  optStyle = 'bg-red-500/20 border-red-500/60 text-red-200 font-bold';
                                }

                                return (
                                  <div 
                                    key={opt.id || optIdx}
                                    className={`p-2 sm:p-2.5 rounded-lg border text-[11px] sm:text-xs flex items-center justify-between ${optStyle}`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="w-4 h-4 rounded bg-white/10 flex items-center justify-center font-sans font-bold text-[10px] shrink-0">
                                        {optIdx + 1}
                                      </span>
                                      <span>{opt.optionText}</span>
                                    </div>

                                    <div className="flex items-center gap-1 font-bold uppercase text-[8px] sm:text-[9px] shrink-0">
                                      {wasChosen && (
                                        <span className="bg-white/20 px-1.5 py-0.5 rounded">Your Answer</span>
                                      )}
                                      {isCorrectAns && (
                                        <span className="bg-emerald-500 text-black px-1.5 py-0.5 rounded font-bold">Correct Answer</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              </div>
            )}

          </div>
        )}
      </main>

      {/* 📱 MOBILE QUESTION PALETTE DRAWER 📱 */}
      {showMobilePalette && (isMCQ || (isBoth && activeSectionTab === 'mcq')) && (
        <div className="fixed inset-0 z-[10000000] bg-black/80 backdrop-blur-md flex flex-col justify-end lg:hidden animate-in fade-in">
          <div className="bg-[#0b1324] border-t border-white/20 rounded-t-3xl p-5 space-y-4 max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-white/10">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Question Palette ({answeredCount}/{questions.length})
              </h4>
              <button onClick={() => setShowMobilePalette(false)} className="text-slate-400 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-5 gap-2 overflow-y-auto custom-scrollbar p-1">
              {questions.map((q, idx) => {
                const isAnswered = selectedAnswers[q.id] !== undefined && selectedAnswers[q.id] !== null;
                const isCurrent = currentQuestionIdx === idx;
                return (
                  <button
                    key={q.id || idx}
                    onClick={() => {
                      setCurrentQuestionIdx(idx);
                      setShowMobilePalette(false);
                    }}
                    className={`h-10 rounded-xl font-sans font-bold text-xs transition-all flex items-center justify-center border ${
                      isCurrent 
                        ? 'border-emerald-500 ring-2 ring-emerald-500/50 text-white scale-105 bg-emerald-500/20' 
                        : isAnswered 
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                          : 'bg-white/5 text-slate-400 border-white/10'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => {
                setShowMobilePalette(false);
                setShowConfirmSubmit(true);
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider shadow-md"
            >
              Submit Exam
            </button>
          </div>
        </div>
      )}

      {/* 🏆 STUDENT LEADERBOARD & RANKINGS MODAL 🏆 */}
      {showLeaderboardModal && (
        <div className="fixed inset-0 z-[10000002] flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-[#090E17] border border-white/20 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden backdrop-blur-3xl">
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Trophy size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border truncate ${
                      (leaderboardMeta?.paper?.category || paperData?.paper?.category || 'WEEKLY') === 'MONTHLY'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                    }`}>
                      {(leaderboardMeta?.paper?.category || paperData?.paper?.category || 'WEEKLY') === 'MONTHLY' ? '🏆 Monthly Test' : '⚡ Weekly Test'}
                    </span>
                    <span className="text-[10px] font-bold text-slate-300 bg-white/5 border border-white/10 px-2 py-0.5 rounded-md">
                      {leaderboardMeta?.totalParticipants || paperData?.paper?.manualParticipantCount || leaderboardData.length} Candidates
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-white mt-1">Official Test Rankings & Leaderboard</h3>
                  <p className="text-xs text-slate-400 truncate max-w-md">{content?.title}</p>
                </div>
              </div>
              <button
                onClick={() => setShowLeaderboardModal(false)}
                className="text-slate-400 hover:text-white bg-white/5 border border-white/10 p-2 rounded-xl"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
              {leaderboardData.length === 0 ? (
                <div className="text-center py-16">
                  <Trophy size={40} className="text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm font-semibold">No standings available yet.</p>
                </div>
              ) : (
                <>
                  {/* PODIUM CARDS (Top 3) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* #2 Silver */}
                    <div className="order-2 sm:order-1 bg-slate-800/30 border border-slate-600/30 rounded-2xl p-4 text-center">
                      <div className="text-2xl mb-1">🥈</div>
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-300 bg-white/5 px-2 py-0.5 rounded-full">#2 Silver</span>
                      {leaderboardData[1] ? (
                        <div className="mt-2">
                          <div className="w-9 h-9 rounded-full bg-slate-700 border border-slate-500 text-white font-black text-xs flex items-center justify-center mx-auto mb-1.5 shadow">
                            {(leaderboardData[1].student?.firstName?.[0] || leaderboardData[1].student?.name?.[0] || 'S').toUpperCase()}
                          </div>
                          <p className="text-sm font-extrabold text-white truncate">{leaderboardData[1].student?.firstName || leaderboardData[1].student?.name} {leaderboardData[1].student?.lastName || ''}</p>
                          <p className="text-base font-black text-slate-200 mt-1">{leaderboardData[1].score ?? 0} pts</p>
                          <p className="text-[10px] text-slate-400">{leaderboardData[1].durationMinutes ?? Math.round((leaderboardData[1].durationSeconds || 0)/60)} mins</p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 italic mt-3">Spot open</p>
                      )}
                    </div>

                    {/* #1 Gold */}
                    <div className="order-1 sm:order-2 bg-gradient-to-b from-amber-500/20 to-amber-950/40 border-2 border-amber-500/60 rounded-2xl p-5 text-center shadow-lg shadow-amber-500/10 sm:-translate-y-1">
                      <div className="text-3xl mb-1">🥇</div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 bg-amber-500/20 px-2.5 py-0.5 rounded-full">#1 Champion</span>
                      {leaderboardData[0] ? (
                        <div className="mt-2">
                          <div className="w-11 h-11 rounded-full bg-amber-500 border-2 border-white text-black font-black text-sm flex items-center justify-center mx-auto mb-1.5 shadow-md shadow-amber-500/30">
                            {(leaderboardData[0].student?.firstName?.[0] || leaderboardData[0].student?.name?.[0] || 'S').toUpperCase()}
                          </div>
                          <p className="text-base font-black text-white truncate">{leaderboardData[0].student?.firstName || leaderboardData[0].student?.name} {leaderboardData[0].student?.lastName || ''}</p>
                          <p className="text-2xl font-black text-amber-300 mt-1">{leaderboardData[0].score ?? 0} pts</p>
                          <p className="text-xs text-slate-300">{leaderboardData[0].durationMinutes ?? Math.round((leaderboardData[0].durationSeconds || 0)/60)} mins</p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 italic mt-3">Spot open</p>
                      )}
                    </div>

                    {/* #3 Bronze */}
                    <div className="order-3 sm:order-3 bg-amber-950/20 border border-amber-700/30 rounded-2xl p-4 text-center">
                      <div className="text-2xl mb-1">🥉</div>
                      <span className="text-[9px] font-black uppercase tracking-wider text-amber-400 bg-white/5 px-2 py-0.5 rounded-full">#3 Bronze</span>
                      {leaderboardData[2] ? (
                        <div className="mt-2">
                          <div className="w-9 h-9 rounded-full bg-amber-900 border border-amber-600 text-amber-200 font-black text-xs flex items-center justify-center mx-auto mb-1.5 shadow">
                            {(leaderboardData[2].student?.firstName?.[0] || leaderboardData[2].student?.name?.[0] || 'S').toUpperCase()}
                          </div>
                          <p className="text-sm font-extrabold text-white truncate">{leaderboardData[2].student?.firstName || leaderboardData[2].student?.name} {leaderboardData[2].student?.lastName || ''}</p>
                          <p className="text-base font-black text-amber-500 mt-1">{leaderboardData[2].score ?? 0} pts</p>
                          <p className="text-[10px] text-slate-400">{leaderboardData[2].durationMinutes ?? Math.round((leaderboardData[2].durationSeconds || 0)/60)} mins</p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 italic mt-3">Spot open</p>
                      )}
                    </div>
                  </div>

                  {/* 📍 PINNED: YOUR OFFICIAL STANDING CARD 📍 */}
                  {leaderboardMeta?.myStanding && (
                    <div className="bg-gradient-to-r from-amber-500/15 via-slate-900 to-indigo-950/40 border border-amber-500/40 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg shadow-amber-500/5">
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500 text-black flex items-center justify-center font-black text-xl shrink-0 shadow-md shadow-amber-500/20">
                          #{leaderboardMeta.myStanding.rank}
                        </div>
                        <div>
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                            Your Official Standing
                          </span>
                          <h4 className="text-base font-black text-white mt-0.5">
                            Rank #{leaderboardMeta.myStanding.rank} of {leaderboardMeta.totalParticipants || leaderboardData.length} Candidates
                          </h4>
                          <p className="text-xs text-slate-400">
                            {leaderboardMeta.myStanding.gapToFirst > 0 ? `${leaderboardMeta.myStanding.gapToFirst} pts behind #1 Champion` : '🏆 Currently leading this examination!'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-white/10 pt-3 sm:pt-0">
                        <div className="text-right">
                          <p className="text-[10px] uppercase font-bold text-slate-400">Your Score</p>
                          <p className="text-xl font-black text-emerald-400">{leaderboardMeta.myStanding.score ?? 0} pts</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] uppercase font-bold text-slate-400">Percentile</p>
                          <p className="text-sm font-black text-indigo-300">Top {Math.max(1, 100 - (leaderboardMeta.myStanding.percentile || 0))}%</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STANDINGS TABLE */}
                  <div className="border border-white/10 rounded-2xl overflow-hidden bg-white/[0.01]">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-white/10 text-slate-400 uppercase tracking-wider text-[10px] bg-white/[0.02]">
                            <th className="p-3 text-center w-14">Rank</th>
                            <th className="p-3">Student</th>
                            {isBoth && <th className="p-3 text-center">Part 1 (MCQ)</th>}
                            {isBoth && <th className="p-3 text-center">Part 2 (Essay)</th>}
                            <th className="p-3 text-right">Total Score</th>
                            <th className="p-3 text-right">Time Taken</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-slate-200">
                          {leaderboardData.map((item, idx) => {
                            const isMe = currentUserId && (String(item.student?.id) === String(currentUserId));
                            return (
                              <tr 
                                key={item.submissionId || item.id || idx} 
                                className={`transition-colors ${
                                  isMe ? 'bg-amber-500/20 border-l-4 border-amber-500 font-bold' : 'hover:bg-white/[0.02]'
                                }`}
                              >
                                <td className="p-3 text-center font-black">
                                  {item.rank === 1 ? '🥇 #1' : item.rank === 2 ? '🥈 #2' : item.rank === 3 ? '🥉 #3' : `#${item.rank}`}
                                </td>
                                <td className="p-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-slate-700 text-[10px] font-bold text-white flex items-center justify-center shrink-0">
                                      {(item.student?.firstName?.[0] || item.student?.name?.[0] || 'S').toUpperCase()}
                                    </div>
                                    <span className="font-extrabold text-white">
                                      {item.student?.firstName || item.student?.name} {item.student?.lastName || ''}
                                    </span>
                                    {isMe && (
                                      <span className="text-[9px] font-black uppercase bg-amber-500 text-black px-1.5 py-0.5 rounded">
                                        You
                                      </span>
                                    )}
                                  </div>
                                </td>
                                {isBoth && (
                                  <td className="p-3 text-center font-bold text-emerald-400">
                                    {item.mcqScore !== null && item.mcqScore !== undefined ? `${item.mcqScore} pts` : '-'}
                                  </td>
                                )}
                                {isBoth && (
                                  <td className="p-3 text-center font-bold text-purple-400">
                                    {item.structuredScore !== null && item.structuredScore !== undefined ? `${item.structuredScore} pts` : 'Pending'}
                                  </td>
                                )}
                                <td className="p-3 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <span className="font-black text-sm text-emerald-300">
                                      {item.score ?? 0} pts
                                    </span>
                                    {item.grade && (
                                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase ${getGradeStyle(item.grade)}`}>
                                        {item.grade}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3 text-right text-slate-400">
                                  {item.durationMinutes !== undefined && item.durationMinutes !== null ? `${item.durationMinutes} mins` : `${Math.round((item.durationSeconds || 0)/60)} mins`}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 📘 INSTRUCTIONS & RULES MODAL 📘 */}
      {showInstructionsModal && (
        <div className="fixed inset-0 z-[10000003] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-[#090E17] border border-white/20 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden backdrop-blur-3xl">
            <div className="p-4 sm:p-5 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <HelpCircle size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Exam Instructions & Rules</h3>
                  <p className="text-xs text-slate-400 truncate">{content?.title}</p>
                </div>
              </div>
              <button
                onClick={() => setShowInstructionsModal(false)}
                className="text-slate-400 hover:text-white bg-white/5 border border-white/10 p-2 rounded-xl"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4 text-sm text-slate-300 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                {paperData?.paper?.instructions || "Read all questions carefully before selecting your answers. Do not close or refresh the window while your test is in progress. Your timer runs continuously until final submission."}
              </div>
              <ul className="space-y-2 text-xs text-slate-400">
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                  <span>Rankings and leaderboards are updated in real-time as students submit.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                  <span>Unanswered questions will receive 0 marks automatically upon timer expiration.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                  <span>Ensure your internet connection remains stable throughout the test session.</span>
                </li>
              </ul>
              <button
                onClick={() => setShowInstructionsModal(false)}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all mt-2"
              >
                Got It, Continue Exam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 z-[10000001] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-[#0b1324] border border-white/20 rounded-3xl p-6 sm:p-8 max-w-md w-full text-center space-y-5 shadow-2xl backdrop-blur-2xl">
            
            <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
              <AlertCircle size={32} />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg sm:text-xl font-black text-white">
                {isBoth && examStatus === 'IN_PROGRESS' 
                  ? 'Submit Part 1 (MCQ) & Start Intermission?' 
                  : 'Are you ready to submit your test?'}
              </h3>
              <p className="text-amber-400 text-xs font-bold uppercase tracking-wider bg-amber-500/10 border border-amber-500/20 py-1.5 px-3 rounded-xl inline-block">
                No changes can be made after submission
              </p>
              <p className="text-slate-300 text-xs leading-relaxed pt-1">
                {examStatus === 'IN_PROGRESS' && (
                  <span>You answered <span className="text-emerald-400 font-black">{answeredCount}</span> of <span className="text-white font-black">{questions.length}</span> MCQ questions.<br /></span>
                )}
                {(examStatus === 'STRUCTURED_WRITING' || examStatus === 'STRUCTURED_UPLOADING' || isStructured) && (
                  <span>Answer Sheet Attachment: <span className="font-bold text-purple-400">{answerFile ? answerFile.name : 'None attached'}</span><br /></span>
                )}
                {unansweredCount > 0 && examStatus === 'IN_PROGRESS' && (
                  <span className="block text-rose-400 font-bold mt-1.5">
                    You still have {unansweredCount} unanswered MCQ question{unansweredCount > 1 ? 's' : ''}!
                  </span>
                )}
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowConfirmSubmit(false)}
                className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl text-xs sm:text-sm transition-all active:scale-95 border border-white/10"
              >
                Cancel & Review
              </button>
              <button
                onClick={handleSubmitExam}
                disabled={submitting}
                className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-3 rounded-xl text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-emerald-600/30 transition-all active:scale-95 border border-emerald-400/30 flex items-center justify-center gap-2"
              >
                {submitting ? <RefreshCw className="animate-spin" size={16} /> : <><Send size={15} /> {isBoth && examStatus === 'IN_PROGRESS' ? 'Submit & Proceed' : 'Yes, Submit Now'}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Zoom Modal */}
      {lightboxState && (
        <div 
          className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200 select-none"
          onClick={() => setLightboxState(null)}
        >
          {/* Lightbox Header */}
          <div 
            className="w-full max-w-5xl flex items-center justify-between py-2.5 px-4 bg-white/5 rounded-2xl border border-white/10 mb-3 backdrop-blur-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <span className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                <ImageIcon size={16} className="text-emerald-400" />
                Figure {lightboxState.currentIdx + 1} of {lightboxState.images.length}
              </span>
              {lightboxState.images.length > 1 && (
                <div className="hidden sm:flex items-center gap-1.5">
                  {lightboxState.images.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setLightboxState(prev => ({ ...prev, currentIdx: idx }))}
                      className={`h-2 rounded-full transition-all ${
                        idx === lightboxState.currentIdx ? 'bg-emerald-400 w-6' : 'bg-white/30 hover:bg-white/60 w-2'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLightboxState(null)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all flex items-center gap-1.5 text-xs font-bold"
              >
                <X size={16} /> Close
              </button>
            </div>
          </div>

          {/* Lightbox Main Image & Arrows */}
          <div 
            className="relative w-full max-w-5xl flex-1 flex items-center justify-center overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {lightboxState.images.length > 1 && (
              <button
                type="button"
                onClick={() => setLightboxState(prev => ({
                  ...prev,
                  currentIdx: (prev.currentIdx - 1 + prev.images.length) % prev.images.length
                }))}
                className="absolute left-2 sm:left-4 z-10 p-3 rounded-2xl bg-black/70 hover:bg-black/90 text-white border border-white/15 backdrop-blur-sm transition-all shadow-2xl"
              >
                <ChevronLeft size={24} />
              </button>
            )}

            <img
              src={`${getBaseUrl()}/storage/documents/${lightboxState.images[lightboxState.currentIdx]}`}
              alt={`Figure ${lightboxState.currentIdx + 1}`}
              className="max-h-[76vh] max-w-full object-contain rounded-2xl shadow-2xl transition-all"
            />

            {lightboxState.images.length > 1 && (
              <button
                type="button"
                onClick={() => setLightboxState(prev => ({
                  ...prev,
                  currentIdx: (prev.currentIdx + 1) % prev.images.length
                }))}
                className="absolute right-2 sm:right-4 z-10 p-3 rounded-2xl bg-black/70 hover:bg-black/90 text-white border border-white/15 backdrop-blur-sm transition-all shadow-2xl"
              >
                <ChevronRight size={24} />
              </button>
            )}
          </div>

          {/* Bottom Thumbnail Strip for multiple images */}
          {lightboxState.images.length > 1 && (
            <div 
              className="mt-3 flex items-center gap-2 overflow-x-auto py-1 px-2.5 bg-black/60 border border-white/10 rounded-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {lightboxState.images.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setLightboxState(prev => ({ ...prev, currentIdx: idx }))}
                  className={`relative rounded-lg overflow-hidden border-2 transition-all shrink-0 ${
                    idx === lightboxState.currentIdx ? 'border-emerald-400 scale-105 shadow-md shadow-emerald-500/40' : 'border-transparent opacity-50 hover:opacity-100'
                  }`}
                >
                  <img
                    src={`${getBaseUrl()}/storage/documents/${img}`}
                    alt={`Thumb ${idx + 1}`}
                    className="w-14 h-14 object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 🌟 STUDENT ACADEMIC LEVEL & PROGRESS ANALYTICS MODAL 🌟 */}
      {showProgressModal && (
        <div className="fixed inset-0 z-[10000003] flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-[#090E17] border border-white/20 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden backdrop-blur-3xl text-slate-100">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  <Sparkles size={22} className="text-amber-300" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white">
                    My Paper Progress & Academic Level
                  </h3>
                  <p className="text-xs text-slate-400">
                    Your cumulative test performance, rank level, and marks trajectory
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowProgressModal(false)}
                className="text-slate-400 hover:text-white bg-white/5 border border-white/10 p-2 rounded-xl"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
              {loadingProgress ? (
                <div className="text-center py-20 space-y-3">
                  <RefreshCw className="animate-spin text-purple-400 mx-auto" size={32} />
                  <p className="text-sm font-bold text-slate-300">Calculating your performance metrics...</p>
                </div>
              ) : progressData ? (() => {
                const overall = progressData.overall || {};
                const levelInfo = getStudentLevel(overall);
                const avgPct = overall.averagePercentage || 0;

                return (
                  <div className="space-y-6">
                    {/* Level Hero Card */}
                    <div className={`p-5 sm:p-6 rounded-3xl bg-gradient-to-r ${levelInfo.color} border text-white shadow-2xl relative overflow-hidden`}>
                      <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                          <span className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/20 inline-block mb-2">
                            {levelInfo.badge}
                          </span>
                          <h2 className="text-2xl sm:text-3xl font-black text-white">
                            {levelInfo.title}
                          </h2>
                          <p className="text-xs sm:text-sm text-white/90 mt-1 max-w-lg">
                            {levelInfo.description}
                          </p>
                        </div>

                        <div className="text-left sm:text-right bg-black/30 backdrop-blur-md p-4 rounded-2xl border border-white/20 shrink-0">
                          <span className="text-xs font-bold text-white/80 block uppercase">Overall Average</span>
                          <span className="text-3xl font-black text-white">{avgPct}%</span>
                          <span className="text-xs text-emerald-300 block mt-0.5">
                            Pass Rate: {overall.passRate || 0}%
                          </span>
                        </div>
                      </div>

                      {/* Cumulative Progress Bar */}
                      <div className="mt-5 relative z-10">
                        <div className="flex justify-between text-xs font-bold text-white/90 mb-1.5">
                          <span>Academic Level Progress</span>
                          <span>{avgPct}% / 100% Target</span>
                        </div>
                        <div className="w-full bg-black/40 rounded-full h-3 overflow-hidden p-0.5 border border-white/20">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-white transition-all duration-700 shadow-lg"
                            style={{ width: `${Math.min(100, Math.max(5, avgPct))}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Stats Metrics 4-Column Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-white/[0.03] border border-white/10 p-4 rounded-2xl">
                        <span className="text-xs font-bold text-slate-400 uppercase block">Tests Completed</span>
                        <span className="text-2xl font-black text-white mt-1 block">{overall.totalTaken || 0}</span>
                        <span className="text-xs text-purple-300">Papers submitted</span>
                      </div>
                      <div className="bg-white/[0.03] border border-white/10 p-4 rounded-2xl">
                        <span className="text-xs font-bold text-slate-400 uppercase block">Average Score</span>
                        <span className="text-2xl font-black text-white mt-1 block">{overall.averageScore || 0} pts</span>
                        <span className="text-xs text-slate-400">{avgPct}% overall avg</span>
                      </div>
                      <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-2xl">
                        <span className="text-xs font-bold text-emerald-400 uppercase block">Pass Count</span>
                        <span className="text-2xl font-black text-emerald-300 mt-1 block">{overall.passCount || 0}</span>
                        <span className="text-xs text-emerald-400">{overall.passRate || 0}% pass rate</span>
                      </div>
                      <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl">
                        <span className="text-xs font-bold text-amber-400 uppercase block">Highest Score</span>
                        <span className="text-2xl font-black text-amber-300 mt-1 block">{overall.highestScore || 0} pts</span>
                        <span className="text-xs text-amber-400">Personal Best</span>
                      </div>
                    </div>

                    {/* Weekly vs Monthly Breakdown */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Weekly */}
                      <div className="bg-indigo-950/20 border border-indigo-500/30 p-4 sm:p-5 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                            ⚡ Weekly Paper Series
                          </span>
                          <span className="text-xs font-bold bg-indigo-500/20 text-indigo-300 px-2.5 py-0.5 rounded-lg border border-indigo-500/30">
                            {progressData.weekly?.totalTaken || 0} Taken
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between pt-1">
                          <span className="text-sm text-slate-300">Average Percentage:</span>
                          <span className="text-xl font-black text-white">{progressData.weekly?.averagePercentage || 0}%</span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-sm text-slate-300">Pass Rate:</span>
                          <span className="text-sm font-bold text-emerald-400">{progressData.weekly?.passRate || 0}%</span>
                        </div>
                      </div>

                      {/* Monthly */}
                      <div className="bg-amber-950/20 border border-amber-500/30 p-4 sm:p-5 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                            🏆 Monthly Grand Tests
                          </span>
                          <span className="text-xs font-bold bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-lg border border-amber-500/30">
                            {progressData.monthly?.totalTaken || 0} Taken
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between pt-1">
                          <span className="text-sm text-slate-300">Average Percentage:</span>
                          <span className="text-xl font-black text-white">{progressData.monthly?.averagePercentage || 0}%</span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-sm text-slate-300">Pass Rate:</span>
                          <span className="text-sm font-bold text-emerald-400">{progressData.monthly?.passRate || 0}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Recent Papers History Table */}
                    {Array.isArray(progressData.recentTests) && progressData.recentTests.length > 0 && (
                      <div className="space-y-3 pt-2">
                        <h4 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                          <Clock size={16} className="text-purple-400" /> Recent Papers History
                        </h4>

                        <div className="space-y-2">
                          {progressData.recentTests.map((t, idx) => (
                            <div key={idx} className="bg-white/[0.02] border border-white/10 rounded-2xl p-3.5 flex items-center justify-between gap-3 hover:border-white/20 transition-all flex-wrap sm:flex-nowrap">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className={`text-[11px] font-black uppercase px-2 py-0.5 rounded border ${
                                    t.category === 'MONTHLY' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                                  }`}>
                                    {t.category || 'WEEKLY'}
                                  </span>
                                  <span className="text-xs text-slate-400">
                                    {t.paperType}
                                  </span>
                                </div>
                                <p className="text-sm font-bold text-white mt-1 truncate">{t.testTitle}</p>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                <div className="text-right">
                                  <span className="text-base font-black text-white block">{t.score} pts</span>
                                  <span className="text-xs text-slate-400">{t.percentage}%</span>
                                </div>
                                {t.grade && (
                                  <span className={`text-xs font-black uppercase px-2.5 py-1 rounded-xl border ${getGradeStyle(t.grade)}`}>
                                    {t.grade}
                                  </span>
                                )}
                                <span className="bg-white/5 border border-white/10 px-2.5 py-1 rounded-xl text-xs font-bold text-slate-300">
                                  Rank #{t.rank}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })() : (
                <div className="text-center py-16">
                  <p className="text-sm text-slate-400">No test history available.</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-white/10 flex justify-end bg-white/[0.02]">
              <button
                onClick={() => setShowProgressModal(false)}
                className="bg-white/10 hover:bg-white/20 text-white font-bold px-6 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all"
              >
                Close Progress
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );

  return createPortal(portalContent, document.body);
}
