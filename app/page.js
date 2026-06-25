'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [activeTab, setActiveTab] = useState('search'); // 'search' or 'upload'
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dbMode, setDbMode] = useState('Local');
  const [aiMode, setAiMode] = useState('Heuristic');
  
  // Search & Filter State
  const [searchSkill, setSearchSkill] = useState('');
  const [minExperience, setMinExperience] = useState('any');
  const [searchLocation, setSearchLocation] = useState('');
  
  // Upload State
  const [uploadQueue, setUploadQueue] = useState([]);
  const [seeding, setSeeding] = useState(false);
  const [seedStatus, setSeedStatus] = useState('');
  
  // Selected Candidate Modal State
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [activePopup, setActivePopup] = useState(null); // 'contact', 'raw', 'scrubbed' or null
  const [selectedResumeTab, setSelectedResumeTab] = useState('scrubbed'); // 'scrubbed' or 'raw'

  const getCategoryClass = (title) => {
    const t = (title || '').toLowerCase();
    if (t.includes('engineer') || t.includes('developer') || t.includes('tech') || t.includes('admin') || t.includes('scientist')) {
      return 'tag-engineering';
    }
    if (t.includes('designer') || t.includes('ux') || t.includes('ui') || t.includes('writer')) {
      return 'tag-design';
    }
    if (t.includes('sales') || t.includes('account') || t.includes('manager') || t.includes('pm') || t.includes('coordinator') || t.includes('ops') || t.includes('analyst')) {
      return 'tag-product-sales';
    }
    return 'tag-general';
  };

  // Fetch candidates from DB
  const fetchCandidates = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/candidates');
      const data = await res.json();
      if (data.success) {
        setCandidates(data.candidates);
        if (data.meta) {
          setDbMode(data.meta.dbMode);
          setAiMode(data.meta.aiMode);
        }
      }
    } catch (err) {
      console.error('Failed to load candidates:', err);
    } finally {
      setLoading(false);
    }
  };

  // Seed database with generated resumes
  const handleSeedData = async () => {
    try {
      setSeeding(true);
      setSeedStatus('Starting seed processor (extracting & parsing 25 resumes)...');
      
      const res = await fetch('/api/seed', {
        method: 'POST'
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to seed database');
      }
      
      setSeedStatus('Seeding complete! Refreshing talent pool...');
      await fetchCandidates();
      
      setTimeout(() => {
        setSeedStatus('');
      }, 3000);
    } catch (err) {
      console.error('Seeding error:', err);
      setSeedStatus(`Error: ${err.message}`);
    } finally {
      setSeeding(false);
    }
  };
  const handleDeleteCandidate = async (e, id) => {
    e.stopPropagation(); // Avoid triggering open modal from click on card
    if (!confirm('Are you sure you want to delete this candidate?')) return;
    
    try {
      const res = await fetch(`/api/candidates?id=${id}`, {
        method: 'DELETE'
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete candidate');
      }
      
      // Update list
      setCandidates(prev => prev.filter(c => c.id !== id));
      if (selectedCandidate && selectedCandidate.id === id) {
        setSelectedCandidate(null);
      }
    } catch (err) {
      console.error('Delete candidate error:', err);
      alert(err.message);
    }
  };

  const handleClearPool = async () => {
    if (!confirm('Are you absolutely sure you want to delete all candidates from the talent pool? This action cannot be undone.')) return;
    
    try {
      const res = await fetch('/api/candidates?id=all', {
        method: 'DELETE'
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to clear talent pool');
      }
      
      setCandidates([]);
      setSelectedCandidate(null);
    } catch (err) {
      console.error('Clear pool error:', err);
      alert(err.message);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  // Handle file selection
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    // Add files to upload queue
    const newItems = files.map(file => ({
      id: Math.random().toString(36).substring(2, 9),
      name: file.name,
      size: (file.size / 1024).toFixed(1) + ' KB',
      status: 'pending', // pending, uploading, extracting, parsing, saving, completed, failed
      progress: 0,
      error: null,
      fileObj: file
    }));

    setUploadQueue(prev => [...newItems, ...prev]);
    
    // Start processing files
    newItems.forEach(item => {
      uploadFile(item);
    });
  };

  // Upload and process a single file
  const uploadFile = async (item) => {
    const updateStatus = (status, progress, extra = {}) => {
      setUploadQueue(prev => 
        prev.map(q => q.id === item.id ? { ...q, status, progress, ...extra } : q)
      );
    };

    try {
      updateStatus('uploading', 10);
      
      const formData = new FormData();
      formData.append('file', item.fileObj);

      updateStatus('extracting', 35);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      updateStatus('parsing', 70);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process resume');
      }

      updateStatus('completed', 100);
      
      // Refresh candidates list
      fetchCandidates();

    } catch (err) {
      console.error('Upload file error:', err);
      updateStatus('failed', 100, { error: err.message || 'An unexpected error occurred' });
    }
  };

  // Filter candidates locally
  const filteredCandidates = candidates.filter(candidate => {
    // Skill filter (supports comma-separated skills matching all, e.g. "python, sql")
    if (searchSkill) {
      const searchTerms = searchSkill
        .split(',')
        .map(term => term.trim().toLowerCase())
        .filter(term => term.length > 0);
      
      if (searchTerms.length > 0) {
        const matchesAll = searchTerms.every(term => 
          candidate.skills.some(skill => skill.toLowerCase().includes(term))
        );
        if (!matchesAll) return false;
      }
    }

    // Experience filter (supports min value and custom ranges/exact matches if minExperience changes)
    if (minExperience !== 'any') {
      const exp = parseFloat(candidate.experience_years) || 0;
      if (minExperience === 'fresher') {
        if (exp > 0) return false;
      } else if (minExperience === '1-3') {
        if (exp < 1 || exp > 3) return false;
      } else if (minExperience === '3-5') {
        if (exp < 3 || exp > 5) return false;
      } else if (minExperience === '5+') {
        if (exp < 5) return false;
      } else {
        const minVal = parseFloat(minExperience);
        if (!isNaN(minVal)) {
          if (exp < minVal) return false;
        }
      }
    }

    // Location filter
    if (searchLocation) {
      const searchVal = searchLocation.toLowerCase().trim();
      const matchesLocation = candidate.location && candidate.location.toLowerCase().includes(searchVal);
      if (!matchesLocation) return false;
    }

    return true;
  });

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 max-w-7xl mx-auto w-full">
      {/* Seeding Status Banner */}
      {seedStatus && (
        <div className="mb-4 p-3 rounded-lg text-xs bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 flex items-center justify-between animate-pulse-slow">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400"></span>
            {seedStatus}
          </span>
        </div>
      )}

      {/* Header Banner */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 pb-6 border-b border-zinc-900">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-[#8b5a2b] via-[#c24641] to-[#32124d] bg-clip-text text-transparent glow-text">
            TALENT POOL SEARCH
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Recruiter Resume Dashboard — Local Privacy-first Scrubbing & AI Parser
          </p>
        </div>
        
        {/* Actions & Status */}
        <div className="flex flex-wrap items-center gap-3">
          {candidates.length === 0 ? (
            <button
              onClick={handleSeedData}
              disabled={seeding}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold btn-vintage-upload disabled:opacity-50 transition-all shadow-md flex items-center gap-1.5"
            >
              {seeding ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent inline-block"></span>
                  Seeding...
                </>
              ) : (
                'Seed 25 Test Resumes'
              )}
            </button>
          ) : (
            <button
              onClick={handleClearPool}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-red-950/45 hover:bg-red-900/60 border border-red-900/30 text-red-200 transition-all shadow-md flex items-center gap-1.5"
            >
              🗑️ Clear Talent Pool
            </button>
          )}

          <div className="flex gap-2 text-xs">
            <span className="px-3 py-1 rounded-full bg-[#19052b]/80 border border-[#32124d]/30 text-zinc-300 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#c24641]"></span>
              DB: <strong>{dbMode}</strong>
            </span>
            <span className="px-3 py-1 rounded-full bg-[#422812]/80 border border-[#8b5a2b]/30 text-zinc-300 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#8b5a2b]"></span>
              AI: <strong>{aiMode}</strong>
            </span>
          </div>
        </div>
      </header>

      {/* Tabs Switcher */}
      <div className="flex gap-2 mb-6 bg-zinc-950/80 p-1.5 rounded-lg w-fit border border-zinc-900">
        <button
          onClick={() => setActiveTab('search')}
          className={`px-5 py-2 rounded-md font-medium text-sm transition-all duration-200 flex items-center gap-2 ${
            activeTab === 'search'
              ? 'btn-vintage-search shadow-lg'
              : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/40'
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Search Talent Pool ({filteredCandidates.length})
        </button>
        <button
          onClick={() => setActiveTab('table')}
          className={`px-5 py-2 rounded-md font-medium text-sm transition-all duration-200 flex items-center gap-2 ${
            activeTab === 'table'
              ? 'btn-vintage-search shadow-lg bg-[#32124d] text-white'
              : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/40'
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Quick Sheet ({filteredCandidates.length})
        </button>
        <button
          onClick={() => setActiveTab('upload')}
          className={`px-5 py-2 rounded-md font-medium text-sm transition-all duration-200 flex items-center gap-2 ${
            activeTab === 'upload'
              ? 'btn-vintage-upload shadow-lg'
              : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/40'
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Upload Resumes
          {uploadQueue.some(item => ['pending', 'uploading', 'extracting', 'parsing'].includes(item.status)) && (
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
          )}
        </button>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col">
        {activeTab === 'table' ? (
          <div className="flex-1 flex flex-col gap-6">
            {/* Filters Row */}
            <div className="search-theme-panel rounded-xl p-5 grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Skill Filter */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400 tracking-wide uppercase">Filter by Skill</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g. React, Python, UI/UX"
                    value={searchSkill}
                    onChange={(e) => setSearchSkill(e.target.value)}
                    className="w-full bg-[#19052b]/50 border border-[#32124d]/40 rounded-lg py-2.5 pl-3 pr-10 text-sm focus:outline-none focus:border-[#c24641] transition-colors placeholder-zinc-655"
                  />
                  {searchSkill && (
                    <button 
                      onClick={() => setSearchSkill('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    >
                      &times;
                    </button>
                  )}
                </div>
              </div>

              {/* Experience Filter */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400 tracking-wide uppercase">
                  Experience Slicer
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={['any', 'fresher', '1-3', '3-5', '5+'].includes(minExperience) ? minExperience : 'custom'}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'custom') {
                        setMinExperience(1);
                      } else {
                        setMinExperience(val);
                      }
                    }}
                    className="bg-[#19052b]/50 border border-[#32124d]/40 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#c24641] text-zinc-300 w-1/2"
                  >
                    <option value="any" className="bg-[#19052b]">Any Experience</option>
                    <option value="fresher" className="bg-[#19052b]">Fresher (0 YOE)</option>
                    <option value="1-3" className="bg-[#19052b]">1 - 3 Years</option>
                    <option value="3-5" className="bg-[#19052b]">3 - 5 Years</option>
                    <option value="5+" className="bg-[#19052b]">5+ Years</option>
                    <option value="custom" className="bg-[#19052b]">Custom Min YOE...</option>
                  </select>

                  {!['any', 'fresher', '1-3', '3-5', '5+'].includes(minExperience) && (
                    <div className="flex items-center gap-1 w-1/2">
                      <input
                        type="number"
                        min="0"
                        max="30"
                        value={minExperience === '' ? '' : minExperience}
                        onChange={(e) => {
                          const val = e.target.value;
                          setMinExperience(val === '' ? '' : Number(val));
                        }}
                        className="bg-[#19052b]/50 border border-[#32124d]/40 rounded-lg py-2 px-2 text-sm focus:outline-none focus:border-[#c24641] text-zinc-355 w-full"
                        placeholder="Min YOE"
                      />
                    </div>
                  )}

                  {minExperience !== 'any' && (
                    <button 
                      onClick={() => setMinExperience('any')}
                      className="text-xs text-[#c24641] hover:text-[#d95550] font-medium whitespace-nowrap px-1"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {/* Location Filter */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400 tracking-wide uppercase">Filter by Location</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g. San Francisco, Remote"
                    value={searchLocation}
                    onChange={(e) => setSearchLocation(e.target.value)}
                    className="w-full bg-[#19052b]/50 border border-[#32124d]/40 rounded-lg py-2.5 pl-3 pr-10 text-sm focus:outline-none focus:border-[#c24641] transition-colors placeholder-zinc-655"
                  />
                  {searchLocation && (
                    <button 
                      onClick={() => setSearchLocation('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    >
                      &times;
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Candidates Table Grid */}
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"></div>
                <span className="text-zinc-400 text-sm">Loading spreadsheet...</span>
              </div>
            ) : filteredCandidates.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-center glass-panel rounded-xl">
                <svg className="h-12 w-12 text-zinc-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <h3 className="text-lg font-medium text-zinc-300">No candidates found</h3>
                <p className="text-zinc-500 text-sm mt-1 max-w-md px-4">
                  We couldn't find matches for the chosen filters. Try relaxing your filters or upload new candidate resumes.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto search-theme-panel rounded-xl border border-[#32124d]/30 shadow-xl">
                <table className="min-w-full divide-y divide-zinc-900/60 text-left text-xs">
                  <thead className="bg-[#19052b]/60 text-zinc-300 uppercase tracking-wider font-bold text-[10px] border-b border-zinc-900">
                    <tr>
                      <th className="px-6 py-4">Name</th>
                      <th className="px-6 py-4">Current Title</th>
                      <th className="px-6 py-4">Experience</th>
                      <th className="px-6 py-4">Location</th>
                      <th className="px-6 py-4">Contact Info</th>
                      <th className="px-6 py-4">Extracted Skills</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900/40 bg-zinc-950/20">
                    {filteredCandidates.map((candidate) => (
                      <tr key={candidate.id} className="hover:bg-[#19052b]/30 transition-all duration-200">
                        <td className="px-6 py-4 font-bold text-[#f6f3eb] whitespace-nowrap">
                          {candidate.name}
                        </td>
                        <td className="px-6 py-4 text-zinc-300 whitespace-nowrap font-medium">
                          {candidate.recent_job_title || 'Generalist'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${getCategoryClass(candidate.recent_job_title)}`}>
                            {candidate.experience_years > 0 ? `${candidate.experience_years} YOE` : 'Entry Level'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-zinc-350 whitespace-nowrap">
                          {candidate.location || 'Remote'}
                        </td>
                        <td className="px-6 py-4 text-zinc-400 space-y-1">
                          {candidate.email && (
                            <div className="text-[#c24641] hover:underline">
                              <a href={`mailto:${candidate.email}`}>✉ {candidate.email}</a>
                            </div>
                          )}
                          {candidate.phone && <div className="text-zinc-300">📞 {candidate.phone}</div>}
                          <div className="flex gap-2 pt-0.5">
                            {candidate.linkedin_url && (
                              <a href={candidate.linkedin_url} target="_blank" rel="noreferrer" className="text-[#c24641] hover:underline font-bold text-[10px]">LinkedIn</a>
                            )}
                            {candidate.github_url && (
                              <a href={candidate.github_url} target="_blank" rel="noreferrer" className="text-[#8b5a2b] hover:underline font-bold text-[10px]">GitHub</a>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 max-w-xs">
                          <div className="flex flex-wrap gap-1">
                            {candidate.skills && candidate.skills.slice(0, 8).map((skill, idx) => (
                              <span key={idx} className="px-2 py-0.5 text-[9px] rounded-md bg-[#19052b]/50 border border-[#32124d]/30 text-zinc-300 font-medium">
                                {skill}
                              </span>
                            ))}
                            {candidate.skills && candidate.skills.length > 8 && (
                              <span className="px-1.5 py-0.5 text-[9px] bg-zinc-900/60 text-zinc-500 rounded border border-zinc-800">
                                +{candidate.skills.length - 8}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap space-x-2">
                          <button
                            onClick={() => {
                              setSelectedCandidate(candidate);
                              setActivePopup('contact');
                            }}
                            className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-md text-[10px] font-bold transition-all"
                          >
                            👤 Info
                          </button>
                          {candidate.resume_url && (
                            <a
                              href={candidate.resume_url}
                              download
                              className="inline-block px-2.5 py-1 bg-[#422812]/50 hover:bg-[#8b5a2b]/35 border border-[#8b5a2b]/30 text-zinc-300 rounded-md text-[10px] font-bold transition-all"
                            >
                              ⬇️ Download
                            </a>
                          )}
                          <button
                            onClick={(e) => handleDeleteCandidate(e, candidate.id)}
                            className="px-2.5 py-1 bg-red-950/20 hover:bg-red-900/40 text-red-300 border border-red-900/30 rounded-md text-[10px] font-bold transition-all"
                          >
                            🗑️ Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : activeTab === 'search' ? (
          <div className="flex-1 flex flex-col gap-6">
            {/* Filters Row */}
            <div className="search-theme-panel rounded-xl p-5 grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Skill Filter */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400 tracking-wide uppercase">Filter by Skill</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g. React, Python, UI/UX"
                    value={searchSkill}
                    onChange={(e) => setSearchSkill(e.target.value)}
                    className="w-full bg-[#19052b]/50 border border-[#32124d]/40 rounded-lg py-2.5 pl-3 pr-10 text-sm focus:outline-none focus:border-[#c24641] transition-colors placeholder-zinc-655"
                  />
                  {searchSkill && (
                    <button 
                      onClick={() => setSearchSkill('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    >
                      &times;
                    </button>
                  )}
                </div>
              </div>

              {/* Experience Filter */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400 tracking-wide uppercase">
                  Experience Slicer
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={['any', 'fresher', '1-3', '3-5', '5+'].includes(minExperience) ? minExperience : 'custom'}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'custom') {
                        setMinExperience(1);
                      } else {
                        setMinExperience(val);
                      }
                    }}
                    className="bg-[#19052b]/50 border border-[#32124d]/40 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#c24641] text-zinc-300 w-1/2"
                  >
                    <option value="any" className="bg-[#19052b]">Any Experience</option>
                    <option value="fresher" className="bg-[#19052b]">Fresher (0 YOE)</option>
                    <option value="1-3" className="bg-[#19052b]">1 - 3 Years</option>
                    <option value="3-5" className="bg-[#19052b]">3 - 5 Years</option>
                    <option value="5+" className="bg-[#19052b]">5+ Years</option>
                    <option value="custom" className="bg-[#19052b]">Custom Min YOE...</option>
                  </select>

                  {!['any', 'fresher', '1-3', '3-5', '5+'].includes(minExperience) && (
                    <div className="flex items-center gap-1 w-1/2">
                      <input
                        type="number"
                        min="0"
                        max="30"
                        value={minExperience === '' ? '' : minExperience}
                        onChange={(e) => {
                          const val = e.target.value;
                          setMinExperience(val === '' ? '' : Number(val));
                        }}
                        className="bg-[#19052b]/50 border border-[#32124d]/40 rounded-lg py-2 px-2 text-sm focus:outline-none focus:border-[#c24641] text-zinc-355 w-full"
                        placeholder="Min YOE"
                      />
                    </div>
                  )}

                  {minExperience !== 'any' && (
                    <button 
                      onClick={() => setMinExperience('any')}
                      className="text-xs text-[#c24641] hover:text-[#d95550] font-medium whitespace-nowrap px-1"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {/* Location Filter */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400 tracking-wide uppercase">Filter by Location</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g. San Francisco, Remote"
                    value={searchLocation}
                    onChange={(e) => setSearchLocation(e.target.value)}
                    className="w-full bg-[#19052b]/50 border border-[#32124d]/40 rounded-lg py-2.5 pl-3 pr-10 text-sm focus:outline-none focus:border-[#c24641] transition-colors placeholder-zinc-655"
                  />
                  {searchLocation && (
                    <button 
                      onClick={() => setSearchLocation('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    >
                      &times;
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Candidates Catalog Grid */}
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"></div>
                <span className="text-zinc-400 text-sm">Loading talent pool...</span>
              </div>
            ) : filteredCandidates.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-center glass-panel rounded-xl">
                <svg className="h-12 w-12 text-zinc-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <h3 className="text-lg font-medium text-zinc-300">No candidates found</h3>
                <p className="text-zinc-500 text-sm mt-1 max-w-md px-4">
                  We couldn't find matches for the chosen filters. Try relaxing your filters or upload new candidate resumes.
                </p>
                {candidates.length === 0 && (
                  <button
                    onClick={() => setActiveTab('upload')}
                    className="mt-4 px-4 py-2 bg-[#c24641] hover:bg-[#d95550] text-[#f6f3eb] text-sm font-semibold rounded-lg transition-colors"
                  >
                    Go to Upload Page
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
                {filteredCandidates.map((candidate) => (
                  <div
                    key={candidate.id}
                    onClick={() => {
                      setSelectedCandidate(candidate);
                      setActivePopup('contact');
                    }}
                    className="search-theme-panel rounded-xl p-5 cursor-pointer flex flex-col justify-between hover:-translate-y-1 duration-300"
                  >
                    <div>
                      {/* Top Meta */}
                      <div className="flex justify-between items-start gap-2 mb-3">
                        <span className={`px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase rounded border ${getCategoryClass(candidate.recent_job_title)}`}>
                          {candidate.experience_years > 0 ? `${candidate.experience_years} YOE` : 'Entry Level'}
                        </span>
                        {candidate.location && (
                          <span className="text-xs text-zinc-450 flex items-center gap-1">
                            <svg className="h-3 w-3 inline text-[#c24641]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {candidate.location}
                          </span>
                        )}
                      </div>

                      {/* Header */}
                      <h3 className="text-lg font-bold text-zinc-100 hover:text-[#c24641] transition-colors line-clamp-1">
                        {candidate.name}
                      </h3>
                      <p className="text-zinc-400 text-sm font-medium line-clamp-1 mb-4">
                        {candidate.recent_job_title || 'Generalist'}
                      </p>

                      {/* Skills Tags */}
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {candidate.skills && candidate.skills.slice(0, 5).map((skill, idx) => (
                          <span
                            key={idx}
                            className={`px-2 py-0.5 text-[11px] rounded-md ${getCategoryClass(candidate.recent_job_title)}`}
                          >
                            {skill}
                          </span>
                        ))}
                        {candidate.skills && candidate.skills.length > 5 && (
                          <span className="px-2 py-0.5 text-xs bg-zinc-900/60 text-zinc-500 rounded-md border border-zinc-800/80">
                            +{candidate.skills.length - 5} more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions and Popups triggers */}
                    <div className="pt-3 border-t border-zinc-900/80 flex flex-col gap-3">
                      {/* Contact Indicators */}
                      <div className="flex justify-between items-center text-zinc-550 text-[10px]">
                        <div className="flex gap-1.5">
                          {candidate.email && <span title="Email available">✉ {candidate.email.includes('[EMAIL]') ? '[Scrubbed]' : 'Yes'}</span>}
                          {candidate.phone && <span title="Phone available">📞 {candidate.phone.includes('[PHONE]') ? '[Scrubbed]' : 'Yes'}</span>}
                        </div>
                        <span className="text-[10px] text-zinc-400 hover:text-zinc-200">Contact & Skills &rarr;</span>
                      </div>
                      
                      {/* View Action buttons */}
                      <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-zinc-900/40">
                        <div className="flex gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCandidate(candidate);
                              setActivePopup('raw');
                            }}
                            className="px-2.5 py-1 text-[10px] font-bold rounded bg-[#422812]/50 hover:bg-[#8b5a2b]/35 border border-[#8b5a2b]/30 text-zinc-300 transition-all flex items-center gap-1"
                            title="View Raw Extract Resume text"
                          >
                            📄 Raw Text
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCandidate(candidate);
                              setActivePopup('scrubbed');
                            }}
                            className="px-2.5 py-1 text-[10px] font-bold rounded bg-[#19052b]/55 hover:bg-[#32124d]/35 border border-[#32124d]/30 text-zinc-300 transition-all flex items-center gap-1"
                            title="View PII Scrubbed Resume text"
                          >
                            🔒 AI View
                          </button>
                        </div>
                        <button
                          onClick={(e) => handleDeleteCandidate(e, candidate.id)}
                          className="text-xs text-zinc-450 hover:text-red-400 p-1 rounded bg-zinc-950/60 hover:bg-zinc-900 border border-zinc-900 transition-colors"
                          title="Delete Candidate"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col lg:flex-row gap-8 animate-fade-in">
            {/* File Dropzone Panel */}
            <div className="lg:w-1/2 flex flex-col gap-6">
              <div className="upload-theme-panel rounded-xl p-8 flex flex-col items-center justify-center text-center border-2 border-dashed border-[#8b5a2b]/30 hover:border-[#8b5a2b]/60 duration-300 relative group min-h-[300px]">
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                
                <div className="h-16 w-16 bg-[#422812]/50 rounded-full flex items-center justify-center border border-[#8b5a2b]/30 mb-4 group-hover:scale-110 group-hover:border-[#c24641]/30 transition-all duration-300">
                  <svg className="h-8 w-8 text-zinc-300 group-hover:text-[#c24641] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                
                <h3 className="text-lg font-bold text-zinc-200">Drag & Drop Resume Files</h3>
                <p className="text-zinc-400 text-sm mt-2 max-w-sm">
                  Support multiple file uploads. Select PDF or Word (DOCX) resumes.
                </p>
                <button className="mt-5 px-6 py-2.5 btn-vintage-upload text-sm font-semibold rounded-lg shadow-lg transition-all z-20 pointer-events-none">
                  Select Files
                </button>
              </div>

              <div className="upload-theme-panel rounded-xl p-5">
                <h4 className="text-sm font-semibold text-zinc-350 mb-2">How It Works (PII Security Pipeline)</h4>
                <ul className="text-xs text-zinc-400 space-y-2.5 list-disc pl-4">
                  <li><strong>Local Text Extraction:</strong> Resumes are parsed right on our server locally using node libraries.</li>
                  <li><strong>PII Extraction & Isolation:</strong> Name, email, phone, and links are extracted locally before scrubbing.</li>
                  <li><strong>Local Scrubbing:</strong> Resume text is scrubbed by replacing contact details with <span className="text-[#c24641] font-mono">[EMAIL]</span>, etc.</li>
                  <li><strong>AI Analysis:</strong> Only scrubbed, anonymous skills/experience text is sent to the AI Model.</li>
                  <li><strong>Safe Storage:</strong> Details are stored in the DB, allowing full search without sharing PII with external AI processors.</li>
                </ul>
              </div>
            </div>

            {/* Upload Queue Progress Panel */}
            <div className="lg:w-1/2 flex flex-col">
              <div className="upload-theme-panel rounded-xl p-5 flex-1 flex flex-col">
                <h3 className="text-base font-bold text-zinc-200 mb-4 flex items-center justify-between border-b border-zinc-900 pb-3">
                  <span>Processing Queue</span>
                  {uploadQueue.length > 0 && (
                    <button 
                      onClick={() => setUploadQueue([])}
                      className="text-xs text-zinc-450 hover:text-zinc-300 font-medium"
                    >
                      Clear Queue
                    </button>
                  )}
                </h3>

                {uploadQueue.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-20 text-center text-zinc-600">
                    <svg className="h-10 w-10 text-zinc-700 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <p className="text-xs">No files currently processing</p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto space-y-4 max-h-[480px] pr-1">
                    {uploadQueue.map((item) => (
                      <div key={item.id} className="p-3 bg-zinc-950/90 border border-zinc-900 rounded-lg flex flex-col gap-2">
                        {/* Queue Header */}
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-semibold text-zinc-200 truncate pr-2">{item.name}</span>
                            <span className="text-[10px] text-zinc-500">{item.size}</span>
                          </div>
                          
                          {/* Status Badge */}
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                            item.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            item.status === 'failed' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                            'bg-[#8b5a2b]/10 text-[#8b5a2b] border border-[#8b5a2b]/20'
                          }`}>
                            {item.status}
                          </span>
                        </div>

                        {/* Status Description */}
                        <div className="text-xs text-zinc-400 flex items-center justify-between">
                          <span>
                            {item.status === 'pending' && 'Queued...'}
                            {item.status === 'uploading' && 'Uploading document...'}
                            {item.status === 'extracting' && 'Extracting text locally...'}
                            {item.status === 'parsing' && 'AI parsing and scrubbing...'}
                            {item.status === 'completed' && 'Resume stored successfully!'}
                            {item.status === 'failed' && (item.error || 'Failed to process')}
                          </span>
                          <span>{item.progress}%</span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 rounded-full ${
                              item.status === 'completed' ? 'bg-emerald-500' :
                              item.status === 'failed' ? 'bg-rose-500' :
                              'bg-[#8b5a2b] animate-pulse-slow'
                            }`}
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
      {/* Module 1: Contact Details & Skills Popup */}
      {selectedCandidate && activePopup === 'contact' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-md animate-fade-in">
          <div className="search-theme-panel w-full max-w-2xl rounded-xl flex flex-col overflow-hidden shadow-2xl border-[#32124d]/60">
            {/* Modal Header */}
            <div className="p-5 border-b border-zinc-900 flex justify-between items-start bg-zinc-950/40">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-black text-[#f6f3eb]">{selectedCandidate.name}</h2>
                  <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${getCategoryClass(selectedCandidate.recent_job_title)}`}>
                    {selectedCandidate.experience_years > 0 ? `${selectedCandidate.experience_years} Years Exp` : 'Entry Level'}
                  </span>
                </div>
                <p className="text-[#c24641] font-medium text-sm mt-0.5">
                  {selectedCandidate.recent_job_title} &bull; {selectedCandidate.location}
                </p>
              </div>
              <button
                onClick={() => { setSelectedCandidate(null); setActivePopup(null); }}
                className="text-zinc-400 hover:text-zinc-200 text-2xl font-semibold leading-none p-1"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex flex-col gap-6 bg-[#0c0810]/95 max-h-[70vh] overflow-y-auto">
              {/* Extracted Contact Info Card */}
              <div className="p-4 bg-[#19052b]/55 border border-[#32124d]/40 rounded-xl flex flex-col gap-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-450 border-b border-zinc-900 pb-2">
                  👤 Extracted Contact Details
                </h3>
                
                <div className="flex flex-col text-sm gap-2">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-zinc-500">Email Address</span>
                    <a href={`mailto:${selectedCandidate.email}`} className="text-[#c24641] hover:underline truncate">
                      {selectedCandidate.email || 'Not extracted'}
                    </a>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[10px] text-zinc-500">Phone Number</span>
                    <span className="text-zinc-300">{selectedCandidate.phone || 'Not extracted'}</span>
                  </div>

                  {selectedCandidate.linkedin_url && (
                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-500">LinkedIn Profile</span>
                      <a 
                        href={selectedCandidate.linkedin_url} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-[#c24641] hover:underline truncate"
                      >
                        {selectedCandidate.linkedin_url}
                      </a>
                    </div>
                  )}

                  {selectedCandidate.github_url && (
                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-500">GitHub Profile</span>
                      <a 
                        href={selectedCandidate.github_url} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-[#8b5a2b] hover:underline truncate"
                      >
                        {selectedCandidate.github_url}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Skills List Card */}
              <div className="p-4 bg-[#19052b]/55 border border-[#32124d]/40 rounded-xl flex flex-col gap-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-450 border-b border-zinc-900 pb-2">
                  🛠️ Extracted Skills ({selectedCandidate.skills?.length || 0})
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {selectedCandidate.skills && selectedCandidate.skills.map((skill, idx) => (
                    <span
                      key={idx}
                      className={`px-2.5 py-1 text-xs rounded-md ${getCategoryClass(selectedCandidate.recent_job_title)}`}
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* Career Breaks Section */}
              {selectedCandidate.career_breaks && selectedCandidate.career_breaks.length > 0 && (
                <div className="p-4 bg-amber-950/20 border border-amber-900/30 rounded-xl flex flex-col gap-3 animate-fade-in">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300/80 border-b border-amber-950/60 pb-2 flex items-center gap-1.5">
                    ⚠️ Career Breaks Detected ({selectedCandidate.career_breaks.length})
                  </h3>
                  <div className="flex flex-col gap-2">
                    {selectedCandidate.career_breaks.map((brk, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-[#1c120c]/60 p-2.5 rounded-lg border border-amber-900/10 text-xs">
                        <div className="text-zinc-300">
                          <span className="font-semibold">{brk.start}</span> to <span className="font-semibold">{brk.end}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-amber-900/35 border border-amber-800/30 text-[10px] text-amber-200 font-bold">
                          {brk.duration}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Modal Footer */}
            <div className="p-4 bg-zinc-950/30 border-t border-zinc-900 flex justify-between items-center">
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    handleDeleteCandidate(e, selectedCandidate.id);
                    setActivePopup(null);
                  }}
                  className="px-4 py-2 bg-red-950/20 hover:bg-red-900/40 text-red-300 border border-red-900/30 rounded-lg text-sm transition-colors flex items-center gap-1.5"
                >
                  🗑️ Delete
                </button>
                {selectedCandidate.resume_url && (
                  <a
                    href={selectedCandidate.resume_url}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-lg text-sm transition-colors flex items-center gap-1.5"
                  >
                    ⬇️ Download Resume
                  </a>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setActivePopup('raw')}
                  className="px-4 py-2 bg-[#422812]/50 hover:bg-[#8b5a2b]/35 border border-[#8b5a2b]/30 rounded-lg text-sm text-zinc-300 transition-colors"
                >
                  📄 Raw Text Screen
                </button>
                <button
                  onClick={() => setActivePopup('scrubbed')}
                  className="px-4 py-2 bg-[#19052b]/55 hover:bg-[#32124d]/35 border border-[#32124d]/30 rounded-lg text-sm text-zinc-300 transition-colors"
                >
                  🔒 AI Text Screen
                </button>
                <button
                  onClick={() => { setSelectedCandidate(null); setActivePopup(null); }}
                  className="px-5 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-sm text-zinc-300 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Module 2: Recruiter View (Raw Text) Popup */}
      {selectedCandidate && activePopup === 'raw' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-md animate-fade-in">
          <div className="search-theme-panel w-full max-w-4xl rounded-xl flex flex-col overflow-hidden shadow-2xl border-[#8b5a2b]/60">
            {/* Modal Header */}
            <div className="p-5 border-b border-zinc-900 flex justify-between items-start bg-zinc-950/40">
              <div>
                <h2 className="text-xl font-black text-[#f6f3eb]">📄 Recruiter View: Raw Resume Text</h2>
                <p className="text-[#8b5a2b] font-medium text-xs mt-0.5">
                  Candidate: {selectedCandidate.name} &bull; Unmodified extraction from source file
                </p>
              </div>
              <button
                onClick={() => { setSelectedCandidate(null); setActivePopup(null); }}
                className="text-zinc-400 hover:text-zinc-200 text-2xl font-semibold leading-none p-1"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 bg-[#0c0810]/95 flex flex-col gap-4">
              <div className="p-4 bg-zinc-950/80 border border-zinc-900 rounded-xl overflow-hidden min-h-[350px] max-h-[50vh] flex flex-col">
                <div className="p-4 overflow-auto font-mono text-[11px] leading-relaxed text-zinc-300 select-text whitespace-pre-wrap flex-1">
                  {selectedCandidate.raw_text}
                </div>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="p-4 bg-zinc-950/30 border-t border-zinc-900 flex justify-between items-center">
              {selectedCandidate.resume_url ? (
                <a
                  href={selectedCandidate.resume_url}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-lg text-sm transition-colors flex items-center gap-2"
                >
                  ⬇️ Download Original Resume
                </a>
              ) : <div />}
              <div className="flex gap-2">
                <button
                  onClick={() => setActivePopup('contact')}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-sm text-zinc-300 transition-colors"
                >
                  👤 Contact & Skills
                </button>
                <button
                  onClick={() => setActivePopup('scrubbed')}
                  className="px-4 py-2 bg-[#19052b]/55 hover:bg-[#32124d]/35 border border-[#32124d]/30 rounded-lg text-sm text-zinc-300 transition-colors"
                >
                  🔒 AI View
                </button>
                <button
                  onClick={() => { setSelectedCandidate(null); setActivePopup(null); }}
                  className="px-5 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-sm text-zinc-300 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Module 3: AI View (Scrubbed Text) Popup */}
      {selectedCandidate && activePopup === 'scrubbed' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-md animate-fade-in">
          <div className="search-theme-panel w-full max-w-4xl rounded-xl flex flex-col overflow-hidden shadow-2xl border-[#32124d]/60">
            {/* Modal Header */}
            <div className="p-5 border-b border-zinc-900 flex justify-between items-start bg-zinc-950/40">
              <div>
                <h2 className="text-xl font-black text-[#f6f3eb]">🔒 AI View: Scrubbed Resume Text (PII Removed)</h2>
                <p className="text-[#c24641] font-medium text-xs mt-0.5">
                  Candidate: {selectedCandidate.name} &bull; Only this text was shared with the AI parser
                </p>
              </div>
              <button
                onClick={() => { setSelectedCandidate(null); setActivePopup(null); }}
                className="text-zinc-400 hover:text-zinc-200 text-2xl font-semibold leading-none p-1"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 bg-[#0c0810]/95 flex flex-col gap-4">
              <div className="p-4 bg-zinc-950/80 border border-zinc-900 rounded-xl overflow-hidden min-h-[350px] max-h-[50vh] flex flex-col">
                <div className="p-4 overflow-auto font-mono text-[11px] leading-relaxed text-zinc-300 select-text whitespace-pre-wrap flex-1">
                  {selectedCandidate.scrubbed_text}
                </div>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="p-4 bg-zinc-950/30 border-t border-zinc-900 flex justify-between items-center">
              <div className="text-xs text-zinc-500 font-semibold italic flex items-center gap-1.5">
                🛡️ All emails, phone numbers, and URLs were replaced with placeholders.
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setActivePopup('contact')}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-sm text-zinc-300 transition-colors"
                >
                  👤 Contact & Skills
                </button>
                <button
                  onClick={() => setActivePopup('raw')}
                  className="px-4 py-2 bg-[#422812]/50 hover:bg-[#8b5a2b]/35 border border-[#8b5a2b]/30 rounded-lg text-sm text-zinc-300 transition-colors"
                >
                  📄 Raw Text
                </button>
                <button
                  onClick={() => { setSelectedCandidate(null); setActivePopup(null); }}
                  className="px-5 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-sm text-zinc-300 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
