import React, { useState, useEffect, useRef } from 'react';
import { GeneratedAsset, AssetType } from '../types';
import { Download, X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, FileText, Play, Pause, Volume2, VolumeX, Mic, Copy } from 'lucide-react';

interface ImageViewerProps {
  asset: GeneratedAsset | null;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ 
    asset, 
    onClose, 
    onNext, 
    onPrev, 
    hasNext, 
    hasPrev 
}) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  
  const dragStartRef = useRef({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Reset zoom when asset changes
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setIsPlaying(true);
  }, [asset]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && hasNext && onNext) onNext();
      if (e.key === 'ArrowLeft' && hasPrev && onPrev) onPrev();
      if (e.key === 'Escape') onClose();
      if (e.key === ' ' && asset?.type === AssetType.VIDEO) {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasNext, hasPrev, onNext, onPrev, onClose, asset]);

  if (!asset) return null;

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleZoomIn = () => setScale(p => Math.min(p + 0.5, 4));
  const handleZoomOut = () => {
    setScale(p => {
        const newScale = Math.max(p - 0.5, 0.5);
        if (newScale <= 1) setPosition({ x: 0, y: 0 }); // Reset pos if zoomed out
        return newScale;
    });
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.deltaY < 0) handleZoomIn();
    else handleZoomOut();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX - position.x, y: e.clientY - position.y };
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md select-none">
      
      {/* Top Controls */}
      <div className={`absolute top-4 right-4 flex items-center gap-2 z-50 transition-transform duration-300 ${showPrompt ? '-translate-x-80' : ''}`}>
        <button 
          onClick={() => setShowPrompt(!showPrompt)}
          className={`p-2 rounded-full transition-colors ${showPrompt ? 'bg-cinema-accent text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
          title="Xem Prompt Tư Duy"
        >
          <FileText size={24} />
        </button>
         <a 
          href={asset.url} 
          download={`${asset.type === AssetType.AUDIO && asset.prompt ? asset.prompt.replace(/[<>:"/\\|?*]/g, '').trim() : `asset_${asset.id}`}.${asset.type === AssetType.VIDEO ? 'mp4' : asset.type === AssetType.AUDIO ? asset.metadata?.resolution?.toLowerCase() || 'mp3' : 'png'}`}
          className="p-2 bg-zinc-800 rounded-full hover:bg-zinc-700 text-white transition-colors"
          title="Tải về"
          onClick={(e) => e.stopPropagation()}
        >
          <Download size={24} />
        </a>
        <button 
          onClick={onClose}
          className="p-2 bg-zinc-800 rounded-full hover:bg-zinc-700 text-white transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      {/* Nav Buttons (Left/Right) */}
      {hasPrev && (
        <button 
            onClick={(e) => { e.stopPropagation(); onPrev && onPrev(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-zinc-800/50 hover:bg-zinc-700 rounded-full text-white z-50 backdrop-blur-sm transition-all"
        >
            <ChevronLeft size={32} />
        </button>
      )}
      {hasNext && (
        <button 
            onClick={(e) => { e.stopPropagation(); onNext && onNext(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-zinc-800/50 hover:bg-zinc-700 rounded-full text-white z-50 backdrop-blur-sm transition-all"
        >
            <ChevronRight size={32} />
        </button>
      )}

      {/* Bottom Controls */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-zinc-900/80 px-6 py-2 rounded-full z-50 shadow-lg border border-zinc-800">
        {asset.type === AssetType.VIDEO && (
            <>
                <button onClick={togglePlay} className="text-white hover:text-cinema-accent">
                    {isPlaying ? <Pause size={20}/> : <Play size={20}/>}
                </button>
                <button onClick={toggleMute} className="text-white hover:text-cinema-accent">
                    {isMuted ? <VolumeX size={20}/> : <Volume2 size={20}/>}
                </button>
                <div className="w-px h-4 bg-zinc-700 mx-1" />
            </>
        )}
        {asset.type !== AssetType.AUDIO && (
            <>
                <button onClick={handleZoomOut} className="text-white hover:text-cinema-accent"><ZoomOut size={20}/></button>
                <span className="text-sm text-zinc-300 w-12 text-center font-mono">{Math.round(scale * 100)}%</span>
                <button onClick={handleZoomIn} className="text-white hover:text-cinema-accent"><ZoomIn size={20}/></button>
            </>
        )}
      </div>

      {/* Content Area */}
      <div 
        className={`w-full h-full flex items-center justify-center overflow-hidden transition-all duration-300 ${showPrompt ? 'pr-80' : ''}`}
        onWheel={asset.type !== AssetType.AUDIO ? handleWheel : undefined}
        onMouseDown={asset.type !== AssetType.AUDIO ? handleMouseDown : undefined}
        onMouseMove={asset.type !== AssetType.AUDIO ? handleMouseMove : undefined}
        onMouseUp={asset.type !== AssetType.AUDIO ? handleMouseUp : undefined}
        onMouseLeave={asset.type !== AssetType.AUDIO ? handleMouseUp : undefined}
        style={{ cursor: asset.type !== AssetType.AUDIO && scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
      >
        {asset.type === AssetType.VIDEO ? (
            <video 
                ref={videoRef}
                src={asset.url}
                autoPlay
                loop
                muted={isMuted}
                className="max-w-none transition-transform duration-100 linear"
                style={{ 
                    transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                    maxHeight: scale === 1 ? '90vh' : 'none',
                    maxWidth: scale === 1 ? '90vw' : 'none',
                }}
                onClick={togglePlay}
            />
        ) : asset.type === AssetType.AUDIO ? (
            <div className="flex flex-col items-center justify-center bg-zinc-900 p-12 rounded-3xl border border-zinc-800 shadow-2xl max-w-md w-full mx-4">
                <div className="w-24 h-24 bg-zinc-800 rounded-full flex items-center justify-center mb-8 shadow-inner border border-zinc-700">
                    <Mic className="text-cinema-accent" size={40} />
                </div>
                <audio 
                    src={asset.url} 
                    controls 
                    autoPlay 
                    className="w-full"
                />
                <div className="mt-6 text-center">
                    <p className="text-zinc-400 text-sm font-medium mb-1">Giọng đọc: <span className="text-white capitalize">{asset.metadata?.voice || 'Unknown'}</span></p>
                    <p className="text-zinc-500 text-xs">Định dạng: {asset.metadata?.resolution || 'MP3'}</p>
                </div>
            </div>
        ) : (
            <img 
                ref={imgRef}
                src={asset.url} 
                alt={asset.prompt} 
                className="max-w-none transition-transform duration-100 linear"
                style={{ 
                    transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                    maxHeight: scale === 1 ? '90vh' : 'none',
                    maxWidth: scale === 1 ? '90vw' : 'none',
                }}
                draggable={false}
            />
        )}
      </div>

      {/* Prompt Sidebar */}
      <div className={`absolute top-0 right-0 w-80 h-full bg-zinc-900/95 border-l border-zinc-700 p-6 transform transition-transform duration-300 overflow-y-auto ${showPrompt ? 'translate-x-0' : 'translate-x-full'}`}>
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <FileText size={18} />
            Prompt Tư Duy
        </h3>
        <div className="text-xs text-zinc-500 mb-4">
            Đây là những gì AI "nhìn thấy" từ dữ liệu bạn gửi và mô tả lại để tạo kết quả.
        </div>
        
        {asset.metadata && (
            <div className="bg-zinc-800 rounded-lg p-3 mb-4 space-y-2">
                <div className="flex justify-between text-[10px] uppercase font-bold text-zinc-500">
                    <span>Thông tin {asset.type === AssetType.AUDIO ? 'Audio' : asset.type === AssetType.IMAGE ? 'Ảnh' : 'Video'}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                    {asset.type === AssetType.AUDIO ? (
                        <>
                            <div className="text-zinc-400">Giọng đọc: <span className="text-white capitalize">{asset.metadata.voice}</span></div>
                            <div className="text-zinc-400">Định dạng: <span className="text-white">{asset.metadata.resolution}</span></div>
                        </>
                    ) : asset.type === AssetType.IMAGE ? (
                        <>
                            <div className="text-zinc-400">Tỉ lệ: <span className="text-white">{asset.ratio}</span></div>
                            <div className="text-zinc-400">Độ phân giải: <span className="text-white">{asset.metadata.resolution}</span></div>
                            {asset.metadata.model && <div className="text-zinc-400 col-span-2">Model: <span className="text-white">{asset.metadata.model}</span></div>}
                        </>
                    ) : (
                        <>
                            <div className="text-zinc-400">Thời lượng: <span className="text-white">{asset.metadata.duration}s</span></div>
                            <div className="text-zinc-400">Độ phân giải: <span className="text-white">{asset.metadata.resolution}</span></div>
                            {asset.metadata.tokens && <div className="text-zinc-400 col-span-2">Tokens: <span className="text-white">{asset.metadata.tokens.toLocaleString()}</span></div>}
                        </>
                    )}
                </div>
            </div>
        )}

        {asset.metadata?.refImages && asset.metadata.refImages.length > 0 && (
            <div className="mb-4">
                <div className="text-[10px] uppercase font-bold text-zinc-500 mb-2">Ảnh tham chiếu ({asset.metadata.refImages.length})</div>
                <div className="flex flex-wrap gap-2">
                    {asset.metadata.refImages.map((img, idx) => (
                        <img key={idx} src={img} alt={`Ref ${idx}`} className="w-12 h-12 object-cover rounded-md border border-zinc-700 opacity-80 hover:opacity-100 transition-opacity" />
                    ))}
                </div>
            </div>
        )}

        <div className="relative group">
            <div className="text-[10px] uppercase font-bold text-zinc-500 mb-2">Prompt</div>
            <p className="text-sm text-zinc-300 leading-relaxed font-mono whitespace-pre-wrap bg-zinc-800/50 p-3 rounded-lg border border-zinc-700/50 select-text">
                {asset.prompt}
            </p>
            <button 
                onClick={() => {
                    navigator.clipboard.writeText(asset.prompt);
                    // Optional: could add a toast here
                }}
                className="absolute top-6 right-2 p-2 bg-zinc-700 rounded-md text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-zinc-600 hover:text-white shadow-md"
                title="Copy Prompt"
            >
                <Copy size={14} />
            </button>
        </div>
      </div>
    </div>
  );
};

export default ImageViewer;