import React, { useState, useRef, useEffect } from 'react';
import { ApiCredentials, GeneratedAsset, AssetType, CreativeIntent, VideoModel, Resolution } from '../types';
import { VIDEO_RESOLUTIONS, VIDEO_RATIOS, VIDEO_MODELS, MODEL_VIDEO } from '../constants';
import { fileToDataUrl, urlToFile, createThumbnail } from '../services/apiClient';
import { optimizeCreativePrompt } from '../services/creativeService';
import { generateVideo } from '../services/videoService';
import { Upload, Wand2, Loader2, Zap, Copy, XCircle, LayoutGrid, Plus, Globe, Video, Minimize2, Settings2, Music, Camera, Info, ArrowLeftRight, Layers } from 'lucide-react';

interface VideoModeProps {
    credentials: ApiCredentials | null;
    onRequestLogin: () => void;
    onAssetGenerated: (asset: GeneratedAsset) => void;
    setIsRendering: (isRendering: boolean) => void;
    setGeneratingCount: (count: React.SetStateAction<number>) => void;
}

const VideoMode: React.FC<VideoModeProps> = ({ 
    credentials, 
    onRequestLogin, 
    onAssetGenerated, 
    setIsRendering,
    setGeneratingCount
}) => {
    // Inputs
    const [rawPrompt, setRawPrompt] = useState('');
    const [finalPrompt, setFinalPrompt] = useState('');
    const [vietnameseTranslation, setVietnameseTranslation] = useState('');
    const [refFiles, setRefFiles] = useState<{id: string, file: File, preview: string}[]>([]);
    
    // Config
    const [selectedModel, setSelectedModel] = useState<VideoModel>(MODEL_VIDEO as VideoModel);
    const [resolution, setResolution] = useState(VIDEO_RESOLUTIONS[0].value);
    const [ratio, setRatio] = useState(VIDEO_RATIOS[0].value);
    const [duration, setDuration] = useState(5);
    const [cameraFixed, setCameraFixed] = useState(false);
    const [generateAudio, setGenerateAudio] = useState(true);
    const [useFirstLastFrame, setUseFirstLastFrame] = useState(false);

    const maxImages = selectedModel === VideoModel.SEEDANCE_1_0_LITE ? 4 : (selectedModel === VideoModel.SEEDANCE_1_0_PRO_FAST ? 1 : 2);
    const prevCountRef = useRef(refFiles.length);

    // Status
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [hasOptimized, setHasOptimized] = useState(false);
    const [isLocalRendering, setIsLocalRendering] = useState(false);
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Token Calculation
    const [estimatedTokens, setEstimatedTokens] = useState(0);
    useEffect(() => {
        const resConfig = VIDEO_RESOLUTIONS.find(r => r.value === resolution);
        if (resConfig) {
            setEstimatedTokens(resConfig.tokensPerSec * duration);
        }
    }, [resolution, duration]);

    // Adjust duration limits based on model
    useEffect(() => {
        const minDuration = selectedModel === VideoModel.SEEDANCE_1_5_PRO ? 4 : 2;
        const maxDuration = 12; // All models support up to 12s as per guide
        
        if (duration < minDuration) setDuration(minDuration);
        if (duration > maxDuration) setDuration(maxDuration);

        // Image count constraints
        if (refFiles.length > maxImages) {
            setRefFiles(prev => prev.slice(0, maxImages));
        }

        const prevCount = prevCountRef.current;
        const currentCount = refFiles.length;

        // Handle First/Last frame support and defaults
        if (currentCount !== 2) {
            if (useFirstLastFrame) setUseFirstLastFrame(false);
        } else if (selectedModel !== VideoModel.SEEDANCE_1_0_PRO_FAST) {
            // If we just reached 2 images, default to First & Last Frame
            if (prevCount < 2 && !useFirstLastFrame) {
                setUseFirstLastFrame(true);
            }
        }

        // Resolution constraints
        if (selectedModel === VideoModel.SEEDANCE_1_0_LITE) {
            // Smart Reference (3-4 images OR 2 images with useFirstLastFrame=false) max resolution is 720p
            // We check the "next" state of useFirstLastFrame if we just reached 2 images
            const willBeFirstLast = (currentCount === 2 && (useFirstLastFrame || prevCount < 2));
            const isSmartRef = currentCount > 2 || (currentCount === 2 && !willBeFirstLast);
            
            if (isSmartRef && resolution === Resolution.RES_1080P) {
                setResolution(Resolution.RES_720P);
            }
        }
        
        // Reset audio if not supported
        if (selectedModel !== VideoModel.SEEDANCE_1_5_PRO && generateAudio) {
            setGenerateAudio(false);
        }
        
        // Force useFirstLastFrame to true for non-lite models with 2 images
        // Note: PRO_FAST doesn't support 2 images anyway due to maxImages=1
        if (selectedModel !== VideoModel.SEEDANCE_1_0_LITE && 
            selectedModel !== VideoModel.SEEDANCE_1_0_PRO_FAST && 
            currentCount === 2 && !useFirstLastFrame) {
            setUseFirstLastFrame(true);
        }

        // Aspect Ratio constraints - All models now support the same set based on Python example
        const supportedVideoRatios = ["16:9", "9:16", "21:9", "1:1", "4:3", "3:4"];
        if (!supportedVideoRatios.includes(ratio)) {
            setRatio("16:9");
        }

        prevCountRef.current = currentCount;
    }, [selectedModel, duration, resolution, generateAudio, useFirstLastFrame, ratio, refFiles.length, maxImages]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            processFiles(Array.from(e.target.files));
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const processFiles = (files: File[]) => {
        const processed = files.map((f: any) => ({
            id: Math.random().toString(36).substring(7),
            file: f,
            preview: URL.createObjectURL(f)
        }));
        
        setRefFiles(prev => [...prev, ...processed]);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDraggingOver(false);
        
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFiles(Array.from(e.dataTransfer.files));
            return;
        }

        let assetUrl = (window as any).__draggedAssetUrl;
        
        if (!assetUrl) {
            assetUrl = e.dataTransfer.getData('text/plain');
            if (assetUrl === 'internal-drag') assetUrl = null;
        }
        
        if (!assetUrl) assetUrl = e.dataTransfer.getData('text/uri-list');

        if (!assetUrl) {
            const html = e.dataTransfer.getData('text/html');
            if (html) {
                const match = html.match(/src="([^"]+)"/);
                if (match && match[1]) assetUrl = match[1];
            }
        }

        if (assetUrl) {
            try {
                const file = await urlToFile(assetUrl, "gallery_asset.png");
                processFiles([file]);
            } catch (err) {
                console.error("Failed to process dropped asset", err);
            }
        }
    };

    const removeFile = (id: string) => {
        setRefFiles(prev => prev.filter(f => f.id !== id));
    };

    const swapRefFiles = () => {
        if (refFiles.length === 2) {
            setRefFiles([refFiles[1], refFiles[0]]);
        }
    };

    const handleOptimize = async () => {
        if (!credentials) { onRequestLogin(); return; }
        if (!rawPrompt.trim()) { alert("Vui lòng nhập ý tưởng!"); return; }

        setIsOptimizing(true);
        try {
            const refUrls = await Promise.all(refFiles.map(f => fileToDataUrl(f.file, 4096)));
            const result = await optimizeCreativePrompt(credentials, rawPrompt, refUrls, CreativeIntent.VIDEO, resolution, ratio, duration);
            
            setFinalPrompt(result.english);
            setVietnameseTranslation(result.vietnamese);
            setHasOptimized(true);
        } catch (e) {
            alert(`Lỗi tối ưu prompt: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            setIsOptimizing(false);
        }
    };

    const handleGenerate = async () => {
        if (!credentials) { onRequestLogin(); return; }
        if (!credentials.baseUrl || !credentials.apiKey) {
            alert("Vui lòng cấu hình API trong phần cài đặt.");
            return;
        }
        
        const promptToUse = hasOptimized && finalPrompt ? finalPrompt : rawPrompt;
        if (!promptToUse.trim()) { alert("Vui lòng nhập Prompt!"); return; }

        setGeneratingCount(prev => prev + 1);
        
        try {
            const refUrls = await Promise.all(refFiles.map(f => fileToDataUrl(f.file, 4096)));
            const refThumbUrls = await Promise.all(refFiles.map(f => createThumbnail(f.file)));
            
            const tempId = "pending_" + Date.now();
            const pendingAsset: GeneratedAsset = {
                id: tempId,
                url: "", 
                timestamp: Date.now(),
                prompt: promptToUse,
                ratio: ratio,
                type: AssetType.VIDEO,
                metadata: {
                    duration,
                    resolution,
                    tokens: estimatedTokens,
                    isPending: true,
                    refImages: refThumbUrls
                }
            };
            onAssetGenerated(pendingAsset);

            const videoUrl = await generateVideo(
                credentials,
                promptToUse,
                refUrls,
                resolution,
                ratio,
                duration,
                cameraFixed,
                generateAudio,
                selectedModel,
                useFirstLastFrame
            );
            
            const finalAsset: GeneratedAsset = {
                id: Date.now().toString() + Math.random().toString().slice(2, 6),
                url: videoUrl,
                timestamp: Date.now(),
                prompt: promptToUse,
                ratio: ratio,
                type: AssetType.VIDEO,
                metadata: {
                    duration,
                    resolution,
                    tokens: estimatedTokens,
                    model: selectedModel,
                    refImages: refThumbUrls
                }
            };
            
            onAssetGenerated(finalAsset);

        } catch (e) {
            console.error("Video Gen failed", e);
            alert(`Lỗi tạo video: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            setGeneratingCount(prev => Math.max(0, prev - 1));
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            
            {/* 1. UPLOAD SECTION */}
            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                        <LayoutGrid size={16} /> Ảnh tham chiếu (Tối đa {maxImages})
                    </label>
                    <span className="text-xs text-zinc-500">{refFiles.length}/{maxImages}</span>
                </div>

                <div
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
                    onDragLeave={() => setIsDraggingOver(false)}
                    onDrop={handleDrop}
                    className={`transition-all rounded-xl ${isDraggingOver ? 'ring-2 ring-cinema-accent bg-cinema-accent/10' : ''}`}
                >
                    {refFiles.length === 0 ? (
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-xl h-32 flex flex-col items-center justify-center cursor-pointer transition-all ${isDraggingOver ? 'border-cinema-accent bg-cinema-accent/10 scale-[1.02]' : 'border-zinc-700 hover:border-cinema-accent hover:bg-zinc-800/50 bg-zinc-900'}`}
                        >
                            <Upload className="w-6 h-6 text-zinc-600 mb-2" />
                            <span className="text-xs text-zinc-500">Kéo thả hoặc nhấn để tải ảnh lên</span>
                            <span className="text-[10px] text-zinc-600 mt-1">(Để trống nếu muốn Text-to-Video)</span>
                        </div>
                    ) : (
                        <div className="relative">
                            <div className="grid grid-cols-2 gap-3">
                                {refFiles.map((f, index) => (
                                    <div key={f.id} className="relative aspect-video group rounded-lg overflow-hidden border border-zinc-700 bg-black">
                                        <img src={f.preview} className="w-full h-full object-cover" />
                                        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-white border border-white/10">
                                            {index === 0 ? "First Frame" : index === refFiles.length - 1 && refFiles.length > 1 ? "Last Frame" : `Frame ${index + 1}`}
                                        </div>
                                        <button 
                                            onClick={() => removeFile(f.id)}
                                            className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-red-600 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <XCircle size={14} />
                                        </button>
                                    </div>
                                ))}
                                {refFiles.length < maxImages && (
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="aspect-video rounded-lg border border-zinc-700 border-dashed flex flex-col items-center justify-center text-zinc-500 hover:text-white hover:border-zinc-500 bg-zinc-900/50"
                                    >
                                        <Plus size={20} />
                                        <span className="text-[10px] mt-1">Thêm Frame</span>
                                    </button>
                                )}
                            </div>
                            
                            {refFiles.length === 2 && (
                                <button 
                                    onClick={swapRefFiles}
                                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 p-2 bg-zinc-800 border border-zinc-700 rounded-full text-white hover:bg-cinema-accent hover:border-white transition-all shadow-xl shadow-black/50 group"
                                    title="Đảo vị trí Trước/Sau"
                                >
                                    <ArrowLeftRight size={16} className="group-hover:rotate-180 transition-transform duration-300" />
                                </button>
                            )}
                        </div>
                    )}
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" multiple accept="image/*" />
            </div>

            {/* 2. PROMPT SECTION */}
            <div className="space-y-3">
                <label className="text-sm font-medium text-zinc-400">Ý tưởng Video (Prompt)</label>
                <textarea 
                    value={rawPrompt}
                    onChange={(e) => setRawPrompt(e.target.value)}
                    placeholder="Mô tả video bạn muốn tạo (Ví dụ: Một con mèo chạy trên bãi cỏ...)"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm text-white focus:border-cinema-accent h-24 resize-none"
                />

                <button
                    onClick={handleOptimize}
                    disabled={isOptimizing}
                    className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-xs font-bold text-zinc-300 flex items-center justify-center gap-2 transition-colors"
                >
                    {isOptimizing ? <Loader2 className="animate-spin" size={14} /> : <Wand2 size={14} className="text-blue-400" />}
                    {isOptimizing ? "Đang tối ưu kịch bản..." : "Tối ưu hóa kịch bản với AI"}
                </button>

                {hasOptimized && (
                    <div className="bg-zinc-900/80 border border-blue-900/30 rounded-xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2">
                        <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
                             <div className="flex items-center gap-2 text-blue-400 text-xs font-bold">
                                <Wand2 size={12} /> Kịch bản tối ưu
                             </div>
                             <button onClick={() => setHasOptimized(false)} className="text-[10px] text-zinc-500 hover:text-zinc-300">Đóng</button>
                        </div>
                        <textarea 
                            value={finalPrompt}
                            onChange={(e) => setFinalPrompt(e.target.value)}
                            className="w-full h-24 bg-black/40 border border-zinc-700 rounded p-2 text-xs font-mono text-zinc-300 focus:border-blue-500"
                        />
                        <div className="bg-zinc-800/50 rounded p-2 flex gap-2">
                            <Globe className="shrink-0 text-zinc-500 mt-0.5" size={14} />
                            <p className="text-xs text-zinc-400 italic leading-relaxed">{vietnameseTranslation}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* 3. SETTINGS */}
            <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase mb-2">
                    <Settings2 size={14} /> Cấu hình Video
                </div>
                
                <div className="mb-1">
                    <label className="block text-[10px] text-zinc-500 mb-1 font-bold uppercase">Model Tạo Video</label>
                    <select 
                        value={selectedModel} 
                        onChange={(e) => setSelectedModel(e.target.value as VideoModel)} 
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-md p-2 text-xs text-white"
                    >
                        {VIDEO_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] text-zinc-500 mb-1 font-bold uppercase">Độ phân giải</label>
                        <select 
                            value={resolution} 
                            onChange={(e) => setResolution(e.target.value as Resolution)} 
                            className="w-full bg-zinc-950 border border-zinc-700 rounded-md p-2 text-xs text-white"
                        >
                            {VIDEO_RESOLUTIONS.map(r => {
                                // Constraint: Smart Reference on Lite model max is 720p
                                // Smart Ref is active if Lite model AND (3-4 images OR (2 images AND useFirstLastFrame is false))
                                const isSmartRef = selectedModel === VideoModel.SEEDANCE_1_0_LITE && 
                                                 (refFiles.length > 2 || (refFiles.length === 2 && !useFirstLastFrame));
                                const isDisabled = isSmartRef && r.value === Resolution.RES_1080P;
                                
                                return (
                                    <option key={r.value} value={r.value} disabled={isDisabled}>
                                        {r.label} {isDisabled ? "(Smart Ref max 720p)" : ""}
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] text-zinc-500 mb-1 font-bold uppercase">Tỉ lệ</label>
                        <select 
                            value={ratio} 
                            onChange={(e) => setRatio(e.target.value)} 
                            className="w-full bg-zinc-950 border border-zinc-700 rounded-md p-2 text-xs text-white"
                        >
                            {VIDEO_RATIOS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                    </div>
                </div>

                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] text-zinc-500 font-bold uppercase">Thời lượng</label>
                        <span className="text-xs font-bold text-cinema-accent">{duration} giây</span>
                    </div>
                    <input 
                        type="range" 
                        min={selectedModel === VideoModel.SEEDANCE_1_5_PRO ? 4 : 2} 
                        max={12} 
                        step="1" 
                        value={duration} 
                        onChange={(e) => setDuration(Number(e.target.value))} 
                        className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cinema-accent" 
                    />
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                    <button 
                        onClick={() => setCameraFixed(!cameraFixed)}
                        className={`flex-1 py-2 rounded-lg border text-[10px] font-bold flex items-center justify-center gap-2 transition-all ${cameraFixed ? 'bg-zinc-700 border-zinc-600 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}
                    >
                        <Camera size={14} /> Camera Cố Định: {cameraFixed ? "Bật" : "Tắt"}
                    </button>
                    
                    {selectedModel === VideoModel.SEEDANCE_1_5_PRO && (
                        <button 
                            onClick={() => setGenerateAudio(!generateAudio)}
                            className={`flex-1 py-2 rounded-lg border text-[10px] font-bold flex items-center justify-center gap-2 transition-all ${generateAudio ? 'bg-zinc-700 border-zinc-600 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}
                        >
                            <Music size={14} /> Tạo Âm Thanh: {generateAudio ? "Bật" : "Tắt"}
                        </button>
                    )}

                    {refFiles.length === 2 && (
                        <div className="flex-1 flex bg-zinc-950 border border-zinc-800 rounded-lg p-1 gap-1">
                            {selectedModel === VideoModel.SEEDANCE_1_0_LITE ? (
                                <>
                                    <button 
                                        onClick={() => setUseFirstLastFrame(false)}
                                        className={`flex-1 py-1.5 rounded-md text-[9px] font-bold transition-all ${!useFirstLastFrame ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-400'}`}
                                    >
                                        Smart Reference
                                    </button>
                                    <button 
                                        onClick={() => setUseFirstLastFrame(true)}
                                        className={`flex-1 py-1.5 rounded-md text-[9px] font-bold transition-all ${useFirstLastFrame ? 'bg-cinema-accent text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-400'}`}
                                    >
                                        First & Last Frame
                                    </button>
                                </>
                            ) : (
                                <div className="flex-1 py-1.5 text-center text-[9px] font-bold text-cinema-accent bg-zinc-900/50 rounded-md border border-cinema-accent/20">
                                    First & Last Frame Mode
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Mode Indicator */}
                <div className="px-3 py-2 bg-black/40 rounded-lg border border-zinc-800/50 flex items-center justify-between">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase">Chế độ hiện tại:</span>
                    <span className="text-[10px] text-blue-400 font-bold">
                        {refFiles.length === 0 && "Text-to-Video (T2V)"}
                        {refFiles.length === 1 && "First Frame (I2V)"}
                        {refFiles.length === 2 && (
                            selectedModel === VideoModel.SEEDANCE_1_0_LITE 
                                ? (useFirstLastFrame ? "First & Last Frame" : "Smart Reference")
                                : "First & Last Frame"
                        )}
                        {refFiles.length > 2 && selectedModel === VideoModel.SEEDANCE_1_0_LITE && "Smart Reference (3-4 images)"}
                    </span>
                </div>

                {/* Token Estimator */}
                <div className="bg-cinema-accent/5 border border-cinema-accent/20 rounded-lg p-3 flex items-start gap-3">
                    <Info size={16} className="text-cinema-accent shrink-0 mt-0.5" />
                    <div className="space-y-1">
                        <p className="text-[10px] text-zinc-400 font-bold uppercase">Ước tính Token ({selectedModel})</p>
                        <p className="text-sm font-mono text-white">
                            {estimatedTokens.toLocaleString()} tokens
                        </p>
                        <p className="text-[9px] text-zinc-500 italic">
                            ({resolution} @ {duration}s)
                        </p>
                    </div>
                </div>

                {isLocalRendering ? (
                    <div className="flex gap-2">
                        <button disabled className="flex-1 py-3 bg-zinc-800 rounded-lg text-zinc-400 flex items-center justify-center gap-2 font-bold cursor-wait">
                            <Loader2 className="animate-spin" size={18} /> Đang tạo video...
                        </button>
                        <button 
                            onClick={() => { setIsRendering(false); setIsLocalRendering(false); }} 
                            className="px-4 bg-blue-900/20 text-blue-400 border border-blue-900/50 rounded-lg hover:bg-blue-900/40 flex items-center justify-center"
                            title="Chạy ngầm"
                        >
                            <Minimize2 size={20} />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={handleGenerate}
                        className="w-full py-3 rounded-lg font-bold text-base flex items-center justify-center gap-2 transition-all bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg shadow-blue-900/30"
                    >
                        <Zap className="w-5 h-5 fill-white" />
                        Tạo Video Cinematic
                    </button>
                )}
            </div>
        </div>
    );
};

export default VideoMode;
