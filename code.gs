/**
 * LUXVISION AI ARCHITECT - DRIVE SERVICE SCRIPT
 * 
 * Reusable structure for Google Apps Script.
 * To add new functionality:
 * 1. Add a handler function (e.g., deleteFile)
 * 2. Update doGet or doPost to call that handler based on a 'action' parameter.
 */

// --- CONFIGURATION ---
const CONFIG = {
  FOLDER_ID: "18ppLAomvlVkHbJNUO_ucgfreNemEdEzH",
  DEFAULT_LIMIT: 50,
  MIME_TYPES: {
    IMAGE: "image/",
    JSON: ContentService.MimeType.JSON
  }
};

// --- CORE HANDLERS ---

/**
 * Handle POST requests (Uploads, Mutations)
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action || 'upload'; // Default to upload for backward compatibility
    
    switch(action) {
      case 'upload':
        return handleFileUpload(payload);
      // case 'delete': return handleFileDelete(payload); // Future example
      default:
        throw new Error("Unknown action: " + action);
    }
  } catch (error) {
    return createResponse({ status: "error", message: error.toString() }, 500);
  }
}

/**
 * Handle GET requests (Fetching lists, Metadata)
 */
function doGet(e) {
  try {
    const action = e.parameter.action || 'list';
    
    switch(action) {
      case 'list':
        return handleFileList(e.parameter);
      default:
        throw new Error("Unknown action: " + action);
    }
  } catch (error) {
    return createResponse({ status: "error", message: error.toString() }, 500);
  }
}

// --- LOGIC FUNCTIONS ---

function handleFileUpload(data) {
  const folder = getAppFolder();
  const blob = Utilities.newBlob(Utilities.base64Decode(data.file), data.mimeType, data.filename);
  const file = folder.createFile(blob);
  
  // Ensure accessibility
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  return createResponse({ 
    status: "success", 
    url: getThumbnailUrl(file.getId()),
    id: file.getId() 
  });
}

function handleFileList(params) {
  const folder = getAppFolder();
  const limit = parseInt(params.limit) || CONFIG.DEFAULT_LIMIT;
  
  // Exclude trashed files
  const query = `'${CONFIG.FOLDER_ID}' in parents and (mimeType contains '${CONFIG.MIME_TYPES.IMAGE}') and trashed = false`;
  const files = folder.searchFiles(query);
  
  const results = [];
  while (files.hasNext() && results.length < limit) {
    const file = files.next();
    
    // Auto-fix permissions if they are restricted
    try {
      if (file.getSharing() !== DriveApp.Access.ANYONE_WITH_LINK) {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      }
    } catch (e) {
      // Fallback in case of permission errors or delays
      try {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (err) {}
    }
    
    results.push(mapFileToDto(file));
  }
  
  // Sort by date created (newest first)
  results.sort((a, b) => b.timestamp - a.timestamp);

  return createResponse({ status: "success", files: results });
}

// --- HELPERS (REUSABLE) ---

/**
 * Gets the target Drive folder using ID from config
 */
function getAppFolder() {
  return DriveApp.getFolderById(CONFIG.FOLDER_ID);
}

/**
 * Maps a Google Drive File object to a clean data object
 */
function mapFileToDto(file) {
  return {
    id: file.getId(),
    url: getThumbnailUrl(file.getId()),
    name: file.getName(),
    timestamp: file.getDateCreated().getTime(),
    mimeType: file.getMimeType(),
    size: file.getSize()
  };
}

/**
 * Formats a direct-view URL for Drive images.
 */
function getThumbnailUrl(id) {
  // lh3 format is often more reliable for public embedding than drive-thumbnail
  return "https://lh3.googleusercontent.com/d/" + id;
}

/**
 * Standardizes response format
 */
function createResponse(data, code = 200) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(CONFIG.MIME_TYPES.JSON);
}