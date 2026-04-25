import React, { useState } from 'react';
import { VoiceProfile } from '../types';
import { X, Plus, Edit2, Trash2, Download, Upload } from 'lucide-react';

interface VoiceProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profiles: VoiceProfile[];
  onSave: (profiles: VoiceProfile[]) => void;
  onSelect: (profile: VoiceProfile) => void;
  availableVoices: readonly string[];
}

const VoiceProfileModal: React.FC<VoiceProfileModalProps> = ({ isOpen, onClose, profiles, onSave, onSelect, availableVoices }) => {
  const [editingProfile, setEditingProfile] = useState<VoiceProfile | null>(null);
  const [name, setName] = useState('');
  const [voice, setVoice] = useState('alloy');
  const [prompt, setPrompt] = useState('');

  if (!isOpen) return null;

  const handleSave = () => {
    if (editingProfile) {
      onSave(profiles.map(p => p.id === editingProfile.id ? { ...p, name, voice, prompt } : p));
    } else {
      onSave([...profiles, { id: Date.now().toString(), name, voice, prompt }]);
    }
    setEditingProfile(null);
    setName('');
    setVoice('alloy');
    setPrompt('');
  };

  const handleDelete = (id: string) => {
    onSave(profiles.filter(p => p.id !== id));
  };

  const exportProfiles = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(profiles));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "voice_profiles.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const importProfiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const imported = JSON.parse(content);
          if (Array.isArray(imported)) {
            onSave(imported);
          } else {
            alert('Định dạng tệp không hợp lệ. Phải là một mảng các hồ sơ.');
          }
        } catch (err) {
          alert('Lỗi khi đọc tệp JSON. Vui lòng kiểm tra lại.');
          console.error(err);
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">Quản lý Hồ sơ Giọng đọc</h2>
            <p className="text-[10px] text-zinc-500 mt-0.5 italic">Hồ sơ được lưu trữ an toàn trong trình duyệt của bạn.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full transition-colors"><X size={24} className="text-zinc-500 hover:text-white" /></button>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-4 mb-8">
          <div className="flex items-center gap-2 text-cinema-accent text-sm font-bold mb-2">
            <Plus size={16} />
            <span>{editingProfile ? 'Chỉnh sửa hồ sơ' : 'Thêm hồ sơ mới'}</span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold ml-1">Tên hồ sơ</label>
              <input 
                type="text" 
                placeholder="Ví dụ: Giọng kể chuyện vui" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                className="w-full bg-zinc-900 border border-zinc-800 p-2.5 rounded-lg text-sm text-white focus:border-cinema-accent outline-none transition-colors" 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold ml-1">Giọng đọc</label>
              <select 
                value={voice} 
                onChange={e => setVoice(e.target.value)} 
                className="w-full bg-zinc-900 border border-zinc-800 p-2.5 rounded-lg text-sm text-white focus:border-cinema-accent outline-none transition-colors appearance-none"
              >
                {availableVoices.map(v => (
                  <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold ml-1">Prompt mô tả (Tuỳ chọn)</label>
            <textarea 
              placeholder="Ví dụ: Đọc chậm rãi, nhấn nhá ở các đoạn quan trọng..." 
              value={prompt} 
              onChange={e => setPrompt(e.target.value)} 
              className="w-full h-20 bg-zinc-900 border border-zinc-800 p-3 rounded-lg text-sm text-white focus:border-cinema-accent outline-none transition-colors resize-none" 
            />
          </div>

          <div className="flex justify-end gap-3">
            {editingProfile && (
              <button 
                onClick={() => {
                  setEditingProfile(null);
                  setName('');
                  setVoice('alloy');
                  setPrompt('');
                }}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Huỷ
              </button>
            )}
            <button 
              onClick={handleSave} 
              disabled={!name.trim()}
              className="bg-cinema-accent hover:bg-rose-700 disabled:bg-zinc-800 disabled:text-zinc-500 text-white px-6 py-2 rounded-lg text-sm font-bold transition-all shadow-lg shadow-rose-900/20"
            >
              {editingProfile ? 'Cập nhật' : 'Thêm hồ sơ'}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {profiles.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
              No profiles yet. Create one above.
            </div>
          ) : (
            profiles.map(p => (
              <div 
                key={p.id} 
                className="flex justify-between items-center bg-zinc-950 border border-zinc-800 p-3 rounded-xl hover:border-cinema-accent/50 transition-colors group"
              >
                <div 
                  className="flex-1 cursor-pointer"
                  onClick={() => {
                    onSelect(p);
                    onClose();
                  }}
                >
                  <div className="font-bold text-zinc-200 group-hover:text-cinema-accent transition-colors">{p.name}</div>
                  <div className="text-xs text-zinc-500 flex items-center gap-2">
                    <span className="bg-zinc-900 px-1.5 py-0.5 rounded uppercase tracking-wider font-mono">{p.voice}</span>
                    <span className="truncate max-w-[200px] italic">"{p.prompt.substring(0, 40)}{p.prompt.length > 40 ? '...' : ''}"</span>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <button 
                    onClick={() => { setEditingProfile(p); setName(p.name); setVoice(p.voice); setPrompt(p.prompt); }}
                    className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-lg transition-colors"
                    title="Edit Profile"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => handleDelete(p.id)}
                    className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                    title="Delete Profile"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex gap-4 mt-6">
          <button onClick={exportProfiles} className="flex items-center gap-2 text-zinc-400 hover:text-white"><Download size={16} /> Export</button>
          <label className="flex items-center gap-2 text-zinc-400 hover:text-white cursor-pointer"><Upload size={16} /> Import <input type="file" onChange={importProfiles} className="hidden" /></label>
        </div>
      </div>
    </div>
  );
};

export default VoiceProfileModal;
