export type Role = 'user' | 'assistant' | 'system';

export interface ChatMessage {
    id: string;
    role: Role;
    content: string;
    imageUrls?: string[];
    timestamp: number;
    isStreaming?: boolean;
    isError?: boolean;
}

export interface ChatProfile {
    id: string;
    icon: string;
    name: string;
    systemPrompt: string;
}

export interface ChatSession {
    id: string;
    title: string;
    messages: ChatMessage[];
    updatedAt: number;
    profileId?: string;
}

export interface ChatSettings {
    model: string;
    reasoningEnabled: boolean;
    reasoningMode: 'minimal' | 'low' | 'medium' | 'high';
    searchEnabled: boolean;
}
