import React, { useState, useEffect } from 'react';
import { physicalCrmService } from '../../api/physicalCrm';
import { 
  X, MessageSquare, Save, ToggleLeft, ToggleRight, Send, 
  CheckCircle2, AlertCircle, Loader2, Sparkles, Key, Globe, 
  User, ShieldCheck, HelpCircle, Smartphone, Check, Receipt
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function SmsSettingsModal({ isOpen, onClose, onSettingsUpdated }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testPhone, setTestPhone] = useState('');

  const [formData, setFormData] = useState({
    esmsApiUrl: 'https://e-sms.dialog.lk/api/v1/message-via-url/create/url-campaign',
    esmsUsername: 'imaarts',
    esmsPassword: '',
    esmsSenderId: 'IMA',
    isAttendanceSmsEnabled: false,
    attendanceSmsTemplate: 'Dear Parent, {student_name} ({student_id}) has attended {class_name} class on {date} at {time}. - IMA Campus',
    isFeePaymentSmsEnabled: true,
    feePaymentSmsTemplate: 'Dear Parent, Payment of Rs. {amount} for {student_name} ({student_id}) has been received for {class_details} ({month}) on {date} at {time}. {receipt_ref} - IMA Campus'
  });

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
    }
  }, [isOpen]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await physicalCrmService.getSmsSettings();
      if (res && res.settings) {
        setFormData({
          esmsApiUrl: res.settings.esmsApiUrl || 'https://e-sms.dialog.lk/api/v1/message-via-url/create/url-campaign',
          esmsUsername: res.settings.esmsUsername || 'imaarts',
          esmsPassword: res.settings.esmsPassword || '',
          esmsSenderId: res.settings.esmsSenderId || 'IMA',
          isAttendanceSmsEnabled: Boolean(res.settings.isAttendanceSmsEnabled),
          attendanceSmsTemplate: res.settings.attendanceSmsTemplate || 'Dear Parent, {student_name} ({student_id}) has attended {class_name} class on {date} at {time}. - IMA Campus',
          isFeePaymentSmsEnabled: res.settings.isFeePaymentSmsEnabled !== undefined ? Boolean(res.settings.isFeePaymentSmsEnabled) : true,
          feePaymentSmsTemplate: res.settings.feePaymentSmsTemplate || 'Dear Parent, Payment of Rs. {amount} for {student_name} ({student_id}) has been received for {class_details} ({month}) on {date} at {time}. {receipt_ref} - IMA Campus'
        });
      }
    } catch (err) {
      toast.error('Failed to load SMS settings');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const insertVariable = (field, varName) => {
    setFormData(prev => ({
      ...prev,
      [field]: (prev[field] || '') + ` ${varName} `
    }));
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const res = await physicalCrmService.saveSmsSettings(formData);
      if (res && res.success) {
        toast.success('Dialog eSMS settings saved successfully!');
        if (onSettingsUpdated) onSettingsUpdated(res.settings);
        return true;
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save SMS settings');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestSms = async () => {
    if (!testPhone || testPhone.trim().length < 9) {
      return toast.error('Please enter a valid phone number to test (e.g. 0771234567)');
    }

    if (!formData.esmsPassword || !formData.esmsPassword.trim()) {
      return toast.error('Please paste your Dialog eSMS URL Message Key first!');
    }

    setTesting(true);
    try {
      // First save current inputs so the gateway uses the latest credentials
      await physicalCrmService.saveSmsSettings(formData);

      const res = await physicalCrmService.sendTestSms({
        phone: testPhone.trim(),
        message: `[TEST SMS] Dialog eSMS Gateway connected successfully to IMA Campus Physical CRM! Sent at ${new Date().toLocaleTimeString()}.`
      });

      if (res && res.success) {
        toast.success(`🎉 Test SMS sent successfully to ${testPhone}! Check your phone.`);
      } else {
        toast.error('Gateway Error: ' + (res.error || 'Failed to send SMS'));
      }
    } catch (err) {
      toast.error('Test SMS Failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setTesting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-gradient-to-b from-slate-900 via-slate-900 to-[#0b1120] border border-white/15 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5 relative overflow-hidden">
          <div className="flex items-center gap-3 relative z-10">
            <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30 shadow-inner">
              <MessageSquare size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
                Dialog eSMS Gateway Settings
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-400/30">Official eSMS Gateway</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Configure Dialog URL Message Key & automated attendance alerts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        {loading ? (
          <div className="flex items-center justify-center p-16 text-slate-400 gap-3">
            <Loader2 className="animate-spin text-amber-400" size={24} />
            <span className="text-sm font-semibold">Loading SMS Configuration...</span>
          </div>
        ) : (
          <form onSubmit={async (e) => { e.preventDefault(); const ok = await handleSave(); if (ok) onClose(); }} className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
            
            {/* Info Notice Box */}
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-start gap-3">
              <HelpCircle className="text-blue-400 shrink-0 mt-0.5" size={18} />
              <div className="text-xs text-blue-200 leading-relaxed space-y-1">
                <strong className="text-white block font-bold">Dialog eSMS Connection Guide:</strong>
                <div>1. Log into your <a href="https://esms.dialog.lk" target="_blank" rel="noreferrer" className="text-blue-300 underline font-bold">esms.dialog.lk</a> dashboard.</div>
                <div>2. In the <strong>Account info</strong> tab at the bottom right, copy your <strong>URL Message Key</strong>.</div>
                <div>3. Paste that key in the <strong>"Dialog URL Message Key"</strong> field below.</div>
              </div>
            </div>

            {/* Gateway Credentials Box */}
            <div className="bg-black/30 border border-white/10 rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-bold text-amber-400 uppercase tracking-widest flex items-center gap-2">
                <Key size={14} /> Dialog eSMS Gateway Configuration
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Dialog URL Message Key (API Key) <span className="text-amber-400">*</span>
                  </label>
                  <div className="relative">
                    <Key size={15} className="absolute left-3.5 top-3 text-slate-500" />
                    <input
                      type="text"
                      name="esmsPassword"
                      value={formData.esmsPassword}
                      onChange={handleInputChange}
                      placeholder="Paste your URL Message Key from esms.dialog.lk (starts with eyJhbG...)"
                      className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-xs font-semibold focus:ring-2 focus:ring-amber-500/50 outline-none transition-all shadow-inner placeholder:text-slate-500 font-mono"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Copy and paste the entire key from the "URL Message Key" card on your Dialog account page.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Sender ID / Masking</label>
                    <div className="relative">
                      <ShieldCheck size={15} className="absolute left-3.5 top-3 text-slate-500" />
                      <input
                        type="text"
                        name="esmsSenderId"
                        value={formData.esmsSenderId}
                        onChange={handleInputChange}
                        placeholder="IMA ARTS"
                        className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-xs font-semibold focus:ring-2 focus:ring-amber-500/50 outline-none transition-all shadow-inner"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Account Username</label>
                    <div className="relative">
                      <User size={15} className="absolute left-3.5 top-3 text-slate-500" />
                      <input
                        type="text"
                        name="esmsUsername"
                        value={formData.esmsUsername}
                        onChange={handleInputChange}
                        placeholder="imaarts"
                        className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-xs font-semibold focus:ring-2 focus:ring-amber-500/50 outline-none transition-all shadow-inner"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* LIVE TEST SMS BOX */}
            <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2">
                  <Smartphone size={15} /> Test Gateway Connection (Live Test SMS)
                </h3>
                <span className="text-[11px] text-amber-200/70">Check if SMS arrives on phone</span>
              </div>
              <p className="text-xs text-slate-300">
                Enter your mobile number below to send a live test message using the URL Message Key above:
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="Enter phone number (e.g. 0771234567)"
                  className="flex-1 px-4 py-2.5 bg-slate-950 border border-white/15 rounded-xl text-white text-xs font-semibold focus:ring-2 focus:ring-amber-500/50 outline-none transition-all placeholder:text-slate-600"
                />
                <button
                  type="button"
                  onClick={handleSendTestSms}
                  disabled={testing}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
                >
                  {testing ? <Loader2 className="animate-spin" size={15} /> : <Send size={15} />}
                  <span>{testing ? 'Sending...' : '🚀 Send Test SMS'}</span>
                </button>
              </div>
            </div>

            {/* Automated Attendance SMS Alert Box */}
            <div className="bg-black/30 border border-white/10 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                    <Sparkles size={14} /> Automated Attendance SMS Alert
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Send instant SMS to guardian when student is marked present in class</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, isAttendanceSmsEnabled: !prev.isAttendanceSmsEnabled }))}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    formData.isAttendanceSmsEnabled
                      ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  {formData.isAttendanceSmsEnabled ? <ToggleRight size={18} className="text-emerald-400" /> : <ToggleLeft size={18} />}
                  <span>{formData.isAttendanceSmsEnabled ? 'Enabled' : 'Disabled'}</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Attendance Message Template</label>
                <textarea
                  rows={3}
                  name="attendanceSmsTemplate"
                  value={formData.attendanceSmsTemplate}
                  onChange={handleInputChange}
                  placeholder="Dear Parent, {student_name} ({student_id}) has attended {class_name} class on {date} at {time}. - IMA Campus"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-xs font-medium focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all shadow-inner placeholder:text-white/20 resize-none"
                />

                {/* Available Variables Chips */}
                <div className="flex items-center gap-2 flex-wrap mt-2">
                  <span className="text-xs text-slate-400 font-semibold">Insert Tags:</span>
                  {[
                    { label: '{student_name}', desc: 'Student Name' },
                    { label: '{student_id}', desc: 'Student ID' },
                    { label: '{class_name}', desc: 'Class Name' },
                    { label: '{date}', desc: 'Today Date' },
                    { label: '{time}', desc: 'Scan Time' },
                    { label: '{school}', desc: 'School Name' }
                  ].map(v => (
                    <button
                      key={v.label}
                      type="button"
                      onClick={() => insertVariable('attendanceSmsTemplate', v.label)}
                      className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-semibold rounded-lg border border-emerald-500/20 transition-all cursor-pointer"
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Automated Fee Payment SMS Alert Box */}
            <div className="bg-black/30 border border-white/10 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                    <Receipt size={14} /> Automated Class Fee Payment SMS Alert
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Send instant SMS receipt to guardian when fees are paid (Single or Bulk Multi-Class)</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, isFeePaymentSmsEnabled: !prev.isFeePaymentSmsEnabled }))}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    formData.isFeePaymentSmsEnabled
                      ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  {formData.isFeePaymentSmsEnabled ? <ToggleRight size={18} className="text-cyan-400" /> : <ToggleLeft size={18} />}
                  <span>{formData.isFeePaymentSmsEnabled ? 'Enabled' : 'Disabled'}</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Fee Payment Message Template</label>
                <textarea
                  rows={3}
                  name="feePaymentSmsTemplate"
                  value={formData.feePaymentSmsTemplate}
                  onChange={handleInputChange}
                  placeholder="Dear Parent, Payment of Rs. {amount} for {student_name} ({student_id}) has been received for {class_details} ({month}) on {date} at {time}. {receipt_ref} - IMA Campus"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-xs font-medium focus:ring-2 focus:ring-cyan-500/50 outline-none transition-all shadow-inner placeholder:text-white/20 resize-none"
                />

                {/* Available Variables Chips */}
                <div className="flex items-center gap-2 flex-wrap mt-2">
                  <span className="text-xs text-slate-400 font-semibold">Insert Tags:</span>
                  {[
                    { label: '{amount}', desc: 'Amount Paid (e.g. 1,500.00)' },
                    { label: '{student_name}', desc: 'Student Name' },
                    { label: '{student_id}', desc: 'Student ID' },
                    { label: '{class_details}', desc: 'Class Name(s)' },
                    { label: '{month}', desc: 'Fee Month' },
                    { label: '{date}', desc: 'Payment Date' },
                    { label: '{time}', desc: 'Payment Time' },
                    { label: '{receipt_ref}', desc: 'Receipt Reference' }
                  ].map(v => (
                    <button
                      key={v.label}
                      type="button"
                      onClick={() => insertVariable('feePaymentSmsTemplate', v.label)}
                      className="px-2.5 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-semibold rounded-lg border border-cyan-500/20 transition-all cursor-pointer"
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer"
              >
                {saving ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />}
                <span>{saving ? 'Saving...' : 'Save Settings'}</span>
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
}
