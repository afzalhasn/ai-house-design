import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from "@google/genai";

const REASONING_MODEL = 'gemini-3-flash-preview';

export async function POST(req: NextRequest) {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return NextResponse.json({ error: "Missing API Key" }, { status: 500 });
    }

    try {
        const { base64Content } = await req.json();
        const ai = new GoogleGenAI({ apiKey });

        const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [];

        if (base64Content) {
            parts.push({ inlineData: { mimeType: 'image/png', data: base64Content } });
            parts.push({ text: "Analyze this architectural image. Suggest 10 creative, distinct, and high-quality prompt ideas to edit or reimagine this design using an AI image generator. Focus on varying styles (e.g. Brutalist, Art Deco), environments (e.g. Snowy, Desert), lighting (e.g. Golden Hour), or materials. Return ONLY a JSON array of strings." });
        } else {
            parts.push({ text: "Generate 10 creative and distinct prompt ideas for generating a luxury architectural house using AI. Cover different styles, locations, and moods. Return ONLY a JSON array of strings." });
        }

        const response = await ai.models.generateContent({
            model: REASONING_MODEL,
            contents: { parts },
            config: {
                responseMimeType: 'application/json'
            }
        });

        const text = response.text;
        if (!text) return NextResponse.json({ suggestions: [] });

        const suggestions = JSON.parse(text);
        return NextResponse.json({
            suggestions: Array.isArray(suggestions) ? suggestions : []
        });
    } catch (error: unknown) {
        console.error("Gemini Suggestions API Error:", error);
        const message = error instanceof Error ? error.message : "Suggestions failed";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
