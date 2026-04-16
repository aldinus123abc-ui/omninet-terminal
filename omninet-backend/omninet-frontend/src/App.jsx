import { useState, useEffect, useRef } from 'react';

// --- Theme & Mock Data ---
const ALIEN_DNA = ['Tetramand_FourArms', 'Galvan_GreyMatter', 'Kineceleran_XLR8', 'Pyronite_Heatblast', 'Petrosapien_Diamondhead', 'Appoplexian_Rath', 'Galvanic_Upgrade'];
const PLANETS = ['PlumberHQ', 'GalvanTechSupport', 'UndertownEats', 'TheNullVoid', 'BellwoodLocals'];

const generateAlias = () => `${ALIEN_DNA[Math.floor(Math.random() * ALIEN_DNA.length)]}_${Math.floor(Math.random() * 9000) + 1000}`;

const INITIAL_TRANSMISSIONS = [
  {
    id: "post_1", authorAlias: "Appoplexian_Rath_8832", planetCom: "PlumberHQ",
    content: "LET ME TELL YOU SOMETHING! Appoplexians do NOT need to use 'inside voices' in the mess hall. AITA for breaking the titanium table?",
    upvotes: 245, votes: {}, comments: [
      { id: "c1", authorAlias: "Galvan_GreyMatter_001", text: "Per Code 84-B, property destruction warrants a 400 Taydenite fine." }
    ], image: null
  },
  {
    id: "post_2", authorAlias: "Kineceleran_XLR8_112", planetCom: "BellwoodLocals",
    content: "TIFU: Tried to run across the Pacific Ocean without checking the friction coils on my hover-boots. Shorted out. Currently stranded. Does Plumber roadside assist cover this?",
    upvotes: 412, votes: {}, comments: [],
    image: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=800&q=80" 
  },
  {
    id: "post_3", authorAlias: "Pyronite_Heatblast_404", planetCom: "MrSmoothyFans",
    content: "PSA: Do NOT order the new 'Arctic Guava' flavor if your core temp runs above 500°C. The cup melted and evaporated before it hit my mouth. Waste of 15 Taydenite.",
    upvotes: 89, votes: {}, comments: [
      { id: "c3", authorAlias: "Kineceleran_XLR8_99", text: "Skill issue. I can down 3 of them before the cup even warms up." }
    ],
    image: "https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=800&q=80" 
  }
];

// --- Boot Sequence ---
const SplashScreen = ({ onComplete }) => {
  useEffect(() => {
    const t = setTimeout(() => onComplete(), 1500);
    return () => clearTimeout(t);
  }, [onComplete]); 
  return (
    <div className="fixed inset-0 z-[100] bg-[#030704] flex items-center justify-center font-mono">
      <div className="w-32 h-32 bg-emerald-500 rounded-full animate-ping absolute opacity-10 blur-xl"></div>
      <div className="w-16 h-16 border-4 border-emerald-500 rounded-full animate-spin border-t-transparent shadow-[0_0_30px_#10b981]"></div>
    </div>
  );
};

