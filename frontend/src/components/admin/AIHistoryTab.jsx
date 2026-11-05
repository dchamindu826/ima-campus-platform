import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, Area, AreaChart
} from 'recharts';
import { Clock, Calendar, ShieldCheck, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AIHistoryTab({ api }) {
  const [history, setHistory] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState([]);

  const fetchHistory = async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.get(`/ai-verification/history?page=${page}&limit=10`);
      setHistory(res.data.history);
      setPagination(res.data.pagination);
      
      // Calculate chart data from the history (reverse it so chronological left to right)
      const cData = [...res.data.history].reverse().map(item => {
        const conversion = item.processed > 0 ? ((item.success / item.processed) * 100).toFixed(1) : 0;
        return {
          name: `${item.date} ${item.time}`,
          date: item.date,
          time: item.time,
          processed: item.processed,
          verified: item.success,
          failed: item.failed,
          conversion: parseFloat(conversion)
        };
      });
      setChartData(cData);
      
    } catch (err) {
      console.error(err);
      toast.error("Failed to load schedule history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory(1);
  }, []);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchHistory(newPage);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* Chart Section */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 shadow-xl">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <ShieldCheck className="text-purple-400" size={24} /> AI Verification Performance
        </h2>
        <div className="h-[300px] w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVerified" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff', borderRadius: '0.5rem' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }}/>
                <Area type="monotone" dataKey="verified" name="Verified" stroke="#10b981" fillOpacity={1} fill="url(#colorVerified)" />
                <Area type="monotone" dataKey="failed" name="Manual Review" stroke="#ef4444" fillOpacity={1} fill="url(#colorFailed)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              {loading ? "Loading chart data..." : "No history data available yet."}
            </div>
          )}
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-gray-800">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="text-blue-400" size={24} /> Execution Logs
          </h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-800/50 text-gray-400 text-sm border-b border-gray-700">
                <th className="p-4 font-semibold">Date & Time</th>
                <th className="p-4 font-semibold text-center">Processed</th>
                <th className="p-4 font-semibold text-center">Verified</th>
                <th className="p-4 font-semibold text-center">Manual Review</th>
                <th className="p-4 font-semibold text-center">Conversion Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading && history.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-500">Loading history...</td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-500">No scheduled executions found.</td>
                </tr>
              ) : (
                history.map((item) => {
                  const rate = item.processed > 0 ? Math.round((item.success / item.processed) * 100) : 0;
                  return (
                    <tr key={item.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="text-white font-medium flex items-center gap-2"><Calendar size={14} className="text-blue-400"/> {item.date}</span>
                          <span className="text-gray-400 text-sm flex items-center gap-2 mt-1"><Clock size={14} className="text-purple-400"/> {item.time}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center text-gray-300 font-medium">{item.processed}</td>
                      <td className="p-4 text-center text-emerald-400 font-bold">{item.success}</td>
                      <td className="p-4 text-center text-red-400 font-bold">{item.failed}</td>
                      <td className="p-4 text-center">
                        <div className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold bg-gray-800 border border-gray-700">
                          <span className={rate >= 50 ? 'text-emerald-400' : rate >= 20 ? 'text-yellow-400' : 'text-red-400'}>
                            {rate}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-gray-800 flex justify-between items-center bg-gray-900/80">
            <span className="text-gray-400 text-sm">
              Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total runs)
            </span>
            <div className="flex gap-2">
              <button 
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="p-2 bg-gray-800 rounded text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft size={18} />
              </button>
              <button 
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="p-2 bg-gray-800 rounded text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
