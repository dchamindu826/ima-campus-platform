import React, { useState } from 'react';
import axios from 'axios';
import { X } from 'lucide-react';

export default function StudentModal({ isOpen, onClose, onSuccess, token }) {
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    batch: '',
    phone: '',
    feeAmount: ''
  });
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post('/api/students', formData, {
        headers: { 'x-api-password': token }
      });
      onSuccess();
      onClose();
      setFormData({ name: '', subject: '', batch: '', phone: '', feeAmount: '' });
    } catch (err) {
      alert('Error creating student');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-cyan-500/30 p-8 rounded-2xl w-full max-w-md shadow-[0_0_40px_-10px_rgba(6,182,212,0.3)] relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 mb-6">
          Create Mock Student
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div>
            <label className="block text-cyan-400/80 mb-1">Full Name</label>
            <input type="text" required
              value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full bg-slate-950 border border-slate-700 text-white rounded p-2 focus:border-cyan-500 focus:outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-cyan-400/80 mb-1">Subject</label>
              <input type="text" required
                value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded p-2 focus:border-cyan-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-cyan-400/80 mb-1">Batch</label>
              <input type="text" required
                value={formData.batch} onChange={e => setFormData({...formData, batch: e.target.value})}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded p-2 focus:border-cyan-500 focus:outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-cyan-400/80 mb-1">Phone Number</label>
              <input type="text" required
                value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded p-2 focus:border-cyan-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-cyan-400/80 mb-1">Fee Amount (Rs)</label>
              <input type="number" required
                value={formData.feeAmount} onChange={e => setFormData({...formData, feeAmount: e.target.value})}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded p-2 focus:border-cyan-500 focus:outline-none" />
            </div>
          </div>
          <button type="submit" disabled={loading}
            className="w-full mt-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-bold rounded-lg shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50">
            {loading ? 'Creating...' : 'Create Student'}
          </button>
        </form>
      </div>
    </div>
  );
}
