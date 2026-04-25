import { ApiCredentials, AspectRatio, Resolution, CreativePromptResult, CreativeIntent } from "../types";
import { MODEL_REASONING, MODEL_IMAGE_BASE } from "../constants";
import { callOpenAiApi, handleFetchError, extractUrlFromText, cleanJsonString } from "./apiClient";

/**
 * FEATURE 3: TỐI ƯU PROMPT (Creative Mode)
 * Model: Gemini 3 Flash (MODEL_REASONING)
 * Input: Prompt Text + (Optionally) Reference Images
 */
export const optimizeCreativePrompt = async (
    creds: ApiCredentials,
    userPrompt: string,
    imageUrls: string[] = [],
    intent: CreativeIntent = CreativeIntent.GENERATE,
    resolution?: string,
    aspectRatio?: string,
    duration?: number
): Promise<CreativePromptResult> => {
    const reasoningModel = creds.reasoningModel || MODEL_REASONING;
    let intentInstruction = "";
    if (intent === CreativeIntent.EDIT) {
        intentInstruction = `
    CURRENT MODE: IMAGE EDITING (Chỉnh sửa ảnh)
    - The user wants to modify specific parts of the reference image(s).
    - CRITICAL: Seedream 4.5 uses instruction-based editing.
    - FORMULA: [Action] + [Object to modify/add/remove] + [New attribute].
    - ACTIONS: Use "Remove...", "Add... [location]", or "Change/Replace [old] to/with [new]".
    - FREEZE DETAILS: You MUST include the phrase "keeping [specific unchanged elements] unchanged" to protect the original image.
    - CRITICAL: You MUST explicitly instruct the image model to KEEP THE ORIGINAL LIGHTING, COLOR GRADING, TONE, AND BACKGROUND EXACTLY THE SAME unless asked to change them.
    - Be direct. Say "Change the red car to blue" instead of "Make it blue".`;
    } else if (intent === CreativeIntent.COMBINE) {
        intentInstruction = `
    CURRENT MODE: COMBINING IMAGES (Kết hợp ảnh / Image-to-Image)
    - The user wants to combine elements from the provided reference images.
    - CRITICAL: You MUST explicitly assign roles to the reference images in the prompt (e.g., "Use Image 1 for the main character, place them into the background of Image 2").
    - Specify clearly how the elements should be blended (e.g., "Smooth blending").
    - Maintain the lighting and tone of the primary subject unless requested otherwise.`;
    } else if (intent === CreativeIntent.CUSTOM) {
        intentInstruction = `
    CURRENT MODE: CUSTOM (Tuỳ chỉnh)
    - The user wants you to ONLY translate and optimize their exact input.
    - CRITICAL: DO NOT add any extra rules, atmosphere, lighting, or background instructions unless the user explicitly asked for them.
    - CRITICAL: DO NOT add "Preserve original atmosphere", "exact same lighting", etc.
    - Just translate their idea to high-quality English and structure it well.`;
    } else if (intent === CreativeIntent.VIDEO) {
        intentInstruction = `
    CURRENT MODE: VIDEO GENERATION (Tạo Video)
    - The user wants to create a cinematic video.
    - CRITICAL: Focus on MOTION, CAMERA MOVEMENT, and DYNAMICS.
    - Describe the scene, the subject, and the action vividly.
    - Specify camera angles (e.g., "Drone shot", "Pan right", "Zoom in") and lighting.
    - Ensure the prompt is optimized for a video generation model (like Runway/Sora/Veo).`;
    } else {
        intentInstruction = `
    CURRENT MODE: NEW GENERATION (Tạo ảnh mới)
    - Create a highly detailed, professional prompt based on the user's idea.
    - Specify lighting, camera angle, style, and atmosphere.`;
    }

    let targetSettings = '';
    if (resolution || aspectRatio || duration) {
        targetSettings = '\n    TARGET SETTINGS:';
        if (resolution) targetSettings += ` Resolution: ${resolution}.`;
        if (aspectRatio) targetSettings += ` Aspect Ratio: ${aspectRatio}.`;
        if (duration) targetSettings += ` Duration: ${duration}s.`;
        targetSettings += ' Ensure the prompt fits this format if relevant.';
    }

    const systemInstruction = `You are an elite AI Prompt Engineer specializing in precise image generation and editing for the Seedream 4.5 model.
    TASK: Analyze the User's Idea and Reference Images (if any) to create a highly accurate, professional prompt for an image generation model.
    
    ${intentInstruction}${targetSettings}
    
    GENERAL CRITICAL RULES (SEEDREAM 4.5 GUIDELINES):
    1. LANGUAGE: Use natural English sentences, not just comma-separated keywords. Length should be 30-100 words.
    2. STRUCTURE: [Subject] + [Action/Pose] + [Environment/Background] + [Lighting] + [Style] + [Technical Details].
    3. POSITION WEIGHT: Put the most important elements at the VERY BEGINNING of the prompt.
    4. SUBJECT SPECIFICITY: Be extremely specific about the subject (who, what, outfit). Don't use generic terms like "a girl".
    5. LIGHTING & TONE: Determine the mood (e.g., "golden hour lighting", "cinematic lighting", "dramatic shadows"). NEVER change the lighting, tone, or color grading of reference images UNLESS the user explicitly asks for it.
    6. STYLE & CAMERA: Specify artistic style and camera details (e.g., "photorealistic portrait", "35mm lens", "4K, highly detailed, sharp focus").
    7. TEXT RENDERING: If the user wants specific text written in the image (like on a sign or shirt), put the exact text in DOUBLE QUOTES (e.g., a neon sign reading "HELLO").
    8. NEGATIVE PROMPTS: If the user wants to avoid something, use "No...", "Without...", "Avoiding..." directly in the prompt.
    9. ACCURACY: Do not hallucinate or add random elements not requested by the user. Stick strictly to the user's instructions.
    
    OUTPUT FORMAT:
    Return a JSON object with:
    - "english": The highly optimized, precise prompt in English.
    - "vietnamese": A clear explanation of what the prompt will do (in Vietnamese).
    
    RETURN JSON: { "english": "...", "vietnamese": "..." }`;

    const userContentMultimodal: any[] = [{ type: "text", text: `USER IDEA: "${userPrompt}"` }];
    
    // Feature: Tối ưu hoá prompt (có hình tham chiếu hoặc không)
    if (imageUrls.length > 0) {
        userContentMultimodal.push({ type: "text", text: "REFERENCES:" });
        imageUrls.forEach(url => userContentMultimodal.push({ 
            type: "image_url", 
            image_url: { url, detail: "low" } 
        }));
    }

    const userContentTextOnly = [{ type: "text", text: `USER IDEA: "${userPrompt}"` }];

    try {
        const data = await callOpenAiApi(creds, reasoningModel, [
            { role: "system", content: systemInstruction }, 
            { role: "user", content: userContentMultimodal }
        ]);

        const content = data.choices?.[0]?.message?.content || "{}";
        const cleanContent = cleanJsonString(content);
        return JSON.parse(cleanContent);

    } catch (e) {
        try {
            const data = await callOpenAiApi(creds, reasoningModel, [
                { role: "system", content: systemInstruction }, 
                { role: "user", content: userContentTextOnly }
            ]);
            const content = data.choices?.[0]?.message?.content || "{}";
            const cleanContent = cleanJsonString(content);
            return JSON.parse(cleanContent);
        } catch (retryEx) {
             return { english: userPrompt, vietnamese: "Lỗi tối ưu, dùng prompt gốc." };
        }
    }
};

/**
 * FEATURE 4: TẠO ẢNH SÁNG TẠO
 * Model: Gemini 3 Pro Image (MODEL_IMAGE_BASE)
 */
export const generateCreativeImage = async (
    creds: ApiCredentials,
    prompt: string,
    aspectRatio: AspectRatio,
    resolution: Resolution,
    referenceImagesDataUrls: string[],
    modelId: string = MODEL_IMAGE_BASE,
    n: number = 1
): Promise<string[]> => {
    try {
        const messages = [{ role: "user", content: prompt }];
        
        const extraBody: any = {
            Ratio: aspectRatio
        };

        if (referenceImagesDataUrls && referenceImagesDataUrls.length > 0) {
            extraBody.images = referenceImagesDataUrls;
        }

        if (modelId !== "seedream-5-0") {
            extraBody.Resolution = resolution;
        }

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

        throw new Error("Không tìm thấy link ảnh.");

    } catch (error) {
        handleFetchError(error, creds.baseUrl);
        throw error;
    }
};
