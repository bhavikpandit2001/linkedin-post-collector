const state = {
  allPosts: [],
  filteredPosts: [],
  selectedPostId: null,
};

const els = {
  postCountBadge: document.getElementById('postCountBadge'),
  exportCsvBtn: document.getElementById('exportCsvBtn'),
  clearAllBtn: document.getElementById('clearAllBtn'),

  searchInput: document.getElementById('searchInput'),
  typeFilter: document.getElementById('typeFilter'),
  refreshBtn: document.getElementById('refreshBtn'),
  statusBanner: document.getElementById('statusBanner'),
  postsTableBody: document.getElementById('postsTableBody'),
  emptyState: document.getElementById('emptyState'),

  drawerBackdrop: document.getElementById('drawerBackdrop'),
  detailDrawer: document.getElementById('detailDrawer'),
  closeDrawerBtn: document.getElementById('closeDrawerBtn'),
  drawerMeta: document.getElementById('drawerMeta'),
  drawerMetrics: document.getElementById('drawerMetrics'),
  drawerAuthorInput: document.getElementById('drawerAuthorInput'),
  drawerTextInput: document.getElementById('drawerTextInput'),
  drawerNotesInput: document.getElementById('drawerNotesInput'),
  drawerHashtags: document.getElementById('drawerHashtags'),
  drawerMentions: document.getElementById('drawerMentions'),
  drawerMedia: document.getElementById('drawerMedia'),
  drawerOpenLink: document.getElementById('drawerOpenLink'),
  drawerDeleteBtn: document.getElementById('drawerDeleteBtn'),
  drawerSaveBtn: document.getElementById('drawerSaveBtn'),
};

let searchTimer = null;

async function init() {
  bindEvents();
  await loadPosts();
}

function bindEvents() {
  els.exportCsvBtn.addEventListener('click', exportCsv);
  els.clearAllBtn.addEventListener('click', clearAllPosts);
  els.refreshBtn.addEventListener('click', loadPosts);

  els.searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFiltersAndRender, 150);
  });

  els.typeFilter.addEventListener('change', applyFiltersAndRender);

  els.closeDrawerBtn.addEventListener('click', closeDrawer);
  els.drawerBackdrop.addEventListener('click', closeDrawer);
  els.drawerSaveBtn.addEventListener('click', saveDrawerChanges);
  els.drawerDeleteBtn.addEventListener('click', () => {
    if (state.selectedPostId !== null) {
      deletePost(state.selectedPostId);
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'POST_ADDED' && message.post) {
      const exists = state.allPosts.some((p) => p.id === message.post.id);
      if (!exists) {
        state.allPosts.unshift(message.post);
        applyFiltersAndRender();
        showStatus('New post extracted ✓');
      }
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.savedPosts) {
      state.allPosts = Array.isArray(changes.savedPosts.newValue)
        ? changes.savedPosts.newValue
        : [];
      applyFiltersAndRender();
    }
  });
}

function showStatus(text) {
  els.statusBanner.textContent = text;
  els.statusBanner.classList.remove('hidden');
  setTimeout(() => {
    els.statusBanner.classList.add('hidden');
  }, 3000);
}

async function loadPosts() {
  const { savedPosts = [] } = await chrome.storage.local.get(['savedPosts']);
  state.allPosts = Array.isArray(savedPosts) ? savedPosts : [];
  applyFiltersAndRender();
}

function applyFiltersAndRender() {
  const query = els.searchInput.value.trim().toLowerCase();
  const type = els.typeFilter.value;

  state.filteredPosts = state.allPosts.filter((post) => {
    if (type && type !== 'all' && (post.postType || 'text') !== type) {
      return false;
    }

    if (!query) return true;

    const haystack = [
      post.authorName || '',
      post.postText || '',
      post.notes || '',
      ...(Array.isArray(post.hashtags) ? post.hashtags : []),
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(query);
  });

  renderPostsTable();
}

function renderPostsTable() {
  els.postCountBadge.textContent = String(state.filteredPosts.length);
  els.postsTableBody.innerHTML = '';

  if (state.filteredPosts.length === 0) {
    els.emptyState.classList.remove('hidden');
    return;
  }

  els.emptyState.classList.add('hidden');

  for (const post of state.filteredPosts) {
    const tr = document.createElement('tr');
    tr.addEventListener('click', () => openDrawer(post.id));

    const tdAuthor = document.createElement('td');
    const authorDiv = document.createElement('div');
    authorDiv.className = 'cell-author';
    authorDiv.textContent = post.authorName || 'Unknown';
    const timeDiv = document.createElement('div');
    timeDiv.className = 'cell-time';
    timeDiv.textContent = post.publishedAtText || formatShortDate(post.extractedAt);
    tdAuthor.appendChild(authorDiv);
    tdAuthor.appendChild(timeDiv);

    const tdPreview = document.createElement('td');
    const previewDiv = document.createElement('div');
    previewDiv.className = 'cell-preview';
    previewDiv.textContent = post.postText || '(No text content)';
    tdPreview.appendChild(previewDiv);

    const tdType = document.createElement('td');
    const pill = document.createElement('span');
    pill.className = 'type-pill';
    pill.textContent = post.postType || 'text';
    tdType.appendChild(pill);

    const tdActions = document.createElement('td');
    const actionsWrap = document.createElement('div');
    actionsWrap.className = 'row-actions';

    const openLink = document.createElement('a');
    openLink.className = 'icon-btn';
    openLink.href = post.postUrl;
    openLink.target = '_blank';
    openLink.rel = 'noopener noreferrer';
    openLink.title = 'Open on LinkedIn';
    openLink.textContent = '↗';
    openLink.addEventListener('click', (e) => e.stopPropagation());

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'icon-btn icon-btn--danger';
    deleteBtn.title = 'Delete post';
    deleteBtn.textContent = '✕';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deletePost(post.id);
    });

    actionsWrap.appendChild(openLink);
    actionsWrap.appendChild(deleteBtn);
    tdActions.appendChild(actionsWrap);

    tr.appendChild(tdAuthor);
    tr.appendChild(tdPreview);
    tr.appendChild(tdType);
    tr.appendChild(tdActions);

    els.postsTableBody.appendChild(tr);
  }
}

