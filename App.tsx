import React, { useState, useRef, useEffect } from 'react';
import { AspectRatio, Resolution, GenerationMode, GeneratedAsset, ApiCredentials, MotionStrength, ContextImage, ContextRole, AppMode, ImageModel, AssetType, VideoModel } from './types';
import { ASPECT_RATIOS, IMAGE_RESOLUTIONS, IMAGE_MODELS, MODEL_IMAGE_BASE, VIDEO_MODELS } from './constants';
import { fileToDataUrl, urlToFile, createThumbnail } from './services/apiClient';
import { enhancePromptWithMotion } from './services/directorService';
import { Upload, Wand2, Image as ImageIcon, Loader2, Rewind, FastForward, Download, Settings, Trash2, Plus, XCircle, Minimize2, Move, Video, Zap, FileText, RefreshCw, Copy, Clapperboard, User, Mountain, Palette, Shirt, Sparkles, Play, Mic, Filter } from 'lucide-react';
import ApiKeyModal from './components/ApiKeyModal';
import ImageViewer from './components/ImageViewer';
import CreativeMode from './components/CreativeMode';
import VideoMode from './components/VideoMode';
import TTSMode from './components/TTSMode';
import FloatingChat from './components/FloatingChat/FloatingChat';

const getModelLabel = (modelValue: string | undefined) => {
    if (!modelValue) return '';
    const imgModel = IMAGE_MODELS.find(m => m.value === modelValue);
    if (imgModel) return imgModel.label;
    const vidModel = VIDEO_MODELS.find(m => m.value === modelValue);
    if (vidModel) return vidModel.label;
    return modelValue;
};

const getAspectRatioClass = (ratio: string | undefined) => {
    if (!ratio) return 'aspect-video';
    switch (ratio) {
        case '16:9': return 'aspect-video';
        case '9:16': return 'aspect-[9/16]';
        case '1:1': return 'aspect-square';
        case '4:3': return 'aspect-[4/3]';
        case '3:4': return 'aspect-[3/4]';
        case '21:9': return 'aspect-[21/9]';
        default: return 'aspect-video';
    }
};

