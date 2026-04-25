import { ApiCredentials, AspectRatio, Resolution, TextModel } from "../types";

export const urlToFile = async (url: string, filename: string = "image.png"): Promise<File> => {
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const blob = await res.blob();
        return new File([blob], filename, { type: blob.type || "image/png" });
    } catch (e) {
        console.warn("Direct fetch failed, trying proxy...", e);
        try {
            // Try using our backend proxy to bypass CORS
            const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
            const res = await fetch(proxyUrl);
            if (!res.ok) throw new Error(`Proxy HTTP error! status: ${res.status}`);
            const blob = await res.blob();
            return new File([blob], filename, { type: blob.type || "image/png" });
        } catch (proxyError) {
            console.warn("Proxy fetch failed, trying canvas fallback...", proxyError);
            // Fallback for CORS issues (might still fail if server doesn't allow cross-origin)
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = "Anonymous";
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(img, 0, 0);
                        canvas.toBlob((blob) => {
                            if (blob) {
                                resolve(new File([blob], filename, { type: "image/png" }));
                            } else {
                                reject(new Error("Canvas toBlob failed"));
                            }
                        }, "image/png");
                    } else {
                        reject(new Error("Canvas Context Error"));
                    }
                };
                img.onerror = () => reject(new Error("Image load error"));
                img.src = url;
            });
        }
    }
};

// Helper: Resize and Compress Image
export const fileToDataUrl = async (file: File, maxSize: number = 2048): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_SIZE = maxSize; 

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            // Use 0.90 quality for balanced fidelity and size
            const dataUrl = canvas.toDataURL('image/jpeg', 0.90);
            resolve(dataUrl);
        } else {
            reject(new Error("Canvas Context Error"));
        }
      };
      img.onerror = () => reject(new Error("Lỗi đọc file ảnh"));
      img.src = event.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const createThumbnail = async (file: File): Promise<string> => {
    return fileToDataUrl(file, 256);
};

export const handleFetchError = (error: unknown, baseUrl: string) => {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("413")) {
        throw new Error(`Lỗi 413: Ảnh quá lớn. Hãy giảm dung lượng.`);
    }
    if (msg.includes("400")) {
        throw new Error(`Lỗi 400: Yêu cầu không hợp lệ. Kiểm tra lại cấu hình Model hoặc tham số gửi đi.`);
    }
    if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        if (window.location.protocol === 'https:' && baseUrl.startsWith('http://')) {
            throw new Error(`Lỗi bảo mật trình duyệt (Mixed Content): Trình duyệt chặn yêu cầu từ App (HTTPS) đến API (HTTP). Để khắc phục, hãy dùng link HTTPS (Cloudflare/Ngrok) hoặc cấu hình CORS trên Server của bạn.`);
        }
        
        throw new Error(`Không thể kết nối đến ${baseUrl}. Kiểm tra Server API hoặc cấu hình CORS.`);
    }
    throw error;
};

// Model Name helper
export const extractUrlFromText = (text: string): string => {
    const markdownRegex = /!\[.*?\]\((.*?)\)/;
    const mdMatch = text.match(markdownRegex);
    if (mdMatch && mdMatch[1]) return mdMatch[1];

    const urlRegex = /(https?:\/\/[^\s)"]+)/g;
    const matches = text.match(urlRegex);
    
    if (matches && matches.length > 0) {
        let url = matches[0];
        url = url.replace(/[).,;]+$/, "");
        return url;
    }
    return "";
};

export const cleanJsonString = (str: string): string => {
    if (!str) return "{}";
    let clean = str.replace(/```json/g, "").replace(/```/g, "").trim();
    const firstOpen = clean.indexOf('{');
    const lastClose = clean.lastIndexOf('}');
    if (firstOpen !== -1 && lastClose !== -1) {
        clean = clean.substring(firstOpen, lastClose + 1);
    }
    return clean;
};

/**
 * STANDARD API CALLER
 * Strictly uses the User Provided Base URL (No magic port switching).
 */
export const callOpenAiApi = async (creds: ApiCredentials, model: string, messages: any[], extraBody?: any, n?: number) => {
    let baseUrl = creds.baseUrl.trim();
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
    
    // Ensure /v1 is present if not already
    if (!baseUrl.includes('/v1')) {
        // Only append if it looks like a base domain/ip
        if (baseUrl.split('/').length <= 3) {
            baseUrl += '/v1';
        }
    }
    
    const finalUrl = `${baseUrl}/chat/completions`;

    const payload: any = {
        model: model,
        messages: messages
    };

    if (n !== undefined) {
        payload.n = n;
    }

    if (extraBody && Object.keys(extraBody).length > 0) {
        payload.extra_body = extraBody;
    }

    // Standard parameters for text models (if not already in extraBody)
    if (model === TextModel.SEED_1_8 || model === TextModel.SEED_2_0_LITE) {
        if (model === TextModel.SEED_1_8) {
            if (payload.max_tokens === undefined) payload.max_tokens = 32768;
            if (payload.temperature === undefined) payload.temperature = 1.0;
            if (payload.top_p === undefined) payload.top_p = 0.95;
        } else {
            if (payload.max_tokens === undefined) payload.max_tokens = 131071;
        }
    }

    const response = await fetch(finalUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${creds.apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const text = await response.text();
        let errorMsg = text;
        try {
            const errorJson = JSON.parse(text);
            errorMsg = errorJson.error?.message || errorJson.error || text;
        } catch (e) { }
        throw new Error(`API Error ${response.status} (${model}): ${errorMsg}`);
    }
    return await response.json();
};