function openDrawer(postId) {
  const post = state.allPosts.find((p) => p.id === postId);
  if (!post) return;

  state.selectedPostId = post.id;
  els.drawerMeta.textContent = `${post.postType || 'text'} • ${post.publishedAtText || formatShortDate(post.extractedAt)}`;
  els.drawerAuthorInput.value = post.authorName || '';
  els.drawerTextInput.value = post.postText || '';
  els.drawerNotesInput.value = post.notes || '';
  els.drawerOpenLink.href = post.postUrl;

  els.drawerMetrics.innerHTML = '';
  [
    `Likes: ${post.likesCount ?? 0}`,
    `Comments: ${post.commentsCount ?? 0}`,
    `Reposts: ${post.repostsCount ?? 0}`,
  ].forEach((label) => {
    const chip = document.createElement('span');
    chip.className = 'metric-chip';
    chip.textContent = label;
    els.drawerMetrics.appendChild(chip);
  });

  renderTagList(els.drawerHashtags, post.hashtags || [], 'Hashtags');
  renderTagList(els.drawerMentions, post.mentions || [], 'Mentions');

  els.drawerMedia.innerHTML = '';
  if (Array.isArray(post.mediaUrls) && post.mediaUrls.length > 0) {
    post.mediaUrls.forEach((url, index) => {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = `Media #${index + 1}: ${url}`;
      els.drawerMedia.appendChild(a);
    });
  }

  els.drawerBackdrop.classList.remove('hidden');
  els.detailDrawer.classList.remove('hidden');
  els.detailDrawer.setAttribute('aria-hidden', 'false');
}

function renderTagList(container, items, prefix) {
  container.innerHTML = '';
  if (!Array.isArray(items) || items.length === 0) return;

  items.forEach((item) => {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.textContent = prefix === 'Mentions' ? `@${item}` : item;
    container.appendChild(chip);
  });
}

function closeDrawer() {
  state.selectedPostId = null;
  els.drawerBackdrop.classList.add('hidden');
  els.detailDrawer.classList.add('hidden');
  els.detailDrawer.setAttribute('aria-hidden', 'true');
}

async function saveDrawerChanges() {
  if (state.selectedPostId === null) return;

  const idx = state.allPosts.findIndex((p) => p.id === state.selectedPostId);
  if (idx === -1) return;

  state.allPosts[idx] = {
    ...state.allPosts[idx],
    authorName: els.drawerAuthorInput.value.trim(),
    postText: els.drawerTextInput.value,
    notes: els.drawerNotesInput.value,
  };

  await chrome.storage.local.set({ savedPosts: state.allPosts });
  applyFiltersAndRender();
  closeDrawer();
  showStatus('Changes saved ✓');
}

async function deletePost(postId) {
  const confirmed = window.confirm('Delete this saved post?');
  if (!confirmed) return;

  state.allPosts = state.allPosts.filter((p) => p.id !== postId);
  await chrome.storage.local.set({ savedPosts: state.allPosts });

  if (state.selectedPostId === postId) {
    closeDrawer();
  }
  applyFiltersAndRender();
  showStatus('Post deleted');
}

async function clearAllPosts() {
  if (state.allPosts.length === 0) {
    showStatus('No posts to clear');
    return;
  }

  const confirmed = window.confirm(
    `Clear all ${state.allPosts.length} saved posts from local storage?`,
  );
  if (!confirmed) return;

  state.allPosts = [];
  await chrome.storage.local.set({ savedPosts: [] });
  closeDrawer();
  applyFiltersAndRender();
  showStatus('All posts cleared');
}

function escapeCsvCell(value) {
  const str = value === null || value === undefined ? '' : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

function exportCsv() {
  const rowsToExport = state.filteredPosts;
  if (rowsToExport.length === 0) {
    showStatus('No posts to export');
    return;
  }

  const headers = [
    'id',
    'author_name',
    'author_profile_url',
    'post_type',
    'published_at_text',
    'likes_count',
    'comments_count',
    'reposts_count',
    'post_text',
    'notes',
    'hashtags',
    'mentions',
    'media_urls',
    'post_url',
    'extracted_at',
  ];

  const rows = rowsToExport.map((post) =>
    [
      post.id,
      post.authorName || '',
      post.authorProfileUrl || '',
      post.postType || '',
      post.publishedAtText || '',
      post.likesCount ?? 0,
      post.commentsCount ?? 0,
      post.repostsCount ?? 0,
      post.postText || '',
      post.notes || '',
      (post.hashtags || []).join('; '),
      (post.mentions || []).join('; '),
      (post.mediaUrls || []).join('; '),
      post.postUrl || '',
      post.extractedAt || '',
    ]
      .map(escapeCsvCell)
      .join(','),
  );

  const csvContent = `\uFEFF${headers.join(',')}\r\n${rows.join('\r\n')}`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  const dateStamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `linkedin-posts-${dateStamp}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatShortDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return '';
  }
}

init();
