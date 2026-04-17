import React, { useState, useEffect, useRef } from 'react';

// --- Theme & Mock Data ---
const ALIEN_DNA = ['Tetramand_FourArms', 'Galvan_GreyMatter', 'Kineceleran_XLR8', 'Pyronite_Heatblast', 'Petrosapien_Diamondhead', 'Appoplexian_Rath', 'Galvanic_Upgrade'];
const PLANETS = ['PlumberHQ', 'GalvanTechSupport', 'UndertownEats', 'TheNullVoid', 'BellwoodLocals'];

const generateAlias = () => `${ALIEN_DNA[Math.floor(Math.random() * ALIEN_DNA.length)]}_${Math.floor(Math.random() * 9000) + 1000}`;

const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000; 

const canEdit = (timestamp) => {
  if (!timestamp) return false; 
  return (Date.now() - timestamp) < EIGHT_HOURS_MS;
};

const formatTimeLeft = (timestamp) => {
  if (!timestamp) return "";
  const diff = EIGHT_HOURS_MS - (Date.now() - timestamp);
  if (diff <= 0) return "Locked";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
};

const INITIAL_TRANSMISSIONS = [
  {
    id: "post_omi_001", authorAlias: "Plumber_Recruit_Omi", planetCom: "BellwoodLocals",
    content: "Just got my official Plumber badge cleared! Let's see what this network is all about. ✌️✨",
    upvotes: 999, votes: {}, timestamp: Date.now() - 10000000, 
    comments: [{ id: "c_omi_1", authorAlias: "Kineceleran_XLR8_112", text: "Welcome to the grid!", timestamp: Date.now() - 5000000 }],
    image: null 
  },
  {
    id: "post_2", authorAlias: "Kineceleran_XLR8_112", planetCom: "BellwoodLocals",
    content: "TIFU: Tried to run across the Pacific Ocean without checking the friction coils on my hover-boots. Shorted out.",
    upvotes: 412, votes: {}, timestamp: Date.now() - 500000, comments: [],
    image: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=800&q=80" 
  },
  {
    id: "post_1", authorAlias: "Appoplexian_Rath_8832", planetCom: "PlumberHQ",
    content: "LET ME TELL YOU SOMETHING! Appoplexians do NOT need to use 'inside voices' in the mess hall.",
    upvotes: 245, votes: {}, timestamp: Date.now() - 40000000, 
    comments: [{ id: "c1", authorAlias: "Galvan_GreyMatter_001", text: "Property destruction warrants a fine.", timestamp: Date.now() - 39000000 }], 
    image: null
  }
];

// --- Boot Sequence ---
const SplashScreen = ({ onComplete }) => {
  useEffect(() => {
    const t = setTimeout(() => onComplete(), 1500);
    return () => clearTimeout(t);
  }, [onComplete]); 

  return (
    <div className="fixed inset-0 z-[100] bg-[#030407] flex items-center justify-center font-mono">
      <div className="w-32 h-32 bg-cyan-500 rounded-full animate-ping absolute opacity-20 blur-xl"></div>
      <div className="w-16 h-16 border-4 border-cyan-500 rounded-full animate-spin border-t-transparent shadow-[0_0_30px_rgba(6,182,212,0.8)]"></div>
    </div>
  );
};

