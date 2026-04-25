import { AspectRatio, Resolution, ImageModel, VideoModel, TextModel } from "./types";

export const ASPECT_RATIOS = [
  { value: AspectRatio.R_16_9, label: "16:9 (Landscape)" },
  { value: AspectRatio.R_9_16, label: "9:16 (Portrait/TikTok)" },
  { value: AspectRatio.R_21_9, label: "21:9 (Cinematic)" },
  { value: AspectRatio.R_1_1, label: "1:1 (Square)" },
  { value: AspectRatio.R_4_3, label: "4:3 (Classic)" },
  { value: AspectRatio.R_3_4, label: "3:4 (Social)" },
  { value: AspectRatio.R_3_2, label: "3:2" },
  { value: AspectRatio.R_2_3, label: "2:3" },
];

export const RESOLUTIONS = [
  { value: Resolution.RES_1080P, label: "1080p (Ultra)", tokensPerSec: 48960 },
  { value: Resolution.RES_720P, label: "720p (High)", tokensPerSec: 20592 },
  { value: Resolution.RES_480P, label: "480p (Standard)", tokensPerSec: 9720 },
];

export const IMAGE_RESOLUTIONS = [
  { value: Resolution.RES_2K, label: "2K (QHD)" },
  { value: Resolution.RES_4K, label: "4K (UHD)" },
];

export const IMAGE_MODELS = [
  { value: ImageModel.SEEDREAM_4_0, label: "Seedream 4.0" },
  { value: ImageModel.SEEDREAM_4_5, label: "Seedream 4.5" },
  { value: ImageModel.SEEDREAM_5_0, label: "Seedream 5.0" }
];

export const VIDEO_MODELS = [
  { value: VideoModel.SEEDANCE_1_0_LITE, label: "Seedance 1.0 Lite" },
  { value: VideoModel.SEEDANCE_1_0_PRO_FAST, label: "Seedance 1.0 Pro Fast" },
  { value: VideoModel.SEEDANCE_1_0_PRO, label: "Seedance 1.0 Pro" },
  { value: VideoModel.SEEDANCE_1_5_PRO, label: "Seedance 1.5 Pro" }
];

export const TEXT_MODELS = [
  { value: TextModel.SEED_1_8, label: "Seed 1.8" },
  { value: TextModel.SEED_2_0_LITE, label: "Seed 2.0 Lite" },
  { value: TextModel.SEED_2_0_PRO, label: "Seed 2.0 Pro" }
];

export const MODEL_IMAGE_BASE = ImageModel.SEEDREAM_4_5; 
export const MODEL_REASONING = TextModel.SEED_2_0_PRO;
export const MODEL_VIDEO = VideoModel.SEEDANCE_1_0_LITE; // Default to Lite as per guide

export const VIDEO_RESOLUTIONS = RESOLUTIONS;

export const VIDEO_RATIOS = [
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
  { value: "21:9", label: "21:9" },
  { value: "1:1", label: "1:1" },
  { value: "4:3", label: "4:3" },
  { value: "3:4", label: "3:4" },
];
