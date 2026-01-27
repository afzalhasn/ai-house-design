/*
 * GOOGLE APPS SCRIPT SETUP (REQUIRED FOR NO-LOGIN UPLOADS & FETCHING)
 * 
 * 1. Create a new Google Apps Script at script.google.com
 * 2. Paste the following code:
 *
 *    function doPost(e) {
 *      try {
 *        var data = JSON.parse(e.postData.contents);
 *        var folderId = "18ppLAomvlVkHbJNUO_ucgfreNemEdEzH"; 
 *        var folder = DriveApp.getFolderById(folderId);
 *        var blob = Utilities.newBlob(Utilities.base64Decode(data.file), data.mimeType, data.filename);
 *        var file = folder.createFile(blob);
 *        return ContentService.createTextOutput(JSON.stringify({ status: "success", url: file.getUrl() }))
 *          .setMimeType(ContentService.MimeType.JSON);
 *      } catch (error) {
 *        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
 *          .setMimeType(ContentService.MimeType.JSON);
 *      }
 *    }
 *
 *    function doGet(e) {
 *      try {
 *        var folderId = "18ppLAomvlVkHbJNUO_ucgfreNemEdEzH"; // Your Folder ID
 *        var folder = DriveApp.getFolderById(folderId);
 *        var files = folder.getFiles();
 *        var fileList = [];
 *        var limit = 50; // Fetch last 50 files
 *        
 *        while (files.hasNext() && fileList.length < limit) {
 *          var file = files.next();
 *          var mimeType = file.getMimeType();
 *          
 *          if (mimeType.indexOf('image') > -1 || mimeType.indexOf('video') > -1) {
 *            fileList.push({
 *              id: file.getId(),
 *              url: "https://lh3.googleusercontent.com/d/" + file.getId(),
 *              name: file.getName(),
 *              timestamp: file.getDateCreated().getTime(),
 *              mimeType: mimeType
 *            });
 *          }
 *        }
 *        
 *        fileList.sort(function(a, b) { return b.timestamp - a.timestamp; });
 *
 *        return ContentService.createTextOutput(JSON.stringify({ status: "success", files: fileList }))
 *          .setMimeType(ContentService.MimeType.JSON);
 *      } catch (error) {
 *        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
 *          .setMimeType(ContentService.MimeType.JSON);
 *      }
 *    }
 *
 * 3. Deploy as Web App -> Execute as: Me -> Who has access: Anyone
 * 4. Configure the URL:
 *    - Option A (Recommended): Set VITE_DRIVE_UPLOAD_URL in your .env file.
 */

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
} catch (e) {
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
    } catch (error: any) {
        console.error("Upload Error:", error);
        throw new Error(error.message || "Network error during upload");
    }
};
export const fetchDriveFiles = async (): Promise<any[]> => {
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
    } catch (error: any) {
        console.error("Fetch Error:", error);
        throw new Error(error.message || "Network error during fetch");
    }
};
