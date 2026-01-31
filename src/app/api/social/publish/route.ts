import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { platform, contentType, mediaUrls, caption, thumbOffset, imageUrl } = body;

        const igUserId = process.env.IG_USER_ID;
        const accessToken = process.env.ACCESS_TOKEN || process.env.FB_PAGE_TOKEN;
        const fbPageId = process.env.FB_PAGE_ID;

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
                    if (!res.ok) throw new Error(data.error?.message || "Failed to create carousel item");
                    return data.id;
                }));

                // Step 2: Create Carousel Header
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
                if (!res.ok) throw new Error(data.error?.message || "Failed to create carousel container");
                creationId = data.id;

            } else if (contentType === 'REEL' && mediaUrls?.[0]) {
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
                if (!res.ok) throw new Error(data.error?.message || "Failed to create Reels container");
                creationId = data.id;

            } else if (contentType === 'STORY' && mediaUrls?.[0]) {
                const url = mediaUrls[0];
                const isVideo = url.toLowerCase().match(/\.(mp4|mov|avi)$/) || url.includes('video');
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
                if (!res.ok) throw new Error(data.error?.message || "Failed to create Story container");
                creationId = data.id;

            } else {
                // Default to IMAGE
                const url = mediaUrls?.[0] || imageUrl;
                if (!url) throw new Error("No image URL provided for Instagram post");

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
                if (!res.ok) throw new Error(data.error?.message || "Failed to create image container");
                creationId = data.id;
            }

            // Step 3: Publish the container
            if (!creationId) throw new Error("Initialization failed: No creation ID generated");

            if (contentType === 'REEL' || contentType === 'STORY') {
                await new Promise(r => setTimeout(r, 3000));
            }

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
                console.error("IG Publish Error:", publishData);
                throw new Error(publishData.error?.message || "Failed to publish Instagram post");
            }

            return NextResponse.json({ status: "success", platform: "instagram", postId: publishData.id });

        } else if (platform === 'facebook') {
            if (!fbPageId) {
                return NextResponse.json({ error: "Missing Facebook Page ID. Please set FB_PAGE_ID in your .env file." }, { status: 500 });
            }

            // Publish to Facebook Page
            const fbRes = await fetch(`https://graph.facebook.com/v19.0/${fbPageId}/photos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: mediaUrls?.[0] || imageUrl,
                    message: caption,
                    access_token: accessToken
                })
            });

            const fbData = await fbRes.json();
            if (!fbRes.ok) {
                console.error("FB Publish Error:", fbData);
                throw new Error(fbData.error?.message || "Failed to publish Facebook post");
            }

            return NextResponse.json({ status: "success", platform: "facebook", postId: fbData.id });
        }

        return NextResponse.json({ error: "Unsupported platform" }, { status: 400 });

    } catch (error: unknown) {
        console.error("Social Publish API Error:", error);
        const message = error instanceof Error ? error.message : "Social publish failed";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}


