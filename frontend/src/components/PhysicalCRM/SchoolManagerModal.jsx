import React, { useState, useEffect } from 'react';
import { physicalCrmService } from '../../api/physicalCrm';
import { X, Edit2, Trash2, Plus, Loader2 } from 'lucide-react';

export default function SchoolManagerModal({ isOpen, onClose }) {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchSchools();
    }
  }, [isOpen]);

  const fetchSchools = async () => {
    setLoading(true);
    try {
      const data = await physicalCrmService.getSchools();
      setSchools(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newSchoolName.trim()) return;
    try {
      await physicalCrmService.createSchool({ name: newSchoolName });
      setNewSchoolName('');
      fetchSchools();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdate = async (id) => {
    if (!editName.trim()) return;
    try {
      await physicalCrmService.updateSchool(id, { name: editName });
      setEditingId(null);
      fetchSchools();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this school?')) return;
    try {
      await physicalCrmService.deleteSchool(id);
      fetchSchools();
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white dark:bg-brand-darkCard rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-brand-darkBorder animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-brand-darkBorder">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Manage Schools</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-brand-darkHover text-gray-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <form onSubmit={handleAdd} className="flex gap-2 mb-6">
            <input
              type="text"
              placeholder="Enter new school name..."
              className="flex-1 px-4 py-2 bg-gray-50 dark:bg-brand-darkBg border border-gray-200 dark:border-brand-darkBorder rounded-xl focus:ring-2 focus:ring-brand-accent focus:border-transparent outline-none transition-all dark:text-white"
              value={newSchoolName}
              onChange={(e) => setNewSchoolName(e.target.value)}
            />
            <button
              type="submit"
              disabled={!newSchoolName.trim()}
              className="px-4 py-2 bg-brand-accent hover:bg-brand-accentHover text-white rounded-xl font-medium transition-all disabled:opacity-50 flex items-center gap-2"
            >
              <Plus size={18} /> Add
            </button>
          </form>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
            {loading ? (
              <div className="flex justify-center p-4"><Loader2 className="animate-spin text-brand-accent" /></div>
            ) : schools.length === 0 ? (
              <p className="text-center text-gray-500 dark:text-gray-400 py-4">No schools added yet.</p>
            ) : (
              schools.map(school => (
                <div key={school.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-brand-darkBg rounded-xl border border-gray-100 dark:border-brand-darkBorder group hover:border-brand-accent/30 transition-all">
                  {editingId === school.id ? (
                    <input
                      type="text"
                      className="flex-1 px-3 py-1 bg-white dark:bg-brand-darkCard border border-brand-accent rounded-lg mr-2 outline-none dark:text-white"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                    />
                  ) : (
                    <span className="font-medium text-gray-800 dark:text-gray-200">{school.name}</span>
                  )}

                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {editingId === school.id ? (
                      <button onClick={() => handleUpdate(school.id)} className="p-1.5 text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10 rounded-lg">Save</button>
                    ) : (
                      <button onClick={() => { setEditingId(school.id); setEditName(school.name); }} className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg">
                        <Edit2 size={16} />
                      </button>
                    )}
                    <button onClick={() => handleDelete(school.id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
