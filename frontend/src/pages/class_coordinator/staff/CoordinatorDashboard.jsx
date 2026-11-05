import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../api/axios';

export default function CoordinatorDashboard() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const response = await api.get('/coordinator/tasks');
        setTasks(response.data);
      } catch (error) {
        console.error("Error fetching tasks", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-black text-orange-400">Class Coordinator Dashboard</h1>
        <button onClick={handleLogout} className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg font-bold">Logout</button>
      </div>
      
      {loading ? (
        <p className="text-white/50">Loading tasks from server...</p>
      ) : (
        <div className="bg-black/40 p-6 rounded-2xl border border-white/10">
           {tasks.length === 0 ? (
             <p className="text-white/40">You have no assigned tasks currently.</p>
           ) : (
             <pre className="text-xs">{JSON.stringify(tasks, null, 2)}</pre>
           )}
        </div>
      )}
    </div>
  );
}