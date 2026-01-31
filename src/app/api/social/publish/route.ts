import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { platform, contentType, mediaUrls, caption, thumbOffset, imageUrl } = body;

        const igUserId = process.env.IG_USER_ID;
        const accessToken = process.env.ACCESS_TOKEN || process.env.FB_PAGE_TOKEN;

        // Normalize Root URL to ensure it ends exactly with one slash
        let igRootUrl = process.env.IG_ROOT_URL || `https://graph.instagram.com/v23.0/${igUserId}/`;
        if (igRootUrl && !igRootUrl.endsWith('/')) {
            igRootUrl += '/';
        }

        if (!accessToken) {
            return NextResponse.json({ error: "Missing Access Token. Please set ACCESS_TOKEN in your .env file." }, { status: 500 });
        }

        if (platform === 'instagram') {
            if (!igRootUrl) {
                return NextResponse.json({ error: "Missing Instagram Root URL. Please set IG_ROOT_URL in your .env file." }, { status: 500 });
            }

            let creationId: string = "";

            if (contentType === 'CAROUSEL' && Array.isArray(mediaUrls)) {
                // Step 1: Create Carousel Items
                const itemIds = await Promise.all(mediaUrls.map(async (url: string) => {
                    const isVideo = url.toLowerCase().match(/\.(mp4|mov|avi)$/) || url.includes('video');
                    console.log(`[IG] Creating carousel item: ${url}`);
                    const res = await fetch(`${igRootUrl}media`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            [isVideo ? 'video_url' : 'image_url']: url,
                            is_carousel_item: true,
                            access_token: accessToken
                        })
                    });
                    const data = await res.json();
                    if (!res.ok) {
                        console.error("[IG] Carousel item error:", data);
                        throw new Error(data.error?.message || "Failed to create carousel item");
                    }
                    return data.id;
                }));

                // Step 2: Create Carousel Header
                console.log(`[IG] Linking carousel items: ${itemIds.join(',')}`);
                const res = await fetch(`${igRootUrl}media`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        media_type: 'CAROUSEL',
                        children: itemIds,
                        caption: caption,
                        access_token: accessToken
                    })
                });
                const data = await res.json();
                if (!res.ok) {
                    console.error("[IG] Carousel container error:", data);
                    throw new Error(data.error?.message || "Failed to create carousel container");
                }
                creationId = data.id;

            } else if (contentType === 'REEL' && mediaUrls?.[0]) {
                console.log(`[IG] Creating Reel: ${mediaUrls[0]}`);
                const res = await fetch(`${igRootUrl}media`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        media_type: 'REELS',
                        video_url: mediaUrls[0],
                        caption: caption,
                        thumb_offset: thumbOffset || 0,
                        share_to_feed: true,
                        access_token: accessToken
                    })
                });
                const data = await res.json();
                if (!res.ok) {
                    console.error("[IG] Reel container error:", data);
                    throw new Error(data.error?.message || "Failed to create Reels container");
                }
                creationId = data.id;

            } else if (contentType === 'STORY' && mediaUrls?.[0]) {
                const url = mediaUrls[0];
                const isVideo = url.toLowerCase().match(/\.(mp4|mov|avi)$/) || url.includes('video');
                console.log(`[IG] Creating Story: ${url}`);
                const res = await fetch(`${igRootUrl}media`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        media_type: 'STORIES',
                        [isVideo ? 'video_url' : 'image_url']: url,
                        access_token: accessToken
                    })
                });
                const data = await res.json();
                if (!res.ok) {
                    console.error("[IG] Story container error:", data);
                    throw new Error(data.error?.message || "Failed to create Story container");
                }
                creationId = data.id;

            } else {
                // Default to IMAGE
                const url = mediaUrls?.[0] || imageUrl;
                if (!url) throw new Error("No image URL provided for Instagram post");

                console.log(`[IG] Creating Image Post: ${url}`);
                const res = await fetch(`${igRootUrl}media`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        image_url: url,
                        caption: caption,
                        access_token: accessToken
                    })
                });
                const data = await res.json();
                if (!res.ok) {
                    console.error("[IG] Image container error:", data);
                    throw new Error(data.error?.message || "Failed to create image container");
                }
                creationId = data.id;
            }

            // Step 3: Wait for media processing to finish
            if (!creationId) throw new Error("Initialization failed: No creation ID generated");

            console.log(`[IG] Waiting for processing: ${creationId}`);
            let isReady = false;
            let attempts = 0;
            const maxAttempts = 15; // 30 seconds total

            while (!isReady && attempts < maxAttempts) {
                attempts++;
                // Check status
                const statusRes = await fetch(`https://graph.facebook.com/v19.0/${creationId}?fields=status_code,status&access_token=${accessToken}`);
                const statusData = await statusRes.json();

                console.log(`[IG] Poll #${attempts}: ${statusData.status_code || 'PENDING'}`);

                if (statusData.status_code === 'FINISHED' || statusData.status_code === 'READY') {
                    isReady = true;
                } else if (statusData.status_code === 'ERROR') {
                    throw new Error(`Media processing failed: ${statusData.error || 'Unknown error'}`);
                } else {
                    // Still processing
                    await new Promise(r => setTimeout(r, 2000));
                }
            }

            if (!isReady) {
                console.warn("[IG] Media processing timed out, attempting publish anyway...");
            }

            console.log(`[IG] Executing final publish for container: ${creationId}`);
            const publishRes = await fetch(`${igRootUrl}media_publish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    creation_id: creationId,
                    access_token: accessToken
                })
            });

            const publishData = await publishRes.json();
            if (!publishRes.ok) {
                console.error("[IG] Publish execution error:", publishData);
                throw new Error(publishData.error?.message || "Failed to publish Instagram post");
            }

            console.log(`[IG] Successfully published! Post ID: ${publishData.id}`);
            return NextResponse.json({ status: "success", platform: "instagram", postId: publishData.id });
        }

        return NextResponse.json({ error: "Unsupported platform" }, { status: 400 });

    } catch (error: unknown) {
        console.error("Social Publish API Error:", error);
        const message = error instanceof Error ? error.message : "Social publish failed";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}