// --- Main App Component ---
export default function OmninetApp() {
  const [isBooting, setIsBooting] = useState(true);
  const [posts, setPosts] = useState(INITIAL_TRANSMISSIONS);
  const [theme, setTheme] = useState('dark'); 
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('feed'); 
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);
  
  const [newPost, setNewPost] = useState("");
  const [selectedPlanet, setSelectedPlanet] = useState(PLANETS[0]);
  const [imageString, setImageString] = useState(null);
  const [newCommentText, setNewCommentText] = useState("");
  
  const [isWebcamOpen, setIsWebcamOpen] = useState(false);
  const videoRef = useRef(null);

  const [currentUserAlias] = useState(() => {
    const saved = localStorage.getItem('omninet_user_alias');
    if (saved) return saved;
    const fresh = generateAlias();
    localStorage.setItem('omninet_user_alias', fresh);
    return fresh;
  });

  // --- API Functions (BUG FIXED) ---
  const fetchPosts = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/posts');
      if (res.ok) {
        const data = await res.json();
        // BUG FIX: Merge backend data with mock data so it never disappears!
        const mergedPosts = [...data];
        INITIAL_TRANSMISSIONS.forEach(mockPost => {
          if (!mergedPosts.find(p => p.id === mockPost.id)) {
            mergedPosts.push(mockPost);
          }
        });
        setPosts(mergedPosts);
      }
    } catch (e) { /* Silently use local state */ }
  };

  useEffect(() => {
    fetchPosts(); 
    const intervalId = setInterval(fetchPosts, 5000); 
    return () => clearInterval(intervalId);
  }, []);

  const handleTransmit = async (e) => {
    e.preventDefault();
    if (!newPost.trim() && !imageString) return;
    const transmission = { id: Date.now().toString(), authorAlias: currentUserAlias, planetCom: selectedPlanet, content: newPost, image: imageString, upvotes: 0, votes: {}, comments: [] };
    
    // Optimistic UI update (shows instantly)
    setPosts([transmission, ...posts]);
    
    try {
      await fetch('http://localhost:5000/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(transmission) });
    } catch (error) { console.log("Running in offline mode"); }
    
    setNewPost(""); setImageString(null); setIsPostModalOpen(false);
  };

  const handleVote = async (id, action) => {
    setPosts(posts.map(p => {
      if (p.id === id) {
        const currentVote = p.votes[currentUserAlias];
        let newUpvotes = p.upvotes;
        const newVotes = { ...p.votes };
        if (currentVote === action) { delete newVotes[currentUserAlias]; newUpvotes += (action === 'up' ? -1 : 1); } 
        else { newVotes[currentUserAlias] = action; if (action === 'up') newUpvotes += (currentVote === 'down' ? 2 : 1); if (action === 'down') newUpvotes -= (currentVote === 'up' ? 2 : 1); }
        return { ...p, votes: newVotes, upvotes: newUpvotes };
      }
      return p;
    }));
    try { await fetch(`http://localhost:5000/api/posts/${id}/vote`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, voterAlias: currentUserAlias }) }); } catch (error) {}
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Purge this transmission?")) return;
    setPosts(posts.filter(p => p.id !== id));
    try { await fetch(`http://localhost:5000/api/posts/${id}`, { method: 'DELETE' }); } catch (error) {}
  };

  const handleAddComment = async (postId) => {
    if (!newCommentText.trim()) return;
    setPosts(posts.map(p => {
       if (p.id === postId) return { ...p, comments: [...(p.comments || []), { id: Date.now().toString(), authorAlias: currentUserAlias, text: newCommentText }] };
       return p;
    }));
    try { await fetch(`http://localhost:5000/api/posts/${postId}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ authorAlias: currentUserAlias, text: newCommentText }) }); } catch (error) {}
    setNewCommentText(""); 
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImageString(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const startWebcam = async () => {
    setIsWebcamOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) { alert("Webcam unavailable."); setIsWebcamOpen(false); }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
      setImageString(canvas.toDataURL('image/jpeg'));
      setIsWebcamOpen(false);
    }
  };

  const displayedPosts = activeTab === 'my_posts' ? posts.filter(p => p.authorAlias === currentUserAlias) : posts;

  return (
    <>
      {isBooting && <SplashScreen onComplete={() => setIsBooting(false)} />}
      
      <div className={`relative min-h-screen font-sans overflow-hidden flex bg-[#030704] text-emerald-50 ${isBooting ? 'opacity-0' : 'opacity-100 transition-opacity duration-1000'}`}>
        
        {/* --- 3D BACKGROUND EFFECTS --- */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          {/* Ambient Orbs */}
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-600/20 rounded-full blur-[120px] animate-pulse"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-900/40 rounded-full blur-[150px]"></div>
          
          {/* CSS 3D Perspective Grid */}
          <div className="absolute bottom-0 left-[-50%] w-[200%] h-[60vh] opacity-20" style={{
            backgroundImage: 'linear-gradient(rgba(16, 185, 129, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(16, 185, 129, 0.5) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            transform: 'perspective(500px) rotateX(75deg) translateY(50px) translateZ(-200px)',
            animation: 'gridMove 10s linear infinite',
            maskImage: 'linear-gradient(to top, rgba(0,0,0,1), rgba(0,0,0,0))',
            WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,1), rgba(0,0,0,0))'
          }}></div>
        </div>

        <style>{`
          @keyframes gridMove {
            0% { background-position: 0 0; }
            100% { background-position: 0 40px; }
          }
          .glass-panel {
            background: rgba(6, 20, 10, 0.6);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(16, 185, 129, 0.15);
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.5);
          }
        `}</style>

        {/* --- SIDEBAR --- */}
        {isSidebarOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)}></div>}
        
        <div className={`fixed lg:relative top-0 left-0 h-full w-72 z-50 transform transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] glass-panel ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
          <div className="p-6 flex flex-col h-full">
            <div className="flex items-center gap-3 mb-10">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-700 shadow-[0_0_20px_rgba(16,185,129,0.5)] flex items-center justify-center">
                <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              </div>
              <h2 className="text-2xl font-black text-white tracking-widest">OMNINET</h2>
            </div>
            
            <div className="space-y-6 flex-1">
              <div className="p-4 rounded-2xl bg-black/40 border border-emerald-900/50">
                <p className="text-[10px] uppercase tracking-widest text-emerald-600 font-bold mb-1">DNA Signature</p>
                <div className="font-mono text-sm font-bold text-emerald-400 truncate">{currentUserAlias}</div>
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]"></span> Online
                </div>
              </div>

              <div className="space-y-2">
                <button onClick={() => setActiveTab('feed')} className={`w-full text-left flex items-center gap-3 p-3 rounded-xl transition-all font-bold ${activeTab === 'feed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'hover:bg-white/5 text-gray-400 hover:text-emerald-300'}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                  Global Network
                </button>
                <button onClick={() => setActiveTab('my_posts')} className={`w-full text-left flex items-center gap-3 p-3 rounded-xl transition-all font-bold ${activeTab === 'my_posts' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'hover:bg-white/5 text-gray-400 hover:text-emerald-300'}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                  Personal Logs
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* --- MAIN CONTENT AREA --- */}
        <div className="flex-1 flex flex-col h-screen overflow-hidden z-10">
          
          <nav className="h-20 flex items-center px-6 lg:px-10 shrink-0 border-b border-emerald-900/30 glass-panel">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-emerald-500 mr-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
            </button>
            <div className="flex-1">
               <h1 className="text-xl font-black text-white">{activeTab === 'feed' ? 'Encryption Feed' : 'My Archive'}</h1>
               <p className="text-xs text-emerald-600 font-mono tracking-widest">Sector Routing Active</p>
            </div>
          </nav>

          <main className="flex-1 overflow-y-auto w-full p-4 md:p-8">
            <div className="max-w-3xl mx-auto space-y-8 pb-32">
              
              {displayedPosts.length === 0 && (
                <div className="text-center py-20 glass-panel rounded-3xl">
                  <span className="font-medium text-emerald-700">No transmissions found.</span>
                </div>
              )}

              {displayedPosts.map(post => (
                <article key={post.id} className="glass-panel rounded-3xl overflow-hidden hover:border-emerald-500/40 transition-all duration-500 hover:shadow-[0_10px_40px_rgba(16,185,129,0.15)] group transform hover:-translate-y-1">
                  <div className="p-6 md:p-8">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-950 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-black text-lg">
                          {post.authorAlias.charAt(0)}
                        </div>
                        <div>
                          <span className="font-bold text-white block text-sm md:text-base">{post.authorAlias}</span>
                          <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest block mt-1 opacity-80">Sector: p/{post.planetCom}</span>
                        </div>
                      </div>
                      {post.authorAlias === currentUserAlias && (
                        <button onClick={() => handleDelete(post.id)} className="text-emerald-900 hover:text-red-500 transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                      )}
                    </div>
                    
                    <p className="text-[15px] leading-relaxed text-emerald-50 mb-6">{post.content}</p>
                    
                    {post.image && (
                      <div className="mb-6 rounded-2xl overflow-hidden border border-emerald-500/20 bg-black">
                        <img src={post.image} alt="Attachment" className="w-full h-auto max-h-[400px] object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-500" loading="lazy" />
                      </div>
                    )}
                  </div>
                  
                  <div className="px-6 md:px-8 py-4 bg-black/40 border-t border-emerald-900/30 flex justify-between items-center">
                    <div className="flex gap-4">
                      <button onClick={() => handleVote(post.id, 'up')} className={`flex gap-2 items-center font-bold text-sm transition-colors ${post.votes && post.votes[currentUserAlias] === 'up' ? 'text-emerald-400' : 'text-gray-500 hover:text-emerald-300'}`}>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M4 14h4v7a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-7h4a1.001 1.001 0 0 0 .781-1.625l-8-10c-.381-.475-1.181-.475-1.562 0l-8 10A1.001 1.001 0 0 0 4 14z"/></svg>
                        {post.upvotes}
                      </button>
                      <button onClick={() => handleVote(post.id, 'down')} className={`flex gap-2 items-center font-bold text-sm transition-colors ${post.votes && post.votes[currentUserAlias] === 'down' ? 'text-red-400' : 'text-gray-500 hover:text-red-400'}`}>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20 10h-4V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v7H4a1.001 1.001 0 0 0-.781 1.625l8 10a1 1 0 0 0 1.562 0l8-10A1.001 1.001 0 0 0 20 10z"/></svg>
                      </button>
                    </div>
                    <button onClick={() => setActiveCommentPostId(activeCommentPostId === post.id ? null : post.id)} className="flex gap-2 items-center font-bold text-sm text-gray-400 hover:text-emerald-300 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
                      {post.comments?.length || 0} Replies
                    </button>
                  </div>
                  
                  {activeCommentPostId === post.id && (
                    <div className="p-6 md:px-8 bg-black/60 border-t border-emerald-900/30">
                      <div className="flex gap-3 mb-6">
                        <input type="text" value={newCommentText} onChange={(e) => setNewCommentText(e.target.value)} placeholder="Encrypt a reply..." className="flex-1 px-5 py-3 rounded-xl bg-black/50 border border-emerald-900/50 text-sm focus:outline-none focus:border-emerald-500 transition-colors text-white" />
                        <button onClick={() => handleAddComment(post.id)} className="bg-emerald-600 text-white px-6 rounded-xl text-sm font-bold hover:bg-emerald-500 transition-colors">Send</button>
                      </div>
                      <div className="space-y-4">
                        {post.comments?.map(c => (
                          <div key={c.id} className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-900/30 inline-block min-w-[50%] max-w-[85%]">
                            <span className="font-bold text-xs text-emerald-400 block mb-2">{c.authorAlias}</span>
                            <span className="text-sm opacity-90">{c.text}</span>
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

        {/* --- 3D FLOATING ACTION BUTTON --- */}
        <button 
          onClick={() => setIsPostModalOpen(true)} 
          className="fixed bottom-8 right-8 md:bottom-12 md:right-12 w-16 h-16 bg-gradient-to-tr from-emerald-600 to-emerald-400 text-black rounded-2xl shadow-[0_10px_30px_rgba(16,185,129,0.5)] flex items-center justify-center z-40 transition-all duration-300 hover:scale-110 hover:shadow-[0_0_40px_rgba(16,185,129,0.8)] active:scale-95"
          style={{ transform: 'rotate(-5deg)' }}
        >
          <svg className="w-8 h-8" style={{ transform: 'rotate(5deg)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
        </button>

        {/* --- GLASSMORPHISM POST CREATION MODAL --- */}
        {isPostModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => { setIsPostModalOpen(false); stopWebcam(); }}></div>
            
            <div className="relative w-full max-w-xl glass-panel rounded-3xl overflow-hidden shadow-2xl transform scale-100 transition-transform border border-emerald-500/30">
              <div className="p-6 border-b border-emerald-500/20 flex justify-between items-center bg-black/40">
                <h3 className="font-black text-lg tracking-widest text-emerald-400 uppercase">New Log</h3>
                <button onClick={() => { setIsPostModalOpen(false); stopWebcam(); }} className="text-emerald-700 hover:text-red-500 transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>

              <div className="p-6 max-h-[75vh] overflow-y-auto">
                <form id="post-form" onSubmit={handleTransmit} className="space-y-6">
                  
                  <select value={selectedPlanet} onChange={(e) => setSelectedPlanet(e.target.value)} className="w-full bg-black/50 border border-emerald-900/50 p-4 rounded-xl font-bold text-sm focus:outline-none focus:border-emerald-500 text-emerald-300">
                    {PLANETS.map(p => <option key={p} value={p} className="bg-[#050a06]">Target: {p}</option>)}
                  </select>
                  
                  <textarea 
                    value={newPost} onChange={(e) => setNewPost(e.target.value)} 
                    placeholder="Enter encrypted text..." 
                    className="w-full bg-black/20 text-white text-lg resize-none min-h-[120px] p-4 rounded-xl focus:outline-none border border-transparent focus:border-emerald-500/30 placeholder-emerald-900 transition-all" autoFocus
                  />
                  
                  {isWebcamOpen ? (
                    <div className="relative rounded-2xl overflow-hidden border border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)] bg-black">
                      <video ref={videoRef} autoPlay playsInline className="w-full h-56 object-cover"></video>
                      <button type="button" onClick={capturePhoto} className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-black font-black px-6 py-2.5 rounded-full shadow-lg hover:bg-emerald-400 transition-colors">Capture</button>
                    </div>
                  ) : imageString ? (
                    <div className="relative rounded-2xl overflow-hidden border border-emerald-500/30">
                      <img src={imageString} alt="Preview" className="max-h-56 w-full object-cover" />
                      <button type="button" onClick={() => setImageString(null)} className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full shadow-lg hover:bg-red-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                      </button>
                    </div>
                  ) : null}

                  <div className="flex gap-4 pt-2">
                    <label className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl border border-emerald-900/50 hover:bg-emerald-500/10 hover:border-emerald-500/50 cursor-pointer transition-all text-emerald-500 font-bold text-sm">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg> Attach
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </label>
                    <button type="button" onClick={startWebcam} className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl border border-emerald-900/50 hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-all text-emerald-500 font-bold text-sm">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg> Scan
                    </button>
                  </div>
                  
                  <button form="post-form" type="submit" className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl shadow-lg transition-all tracking-widest uppercase mt-4">
                    Send to Network
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}