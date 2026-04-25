import React, { useState, useRef } from 'react';
import { ApiCredentials, AspectRatio, Resolution, GeneratedAsset, ImageModel, CreativeIntent, AssetType } from '../types';
import { ASPECT_RATIOS, IMAGE_RESOLUTIONS, IMAGE_MODELS, MODEL_IMAGE_BASE } from '../constants';
import { fileToDataUrl, urlToFile, createThumbnail } from '../services/apiClient';
import { optimizeCreativePrompt, generateCreativeImage } from '../services/creativeService';
import { Upload, Wand2, Loader2, Zap, Copy, XCircle, LayoutGrid, Plus, Globe, Images, Minimize2 } from 'lucide-react';

interface CreativeModeProps {
    credentials: ApiCredentials | null;
    onRequestLogin: () => void;
    onImageGenerated: (img: GeneratedAsset) => void;
    setIsRendering: (isRendering: boolean) => void;
    setGeneratingCount: (count: React.SetStateAction<number>) => void;
}

const CreativeMode: React.FC<CreativeModeProps> = ({ 
    credentials, 
    onRequestLogin, 
    onImageGenerated, 
    setIsRendering,
    setGeneratingCount
}) => {
    // Inputs
    const [rawPrompt, setRawPrompt] = useState('');
    const [finalPrompt, setFinalPrompt] = useState('');
    const [vietnameseTranslation, setVietnameseTranslation] = useState('');
    const [refFiles, setRefFiles] = useState<{id: string, file: File, preview: string}[]>([]);
    
    // Config
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.R_16_9);
    const [resolution, setResolution] = useState<Resolution>(Resolution.RES_2K);
    const [count, setCount] = useState(1);
    const [selectedModel, setSelectedModel] = useState<ImageModel>(MODEL_IMAGE_BASE as ImageModel);
    const [intent, setIntent] = useState<CreativeIntent>(CreativeIntent.GENERATE);

    // Status
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [hasOptimized, setHasOptimized] = useState(false);
    const [isLocalRendering, setIsLocalRendering] = useState(false); // Track local loading state for UI toggle
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        // Aspect Ratio constraints - All models now support the same set
        const supportedRatios = [
            AspectRatio.R_16_9, AspectRatio.R_9_16, AspectRatio.R_21_9,
            AspectRatio.R_1_1, AspectRatio.R_4_3, AspectRatio.R_3_4,
            AspectRatio.R_3_2, AspectRatio.R_2_3
        ];
        
        if (!supportedRatios.includes(aspectRatio)) {
            setAspectRatio(AspectRatio.R_16_9);
        }

        // Adjust count if model doesn't support batching
        const maxCount = 4;
        if (count > maxCount) {
            setCount(maxCount);
        }

        // Resolution constraints for seedream-5-0
        if (selectedModel === ImageModel.SEEDREAM_5_0 && resolution === Resolution.RES_4K) {
            setResolution(Resolution.RES_2K);
        }
    }, [selectedModel, resolution, count, aspectRatio]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            processFiles(Array.from(e.target.files));
        }
        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const processFiles = (files: File[]) => {
        // Removed limit check as per user request "k có hạng chế"
        // But we should probably keep a reasonable soft limit or just warn?
        // User said "k có hạng chế", so we remove the alert and return.
        
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
        
        // Handle files from outside
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFiles(Array.from(e.dataTransfer.files));
            return;
        }

        // Handle dragged asset from gallery
        let assetUrl = (window as any).__draggedAssetUrl;
        
        if (!assetUrl) {
            assetUrl = e.dataTransfer.getData('text/plain');
            if (assetUrl === 'internal-drag') assetUrl = null;
        }
        
        if (!assetUrl) assetUrl = e.dataTransfer.getData('text/uri-list');

        // Fallback: HTML
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

    const handleOptimize = async () => {
        if (!credentials) { onRequestLogin(); return; }
        if (!rawPrompt.trim()) { alert("Vui lòng nhập ý tưởng!"); return; }

        setIsOptimizing(true);
        try {
            // Convert images to base64 for Multimodal Analysis
            const refUrls = await Promise.all(refFiles.map(f => fileToDataUrl(f.file)));
            
            const result = await optimizeCreativePrompt(credentials, rawPrompt, refUrls, intent, resolution, aspectRatio);
            
            setFinalPrompt(result.english);
            setVietnameseTranslation(result.vietnamese);
            setHasOptimized(true);
        } catch (e) {
            alert(`Lỗi tối ưu prompt: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            setIsOptimizing(false);
        }
    };

    const handleCloseOptimized = () => {
        setHasOptimized(false);
        setFinalPrompt('');
    };

    const handleRunInBackground = () => {
        // Unblock the main UI
        setIsRendering(false); 
        // Keep local state running if needed (optional visual cue), or just rely on global "Generating Count"
        // But for this button, we mainly want to unlock the tabs.
        setIsLocalRendering(false); 
    };

    const handleGenerate = async () => {
        if (!credentials) { onRequestLogin(); return; }
        
        // Use optimized prompt if available, else raw
        let promptToUse = hasOptimized && finalPrompt ? finalPrompt : rawPrompt;
        if (!promptToUse.trim()) { alert("Vui lòng nhập Prompt!"); return; }

        // Block UI globally initially
        setIsRendering(true);
        setIsLocalRendering(true);
        setGeneratingCount(prev => prev + count);

        let successCount = 0;
        let lastError = "";

        try {
            const refUrls = await Promise.all(refFiles.map(f => fileToDataUrl(f.file)));
            const refThumbUrls = await Promise.all(refFiles.map(f => createThumbnail(f.file)));
            
            // Add pending placeholders
            for (let i = 0; i < count; i++) {
                onImageGenerated({
                    id: `pending_cre_${Date.now()}_${i}`,
                    url: "",
                    timestamp: Date.now(),
                    prompt: promptToUse,
                    ratio: aspectRatio,
                    type: AssetType.IMAGE,
                    metadata: {
                        isPending: true,
                        model: selectedModel,
                        refImages: refThumbUrls
                    }
                });
            }

            try {
                const base64Array = await generateCreativeImage(
                    credentials, 
                    promptToUse, 
                    aspectRatio, 
                    resolution, 
                    refUrls,
                    selectedModel,
                    count
                );
                
                base64Array.forEach((base64, i) => {
                    const newImage: GeneratedAsset = {
                        id: Date.now().toString() + Math.random().toString().slice(2, 6) + i,
                        url: base64,
                        timestamp: Date.now(),
                        prompt: promptToUse,
                        ratio: aspectRatio,
                        type: AssetType.IMAGE,
                        metadata: {
                            model: selectedModel,
                            refImages: refThumbUrls
                        }
                    };
                    onImageGenerated(newImage);
                    successCount++;
                });
            } catch (e) {
                console.error("Gen failed", e);
                lastError = e instanceof Error ? e.message : String(e);
            } finally {
                setGeneratingCount(prev => Math.max(0, prev - count));
            }

            if (successCount === 0 && count > 0) {
                 // Only alert if we are still "waiting", otherwise it might interrupt the user in another tab
                 console.warn(`Gen error: ${lastError}`);
            } 

        } catch (e) {
            console.error(e);
            setGeneratingCount(0);
        } finally {
            setIsRendering(false);
            setIsLocalRendering(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            
            {/* 1. UPLOAD SECTION */}
            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                        <LayoutGrid size={16} /> Ảnh tham chiếu (Tối đa 14)
                    </label>
                    <span className="text-xs text-zinc-500">{refFiles.length}/14</span>
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
                            <span className="text-[10px] text-zinc-600 mt-1">(Để trống nếu muốn Text-to-Image thuần túy)</span>
                        </div>
                    ) : (
                        <div className="space-y-2">
                             <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                                {refFiles.map((f, index) => (
                                    <div 
                                        key={f.id} 
                                        className="relative aspect-square group rounded-lg overflow-hidden border border-zinc-700 bg-black hover:border-zinc-500 transition-colors"
                                    >
                                        <img src={f.preview} className="w-full h-full object-cover" />
                                        
                                        {/* Simple overlay number */}
                                        <div className="absolute top-1 left-1 bg-black/50 backdrop-blur-sm rounded-full w-5 h-5 flex items-center justify-center text-[9px] text-white/80 font-mono border border-white/10">
                                            {index + 1}
                                        </div>

                                        <button 
                                            onClick={() => removeFile(f.id)}
                                            className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-red-600 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <XCircle size={14} />
                                        </button>
                                    </div>
                                ))}
                                {refFiles.length < 14 && (
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="aspect-square rounded-lg border border-zinc-700 border-dashed flex flex-col items-center justify-center text-zinc-500 hover:text-white hover:border-zinc-500 bg-zinc-900/50"
                                    >
                                        <Plus size={20} />
                                        <span className="text-[10px] mt-1">Thêm</span>
                                    </button>
                                )}
                            </div>
                            <p className="text-[10px] text-zinc-500 italic pl-1 flex items-center gap-1.5">
                                <Images size={12}/>
                                AI sẽ phân tích nội dung của tất cả ảnh này để sáng tạo hình ảnh mới (Multimodal).
                            </p>
                        </div>
                    )}
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" multiple accept="image/*" />
            </div>

            {/* 2. PROMPT SECTION */}
            <div className="space-y-3">
                <div className="flex flex-col gap-2 mb-2">
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-zinc-400">Mục đích:</label>
                        <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                            <button 
                                onClick={() => setIntent(CreativeIntent.GENERATE)}
                                className={`px-3 py-1 text-xs rounded-md transition-all ${intent === CreativeIntent.GENERATE ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                Tạo Mới
                            </button>
                            <button 
                                onClick={() => setIntent(CreativeIntent.EDIT)}
                                className={`px-3 py-1 text-xs rounded-md transition-all ${intent === CreativeIntent.EDIT ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                Chỉnh Sửa
                            </button>
                            <button 
                                onClick={() => setIntent(CreativeIntent.COMBINE)}
                                className={`px-3 py-1 text-xs rounded-md transition-all ${intent === CreativeIntent.COMBINE ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                Kết Hợp
                            </button>
                            <button 
                                onClick={() => setIntent(CreativeIntent.CUSTOM)}
                                className={`px-3 py-1 text-xs rounded-md transition-all ${intent === CreativeIntent.CUSTOM ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                Tuỳ chỉnh
                            </button>
                        </div>
                    </div>
                    {intent === CreativeIntent.EDIT && <p className="text-[10px] text-blue-400 italic">Chế độ Chỉnh Sửa: AI sẽ cố gắng giữ nguyên tone màu, ánh sáng và bối cảnh gốc, chỉ thay đổi các chi tiết bạn yêu cầu.</p>}
                    {intent === CreativeIntent.COMBINE && <p className="text-[10px] text-green-400 italic">Chế độ Kết Hợp: AI sẽ tập trung mix các chi tiết từ các ảnh tham chiếu theo đúng yêu cầu của bạn, hạn chế sáng tạo thêm.</p>}
                    {intent === CreativeIntent.CUSTOM && <p className="text-[10px] text-purple-400 italic">Chế độ Tuỳ chỉnh: AI chỉ tối ưu lại những gì bạn nhập, không thêm thông tin text nào để quy định bức hình.</p>}
                </div>

                <label className="text-sm font-medium text-zinc-400">Ý tưởng hình ảnh (Prompt)</label>
                
                {/* Input Area */}
                <textarea 
                    value={rawPrompt}
                    onChange={(e) => setRawPrompt(e.target.value)}
                    placeholder="Mô tả hình ảnh bạn muốn tạo (Ví dụ: Một chiến binh Cyberpunk đứng dưới mưa neon...)"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm text-white focus:border-cinema-accent h-24 resize-none"
                />

                {/* Optimize Button */}
                <button
                    onClick={handleOptimize}
                    disabled={isOptimizing}
                    className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-xs font-bold text-zinc-300 flex items-center justify-center gap-2 transition-colors"
                >
                    {isOptimizing ? <Loader2 className="animate-spin" size={14} /> : <Wand2 size={14} className="text-purple-400" />}
                    {isOptimizing ? "Đang viết lại prompt (Kết hợp phân tích ảnh)..." : "Tối ưu hóa & Dịch sang Tiếng Anh chuẩn"}
                </button>

                {/* Optimized Result */}
                {hasOptimized && (
                    <div className="bg-zinc-900/80 border border-purple-900/30 rounded-xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2">
                        <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
                             <div className="flex items-center gap-2 text-purple-400 text-xs font-bold">
                                <Wand2 size={12} /> Prompt đã tối ưu
                             </div>
                             <button onClick={handleCloseOptimized} className="text-[10px] text-zinc-500 hover:text-zinc-300">Đóng</button>
                        </div>
                        
                        {/* English Prompt (Editable) */}
                        <div>
                            <div className="flex justify-between mb-1">
                                <span className="text-[10px] text-zinc-500 uppercase font-bold">English (Final Input)</span>
                                <button onClick={() => navigator.clipboard.writeText(finalPrompt)} className="text-zinc-500 hover:text-white"><Copy size={10}/></button>
                            </div>
                            <textarea 
                                value={finalPrompt}
                                onChange={(e) => setFinalPrompt(e.target.value)}
                                className="w-full h-24 bg-black/40 border border-zinc-700 rounded p-2 text-xs font-mono text-zinc-300 focus:border-purple-500"
                            />
                        </div>

                        {/* Vietnamese Translation */}
                        <div className="bg-zinc-800/50 rounded p-2 flex gap-2">
                            <Globe className="shrink-0 text-zinc-500 mt-0.5" size={14} />
                            <div>
                                <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Tiếng Việt (Giải nghĩa)</div>
                                <p className="text-xs text-zinc-400 italic leading-relaxed">{vietnameseTranslation}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 3. SETTINGS & GENERATE */}
            <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 space-y-4">
                <div className="mb-1">
                    <label className="block text-[10px] text-zinc-500 mb-1 font-bold uppercase">Model Tạo Ảnh</label>
                    <select 
                        value={selectedModel} 
                        onChange={(e) => setSelectedModel(e.target.value as ImageModel)} 
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-md p-2 text-xs text-white"
                    >
                        {IMAGE_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                    <div>
                        <label className="block text-[10px] text-zinc-500 mb-1 font-bold uppercase">Tỉ lệ</label>
                        <select 
                            value={aspectRatio} 
                            onChange={(e) => setAspectRatio(e.target.value as AspectRatio)} 
                            className="w-full bg-zinc-950 border border-zinc-700 rounded-md p-2 text-xs text-white"
                        >
                            {ASPECT_RATIOS.filter(r => {
                                return [
                                    AspectRatio.R_16_9, AspectRatio.R_9_16, AspectRatio.R_21_9,
                                    AspectRatio.R_1_1, AspectRatio.R_4_3, AspectRatio.R_3_4,
                                    AspectRatio.R_3_2, AspectRatio.R_2_3
                                ].includes(r.value);
                            }).map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] text-zinc-500 mb-1 font-bold uppercase">Số lượng</label>
                        <select 
                            value={count} 
                            onChange={(e) => setCount(Number(e.target.value))} 
                            className="w-full bg-zinc-950 border border-zinc-700 rounded-md p-2 text-xs text-white"
                        >
                            {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n} ảnh</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] text-zinc-500 mb-1 font-bold uppercase">Chất lượng</label>
                        <select 
                            value={resolution} 
                            onChange={(e) => setResolution(e.target.value as Resolution)} 
                            className="w-full bg-zinc-950 border border-zinc-700 rounded-md p-2 text-xs text-white"
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

                {isLocalRendering ? (
                    <div className="flex gap-2">
                        <button disabled className="flex-1 py-3 bg-zinc-800 rounded-lg text-zinc-400 flex items-center justify-center gap-2 font-bold cursor-wait">
                            <Loader2 className="animate-spin" size={18} /> Đang tạo ảnh...
                        </button>
                        <button 
                            onClick={handleRunInBackground} 
                            className="px-4 bg-purple-900/20 text-purple-400 border border-purple-900/50 rounded-lg hover:bg-purple-900/40 flex items-center justify-center"
                            title="Chạy ngầm & Mở khóa tab"
                        >
                            <Minimize2 size={20} />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={handleGenerate}
                        className="w-full py-3 rounded-lg font-bold text-base flex items-center justify-center gap-2 transition-all bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-900/30"
                    >
                        <Zap className="w-5 h-5 fill-white" />
                        Tạo Ảnh Nghệ Thuật
                    </button>
                )}
            </div>
        </div>
    );
};

export default CreativeMode;