// --- Main App Component ---
export default function OmninetApp() {
  const [isBooting, setIsBooting] = useState(true);
  const [posts, setPosts] = useState(INITIAL_TRANSMISSIONS);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('feed'); 
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);
  
  // Create Post States
  const [newPost, setNewPost] = useState("");
  const [selectedPlanet, setSelectedPlanet] = useState(PLANETS[0]);
  const [imageString, setImageString] = useState(null);
  const [newCommentText, setNewCommentText] = useState("");
  
  const [isWebcamOpen, setIsWebcamOpen] = useState(false);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false); 
  const videoRef = useRef(null);

  // Edit States
  const [editingPostId, setEditingPostId] = useState(null);
  const [editPostContent, setEditPostContent] = useState("");
  const [editImageString, setEditImageString] = useState(null);
  const [isEditWebcamOpen, setIsEditWebcamOpen] = useState(false);
  const editVideoRef = useRef(null);
  
  const [editingComment, setEditingComment] = useState({ postId: null, commentId: null });
  const [editCommentText, setEditCommentText] = useState("");

  const [currentUserAlias] = useState(() => {
    const saved = localStorage.getItem('omninet_user_alias');
    if (saved) return saved;
    const fresh = generateAlias();
    localStorage.setItem('omninet_user_alias', fresh);
    return fresh;
  });

  // --- API Functions ---
  const fetchPosts = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/posts');
      if (res.ok) {
        const serverPosts = await res.json();
        setPosts(prevPosts => {
          const pendingLocalPosts = prevPosts.filter(p => p.id.toString().startsWith('post_local_'));
          const deduplicatedLocal = pendingLocalPosts.filter(local => 
            !serverPosts.some(server => server.content === local.content && server.authorAlias === local.authorAlias)
          );
          const mockPosts = prevPosts.filter(p => 
            !p.id.toString().startsWith('post_local_') && !serverPosts.some(server => server.id === p.id)
          );
          return [...deduplicatedLocal, ...serverPosts, ...mockPosts];
        });
      }
    } catch (e) { }
  };

  useEffect(() => {
    fetchPosts(); 
    const intervalId = setInterval(fetchPosts, 10000); 
    return () => clearInterval(intervalId);
  }, []);

  // --- Post Interactions ---
  const handleVote = async (id, action) => {
    setPosts(prevPosts => prevPosts.map(p => {
      if (p.id === id) {
        const currentVote = p.votes[currentUserAlias];
        let newUpvotes = p.upvotes;
        const newVotes = { ...p.votes };
        
        if (currentVote === action) { 
          delete newVotes[currentUserAlias]; 
          newUpvotes += (action === 'up' ? -1 : 1); 
        } else { 
          newVotes[currentUserAlias] = action; 
          if (action === 'up') newUpvotes += (currentVote === 'down' ? 2 : 1); 
          if (action === 'down') newUpvotes -= (currentVote === 'up' ? 2 : 1); 
        }
        return { ...p, votes: newVotes, upvotes: newUpvotes };
      }
      return p;
    }));
    try { await fetch(`http://localhost:5000/api/posts/${id}/vote`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, voterAlias: currentUserAlias }) }); } catch (error) {}
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Purge this transmission?")) return;
    setPosts(prevPosts => prevPosts.filter(p => p.id !== id));
    try { await fetch(`http://localhost:5000/api/posts/${id}`, { method: 'DELETE' }); } catch (error) {}
  };

  const startEditPost = (post) => {
    setEditingPostId(post.id);
    setEditPostContent(post.content || "");
    setEditImageString(post.image || null);
    setIsEditWebcamOpen(false);
  };

  const saveEditPost = async (id) => {
    setPosts(prevPosts => prevPosts.map(p => p.id === id ? { ...p, content: editPostContent, image: editImageString } : p));
    setEditingPostId(null);
    stopEditWebcam();
    try { await fetch(`http://localhost:5000/api/posts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: editPostContent, image: editImageString }) }); } catch (error) {}
  };

  const cancelEditPost = () => {
    setEditingPostId(null);
    stopEditWebcam();
  };

  // --- Comment Interactions ---
  const handleAddComment = async (postId) => {
    if (!newCommentText?.trim()) return;
    const newComment = { id: Date.now().toString(), authorAlias: currentUserAlias, text: newCommentText, timestamp: Date.now() };
    setPosts(prevPosts => prevPosts.map(p => p.id === postId ? { ...p, comments: [...(p.comments || []), newComment] } : p));
    try { await fetch(`http://localhost:5000/api/posts/${postId}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newComment) }); } catch (error) {}
    setNewCommentText(""); 
  };

  const handleDeleteComment = async (postId, commentId) => {
    if (!window.confirm("Purge this reply?")) return;
    setPosts(prevPosts => prevPosts.map(p => {
      if (p.id === postId) return { ...p, comments: p.comments.filter(c => c.id !== commentId) };
      return p;
    }));
    try { await fetch(`http://localhost:5000/api/posts/${postId}/comments/${commentId}`, { method: 'DELETE' }); } catch (error) {}
  };

  const startEditComment = (postId, comment) => {
    setEditingComment({ postId, commentId: comment.id });
    setEditCommentText(comment.text || "");
  };

  const saveEditComment = async (postId, commentId) => {
    setPosts(prevPosts => prevPosts.map(p => {
      if (p.id === postId) return { ...p, comments: p.comments.map(c => c.id === commentId ? { ...c, text: editCommentText } : c) };
      return p;
    }));
    setEditingComment({ postId: null, commentId: null });
    try { await fetch(`http://localhost:5000/api/posts/${postId}/comments/${commentId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: editCommentText }) }); } catch (error) {}
  };

  // --- Hardware & Media Functions ---
  const processFile = (file, setter) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setter(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleImageUpload = (e) => { processFile(e.target.files[0], setImageString); e.target.value = null; };
  const handleEditImageUpload = (e) => { processFile(e.target.files[0], setEditImageString); e.target.value = null; };

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files?.length > 0) processFile(e.dataTransfer.files[0], setImageString);
  };

  const startWebcam = async (isEdit = false) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (isEdit) {
        setIsEditWebcamOpen(true);
        setTimeout(() => { if (editVideoRef.current) editVideoRef.current.srcObject = stream; }, 100);
      } else {
        setIsWebcamOpen(true);
        setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 100);
      }
    } catch (err) { alert("Webcam unavailable."); isEdit ? setIsEditWebcamOpen(false) : setIsWebcamOpen(false); }
  };

  const stopWebcam = (isEdit = false) => {
    const ref = isEdit ? editVideoRef : videoRef;
    if (ref.current?.srcObject) {
      ref.current.srcObject.getTracks().forEach(track => track.stop());
    }
    isEdit ? setIsEditWebcamOpen(false) : setIsWebcamOpen(false);
  };

  const capturePhoto = (isEdit = false) => {
    const ref = isEdit ? editVideoRef : videoRef;
    if (ref.current) {
      const canvas = document.createElement('canvas');
      canvas.width = ref.current.videoWidth;
      canvas.height = ref.current.videoHeight;
      canvas.getContext('2d').drawImage(ref.current, 0, 0);
      isEdit ? setEditImageString(canvas.toDataURL('image/jpeg')) : setImageString(canvas.toDataURL('image/jpeg'));
      stopWebcam(isEdit); 
    }
  };

  // --- Core Submit Function ---
  const handleTransmit = async (e) => {
    e.preventDefault(); 
    if (isTransmitting || (!newPost?.trim() && !imageString)) return; 

    setIsTransmitting(true);
    const tempId = `post_local_${Date.now()}`;
    const newTransmission = {
      id: tempId, authorAlias: currentUserAlias, planetCom: selectedPlanet, content: newPost, upvotes: 0, votes: {}, comments: [], image: imageString, timestamp: Date.now()
    };

    setPosts(prevPosts => [newTransmission, ...prevPosts]);
    setNewPost(""); setImageString(null); setSelectedPlanet(PLANETS[0]); setIsPostModalOpen(false); stopWebcam();

    try {
      const response = await fetch('http://localhost:5000/api/posts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newTransmission)
      });
      if (response.ok) {
        const savedServerPost = await response.json();
        setPosts(prevPosts => {
          const alreadyFetched = prevPosts.some(p => p.id === savedServerPost.id && p.id !== tempId);
          if (alreadyFetched) return prevPosts.filter(p => p.id !== tempId);
          return prevPosts.map(p => p.id === tempId ? { ...newTransmission, ...savedServerPost } : p);
        });
        setEditingPostId(prev => prev === tempId ? savedServerPost.id : prev);
      }
    } catch (error) {} finally { setIsTransmitting(false); }
  };

  const displayedPosts = activeTab === 'my_posts' ? posts.filter(p => p.authorAlias === currentUserAlias) : posts;

  return (
    <>
      {isBooting && <SplashScreen onComplete={() => setIsBooting(false)} />}
      
      <div className={`relative min-h-screen font-sans overflow-hidden flex bg-[#030407] text-slate-100 ${isBooting ? 'opacity-0' : 'opacity-100 transition-opacity duration-1000'}`}>
        
        {/* BACKGROUND EFFECTS */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-cyan-600/10 rounded-full blur-[140px] animate-pulse"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-600/10 rounded-full blur-[160px]"></div>
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
        </div>

        <style>{`
          .glass-panel {
            background: rgba(10, 12, 16, 0.65);
            backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.05);
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.4);
          }
        `}</style>

        {/* SIDEBAR */}
        {isSidebarOpen && <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)}></div>}
        <div className={`fixed lg:relative top-0 left-0 h-full w-72 z-50 transform transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] glass-panel ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
          <div className="p-6 flex flex-col h-full border-r border-white/5">
            <div className="flex items-center gap-3 mb-10">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center justify-center">
                <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              </div>
              <h2 className="text-2xl font-black text-white tracking-widest">OMNINET</h2>
            </div>
            <div className="space-y-6 flex-1">
              <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                <p className="text-[10px] uppercase tracking-widest text-cyan-600 font-bold mb-1">DNA Signature</p>
                <div className="font-mono text-sm font-bold text-cyan-400 truncate">{currentUserAlias}</div>
              </div>
              <div className="space-y-2">
                <button onClick={() => { setActiveTab('feed'); setIsSidebarOpen(false); }} className={`w-full text-left flex items-center gap-3 p-3 rounded-xl transition-all font-bold ${activeTab === 'feed' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'hover:bg-white/5 text-slate-400'}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg> Global Network
                </button>
                <button onClick={() => { setActiveTab('my_posts'); setIsSidebarOpen(false); }} className={`w-full text-left flex items-center gap-3 p-3 rounded-xl transition-all font-bold ${activeTab === 'my_posts' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'hover:bg-white/5 text-slate-400'}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg> Personal Logs
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 flex flex-col h-screen overflow-hidden z-10">
          <nav className="h-20 flex items-center px-6 lg:px-10 shrink-0 border-b border-white/5 glass-panel">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-cyan-500 mr-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
            </button>
            <div className="flex-1">
               <h1 className="text-xl font-black text-white">{activeTab === 'feed' ? 'Encryption Feed' : 'My Archive'}</h1>
            </div>
          </nav>

          <main className="flex-1 overflow-y-auto w-full p-4 md:p-8">
            <div className="max-w-3xl mx-auto space-y-8 pb-32">
              {displayedPosts.length === 0 && (
                <div className="text-center py-20 glass-panel rounded-3xl"><span className="font-medium text-slate-500">No transmissions found.</span></div>
              )}

              {displayedPosts.map(post => (
                <article key={post.id} className="glass-panel rounded-3xl overflow-hidden hover:border-cyan-500/30 transition-all duration-500 group">
                  <div className="p-6 md:p-8">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-cyan-500/20 flex items-center justify-center text-cyan-400 font-black text-lg shadow-inner">
                          {post.authorAlias?.charAt(0) || '?'}
                        </div>
                        <div>
                          <span className="font-bold text-white block text-sm md:text-base">{post.authorAlias}</span>
                          <span className="text-[10px] font-mono text-cyan-500 uppercase tracking-widest block mt-1 opacity-80">Sector: p/{post.planetCom}</span>
                        </div>
                      </div>
                      
                      {post.authorAlias === currentUserAlias && (
                        <div className="flex items-center gap-2">
                          {canEdit(post.timestamp) && editingPostId !== post.id && (
                            <button onClick={() => startEditPost(post)} className="text-slate-500 hover:text-cyan-400 transition-colors p-1" title={formatTimeLeft(post.timestamp)}>
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                            </button>
                          )}
                          <button onClick={() => handleDelete(post.id)} className="text-slate-600 hover:text-red-500 transition-colors p-1">
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {editingPostId === post.id ? (
                      <div className="mb-6 space-y-4">
                        <textarea 
                          value={editPostContent || ""} 
                          onChange={(e) => setEditPostContent(e.target.value)}
                          className="w-full bg-black/40 text-white p-4 rounded-xl border border-cyan-500/50 focus:outline-none focus:border-cyan-400 min-h-[100px] resize-none"
                        />
                        {isEditWebcamOpen ? (
                          <div className="relative rounded-2xl overflow-hidden border border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.2)] bg-black">
                            <video ref={editVideoRef} autoPlay playsInline className="w-full h-56 object-cover"></video>
                            <button type="button" onClick={() => capturePhoto(true)} className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-cyan-500 text-black font-black px-6 py-2.5 rounded-full shadow-lg hover:bg-cyan-400 transition-colors">Capture</button>
                          </div>
                        ) : editImageString ? (
                          <div className="relative rounded-2xl overflow-hidden border border-cyan-500/50">
                            <img src={editImageString} alt="Preview" className="max-h-56 w-full object-cover" />
                            <button type="button" onClick={() => setEditImageString(null)} className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full shadow-lg hover:bg-red-500 z-10 cursor-pointer">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                          </div>
                        ) : null}
                        <div className="flex gap-4">
                          <label className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-800 hover:bg-cyan-500/5 hover:border-cyan-500/30 cursor-pointer transition-all text-cyan-500 font-bold text-xs">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg> {editImageString ? 'Change Image' : 'Add Image'}
                            <input type="file" accept="image/*" onChange={handleEditImageUpload} className="hidden" />
                          </label>
                          <button type="button" onClick={() => startWebcam(true)} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-800 hover:bg-cyan-500/5 hover:border-cyan-500/30 transition-all text-cyan-500 font-bold text-xs cursor-pointer">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path></svg> Scan
                          </button>
                        </div>
                        <div className="flex gap-2 justify-end pt-2">
                          <button onClick={cancelEditPost} className="px-4 py-2 text-sm font-bold text-slate-400 hover:text-white transition-colors cursor-pointer">Cancel</button>
                          <button onClick={() => saveEditPost(post.id)} className="px-4 py-2 text-sm font-bold bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition-colors cursor-pointer">Save Override</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-[15px] leading-relaxed text-slate-200 mb-6 whitespace-pre-wrap">{post.content}</p>
                        {post.image && (
                          <div className="mb-6 rounded-2xl overflow-hidden border border-white/5 bg-black">
                            <img src={post.image} alt="Attachment" className="w-full h-auto max-h-[400px] object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-500" loading="lazy" />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  
                  <div className="px-6 md:px-8 py-4 bg-black/30 border-t border-white/5 flex justify-between items-center">
                    <div className="flex gap-4">
                      <button onClick={() => handleVote(post.id, 'up')} className={`flex gap-2 items-center font-bold text-sm transition-colors ${post.votes?.[currentUserAlias] === 'up' ? 'text-cyan-400' : 'text-slate-500 hover:text-cyan-300'}`}>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M4 14h4v7a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-7h4a1.001 1.001 0 0 0 .781-1.625l-8-10c-.381-.475-1.181-.475-1.562 0l-8 10A1.001 1.001 0 0 0 4 14z"/></svg> {post.upvotes}
                      </button>
                      <button onClick={() => handleVote(post.id, 'down')} className={`flex gap-2 items-center font-bold text-sm transition-colors ${post.votes?.[currentUserAlias] === 'down' ? 'text-red-400' : 'text-slate-500 hover:text-red-400'}`}>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20 10h-4V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v7H4a1.001 1.001 0 0 0-.781 1.625l8 10a1 1 0 0 0 1.562 0l8-10A1.001 1.001 0 0 0 20 10z"/></svg>
                      </button>
                    </div>
                    <button onClick={() => setActiveCommentPostId(activeCommentPostId === post.id ? null : post.id)} className="flex gap-2 items-center font-bold text-sm text-slate-500 hover:text-cyan-300 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg> {post.comments?.length || 0} Replies
                    </button>
                  </div>
                  
                  {activeCommentPostId === post.id && (
                    <div className="p-6 md:px-8 bg-black/40 border-t border-white/5">
                      <form onSubmit={(e) => { e.preventDefault(); handleAddComment(post.id); }} className="flex gap-3 mb-6">
                        <input type="text" value={newCommentText || ""} onChange={(e) => setNewCommentText(e.target.value)} placeholder="Encrypt a reply..." className="flex-1 px-5 py-3 rounded-xl bg-black/50 border border-slate-800 text-sm focus:outline-none focus:border-cyan-500/50 text-white" />
                        <button type="submit" className="bg-cyan-600 text-white px-6 rounded-xl text-sm font-bold hover:bg-cyan-500 transition-colors">Send</button>
                      </form>
                      <div className="space-y-4">
                        {post.comments?.map(c => (
                          <div key={c.id} className="relative group/comment p-4 rounded-xl bg-slate-900/50 border border-white/5 inline-block min-w-[50%] max-w-[95%]">
                            <div className="flex justify-between items-start mb-2 gap-4">
                              <span className="font-bold text-xs text-cyan-400">{c.authorAlias}</span>
                              {c.authorAlias === currentUserAlias && (
                                <div className="flex opacity-0 group-hover/comment:opacity-100 transition-opacity gap-2 -mt-1">
                                  {canEdit(c.timestamp) && editingComment.commentId !== c.id && (
                                    <button onClick={() => startEditComment(post.id, c)} className="text-slate-500 hover:text-cyan-400 p-1 cursor-pointer" title={formatTimeLeft(c.timestamp)}>
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                    </button>
                                  )}
                                  <button onClick={() => handleDeleteComment(post.id, c.id)} className="text-slate-600 hover:text-red-500 p-1 cursor-pointer">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                  </button>
                                </div>
                              )}
                            </div>
                            {editingComment.commentId === c.id ? (
                               <div className="flex flex-col gap-2 mt-1">
                                 <input type="text" value={editCommentText || ""} onChange={(e) => setEditCommentText(e.target.value)} className="w-full bg-black/50 border border-cyan-500/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400" />
                                 <div className="flex gap-2 justify-end">
                                   <button onClick={() => setEditingComment({ postId: null, commentId: null })} className="text-xs text-slate-400 hover:text-white cursor-pointer">Cancel</button>
                                   <button onClick={() => saveEditComment(post.id, c.id)} className="text-xs font-bold text-cyan-400 hover:text-cyan-300 cursor-pointer">Save</button>
                                 </div>
                               </div>
                            ) : (<span className="text-sm text-slate-300 whitespace-pre-wrap">{c.text}</span>)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </main>
        </div>

        {/* --- DYNAMIC EXPANDING ACTION BUTTON --- */}
        <button onClick={() => setIsPostModalOpen(true)} className="group fixed bottom-8 right-8 md:bottom-12 md:right-12 flex items-center justify-center bg-[#0a0c10]/80 backdrop-blur-xl border border-cyan-500/30 rounded-full h-16 p-2 shadow-[0_0_30px_rgba(6,182,212,0.15)] z-40 transition-all duration-500 hover:border-cyan-400 hover:shadow-[0_0_40px_rgba(6,182,212,0.4)] hover:bg-cyan-950/40 cursor-pointer">
          <div className="w-12 h-12 flex items-center justify-center rounded-full bg-cyan-500/10 group-hover:bg-cyan-400 text-cyan-400 group-hover:text-black transition-all duration-500 shadow-inner">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
          </div>
          <div className="max-w-0 overflow-hidden opacity-0 group-hover:max-w-[120px] group-hover:opacity-100 group-hover:ml-3 group-hover:mr-4 transition-all duration-500 whitespace-nowrap flex items-center">
             <span className="font-bold tracking-widest uppercase text-sm text-cyan-50">Transmit</span>
          </div>
        </button>

        {/* --- TRANSPARENT GLASS POST CREATION MODAL --- */}
        {isPostModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6">
            <div className="absolute inset-0 bg-[#030407]/80 backdrop-blur-md" onClick={() => { setIsPostModalOpen(false); stopWebcam(false); }}></div>
            
            <div 
              className={`relative w-full max-w-2xl bg-black/30 backdrop-blur-3xl border rounded-3xl overflow-hidden shadow-2xl transform transition-all flex flex-col max-h-[90vh] ${isDragging ? 'border-cyan-400 shadow-[0_0_50px_rgba(6,182,212,0.2)]' : 'border-white/10'}`}
              onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
            >
              <div className="px-6 py-4 flex justify-between items-center border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                  </div>
                  <h3 className="font-bold text-slate-200">Compose Transmission</h3>
                </div>
                <button onClick={() => { setIsPostModalOpen(false); stopWebcam(false); }} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 cursor-pointer">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 flex flex-col">
                <form onSubmit={handleTransmit} className="flex flex-col flex-1 h-full">
                  <textarea 
                    value={newPost || ""} onChange={(e) => setNewPost(e.target.value)} 
                    placeholder="What's happening across the grid?" 
                    className="w-full bg-transparent text-white text-xl md:text-2xl resize-none min-h-[150px] focus:outline-none placeholder-slate-600 font-light" 
                  />
                  <div className="mt-4">
                    {isWebcamOpen ? (
                      <div className="relative rounded-2xl overflow-hidden border border-cyan-500/30 bg-black group">
                        <video ref={videoRef} autoPlay playsInline className="w-full max-h-72 object-cover"></video>
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                           <button type="button" onClick={() => capturePhoto(false)} className="bg-cyan-500 text-black font-bold px-6 py-3 rounded-full hover:bg-cyan-400 transform hover:scale-105 transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] cursor-pointer">Capture Snapshot</button>
                        </div>
                        <button type="button" onClick={() => stopWebcam(false)} className="absolute top-3 right-3 bg-black/50 text-white p-2 rounded-full hover:bg-red-500/80 transition-colors backdrop-blur-md cursor-pointer">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                      </div>
                    ) : imageString ? (
                      <div className="relative rounded-2xl overflow-hidden border border-white/10 group inline-block max-w-full">
                        <img src={imageString} alt="Preview" className="max-h-72 object-cover" />
                        <button type="button" onClick={() => setImageString(null)} className="absolute top-3 right-3 bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-500/80 transition-all backdrop-blur-md shadow-lg cursor-pointer">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                      </div>
                    ) : (
                      isDragging && (
                        <div className="h-32 border-2 border-dashed border-cyan-500/50 rounded-2xl flex items-center justify-center text-cyan-500 bg-cyan-500/5 transition-all">
                          <span className="font-bold flex items-center gap-2"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg> Drop image to attach</span>
                        </div>
                      )
                    )}
                  </div>

                  <div className="flex-1 min-h-[40px]"></div>

                  <div className="pt-4 mt-auto border-t border-white/5 flex flex-wrap gap-4 justify-between items-center">
                    <div className="flex items-center gap-2">
                      <label className="w-10 h-10 flex items-center justify-center rounded-full text-cyan-500 hover:bg-cyan-500/10 cursor-pointer" title="Attach Image">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                        <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                      </label>
                      <button type="button" onClick={() => startWebcam(false)} className="w-10 h-10 flex items-center justify-center rounded-full text-cyan-500 hover:bg-cyan-500/10 cursor-pointer" title="Open Camera">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path></svg>
                      </button>
                    </div>

                    <div className="flex items-center gap-3 ml-auto">
                      <div className="relative">
                         <select value={selectedPlanet} onChange={(e) => setSelectedPlanet(e.target.value)} className="appearance-none bg-black/50 border border-white/10 text-cyan-400 text-sm font-bold py-2.5 pl-4 pr-8 rounded-full focus:outline-none focus:border-cyan-500/50 cursor-pointer">
                           {PLANETS.map(p => <option key={p} value={p} className="bg-[#030407]">p/{p}</option>)}
                         </select>
                         <svg className="w-4 h-4 text-cyan-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      </div>
                      <button type="submit" disabled={isTransmitting || (!newPost?.trim() && !imageString && !isWebcamOpen)} className={`px-6 py-2.5 font-bold rounded-full transition-all flex items-center gap-2 ${isTransmitting || (!newPost?.trim() && !imageString) ? 'bg-white/5 text-slate-500 cursor-not-allowed' : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)] cursor-pointer'}`}>
                        {isTransmitting ? 'Sending...' : 'Transmit'} {!isTransmitting && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}