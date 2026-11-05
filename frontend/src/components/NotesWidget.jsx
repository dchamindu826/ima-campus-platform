import React, { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2, Save } from 'lucide-react';
import axios from '../api/axios';
import toast from 'react-hot-toast';

export default function NotesWidget({ loggedInUser }) {
    const [notes, setNotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState(null);
    
    // Form state
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');

    useEffect(() => {
        if (loggedInUser) {
            fetchNotes();
        }
    }, [loggedInUser]);

    const fetchNotes = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/notes');
            setNotes(res.data || []);
        } catch (error) {
            console.error("Error fetching notes:", error);
            toast.error("Failed to load notes.");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!content.trim()) {
            toast.error("Note content cannot be empty.");
            return;
        }

        try {
            if (editingId) {
                // Update
                const res = await axios.put(`/notes/${editingId}`, { title, content });
                setNotes(notes.map(n => (n.id === editingId ? res.data : n)));
                toast.success("Note updated!");
            } else {
                // Create
                const res = await axios.post('/notes', { title, content });
                setNotes([res.data, ...notes]);
                toast.success("Note created!");
            }
            resetForm();
        } catch (error) {
            console.error("Error saving note:", error);
            toast.error("Failed to save note.");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this note?")) return;
        try {
            await axios.delete(`/notes/${id}`);
            setNotes(notes.filter(n => n.id !== id));
            toast.success("Note deleted!");
        } catch (error) {
            console.error("Error deleting note:", error);
            toast.error("Failed to delete note.");
        }
    };

    const startEdit = (note) => {
        setIsAdding(true);
        setEditingId(note.id);
        setTitle(note.title || '');
        setContent(note.content || '');
    };

    const resetForm = () => {
        setIsAdding(false);
        setEditingId(null);
        setTitle('');
        setContent('');
    };

    return (
        <div className="flex flex-col h-full bg-[#0B1120] text-white">
            {/* Header Area */}
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                <h3 className="font-bold text-lg">My Notes</h3>
                {!isAdding && (
                    <button 
                        onClick={() => setIsAdding(true)}
                        className="bg-brand-accent hover:bg-brand-accent/80 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                    >
                        <Plus size={14} /> Add Note
                    </button>
                )}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {loading ? (
                    <div className="flex justify-center py-10"><div className="animate-spin w-6 h-6 border-2 border-brand-accent border-t-transparent rounded-full"></div></div>
                ) : isAdding ? (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                        <input
                            type="text"
                            placeholder="Title (Optional)"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-brand-accent outline-none"
                        />
                        <textarea
                            placeholder="Type your note here..."
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-brand-accent outline-none min-h-[120px] resize-none"
                        />
                        <div className="flex justify-end gap-2 pt-2">
                            <button onClick={resetForm} className="px-3 py-1.5 text-xs font-bold text-gray-400 hover:text-white transition-colors">Cancel</button>
                            <button onClick={handleSave} className="bg-brand-accent hover:bg-brand-accent/80 px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors">
                                <Save size={14} /> Save
                            </button>
                        </div>
                    </div>
                ) : notes.length === 0 ? (
                    <div className="text-center py-10 text-gray-500 text-sm">
                        No notes found. Create your first note!
                    </div>
                ) : (
                    <div className="space-y-3">
                        {notes.map(note => (
                            <div key={note.id} className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-white/20 transition-colors group">
                                <div className="flex justify-between items-start gap-2 mb-2">
                                    <h4 className="font-bold text-sm text-brand-accent break-words flex-1">
                                        {note.title || 'Untitled Note'}
                                    </h4>
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                        <button onClick={() => startEdit(note)} className="text-gray-400 hover:text-white"><Edit2 size={14} /></button>
                                        <button onClick={() => handleDelete(note.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{note.content}</p>
                                <div className="text-[10px] text-gray-500 mt-3 font-medium">
                                    {new Date(note.createdAt).toLocaleString()}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
