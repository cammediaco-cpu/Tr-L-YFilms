import { ApiCredentials } from '../../types';
import { ChatMessage, ChatSettings, ChatProfile } from './chatTypes';

// Helper: Resize and Compress Image
export const fileToDataUrl = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_SIZE = 1024; 

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
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
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

export const streamChat = async (
    creds: ApiCredentials,
    messages: ChatMessage[],
    settings: ChatSettings,
    profile: ChatProfile | null,
    onChunk: (text: string) => void,
    signal?: AbortSignal
) => {
    const baseUrl = creds.baseUrl.endsWith('/') ? creds.baseUrl.slice(0, -1) : creds.baseUrl;
    const finalUrl = `${baseUrl}/chat/completions`;

    const apiMessages: any[] = [];

    // 1. Add System Prompt (Profile)
    let systemContent = profile ? profile.systemPrompt : "You are a helpful AI assistant.";
    
    apiMessages.push({ role: 'system', content: systemContent });

    // 2. Map User/Assistant Messages
    messages.forEach(msg => {
        if (msg.role === 'system') return; // Skip internal system messages if any

        if (msg.role === 'user' && msg.imageUrls && msg.imageUrls.length > 0) {
            const contentParts: any[] = [];
            msg.imageUrls.forEach(url => {
                contentParts.push({ type: "image_url", image_url: { url, detail: "low" } });
            });
            contentParts.push({ type: "text", text: msg.content });
            apiMessages.push({ role: 'user', content: contentParts });
        } else {
            apiMessages.push({ role: msg.role, content: msg.content });
        }
    });

    const payload: any = {
        model: settings.model,
        messages: apiMessages,
        max_tokens: (settings.model === 'seed-2-0-lite' || settings.model === 'seed-2-0-pro') ? 131072 : 32768,
        temperature: settings.model === 'seed-1-8' ? 1.0 : 0.7,
        stream: true
    };

    if (settings.model === 'seed-1-8') {
        payload.top_p = 0.95;
    }

    if (settings.reasoningEnabled) {
        payload.reasoning_effort = settings.reasoningMode;
    }

    if (settings.searchEnabled) {
        payload.search = true;
        payload.online = true; // Hỗ trợ nhiều chuẩn API khác nhau
    }

    const response = await fetch(finalUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
            'Authorization': `Bearer ${creds.apiKey}`
        },
        body: JSON.stringify(payload),
        signal
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`API Error ${response.status}: ${text}`);
    }

    if (!response.body) throw new Error("No response body");

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let done = false;
    let reasoningStarted = false;
    let reasoningEnded = false;
    let buffer = "";

    while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            // Giữ lại phần chưa hoàn chỉnh (dòng cuối cùng sau \n) trong buffer
            buffer = lines.pop() || "";

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (trimmedLine.startsWith('data: ') && trimmedLine !== 'data: [DONE]') {
                    try {
                        const data = JSON.parse(trimmedLine.slice(6));
                        if (data.choices && data.choices[0].delta) {
                            const delta = data.choices[0].delta;
                            
                            if (delta.reasoning_content) {
                                if (!reasoningStarted) {
                                    onChunk('<thinking>\n');
                                    reasoningStarted = true;
                                }
                                onChunk(delta.reasoning_content);
                            }
                            
                            if (delta.content) {
                                if (reasoningStarted && !reasoningEnded) {
                                    onChunk('\n</thinking>\n\n');
                                    reasoningEnded = true;
                                }
                                onChunk(delta.content);
                            }
                        }
                    } catch (e) {
                        console.warn("Lỗi parse JSON stream:", e, trimmedLine);
                    }
                }
            }
        }
    }
    if (reasoningStarted && !reasoningEnded) {
        onChunk('\n</thinking>\n\n');
    }
};
