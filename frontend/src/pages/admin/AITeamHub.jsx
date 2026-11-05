import React, { useState, useEffect, useRef } from 'react';
import {
  Users, Bot, Sparkles, Send, Plus, Settings, Trash2, Edit3, Shield,
  Code, Terminal, CheckCircle2, ChevronRight, Hash, AtSign, RefreshCw,
  Search, Upload, X, Copy, Check, MessageSquare, Zap, Eye, Download,
  Layers, UserCheck, AlertCircle, FileText, Cpu, Compass
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../../api/axios';
import toast from 'react-hot-toast';

// Curated avatar presets
const PRESET_AVATARS = [
  { id: 'techlead', label: 'Tech Lead', url: '/uploads/ai-team-avatars/default-techlead.svg' },
  { id: 'security', label: 'Cyber Security', url: '/uploads/ai-team-avatars/default-security.svg' },
  { id: 'frontend', label: 'Frontend Dev', url: '/uploads/ai-team-avatars/default-frontend.svg' },
  { id: 'backend', label: 'Backend Dev', url: '/uploads/ai-team-avatars/default-backend.svg' },
  { id: 'qa', label: 'QA Engineer', url: '/uploads/ai-team-avatars/default-qa.svg' },
];

const BADGE_COLORS = {
  violet: {
    badge: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
    ring: 'ring-violet-500/50',
    glow: 'shadow-violet-500/20',
    accent: '#8b5cf6'
  },
  rose: {
    badge: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    ring: 'ring-rose-500/50',
    glow: 'shadow-rose-500/20',
    accent: '#f43f5e'
  },
  sky: {
    badge: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    ring: 'ring-sky-500/50',
    glow: 'shadow-sky-500/20',
    accent: '#0ea5e9'
  },
  emerald: {
    badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    ring: 'ring-emerald-500/50',
    glow: 'shadow-emerald-500/20',
    accent: '#10b981'
  },
  amber: {
    badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    ring: 'ring-amber-500/50',
    glow: 'shadow-amber-500/20',
    accent: '#f59e0b'
  },
  indigo: {
    badge: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
    ring: 'ring-indigo-500/50',
    glow: 'shadow-indigo-500/20',
    accent: '#6366f1'
  },
  cyan: {
    badge: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    ring: 'ring-cyan-500/50',
    glow: 'shadow-cyan-500/20',
    accent: '#06b6d4'
  }
};

export default function AITeamHub({ loggedInUser }) {
  // Navigation / active target
  const [activeTab, setActiveTab] = useState('teams'); // 'teams' | 'members'
  const [activeTargetId, setActiveTargetId] = useState('');
  const [activeChatType, setActiveChatType] = useState('team'); // 'team' | 'direct'

  // Data state
  const [members, setMembers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [messages, setMessages] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // UI state
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAgentName, setLoadingAgentName] = useState('');
  const [discussionMode, setDiscussionMode] = useState('smart'); // 'smart' | 'all'
  const [copiedMsgId, setCopiedMsgId] = useState(null);

  // @Mentions popup state
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);

  // Modals state
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [memberForm, setMemberForm] = useState({
    name: '',
    role: '',
    title: '',
    avatar: PRESET_AVATARS[0].url,
    systemPrompt: '',
    skills: '',
    badgeColor: 'violet',
    model: 'claude-3-7-sonnet',
    temperature: 0.7
  });

  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [teamForm, setTeamForm] = useState({
    name: '',
    description: '',
    icon: '🚀',
    badgeColor: 'indigo',
    memberIds: []
  });

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [anthropicApiKey, setAnthropicApiKey] = useState(() => localStorage.getItem('anthropic_custom_api_key') || '');
  const [selectedGlobalModel, setSelectedGlobalModel] = useState('claude-3-7-sonnet');

  // File upload state
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef(null);
  const chatBottomRef = useRef(null);
  const inputRef = useRef(null);

  // Load initial data
  useEffect(() => {
    fetchMembersAndTeams();
  }, []);

  const fetchMembersAndTeams = async () => {
    try {
      const [membersRes, teamsRes] = await Promise.all([
        api.get('/ai-team/members'),
        api.get('/ai-team/teams')
      ]);

      if (membersRes.data?.members) {
        setMembers(membersRes.data.members);
      }
      if (teamsRes.data?.teams) {
        setTeams(teamsRes.data.teams);
        if (!activeTargetId && teamsRes.data.teams.length > 0) {
          const firstTeam = teamsRes.data.teams[0];
          setActiveTargetId(firstTeam.id);
          setActiveChatType('team');
          loadConversation(firstTeam.id);
        }
      }
    } catch (err) {
      console.error('Failed to load AI team data:', err);
      toast.error('Could not load AI team details.');
    }
  };

  const loadConversation = async (targetId) => {
    try {
      const res = await api.get(`/ai-team/conversations/${targetId}`);
      if (res.data?.history) {
        setMessages(res.data.history);
      } else {
        setMessages([]);
      }
    } catch (err) {
      console.warn('Failed to load conversation history:', err);
      setMessages([]);
    }
  };

  useEffect(() => {
    if (activeTargetId) {
      loadConversation(activeTargetId);
    }
  }, [activeTargetId]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Current active details
  const activeTeam = activeChatType === 'team' ? teams.find(t => t.id === activeTargetId) : null;
  const activeMember = activeChatType === 'direct' ? members.find(m => m.id === activeTargetId) : null;
  const activeTeamMembers = activeTeam ? members.filter(m => activeTeam.memberIds?.includes(m.id)) : [];

  // Handle switching chats
  const handleSelectTeam = (team) => {
    setActiveTargetId(team.id);
    setActiveChatType('team');
  };

  const handleSelectMember = (member) => {
    setActiveTargetId(member.id);
    setActiveChatType('direct');
  };

  // @Mention detection in input
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputMessage(val);

    const lastAtIdx = val.lastIndexOf('@');
    if (lastAtIdx !== -1 && activeChatType === 'team') {
      const query = val.slice(lastAtIdx + 1);
      if (!query.includes(' ')) {
        setMentionFilter(query.toLowerCase());
        setShowMentionMenu(true);
        setSelectedMentionIndex(0);
        return;
      }
    }
    setShowMentionMenu(false);
  };

  const filteredMentionMembers = activeTeamMembers.filter(m =>
    m.name.toLowerCase().includes(mentionFilter) ||
    m.role.toLowerCase().includes(mentionFilter)
  );

  const insertMention = (member) => {
    const lastAtIdx = inputMessage.lastIndexOf('@');
    if (lastAtIdx !== -1) {
      const before = inputMessage.slice(0, lastAtIdx);
      const updated = `${before}@${member.role.replace(/\s+/g, '')} `;
      setInputMessage(updated);
    } else {
      setInputMessage(prev => `${prev} @${member.role.replace(/\s+/g, '')} `);
    }
    setShowMentionMenu(false);
    inputRef.current?.focus();
  };

  // Send message to AI Team
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    const currentMsg = inputMessage.trim();
    setInputMessage('');
    setShowMentionMenu(false);

    // Optimistic user bubble
    const optimisticMsg = {
      id: `temp-${Date.now()}`,
      role: 'user',
      sender: {
        name: loggedInUser?.firstName ? `${loggedInUser.firstName} ${loggedInUser.lastName || ''}`.trim() : 'Project Lead',
        role: 'USER'
      },
      content: currentMsg,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setIsLoading(true);

    if (activeChatType === 'direct') {
      setLoadingAgentName(activeMember?.name || 'AI Specialist');
    } else {
      setLoadingAgentName(activeTeam?.name || 'Squad');
    }

    try {
      const res = await api.post('/ai-team/chat', {
        chatType: activeChatType,
        targetId: activeTargetId,
        message: currentMsg,
        anthropicApiKey: anthropicApiKey.trim(),
        selectedModel: selectedGlobalModel,
        discussionMode
      });

      if (res.data?.success && res.data?.history) {
        setMessages(res.data.history);
      }
    } catch (err) {
      console.error('Chat error:', err);
      const errMsg = err.response?.data?.error || err.message || 'Failed to get response from AI team.';
      toast.error(errMsg);
      // Remove optimistic message on complete failure
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
    } finally {
      setIsLoading(false);
      setLoadingAgentName('');
    }
  };

  // Clear conversation
  const handleClearChat = async () => {
    if (!activeTargetId) return;
    if (!window.confirm('Are you sure you want to clear this conversation history?')) return;

    try {
      await api.delete(`/ai-team/conversations/${activeTargetId}`);
      setMessages([]);
      toast.success('Conversation cleared.');
    } catch (err) {
      toast.error('Failed to clear conversation.');
    }
  };

  // Copy message text
  const handleCopyMessage = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(id);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  // Export conversation transcript
  const handleExportChat = () => {
    if (!messages || messages.length === 0) {
      toast('No messages to export');
      return;
    }
    const title = activeChatType === 'team' ? activeTeam?.name : activeMember?.name;
    let transcript = `# ${title} - AI Conversation Transcript\nDate: ${new Date().toLocaleString()}\n\n---\n\n`;

    messages.forEach(m => {
      const senderName = m.role === 'user' ? (m.sender?.name || 'User') : `${m.sender?.name || 'Agent'} (${m.sender?.role || 'AI'})`;
      transcript += `### [${senderName}] - ${new Date(m.timestamp).toLocaleTimeString()}\n\n${m.content}\n\n---\n\n`;
    });

    const blob = new Blob([transcript], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, '-')}-transcript.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Transcript exported!');
  };

  // Avatar upload
  const handleAvatarFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG, JPG, WEBP, or SVG).');
      return;
    }

    const formData = new FormData();
    formData.append('avatar', file);

    setIsUploadingAvatar(true);
    try {
      const res = await api.post('/ai-team/upload-avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.avatarUrl) {
        setMemberForm(prev => ({ ...prev, avatar: res.data.avatarUrl }));
        toast.success('Avatar uploaded successfully!');
      }
    } catch (err) {
      console.error('Avatar upload failed:', err);
      toast.error(err.response?.data?.error || 'Failed to upload avatar image');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Save / Update AI Member
  const handleSaveMember = async (e) => {
    e.preventDefault();
    if (!memberForm.name || !memberForm.role || !memberForm.systemPrompt) {
      toast.error('Name, Role, and System Prompt are required.');
      return;
    }

    try {
      if (editingMember) {
        const res = await api.put(`/ai-team/members/${editingMember.id}`, memberForm);
        if (res.data?.member) {
          setMembers(prev => prev.map(m => m.id === editingMember.id ? res.data.member : m));
          toast.success('AI Member updated!');
        }
      } else {
        const res = await api.post('/ai-team/members', memberForm);
        if (res.data?.member) {
          setMembers(prev => [...prev, res.data.member]);
          toast.success('New AI Member created!');
        }
      }
      setShowMemberModal(false);
      setEditingMember(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save member.');
    }
  };

  // Delete AI Member
  const handleDeleteMember = async (id, e) => {
    e?.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this AI team member?')) return;

    try {
      await api.delete(`/ai-team/members/${id}`);
      setMembers(prev => prev.filter(m => m.id !== id));
      if (activeTargetId === id) {
        if (teams.length > 0) {
          setActiveTargetId(teams[0].id);
          setActiveChatType('team');
        }
      }
      toast.success('AI Member deleted.');
    } catch (err) {
      toast.error('Failed to delete member.');
    }
  };

  // Save / Update Team
  const handleSaveTeam = async (e) => {
    e.preventDefault();
    if (!teamForm.name) {
      toast.error('Team name is required.');
      return;
    }
    if (teamForm.memberIds.length === 0) {
      toast.error('Please assign at least one member to the team.');
      return;
    }

    try {
      if (editingTeam) {
        const res = await api.put(`/ai-team/teams/${editingTeam.id}`, teamForm);
        if (res.data?.team) {
          setTeams(prev => prev.map(t => t.id === editingTeam.id ? res.data.team : t));
          toast.success('Team updated!');
        }
      } else {
        const res = await api.post('/ai-team/teams', teamForm);
        if (res.data?.team) {
          setTeams(prev => [...prev, res.data.team]);
          setActiveTargetId(res.data.team.id);
          setActiveChatType('team');
          toast.success('New Team created!');
        }
      }
      setShowTeamModal(false);
      setEditingTeam(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save team.');
    }
  };

  // Delete Team
  const handleDeleteTeam = async (id, e) => {
    e?.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this team?')) return;

    try {
      await api.delete(`/ai-team/teams/${id}`);
      const remaining = teams.filter(t => t.id !== id);
      setTeams(remaining);
      if (activeTargetId === id && remaining.length > 0) {
        setActiveTargetId(remaining[0].id);
        setActiveChatType('team');
      }
      toast.success('Team deleted.');
    } catch (err) {
      toast.error('Failed to delete team.');
    }
  };

  // Open Edit Member Modal
  const openEditMember = (member, e) => {
    e?.stopPropagation();
    setEditingMember(member);
    setMemberForm({
      name: member.name,
      role: member.role,
      title: member.title || member.role,
      avatar: member.avatar,
      systemPrompt: member.systemPrompt,
      skills: member.skills?.join(', ') || '',
      badgeColor: member.badgeColor || 'violet',
      model: member.model || 'claude-3-7-sonnet',
      temperature: member.temperature || 0.7
    });
    setShowMemberModal(true);
  };

  // Open Edit Team Modal
  const openEditTeam = (team, e) => {
    e?.stopPropagation();
    setEditingTeam(team);
    setTeamForm({
      name: team.name,
      description: team.description || '',
      icon: team.icon || '🚀',
      badgeColor: team.badgeColor || 'indigo',
      memberIds: team.memberIds || []
    });
    setShowTeamModal(true);
  };

  // Prompt starters
  const PROMPT_STARTERS = [
    { label: '🏛️ System Architecture', text: '@TechLead Could you propose a scalable system architecture for an automated student notification and report generator?' },
    { label: '🔒 Security Audit', text: '@CyberSecurity Please audit our JWT authentication, file upload endpoints, and Prisma queries for potential vulnerabilities.' },
    { label: '🎨 Modern UI/UX', text: '@FrontendDev How should we design a clean, responsive analytics dashboard using React 19 and Tailwind CSS?' },
    { label: '⚙️ API & Database Contract', text: '@FrontendDev @BackendDev Please coordinate to design the REST API endpoints and data model for this feature.' },
    { label: '🧪 Test & QA Scenarios', text: '@QAEngineer What edge cases, race conditions, and integration test scenarios should we cover for this release?' }
  ];

  return (
    <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* ======================================================== */}
      {/* LEFT SIDEBAR: Teams & AI Specialists                     */}
      {/* ======================================================== */}
      <aside className="w-80 flex-shrink-0 flex flex-col border-r border-slate-800/80 bg-slate-900/60 backdrop-blur-xl">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-amber-500 p-0.5 shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Sparkles size={18} className="text-amber-400 animate-pulse" />
              </div>
            </div>
            <div>
              <h2 className="font-bold text-sm tracking-wide text-white flex items-center gap-1.5">
                AI Dev Squad
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Claude 3.7
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">Multi-Agent Collaboration Hub</p>
            </div>
          </div>
          <button
            onClick={() => setShowSettingsModal(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition"
            title="Settings & Claude API Key"
          >
            <Settings size={17} />
          </button>
        </div>

        {/* Tab Switcher: Teams vs AI Specialists */}
        <div className="px-3 pt-3">
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-950/70 border border-slate-800/60 rounded-xl">
            <button
              onClick={() => setActiveTab('teams')}
              className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition ${
                activeTab === 'teams'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users size={14} />
              Teams ({teams.length})
            </button>
            <button
              onClick={() => setActiveTab('members')}
              className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition ${
                activeTab === 'members'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Bot size={14} />
              Specialists ({members.length})
            </button>
          </div>
        </div>

        {/* Search & Quick Add */}
        <div className="p-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder={activeTab === 'teams' ? "Search squads..." : "Search specialists..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-800/80 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          {activeTab === 'teams' ? (
            <button
              onClick={() => {
                setEditingTeam(null);
                setTeamForm({
                  name: '',
                  description: '',
                  icon: '🚀',
                  badgeColor: 'indigo',
                  memberIds: members.map(m => m.id)
                });
                setShowTeamModal(true);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-medium flex items-center gap-1 transition"
              title="Create Team"
            >
              <Plus size={14} />
              Team
            </button>
          ) : (
            <button
              onClick={() => {
                setEditingMember(null);
                setMemberForm({
                  name: '',
                  role: '',
                  title: '',
                  avatar: PRESET_AVATARS[0].url,
                  systemPrompt: '',
                  skills: '',
                  badgeColor: 'violet',
                  model: 'claude-3-7-sonnet',
                  temperature: 0.7
                });
                setShowMemberModal(true);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-medium flex items-center gap-1 transition"
              title="Create AI Member"
            >
              <Plus size={14} />
              Member
            </button>
          )}
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto px-2 space-y-1 custom-scrollbar">
          {activeTab === 'teams' ? (
            // TEAMS LIST
            teams
              .filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()))
              .map(team => {
                const isActive = activeChatType === 'team' && activeTargetId === team.id;
                const squadMembers = members.filter(m => team.memberIds?.includes(m.id));

                return (
                  <div
                    key={team.id}
                    onClick={() => handleSelectTeam(team)}
                    className={`group relative flex items-start gap-3 p-2.5 rounded-xl cursor-pointer transition border ${
                      isActive
                        ? 'bg-indigo-950/40 border-indigo-500/40 shadow-sm shadow-indigo-500/10'
                        : 'bg-transparent border-transparent hover:bg-slate-800/40 hover:border-slate-800/60'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-lg flex-shrink-0 shadow-inner">
                      {team.icon || '👥'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className={`text-xs font-semibold truncate ${isActive ? 'text-indigo-300' : 'text-slate-200'}`}>
                          {team.name}
                        </h4>
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition">
                          <button
                            onClick={(e) => openEditTeam(team, e)}
                            className="p-1 hover:text-indigo-300 text-slate-400"
                            title="Edit Team"
                          >
                            <Edit3 size={12} />
                          </button>
                          {!team.isDefault && (
                            <button
                              onClick={(e) => handleDeleteTeam(team.id, e)}
                              className="p-1 hover:text-rose-400 text-slate-400"
                              title="Delete Team"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                        {team.description || `${team.memberIds?.length || 0} members`}
                      </p>

                      {/* Squad Avatars Stack */}
                      <div className="flex items-center -space-x-1.5 mt-2">
                        {squadMembers.slice(0, 5).map(sm => (
                          <img
                            key={sm.id}
                            src={sm.avatar}
                            alt={sm.name}
                            className="w-5 h-5 rounded-full border border-slate-900 object-cover bg-slate-800"
                            title={`${sm.name} (${sm.role})`}
                            onError={(e) => { e.target.src = PRESET_AVATARS[0].url; }}
                          />
                        ))}
                        {squadMembers.length > 5 && (
                          <div className="w-5 h-5 rounded-full bg-slate-800 border border-slate-900 text-[9px] font-bold text-slate-300 flex items-center justify-center">
                            +{squadMembers.length - 5}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
          ) : (
            // MEMBERS LIST (1-on-1 DIRECT)
            members
              .filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()) || m.role.toLowerCase().includes(searchQuery.toLowerCase()))
              .map(member => {
                const isActive = activeChatType === 'direct' && activeTargetId === member.id;
                const badgeStyle = BADGE_COLORS[member.badgeColor] || BADGE_COLORS.violet;

                return (
                  <div
                    key={member.id}
                    onClick={() => handleSelectMember(member)}
                    className={`group relative flex items-start gap-3 p-2.5 rounded-xl cursor-pointer transition border ${
                      isActive
                        ? 'bg-purple-950/40 border-purple-500/40 shadow-sm shadow-purple-500/10'
                        : 'bg-transparent border-transparent hover:bg-slate-800/40 hover:border-slate-800/60'
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <img
                        src={member.avatar}
                        alt={member.name}
                        className="w-10 h-10 rounded-xl object-cover border border-slate-800 bg-slate-900 shadow-inner"
                        onError={(e) => { e.target.src = PRESET_AVATARS[0].url; }}
                      />
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-slate-950 rounded-full" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className={`text-xs font-semibold truncate ${isActive ? 'text-purple-300' : 'text-slate-200'}`}>
                          {member.name}
                        </h4>
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition">
                          <button
                            onClick={(e) => openEditMember(member, e)}
                            className="p-1 hover:text-purple-300 text-slate-400"
                            title="Edit Persona"
                          >
                            <Edit3 size={12} />
                          </button>
                          {!member.isDefault && (
                            <button
                              onClick={(e) => handleDeleteMember(member.id, e)}
                              className="p-1 hover:text-rose-400 text-slate-400"
                              title="Delete Persona"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>

                      <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeStyle.badge}`}>
                        {member.role}
                      </span>

                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {member.skills?.slice(0, 2).map((sk, idx) => (
                          <span key={idx} className="text-[9px] text-slate-400 bg-slate-950/80 px-1.5 py-0.5 rounded border border-slate-800/80">
                            {sk}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })
          )}
        </div>

        {/* Sidebar Footer with Status */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/50 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-slate-300 font-medium">Anthropic Engine Active</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">v1.2</span>
        </div>
      </aside>

      {/* ======================================================== */}
      {/* RIGHT MAIN CHAT AREA                                     */}
      {/* ======================================================== */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-950/90 relative">
        {/* Chat Top Header */}
        <header className="h-16 px-6 border-b border-slate-800/80 bg-slate-900/40 backdrop-blur-md flex items-center justify-between flex-shrink-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            {activeChatType === 'team' ? (
              <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-xl shadow-inner">
                {activeTeam?.icon || '👥'}
              </div>
            ) : (
              <img
                src={activeMember?.avatar}
                alt={activeMember?.name}
                className="w-10 h-10 rounded-xl object-cover border border-slate-800 bg-slate-900 shadow-inner"
                onError={(e) => { e.target.src = PRESET_AVATARS[0].url; }}
              />
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white truncate">
                  {activeChatType === 'team' ? activeTeam?.name : activeMember?.name}
                </h3>
                {activeChatType === 'direct' && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${BADGE_COLORS[activeMember?.badgeColor]?.badge || BADGE_COLORS.violet.badge}`}>
                    {activeMember?.role}
                  </span>
                )}
                {activeChatType === 'team' && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Squad ({activeTeamMembers.length} AI Agents)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 truncate">
                {activeChatType === 'team'
                  ? (activeTeam?.description || 'Collaborative engineering squad')
                  : (activeMember?.title || 'Dedicated 1-on-1 AI Specialist')}
              </p>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-3">
            {activeChatType === 'team' && (
              <div className="hidden md:flex items-center bg-slate-950/80 border border-slate-800/80 rounded-lg p-0.5 text-xs">
                <button
                  onClick={() => setDiscussionMode('smart')}
                  className={`px-2.5 py-1 rounded-md transition font-medium ${
                    discussionMode === 'smart'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Target mentioned agents or Tech Lead"
                >
                  Smart @Mention
                </button>
                <button
                  onClick={() => setDiscussionMode('all')}
                  className={`px-2.5 py-1 rounded-md transition font-medium ${
                    discussionMode === 'all'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Every agent in the squad responds in turn"
                >
                  Roundtable (All)
                </button>
              </div>
            )}

            <button
              onClick={handleExportChat}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition"
              title="Export Conversation (Markdown)"
            >
              <Download size={16} />
            </button>
            <button
              onClick={handleClearChat}
              className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800/60 transition"
              title="Clear Conversation"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </header>

        {/* Chat Message Stream */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500/20 via-purple-500/20 to-amber-500/20 border border-slate-800 flex items-center justify-center text-3xl mb-4 shadow-xl">
                {activeChatType === 'team' ? (activeTeam?.icon || '🚀') : '🤖'}
              </div>
              <h3 className="text-lg font-bold text-white mb-1">
                {activeChatType === 'team'
                  ? `Welcome to ${activeTeam?.name || 'the Squad'}`
                  : `1-on-1 with ${activeMember?.name || 'AI Specialist'}`}
              </h3>
              <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
                {activeChatType === 'team'
                  ? 'Discuss complex full-stack features, assign tasks, or tag specific specialists like @TechLead, @FrontendDev, or @CyberSecurity.'
                  : `${activeMember?.name} is ready to consult with you on ${activeMember?.skills?.join(', ') || activeMember?.role}.`}
              </p>

              {/* Starter Prompt Chips */}
              <div className="w-full max-w-2xl space-y-2">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-left pl-1">
                  Try asking the squad:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {PROMPT_STARTERS.map((ps, idx) => (
                    <button
                      key={idx}
                      onClick={() => setInputMessage(ps.text)}
                      className="text-left p-3 rounded-xl bg-slate-900/60 hover:bg-slate-800/60 border border-slate-800/80 hover:border-indigo-500/40 text-xs text-slate-300 transition group shadow-sm"
                    >
                      <div className="font-semibold text-indigo-300 mb-0.5 group-hover:text-indigo-200">
                        {ps.label}
                      </div>
                      <div className="text-[11px] text-slate-400 line-clamp-1">
                        {ps.text}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              const sender = msg.sender || {};
              const badgeStyle = BADGE_COLORS[sender.badgeColor] || BADGE_COLORS.violet;

              return (
                <div
                  key={msg.id || index}
                  className={`flex gap-3.5 group ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {/* Assistant Avatar */}
                  {!isUser && (
                    <img
                      src={sender.avatar || PRESET_AVATARS[0].url}
                      alt={sender.name}
                      className="w-9 h-9 rounded-xl object-cover border border-slate-800 bg-slate-900 flex-shrink-0 shadow-md mt-0.5"
                      onError={(e) => { e.target.src = PRESET_AVATARS[0].url; }}
                    />
                  )}

                  <div className={`max-w-[85%] md:max-w-[75%] space-y-1.5`}>
                    {/* Message Header (Sender Info & Timestamp) */}
                    <div className={`flex items-center gap-2 text-xs ${isUser ? 'justify-end' : 'justify-start'}`}>
                      {!isUser ? (
                        <>
                          <span className="font-bold text-slate-200 text-xs">{sender.name || 'AI Assistant'}</span>
                          {sender.role && (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeStyle.badge}`}>
                              {sender.role}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="font-semibold text-indigo-400 text-xs">You ({sender.name || 'Project Lead'})</span>
                      )}
                      <span className="text-[10px] text-slate-500">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Message Bubble */}
                    <div
                      className={`relative p-4 rounded-2xl text-xs md:text-sm leading-relaxed shadow-lg ${
                        isUser
                          ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-tr-none'
                          : 'bg-slate-900/90 text-slate-200 border border-slate-800/90 rounded-tl-none'
                      }`}
                    >
                      {isUser ? (
                        <div className="whitespace-pre-wrap font-sans">{msg.content}</div>
                      ) : (
                        <div className="prose prose-invert prose-xs md:prose-sm max-w-none break-words">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              code({ node, inline, className, children, ...props }) {
                                const codeText = String(children).replace(/\n$/, '');
                                return !inline ? (
                                  <div className="relative group/code my-3 rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                                    <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400 font-mono">
                                      <span>Code</span>
                                      <button
                                        onClick={() => handleCopyMessage(msg.id, codeText)}
                                        className="hover:text-white flex items-center gap-1 transition"
                                      >
                                        {copiedMsgId === msg.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                        {copiedMsgId === msg.id ? 'Copied' : 'Copy'}
                                      </button>
                                    </div>
                                    <pre className="p-3 text-xs overflow-x-auto text-emerald-300 font-mono">
                                      <code>{children}</code>
                                    </pre>
                                  </div>
                                ) : (
                                  <code className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 text-xs font-mono" {...props}>
                                    {children}
                                  </code>
                                );
                              }
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      )}

                      {/* Copy Message Action */}
                      <button
                        onClick={() => handleCopyMessage(msg.id, msg.content)}
                        className="absolute bottom-2 right-2 p-1 rounded-md text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition bg-slate-950/60"
                        title="Copy message"
                      >
                        {copiedMsgId === msg.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>

                  {/* User Avatar */}
                  {isUser && (
                    <div className="w-9 h-9 rounded-xl bg-indigo-600 border border-indigo-400/40 flex items-center justify-center font-bold text-white text-xs shadow-md mt-0.5">
                      {loggedInUser?.firstName?.[0] || 'U'}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Thinking / Streaming Indicator */}
          {isLoading && (
            <div className="flex gap-3.5 items-center justify-start">
              <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center animate-pulse">
                <Sparkles size={16} className="text-amber-400" />
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-300 flex items-center gap-2.5">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span>{loadingAgentName} is formulating response...</span>
              </div>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Quick Mention Pills Bar (In Team Chat) */}
        {activeChatType === 'team' && activeTeamMembers.length > 0 && (
          <div className="px-6 py-2 border-t border-slate-800/60 bg-slate-900/30 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1 mr-1">
              <AtSign size={12} /> Tag:
            </span>
            {activeTeamMembers.map(m => (
              <button
                key={m.id}
                onClick={() => insertMention(m)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-950 border border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-950/30 text-slate-300 hover:text-indigo-300 transition flex-shrink-0"
              >
                <img src={m.avatar} alt={m.name} className="w-3.5 h-3.5 rounded-full" onError={(e) => { e.target.src = PRESET_AVATARS[0].url; }} />
                <span>@{m.role.replace(/\s+/g, '')}</span>
              </button>
            ))}
          </div>
        )}

        {/* Input Bar & Mentions Menu */}
        <div className="p-4 px-6 border-t border-slate-800/80 bg-slate-900/50 backdrop-blur-md relative">
          {/* @Mentions Popover */}
          {showMentionMenu && filteredMentionMembers.length > 0 && (
            <div className="absolute bottom-full left-6 mb-2 w-72 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden z-30">
              <div className="p-2 border-b border-slate-800 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Mention Team Specialist
              </div>
              <div className="max-h-48 overflow-y-auto p-1">
                {filteredMentionMembers.map((m, idx) => (
                  <button
                    key={m.id}
                    onClick={() => insertMention(m)}
                    className={`w-full flex items-center gap-2.5 p-2 rounded-lg text-left text-xs transition ${
                      selectedMentionIndex === idx ? 'bg-indigo-600/30 text-indigo-200' : 'hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <img src={m.avatar} alt={m.name} className="w-6 h-6 rounded-lg object-cover" onError={(e) => { e.target.src = PRESET_AVATARS[0].url; }} />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate">{m.name}</div>
                      <div className="text-[10px] text-slate-400 truncate">{m.role}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSendMessage} className="relative flex items-end gap-2">
            <div className="relative flex-1">
              <textarea
                ref={inputRef}
                rows={2}
                value={inputMessage}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={
                  activeChatType === 'team'
                    ? "Assign task to squad, type @ to mention specialists (e.g. @TechLead, @FrontendDev)..."
                    : `Direct message to ${activeMember?.name || 'AI Specialist'} (Enter to send, Shift+Enter for new line)...`
                }
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-xs md:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/70 resize-none custom-scrollbar"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !inputMessage.trim()}
              className="h-12 w-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 text-white flex items-center justify-center transition shadow-lg shadow-indigo-600/20 flex-shrink-0"
              title="Send Message"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </main>

      {/* ======================================================== */}
      {/* MODAL 1: Create / Edit AI Member                         */}
      {/* ======================================================== */}
      {showMemberModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 px-6 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Bot className="text-purple-400" size={18} />
                {editingMember ? 'Edit AI Specialist Persona' : 'Create New AI Specialist'}
              </h3>
              <button onClick={() => setShowMemberModal(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveMember} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Specialist Name</label>
                  <input
                    type="text"
                    required
                    value={memberForm.name}
                    onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                    placeholder="e.g. Alex Vance"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Role / Specialty</label>
                  <input
                    type="text"
                    required
                    value={memberForm.role}
                    onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })}
                    placeholder="e.g. Tech Lead, Cyber Engineer..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Job Title / Focus</label>
                <input
                  type="text"
                  value={memberForm.title}
                  onChange={(e) => setMemberForm({ ...memberForm, title: e.target.value })}
                  placeholder="e.g. Principal Software Architect & DevOps Lead"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Avatar Selection & Upload */}
              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">Profile Image / Avatar</label>
                <div className="flex items-center gap-3">
                  <img
                    src={memberForm.avatar}
                    alt="Preview"
                    className="w-14 h-14 rounded-xl object-cover border border-slate-700 bg-slate-950 shadow"
                    onError={(e) => { e.target.src = PRESET_AVATARS[0].url; }}
                  />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleAvatarFileChange}
                        accept="image/png, image/jpeg, image/webp, image/svg+xml"
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingAvatar}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition"
                      >
                        <Upload size={14} />
                        {isUploadingAvatar ? 'Uploading...' : 'Upload Image File'}
                      </button>
                      <span className="text-[11px] text-slate-500">Max 5MB (PNG/JPG/WEBP)</span>
                    </div>

                    {/* Presets */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 mr-1">Presets:</span>
                      {PRESET_AVATARS.map(pa => (
                        <button
                          key={pa.id}
                          type="button"
                          onClick={() => setMemberForm({ ...memberForm, avatar: pa.url })}
                          className={`w-7 h-7 rounded-lg border overflow-hidden transition ${
                            memberForm.avatar === pa.url ? 'border-purple-500 ring-2 ring-purple-500/30' : 'border-slate-800 opacity-60 hover:opacity-100'
                          }`}
                          title={pa.label}
                        >
                          <img src={pa.url} alt={pa.label} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* System Prompt */}
              <div>
                <label className="block text-slate-400 mb-1 font-medium">
                  System Prompt (Instructions & Persona Definition)
                </label>
                <textarea
                  rows={5}
                  required
                  value={memberForm.systemPrompt}
                  onChange={(e) => setMemberForm({ ...memberForm, systemPrompt: e.target.value })}
                  placeholder="Define the agent's responsibilities, coding style, security boundaries, and architectural guidelines..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-purple-500 font-mono text-xs leading-relaxed"
                />
              </div>

              {/* Skills Tags */}
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Skills (comma-separated)</label>
                <input
                  type="text"
                  value={memberForm.skills}
                  onChange={(e) => setMemberForm({ ...memberForm, skills: e.target.value })}
                  placeholder="React 19, Tailwind CSS, System Architecture, OWASP, Node.js"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Theme & Model Options */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Role Accent Color</label>
                  <select
                    value={memberForm.badgeColor}
                    onChange={(e) => setMemberForm({ ...memberForm, badgeColor: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-purple-500"
                  >
                    <option value="violet">Violet (Tech Lead)</option>
                    <option value="rose">Rose (Cyber Security)</option>
                    <option value="sky">Sky (Frontend)</option>
                    <option value="emerald">Emerald (Backend)</option>
                    <option value="amber">Amber (QA)</option>
                    <option value="indigo">Indigo (Full Stack)</option>
                    <option value="cyan">Cyan (DevOps)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Claude Model</label>
                  <select
                    value={memberForm.model}
                    onChange={(e) => setMemberForm({ ...memberForm, model: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-purple-500"
                  >
                    <option value="claude-3-7-sonnet">Claude 3.7 Sonnet (Hybrid Reasoning)</option>
                    <option value="claude-3-5-sonnet">Claude 3.5 Sonnet (Coding Benchmark)</option>
                    <option value="claude-opus-5">Claude Opus 5 (Most Powerful)</option>
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash (Ultra Fast)</option>
                  </select>
                </div>
              </div>

              <div className="p-4 -mx-6 -mb-6 bg-slate-950/80 border-t border-slate-800 flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setShowMemberModal(false)}
                  className="px-4 py-2 rounded-lg text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-purple-600/20 transition"
                >
                  {editingMember ? 'Update Specialist' : 'Create Specialist'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: Create / Edit Team                              */}
      {/* ======================================================== */}
      {showTeamModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 px-6 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Users className="text-indigo-400" size={18} />
                {editingTeam ? 'Edit Engineering Team' : 'Create New Engineering Team'}
              </h3>
              <button onClick={() => setShowTeamModal(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTeam} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar text-xs">
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-1">
                  <label className="block text-slate-400 mb-1 font-medium">Icon</label>
                  <input
                    type="text"
                    value={teamForm.icon}
                    onChange={(e) => setTeamForm({ ...teamForm, icon: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-center text-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-slate-400 mb-1 font-medium">Team / Squad Name</label>
                  <input
                    type="text"
                    required
                    value={teamForm.name}
                    onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                    placeholder="e.g. Core Engineering Squad"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Description</label>
                <textarea
                  rows={2}
                  value={teamForm.description}
                  onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })}
                  placeholder="Team scope and primary objectives..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Assign Members Checkboxes */}
              <div>
                <label className="block text-slate-400 mb-2 font-medium">Assign AI Specialists to Team</label>
                <div className="space-y-2 max-h-48 overflow-y-auto p-1 bg-slate-950/60 border border-slate-800 rounded-xl">
                  {members.map(m => {
                    const isChecked = teamForm.memberIds.includes(m.id);
                    return (
                      <label
                        key={m.id}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition ${
                          isChecked ? 'bg-indigo-950/40 border border-indigo-500/30' : 'hover:bg-slate-900 border border-transparent'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setTeamForm({ ...teamForm, memberIds: [...teamForm.memberIds, m.id] });
                            } else {
                              setTeamForm({ ...teamForm, memberIds: teamForm.memberIds.filter(id => id !== m.id) });
                            }
                          }}
                          className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                        />
                        <img src={m.avatar} alt={m.name} className="w-6 h-6 rounded-lg object-cover" onError={(e) => { e.target.src = PRESET_AVATARS[0].url; }} />
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-slate-200">{m.name}</div>
                          <div className="text-[10px] text-slate-400">{m.role}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 -mx-6 -mb-6 bg-slate-950/80 border-t border-slate-800 flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setShowTeamModal(false)}
                  className="px-4 py-2 rounded-lg text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold shadow-lg shadow-indigo-600/20 transition"
                >
                  {editingTeam ? 'Update Team' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: Global Settings & Claude API Key                */}
      {/* ======================================================== */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl text-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Settings className="text-amber-400" size={18} />
                AI Team & Claude Configuration
              </h3>
              <button onClick={() => setShowSettingsModal(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-[11px] leading-relaxed">
              💡 By default, the CRM automatically utilizes the system-configured Anthropic API key (<code className="bg-amber-950/80 px-1 py-0.5 rounded text-amber-200">process.env.ANTHROPIC_API_KEY</code>). You can also override or provide a custom key below.
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Direct Anthropic API Key (Optional)</label>
              <input
                type="password"
                placeholder="sk-ant-..."
                value={anthropicApiKey}
                onChange={(e) => {
                  setAnthropicApiKey(e.target.value);
                  localStorage.setItem('anthropic_custom_api_key', e.target.value.trim());
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 font-mono focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Squad Default Model</label>
              <select
                value={selectedGlobalModel}
                onChange={(e) => setSelectedGlobalModel(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="claude-3-7-sonnet">Claude 3.7 Sonnet (Recommended - Hybrid Reasoning)</option>
                <option value="claude-3-5-sonnet">Claude 3.5 Sonnet (Fast & Accurate Coding)</option>
                <option value="claude-opus-5">Claude Opus 5 (1M Context Flagship)</option>
                <option value="gemini-2.5-flash">Gemini 2.5 Flash (Google High-Speed Engine)</option>
              </select>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => {
                  setShowSettingsModal(false);
                  toast.success('Configuration saved.');
                }}
                className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition shadow-lg shadow-amber-500/20"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
