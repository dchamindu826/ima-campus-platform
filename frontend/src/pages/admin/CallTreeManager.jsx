import React, { useState } from 'react';
import { FaPhoneAlt, FaNetworkWired, FaServer, FaCogs, FaUsers, FaPlus, FaSave } from 'react-icons/fa';
import WebRTCDialer from '../../components/Admin/WebRTCDialer';

export default function CallTreeManager({ loggedInUser }) {
  const [activeTab, setActiveTab] = useState('trunk');
  const [serverStatus, setServerStatus] = useState('ONLINE'); // MOCK

  return (
    <div className="min-h-screen bg-[#0a0f1c] text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-emerald-400 to-cyan-500 bg-clip-text text-transparent flex items-center gap-3">
              <FaNetworkWired className="text-emerald-400" />
              PBX & Call Tree Management
            </h1>
            <p className="text-slate-400 mt-2">Manage your dedicated FreeSWITCH PBX, SIP Trunks, and IVR Menus.</p>
          </div>
          
          <div className="flex items-center gap-4 bg-slate-800/50 px-6 py-3 rounded-2xl border border-slate-700">
            <FaServer className={serverStatus === 'ONLINE' ? 'text-emerald-400' : 'text-red-400'} />
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Server Status</p>
              <p className={`font-black ${serverStatus === 'ONLINE' ? 'text-emerald-400' : 'text-red-400'}`}>
                {serverStatus} (72.61.126.204)
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-slate-800 pb-4">
          <button 
            onClick={() => setActiveTab('trunk')}
            className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${activeTab === 'trunk' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <FaPhoneAlt /> SIP Trunk (Hutch)
          </button>
          <button 
            onClick={() => setActiveTab('extensions')}
            className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${activeTab === 'extensions' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <FaUsers /> Extensions
          </button>
          <button 
            onClick={() => setActiveTab('ivr')}
            className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${activeTab === 'ivr' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <FaNetworkWired /> Call Tree (IVR)
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <FaCogs /> Server Config
          </button>
        </div>

        {/* Content Area */}
        <div className="bg-slate-800/30 rounded-3xl p-8 border border-slate-700/50 min-h-[500px]">
          
          {activeTab === 'trunk' && (
            <div className="animate-fade-in-up max-w-2xl">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <FaPhoneAlt className="text-indigo-400" /> Hutch SIP Trunk Configuration
              </h2>
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">SIP Server IP / Domain</label>
                  <input type="text" placeholder="e.g. sip.hutch.lk or 10.x.x.x" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Username / Auth ID</label>
                    <input type="text" placeholder="Your Hutch SIP ID" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Password</label>
                    <input type="password" placeholder="••••••••" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Main Phone Number (Caller ID)</label>
                  <input type="text" placeholder="e.g. 078xxxxxxx" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none" />
                </div>
                <button className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-8 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20">
                  <FaSave /> Save Trunk Config
                </button>
              </div>
            </div>
          )}

          {activeTab === 'ivr' && (
            <div className="animate-fade-in-up">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <FaNetworkWired className="text-emerald-400" /> Digital Receptionist (Call Tree)
              </h2>
              <div className="bg-slate-900/50 p-10 rounded-2xl border border-slate-800 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4 border border-emerald-500/20">
                  <FaNetworkWired className="text-4xl text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold mb-2">No Call Trees Configured</h3>
                <p className="text-slate-400 mb-6 max-w-md">Create an Interactive Voice Response (IVR) menu to route callers to the right staff member or queue.</p>
                <button className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-8 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20">
                  <FaPlus /> Create New Call Tree
                </button>
              </div>
            </div>
          )}

          {activeTab === 'extensions' && (
            <div className="animate-fade-in-up">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <FaUsers className="text-blue-400" /> WebRTC Extensions
              </h2>
              <p className="text-slate-400 mb-6">These extensions map directly to your logged-in CRM users. The CRM browser acts as the softphone.</p>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-xl font-bold mb-4">Live Softphone Test</h3>
                  <WebRTCDialer 
                    extension="1000" 
                    password="1234" 
                    sipDomain="pbx.lumi-automation.com" 
                  />
                </div>
                
                <div className="overflow-x-auto">
                  <h3 className="text-xl font-bold mb-4">Directory</h3>
                  <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400 text-sm uppercase tracking-wider">
                      <th className="pb-4 px-4 font-bold">Ext</th>
                      <th className="pb-4 px-4 font-bold">Staff Role</th>
                      <th className="pb-4 px-4 font-bold">Status</th>
                      <th className="pb-4 px-4 font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                      <td className="py-4 px-4 font-mono font-bold text-lg text-indigo-300">100</td>
                      <td className="py-4 px-4 text-white">Manager</td>
                      <td className="py-4 px-4"><span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/30">Auto-Registered</span></td>
                      <td className="py-4 px-4"><button className="text-indigo-400 hover:text-indigo-300 font-bold text-sm">Edit Routing</button></td>
                    </tr>
                    <tr className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                      <td className="py-4 px-4 font-mono font-bold text-lg text-indigo-300">101</td>
                      <td className="py-4 px-4 text-white">Staff (Coordinator)</td>
                      <td className="py-4 px-4"><span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/30">Auto-Registered</span></td>
                      <td className="py-4 px-4"><button className="text-indigo-400 hover:text-indigo-300 font-bold text-sm">Edit Routing</button></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="animate-fade-in-up">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <FaCogs className="text-slate-300" /> FreeSWITCH Server Config
              </h2>
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 font-mono text-sm text-emerald-400 overflow-x-auto">
                <p># Core Status</p>
                <p className="text-slate-300">UP 0 years, 0 days, 0 hours, 2 minutes</p>
                <p className="text-slate-300">FreeSWITCH (Version 1.10.12) is ready</p>
                <br/>
                <p># Active SIP Profiles</p>
                <p className="text-slate-300">internal (5060)</p>
                <p className="text-slate-300">external (5080)</p>
                <p className="text-slate-300">webrtc (7443 WSS)</p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
