import React, { useEffect, useState } from 'react';
import { ApiCredentials, TextModel } from '../types';
import { Key, Server, LogIn, AlertTriangle, Globe, ShieldAlert, Wifi, Cloud, Clapperboard, Video, Brain } from 'lucide-react';
import { TEXT_MODELS, MODEL_REASONING } from '../constants';

interface ApiKeyModalProps {
  onCredentialsSubmit: (creds: ApiCredentials) => void;
}

// Form kết nối API
const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ onCredentialsSubmit }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [openAiApiKey, setOpenAiApiKey] = useState('');
  const [reasoningModel, setReasoningModel] = useState(MODEL_REASONING);
  
  // Detection states
  const [isHttps, setIsHttps] = useState(false);
  const [isLocalhost, setIsLocalhost] = useState(false);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setIsHttps(window.location.protocol === 'https:');

    const storedBaseUrl = localStorage.getItem('app_base_url');
    const storedApiKey = localStorage.getItem('app_api_key');
    const storedOpenAiApiKey = localStorage.getItem('app_openai_api_key');
    const storedReasoningModel = localStorage.getItem('app_reasoning_model');

    if (storedBaseUrl) {
        setBaseUrl(storedBaseUrl);
        setIsLocalhost(checkIsLocal(storedBaseUrl));
    }
    if (storedApiKey) setApiKey(storedApiKey);
    if (storedOpenAiApiKey) setOpenAiApiKey(storedOpenAiApiKey);
    if (storedReasoningModel) setReasoningModel(storedReasoningModel as TextModel);
    
    if (!storedBaseUrl) setIsLocalhost(false);
  }, []);

  const checkIsLocal = (url: string) => {
      return url.includes('127.0.0.1') || url.includes('localhost') || url.startsWith('http://0.0.0.0') || url.startsWith('http://192.168.');
  };

  const handleBaseUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setBaseUrl(val);
      setIsLocalhost(checkIsLocal(val));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!baseUrl || !apiKey) {
        alert("Vui lòng nhập đầy đủ thông tin");
        return;
    }

    let formattedUrl = baseUrl;
    if (formattedUrl.endsWith('/')) {
        formattedUrl = formattedUrl.slice(0, -1);
    }

    localStorage.setItem('app_base_url', formattedUrl);
    localStorage.setItem('app_api_key', apiKey);
    localStorage.setItem('app_openai_api_key', openAiApiKey);
    localStorage.setItem('app_reasoning_model', reasoningModel);

    onCredentialsSubmit({ 
      baseUrl: formattedUrl, 
      apiKey,
      openAiApiKey,
      reasoningModel
    });
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md px-4 overflow-y-auto py-10">
      <div className="bg-cinema-gray border border-zinc-700 p-8 rounded-xl max-w-lg w-full shadow-2xl relative overflow-hidden my-auto">
        
        <div className="text-center mb-6 relative z-10 flex flex-col items-center">
            {/* Logo Image with Fallback */}
            {logoError ? (
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-cinema-accent to-rose-800 flex items-center justify-center shadow-2xl mb-4 border border-zinc-700">
                    <Clapperboard className="text-white" size={32} />
                </div>
            ) : (
                <img 
                    src="/Yfilms%20BytePlus.png" 
                    alt="Logo" 
                    className="w-16 h-16 rounded-xl shadow-2xl mb-4 border border-zinc-700 object-cover" 
                    onError={() => setLogoError(true)}
                />
            )}
            <h2 className="text-2xl font-bold text-white">Kết Nối Trợ Lý YFilms</h2>
            <p className="text-zinc-400 text-sm mt-2">Cấu hình Server</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
            <div>
                <label className="block text-xs font-medium text-zinc-500 mb-2 flex items-center gap-2">
                    <Server size={14} /> Base URL (API Endpoint)
                </label>
                
                {/* Suggestions Chips removed as requested */}

                <div className="relative">
                    <input 
                        type="text" 
                        value={baseUrl}
                        onChange={handleBaseUrlChange}
                        placeholder="Nhập Base URL..."
                        className={`w-full bg-zinc-900 border rounded-lg p-3 pl-10 text-sm text-white focus:outline-none transition-colors ${
                            isHttps && isLocalhost ? 'border-yellow-600 focus:border-yellow-500' : 'border-zinc-700 focus:border-cinema-accent'
                        }`}
                    />
                    <div className="absolute left-3 top-3 text-zinc-500">
                        {isLocalhost ? <ShieldAlert size={16} className={isHttps ? "text-yellow-500" : ""} /> : <Globe size={16} />}
                    </div>
                </div>
            </div>

            <div>
                <label className="block text-xs font-medium text-zinc-500 mb-2 flex items-center gap-2">
                    <Key size={14} /> API Key
                </label>
                <input 
                    type="password" 
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-cinema-accent transition-colors"
                />
            </div>

            {/* Reasoning Model Config */}
            <div className="pt-4 border-t border-zinc-800 space-y-4">
                <h3 className="text-xs font-bold text-cinema-accent uppercase flex items-center gap-2">
                    <Brain size={14} /> Cấu hình Model Tối ưu Prompt
                </h3>
                
                <div>
                    <label className="block text-[10px] font-medium text-zinc-500 mb-1">
                        Model Văn Bản (Text Chat)
                    </label>
                    <select 
                        value={reasoningModel}
                        onChange={(e) => setReasoningModel(e.target.value as TextModel)}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-xs text-white focus:border-cinema-accent focus:outline-none"
                    >
                        {TEXT_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                </div>
            </div>

            {/* OpenAI TTS Config */}
            <div className="pt-4 border-t border-zinc-800 space-y-4">
                <h3 className="text-xs font-bold text-cinema-accent uppercase flex items-center gap-2">
                    <Cloud size={14} /> Cấu hình OpenAI (TTS)
                </h3>
                
                <div>
                    <label className="block text-[10px] font-medium text-zinc-500 mb-1">
                        OpenAI API Key
                    </label>
                    <input 
                        type="password" 
                        value={openAiApiKey}
                        onChange={(e) => setOpenAiApiKey(e.target.value)}
                        placeholder="sk-proj-..."
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-xs text-white focus:border-cinema-accent focus:outline-none"
                    />
                </div>
            </div>

            <button
                type="submit"
                className="w-full bg-cinema-accent hover:bg-rose-700 text-white font-bold py-3 px-6 rounded-lg transition-all flex items-center justify-center gap-2 mt-4"
            >
                <LogIn size={18} />
                Kết nối Server
            </button>
        </form>
        
        <div className="mt-6 text-[10px] text-zinc-600 border-t border-zinc-800 pt-4 flex justify-between gap-4">
             <span>Seed (Scripting/Reasoning)</span>
             <span>Seedream (Generation)</span>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;