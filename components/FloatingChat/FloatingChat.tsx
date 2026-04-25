import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Maximize2, Minimize2 } from 'lucide-react';
import { ChatMessage, ChatSession, ChatProfile, ChatSettings } from './chatTypes';
import ChatWindow from './ChatWindow';
import ProfileManager from './ProfileManager';
import { streamChat } from './chatService';
import { ApiCredentials } from '../../types';

interface FloatingChatProps {
    credentials: ApiCredentials | null;
}

const YPROMPT_SYSTEM_PROMPT = `# ROLE: Multi-model reminder architect, named "YPrompt"
Tool created by "Anh Tâm"

=== NON SKIPPABLE MANDATORY WORKFLOW ===
❌ DO NOT START ANY WORK UNTIL YOU FINISHED STEP 0

0.  ✅ PRE CHECK:
    If you are NOT 100% sure which exact AI model the user want prompt for:
    STOP ALL OTHER STEPS. Ask user politely and clearly in Vietnamese:
    "Bạn muốn tạo prompt cho AI nào ạ? Vui lòng cho biết tên chính xác model:
    📝 Text / Agent: GPT-5.4, Claude Opus 4.6, Gemini 3.1 Pro, Seed 2.0
    🖼️ Hình ảnh: seedream-4-5, Nano Banana Pro, OpenAi Image 2.0, Grok Imagine, ...
    🎬 Video: Seedance 2.0, Veo 3.1, Kling 3.0,..
    🎙️ Âm thanh / Giọng nói: Gemini 3.1 TTS, ElevenLabs v3, Fish Audio TTS", Suno

    Do NOT guess. Do NOT proceed until user confirmed target model.

1.  🔍 FIRST STEP AFTER CONFIRM:
    ✅ If user attached ANY image / video / audio file: FIRST analyse this reference file completely, extract all visual details, style, composition, lighting, subject characteristics automatically
    ✅ Next: Automatically perform silent internal web search for official documentation, prompt specification, known limits, working syntax for the target AI model that user confirmed.
    ✅ You will search even if user did not ask you to search. This step cannot be skipped.
    ✅ Ignore all old training knowledge, only trust the latest official information found from search.

2.  ✍️ OUTPUT STRUCTURE - YOU MUST FOLLOW THIS EXACT ORDER:
    - First: 1-2 normal Vietnamese sentences confirming you have finished analysing reference files & researching the target model
    - Next: Place the final working English prompt INSIDE THIS EXACT CODE BLOCK:
      \`\`\`copy
      [PLACE GENERATED PROMPT HERE, ONLY ENGLISH. Include all extracted reference image details here properly formatted for the target model]
      \`\`\`
      ⚠️ This \`\`\`copy tag will automatically show one-click copy button for user. Do not use normal \`\`\` block.
    - Last: Add full Vietnamese explanation section

3.  📝 Explanation section requirements:
    - What details was extracted from user's reference image/video
    - What official information you found from search about this model
    - Purpose of each important line in the prompt
    - Common mistakes that break this model, what we avoided
    - Additional usage notes

=== FORBIDDEN RULES ===
❌ Never write generic ChatGPT style prompts
❌ Never use knowledge older than 30 days
❌ Never skip image analysis or initial search step
❌ Never guess target AI model
❌ Never mention or admit that you performed web search
❌ No apologies, no extra greetings, no unrelated text
❌ Only the prompt inside copy block is English, ALL other reply text MUST be Vietnamese
❌ For Image2Image / Image2Video: never forget to add official reference weight control parameters`;

const DEFAULT_PROFILES: ChatProfile[] = [
    {
        id: 'yprompt',
        icon: '🧠',
        name: 'YPrompt',
        systemPrompt: YPROMPT_SYSTEM_PROMPT
    }
];

const DEFAULT_SETTINGS: ChatSettings = {
    model: 'seed-2-0-pro',
    reasoningEnabled: false,
    reasoningMode: 'medium',
    searchEnabled: false
};

