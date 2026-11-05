import { useState, useEffect, useRef } from 'react'
import { UploadCloud, Settings, PlayCircle, Video, CheckCircle, RefreshCw, Key, LogIn, Lock, Trash2, Image as ImageIcon, Search, History, LayoutDashboard, Copy, ExternalLink, PlaySquare, Folder, Plus, Calendar, Edit2, ChevronLeft, ChevronRight, Save, X } from 'lucide-react'

function App() {
  const [activeTab, setActiveTab] = useState('upload') // 'upload' or 'settings'
  const [meetingId, setMeetingId] = useState('')
  const [zoomShareUrl, setZoomShareUrl] = useState('')
  const [searchDate, setSearchDate] = useState('')
  const [status, setStatus] = useState('idle') // idle, uploading, completed
  const [progressData, setProgressData] = useState({ stage: '', percent: 0 })
  const [youtubeUrl, setYoutubeUrl] = useState('')
  
  // New States
  const [youtubeAccounts, setYoutubeAccounts] = useState([])
  const [selectedYoutubeAccount, setSelectedYoutubeAccount] = useState('')
  const [zoomInstances, setZoomInstances] = useState([])
  const [selectedZoomInstance, setSelectedZoomInstance] = useState('')
  const [isSearchingInstances, setIsSearchingInstances] = useState(false)
  const [thumbnailPath, setThumbnailPath] = useState('')
  const [uploadCategory, setUploadCategory] = useState('Uncategorized')

  // History State
  // History State
  const [uploadHistory, setUploadHistory] = useState([])
  const [historySearchTerm, setHistorySearchTerm] = useState('')
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState('All')
  const [historyCurrentPage, setHistoryCurrentPage] = useState(1)
  const historyItemsPerPage = 8
  
  // History Rename State
  const [renamingId, setRenamingId] = useState(null)
  const [renamingTitle, setRenamingTitle] = useState('')

  // Settings Lock
  const [isSettingsLocked, setIsSettingsLocked] = useState(true)
  const [settingsPasswordInput, setSettingsPasswordInput] = useState('')

  // Settings state
  const [youtubeClientId, setYoutubeClientId] = useState('')
  const [youtubeClientSecret, setYoutubeClientSecret] = useState('')
  
  // Custom Categories State
  const [categories, setCategories] = useState([])
  const [newCategory, setNewCategory] = useState('')

  const fileInputRef = useRef(null)

  const loadSettings = () => {
    if (window.electronAPI) {
      window.electronAPI.getSettings().then(settings => {
        if (settings) {
          setYoutubeClientId(settings.youtubeClientId || '')
          setYoutubeClientSecret(settings.youtubeClientSecret || '')
          const accounts = settings.youtubeAccounts || []
          setYoutubeAccounts(accounts)
          if (accounts.length > 0 && !selectedYoutubeAccount) {
            setSelectedYoutubeAccount(accounts[0].id)
          }
          
          const savedCategories = settings.categories || ['Uncategorized', 'Physics', 'Chemistry', 'Biology', 'Combined Maths', 'IT', 'English', 'Other Seminars']
          setCategories(savedCategories)
          if (!savedCategories.includes(uploadCategory)) {
            setUploadCategory(savedCategories[0] || 'Uncategorized')
          }
        }
      })
    }
  }

  const loadHistory = () => {
    if (window.electronAPI) {
      window.electronAPI.getHistory().then(history => {
        setUploadHistory(history || [])
      })
    }
  }

  useEffect(() => {
    loadSettings()
    loadHistory()
    if (window.electronAPI) {
      window.electronAPI.onUploadProgress((data) => {
        setProgressData(data)
        if (data.percent === 100) {
          setStatus('completed')
        }
      })
    }
  }, [activeTab])

  const saveSettings = () => {
    if (window.electronAPI) {
      window.electronAPI.saveSettings({
        youtubeClientId, youtubeClientSecret, youtubeAccounts, categories
      })
      alert('Settings saved successfully!')
    }
  }

  const handleGoogleLogin = async () => {
    if (!youtubeClientId || !youtubeClientSecret) {
      alert('Please save your Google Client ID and Secret first.')
      return
    }
    saveSettings()
    try {
      const updatedAccounts = await window.electronAPI.authGoogle()
      setYoutubeAccounts(updatedAccounts)
      if (updatedAccounts.length > 0) {
        setSelectedYoutubeAccount(updatedAccounts[updatedAccounts.length - 1].id)
      }
    } catch (err) {
      alert('Authentication failed: ' + err.message)
    }
  }

  const removeAccount = async (id) => {
    if (window.electronAPI) {
      const updated = await window.electronAPI.removeYoutubeAccount(id)
      setYoutubeAccounts(updated)
      if (selectedYoutubeAccount === id) {
        setSelectedYoutubeAccount(updated.length > 0 ? updated[0].id : '')
      }
    }
  }

  const extractToken = (url) => {
    if (!url) return '';
    const match = url.match(/(?:rec\/share\/|rec\/play\/)([a-zA-Z0-9_-]+)/);
    return match ? match[1] : url.trim();
  };

  const searchInstances = async () => {
    if (!meetingId) {
      alert('Please enter a Meeting ID first.')
      return
    }
    
    // Check if they pasted a share link instead of ID
    if (meetingId.includes('rec/share') && !meetingId.match(/\d{9,11}/)) {
      alert('Error: Please enter the 10 or 11 digit Meeting ID here. Put the Share Link in the "Zoom Share URL" box below.')
      return
    }

    if (zoomShareUrl && zoomShareUrl.includes('zoom.us/j/')) {
      alert('Error: You pasted a Meeting Join Link (zoom.us/j/...) into the Share URL box. The Share URL must be a recording link (e.g. zoom.us/rec/share/...). Please leave the Share URL box empty if you don\'t have a recording link.');
      return;
    }

    setIsSearchingInstances(true)
    setZoomInstances([])
    setSelectedZoomInstance('')
    try {
      const data = await window.electronAPI.fetchZoomInstances(meetingId)
      
      let filteredData = data;
      if (searchDate) {
        filteredData = filteredData.filter(inst => inst.start_time.startsWith(searchDate));
      }
      if (zoomShareUrl) {
        const inputToken = extractToken(zoomShareUrl);
        if (inputToken) {
          filteredData = filteredData.filter(inst => {
            const instToken = extractToken(inst.share_url);
            return instToken === inputToken || (inst.share_url && inst.share_url.includes(inputToken));
          });
        }
      }
      
      setZoomInstances(filteredData)
      if (filteredData.length === 1) {
        setSelectedZoomInstance(filteredData[0].uuid)
      } else if (filteredData.length > 0) {
        setSelectedZoomInstance(filteredData[0].uuid)
        if (zoomShareUrl) alert('Multiple recordings matched or token matching failed. Please select from the dropdown.');
      } else {
        setSelectedZoomInstance('')
        if (data.length > 0) {
          alert('No recordings found matching the provided Date or Share URL.');
        } else {
          alert('No past occurrences found for this Meeting ID in any account.');
        }
      }
    } catch (err) {
      alert('Failed to search: ' + err.message)
    } finally {
      setIsSearchingInstances(false)
    }
  }

  const handleThumbnailSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setThumbnailPath(e.target.files[0].path)
    }
  }

  const handleUpload = async () => {
    if (!meetingId) {
      alert('Please enter a Zoom Meeting ID')
      return
    }
    if (zoomInstances.length === 0) {
      alert('Please search and select a valid Zoom recording first.')
      return
    }
    if (!selectedZoomInstance) {
      alert('Please select a specific class date/time.')
      return
    }
    if (youtubeAccounts.length === 0 || !selectedYoutubeAccount) {
      alert('Please authenticate with YouTube in Settings first.')
      setActiveTab('settings')
      return
    }

    setStatus('uploading')
    setProgressData({ stage: 'Initializing...', percent: 0 })
    
    if (window.electronAPI) {
      try {
        const result = await window.electronAPI.startUploadProcess({ 
          meetingId, 
          uuid: selectedZoomInstance,
          youtubeAccountId: selectedYoutubeAccount,
          category: uploadCategory
        })
        if (result.success) {
          setYoutubeUrl(result.youtubeUrl)
          loadHistory() // Refresh history after upload
        }
      } catch (err) {
        alert('Upload failed: ' + err.message)
        setStatus('idle')
      }
    }
  }

  const handleCancelUpload = async () => {
    if (window.electronAPI) {
      const cancelled = await window.electronAPI.cancelUpload()
      if (cancelled) {
        setStatus('idle')
        setProgressData({ stage: '', percent: 0 })
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      <div className="h-10 bg-slate-800/50 backdrop-blur-md flex items-center px-4 titlebar-drag border-b border-white/5">
        <div className="flex items-center gap-2">
          <PlayCircle className="w-5 h-5 text-red-500" />
          <span className="font-semibold text-sm tracking-wide">Zoom to YouTube Uploader</span>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 bg-slate-900 border-r border-white/10 flex flex-col">
          <div className="p-6">
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Auto Uploader</h1>
          </div>
          <nav className="flex-1 px-4 space-y-2">
            <button 
              onClick={() => setActiveTab('upload')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'upload' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
            >
              <UploadCloud className="w-5 h-5" />
              <span className="font-medium">Upload Video</span>
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'history' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
            >
              <History className="w-5 h-5" />
              <span className="font-medium">Upload History</span>
            </button>
            <button 
              onClick={() => setActiveTab('studio')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'studio' ? 'bg-red-600 text-white shadow-lg shadow-red-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
            >
              <PlaySquare className="w-5 h-5" />
              <span className="font-medium">YT Studio</span>
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'settings' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
            >
              <Settings className="w-5 h-5" />
              <span className="font-medium">Settings</span>
            </button>
          </nav>
        </div>

        <div className="flex-1 overflow-y-auto bg-[conic-gradient(at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-slate-800 to-indigo-950 p-8">
          <div className="max-w-2xl mx-auto">
            {activeTab === 'upload' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="text-center mb-10">
                  <h2 className="text-5xl font-extrabold bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent mb-3">Auto Uploader</h2>
                  <p className="text-slate-300 font-medium text-lg">Transfer Zoom recordings directly to YouTube Unlisted.</p>
                </div>

                <div className="bg-slate-800/60 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-8 shadow-2xl shadow-indigo-500/10 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 pointer-events-none"></div>
                  <div className="space-y-6 relative z-10">
                    
                    {/* YouTube Channel Selector */}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Select YouTube Channel</label>
                      <select 
                        value={selectedYoutubeAccount}
                        onChange={(e) => setSelectedYoutubeAccount(e.target.value)}
                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 px-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all appearance-none"
                      >
                        {youtubeAccounts.length === 0 && <option value="">No channels authenticated. Go to settings.</option>}
                        {youtubeAccounts.map(acc => (
                          <option key={acc.id} value={acc.id}>{acc.title}</option>
                        ))}
                      </select>
                    </div>

                    {/* Meeting ID Input */}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Zoom Meeting ID</label>
                      <div className="flex flex-col md:flex-row gap-3">
                        <div className="relative flex-1">
                          <Video className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-400" />
                          <input 
                            type="text" 
                            value={meetingId}
                            onChange={(e) => {
                              setMeetingId(e.target.value);
                              setZoomInstances([]);
                              setSelectedZoomInstance('');
                            }}
                            placeholder="e.g. 812 3456 7890"
                            className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                          />
                        </div>
                        <div className="relative md:w-48">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Calendar className="h-5 w-5 text-slate-500" />
                          </div>
                          <input 
                            type="date" 
                            value={searchDate}
                            onChange={(e) => setSearchDate(e.target.value)}
                            className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all [color-scheme:dark]"
                            title="Filter recordings by Date"
                          />
                        </div>
                        <button 
                          onClick={searchInstances}
                          disabled={isSearchingInstances || !meetingId}
                          className="bg-slate-700 hover:bg-slate-600 text-white px-6 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 md:w-32"
                        >
                          {isSearchingInstances ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                          Search
                        </button>
                      </div>
                    </div>

                    {/* Share URL Input */}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Zoom Share URL (Optional - For Auto-Select)</label>
                      <div className="relative">
                        <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400" />
                        <input 
                          type="text" 
                          value={zoomShareUrl}
                          onChange={(e) => {
                            setZoomShareUrl(e.target.value);
                            setZoomInstances([]);
                            setSelectedZoomInstance('');
                          }}
                          placeholder="e.g. https://zoom.us/rec/share/..."
                          className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                        />
                      </div>
                    </div>

                    {/* Instances Dropdown */}
                    {zoomInstances.length > 0 && (
                      <div className="animate-in fade-in slide-in-from-top-2">
                        <label className="block text-sm font-medium text-slate-300 mb-2">Select Class Date & Time</label>
                        <select 
                          value={selectedZoomInstance}
                          onChange={(e) => setSelectedZoomInstance(e.target.value)}
                          className="w-full bg-slate-900/50 border border-blue-500/30 rounded-xl py-3 px-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all appearance-none"
                        >
                          {zoomInstances.map(inst => (
                            <option key={inst.uuid} value={inst.uuid}>
                              {new Date(inst.start_time).toLocaleString()} - {inst.topic || 'Class'} ({inst.duration}m) - {((inst.total_size||0)/1024/1024).toFixed(1)}MB [{inst.accountName}]
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Category Selection */}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Select Category / Folder</label>
                      <select 
                        value={uploadCategory}
                        onChange={(e) => setUploadCategory(e.target.value)}
                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 px-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all appearance-none"
                      >
                        {categories.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    {status === 'idle' && (
                      <button 
                        onClick={handleUpload}
                        className="w-full mt-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-500/25 transition-all transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 text-lg"
                      >
                        <UploadCloud className="w-6 h-6" />
                        Start Secure Transfer
                      </button>
                    )}

                    {status === 'uploading' && (
                      <div className="bg-slate-900/50 border border-blue-500/30 rounded-xl p-5 space-y-4">
                        <div className="flex items-center justify-between text-sm font-medium">
                          <span className="text-blue-400 flex items-center gap-2">
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            {progressData.stage}
                          </span>
                          <span className="text-slate-300">{progressData.percent}%</span>
                        </div>
                        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300 ease-out"
                            style={{ width: `${progressData.percent}%` }}
                          ></div>
                        </div>
                        <div className="pt-2 flex justify-end">
                          <button 
                            onClick={handleCancelUpload}
                            className="text-sm bg-red-500/10 hover:bg-red-500/20 text-red-400 py-2 px-4 rounded-lg font-medium transition-colors border border-red-500/20"
                          >
                            Cancel Transfer
                          </button>
                        </div>
                      </div>
                    )}

                    {status === 'completed' && (
                      <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6 text-center space-y-4">
                        <div className="flex justify-center">
                          <CheckCircle className="w-12 h-12 text-green-500" />
                        </div>
                        <h3 className="text-xl font-semibold text-green-400">Transfer Complete!</h3>
                        <div className="bg-slate-900/80 p-3 rounded-lg flex items-center justify-between border border-white/5">
                          <span className="text-slate-300 text-sm truncate mr-4">{youtubeUrl}</span>
                          <button 
                            onClick={() => navigator.clipboard.writeText(youtubeUrl)}
                            className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-md transition-colors"
                          >
                            Copy
                          </button>
                        </div>
                        <button 
                          onClick={() => {
                            setStatus('idle');
                            setMeetingId('');
                            setYoutubeUrl('');
                            setZoomInstances([]);
                            setProgressData({stage: '', percent: 0});
                          }}
                          className="text-sm text-slate-400 hover:text-white transition-colors mt-2"
                        >
                          Upload Another Video
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col">
                <div className="flex justify-between items-end shrink-0">
                  <div>
                    <h2 className="text-3xl font-bold text-white">Upload History</h2>
                    <p className="text-slate-400 mt-1">Manage and copy links for all your past uploads.</p>
                  </div>
                </div>

                <div className="flex gap-4 shrink-0">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Search by title or video ID..." 
                      value={historySearchTerm}
                      onChange={(e) => setHistorySearchTerm(e.target.value)}
                      className="w-full bg-slate-800/60 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <select 
                    value={historyCategoryFilter}
                    onChange={(e) => { setHistoryCategoryFilter(e.target.value); setHistoryCurrentPage(1); }}
                    className="bg-slate-800/60 border border-white/10 rounded-xl py-3 px-4 text-slate-200 focus:outline-none focus:border-blue-500 w-48"
                  >
                    <option value="All">All Categories</option>
                    {[...new Set([...categories, ...uploadHistory.map(h => h.category)])].filter(Boolean).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 flex-1 overflow-y-auto pb-4">
                  {(() => {
                    const filteredHistory = uploadHistory
                      .filter(h => historyCategoryFilter === 'All' || h.category === historyCategoryFilter)
                      .filter(h => h.title.toLowerCase().includes(historySearchTerm.toLowerCase()) || h.id.includes(historySearchTerm));
                    
                    const totalPages = Math.ceil(filteredHistory.length / historyItemsPerPage);
                    const currentItems = filteredHistory.slice((historyCurrentPage - 1) * historyItemsPerPage, historyCurrentPage * historyItemsPerPage);
                    
                    return (
                      <>
                        {currentItems.map((item, idx) => (
                          <div key={idx} className="bg-slate-800/40 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-all flex flex-col group">
                            <div className="h-32 bg-slate-900 relative">
                              <div className="w-full h-full flex items-center justify-center bg-slate-800">
                                <Video className="w-10 h-10 text-slate-600" />
                              </div>
                              <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md text-xs font-medium text-white border border-white/10">
                                {item.category}
                              </div>
                            </div>
                            <div className="p-4 flex-1 flex flex-col">
                              {renamingId === item.id ? (
                                <div className="mb-2 flex items-center gap-2">
                                  <input 
                                    type="text" 
                                    value={renamingTitle}
                                    onChange={(e) => setRenamingTitle(e.target.value)}
                                    className="flex-1 bg-slate-900 border border-blue-500 rounded px-2 py-1 text-sm text-white focus:outline-none"
                                    autoFocus
                                    onKeyDown={(e) => e.key === 'Enter' && handleRenameSave(item.id)}
                                  />
                                  <button onClick={() => handleRenameSave(item.id)} className="text-green-400 hover:text-green-300 p-1"><Save className="w-4 h-4" /></button>
                                  <button onClick={() => setRenamingId(null)} className="text-red-400 hover:text-red-300 p-1"><X className="w-4 h-4" /></button>
                                </div>
                              ) : (
                                <div className="mb-1 flex items-start justify-between group/title">
                                  <h3 className="font-semibold text-slate-100 line-clamp-2 pr-2" title={item.title}>{item.title}</h3>
                                  <button 
                                    onClick={() => { setRenamingId(item.id); setRenamingTitle(item.title); }}
                                    className="text-slate-500 hover:text-blue-400 opacity-0 group-hover/title:opacity-100 transition-opacity p-1"
                                    title="Rename"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                              <p className="text-xs text-slate-400 mb-4">{new Date(item.date).toLocaleString()} • {item.channelName}</p>
                              
                              <div className="mt-auto flex gap-2">
                                <button 
                                  onClick={() => {
                                    navigator.clipboard.writeText(item.youtubeUrl);
                                    alert('Link copied to clipboard!');
                                  }}
                                  className="flex-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-lg py-2 flex items-center justify-center gap-2 text-sm font-medium transition-colors"
                                >
                                  <Copy className="w-4 h-4" /> Copy Link
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                        {filteredHistory.length === 0 && (
                          <div className="col-span-full text-center py-12 text-slate-500">
                            <History className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>No upload history found.</p>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
                
                {/* Pagination Controls */}
                {(() => {
                  const filteredHistory = uploadHistory
                    .filter(h => historyCategoryFilter === 'All' || h.category === historyCategoryFilter)
                    .filter(h => h.title.toLowerCase().includes(historySearchTerm.toLowerCase()) || h.id.includes(historySearchTerm));
                  const totalPages = Math.ceil(filteredHistory.length / historyItemsPerPage);
                  if (totalPages > 1) {
                    return (
                      <div className="flex justify-center items-center gap-4 py-2 shrink-0 border-t border-white/5 pt-4">
                        <button 
                          onClick={() => setHistoryCurrentPage(p => Math.max(1, p - 1))}
                          disabled={historyCurrentPage === 1}
                          className="p-2 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-50 hover:bg-slate-700 transition-colors"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="text-sm font-medium text-slate-400">Page {historyCurrentPage} of {totalPages}</span>
                        <button 
                          onClick={() => setHistoryCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={historyCurrentPage === totalPages}
                          className="p-2 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-50 hover:bg-slate-700 transition-colors"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            )}

            {activeTab === 'studio' && (
              <div className="h-[calc(100vh-6rem)] w-full bg-white rounded-xl overflow-hidden border border-white/10 shadow-2xl">
                <webview 
                  src="https://studio.youtube.com" 
                  className="w-full h-full"
                  allowpopups="true"
                  partition="persist:youtube"
                ></webview>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-6 flex justify-between items-end">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-100">Configuration</h2>
                    <p className="text-slate-400 text-sm mt-1">Configure your API credentials here.</p>
                  </div>
                  <button 
                    onClick={saveSettings}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-6 rounded-xl shadow-lg shadow-blue-500/20 transition-all"
                  >
                    Save Settings
                  </button>
                </div>

                <div className="bg-slate-800/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl space-y-5">
                  <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-3">
                    <Video className="w-5 h-5 text-blue-400" />
                    <h3 className="text-lg font-semibold">Zoom Server-to-Server OAuth</h3>
                  </div>
                  <p className="text-sm text-slate-400">All 8 Zoom accounts have been securely hardcoded into the application. The system will automatically search across all accounts to find your recording.</p>
                </div>

                <div className="bg-slate-800/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl space-y-5">
                  <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2">
                      <PlayCircle className="w-5 h-5 text-red-500" />
                      <h3 className="text-lg font-semibold">YouTube Channels</h3>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">OAuth Credentials</label>
                    {isSettingsLocked ? (
                      <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6 flex flex-col items-center justify-center space-y-4">
                        <Lock className="w-8 h-8 text-slate-500" />
                        <p className="text-sm text-slate-400">Enter password to unlock and edit API keys.</p>
                        <div className="flex items-center gap-2 w-full max-w-sm">
                          <input 
                            type="password" 
                            value={settingsPasswordInput}
                            onChange={(e) => setSettingsPasswordInput(e.target.value)}
                            placeholder="Password"
                            className="flex-1 bg-slate-800 border border-white/10 rounded-lg py-2 px-3 text-slate-200 focus:outline-none focus:border-red-500 transition-colors"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                if (settingsPasswordInput === '10954') setIsSettingsLocked(false);
                                else alert('Incorrect Password');
                                setSettingsPasswordInput('');
                              }
                            }}
                          />
                          <button 
                            onClick={() => {
                              if (settingsPasswordInput === '10954') setIsSettingsLocked(false);
                              else alert('Incorrect Password');
                              setSettingsPasswordInput('');
                            }}
                            className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                          >
                            Unlock
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4 bg-slate-900/50 border border-white/10 rounded-xl p-4">
                        <div className="flex justify-end">
                          <button onClick={() => setIsSettingsLocked(true)} className="text-xs flex items-center gap-1 text-slate-400 hover:text-slate-200">
                            <Lock className="w-3 h-3" /> Lock
                          </button>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">OAuth Client ID</label>
                          <input 
                            type="text" 
                            value={youtubeClientId}
                            onChange={(e) => setYoutubeClientId(e.target.value)}
                            placeholder="e.g. 509557246805-...apps.googleusercontent.com"
                            className="w-full bg-slate-800 border border-white/10 rounded-xl py-2 px-3 text-slate-200 focus:outline-none focus:border-red-500 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">OAuth Client Secret</label>
                          <input 
                            type="password" 
                            value={youtubeClientSecret}
                            onChange={(e) => setYoutubeClientSecret(e.target.value)}
                            placeholder="e.g. GOCSPX-y3XHh6q..."
                            className="w-full bg-slate-800 border border-white/10 rounded-xl py-2 px-3 text-slate-200 focus:outline-none focus:border-red-500 transition-colors"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 pt-6 border-t border-white/10">
                    <h4 className="text-sm font-semibold text-slate-300 mb-4">Connected Channels ({youtubeAccounts.length})</h4>
                    <div className="space-y-3">
                      {youtubeAccounts.map(acc => (
                        <div key={acc.id} className="flex items-center justify-between bg-slate-900/50 p-3 rounded-xl border border-white/5">
                          <div className="flex items-center gap-3">
                            {acc.thumbnail ? (
                              <img src={acc.thumbnail} alt="" className="w-8 h-8 rounded-full" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                                <PlayCircle className="w-4 h-4 text-red-400" />
                              </div>
                            )}
                            <span className="font-medium text-slate-200">{acc.title}</span>
                          </div>
                          <button onClick={() => removeAccount(acc.id)} className="text-slate-500 hover:text-red-400 transition-colors p-2">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <button 
                      onClick={handleGoogleLogin}
                      className="w-full mt-4 bg-slate-700 hover:bg-slate-600 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-all border border-slate-600"
                    >
                      <LogIn className="w-5 h-5" />
                      Authenticate New Channel
                    </button>
                  </div>
                </div>

                {/* Manage Categories Section */}
                <div className="bg-slate-800/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl space-y-5">
                  <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-3">
                    <Folder className="w-5 h-5 text-purple-500" />
                    <h3 className="text-lg font-semibold">Manage Categories / Folders</h3>
                  </div>
                  
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      placeholder="Add new category..."
                      className="flex-1 bg-slate-900/50 border border-white/10 rounded-xl py-2.5 px-4 text-slate-200 focus:outline-none focus:border-purple-500 transition-colors"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newCategory.trim()) {
                          if (!categories.includes(newCategory.trim())) {
                            setCategories([...categories, newCategory.trim()]);
                            setNewCategory('');
                          }
                        }
                      }}
                    />
                    <button 
                      onClick={() => {
                        if (newCategory.trim() && !categories.includes(newCategory.trim())) {
                          setCategories([...categories, newCategory.trim()]);
                          setNewCategory('');
                        }
                      }}
                      className="bg-purple-600 hover:bg-purple-500 text-white px-4 rounded-xl flex items-center gap-2 transition-colors"
                    >
                      <Plus className="w-5 h-5" /> Add
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {categories.map((cat, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-slate-900/50 p-3 rounded-xl border border-white/5">
                        <span className="font-medium text-slate-200 truncate">{cat}</span>
                        <button 
                          onClick={() => setCategories(categories.filter(c => c !== cat))}
                          className="text-slate-500 hover:text-red-400 transition-colors p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {categories.length === 0 && <p className="text-slate-500 text-sm col-span-2">No categories. Please add some.</p>}
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
