import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from "@google/genai";

const REASONING_MODEL = 'gemini-3-flash-preview';

export async function POST(req: NextRequest) {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return NextResponse.json({ error: "Missing API Key" }, { status: 500 });
    }

    try {
        const { base64Content, prompt } = await req.json();
        const ai = new GoogleGenAI({ apiKey });

        const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [];

        if (base64Content) {
            parts.push({ inlineData: { mimeType: 'image/png', data: base64Content } });
        }

        const systemPrompt = `You are a social media expert specializing in luxury architecture and interior design. 
        Generate a compelling, high-engaging Instagram caption for the above image. 
        The caption should feel premium, artistic, and sophisticated.
        Original design prompt used: ${prompt || 'A magnificent architectural design'}.
        
        Include:
        1. A catchy first line.
        2. 2-3 sentences of descriptive, evocative body text.
        3. A call to action (e.g., "Tag someone who would live here" or "Save for your dream home inspo").
        4. Exactly 10-15 highly relevant architectural and luxury hashtags.
        
        Return ONLY the caption text without any JSON formatting or quotes.`;

        parts.push({ text: systemPrompt });

        const response = await ai.models.generateContent({
            model: REASONING_MODEL,
            contents: { parts }
        });

        const caption = response.text || "";
        return NextResponse.json({ caption });

    } catch (error: unknown) {
        console.error("Gemini Caption Generation Error:", error);
        const message = error instanceof Error ? error.message : "Caption generation failed";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