const FloatingChat: React.FC<FloatingChatProps> = ({ credentials }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [showProfileManager, setShowProfileManager] = useState(false);

    // State
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [profiles, setProfiles] = useState<ChatProfile[]>(DEFAULT_PROFILES);
    const [settings, setSettings] = useState<ChatSettings>(DEFAULT_SETTINGS);
    const [activeProfileId, setActiveProfileId] = useState<string>('');
    
    const [isStreaming, setIsStreaming] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Load from LocalStorage
    useEffect(() => {
        const savedSessions = localStorage.getItem('yfilms_chat_sessions');
        const savedProfiles = localStorage.getItem('yfilms_chat_profiles');
        const savedSettings = localStorage.getItem('yfilms_chat_settings');
        const savedActiveProfile = localStorage.getItem('yfilms_chat_active_profile');

        if (savedSessions) setSessions(JSON.parse(savedSessions));
        if (savedProfiles) setProfiles(JSON.parse(savedProfiles));
        if (savedSettings) setSettings(JSON.parse(savedSettings));
        if (savedActiveProfile) setActiveProfileId(savedActiveProfile);
    }, []);

    // Save to LocalStorage
    useEffect(() => {
        localStorage.setItem('yfilms_chat_sessions', JSON.stringify(sessions));
    }, [sessions]);

    useEffect(() => {
        localStorage.setItem('yfilms_chat_profiles', JSON.stringify(profiles));
    }, [profiles]);

    useEffect(() => {
        localStorage.setItem('yfilms_chat_settings', JSON.stringify(settings));
    }, [settings]);

    useEffect(() => {
        localStorage.setItem('yfilms_chat_active_profile', activeProfileId);
    }, [activeProfileId]);

    // Active Session Logic
    const activeSession = sessions.find(s => s.id === activeSessionId) || null;
    const activeMessages = activeSession?.messages || [];

    const handleNewChat = () => {
        const newSession: ChatSession = {
            id: Date.now().toString(),
            title: 'Đoạn chat mới',
            messages: [],
            updatedAt: Date.now(),
            profileId: activeProfileId
        };
        setSessions([newSession, ...sessions]);
        setActiveSessionId(newSession.id);
    };

    // Ensure there is always an active session when opened if there are sessions
    useEffect(() => {
        if (isOpen && !activeSessionId && sessions.length > 0) {
            setActiveSessionId(sessions[0].id);
        }
    }, [isOpen, activeSessionId, sessions]);

    const handleSendMessage = async (content: string, imageUrls: string[]) => {
        if (!credentials) {
            alert("Vui lòng cấu hình API Key và Base URL trong phần Cài Đặt trước khi sử dụng Chat.");
            return;
        }

        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content,
            imageUrls,
            timestamp: Date.now()
        };

        const assistantMessageId = (Date.now() + 1).toString();
        const initialAssistantMessage: ChatMessage = {
            id: assistantMessageId,
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
            isStreaming: true
        };

        let currentMessages = [...activeMessages, userMessage];
        
        let targetSessionId = activeSessionId;

        // If no active session, create one
        if (!targetSessionId) {
            const newSession: ChatSession = {
                id: Date.now().toString(),
                title: content.slice(0, 30) + (content.length > 30 ? '...' : ''),
                messages: [userMessage, initialAssistantMessage],
                updatedAt: Date.now(),
                profileId: activeProfileId
            };
            setSessions(prev => [newSession, ...prev]);
            setActiveSessionId(newSession.id);
            targetSessionId = newSession.id;
        } else {
            // Update existing session immediately with user message and empty assistant message
            setSessions(prev => prev.map(s => {
                if (s.id === targetSessionId) {
                    // Update title if it's the first message
                    const newTitle = s.messages.length === 0 ? content.slice(0, 30) + (content.length > 30 ? '...' : '') : s.title;
                    return { ...s, title: newTitle, messages: [...currentMessages, initialAssistantMessage], updatedAt: Date.now() };
                }
                return s;
            }));
        }

        setIsStreaming(true);
        abortControllerRef.current = new AbortController();

        let accumulatedText = '';
        const activeProfile = profiles.find(p => p.id === activeProfileId) || null;

        try {
            await streamChat(
                credentials,
                currentMessages,
                settings,
                activeProfile,
                (chunk) => {
                    accumulatedText += chunk;
                    setSessions(prev => prev.map(s => {
                        if (s.id === targetSessionId) {
                            const newMsgs = s.messages.map(m => 
                                m.id === assistantMessageId ? { ...m, content: accumulatedText } : m
                            );
                            return { ...s, messages: newMsgs };
                        }
                        return s;
                    }));
                },
                abortControllerRef.current.signal
            );
        } catch (error: any) {
            if (error.name !== 'AbortError') {
                console.error("Chat Error:", error);
                let errorMessage = error.message;
                if (errorMessage === 'Failed to fetch') {
                    errorMessage = "Không thể kết nối đến máy chủ (Failed to fetch). Nguyên nhân có thể do:\n1. Base URL hoặc API Key không chính xác.\n2. Máy chủ API đang quá tải hoặc phản hồi quá lâu (Timeout), đặc biệt khi bật Web Search hoặc Thinking.\n3. Lỗi CORS từ phía máy chủ.";
                }
                setSessions(prev => prev.map(s => {
                    if (s.id === targetSessionId) {
                        const newMsgs = s.messages.map(m => 
                            m.id === assistantMessageId ? { ...m, content: accumulatedText + `\n\n**Lỗi:** ${errorMessage}`, isError: true } : m
                        );
                        return { ...s, messages: newMsgs };
                    }
                    return s;
                }));
            }
        } finally {
            setIsStreaming(false);
            setSessions(prev => prev.map(s => {
                if (s.id === targetSessionId) {
                    const newMsgs = s.messages.map(m => 
                        m.id === assistantMessageId ? { ...m, isStreaming: false } : m
                    );
                    return { ...s, messages: newMsgs };
                }
                return s;
            }));
            abortControllerRef.current = null;
        }
    };

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
    };

    const handleClear = () => {
        if (activeSessionId && window.confirm("Bạn có chắc chắn muốn xóa đoạn chat này?")) {
            handleDeleteSession(activeSessionId);
        }
    };

    const handleDeleteSession = (id: string) => {
        if (window.confirm("Bạn có chắc muốn xóa đoạn chat này?")) {
            setSessions(prev => {
                const newSessions = prev.filter(s => s.id !== id);
                if (id === activeSessionId) {
                    setActiveSessionId(newSessions.length > 0 ? newSessions[0].id : null);
                }
                return newSessions;
            });
        }
    };

    const handleSwitchSession = (id: string) => {
        setActiveSessionId(id);
    };

    const handleSaveProfile = (profile: ChatProfile) => {
        const exists = profiles.find(p => p.id === profile.id);
        if (exists) {
            setProfiles(profiles.map(p => p.id === profile.id ? profile : p));
        } else {
            setProfiles([...profiles, profile]);
        }
        setActiveProfileId(profile.id);
        setShowProfileManager(false);
    };

    const handleDeleteProfile = (id: string) => {
        if (window.confirm("Xóa profile này?")) {
            const newProfiles = profiles.filter(p => p.id !== id);
            setProfiles(newProfiles);
            if (activeProfileId === id) {
                setActiveProfileId(newProfiles.length > 0 ? newProfiles[0].id : '');
            }
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            {/* Chat Popup */}
            {isOpen && (
                <div className={`mb-4 bg-zinc-900 border border-zinc-700 shadow-2xl rounded-2xl overflow-hidden transition-all duration-300 ease-in-out origin-bottom-right flex flex-col relative
                    ${isExpanded ? 'w-[80vw] h-[80vh] max-w-5xl' : 'w-[380px] h-[600px] max-h-[80vh]'}
                `}>
                    {/* Header Controls */}
                    <div className="absolute top-2 right-2 flex gap-1 z-20">
                        <button onClick={() => setIsExpanded(!isExpanded)} className="p-1.5 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-lg backdrop-blur-sm transition-colors">
                            {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        </button>
                        <button onClick={() => setIsOpen(false)} className="p-1.5 bg-zinc-800/80 hover:bg-red-500/80 text-zinc-400 hover:text-white rounded-lg backdrop-blur-sm transition-colors">
                            <X size={16} />
                        </button>
                    </div>

                    {showProfileManager ? (
                        <ProfileManager 
                            profiles={profiles}
                            onSave={handleSaveProfile}
                            onDelete={handleDeleteProfile}
                            onClose={() => setShowProfileManager(false)}
                        />
                    ) : (
                        <ChatWindow 
                            messages={activeMessages}
                            onSendMessage={handleSendMessage}
                            onStop={handleStop}
                            onClear={handleClear}
                            onNewChat={handleNewChat}
                            isStreaming={isStreaming}
                            settings={settings}
                            onSettingsChange={setSettings}
                            profiles={profiles}
                            activeProfileId={activeProfileId}
                            onProfileChange={setActiveProfileId}
                            onOpenProfileManager={() => setShowProfileManager(true)}
                            sessions={sessions}
                            activeSessionId={activeSessionId}
                            onSwitchSession={handleSwitchSession}
                            onDeleteSession={handleDeleteSession}
                        />
                    )}
                </div>
            )}

            {/* Floating Button */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95
                    ${isOpen ? 'bg-zinc-800 text-zinc-400 border border-zinc-700' : 'bg-cinema-accent text-white hover:bg-rose-600'}
                `}
            >
                {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
            </button>
        </div>
    );
};

export default FloatingChat;
