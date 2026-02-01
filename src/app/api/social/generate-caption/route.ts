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

        const systemPrompt = `You are a social media expert specializing in luxury architecture in the Indian market.
        Generate a humanized, warm, and short Instagram caption in Indian English style for the above image.
        The vibe should be relatable yet premium (think "aesthetic", "vibe check", "dreamy").
        Original design prompt used: ${prompt || 'A magnificent architectural design'}.
        
        Guidelines:
        1. Keep it very short (max 2 descriptive sentences).
        2. Use a natural, conversational tone (Indian English flavor).
        3. Include a few (5-8) very targeted architectural and luxury hashtags.
        
        Return ONLY the caption text. No generic placeholders or quotes.`;

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
