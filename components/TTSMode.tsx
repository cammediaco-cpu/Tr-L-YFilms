import React, { useState, useRef, useEffect } from 'react';
import { ApiCredentials, GeneratedAsset, AssetType, VoiceProfile } from '../types';
import { generateSpeech } from '../services/ttsService';
import { Mic, Play, Loader2, AlertCircle, Square, Star, Info, Settings2, Plus, Edit2, Trash2, Download, Upload, X } from 'lucide-react';
import VoiceProfileModal from './VoiceProfileModal';

interface TTSModeProps {
  creds: ApiCredentials;
  onAssetGenerated: (asset: GeneratedAsset) => void;
}

const VOICES = [
  'alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 
  'nova', 'onyx', 'sage', 'shimmer', 'verse', 'marin', 'cedar'
] as const;

type Voice = typeof VOICES[number];

interface VoiceOption {
  id: Voice;
  name: string;
  description: string;
  recommended?: boolean;
  previewUrl: string;
}

const VOICE_OPTIONS: VoiceOption[] = [
  { id: 'alloy', name: 'Alloy', description: 'Giọng trung tính, đa năng, phù hợp cho nhiều mục đích.', recommended: true, previewUrl: '/previews/alloy.flac' },
  { id: 'nova', name: 'Nova', description: 'Giọng nữ năng động, chuyên nghiệp, tự nhiên.', recommended: true, previewUrl: '/previews/nova.flac' },
  { id: 'shimmer', name: 'Shimmer', description: 'Giọng nữ sáng, rõ ràng, truyền cảm.', recommended: true, previewUrl: '/previews/shimmer.flac' },
  { id: 'echo', name: 'Echo', description: 'Giọng nam ấm áp, vang và tròn vành rõ chữ.', previewUrl: '/previews/echo.flac' },
  { id: 'fable', name: 'Fable', description: 'Giọng nam diễn cảm, phù hợp kể chuyện hoặc podcast.', previewUrl: '/previews/fable.flac' },
  { id: 'onyx', name: 'Onyx', description: 'Giọng nam trầm ấm, uy lực và đáng tin cậy.', previewUrl: '/previews/onyx.flac' },
  { id: 'ash', name: 'Ash', description: 'Giọng nam nhẹ nhàng, điềm tĩnh và thư giãn.', previewUrl: '/previews/ash.flac' },
  { id: 'ballad', name: 'Ballad', description: 'Giọng nam truyền cảm, ấm áp và giàu cảm xúc.', previewUrl: '/previews/ballad.flac' },
  { id: 'coral', name: 'Coral', description: 'Giọng nữ ngọt ngào, thân thiện và dễ gần.', previewUrl: '/previews/coral.flac' },
  { id: 'sage', name: 'Sage', description: 'Giọng nữ trưởng thành, điềm đạm và đáng tin cậy.', previewUrl: '/previews/sage.flac' },
  { id: 'verse', name: 'Verse', description: 'Giọng nam năng động, hiện đại và lôi cuốn.', previewUrl: '/previews/verse.flac' },
  { id: 'marin', name: 'Marin', description: 'Giọng tự nhiên, nhẹ nhàng, phù hợp đàm thoại.', previewUrl: '/previews/marin.flac' },
  { id: 'cedar', name: 'Cedar', description: 'Giọng trầm, vang và rõ ràng, thích hợp đọc tin tức.', previewUrl: '/previews/cedar.flac' },
];

const FORMATS = ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm'] as const;

