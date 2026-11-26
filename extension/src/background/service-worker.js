chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err) => console.error('[LPC] Failed to set sidePanel behavior:', err));
});

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(() => {});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== 'SAVE_POST') {
    return false;
  }

  handleSavePost(message.payload)
    .then((result) => sendResponse(result))
    .catch((error) => {
      console.error('[LPC] Unexpected save error:', error);
      sendResponse({
        ok: false,
        status: 'error',
        message: error?.message || 'Unexpected error',
      });
    });

  return true;
});

async function handleSavePost(payload) {
  if (!payload || !payload.post_url) {
    return {
      ok: false,
      status: 'error',
      message: 'Missing post URL',
    };
  }

  const { savedPosts = [] } = await chrome.storage.local.get(['savedPosts']);
  const normalizedUrl = payload.post_url.trim();

  const existing = savedPosts.find((p) => p.postUrl === normalizedUrl);
  if (existing) {
    return {
      ok: false,
      status: 'duplicate',
      post: existing,
      message: 'Post already saved',
    };
  }

  const savedPost = {
    id: Date.now(),
    postUrl: normalizedUrl,
    authorName: payload.author_name ?? null,
    authorProfileUrl: payload.author_profile_url ?? null,
    postText: payload.post_text ?? null,
    postType: payload.post_type || 'text',
    publishedAtText: payload.published_at_text ?? null,
    likesCount: payload.likes_count ?? 0,
    commentsCount: payload.comments_count ?? 0,
    repostsCount: payload.reposts_count ?? 0,
    mediaUrls: Array.isArray(payload.media_urls) ? payload.media_urls : [],
    hashtags: Array.isArray(payload.hashtags) ? payload.hashtags : [],
    mentions: Array.isArray(payload.mentions) ? payload.mentions : [],
    notes: payload.notes ?? '',
    extractedAt: payload.extracted_at || new Date().toISOString(),
  };

  const updatedPosts = [savedPost, ...savedPosts];
  await chrome.storage.local.set({ savedPosts: updatedPosts });

  chrome.runtime
    .sendMessage({
      type: 'POST_ADDED',
      post: savedPost,
    })
    .catch(() => {
      // Side panel may not be open; ignore
    });

  return {
    ok: true,
    status: 'saved',
    post: savedPost,
  };
}
