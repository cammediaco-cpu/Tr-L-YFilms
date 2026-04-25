import { ApiCredentials } from '../types';

export const generateSpeech = async (
  creds: ApiCredentials,
  text: string,
  voice: string,
  format: string = 'mp3',
  instructions?: string,
  speed: number = 1.0
): Promise<{ url: string, type: string }> => {
  if (!creds.openAiApiKey) {
    throw new Error('OpenAI API Key is required for Text to Speech');
  }

  try {
    const payload: any = {
      model: 'gpt-4o-mini-tts',
      input: text,
      voice: voice,
      response_format: format,
      speed: speed
    };

    if (instructions && instructions.trim() !== '') {
      payload.instructions = instructions.trim();
    }

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${creds.openAiApiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API Error: ${response.status}`);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    return { url, type: `audio/${format}` };
  } catch (error: any) {
    console.error('Error generating speech:', error);
    throw new Error(error.message || 'Failed to generate speech');
  }
};
