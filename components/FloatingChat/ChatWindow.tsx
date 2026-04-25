import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, ChatSettings, ChatProfile, ChatSession } from './chatTypes';
import { Send, Image as ImageIcon, X, Loader2, Bot, User, Trash2, Settings, MessageSquarePlus, StopCircle, BrainCircuit, Menu, ChevronLeft, Globe, Copy, Check, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { fileToDataUrl } from './chatService';

const CodeBlock = ({ node, inline, className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || '');
    const [copied, setCopied] = useState(false);
    
    const handleCopy = () => {
        navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!inline && match) {
        return (
            <div className="relative group my-4 rounded-lg overflow-hidden border border-zinc-700 bg-[#1e1e1e]">
                <div className="flex items-center justify-between px-4 py-1.5 bg-zinc-800/80 border-b border-zinc-700">
                    <span className="text-xs text-zinc-400 font-mono">{match[1]}</span>
                    <button
                        onClick={handleCopy}
                        className="text-zinc-400 hover:text-white transition-colors p-1 flex items-center gap-1 text-xs"
                        title="Copy code"
                    >
                        {copied ? <><Check size={14} className="text-green-400" /> Copied</> : <><Copy size={14} /> Copy</>}
                    </button>
                </div>
                <SyntaxHighlighter
                    {...props}
                    style={vscDarkPlus}
                    language={match[1]}
                    PreTag="div"
                    customStyle={{ margin: 0, background: 'transparent', padding: '1rem', fontSize: '0.875rem' }}
                >
                    {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
            </div>
        );
    }
    return (
        <code {...props} className={`${className || ''} bg-zinc-800 px-1.5 py-0.5 rounded-md text-rose-300 text-sm font-mono`}>
            {children}
        </code>
    );
};

const ThinkingBlock = ({ children, isStreaming }: { children: React.ReactNode, isStreaming: boolean }) => {
    const [isOpen, setIsOpen] = useState(true);

    useEffect(() => {
        if (!isStreaming) {
            setIsOpen(false);
        }
    }, [isStreaming]);

    return (
        <div className="my-4 border border-zinc-700/50 bg-[#1e1e1e] rounded-lg overflow-hidden">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center gap-2 p-2.5 bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
                <BrainCircuit size={14} className={isStreaming ? "animate-pulse text-cinema-accent" : ""} />
                <span className="text-xs font-bold uppercase tracking-wider">
                    Suy nghĩ & Tìm kiếm {isStreaming ? "..." : ""}
                </span>
                <ChevronDown size={14} className={`ml-auto transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>
            {isOpen && (
                <div className="p-3 text-zinc-400 text-xs font-mono whitespace-pre-wrap border-t border-zinc-700/50">
                    {children}
                </div>
            )}
        </div>
    );
};

const parseMessageContent = (text: string) => {
    const parts: { type: 'text' | 'thinking', content: string }[] = [];
    let currentText = text;
    
    while (currentText.length > 0) {
        const thinkMatch = currentText.match(/<(thinking|think)>/);
        
        if (!thinkMatch || thinkMatch.index === undefined) {
            parts.push({ type: 'text', content: currentText });
            break;
        }
        
        const startIndex = thinkMatch.index;
        const tagLength = thinkMatch[0].length;
        const tagName = thinkMatch[1];
        
        if (startIndex > 0) {
            parts.push({ type: 'text', content: currentText.substring(0, startIndex) });
        }
        
        const endTag = `</${tagName}>`;
        const endIndex = currentText.indexOf(endTag, startIndex + tagLength);
        
        if (endIndex === -1) {
            parts.push({ type: 'thinking', content: currentText.substring(startIndex + tagLength) });
            break;
        } else {
            parts.push({ type: 'thinking', content: currentText.substring(startIndex + tagLength, endIndex) });
            currentText = currentText.substring(endIndex + endTag.length);
        }
    }
    return parts;
};

const preprocessMarkdown = (text: string) => {
    // Fix tables missing a blank line before them (remark-gfm requires a blank line before a table)
    return text.replace(/([^\n|])\n(\s*\|)/g, '$1\n\n$2');
};

const extractTextFromNode = (node: any): string => {
    if (!node) return '';
    if (node.type === 'text') return node.value;
    if (node.children) {
        return node.children.map(extractTextFromNode).join('');
    }
    return '';
};

const findNodeInTree = (node: any, predicate: (n: any) => boolean): any => {
    if (!node) return null;
    if (predicate(node)) return node;
    if (node.children) {
        for (const child of node.children) {
            const found = findNodeInTree(child, predicate);
            if (found) return found;
        }
    }
    return null;
};

interface ChatWindowProps {
    messages: ChatMessage[];
    onSendMessage: (content: string, imageUrls: string[]) => void;
    onStop: () => void;
    onClear: () => void;
    onNewChat: () => void;
    isStreaming: boolean;
    settings: ChatSettings;
    onSettingsChange: (s: ChatSettings) => void;
    profiles: ChatProfile[];
    activeProfileId: string;
    onProfileChange: (id: string) => void;
    onOpenProfileManager: () => void;
    sessions: ChatSession[];
    activeSessionId: string | null;
    onSwitchSession: (id: string) => void;
    onDeleteSession: (id: string) => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({
    messages, onSendMessage, onStop, onClear, onNewChat, isStreaming,
    settings, onSettingsChange, profiles, activeProfileId, onProfileChange, onOpenProfileManager,
    sessions, activeSessionId, onSwitchSession, onDeleteSession
}) => {
    const [input, setInput] = useState('');
    const [images, setImages] = useState<string[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showSidebar, setShowSidebar] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const activeProfile = profiles.find(p => p.id === activeProfileId) || profiles[0] || {
        id: 'fallback',
        icon: '🤖',
        name: 'Trợ lý (Chưa có Profile)',
        systemPrompt: 'Bạn là một trợ lý AI.'
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = () => {
        if (isStreaming) return;
        if (!input.trim() && images.length === 0) return;
        onSendMessage(input, images);
        setInput('');
        setImages([]);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newImages = [...images];
            for (let i = 0; i < e.target.files.length; i++) {
                try {
                    const dataUrl = await fileToDataUrl(e.target.files[i]);
                    newImages.push(dataUrl);
                } catch (err) {
                    console.error(err);
                }
            }
            setImages(newImages);
        }
    };

    const handlePaste = async (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    try {
                        const dataUrl = await fileToDataUrl(file);
                        setImages(prev => [...prev, dataUrl]);
                    } catch (err) {
                        console.error(err);
                    }
                }
            }
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => setIsDragging(false);

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const newImages = [...images];
            for (let i = 0; i < e.dataTransfer.files.length; i++) {
                const file = e.dataTransfer.files[i];
                if (file.type.startsWith('image/')) {
                    try {
                        const dataUrl = await fileToDataUrl(file);
                        newImages.push(dataUrl);
                    } catch (err) {
                        console.error(err);
                    }
                }
            }
            setImages(newImages);
        }
    };

    const removeImage = (index: number) => {
        setImages(images.filter((_, i) => i !== index));
    };

    return (
        <div className="flex flex-col h-full bg-zinc-900 rounded-2xl overflow-hidden relative"
             onDragOver={handleDragOver}
             onDragLeave={handleDragLeave}
             onDrop={handleDrop}
        >
            {/* Header */}
            <div className="bg-zinc-800/80 backdrop-blur-md border-b border-zinc-700 p-3 flex items-center justify-between z-10">
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowSidebar(!showSidebar)} className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors mr-1">
                        <Menu size={18} />
                    </button>
                    <div className="relative group cursor-pointer" onClick={() => setShowSettings(!showSettings)}>
                        <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-lg shadow-inner overflow-hidden shrink-0">
                            {activeProfile?.icon?.startsWith('data:image') ? (
                                <img src={activeProfile.icon} alt="icon" className="w-full h-full object-cover" />
                            ) : (
                                activeProfile?.icon || '🤖'
                            )}
                        </div>
                        <div className="absolute top-10 left-0 bg-zinc-800 border border-zinc-700 rounded-lg p-2 shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                            <p className="text-xs text-white font-bold">{activeProfile?.name}</p>
                            <p className="text-[10px] text-zinc-400">Nhấp để đổi Profile/Model</p>
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-white leading-tight">{activeProfile?.name || 'Trợ Lý'}</span>
                        <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                            {settings.model} {settings.reasoningEnabled && <BrainCircuit size={10} className="text-cinema-accent"/>}
                        </span>
                    </div>
                </div>
                
                <div className="flex items-center gap-1">
                    <button onClick={onNewChat} className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors" title="Đoạn chat mới">
                        <MessageSquarePlus size={16} />
                    </button>
                    <button onClick={onClear} className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-zinc-700 rounded-lg transition-colors" title="Xóa đoạn chat">
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {/* Sidebar (Chat List) */}
            {showSidebar && (
                <div className="absolute inset-0 bg-zinc-900 z-40 flex flex-col animate-in slide-in-from-left-4">
                    <div className="bg-zinc-800/80 backdrop-blur-md border-b border-zinc-700 p-3 flex items-center justify-between">
                        <span className="text-sm font-bold text-white">Lịch sử Chat</span>
                        <button onClick={() => setShowSidebar(false)} className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors">
                            <ChevronLeft size={18} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                        {sessions.map(session => (
                            <div 
                                key={session.id}
                                className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${session.id === activeSessionId ? 'bg-zinc-800 border border-zinc-700' : 'hover:bg-zinc-800/50 border border-transparent'}`}
                                onClick={() => {
                                    onSwitchSession(session.id);
                                    setShowSidebar(false);
                                }}
                            >
                                <div className="flex flex-col overflow-hidden">
                                    <span className="text-sm text-white truncate">{session.title || 'Đoạn chat mới'}</span>
                                    <span className="text-[10px] text-zinc-500">{new Date(session.updatedAt).toLocaleString('vi-VN')}</span>
                                </div>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteSession(session.id);
                                    }}
                                    className="p-1.5 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                    <div className="p-3 border-t border-zinc-700">
                        <button 
                            onClick={() => {
                                onNewChat();
                                setShowSidebar(false);
                            }}
                            className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white p-2 rounded-lg transition-colors text-sm font-medium"
                        >
                            <MessageSquarePlus size={16} />
                            Đoạn chat mới
                        </button>
                    </div>
                </div>
            )}

            {/* Settings Dropdown */}
            {showSettings && (
                <div className="absolute top-14 left-2 right-2 bg-zinc-800 border border-zinc-700 rounded-xl p-3 shadow-2xl z-20 space-y-3 animate-in fade-in slide-in-from-top-2">
                    <div>
                        <label className="text-xs text-zinc-400 block mb-1">Chọn Model</label>
                        <select 
                            value={settings.model}
                            onChange={e => onSettingsChange({...settings, model: e.target.value})}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-cinema-accent"
                        >
                            <option value="seed-2-0-pro">Seed 2.0 Pro</option>
                            <option value="seed-2-0-lite">Seed 2.0 Lite</option>
                            <option value="seed-1-8">Seed 1.8</option>
                        </select>
                    </div>
                    
                    <div className="border-t border-zinc-700 pt-2 mt-2">
                        <label className="text-xs text-zinc-400 block mb-1 flex justify-between items-center">
                            <span>Profile Trả Lời</span>
                            <button onClick={onOpenProfileManager} className="text-cinema-accent hover:text-rose-400 text-[10px] uppercase font-bold tracking-wider">Quản lý</button>
                        </label>
                        <select 
                            value={activeProfileId}
                            onChange={e => onProfileChange(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-cinema-accent"
                        >
                            {profiles.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.icon.startsWith('data:image') ? '🖼️' : p.icon} {p.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth" onClick={() => setShowSettings(false)}>
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-3 opacity-50">
                        <Bot size={48} className="text-zinc-600" />
                        <p className="text-sm text-center">Bắt đầu trò chuyện với {activeProfile?.name}.<br/>Có thể kéo thả ảnh vào đây.</p>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-md overflow-hidden ${msg.role === 'user' ? 'bg-zinc-700' : 'bg-cinema-accent'}`}>
                                {msg.role === 'user' ? (
                                    <User size={16} className="text-white" />
                                ) : activeProfile?.icon?.startsWith('data:image') ? (
                                    <img src={activeProfile.icon} alt="icon" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-lg">{activeProfile?.icon || '🤖'}</span>
                                )}
                            </div>
                            <div className={`${
                                msg.role === 'user' 
                                    ? 'max-w-[80%] p-3 bg-zinc-800 text-white rounded-2xl rounded-tr-sm border border-zinc-700' 
                                    : msg.isError 
                                        ? 'flex-1 p-3 bg-red-900/20 text-red-200 border border-red-900/50 rounded-2xl rounded-tl-sm'
                                        : 'flex-1 py-1 text-zinc-200 min-w-0'
                            }`}>
                                {/* Images */}
                                {msg.imageUrls && msg.imageUrls.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {msg.imageUrls.map((url, i) => (
                                            <img key={i} src={url} alt="upload" className="max-w-[150px] max-h-[150px] rounded-lg object-cover border border-zinc-600 shadow-sm" />
                                        ))}
                                    </div>
                                )}
                                
                                {/* Content */}
                                <div className="text-sm prose prose-invert prose-p:leading-relaxed max-w-none break-words">
                                    {parseMessageContent(msg.content).map((part, index) => (
                                        part.type === 'thinking' ? (
                                            <ThinkingBlock key={index} isStreaming={msg.isStreaming || false}>
                                                {part.content}
                                            </ThinkingBlock>
                                        ) : (
                                            <ReactMarkdown 
                                                key={index}
                                                remarkPlugins={[remarkGfm, remarkMath]}
                                                rehypePlugins={[rehypeRaw, rehypeKatex]}
                                                components={{
                                                    code: CodeBlock as any,
                                                    a: ({node, ...props}: any) => (
                                                        <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 hover:underline transition-colors" />
                                                    ),
                                                    table: ({node, children, ...props}: any) => {
                                                        try {
                                                            const thead = node.children?.find((c: any) => c.tagName === 'thead');
                                                            if (thead) {
                                                                const tr = thead.children?.find((c: any) => c.tagName === 'tr');
                                                                if (tr) {
                                                                    const ths = tr.children?.filter((c: any) => c.tagName === 'th') || [];
                                                                    const headerText = ths.map(extractTextFromNode).join(' ').toLowerCase();
                                                                    
                                                                    if (headerText.includes('nguồn') || headerText.includes('link') || headerText.includes('source')) {
                                                                        const tbody = node.children?.find((c: any) => c.tagName === 'tbody');
                                                                        if (tbody) {
                                                                            const trs = tbody.children?.filter((c: any) => c.tagName === 'tr') || [];
                                                                            const sources = trs.map((row: any) => {
                                                                                const tds = row.children?.filter((c: any) => c.tagName === 'td') || [];
                                                                                let sourceName = tds[0] ? extractTextFromNode(tds[0]) : '';
                                                                                let title = '';
                                                                                let url = '';
                                                                                
                                                                                for (const td of tds) {
                                                                                    const aNode = findNodeInTree(td, (n: any) => n.tagName === 'a');
                                                                                    if (aNode) {
                                                                                        url = aNode.properties?.href || '';
                                                                                        title = extractTextFromNode(aNode);
                                                                                        break;
                                                                                    } else {
                                                                                        const text = extractTextFromNode(td);
                                                                                        if (text.startsWith('http')) {
                                                                                            url = text;
                                                                                            title = text;
                                                                                        }
                                                                                    }
                                                                                }
                                                                                return { sourceName, title, url };
                                                                            }).filter((s: any) => s.url);
                                                                            
                                                                            if (sources.length > 0) {
                                                                                return (
                                                                                    <div className="my-6">
                                                                                        <div className="flex items-center gap-2 text-zinc-400 text-sm mb-3 font-medium">
                                                                                            <Globe size={14} />
                                                                                            <span>{sources.length} sources</span>
                                                                                        </div>
                                                                                        <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar snap-x">
                                                                                            {sources.map((src: any, idx: number) => {
                                                                                                let domain = '';
                                                                                                try {
                                                                                                    domain = new URL(src.url).hostname.replace('www.', '');
                                                                                                } catch (e) {
                                                                                                    domain = src.sourceName || 'Link';
                                                                                                }
                                                                                                
                                                                                                return (
                                                                                                    <a 
                                                                                                        key={idx} 
                                                                                                        href={src.url} 
                                                                                                        target="_blank" 
                                                                                                        rel="noopener noreferrer"
                                                                                                        className="flex flex-col gap-1.5 min-w-[220px] max-w-[260px] p-3.5 rounded-xl bg-zinc-800/40 border border-zinc-700/50 hover:bg-zinc-700/50 hover:border-zinc-500 transition-all snap-start shrink-0 no-underline group"
                                                                                                    >
                                                                                                        <div className="text-xs text-zinc-400 flex items-center gap-2 truncate">
                                                                                                            <span className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-medium group-hover:bg-zinc-700 transition-colors">{idx + 1}</span>
                                                                                                            <span className="truncate">{domain}</span>
                                                                                                        </div>
                                                                                                        <div className="text-sm text-zinc-200 font-medium line-clamp-2 mt-1 group-hover:text-white transition-colors leading-snug">
                                                                                                            {src.title || src.sourceName}
                                                                                                        </div>
                                                                                                    </a>
                                                                                                );
                                                                                            })}
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        } catch (e) {
                                                            console.error("Error parsing table for sources", e);
                                                        }
                                                        
                                                        return (
                                                            <div className="overflow-x-auto my-4 rounded-lg border border-zinc-700 shadow-sm">
                                                                <table className="w-full text-sm text-left border-collapse" {...props}>
                                                                    {children}
                                                                </table>
                                                            </div>
                                                        );
                                                    },
                                                    thead: ({node, ...props}: any) => <thead className="bg-zinc-800/80 text-zinc-200" {...props} />,
                                                    th: ({node, ...props}: any) => <th className="px-4 py-3 font-semibold border-b border-zinc-700" {...props} />,
                                                    td: ({node, ...props}: any) => <td className="px-4 py-3 border-b border-zinc-700/50" {...props} />,
                                                    tr: ({node, ...props}: any) => <tr className="hover:bg-zinc-800/50 transition-colors even:bg-zinc-800/20" {...props} />,
                                                }}
                                            >
                                                {preprocessMarkdown(part.content)}
                                            </ReactMarkdown>
                                        )
                                    ))}
                                </div>
                                
                                {/* Message Actions */}
                                {msg.role !== 'user' && !msg.isStreaming && (
                                    <div className="mt-2 flex items-center gap-2">
                                        <button 
                                            onClick={() => navigator.clipboard.writeText(msg.content)}
                                            className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded-md hover:bg-zinc-700/50"
                                            title="Copy message"
                                        >
                                            <Copy size={14} />
                                        </button>
                                    </div>
                                )}
                                
                                {/* Streaming Indicator */}
                                {msg.isStreaming && (
                                    <span className="inline-block w-1.5 h-4 bg-cinema-accent animate-pulse ml-1 align-middle"></span>
                                )}
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Drag Overlay */}
            {isDragging && (
                <div className="absolute inset-0 bg-cinema-accent/10 backdrop-blur-sm border-2 border-dashed border-cinema-accent z-30 flex items-center justify-center rounded-2xl pointer-events-none">
                    <div className="bg-zinc-900/90 px-6 py-4 rounded-xl flex flex-col items-center gap-2 shadow-2xl">
                        <ImageIcon size={32} className="text-cinema-accent animate-bounce" />
                        <p className="text-white font-bold">Thả ảnh vào đây</p>
                    </div>
                </div>
            )}

            {/* Input Area */}
            <div className="p-3 bg-zinc-800/80 backdrop-blur-md border-t border-zinc-700 z-10">
                {/* Reasoning & Search Controls */}
                <div className="flex items-center gap-3 mb-2 px-1 flex-wrap">
                    <button
                        onClick={() => onSettingsChange({...settings, reasoningEnabled: !settings.reasoningEnabled})}
                        className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors ${settings.reasoningEnabled ? 'bg-cinema-accent/20 text-cinema-accent border border-cinema-accent/30' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-300 border border-zinc-700'}`}
                    >
                        <BrainCircuit size={14} />
                        Thinking {settings.reasoningEnabled ? 'On' : 'Off'}
                    </button>
                    {settings.reasoningEnabled && (
                        <select
                            value={settings.reasoningMode}
                            onChange={e => onSettingsChange({...settings, reasoningMode: e.target.value as any})}
                            className="bg-zinc-900 border border-zinc-700 rounded-md px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-cinema-accent"
                        >
                            <option value="minimal">Minimal</option>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                        </select>
                    )}
                    <button
                        onClick={() => onSettingsChange({...settings, searchEnabled: !settings.searchEnabled})}
                        className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors ${settings.searchEnabled ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-300 border border-zinc-700'}`}
                    >
                        <Globe size={14} />
                        Web Search {settings.searchEnabled ? 'On' : 'Off'}
                    </button>
                </div>

                {/* Image Previews */}
                {images.length > 0 && (
                    <div className="flex gap-2 mb-2 overflow-x-auto pb-2 custom-scrollbar">
                        {images.map((url, i) => (
                            <div key={i} className="relative shrink-0 group">
                                <img src={url} alt="preview" className="w-16 h-16 object-cover rounded-lg border border-zinc-600 shadow-sm" />
                                <button 
                                    onClick={() => removeImage(i)}
                                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-600"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex items-end gap-2 bg-zinc-900 border border-zinc-700 rounded-xl p-1 shadow-inner focus-within:border-cinema-accent transition-colors">
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        accept="image/*" 
                        multiple 
                        className="hidden" 
                    />
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors shrink-0"
                        title="Tải ảnh lên"
                        disabled={isStreaming}
                    >
                        <ImageIcon size={20} />
                    </button>
                    
                    <textarea 
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                        placeholder="Nhập tin nhắn... (Ctrl+V để dán ảnh)"
                        className="w-full bg-transparent text-white text-sm p-2 max-h-32 min-h-[40px] focus:outline-none resize-none custom-scrollbar"
                        rows={input.split('\n').length > 1 ? Math.min(input.split('\n').length, 4) : 1}
                    />
                    
                    {isStreaming ? (
                        <button 
                            onClick={onStop}
                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-lg transition-colors shrink-0 flex items-center gap-1"
                            title="Dừng tạo"
                        >
                            <StopCircle size={20} />
                        </button>
                    ) : (
                        <button 
                            onClick={handleSend}
                            disabled={(!input.trim() && images.length === 0)}
                            className="p-2 text-white bg-cinema-accent hover:bg-rose-600 disabled:opacity-50 disabled:hover:bg-cinema-accent rounded-lg transition-colors shrink-0 shadow-md"
                        >
                            <Send size={18} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChatWindow;
