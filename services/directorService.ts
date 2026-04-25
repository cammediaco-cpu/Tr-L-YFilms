import { ApiCredentials, AspectRatio, Resolution, GenerationMode, MotionStrength, ContextRole } from "../types";
import { MODEL_REASONING, MODEL_IMAGE_BASE } from "../constants";
import { callOpenAiApi, handleFetchError, extractUrlFromText } from "./apiClient";

/**
 * FEATURE 1: LÊN KỊCH BẢN (Director Mode)
 * Model: Gemini 3 Flash (MODEL_REASONING)
 * Input: Ảnh gốc (Main) + Ảnh ngữ cảnh (Context) + Prompt
 */
export const enhancePromptWithMotion = async (
  creds: ApiCredentials,
  prompt: string,
  duration: number,
  mode: GenerationMode,
  referenceImageDataUrl: string,
  contextImages: { url: string; role: ContextRole }[] = [],
  aspectRatio?: string
): Promise<string> => {
  
  const isForward = mode === GenerationMode.FIRST_TO_LAST;
  const targetFrameName = isForward ? 'LAST FRAME' : 'FIRST FRAME';
  const inputFrameName = isForward ? 'FIRST FRAME' : 'LAST FRAME';
  
  const targetSettings = aspectRatio ? `\n  TARGET SETTINGS: Aspect Ratio: ${aspectRatio}. Ensure the prompt fits this format if relevant.` : '';

  const systemInstruction = `You are a visionary AI Film Director and Prompt Engineer specializing in Seedream 4.5.
  GOAL: Describe the ${targetFrameName} of a shot based on the user's intent and context.${targetSettings}
  
  INPUT ANALYSIS:
  1. MAIN IMAGE: This is the ${inputFrameName}. Keep the character and setting consistent with this.
  2. CONTEXT IMAGES (Important): Use these for extra details.
     - If 'Face' is provided, ensure facial features match strictly.
     - If 'Background' is provided, ensure the environment matches.
     - If 'Outfit' is provided, apply it to the character.
  3. INTENT: "${prompt}" (Action over ${duration}s).
  
  CRITICAL SEEDREAM 4.5 GUIDELINES:
  1. LANGUAGE: Use natural English sentences (30-100 words).
  2. STRUCTURE: [Subject] + [Action/Pose] + [Environment/Background] + [Lighting] + [Style] + [Technical Details].
  3. POSITION WEIGHT: Put the most important elements at the VERY BEGINNING of the prompt.
  4. SUBJECT SPECIFICITY: Be extremely specific about the subject (who, what, outfit).
  5. LIGHTING & TONE: Determine the mood. NEVER change the lighting, tone, or color grading of reference images UNLESS the user explicitly asks for it.
  6. STYLE & CAMERA: Specify artistic style and camera details.
  7. TEXT RENDERING: If the user wants specific text written in the image, put the exact text in DOUBLE QUOTES.
  8. NEGATIVE PROMPTS: If the user wants to avoid something, use "No...", "Without...", "Avoiding..." directly in the prompt.
  9. CONTEXT UNDERSTANDING: You must understand the video context. If generating the LAST FRAME from a FIRST FRAME, describe the logical conclusion of the action. If generating the FIRST FRAME from a LAST FRAME, describe the logical beginning of the action.
  
  OUTPUT:
  Write a vivid, visual prompt for the ${targetFrameName}.
  - Describe the visual result of the action.
  - Describe camera movement and angle.
  - FORMAT: Raw prompt string only. Do not include any JSON or markdown formatting.`;

  const userContentMultimodal: any[] = [
    { type: "text", text: `[MAIN REFERENCE IMAGE - ${inputFrameName}]` },
    { type: "image_url", image_url: { url: referenceImageDataUrl, detail: "low" } }
  ];

  if (contextImages.length > 0) {
    userContentMultimodal.push({ type: "text", text: "[ADDITIONAL CONTEXT / STYLE GUIDES]" });
    contextImages.forEach((img) => {
        userContentMultimodal.push({ type: "text", text: `Role: ${img.role.toUpperCase()}` });
        userContentMultimodal.push({ type: "image_url", image_url: { url: img.url, detail: "low" } });
    });
  }
  userContentMultimodal.push({ type: "text", text: `USER INTENT: "${prompt}"\nTask: Generate ${targetFrameName} Prompt.` });

  // Fallback text-only
  const userContentTextOnly = `Task: Create a visual prompt for the ${targetFrameName} where the subject performs: "${prompt}". Duration: ${duration}s.`;

  const reasoningModel = creds.reasoningModel || MODEL_REASONING;

  try {
    const data = await callOpenAiApi(creds, reasoningModel, [
        { role: "system", content: systemInstruction }, 
        { role: "user", content: userContentMultimodal }
    ]);
    
    let content = data.choices?.[0]?.message?.content || prompt;
    if (content.startsWith('"') && content.endsWith('"')) content = content.slice(1, -1);
    return content;

  } catch (error) {
    const errString = String(error);
    if (errString.includes("400") || errString.includes("413") || errString.includes("422")) {
        try {
            const data = await callOpenAiApi(creds, reasoningModel, [
                { role: "system", content: systemInstruction }, 
                { role: "user", content: userContentTextOnly }
            ]);
            let content = data.choices?.[0]?.message?.content || prompt;
            if (content.startsWith('"') && content.endsWith('"')) content = content.slice(1, -1);
            return content;
        } catch (retryError) {
             return prompt;
        }
    }
    return prompt; 
  }
};

/**
 * FEATURE 2: TẠO ẢNH ĐẠO DIỄN (Director Image Gen)
 * Model: Image Generation Model (MODEL_IMAGE_BASE)
 * Input: Nhiều hình tham chiếu (Ảnh gốc + Ảnh ngữ cảnh) + Text
 */
export const generateDirectorImage = async (
  creds: ApiCredentials,
  enhancedPrompt: string,
  aspectRatio: AspectRatio,
  resolution: Resolution,
  referenceImageDataUrl: string, 
  motionStrength: MotionStrength,
  contextImageDataUrls: string[] = [],
  modelId: string = MODEL_IMAGE_BASE,
  n: number = 1
): Promise<string[]> => {
    
  try {
    // Text Prompt
    let motionInstruction = "";
    switch (motionStrength) {
        case MotionStrength.LOW: motionInstruction = "Minimal change."; break;
        case MotionStrength.MEDIUM: motionInstruction = "Natural evolution."; break;
        case MotionStrength.HIGH: motionInstruction = "Dynamic change."; break;
    }

    const finalPrompt = `${enhancedPrompt} . ${motionInstruction}`;

    const messages = [{ role: "user", content: finalPrompt }];
    
    const extraBody: any = {
        Ratio: aspectRatio,
        Resolution: resolution,
        images: [referenceImageDataUrl, ...contextImageDataUrls]
    };

    const data = await callOpenAiApi(creds, modelId, messages, extraBody, n);

    const imageUrls: string[] = [];
    if (data.choices && data.choices.length > 0) {
        for (const choice of data.choices) {
            const content = choice.message?.content || "";
            const imageUrl = extractUrlFromText(content);
            if (imageUrl) {
                imageUrls.push(imageUrl);
            } else if (content.length > 1000 && !content.includes(" ")) {
                imageUrls.push(`data:image/png;base64,${content}`);
            } else if (content.startsWith("http")) {
                imageUrls.push(content);
            }
        }
    }

    if (imageUrls.length > 0) return imageUrls;

    throw new Error("AI không trả về link ảnh.");

  } catch (error) {
    handleFetchError(error, creds.baseUrl);
    throw error;
  }
};
