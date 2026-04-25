import { ApiCredentials } from "../types";
import { MODEL_VIDEO } from "../constants";
import { handleFetchError, callOpenAiApi } from "./apiClient";

/**
 * FEATURE: TẠO VIDEO (Seedance 1.5 Pro)
 */
export const generateVideo = async (
    creds: ApiCredentials,
    prompt: string,
    images: string[], // up to 4
    resolution: string,
    ratio: string,
    duration: number,
    cameraFixed: boolean,
    generateAudio: boolean,
    model: string = MODEL_VIDEO,
    useFirstLastFrame: boolean = false
): Promise<string> => {
    if (!creds.baseUrl || !creds.apiKey) {
        throw new Error("Vui lòng cấu hình API trong phần cài đặt.");
    }

    try {
        const extraBody: any = {
            Resolution: resolution,
            Ratio: ratio,
            Duration: duration,
            CameraFixed: cameraFixed
        };

        if (images && images.length > 0) {
            extraBody.images = images;
        }

        if (model === "seedance-1.5-pro") {
            extraBody.GenerateAudio = generateAudio;
        }

        if (images.length === 2 && useFirstLastFrame) {
            extraBody.useFirstLastFrame = true;
        }

        const messages = [{ role: "user", content: prompt }];
        const data = await callOpenAiApi(creds, model, messages, extraBody);
        
        const videoUrl = data.choices?.[0]?.message?.content;
        
        if (!videoUrl) throw new Error("AI không trả về link video.");
        return videoUrl;
    } catch (error) {
        handleFetchError(error, creds.baseUrl);
        throw error;
    }
};
