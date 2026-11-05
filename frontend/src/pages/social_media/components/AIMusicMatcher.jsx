import React, { useState, useRef } from 'react';
import axios from '../../../api/axios';
import toast from 'react-hot-toast';
import { Music, Wand2, Search, ExternalLink, Copy, Check, Sparkles, RefreshCw, Play, Volume2, Flame, Smile, Film, Layers, Clock, UploadCloud, FileVideo, Loader2 } from 'lucide-react';

export default function AIMusicMatcher() {
  const [scriptText, setScriptText] = useState('');
  const [category, setCategory] = useState('all');
  const [mood, setMood] = useState('auto');
  const [loading, setLoading] = useState(false);
  const [transcribeLoading, setTranscribeLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const fileInputRef = useRef(null);

  const presets = [
    {
      title: "🔥 Class Joke: Apaye Raja",
      text: "api reel ekak hdanwa sir kenekge class ekak video ekak cut karal aragena eke sirgen lamayek prashnayak ahanwa apaye raja wenne pin karalada paw karalda kiyala sir hina wewi kiyanwa eken athi wade mokkda kiyala sir joke ekak karanwa",
      category: "sinhala_classic",
      mood: "funny"
    },
    {
      title: "📚 Exam Stress & Coffee",
      text: "Student studying late at night with 3 cups of coffee, yawning and looking at massive AL chemistry note books with funny hopeless facial expressions",
      category: "trending_reels",
      mood: "funny"
    },
    {
      title: "🎓 Campus Graduation Motivation",
      text: "Slow motion shot of student receiving certificate on stage after working hard for years, emotional victory moment with parents clapping",
      category: "cinematic",
      mood: "motivational"
    },
    {
      title: "😂 Student Fail & Excuse Clip",
      text: "Student giving ridiculous excuses to lecturer for not bringing tutes and homework, funny classroom reaction from batchmates",
      category: "baila_comedy",
      mood: "funny"
    }
  ];

  const categories = [
    { id: 'all', label: '🌐 All Genres' },
    { id: 'sinhala_classic', label: '🇱🇰 Sinhala Classic & Baila' },
    { id: 'trending_reels', label: '⚡ Trending Reels & TikTok' },
    { id: 'cinematic', label: '🎬 Movie / Cinematic Scores' },
    { id: 'instrumental', label: '🎹 Instrumental & Meme Sounds' },
  ];

  const moods = [
    { id: 'auto', label: '✨ Auto Mood' },
    { id: 'funny', label: '😂 Funny / Comedy' },
    { id: 'motivational', label: '🔥 Motivational' },
    { id: 'emotional', label: '💔 Heartbreak / Emotional' },
    { id: 'dramatic', label: '⚡ High Energy / Dramatic' },
  ];

  const handleMediaUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 150 * 1024 * 1024) {
      toast.error('File size exceeds 150MB limit.');
      return;
    }

    try {
      setTranscribeLoading(true);
      toast.loading('LUMI AI is listening to video audio & transcribing spoken dialogue...', { id: 'transcribe' });

      const formData = new FormData();
      formData.append('media', file);

      const token = localStorage.getItem('token');
      const res = await axios.post('/social-media/transcribe-media', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (res.data && res.data.success && res.data.data) {
        const transcriptText = res.data.data.transcript || res.data.data.punchlineSummary || '';
        setScriptText(transcriptText);
        toast.success('Audio Transcribed Successfully!', { id: 'transcribe' });
        
        // Auto-run song matching immediately with the transcribed text!
        if (transcriptText) {
          handleGenerate(transcriptText);
        }
      } else {
        toast.error('Failed to transcribe audio from video.', { id: 'transcribe' });
      }
    } catch (err) {
      console.error('Error uploading/transcribing media:', err);
      toast.error(err.response?.data?.error || 'Failed to transcribe video file.', { id: 'transcribe' });
    } finally {
      setTranscribeLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleGenerate = async (overrideScript = null) => {
    const textToUse = typeof overrideScript === 'string' ? overrideScript : scriptText;
    if (!textToUse.trim()) {
      toast.error('Please enter or upload a video clip script/dialogue.');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.post(
        '/social-media/recommend-music',
        { scriptText: textToUse, category, mood },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data && res.data.success && res.data.data) {
        setResults(res.data.data);
        toast.success('Found matching songs & BGM tracks!');
      } else {
        toast.error('Failed to get song recommendations.');
      }
    } catch (err) {
      console.error('Error generating music recommendations:', err);
      toast.error(err.response?.data?.error || 'Failed to generate song matches.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const loadPreset = (preset) => {
    setScriptText(preset.text);
    setCategory(preset.category);
    setMood(preset.mood);
  };

  return (
    <div className="space-y-6 sm:space-y-8 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-900/40 via-fuchsia-900/30 to-brand-accent/20 border border-purple-500/20 backdrop-blur-2xl rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 md:p-8 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-fuchsia-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-fuchsia-500/20 border border-fuchsia-500/30 text-fuchsia-300 text-xs font-black uppercase tracking-wider mb-3">
              <Sparkles size={14} className="animate-spin" /> LUMI AI Music Matcher
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <Music className="text-fuchsia-400 w-8 h-8 sm:w-10 sm:h-10 shrink-0" /> AI Reel Song & Music Finder
            </h1>
            <p className="text-xs sm:text-sm text-gray-300 mt-2 max-w-2xl leading-relaxed font-medium">
              Paste your video cut script, spoken Sinhala dialogue, or joke punchline. LUMI AI will analyze the mood and list perfect matching Sinhala songs, trending reel audio, lyrics punchlines, and YouTube direct preview links!
            </p>
          </div>
        </div>
      </div>

      {/* Preset Buttons */}
      <div className="space-y-2">
        <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 pl-1">
          <Flame size={14} className="text-amber-400" /> Try Quick Preset Examples:
        </span>
        <div className="flex overflow-x-auto custom-scrollbar gap-2.5 pb-2">
          {presets.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => loadPreset(preset)}
              className="bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 hover:border-fuchsia-500/40 outline-none"
            >
              {preset.title}
            </button>
          ))}
        </div>
      </div>

      {/* Input Section */}
      <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 md:p-8 space-y-6 shadow-2xl">
        
        {/* VIDEO/AUDIO FILE UPLOADER */}
        <div className="bg-black/30 border-2 border-dashed border-fuchsia-500/30 hover:border-fuchsia-500/60 rounded-2xl p-4 sm:p-6 transition-all text-center relative overflow-hidden group">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleMediaUpload}
            accept="video/*,audio/*"
            disabled={transcribeLoading}
            className="absolute inset-0 opacity-0 cursor-pointer z-10"
          />
          <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
            {transcribeLoading ? (
              <>
                <Loader2 size={36} className="text-fuchsia-400 animate-spin mb-1" />
                <p className="text-xs sm:text-sm font-extrabold text-fuchsia-300">
                  LUMI AI is listening to video audio & transcribing spoken dialogue...
                </p>
                <p className="text-[10px] text-gray-400">Analyzing Sinhala / Singlish speech using Gemini Speech Recognition</p>
              </>
            ) : (
              <>
                <div className="p-3 bg-fuchsia-500/10 rounded-2xl border border-fuchsia-500/20 text-fuchsia-400 group-hover:scale-110 transition-transform">
                  <UploadCloud size={28} />
                </div>
                <h4 className="text-xs sm:text-sm font-extrabold text-white">
                  Upload Video / Audio Clip (.mp4, .mov, .mp3, .wav)
                </h4>
                <p className="text-[10px] sm:text-xs text-gray-400 font-medium">
                  Drop your video clip here & LUMI AI will automatically transcribe the speech and find matching songs!
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="h-[1px] bg-white/10 flex-1" />
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">OR Type / Edit Script Below</span>
          <div className="h-[1px] bg-white/10 flex-1" />
        </div>

        <div>
          <label className="text-xs sm:text-sm font-extrabold text-white uppercase tracking-wider mb-2.5 block flex items-center gap-2">
            <Film size={16} className="text-fuchsia-400" /> Video Script / Spoken Dialogue / Reel Clip Description *
          </label>
          <textarea
            value={scriptText}
            onChange={(e) => setScriptText(e.target.value)}
            rows={4}
            placeholder="Paste your video dialogue or topic script here... (e.g., 'Sirgen lamayek prashnayak ahanwa apaye raja wenne pin karalada paw karalda kiyala sir hina wewi joke ekak karanwa...')"
            className="w-full bg-black/60 border border-white/10 focus:border-fuchsia-500 focus:bg-black/80 rounded-xl sm:rounded-2xl p-4 text-white text-xs sm:text-sm placeholder-gray-500 outline-none shadow-inner transition-all leading-relaxed custom-scrollbar"
          />
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 pt-2">
          {/* Category Filter */}
          <div>
            <label className="text-xs font-bold text-gray-400 mb-2 block uppercase tracking-wider">Music Category Filter</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`p-3 rounded-xl border text-xs font-bold transition-all text-left truncate outline-none ${
                    category === cat.id
                      ? 'bg-fuchsia-500/20 border-fuchsia-500 text-fuchsia-300 shadow-[0_0_15px_rgba(217,70,239,0.3)]'
                      : 'bg-black/40 border-white/10 text-gray-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mood Filter */}
          <div>
            <label className="text-xs font-bold text-gray-400 mb-2 block uppercase tracking-wider">Video Mood Filter</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {moods.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMood(m.id)}
                  className={`p-3 rounded-xl border text-xs font-bold transition-all text-left truncate outline-none ${
                    mood === m.id
                      ? 'bg-purple-500/20 border-purple-500 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                      : 'bg-black/40 border-white/10 text-gray-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={loading || !scriptText.trim()}
          className="w-full bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white py-4 rounded-xl sm:rounded-2xl font-extrabold text-sm sm:text-base uppercase tracking-wider flex items-center justify-center gap-3 transition-all shadow-[0_4px_25px_rgba(217,70,239,0.4)] disabled:opacity-50 outline-none border border-transparent"
        >
          {loading ? (
            <>
              <RefreshCw className="animate-spin" size={20} /> LUMI AI is Analyzing Script & Matching Music...
            </>
          ) : (
            <>
              <Wand2 size={20} /> Find Matching Songs & BGM Tracks 🎵
            </>
          )}
        </button>
      </div>

      {/* Results Section */}
      {results && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Analysis Summary */}
          <div className="bg-black/30 border border-white/10 rounded-2xl p-4 sm:p-6 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3">
              <span className="text-xs font-extrabold uppercase tracking-wider text-fuchsia-400 flex items-center gap-2">
                <Sparkles size={16} /> AI Script Analysis
              </span>
              <div className="flex flex-wrap gap-1.5">
                {results.keywords?.map((kw, i) => (
                  <span key={i} className="text-[10px] font-black uppercase tracking-wider bg-fuchsia-500/10 text-fuchsia-300 px-2.5 py-1 rounded-md border border-fuchsia-500/20">
                    #{kw}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
              {results.summary}
            </p>
          </div>

          {/* Recommendations Header */}
          <div className="flex items-center justify-between pl-1">
            <h3 className="text-base sm:text-xl font-extrabold text-white flex items-center gap-2">
              <Volume2 className="text-fuchsia-400" size={22} /> Recommended Song & BGM Matches ({results.recommendations?.length || 0})
            </h3>
          </div>

          {/* Song Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {results.recommendations?.map((rec, idx) => (
              <div
                key={idx}
                className="bg-white/[0.04] backdrop-blur-2xl hover:border-fuchsia-500/40 border border-white/10 rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 flex flex-col justify-between gap-4 transition-all shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:shadow-xl relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-24 h-24 blur-[40px] opacity-10 pointer-events-none rounded-full bg-fuchsia-500 group-hover:opacity-30 transition-opacity" />

                <div className="space-y-3 relative z-10">
                  {/* Top Category Tag & Index */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest bg-fuchsia-500/10 text-fuchsia-300 px-2.5 py-1 rounded-lg border border-fuchsia-500/20">
                      {rec.category || 'Music Track'}
                    </span>
                    <span className="text-[10px] font-black text-gray-400">Match #{idx + 1}</span>
                  </div>

                  {/* Song Title & Artist */}
                  <div>
                    <h4 className="text-base sm:text-lg font-extrabold text-white group-hover:text-fuchsia-300 transition-colors drop-shadow-sm">
                      {rec.songTitle}
                    </h4>
                    {rec.artist && <p className="text-xs font-bold text-gray-400 mt-0.5">{rec.artist}</p>}
                  </div>

                  {/* Catchy Lyric Snippet Box */}
                  {rec.lyricsSnippet && (
                    <div className="bg-black/40 border border-white/10 rounded-xl p-3 space-y-1">
                      <span className="text-[9px] font-black uppercase tracking-widest text-fuchsia-400 block">
                        Matching Lyrics Punchline:
                      </span>
                      <p className="text-xs sm:text-sm font-extrabold text-amber-300 italic">
                        "{rec.lyricsSnippet}"
                      </p>
                    </div>
                  )}

                  {/* Match Reason */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Why it matches:</span>
                    <p className="text-xs text-slate-300 font-medium leading-relaxed">
                      {rec.matchReason}
                    </p>
                  </div>

                  {/* Audio Entry Timing Advice */}
                  {rec.suggestedBgmTiming && (
                    <div className="bg-fuchsia-500/5 border border-fuchsia-500/20 rounded-xl p-2.5 flex items-center gap-2 text-xs font-bold text-fuchsia-200">
                      <Clock size={14} className="text-fuchsia-400 shrink-0" />
                      <span>{rec.suggestedBgmTiming}</span>
                    </div>
                  )}
                </div>

                {/* Card Footer Action Buttons */}
                <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 relative z-10 mt-2">
                  {/* YouTube Direct Search Button */}
                  <a
                    href={rec.youtubeSearchUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 bg-red-600/90 hover:bg-red-600 text-white py-2.5 px-3 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-[0_4px_15px_rgba(220,38,38,0.4)] outline-none border border-transparent"
                  >
                    <ExternalLink size={14} /> Listen on YouTube
                  </a>

                  {/* Copy Song Title */}
                  <button
                    onClick={() => handleCopy(rec.songTitle, `title-${idx}`)}
                    className="bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white p-2.5 rounded-xl border border-white/10 transition-colors text-xs font-bold flex items-center gap-1 outline-none"
                    title="Copy Song Name"
                  >
                    {copiedId === `title-${idx}` ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                  </button>

                  {/* Copy Lyric Line */}
                  {rec.lyricsSnippet && (
                    <button
                      onClick={() => handleCopy(rec.lyricsSnippet, `lyric-${idx}`)}
                      className="bg-white/5 hover:bg-white/10 text-amber-300 hover:text-white p-2.5 rounded-xl border border-white/10 transition-colors text-xs font-bold flex items-center gap-1 outline-none"
                      title="Copy Lyric Punchline"
                    >
                      {copiedId === `lyric-${idx}` ? <Check size={16} className="text-green-400" /> : <Smile size={16} />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