const TTSMode: React.FC<TTSModeProps> = ({ creds, onAssetGenerated }) => {
  const [text, setText] = useState('');
  const [instructions, setInstructions] = useState('');
  const [voice, setVoice] = useState<Voice>('alloy');
  const [voiceProfiles, setVoiceProfiles] = useState<VoiceProfile[]>([]);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Load profiles from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('tts_voice_profiles');
    if (saved) {
      try {
        setVoiceProfiles(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse voice profiles', e);
      }
    }
  }, []);

  // Save profiles to localStorage
  useEffect(() => {
    localStorage.setItem('tts_voice_profiles', JSON.stringify(voiceProfiles));
  }, [voiceProfiles]);
  const [format, setFormat] = useState<typeof FORMATS[number]>('mp3');
  const [speed, setSpeed] = useState<number>(1.0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [playingPreview, setPlayingPreview] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playPreview = (voiceId: string, previewUrl: string) => {
    if (playingPreview === voiceId) {
      audioRef.current?.pause();
      setPlayingPreview(null);
    } else {
      if (audioRef.current) {
        audioRef.current.src = previewUrl;
        audioRef.current.play().catch(e => {
            console.error("Preview play failed", e);
        });
        setPlayingPreview(voiceId);
      }
    }
  };

  const handleGenerate = async () => {
    if (!text.trim()) {
      setError('Vui lòng nhập nội dung văn bản');
      return;
    }

    if (!creds.openAiApiKey) {
      setError('Vui lòng cấu hình OpenAI API Key trong phần cài đặt');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const { url } = await generateSpeech(creds, text, voice, format, instructions, speed);
      
      const newAsset: GeneratedAsset = {
        id: `audio-${Date.now()}`,
        url,
        timestamp: Date.now(),
        prompt: text.substring(0, 45) + (text.length > 45 ? '...' : ''),
        ratio: '1:1',
        type: AssetType.AUDIO,
        metadata: {
          voice,
          resolution: format.toUpperCase()
        }
      };

      onAssetGenerated(newAsset);
      setText(''); // Clear input after success
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra khi tạo audio');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-white p-6 overflow-y-auto">
      <div className="max-w-3xl w-full mx-auto space-y-6">
        
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Mic className="text-cinema-accent" />
            Text to Speech
          </h2>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-900/30 border border-red-800 text-red-200 p-4 rounded-xl flex items-start gap-3">
            <AlertCircle className="shrink-0 mt-0.5" size={18} />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* 1. Select Voice */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <label className="block text-sm font-medium text-zinc-300 mb-4">Chọn Giọng đọc (Voice)</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {VOICE_OPTIONS.map(v => (
              <div 
                key={v.id}
                onClick={() => setVoice(v.id)}
                title={v.description}
                className={`relative flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all group ${
                  voice === v.id 
                    ? 'border-cinema-accent bg-cinema-accent/10 shadow-md' 
                    : 'border-zinc-800 bg-zinc-950 hover:border-zinc-600'
                }`}
              >
                {v.recommended && (
                  <div className="absolute -top-2 -right-2 bg-cinema-accent text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-lg">
                    <Star size={8} className="fill-white" />
                  </div>
                )}
                <span className={`font-medium text-sm ${voice === v.id ? 'text-cinema-accent' : 'text-zinc-300'}`}>
                  {v.name}
                </span>
                <button 
                  onClick={(e) => { e.stopPropagation(); playPreview(v.id, v.previewUrl); }}
                  className={`p-1.5 rounded-full transition-colors ${
                    playingPreview === v.id 
                      ? 'bg-cinema-accent text-white' 
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
                  }`}
                >
                  {playingPreview === v.id ? <Square size={12} className="fill-current" /> : <Play size={12} className="fill-current" />}
                </button>
              </div>
            ))}
            <div 
              onClick={() => setShowProfileModal(true)}
              className="col-span-2 sm:col-span-2 flex items-center justify-center p-3 rounded-xl border border-indigo-500/30 bg-indigo-950/40 hover:bg-indigo-900/60 hover:border-indigo-500/50 cursor-pointer transition-all text-indigo-300 hover:text-white group"
            >
              <Settings2 size={16} className="mr-2 group-hover:rotate-90 transition-transform duration-500" />
              <span className="font-bold text-xs uppercase tracking-wider">Hồ sơ giọng đọc (Profiles)</span>
            </div>
          </div>
        </div>

        {/* 2. Voice Prompt */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Prompt mô tả giọng đọc (Tuỳ chọn)
          </label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            maxLength={4096}
            placeholder="Ví dụ: Đọc với giọng điệu vui vẻ, hào hứng..."
            className="w-full h-24 bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-cinema-accent resize-none transition-colors"
          />
        </div>

        {/* 3. Text Content */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Nội dung văn bản
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={4096}
            placeholder="Nhập nội dung cần chuyển đổi thành giọng nói..."
            className="w-full h-48 bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-cinema-accent resize-none transition-colors"
          />
        </div>

        {/* 4. Speed */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <label className="block text-sm font-medium text-zinc-300 mb-2 flex justify-between">
            <span>Tốc độ</span>
            <span className="text-cinema-accent">{speed.toFixed(2)}x</span>
          </label>
          <div className="flex items-center gap-4">
            <input 
              type="range" 
              min="0.25" 
              max="4.0" 
              step="0.05" 
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="flex-grow h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cinema-accent"
            />
            <button 
              onClick={() => setSpeed(1.0)}
              className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-xs rounded-lg transition-colors"
            >
              Reset 1.00
            </button>
          </div>
        </div>

        {/* 5. Bottom: Format and Create */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex items-center gap-4">
          <div className="flex-grow">
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Định dạng
            </label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as typeof FORMATS[number])}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-cinema-accent appearance-none"
            >
              {FORMATS.map(f => (
                <option key={f} value={f}>{f.toUpperCase()}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !text.trim()}
            className="bg-cinema-accent hover:bg-rose-700 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-bold py-3 px-8 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-900/20"
          >
            {isGenerating ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Đang tạo...
              </>
            ) : (
              <>
                <Mic size={20} />
                Tạo
              </>
            )}
          </button>
        </div>

      </div>
      
      {/* Hidden Audio Element for Previews */}
      <audio 
        ref={audioRef} 
        onEnded={() => setPlayingPreview(null)} 
        className="hidden" 
      />
      
      <VoiceProfileModal 
        isOpen={showProfileModal} 
        onClose={() => setShowProfileModal(false)} 
        profiles={voiceProfiles} 
        onSave={setVoiceProfiles} 
        availableVoices={VOICES}
        onSelect={(profile) => {
          if (VOICES.includes(profile.voice as Voice)) {
            setVoice(profile.voice as Voice);
          }
          setInstructions(profile.prompt);
        }}
      />
    </div>
  );
};

export default TTSMode;
