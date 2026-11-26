(() => {
  const SEE_MORE_WAIT_MS = 120;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function cleanText(text) {
    if (!text) return '';
    return text.replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').trim();
  }

  function parseCompactCount(rawText) {
    if (!rawText) return 0;
    const text = rawText.replace(/,/g, '').trim();
    const match = text.match(/(\d+(?:\.\d+)?)\s*([KMB])?/i);
    if (!match) return 0;
    const value = parseFloat(match[1]);
    const suffix = (match[2] || '').toUpperCase();
    if (suffix === 'K') return Math.round(value * 1000);
    if (suffix === 'M') return Math.round(value * 1000000);
    if (suffix === 'B') return Math.round(value * 1000000000);
    return Math.round(value);
  }

  function normalizeLinkedInUrl(href) {
    if (!href) return null;
    try {
      const url = new URL(href, 'https://www.linkedin.com');
      url.search = '';
      url.hash = '';
      return url.toString();
    } catch {
      return null;
    }
  }

  async function expandSeeMore(postEl) {
    const seeMoreSelectors = [
      'button.feed-shared-inline-show-more-text__see-more-less-toggle',
      'button[aria-label*="see more" i]',
      'button.see-more',
      '.feed-shared-text-view button',
    ];

    for (const selector of seeMoreSelectors) {
      const btn = postEl.querySelector(selector);
      if (btn && /more/i.test(btn.textContent || btn.getAttribute('aria-label') || '')) {
        btn.click();
        await sleep(SEE_MORE_WAIT_MS);
        return;
      }
    }
  }

  function extractUrn(postEl) {
    const directUrn = postEl.getAttribute('data-urn');
    if (directUrn && directUrn.startsWith('urn:li:')) {
      return directUrn;
    }
    const nestedUrnEl = postEl.querySelector('[data-urn^="urn:li:activity:"]');
    if (nestedUrnEl) {
      return nestedUrnEl.getAttribute('data-urn');
    }
    const idAttr = postEl.getAttribute('data-id');
    if (idAttr && idAttr.startsWith('urn:li:')) {
      return idAttr;
    }
    return null;
  }

  function extractPostUrl(postEl, urn) {
    const linkSelectors = [
      'a[href*="/feed/update/"]',
      'a[href*="/posts/"]',
      '.update-components-actor__sub-description-link',
      'a.app-aware-link[href*="urn:li:"]',
    ];

    for (const selector of linkSelectors) {
      const anchor = postEl.querySelector(selector);
      if (anchor && anchor.href && !anchor.href.includes('/in/')) {
        const normalized = normalizeLinkedInUrl(anchor.href);
        if (normalized) return normalized;
      }
    }

    if (urn) {
      return `https://www.linkedin.com/feed/update/${urn}`;
    }

    return window.location.href.split('?')[0];
  }

  function extractAuthor(postEl) {
    const nameSelectors = [
      '.update-components-actor__title span[aria-hidden="true"]',
      '.update-components-actor__name span[aria-hidden="true"]',
      '.feed-shared-actor__name span[aria-hidden="true"]',
      '.update-components-actor__title',
      '.feed-shared-actor__name',
    ];

    let authorName = null;
    for (const selector of nameSelectors) {
      const el = postEl.querySelector(selector);
      const text = cleanText(el?.textContent);
      if (text) {
        authorName = text.split('\n')[0].trim();
        break;
      }
    }

    const profileSelectors = [
      'a.update-components-actor__meta-link',
      'a.update-components-actor__container-link',
      'a.feed-shared-actor__container-link',
      'a[href*="/in/"]',
      'a[href*="/company/"]',
    ];

    let authorProfileUrl = null;
    for (const selector of profileSelectors) {
      const anchor = postEl.querySelector(selector);
      if (anchor && anchor.href) {
        authorProfileUrl = normalizeLinkedInUrl(anchor.href);
        if (authorProfileUrl) break;
      }
    }

    return { authorName, authorProfileUrl };
  }

  function extractPublishedAt(postEl) {
    const timeSelectors = [
      '.update-components-actor__sub-description span[aria-hidden="true"]',
      '.feed-shared-actor__sub-description span[aria-hidden="true"]',
      '.update-components-actor__sub-description',
      'time',
    ];

    for (const selector of timeSelectors) {
      const el = postEl.querySelector(selector);
      const raw = cleanText(el?.textContent);
      if (raw) {
        // Take first token before bullet separator (e.g., "2d • Edited •")
        const firstPart = raw.split('•')[0].trim();
        if (firstPart) return firstPart;
      }
    }

    return null;
  }

  function extractPostText(postEl) {
    const textSelectors = [
      '.update-components-text .break-words',
      '.feed-shared-update-v2__description .break-words',
      '.feed-shared-text__text-view',
      '.update-components-text',
      '[data-view-name="feed-commentary"]',
      '[data-testid="expandable-text-box"]',
    ];

    for (const selector of textSelectors) {
      const el = postEl.querySelector(selector);
      if (el) {
        const clone = el.cloneNode(true);
        // Remove hidden accessibility duplicates or see-more buttons
        clone
          .querySelectorAll('.visually-hidden, button, .see-more')
          .forEach((node) => node.remove());
        const text = cleanText(clone.innerText || clone.textContent);
        if (text) return text;
      }
    }

    return '';
  }

  function extractSocialCounts(postEl) {
    let likesCount = 0;
    let commentsCount = 0;
    let repostsCount = 0;

    const likesEl =
      postEl.querySelector('.social-details-social-counts__reactions-count') ||
      postEl.querySelector('button[aria-label*="reaction" i]') ||
      postEl.querySelector('button[aria-label*="like" i]') ||
      postEl.querySelector('svg[id^="thumbs-up-"]')?.closest('button, [role="button"], span');
    if (likesEl) {
      likesCount = parseCompactCount(
        likesEl.textContent || likesEl.getAttribute('aria-label'),
      );
    }

    const commentsEl =
      postEl.querySelector('.social-details-social-counts__comments') ||
      postEl.querySelector('button[aria-label*="comment" i][aria-label*="on" i]') ||
      postEl.querySelector('li.social-details-social-counts__comments button') ||
      postEl.querySelector('svg[id*="comment"]')?.closest('button, [role="button"], span');
    if (commentsEl) {
      commentsCount = parseCompactCount(
        commentsEl.textContent || commentsEl.getAttribute('aria-label'),
      );
    }

    const repostsEl =
      postEl.querySelector('button[aria-label*="repost" i][aria-label*="on" i]') ||
      postEl.querySelector('li.social-details-social-counts__item--reposts button') ||
      postEl.querySelector('svg[id*="repost"]')?.closest('button, [role="button"], span');
    if (repostsEl) {
      repostsCount = parseCompactCount(
        repostsEl.textContent || repostsEl.getAttribute('aria-label'),
      );
    }

    return { likesCount, commentsCount, repostsCount };
  }

  function extractMediaUrls(postEl) {
    const urls = new Set();

    const imgSelectors = [
      '.update-components-image img',
      '.feed-shared-image img',
      '.update-components-article img',
      '.feed-shared-carousel img',
      '.update-components-document img',
    ];
    for (const selector of imgSelectors) {
      postEl.querySelectorAll(selector).forEach((img) => {
        const src = img.getAttribute('src') || img.getAttribute('data-delayed-url');
        if (src && src.startsWith('http') && !src.includes('profile-displayphoto')) {
          urls.add(src);
        }
      });
    }

    postEl.querySelectorAll('video').forEach((video) => {
      const src = video.getAttribute('src') || video.getAttribute('poster');
      if (src && src.startsWith('http')) {
        urls.add(src);
      }
    });

    return Array.from(urls);
  }

  function extractHashtagsAndMentions(postEl, postText) {
    const hashtags = new Set();
    const mentions = new Set();

    const textContainer =
      postEl.querySelector('.update-components-text') ||
      postEl.querySelector('.feed-shared-update-v2__description') ||
      postEl;

    textContainer.querySelectorAll('a').forEach((anchor) => {
      const href = anchor.getAttribute('href') || '';
      const label = cleanText(anchor.textContent);
      if (!label) return;

      if (href.includes('/feed/hashtag/') || label.startsWith('#')) {
        hashtags.add(label.startsWith('#') ? label : `#${label}`);
      } else if (href.includes('/in/') || href.includes('/company/')) {
        mentions.add(label.replace(/^@/, ''));
      }
    });

    // Fallback regex scan for hashtags in plain text
    if (postText) {
      const tagMatches = postText.match(/#[A-Za-z0-9_]+/g);
      if (tagMatches) {
        tagMatches.forEach((tag) => hashtags.add(tag));
      }
    }

    return {
      hashtags: Array.from(hashtags),
      mentions: Array.from(mentions),
    };
  }

  function detectPostType(postEl, mediaUrls) {
    if (postEl.querySelector('.update-components-poll, .feed-shared-poll')) {
      return 'poll';
    }
    if (postEl.querySelector('.update-components-document, .feed-shared-document')) {
      return 'document';
    }
    if (postEl.querySelector('video, .update-components-linkedin-video, .feed-shared-video')) {
      return 'video';
    }
    if (postEl.querySelector('.update-components-article, .feed-shared-article')) {
      return 'article';
    }
    if (
      postEl.querySelector('.update-components-mini-update-v2, .feed-shared-mini-update-v2')
    ) {
      return 'repost';
    }
    if (
      mediaUrls.length > 0 ||
      postEl.querySelector('.update-components-image, .feed-shared-image, .feed-shared-carousel')
    ) {
      return 'image';
    }
    return 'text';
  }

  async function extractPostData(postEl) {
    await expandSeeMore(postEl);

    const urn = extractUrn(postEl);
    const postUrl = extractPostUrl(postEl, urn);
    const { authorName, authorProfileUrl } = extractAuthor(postEl);
    const publishedAtText = extractPublishedAt(postEl);
    const postText = extractPostText(postEl);
    const { likesCount, commentsCount, repostsCount } = extractSocialCounts(postEl);
    const mediaUrls = extractMediaUrls(postEl);
    const { hashtags, mentions } = extractHashtagsAndMentions(postEl, postText);
    const postType = detectPostType(postEl, mediaUrls);

    return {
      author_name: authorName,
      author_profile_url: authorProfileUrl,
      post_text: postText,
      post_url: postUrl,
      published_at_text: publishedAtText,
      likes_count: likesCount,
      comments_count: commentsCount,
      reposts_count: repostsCount,
      media_urls: mediaUrls,
      hashtags,
      mentions,
      post_type: postType,
      extracted_at: new Date().toISOString(),
    };
  }

  window.LPCExtractor = {
    extractPostData,
  };
})();
