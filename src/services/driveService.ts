import { ImageHistoryItem } from '@/types';

interface DriveConfig {
    uploadUrl: string;
}

const driveConfig: DriveConfig = {
    uploadUrl: ''
};

// Safe environment variable access for Next.js
try {
    const envUrl = process.env.NEXT_PUBLIC_DRIVE_UPLOAD_URL;

    if (envUrl) {
        driveConfig.uploadUrl = envUrl;
    }
} catch {
    console.warn("Environment variables not accessible");
}

export const setUploadUrl = (url: string) => {
    driveConfig.uploadUrl = url;
};

// Helper to convert Blob to Base64
const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            // Remove the data URL prefix (e.g., "data:image/png;base64,")
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

export const uploadToDrive = async (blob: Blob, filename: string): Promise<string> => {
    if (!driveConfig.uploadUrl) {
        throw new Error("MISSING_UPLOAD_URL");
    }

    const base64Data = await blobToBase64(blob);

    // We use text/plain to avoid CORS preflight complications with GAS, 
    // but we send a JSON string payload.
    const payload = JSON.stringify({
        file: base64Data,
        filename: filename,
        mimeType: blob.type
    });

    try {
        const response = await fetch(driveConfig.uploadUrl, {
            method: 'POST',
            body: payload,
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            },
        });

        if (!response.ok) {
            throw new Error(`Upload request failed: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.status === 'error') {
            throw new Error(data.message || "Unknown script error");
        }

        return data.url || "Success";
    } catch (error: unknown) {
        console.error("Upload Error:", error);
        const message = error instanceof Error ? error.message : "Network error during upload";
        throw new Error(message);
    }
};
export const fetchDriveFiles = async (): Promise<ImageHistoryItem[]> => {
    if (!driveConfig.uploadUrl) {
        throw new Error("MISSING_UPLOAD_URL");
    }

    try {
        const response = await fetch(driveConfig.uploadUrl);

        if (!response.ok) {
            throw new Error(`Fetch request failed: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.status === 'error') {
            throw new Error(data.message || "Unknown script error");
        }

        return data.files || [];
    } catch (error: unknown) {
        console.error("Fetch Error:", error);
        const message = error instanceof Error ? error.message : "Network error during fetch";
        throw new Error(message);
    }
};
