(() => {
  const DEBOUNCE_MS = 150;
  const POST_SELECTOR = [
    'div[data-urn^="urn:li:activity:"]',
    'div[data-urn^="urn:li:ugcPost:"]',
    'div[data-id^="urn:li:activity:"]',
    '.feed-shared-update-v2',
    '[data-view-name="feed-full-update"]',
    '[role="article"]',
  ].join(', ');

  const LIKE_ICON_SELECTOR =
    'svg[id^="thumbs-up-"], svg[data-test-icon*="thumbs-up"], button[aria-label*="Like" i], button[aria-label*="React" i], button.react-button__trigger';

  let debounceTimer = null;

  function setButtonState(button, state, label) {
    button.className = 'lpc-extract-btn';
    if (state !== 'default') {
      button.classList.add(`lpc-extract-btn--${state}`);
    }
    button.textContent = label;
  }

  function findActionBarFromTrigger(triggerEl, boundaryEl) {
    let current = triggerEl.parentElement;
    for (let depth = 0; depth < 6 && current && current !== boundaryEl; depth += 1) {
      const interactiveCount = current.querySelectorAll(
        'button, [role="button"], svg[id*="comment"], svg[id*="repost"]',
      ).length;
      if (interactiveCount >= 3) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }

  function findActionBar(postEl) {
    const selectors = [
      '.feed-shared-social-action-bar',
      '.feed-shared-social-action-bar--full-width',
      '.social-details-social-activity .feed-shared-social-actions',
      '[data-test-id="social-actions"]',
      '[data-view-name="feed-social-action-bar"]',
    ];
    for (const selector of selectors) {
      const bar = postEl.querySelector(selector);
      if (bar) return bar;
    }

    const likeTrigger = postEl.querySelector(LIKE_ICON_SELECTOR);
    if (
      likeTrigger &&
      !likeTrigger.closest('.comments-comments-list, .comments-comment-item')
    ) {
      const group = likeTrigger.closest('[role="group"], .feed-shared-social-action-bar');
      if (group && postEl.contains(group)) return group;
      return findActionBarFromTrigger(likeTrigger, postEl);
    }

    return null;
  }

  function findPostRootFromActionBar(actionBar) {
    const knownRoot = actionBar.closest(POST_SELECTOR);
    if (knownRoot) return knownRoot;

    // Fallback for obfuscated SDUI cards: walk up to the container that holds
    // an author profile/company link and sits below <main>.
    const mainEl = document.querySelector('main, [role="main"]') || document.body;
    let current = actionBar.parentElement;
    let candidate = null;
    while (current && current !== mainEl && current !== document.body) {
      if (current.querySelector('a[href*="/in/"], a[href*="/company/"]')) {
        candidate = current;
        // Stop once the parent contains multiple distinct action bars (i.e. the feed list)
        if (
          current.parentElement &&
          current.parentElement.querySelectorAll('svg[id^="thumbs-up-"]').length > 1
        ) {
          return current;
        }
      }
      current = current.parentElement;
    }
    return candidate;
  }

  function createExtractButton(postEl) {
    const wrapper = document.createElement('div');
    wrapper.className = 'lpc-extract-btn-wrap';

    const button = document.createElement('button');
    button.type = 'button';
    setButtonState(button, 'default', 'Extract Post');

    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (button.disabled) return;
      button.disabled = true;
      setButtonState(button, 'loading', 'Extracting...');

      try {
        const payload = await window.LPCExtractor.extractPostData(postEl);

        chrome.runtime.sendMessage(
          { type: 'SAVE_POST', payload },
          (response) => {
            if (chrome.runtime.lastError) {
              setButtonState(button, 'error', 'Retry');
              button.disabled = false;
              return;
            }

            if (!response) {
              setButtonState(button, 'error', 'Retry');
              button.disabled = false;
              return;
            }

            if (response.status === 'saved') {
              setButtonState(button, 'saved', 'Saved ✓');
              button.disabled = true;
            } else if (response.status === 'duplicate') {
              setButtonState(button, 'duplicate', 'Already Saved');
              button.disabled = true;
            } else if (response.status === 'unauthorized') {
              setButtonState(button, 'auth', 'Login in Panel');
              button.disabled = false;
            } else {
              setButtonState(button, 'error', 'Retry');
              button.disabled = false;
            }
          },
        );
      } catch (err) {
        console.error('[LPC] Extraction error:', err);
        setButtonState(button, 'error', 'Retry');
        button.disabled = false;
      }
    });

    wrapper.appendChild(button);
    return wrapper;
  }

  function injectIntoPost(postEl, actionBar) {
    if (
      !postEl ||
      !actionBar ||
      postEl.getAttribute('data-lpc-injected') === 'true' ||
      postEl.closest('[data-lpc-injected="true"]') ||
      actionBar.querySelector('.lpc-extract-btn-wrap')
    ) {
      return;
    }

    postEl.setAttribute('data-lpc-injected', 'true');
    const btnWrap = createExtractButton(postEl);
    actionBar.appendChild(btnWrap);
  }

  function injectButtons() {
    // 1. Standard / semi-structured post containers
    document.querySelectorAll(POST_SELECTOR).forEach((postEl) => {
      const actionBar = findActionBar(postEl);
      if (actionBar) {
        injectIntoPost(postEl, actionBar);
      }
    });

    // 2. Fallback for obfuscated SDUI feed cards without data-urn / class markers
    document.querySelectorAll(LIKE_ICON_SELECTOR).forEach((trigger) => {
      if (trigger.closest('.comments-comments-list, .comments-comment-item')) {
        return;
      }
      const actionBar =
        trigger.closest('[role="group"], .feed-shared-social-action-bar') ||
        findActionBarFromTrigger(trigger, document.body);
      if (!actionBar || actionBar.querySelector('.lpc-extract-btn-wrap')) {
        return;
      }
      const postEl = findPostRootFromActionBar(actionBar);
      if (postEl) {
        injectIntoPost(postEl, actionBar);
      }
    });
  }

  function scheduleInjection() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(injectButtons, DEBOUNCE_MS);
  }

  const observer = new MutationObserver(() => {
    scheduleInjection();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  injectButtons();
})();
