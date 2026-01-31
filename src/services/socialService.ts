export type IGContentType = 'IMAGE' | 'CAROUSEL' | 'REEL' | 'STORY';

export interface InstagramPublishConfig {
    contentType: IGContentType;
    mediaUrls: string[];
    caption?: string;
    thumbOffset?: number; // Only for REEL
}

export interface SocialPublishResult {
    success: boolean;
    platform: 'instagram' | 'facebook';
    postId?: string;
    error?: string;
}

export const publishToInstagram = async (config: InstagramPublishConfig): Promise<SocialPublishResult> => {
    try {
        const response = await fetch('/api/social/publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                platform: 'instagram',
                ...config
            })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Instagram publishing failed");
        return { success: true, platform: 'instagram', postId: data.postId };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Instagram publishing failed";
        return { success: false, platform: 'instagram', error: message };
    }
};

export const publishToFacebook = async (imageUrl: string, caption: string): Promise<SocialPublishResult> => {
    try {
        const response = await fetch('/api/social/publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform: 'facebook', imageUrl, caption })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Facebook publishing failed");
        return { success: true, platform: 'facebook', postId: data.postId };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Facebook publishing failed";
        return { success: false, platform: 'facebook', error: message };
    }
};

export const generateAiCaption = async (base64Content: string, prompt: string): Promise<string> => {
    try {
        const response = await fetch('/api/social/generate-caption', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64Content, prompt })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to generate caption");
        return data.caption;
    } catch (error: unknown) {
        console.error("Caption Generation Error:", error);
        throw error;
    }
};

