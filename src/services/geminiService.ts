/**
 * Ensures we have raw base64 data. 
 * If the input is a URL (e.g. from Cloud storage), it fetches it first.
 */
const ensureBase64 = async (input: string): Promise<string> => {
    if (input.startsWith('data:')) {
        return input.split(',')[1];
    }

    try {
        const response = await fetch(input);
        if (!response.ok) throw new Error("Fetch failed");
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = (reader.result as string).split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.error("Error converting URL to base64:", e);
        throw new Error("Could not process cloud image. Please try again or download/upload manually.");
    }
};

/**
 * Refines a user prompt into a professional architectural visualization prompt.
 */
const refineArchitecturalPrompt = (prompt: string, aspectRatio: string): string => {
    const professionalTerms = [
        "ultra-realistic", "architectural visualization", "photorealistic", "8k resolution",
        "cinematic lighting", "high detail", "natural textures", "professional composition"
    ];

    const framing = aspectRatio === "9:16" ? "vertical cinematic composition, full height view" :
        aspectRatio === "1:1" ? "centered square composition, focused detail" :
            aspectRatio === "4:5" ? "portrait architectural shot, elegant framing" :
                "wide-angle cinematic shot, expansive view";

    return `${prompt}. Style: ${professionalTerms.join(', ')}. Framing: ${framing}. Optimized for ${aspectRatio} display.`;
};

export const generateImage = async (prompt: string, aspectRatio: string = "9:16"): Promise<string> => {
    try {
        const enhancedPrompt = refineArchitecturalPrompt(prompt, aspectRatio);
        const response = await fetch('/api/gemini/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: enhancedPrompt, aspectRatio })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Generation failed");

        return data.url;
    } catch (error: unknown) {
        console.error("Gemini Image Generation Error:", error);
        throw error;
    }
};

export const editImage = async (imageData: string, editPrompt: string, aspectRatio: string = "9:16"): Promise<string> => {
    try {
        // Ensure we have raw base64 content
        const base64Content = await ensureBase64(imageData);
        const enhancedPrompt = refineArchitecturalPrompt(editPrompt, aspectRatio);

        const response = await fetch('/api/gemini/edit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64Content, editPrompt: enhancedPrompt, aspectRatio })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Editing failed");

        return data.url;
    } catch (error: unknown) {
        console.error("Gemini Image Editing Error:", error);
        throw error;
    }
};

export const getPromptSuggestions = async (currentImageBase64: string | null): Promise<string[]> => {
    try {
        const base64Content = currentImageBase64 ? await ensureBase64(currentImageBase64) : null;

        const response = await fetch('/api/gemini/suggestions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64Content })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Suggestions failed");

        return data.suggestions || [];
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
