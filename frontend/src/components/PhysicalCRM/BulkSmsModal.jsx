import React, { useState } from 'react';
import { physicalCrmService } from '../../api/physicalCrm';
import { X, Send, Users, Sparkles, AlertCircle, CheckCircle2, Loader2, MessageSquare, Layers } from 'lucide-react';
import toast from 'react-hot-toast';

export default function BulkSmsModal({ isOpen, onClose, classes = [], selectedStudents = [], onSentSuccess }) {
  const [targetScope, setTargetScope] = useState(selectedStudents.length > 0 ? 'selected' : 'class');
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || '');
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);

  if (!isOpen) return null;

  const charCount = messageText.length;
  const smsSegments = Math.ceil(charCount / 160) || 1;

  const insertVariable = (varName) => {
    setMessageText(prev => prev + ` ${varName} `);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!messageText.trim()) {
      return toast.error('Please enter a message to send.');
    }

    setSending(true);
    setSendResult(null);

    try {
      let studentIds = [];
      let classId = null;

      if (targetScope === 'selected') {
        if (selectedStudents.length === 0) {
          return toast.error('No students selected.');
        }
        studentIds = selectedStudents.map(s => s.id);
      } else if (targetScope === 'class') {
        if (!selectedClassId) {
          return toast.error('Please select a target class.');
        }
        classId = selectedClassId;
      } else if (targetScope === 'all') {
        classId = 'ALL';
      }

      const res = await physicalCrmService.sendBulkSms({
        studentIds,
        classId,
        message: messageText.trim(),
        type: 'BULK'
      });

      if (res && res.success) {
        setSendResult(res);
        toast.success(`Broadcast sent! (${res.sentCount} sent, ${res.failedCount} failed)`);
        if (onSentSuccess) onSentSuccess();
      } else {
        toast.error(res.error || 'Failed to send bulk SMS');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Bulk SMS dispatch failed.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl bg-gradient-to-b from-slate-900 via-slate-900 to-[#0b1120] border border-white/15 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="flex items-center gap-3 relative z-10">
            <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-2xl border border-indigo-500/30 shadow-inner">
              <Send size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-wide flex items-center gap-2">
                Send Bulk SMS Broadcast
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Send custom announcements & reminders directly to student/guardian phones</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSend} className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
          
          {/* Target Audience Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300">Select Target Audience</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTargetScope('class')}
                className={`p-3 rounded-2xl border text-xs font-bold transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                  targetScope === 'class'
                    ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-lg'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <Layers size={16} />
                <span>By Class</span>
              </button>

              <button
                type="button"
                onClick={() => setTargetScope('selected')}
                className={`p-3 rounded-2xl border text-xs font-bold transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                  targetScope === 'selected'
                    ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-lg'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <Users size={16} />
                <span>Selected ({selectedStudents.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setTargetScope('all')}
                className={`p-3 rounded-2xl border text-xs font-bold transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                  targetScope === 'all'
                    ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-lg'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <MessageSquare size={16} />
                <span>All Physical</span>
              </button>
            </div>
          </div>

          {/* Class Picker (if by class) */}
          {targetScope === 'class' && (
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Target Physical Class</label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-800 border border-white/10 rounded-xl text-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all cursor-pointer shadow-inner"
              >
                {classes.map(c => {
                  const teacherNames = c.teachers && c.teachers.length > 0
                    ? ` • ${c.teachers.map(t => t.name).join(', ')}`
                    : '';
                  return (
                    <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                      {c.name} ({c.grade}{teacherNames ? teacherNames : (c.subject ? ` • ${c.subject}` : '')})
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Message Textarea */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-300">Message Content</label>
              <span className="text-[10px] text-slate-400 font-semibold">
                {charCount} chars • <span className="text-amber-400 font-bold">{smsSegments} SMS</span>
              </span>
            </div>

            <textarea
              rows={4}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Dear Parent, special notice regarding {class_name} class on {date}... - IMA Campus"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-xs font-medium focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all shadow-inner placeholder:text-white/20 resize-none"
            />

            {/* Variable Tags */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[10px] text-slate-400 font-bold">Tags:</span>
              {[
                { label: '{student_name}' },
                { label: '{student_id}' },
                { label: '{class_name}' },
                { label: '{date}' },
                { label: '{time}' },
                { label: '{school}' }
              ].map(v => (
                <button
                  key={v.label}
                  type="button"
                  onClick={() => insertVariable(v.label)}
                  className="px-2 py-0.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-[10px] font-bold rounded-lg border border-indigo-500/20 transition-all cursor-pointer"
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Result Alert if sent */}
          {sendResult && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5 text-emerald-400 font-bold">
                <CheckCircle2 size={16} />
                <span>Broadcast Completed!</span>
              </div>
              <div className="flex items-center gap-3 text-slate-300 text-xs">
                <span>Sent: <strong className="text-emerald-400">{sendResult.sentCount}</strong></span>
                <span>Failed: <strong className="text-rose-400">{sendResult.failedCount}</strong></span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-bold transition-all"
            >
              Close
            </button>

            <button
              type="submit"
              disabled={sending}
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer"
            >
              {sending ? <Loader2 className="animate-spin" size={15} /> : <Send size={15} />}
              <span>{sending ? 'Dispatching SMS...' : 'Send Broadcast'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
