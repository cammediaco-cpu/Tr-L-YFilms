import React, { useState, useRef } from 'react';
import { ChatProfile } from './chatTypes';
import { Plus, Edit2, Trash2, X, Check, Smile, Upload, Image as ImageIcon } from 'lucide-react';
import { fileToDataUrl } from './chatService';

const EMOJIS = [
    '🤖', '👽', '👻', '👾', '🧠', '💡', '🚀', '🌟', '🔥', '⚡',
    '💻', '📱', '⌨️', '🖥️', '🖨️', '🖱️', '🕹️', '🎮', '🎧', '🎤',
    '✍️', '📚', '📖', '📝', '✏️', '🖌️', '🎨', '🎬', '🎥', '📸',
    '👨‍💻', '👩‍💻', '🧙‍♂️', '🧙‍♀️', '🦸‍♂️', '🦸‍♀️', '🕵️‍♂️', '🕵️‍♀️', '🧑‍🔬', '🧑‍🚀',
    '🎭', '🎪', '🎢', '🎡', '🎠', '⛲', '⛱️', '🏖️', '🏝️', '🏜️',
    '🌋', '⛰️', '🏔️', '🗻', '🏕️', '⛺', '🏠', '🏡', '🏘️', '🏚️',
    '🏗️', '🏭', '🏢', '🏬', '🏣', '🏤', '🏥', '🏦', '🏨', '🏪',
    '🏫', '🏩', '💒', '🏛️', '⛪', '🕌', '🕍', '🛕', '🕋', '⛩️'
];

interface ProfileManagerProps {
    profiles: ChatProfile[];
    onSave: (profile: ChatProfile) => void;
    onDelete: (id: string) => void;
    onClose: () => void;
}

const ProfileManager: React.FC<ProfileManagerProps> = ({ profiles, onSave, onDelete, onClose }) => {
    const [editingProfile, setEditingProfile] = useState<ChatProfile | null>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleAddNew = () => {
        setEditingProfile({
            id: Date.now().toString(),
            icon: '🤖',
            name: 'Trợ lý mới',
            systemPrompt: 'Bạn là một trợ lý AI hữu ích.'
        });
    };

    const handleSave = () => {
        if (editingProfile) {
            onSave(editingProfile);
            setEditingProfile(null);
            setShowEmojiPicker(false);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const base64 = await fileToDataUrl(file);
            if (editingProfile) {
                setEditingProfile({ ...editingProfile, icon: base64 });
                setShowEmojiPicker(false);
            }
        } catch (error) {
            console.error("Lỗi tải ảnh:", error);
            alert("Không thể tải ảnh lên.");
        }
    };

    return (
        <div className="absolute inset-0 bg-zinc-900/95 backdrop-blur-md z-50 flex flex-col p-4 rounded-2xl border border-zinc-700 shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-zinc-800">
                <h3 className="text-white font-bold text-lg">Quản lý Profile</h3>
                <button onClick={onClose} className="text-zinc-400 hover:text-white p-1 rounded-full hover:bg-zinc-800 transition-colors">
                    <X size={20} />
                </button>
            </div>

            {editingProfile ? (
                <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                    <div>
                        <label className="block text-xs text-zinc-400 mb-1">Icon (Emoji hoặc Ảnh)</label>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-2xl overflow-hidden shrink-0">
                                {editingProfile.icon.startsWith('data:image') ? (
                                    <img src={editingProfile.icon} alt="icon" className="w-full h-full object-cover" />
                                ) : (
                                    editingProfile.icon
                                )}
                            </div>
                            <div className="flex gap-2 flex-1">
                                <button 
                                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                    className="flex-1 flex items-center justify-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm text-white hover:bg-zinc-700 transition-colors"
                                >
                                    <Smile size={16} /> Chọn Emoji
                                </button>
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex-1 flex items-center justify-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm text-white hover:bg-zinc-700 transition-colors"
                                >
                                    <Upload size={16} /> Tải Ảnh
                                </button>
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    onChange={handleImageUpload} 
                                    accept="image/*" 
                                    className="hidden" 
                                />
                            </div>
                        </div>
                        {showEmojiPicker && (
                            <div className="mt-2 p-2 bg-zinc-800 border border-zinc-700 rounded-lg grid grid-cols-8 gap-1">
                                {EMOJIS.map(emoji => (
                                    <button
                                        key={emoji}
                                        onClick={() => {
                                            setEditingProfile({...editingProfile, icon: emoji});
                                            setShowEmojiPicker(false);
                                        }}
                                        className="text-xl hover:bg-zinc-700 p-1 rounded transition-colors"
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div>
                        <label className="block text-xs text-zinc-400 mb-1">Tên Profile</label>
                        <input 
                            type="text" 
                            value={editingProfile.name} 
                            onChange={e => setEditingProfile({...editingProfile, name: e.target.value})}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-white focus:outline-none focus:border-cinema-accent"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-zinc-400 mb-1">System Prompt (Phong cách)</label>
                        <textarea 
                            value={editingProfile.systemPrompt} 
                            onChange={e => setEditingProfile({...editingProfile, systemPrompt: e.target.value})}
                            className="w-full h-32 bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-white focus:outline-none focus:border-cinema-accent resize-none"
                        />
                    </div>
                    <div className="flex gap-2 pt-2">
                        <button onClick={() => setEditingProfile(null)} className="flex-1 py-2 rounded-lg bg-zinc-800 text-white hover:bg-zinc-700 transition-colors">Hủy</button>
                        <button onClick={handleSave} className="flex-1 py-2 rounded-lg bg-cinema-accent text-white hover:bg-rose-600 transition-colors flex items-center justify-center gap-2">
                            <Check size={16} /> Lưu
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                    {profiles.map(p => (
                        <div key={p.id} className="bg-zinc-800 border border-zinc-700 rounded-xl p-3 flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center text-xl overflow-hidden shrink-0">
                                    {p.icon.startsWith('data:image') ? (
                                        <img src={p.icon} alt={p.name} className="w-full h-full object-cover" />
                                    ) : (
                                        p.icon
                                    )}
                                </div>
                                <div>
                                    <div className="text-white font-medium text-sm">{p.name}</div>
                                    <div className="text-zinc-500 text-xs truncate max-w-[150px]">{p.systemPrompt}</div>
                                </div>
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => setEditingProfile(p)} className="text-zinc-400 hover:text-blue-400 p-1.5 rounded-lg hover:bg-zinc-700">
                                    <Edit2 size={14} />
                                </button>
                                <button onClick={() => onDelete(p.id)} className="text-zinc-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-zinc-700">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                    
                    <button 
                        onClick={handleAddNew}
                        className="w-full mt-4 py-3 border border-dashed border-zinc-700 rounded-xl text-zinc-400 hover:text-white hover:border-zinc-500 hover:bg-zinc-800/50 transition-all flex items-center justify-center gap-2"
                    >
                        <Plus size={16} /> Thêm Profile Mới
                    </button>
                </div>
            )}
        </div>
    );
};

export default ProfileManager;
