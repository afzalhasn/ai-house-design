import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const MODEL_NAME = 'gemini-2.5-flash-image';
const REASONING_MODEL = 'gemini-3-flash-preview';

const getApiKey = () => process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';

export const generateImage = async (prompt: string, aspectRatio: string = "16:9"): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: {
                parts: [{ text: prompt }]
            },
            config: {
                imageConfig: {
                    aspectRatio: aspectRatio
                }
            }
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                return `data:image/png;base64,${part.inlineData.data}`;
            }
        }

        throw new Error("No image data found in response");
    } catch (error) {
        console.error("Gemini Image Generation Error:", error);
        throw error;
    }
};

export const editImage = async (base64Data: string, editPrompt: string, aspectRatio: string = "16:9"): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });

    // Strip the prefix (data:image/png;base64,) if present
    const base64Content = base64Data.split(',')[1] || base64Data;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: {
                parts: [
                    {
                        inlineData: {
                            data: base64Content,
                            mimeType: 'image/png',
                        },
                    },
                    {
                        text: editPrompt,
                    },
                ],
            },
            config: {
                imageConfig: {
                    aspectRatio: aspectRatio
                }
            }
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                return `data:image/png;base64,${part.inlineData.data}`;
            }
        }

        throw new Error("No edited image data found in response");
    } catch (error) {
        console.error("Gemini Image Editing Error:", error);
        throw error;
    }
};

export const getPromptSuggestions = async (currentImageBase64: string | null): Promise<string[]> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });

    let parts: any[] = [];

    if (currentImageBase64) {
        const base64Content = currentImageBase64.split(',')[1] || currentImageBase64;
        parts.push({ inlineData: { mimeType: 'image/png', data: base64Content } });
        parts.push({ text: "Analyze this architectural image. Suggest 10 creative, distinct, and high-quality prompt ideas to edit or reimagine this design using an AI image generator. Focus on varying styles (e.g. Brutalist, Art Deco), environments (e.g. Snowy, Desert), lighting (e.g. Golden Hour), or materials. Return ONLY a JSON array of strings." });
    } else {
        parts.push({ text: "Generate 10 creative and distinct prompt ideas for generating a luxury architectural house using AI. Cover different styles, locations, and moods. Return ONLY a JSON array of strings." });
    }

    try {
        const response = await ai.models.generateContent({
            model: REASONING_MODEL,
            contents: { parts },
            config: {
                responseMimeType: 'application/json'
            }
        });

        const text = response.text;
        if (!text) return [];

        const suggestions = JSON.parse(text);
        return Array.isArray(suggestions) ? suggestions : [];
    } catch (e) {
        console.error("Error fetching suggestions", e);
        return [
            "Change to a modern minimalist concrete style",
            "Set the scene at sunset with warm interior lighting",
            "Add a large infinity pool in the foreground",
            "Transform into a winter scene with snow",
            "Change materials to black timber and glass"
        ];
    }
};
