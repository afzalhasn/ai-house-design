import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from "@google/genai";

const MODEL_NAME = 'gemini-2.5-flash-image';

export async function POST(req: NextRequest) {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return NextResponse.json({ error: "Missing API Key" }, { status: 500 });
    }

    try {
        const { base64Content, editPrompt, aspectRatio } = await req.json();
        const ai = new GoogleGenAI({ apiKey });

        const response = await ai.models.generateContent({
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
                    aspectRatio: aspectRatio || "9:16"
                }
            }
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                return NextResponse.json({
                    url: `data:image/png;base64,${part.inlineData.data}`
                });
            }
        }

        throw new Error("No edited image data found in response");
    } catch (error: unknown) {
        console.error("Gemini Edit API Error:", error);
        const message = error instanceof Error ? error.message : "Editing failed";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