export default function App() {
  const [credentials, setCredentials] = useState<ApiCredentials | null>(null);
  
  // App Mode State
  const [appMode, setAppMode] = useState<AppMode>(AppMode.DIRECTOR);

  // --- DIRECTOR MODE STATE ---
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState(5);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.R_16_9);
  const [resolution, setResolution] = useState<Resolution>(Resolution.RES_2K);
  const [selectedModel, setSelectedModel] = useState<ImageModel>(MODEL_IMAGE_BASE as ImageModel);
  const [generationCount, setGenerationCount] = useState(1);
  const [mode, setMode] = useState<GenerationMode>(GenerationMode.FIRST_TO_LAST);
  const [motionStrength, setMotionStrength] = useState<MotionStrength>(MotionStrength.MEDIUM);
  
  const [refFile, setRefFile] = useState<File | null>(null);
  const [refPreview, setRefPreview] = useState<string | null>(null);
  const [contextImages, setContextImages] = useState<ContextImage[]>([]);

  const [optimizedPrompt, setOptimizedPrompt] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showScriptEditor, setShowScriptEditor] = useState(false);
  // ---------------------------

  // Shared Output State
  const [isRendering, setIsRendering] = useState(false);
  const [generatingCount, setGeneratingCount] = useState(0); 
  const [statusMessage, setStatusMessage] = useState('');
  const [results, setResults] = useState<GeneratedAsset[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(true);
  const [assetFilter, setAssetFilter] = useState<'all' | AssetType>('all');
  
  // Logo Error State
  const [logoError, setLogoError] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState<string | null>(null);
  
  // Prevent accidental data loss on refresh/close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (results.length > 0) {
        const message = "Bạn có dữ liệu trong thư viện chưa lưu. Nếu tải lại hoặc đóng trang, dữ liệu này sẽ bị mất. Bạn có chắc chắn muốn rời đi?";
        e.preventDefault();
        e.returnValue = message;
        return message;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [results.length]);

  useEffect(() => {
    // Director Mode now uses ImageModel.
    // Adjust count if model doesn't support batching
    const maxCount = 4;
    if (generationCount > maxCount) {
        setGenerationCount(maxCount);
    }

    // Resolution constraints for seedream-5-0
    if (selectedModel === ImageModel.SEEDREAM_5_0 && resolution === Resolution.RES_4K) {
        setResolution(Resolution.RES_2K);
    }
  }, [selectedModel, resolution, generationCount]);

  const refInputRef = useRef<HTMLInputElement>(null);
  const ctxInputRef = useRef<HTMLInputElement>(null);

  const handleAssetGenerated = (asset: GeneratedAsset) => {
    setResults(prev => {
      // If it's a real asset, check if there's a pending one with the same prompt
      if (!asset.metadata?.isPending) {
        const pendingIndex = prev.findIndex(a => a.metadata?.isPending && a.prompt === asset.prompt);
        if (pendingIndex !== -1) {
          const newResults = [...prev];
          newResults[pendingIndex] = asset;
          return newResults;
        }
      }
      return [asset, ...prev];
    });
  };

  const handleCredentials = (creds: ApiCredentials) => {
    setCredentials(creds);
    setShowLogin(false);
  };

  // --- DIRECTOR HANDLERS ---
  const handleRefUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setRefFile(file);
      setRefPreview(URL.createObjectURL(file as Blob));
      setOptimizedPrompt('');
      setShowScriptEditor(false);
    }
  };

  const handleCtxUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles: File[] = Array.from(e.target.files);
      const newImages: ContextImage[] = newFiles.map(file => ({
        id: Math.random().toString(36).substring(7),
        file,
        preview: URL.createObjectURL(file),
        role: ContextRole.GENERAL 
      }));
      setContextImages(prev => [...prev, ...newImages]);
    }
    if (ctxInputRef.current) ctxInputRef.current.value = '';
  };

  const updateContextRole = (id: string, newRole: ContextRole) => {
    setContextImages(prev => prev.map(img => 
        img.id === id ? { ...img, role: newRole } : img
    ));
  };

  const removeContextImage = (id: string) => {
    setContextImages(prev => prev.filter(img => img.id !== id));
  };

  const handleDrop = async (e: React.DragEvent, target: 'ref' | 'ctx') => {
    e.preventDefault();
    setIsDraggingOver(null);
    
    // 1. Handle OS Files (Multiple)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        if (target === 'ref') {
            const file = e.dataTransfer.files[0];
            setRefFile(file);
            setRefPreview(URL.createObjectURL(file));
        } else {
            const newFiles = Array.from(e.dataTransfer.files) as File[];
            const newImages = newFiles.map(file => ({
                id: Math.random().toString(36).substring(7),
                file,
                preview: URL.createObjectURL(file),
                role: ContextRole.GENERAL 
            }));
            setContextImages(prev => [...prev, ...newImages]);
        }
        return;
    }

    // 2. Handle Gallery URLs (Multiple)
    let urls: string[] = [];
    
    if ((window as any).__draggedAssetUrl) {
        urls = [(window as any).__draggedAssetUrl];
    } else {
        const uriList = e.dataTransfer.getData('text/uri-list');
        const plainText = e.dataTransfer.getData('text/plain');
        const html = e.dataTransfer.getData('text/html');

        if (uriList) {
            urls = uriList.split(/\r?\n/).filter(u => u && !u.startsWith('#'));
        } 
        
        if (urls.length === 0 && plainText && plainText !== 'internal-drag') {
            urls = [plainText];
        } 
        
        if (urls.length === 0 && html) {
            const match = html.match(/src="([^"]+)"/);
            if (match && match[1]) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = match[1];
                urls = [tempDiv.textContent || tempDiv.innerText || match[1]];
            }
        }
    }

    // Filter out non-image/video URLs if possible, or just try to process them
    urls = urls.filter(u => u.startsWith('http') || u.startsWith('data:'));

    if (urls.length > 0) {
        try {
            // Process URLs one by one to avoid failing all if one fails
            const processedFiles: { file: File, url: string }[] = [];
            
            for (const url of urls) {
                try {
                    const file = await urlToFile(url, "gallery_asset.png");
                    processedFiles.push({ file, url });
                } catch (err) {
                    console.warn(`Failed to load ${url}`, err);
                }
            }

            if (processedFiles.length === 0) return;

            if (target === 'ref') {
                // Only take the first one for Ref
                const { file, url } = processedFiles[0];
                setRefFile(file);
                setRefPreview(url);
            } else {
                // Take all for Context
                const newImages = processedFiles.map(({ file, url }) => ({
                    id: Math.random().toString(36).substring(7),
                    file,
                    preview: url,
                    role: ContextRole.GENERAL
                }));
                setContextImages(prev => [...prev, ...newImages]);
            }
        } catch (err) {
            console.error("Failed to process dropped assets", err);
        }
    }
  };

  const handleStopWaiting = () => {
    setIsRendering(false);
    setStatusMessage("Đã ẩn trạng thái chờ. Các ảnh đang tạo sẽ tự động hiện khi hoàn tất (Chạy ngầm).");
  };

  const copyScriptToClipboard = () => {
    navigator.clipboard.writeText(optimizedPrompt);
    setStatusMessage("Đã copy kịch bản vào bộ nhớ đệm!");
    setTimeout(() => setStatusMessage(''), 2000);
  };

  const handleDeleteImage = (id: string) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa ảnh này không?")) {
      setResults(prev => prev.filter(img => img.id !== id));
      if (selectedImageId === id) setSelectedImageId(null);
    }
  };

  const handleAnalyze = async () => {
    if (!credentials) { setShowLogin(true); return; }
    if (!refFile) { alert("Vui lòng tải lên ảnh First Frame!"); return; }
    if (!prompt.trim()) { alert("Vui lòng nhập mô tả hành động!"); return; }

    setIsAnalyzing(true);
    setStatusMessage(`Đạo diễn đang tính toán diễn biến trong ${duration} giây...`);
    setShowScriptEditor(false);

    try {
        const refDataUrl = await fileToDataUrl(refFile, 4096);
        
        const structuredContext = await Promise.all(contextImages.map(async (img) => ({
            url: await fileToDataUrl(img.file, 4096),
            role: img.role
        })));

        const resultScript = await enhancePromptWithMotion(
            credentials, 
            prompt, 
            duration, 
            mode, 
            refDataUrl, 
            structuredContext,
            aspectRatio
        );

        setOptimizedPrompt(resultScript);
        setShowScriptEditor(true); 
        setStatusMessage("Đã xong kịch bản Ảnh. Vui lòng kiểm tra các lệnh Camera bên dưới.");
    } catch (error) {
        console.error("Analyze error:", error);
        alert(`Lỗi phân tích kịch bản: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleRenderDirector = async () => {
    if (!credentials || !refFile) return;
    
    const finalPromptToUse = optimizedPrompt.trim() ? optimizedPrompt : prompt;
    
    if (!finalPromptToUse.trim()) {
        alert("Vui lòng nhập ý tưởng hoặc tạo kịch bản trước khi Render.");
        return;
    }

    // Non-blocking rendering
    setGeneratingCount(prev => prev + generationCount); 
    
    const contextMsg = contextImages.length > 0 
        ? `(Kèm ${contextImages.length} ảnh tham khảo)` 
        : '';
    setStatusMessage(`Đang Render ${generationCount} Ảnh biến thể... ${contextMsg}`);
    
    try {
      const refDataUrl = await fileToDataUrl(refFile, 4096);
      const ctxDataUrls = await Promise.all(contextImages.map(img => fileToDataUrl(img.file, 4096)));
      
      const refThumbUrl = await createThumbnail(refFile);
      const ctxThumbUrls = await Promise.all(contextImages.map(img => createThumbnail(img.file)));

      // Add pending placeholders
      for(let i=0; i<generationCount; i++) {
          handleAssetGenerated({
              id: `pending_dir_${Date.now()}_${i}`,
              url: "",
              timestamp: Date.now(),
              prompt: finalPromptToUse,
              ratio: aspectRatio,
              type: AssetType.IMAGE,
              metadata: { 
                  isPending: true,
                  duration: duration,
                  resolution: resolution,
                  refImages: [refThumbUrl, ...ctxThumbUrls]
              }
          });
      }

      // Import generateDirectorImage dynamically
      const { generateDirectorImage } = await import('./services/directorService');

      try {
          const base64Array = await generateDirectorImage(
              credentials,
              finalPromptToUse, 
              aspectRatio,
              resolution, 
              refDataUrl,
              motionStrength,
              ctxDataUrls,
              selectedModel,
              generationCount
          );
          
          base64Array.forEach((base64, i) => {
              const newImage: GeneratedAsset = {
                  id: Date.now().toString() + Math.random().toString().slice(2, 6) + i,
                  url: base64,
                  timestamp: Date.now(),
                  prompt: finalPromptToUse,
                  ratio: aspectRatio,
                  type: AssetType.IMAGE,
                  metadata: {
                      model: selectedModel,
                      refImages: [refThumbUrl, ...ctxThumbUrls]
                  }
              };
              handleAssetGenerated(newImage);
          });
      } catch (e) {
          console.error(`Generation failed`, e);
          setStatusMessage(`Lỗi: ${e instanceof Error ? e.message : "Unknown error"}`);
      } finally {
          setGeneratingCount(prev => Math.max(0, prev - generationCount));
      }
      
      setStatusMessage("Hoàn tất quá trình Render Ảnh.");
      setTimeout(() => setStatusMessage(''), 5000);

    } catch (error) {
      console.error("Render setup error:", error);
      alert(`Lỗi khởi tạo Render: ${error instanceof Error ? error.message : "Unknown error"}`);
      setGeneratingCount(prev => Math.max(0, prev - generationCount));
    }
  };

  // UI Helpers for Director Mode
  const isForward = mode === GenerationMode.FIRST_TO_LAST;
  
  const getRoleIcon = (role: ContextRole) => {
      switch(role) {
          case ContextRole.FACE: return <User size={12} />;
          case ContextRole.BACKGROUND: return <Mountain size={12} />;
          case ContextRole.STYLE: return <Palette size={12} />;
          case ContextRole.OUTFIT: return <Shirt size={12} />;
          case ContextRole.POSE: return <Move size={12} />;
          default: return <ImageIcon size={12} />;
      }
  };

  const getRoleLabel = (role: ContextRole) => {
      switch(role) {
          case ContextRole.FACE: return "Khuôn mặt";
          case ContextRole.BACKGROUND: return "Bối cảnh";
          case ContextRole.STYLE: return "Phong cách";
          case ContextRole.OUTFIT: return "Trang phục";
          case ContextRole.POSE: return "Tư thế/Dáng";
          default: return "Chung";
      }
  };

  // Nav
  const selectedImage = results.find(img => img.id === selectedImageId) || null;
  const selectedIndex = results.findIndex(img => img.id === selectedImageId);
  const handleNext = () => { if (selectedIndex < results.length - 1) setSelectedImageId(results[selectedIndex + 1].id); };
  const handlePrev = () => { if (selectedIndex > 0) setSelectedImageId(results[selectedIndex - 1].id); };

  return (
    <div className="min-h-screen bg-cinema-black text-zinc-100 font-sans selection:bg-cinema-accent selection:text-white pb-20">
      {showLogin && <ApiKeyModal onCredentialsSubmit={handleCredentials} />}
      
      {/* Header */}
      <header className="border-b border-zinc-800 bg-cinema-dark/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-6 py-3 grid grid-cols-1 md:grid-cols-[auto_1fr_auto] items-center gap-8">
          
          {/* Left: Logo */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Logo Image with Error Fallback */}
            {logoError ? (
                <div className="w-10 h-10 rounded-lg bg-rose-600 flex items-center justify-center shadow-lg shadow-rose-900/20">
                    <Video className="text-white" size={20} />
                </div>
            ) : (
                <img 
                  src="/Yfilms%20BytePlus.png" 
                  alt="Logo" 
                  className="w-10 h-10 rounded-lg shadow-lg shadow-rose-900/20 object-cover border border-zinc-700"
                  onError={() => setLogoError(true)}
                />
            )}
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold tracking-tight leading-none mb-1">Trợ Lý YFilms</h1>
              <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Creative Studio</p>
            </div>
          </div>

          {/* Center: TAB SWITCHER */}
          <div className="flex justify-center">
            <div className="w-full bg-zinc-900/80 p-1 rounded-xl flex gap-1 font-medium border border-zinc-800 shadow-inner">
                <button 
                    onClick={() => setAppMode(AppMode.DIRECTOR)}
                    className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 text-xs sm:text-sm transition-all ${appMode === AppMode.DIRECTOR ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-zinc-700' : 'text-zinc-500 hover:text-white'}`}
                >
                    <Clapperboard size={16} /> <span className="hidden md:inline">Đạo Diễn (Ảnh)</span><span className="md:hidden">Đạo Diễn</span>
                </button>
                <button 
                    onClick={() => setAppMode(AppMode.CREATIVE)}
                    className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 text-xs sm:text-sm transition-all ${appMode === AppMode.CREATIVE ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-zinc-700' : 'text-zinc-500 hover:text-white'}`}
                >
                    <Sparkles size={16} /> <span className="hidden md:inline">Sáng Tạo (Gen AI)</span><span className="md:hidden">Sáng Tạo</span>
                </button>
                <button 
                    onClick={() => setAppMode(AppMode.VIDEO)}
                    className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 text-xs sm:text-sm transition-all ${appMode === AppMode.VIDEO ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-zinc-700' : 'text-zinc-500 hover:text-white'}`}
                >
                    <Play size={16} className="fill-current" /> <span className="hidden md:inline">Cinematic Video</span><span className="md:hidden">Cinematic</span>
                </button>
                <button 
                    onClick={() => setAppMode(AppMode.TTS)}
                    className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 text-xs sm:text-sm transition-all ${appMode === AppMode.TTS ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-zinc-700' : 'text-zinc-500 hover:text-white'}`}
                >
                    <Mic size={16} /> <span className="hidden md:inline">Text to Speech</span><span className="md:hidden">TTS</span>
                </button>
            </div>
          </div>
          
          {/* Right: Settings & Status */}
          <div className="flex items-center justify-end gap-4 shrink-0">
             {generatingCount > 0 && (
                 <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-zinc-800 rounded-full text-xs text-yellow-500 animate-pulse border border-yellow-500/20">
                    <Loader2 size={12} className="animate-spin" />
                    <span>{generatingCount} tác vụ đang chạy...</span>
                 </div>
             )}
             {credentials && (
                 <button 
                    onClick={() => setShowLogin(true)}
                    className="text-xs font-medium text-zinc-400 hover:text-white flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-full transition-colors"
                 >
                    <Settings size={14} />
                    <span className="hidden sm:inline">Cài Đặt</span>
                 </button>
             )}
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT: Controls (Shared Area) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* === MODE: DIRECTOR (Use CSS hidden to persist state) === */}
          <div className={appMode === AppMode.DIRECTOR ? 'space-y-6 animate-in fade-in' : 'hidden'}>
              {/* Director Direction Switch */}
              <div className="bg-cinema-gray p-1 rounded-lg flex gap-1 text-sm font-medium border border-zinc-800">
                <button 
                  onClick={() => { setMode(GenerationMode.FIRST_TO_LAST); setPrompt(''); }}
                  className={`flex-1 py-2 rounded-md flex items-center justify-center gap-2 transition-all ${isForward ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-white'}`}
                >
                  <FastForward size={16} /> Start → End
                </button>
                <button 
                  onClick={() => { setMode(GenerationMode.LAST_TO_FIRST); setPrompt(''); }}
                  className={`flex-1 py-2 rounded-md flex items-center justify-center gap-2 transition-all ${!isForward ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-white'}`}
                >
                  <Rewind size={16} /> End → Start
                </button>
              </div>

              {/* Upload Section */}
              <div className="space-y-4">
                <div className="group relative">
                  <label className="block text-sm font-medium text-zinc-400 mb-2">
                    {isForward ? 'Ảnh Gốc (Start Frame)' : 'Ảnh Kết Thúc (End Frame)'} <span className="text-cinema-accent">*</span>
                  </label>
                  <div 
                    onClick={() => refInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingOver('ref'); }}
                    onDragLeave={() => setIsDraggingOver(null)}
                    onDrop={(e) => handleDrop(e, 'ref')}
                    className={`border-2 border-dashed rounded-xl h-48 flex flex-col items-center justify-center cursor-pointer transition-all relative overflow-hidden ${isDraggingOver === 'ref' ? 'border-cinema-accent bg-cinema-accent/10 scale-[1.02]' : 'border-zinc-700 hover:border-cinema-accent hover:bg-zinc-800/50 bg-zinc-900'}`}
                  >
                    {refPreview ? (
                      <img src={refPreview} alt="Ref" className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-zinc-500 mb-2 group-hover:text-cinema-accent transition-colors" />
                        <span className="text-xs text-zinc-500">
                            {isForward ? "Tải lên Start Frame" : "Tải lên End Frame"}
                        </span>
                      </>
                    )}
                    <input type="file" ref={refInputRef} onChange={handleRefUpload} className="hidden" accept="image/*" />
                  </div>
                </div>

                {/* Visual Context */}
                 <div className="group relative">
                  <label className="block text-sm font-medium text-zinc-400 mb-2 flex justify-between">
                    <span>Ngữ cảnh bổ sung (Visual Context)</span>
                  </label>
                  
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingOver('ctx'); }}
                    onDragLeave={() => setIsDraggingOver(null)}
                    onDrop={(e) => handleDrop(e, 'ctx')}
                    className={`transition-all rounded-xl ${isDraggingOver === 'ctx' ? 'ring-2 ring-cinema-accent bg-cinema-accent/10' : ''}`}
                  >
                      {contextImages.length > 0 && (
                          <div className="grid grid-cols-2 gap-3 mb-3">
                              {contextImages.map((img) => (
                                  <div key={img.id} className="relative rounded-lg overflow-hidden border border-zinc-700 group/item bg-zinc-900 flex gap-2 p-1 items-center">
                                      <div className="w-16 h-16 shrink-0 relative rounded-md overflow-hidden">
                                          <img src={img.preview} alt="Ctx" className="w-full h-full object-cover" />
                                      </div>
                                      <div className="flex flex-col gap-1 w-full min-w-0 pr-1">
                                          <div className="flex items-center gap-1 text-[10px] text-zinc-400 uppercase font-bold">
                                              {getRoleIcon(img.role)} {getRoleLabel(img.role)}
                                          </div>
                                          <select 
                                            value={img.role} 
                                            onChange={(e) => updateContextRole(img.id, e.target.value as ContextRole)}
                                            className="w-full bg-zinc-800 text-[10px] border border-zinc-700 rounded p-1 text-white focus:outline-none focus:border-cinema-accent cursor-pointer"
                                          >
                                              <option value={ContextRole.GENERAL}>Chung (General)</option>
                                              <option value={ContextRole.FACE}>Khuôn mặt (Face)</option>
                                              <option value={ContextRole.BACKGROUND}>Bối cảnh (Bg)</option>
                                              <option value={ContextRole.OUTFIT}>Trang phục (Outfit)</option>
                                              <option value={ContextRole.STYLE}>Phong cách (Style)</option>
                                              <option value={ContextRole.POSE}>Tư thế (Pose)</option>
                                          </select>
                                      </div>
                                      <button onClick={() => removeContextImage(img.id)} className="absolute -top-1 -right-1 w-5 h-5 bg-red-900 text-white rounded-full flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-opacity z-10 hover:bg-red-600"><XCircle size={12} /></button>
                                  </div>
                              ))}
                              <button onClick={() => ctxInputRef.current?.click()} className="h-16 rounded-lg border border-zinc-700 border-dashed flex items-center justify-center text-zinc-500 hover:text-white hover:border-zinc-500 transition-colors bg-zinc-900/50 w-full col-span-2"><Plus size={16} className="mr-2"/> Thêm ảnh tham khảo</button>
                          </div>
                      )}
                      {contextImages.length === 0 && (
                        <div 
                            onClick={() => ctxInputRef.current?.click()} 
                            className={`border-2 border-dashed rounded-xl h-20 flex items-center justify-center cursor-pointer transition-all relative overflow-hidden ${isDraggingOver === 'ctx' ? 'border-cinema-accent bg-cinema-accent/10' : 'border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/50 bg-zinc-900'}`}
                        >
                            <div className="flex items-center gap-2"><ImageIcon className="w-4 h-4 text-zinc-600" /><span className="text-xs text-zinc-500">Kéo thả hoặc Click để thêm ảnh tham khảo</span></div>
                        </div>
                      )}
                  </div>
                  <input type="file" ref={ctxInputRef} onChange={handleCtxUpload} className="hidden" accept="image/*" multiple />
                </div>
              </div>

              {/* Prompt Section */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-zinc-400">Ý tưởng Ảnh</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Mô tả hành động hoặc diễn biến tiếp theo (Ví dụ: Nhân vật quay đầu lại và cười...)"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-cinema-accent h-24 resize-none"
                />
              </div>

              {/* MOTION SETTINGS */}
              <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 space-y-4">
                 <div>
                    <div className="flex justify-between items-center mb-2">
                         <label className="text-xs font-bold text-zinc-400 flex items-center gap-1"><Move size={12} /> BIÊN ĐỘ CHUYỂN ĐỘNG</label>
                         <span className="text-xs text-zinc-500">{motionStrength}</span>
                    </div>
                    <input 
                        type="range" min="1" max="3" step="1"
                        value={motionStrength === MotionStrength.LOW ? 1 : motionStrength === MotionStrength.MEDIUM ? 2 : 3}
                        onChange={(e) => {
                            const val = Number(e.target.value);
                            if(val === 1) setMotionStrength(MotionStrength.LOW);
                            if(val === 2) setMotionStrength(MotionStrength.MEDIUM);
                            if(val === 3) setMotionStrength(MotionStrength.HIGH);
                        }}
                        className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-cinema-accent"
                    />
                 </div>
                 <div className="pt-2 border-t border-zinc-800">
                    <label className="block text-xs font-medium text-zinc-500 mb-1">Model Tạo Ảnh</label>
                    <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value as ImageModel)} className="w-full bg-zinc-950 border border-zinc-700 rounded-md p-1.5 text-xs text-white">
                        {IMAGE_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                 </div>
                 <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-800">
                    <div>
                      <div className="flex justify-between items-end mb-1"><label className="block text-xs font-medium text-zinc-500">Thời lượng</label><span className="text-xs font-bold text-cinema-accent">{duration}s</span></div>
                      <input type="range" min="5" max="15" step="1" value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-cinema-accent" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-zinc-500 mb-1">Số lượng</label>
                        <select 
                            value={generationCount} 
                            onChange={(e) => setGenerationCount(Number(e.target.value))} 
                            className="w-full bg-zinc-950 border border-zinc-700 rounded-md p-1.5 text-xs text-white"
                        >
                            {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </div>
                    <div><label className="block text-xs font-medium text-zinc-500 mb-1">Tỉ lệ</label><select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as AspectRatio)} className="w-full bg-zinc-950 border border-zinc-700 rounded-md p-1.5 text-xs">
                        {ASPECT_RATIOS.filter(r => {
                            return [
                                AspectRatio.R_16_9, AspectRatio.R_9_16, AspectRatio.R_21_9,
                                AspectRatio.R_1_1, AspectRatio.R_4_3, AspectRatio.R_3_4,
                                AspectRatio.R_3_2, AspectRatio.R_2_3
                            ].includes(r.value);
                        }).map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select></div>
                    <div>
                        <label className="block text-xs font-medium text-zinc-500 mb-1">Chất lượng</label>
                        <select 
                            value={resolution} 
                            onChange={(e) => setResolution(e.target.value as Resolution)} 
                            className="w-full bg-zinc-950 border border-zinc-700 rounded-md p-1.5 text-xs"
                        >
                            {IMAGE_RESOLUTIONS.map(r => {
                                const isDisabled = selectedModel === ImageModel.SEEDREAM_5_0 && r.value === Resolution.RES_4K;
                                return (
                                    <option key={r.value} value={r.value} disabled={isDisabled}>
                                        {r.label} {isDisabled ? "(Chỉ hỗ trợ 2K)" : ""}
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                 </div>
              </div>

              {/* ACTION BUTTONS (Director) */}
              {!showScriptEditor ? (
                  <button onClick={handleAnalyze} disabled={isAnalyzing} className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all shadow-lg ${isAnalyzing ? 'bg-zinc-800 text-zinc-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-900/30'}`}>
                    {isAnalyzing ? <Loader2 className="animate-spin" /> : <Clapperboard className="w-5 h-5" />}
                    {isAnalyzing ? 'Đạo Diễn Đang Suy Nghĩ...' : '1. Lên Kịch Bản'}
                  </button>
              ) : (
                <div className="bg-zinc-900 border border-indigo-500/50 rounded-xl p-4 animate-in fade-in slide-in-from-top-4 space-y-3 shadow-2xl shadow-indigo-900/20">
                    <div className="flex justify-between items-center">
                        <h3 className="text-sm font-bold text-indigo-400 flex items-center gap-2"><FileText size={16} /> Kịch Bản Đạo Diễn</h3>
                        <div className="flex gap-2">
                            <button onClick={copyScriptToClipboard} className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-1 rounded flex items-center gap-1 transition-colors"><Copy size={12} /> Copy</button>
                            <button onClick={handleAnalyze} className="text-xs text-zinc-500 hover:text-white flex items-center gap-1"><RefreshCw size={12} /> Làm lại</button>
                        </div>
                    </div>
                    <textarea value={optimizedPrompt} onChange={(e) => setOptimizedPrompt(e.target.value)} className="w-full h-40 bg-black/50 border border-zinc-700 rounded-lg p-3 text-xs font-mono text-zinc-300 focus:outline-none focus:border-indigo-500 resize-y" autoFocus />
                    <div className="flex gap-2 pt-2">
                         {isRendering ? (
                             <div className="flex gap-2 w-full">
                                <button disabled className="flex-1 py-3 bg-zinc-800 rounded-lg text-zinc-400 flex items-center justify-center gap-2 font-bold"><Loader2 className="animate-spin" size={18} /> Đang Render...</button>
                                 <button onClick={handleStopWaiting} className="px-4 bg-red-900/20 text-red-500 border border-red-900/50 rounded-lg hover:bg-red-900/40" title="Chạy ngầm (Mở khóa giao diện)"><Minimize2 size={20} /></button>
                             </div>
                         ) : (
                            <button onClick={handleRenderDirector} className="w-full py-3 rounded-lg font-bold text-base flex items-center justify-center gap-2 transition-all bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-lg shadow-rose-900/30"><Zap className="w-5 h-5 fill-white" /> 2. Render Ảnh</button>
                         )}
                    </div>
                </div>
              )}
              {statusMessage && <div className="text-xs text-center text-zinc-400 animate-pulse mt-2 px-4 border-l-2 border-cinema-accent bg-zinc-900/50 py-1">{statusMessage}</div>}
            </div>

          {/* === MODE: CREATIVE (Use CSS hidden to persist state) === */}
          <div className={appMode === AppMode.CREATIVE ? 'block' : 'hidden'}>
              <CreativeMode 
                credentials={credentials}
                onRequestLogin={() => setShowLogin(true)}
                onImageGenerated={handleAssetGenerated}
                setIsRendering={setIsRendering}
                setGeneratingCount={setGeneratingCount}
              />
          </div>

          {/* === MODE: VIDEO === */}
          <div className={appMode === AppMode.VIDEO ? 'block' : 'hidden'}>
              <VideoMode 
                credentials={credentials}
                onRequestLogin={() => setShowLogin(true)}
                onAssetGenerated={handleAssetGenerated}
                setIsRendering={setIsRendering}
                setGeneratingCount={setGeneratingCount}
              />
          </div>

          {/* === MODE: TTS === */}
          <div className={appMode === AppMode.TTS ? 'block' : 'hidden'}>
              {credentials && (
                <TTSMode 
                  creds={credentials}
                  onAssetGenerated={handleAssetGenerated}
                />
              )}
          </div>

        </div>

        {/* RIGHT: Gallery (Shared for both modes) */}
        <div className="lg:col-span-8">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Play className="text-zinc-500 fill-zinc-500/20" size={20} />
                        Thư Viện Kết Quả
                    </h2>
                    <div className="flex items-center bg-zinc-900 rounded-lg p-1 border border-zinc-800">
                        <button 
                            onClick={() => setAssetFilter('all')}
                            className={`px-3 py-1 text-xs rounded-md transition-colors ${assetFilter === 'all' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            Tất cả
                        </button>
                        <button 
                            onClick={() => setAssetFilter(AssetType.IMAGE)}
                            className={`px-3 py-1 text-xs rounded-md transition-colors flex items-center gap-1 ${assetFilter === AssetType.IMAGE ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            <ImageIcon size={12} /> Ảnh
                        </button>
                        <button 
                            onClick={() => setAssetFilter(AssetType.VIDEO)}
                            className={`px-3 py-1 text-xs rounded-md transition-colors flex items-center gap-1 ${assetFilter === AssetType.VIDEO ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            <Video size={12} /> Video
                        </button>
                        <button 
                            onClick={() => setAssetFilter(AssetType.AUDIO)}
                            className={`px-3 py-1 text-xs rounded-md transition-colors flex items-center gap-1 ${assetFilter === AssetType.AUDIO ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            <Mic size={12} /> Audio
                        </button>
                    </div>
                </div>
                <span className="text-sm text-zinc-500">{results.filter(a => assetFilter === 'all' || a.type === assetFilter).length} Assets</span>
            </div>

            {results.filter(a => assetFilter === 'all' || a.type === assetFilter).length === 0 ? (
                <div className="border border-zinc-800 border-dashed rounded-2xl h-[600px] flex flex-col items-center justify-center text-zinc-600 bg-zinc-900/30">
                    <Video className="w-16 h-16 mb-4 opacity-20" />
                    <p className="text-lg font-medium">Sẵn sàng tạo nội dung</p>
                    <p className="text-sm mt-2 opacity-60 max-w-md text-center">
                        {appMode === AppMode.DIRECTOR 
                            ? "Chế độ Đạo Diễn: Tạo kịch bản và ảnh nghệ thuật từ mô tả."
                            : appMode === AppMode.CREATIVE
                            ? "Chế độ Sáng Tạo: Tạo ảnh nghệ thuật từ văn bản và ảnh tham chiếu."
                            : appMode === AppMode.VIDEO
                            ? "Chế độ Video: Tạo video cinematic từ văn bản hoặc ảnh tham chiếu."
                            : "Chế độ Text to Speech: Chuyển đổi văn bản thành giọng nói."}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {results.filter(a => assetFilter === 'all' || a.type === assetFilter).map((asset) => (
                        <div 
                            key={asset.id} 
                            draggable={asset.type === AssetType.IMAGE}
                            onDragStart={(e) => {
                                if (asset.type === AssetType.IMAGE) {
                                    (window as any).__draggedAssetUrl = asset.url;
                                    e.dataTransfer.setData('text/plain', 'internal-drag');
                                    e.dataTransfer.effectAllowed = 'copy';
                                }
                            }}
                            onDragEnd={() => {
                                (window as any).__draggedAssetUrl = null;
                            }}
                            className="group relative bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 shadow-md hover:border-zinc-600 transition-all cursor-grab active:cursor-grabbing"
                        >
                            {/* Asset Thumbnail */}
                            <div className={`${getAspectRatioClass(asset.ratio)} w-full overflow-hidden ${asset.type === AssetType.VIDEO ? 'bg-black' : 'bg-zinc-900'} relative cursor-zoom-in`} onClick={() => !asset.metadata?.isPending && setSelectedImageId(asset.id)}>
                                {asset.metadata?.isPending ? (
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900/50 gap-3">
                                        <Loader2 className="w-10 h-10 text-cinema-accent animate-spin" />
                                        <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest animate-pulse">
                                            {asset.type === AssetType.VIDEO ? "Đang tạo video..." : asset.type === AssetType.AUDIO ? "Đang tạo audio..." : "Đang tạo ảnh..."}
                                        </div>
                                    </div>
                                ) : asset.type === AssetType.VIDEO ? (
                                    <div className="w-full h-full relative">
                                        <video src={asset.url} className="w-full h-full object-contain" muted onMouseOver={e => e.currentTarget.play()} onMouseOut={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }} />
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/10 transition-colors">
                                            <Play className="text-white/40 group-hover:scale-0 group-hover:opacity-0 transition-all duration-300 absolute" size={48} />
                                            <Play className="text-white scale-0 opacity-0 group-hover:scale-110 group-hover:opacity-100 transition-all duration-300 fill-white absolute" size={64} />
                                        </div>
                                    </div>
                                ) : asset.type === AssetType.AUDIO ? (
                                    <div className="w-full h-full relative bg-zinc-800 flex flex-col items-center justify-center p-4">
                                        <Mic className="text-zinc-600 mb-4" size={48} />
                                        <audio src={asset.url} controls className="w-full h-10" onClick={(e) => e.stopPropagation()} />
                                    </div>
                                ) : (
                                    <img src={asset.url} alt="Result" className="w-full h-full object-contain" />
                                )}
                                <div className="absolute top-2 left-2 bg-black/60 text-white px-2 py-0.5 rounded text-[10px] backdrop-blur-md flex items-center gap-1">
                                    {asset.metadata?.isPending ? <RefreshCw size={10} className="animate-spin" /> : asset.type === AssetType.VIDEO ? <Play size={10} className="fill-white"/> : asset.type === AssetType.AUDIO ? <Mic size={10} className="fill-white"/> : <ImageIcon size={10}/>}
                                    {asset.type === AssetType.AUDIO ? asset.metadata?.voice || 'Audio' : getModelLabel(asset.metadata?.model) || asset.ratio}
                                </div>
                            </div>
                            
                            {/* Info */}
                            <div className="p-3">
                                <p className="text-xs text-zinc-500 line-clamp-2 mb-2 h-8" title={asset.prompt}>
                                    {asset.prompt}
                                </p>
                                <div className="flex justify-between items-center">
                                     <span className="text-[10px] text-zinc-600 font-mono">{new Date(asset.timestamp).toLocaleTimeString()}</span>
                                     <div className="flex items-center gap-1">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleDeleteImage(asset.id); }}
                                            className="text-zinc-500 hover:text-red-500 p-1.5 rounded-md hover:bg-zinc-800 transition-colors"
                                            title="Xóa"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                        {!asset.metadata?.isPending && (
                                            <a 
                                                href={asset.url} 
                                                download={`${asset.type === AssetType.AUDIO && asset.prompt ? asset.prompt.replace(/[<>:"/\\|?*]/g, '').trim() : `asset_${asset.id}`}.${asset.type === AssetType.VIDEO ? 'mp4' : asset.type === AssetType.AUDIO ? asset.metadata?.resolution?.toLowerCase() || 'mp3' : 'png'}`}
                                                className="text-zinc-400 hover:text-white p-1.5 rounded-md hover:bg-zinc-800 transition-colors" 
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <Download size={16} />
                                            </a>
                                        )}
                                     </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>

      </main>

      {selectedImage && (
        <ImageViewer 
            asset={selectedImage} 
            onClose={() => setSelectedImageId(null)}
            onNext={handleNext}
            onPrev={handlePrev}
            hasNext={selectedIndex < results.length - 1}
            hasPrev={selectedIndex > 0}
        />
      )}

      <FloatingChat credentials={credentials} />
    </div>
  );
}