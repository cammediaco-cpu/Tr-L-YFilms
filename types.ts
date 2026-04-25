export enum AspectRatio {
  R_16_9 = "16:9",
  R_9_16 = "9:16",
  R_3_4 = "3:4",
  R_4_3 = "4:3",
  R_2_3 = "2:3",
  R_3_2 = "3:2",
  R_1_1 = "1:1",
  R_21_9 = "21:9"
}

export enum Resolution {
  RES_1080P = "1080p",
  RES_720P = "720p",
  RES_480P = "480p",
  RES_2K = "2k",
  RES_4K = "4k"
}

export enum ImageModel {
  SEEDREAM_4_0 = "seedream-4-0",
  SEEDREAM_4_5 = "seedream-4-5",
  SEEDREAM_5_0 = "seedream-5-0"
}

export enum VideoModel {
  SEEDANCE_1_0_LITE = "seedance-1-0-lite",
  SEEDANCE_1_0_PRO_FAST = "seedance-1-0-pro-fast",
  SEEDANCE_1_0_PRO = "seedance-1-0-pro",
  SEEDANCE_1_5_PRO = "seedance-1.5-pro"
}

export enum TextModel {
  SEED_1_8 = "seed-1-8",
  SEED_2_0_LITE = "seed-2-0-lite",
  SEED_2_0_PRO = "seed-2-0-pro"
}

export enum GenerationMode {
  FIRST_TO_LAST = "first_to_last", // User provides start, AI makes end
  LAST_TO_FIRST = "last_to_first"  // User provides end, AI makes start
}

export enum CreativeIntent {
  GENERATE = "generate",
  EDIT = "edit",
  COMBINE = "combine",
  CUSTOM = "custom",
  VIDEO = "video"
}

// NEW: App Operation Mode
export enum AppMode {
  DIRECTOR = "director",   // Old functionality
  CREATIVE = "creative",    // New functionality
  VIDEO = "video",          // Video generation
  TTS = "tts",              // Text to Speech
  CHAT = "chat"             // Support for AI Chat Page
}

export enum AssetType {
  IMAGE = "image",
  VIDEO = "video",
  AUDIO = "audio"
}

export interface GeneratedAsset {
  id: string;
  url: string;
  timestamp: number;
  prompt: string;
  ratio: string;
  type: AssetType;
  metadata?: {
    duration?: number;
    resolution?: string;
    tokens?: number;
    isPending?: boolean;
    voice?: string;
    model?: string;
    refImages?: string[];
  };
}

export interface ApiCredentials {
  baseUrl: string;
  apiKey: string;
  openAiApiKey?: string;
  reasoningModel?: string;
}

export enum MotionStrength {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high"
}

export enum ContextRole {
  GENERAL = "general",
  FACE = "face",
  BACKGROUND = "background",
  STYLE = "style",
  OUTFIT = "outfit",
  POSE = "pose"
}

export interface ContextImage {
  id: string;
  file: File;
  preview: string;
  role: ContextRole;
}

// NEW: Interface for Creative Mode Prompt
export interface CreativePromptResult {
  english: string;
  vietnamese: string;
}

export interface VoiceProfile {
  id: string;
  name: string;
  voice: string;
  prompt: string;
}
