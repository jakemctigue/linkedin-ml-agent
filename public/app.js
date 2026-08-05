/* --------------------------------------------------------------------------
   LINKEDIN ML AGENT - INTERACTIVE FRONTEND APPLICATION
   -------------------------------------------------------------------------- */

// Global Fail-Safe Publisher Modal Methods (Available Immediately)
window.closePublishModal = function() {
  const m = document.getElementById('modal-publish');
  if (m) m.classList.add('hidden');
};

window.switchPubTab = function(targetId, btnEl) {
  document.querySelectorAll('.pub-tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.pub-panel').forEach(p => p.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  const targetPanel = document.getElementById(targetId);
  if (targetPanel) targetPanel.classList.add('active');
};

window.selectAllPlatforms = function(shouldSelect) {
  document.querySelectorAll('input[name="platform"]').forEach(chk => {
    chk.checked = shouldSelect;
    const parent = chk.closest('.platform-chip-toggle');
    if (parent) {
      if (shouldSelect) parent.classList.add('active');
      else parent.classList.remove('active');
    }
  });
};

window.togglePlatformChip = function(el) {
  const label = el.closest('.platform-chip-toggle');
  const chk = label ? label.querySelector('input[type="checkbox"]') : null;
  if (chk) {
    if (el !== chk) {
      chk.checked = !chk.checked;
    }
    if (chk.checked) label.classList.add('active');
    else label.classList.remove('active');
  }
};

window.publishSinglePlatform = async function(platformName, btnEl) {
  if (window._executePublish) {
    await window._executePublish([platformName], btnEl);
  } else {
    window.closePublishModal();
    if (window._showToast) window._showToast(`🚀 Dispatched to ${platformName}!`);
  }
};

window.executeGlobalPublish = async function(btnEl) {
  const selectedPlatforms = Array.from(document.querySelectorAll('input[name="platform"]:checked')).map(el => el.value);
  if (window._executePublish) {
    await window._executePublish(selectedPlatforms, btnEl);
  } else {
    window.closePublishModal();
    if (window._showToast) window._showToast(`🚀 Launched live app publishers!`);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  let appState = {
    analysisData: null,
    influencersData: null,
    activeDomainFilter: 'all',
    searchQuery: ''
  };
  window._appState = appState;

  // DOM Elements
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  const statInfluencers = document.getElementById('stat-influencers');
  const statPosts = document.getElementById('stat-posts');
  const statClusters = document.getElementById('stat-clusters');
  const statSilhouette = document.getElementById('stat-silhouette');
  
  const goalsContainer = document.getElementById('goals-container');
  const matrixContainer = document.getElementById('matrix-container');
  const influencersContainer = document.getElementById('influencers-container');
  
  const btnTriggerScrape = document.getElementById('btn-trigger-scrape');
  const btnAddInfluencerModal = document.getElementById('btn-add-influencer-modal');
  const modalAddInfluencer = document.getElementById('modal-add-influencer');
  const modalClose = document.getElementById('modal-close');
  const btnModalCancel = document.getElementById('btn-modal-cancel');
  const formAddInfluencer = document.getElementById('form-add-influencer');
  const toast = document.getElementById('toast');
  const feedSearch = document.getElementById('feed-search');

  const canvas = document.getElementById('pca-canvas');
  const ctx = canvas ? canvas.getContext('2d') : null;
  const canvasTooltip = document.getElementById('canvas-tooltip');

  // --- INITIALIZATION ---
  initApp();

  async function initApp() {
    setupTabSwitching();
    setupEventListeners();
    await loadDashboardData();
  }

  // --- DATA FETCHING ---
  async function loadDashboardData() {
    try {
      const [analysisRes, influencersRes] = await Promise.all([
        fetch('/api/analysis'),
        fetch('/api/influencers')
      ]);

      if (!analysisRes.ok || !influencersRes.ok) {
        throw new Error('Failed to load API data');
      }

      appState.analysisData = await analysisRes.json();
      appState.influencersData = await influencersRes.json();

      renderDashboard();
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      showToast('Error loading data from server');
    }
  }

  // --- RENDER ALL COMPONENTS ---
  function renderDashboard() {
    const { metadata, synthesized_realizations, surprise_matrix, pca_nodes } = appState.analysisData;
    const { influencers } = appState.influencersData;

    // 1. Render Header Stats
    statInfluencers.textContent = metadata.total_influencers || influencers.length;
    statPosts.textContent = metadata.total_posts || pca_nodes.length;
    statClusters.textContent = `k=${metadata.optimal_k}`;
    statSilhouette.textContent = `Silhouette: ${metadata.silhouette_score}`;

    // 2. Render Goals Tab
    renderGoals(synthesized_realizations);

    // 3. Render 2D Canvas Map
    renderPCACanvas(pca_nodes);

    // 4. Render Surprise Matrix
    renderSurpriseMatrix(surprise_matrix);

    // 5. Render Influencers Feed
    renderInfluencersFeed(influencers);
  }

  // Top-Level Window Helper Methods for Instant Fail-Safe Execution
  window.setRealizationDomainFilter = function(domainTag, btnEl) {
    if (window._appState) {
      window._appState.activeDomainFilter = domainTag;
    }
    document.querySelectorAll('.filter-group .chip').forEach(c => c.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    if (window._renderGoals && window._appState && window._appState.analysisData) {
      window._renderGoals(window._appState.analysisData.synthesized_realizations);
    }
  };

  window.filterRealizationsList = function() {
    if (window._renderGoals && window._appState && window._appState.analysisData) {
      window._renderGoals(window._appState.analysisData.synthesized_realizations);
    }
  };

  // --- 1. REALIZATIONS & GOALS RENDERER ---
  function renderGoals(goals) {
    const goalsContainer = document.getElementById('goals-container');
    if (!goalsContainer) return;

    if (!goals || goals.length === 0) {
      // Keep existing pre-rendered HTML if goals array is temporarily empty
      return;
    }

    const searchInput = document.getElementById('search-realizations-input');
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

    const activeFilter = (window._appState && window._appState.activeDomainFilter) ? window._appState.activeDomainFilter : 'all';

    const filtered = goals.filter(g => {
      const matchDomain = (activeFilter === 'all') || (g.domains && g.domains.includes(activeFilter));
      if (!matchDomain) return false;

      if (!query) return true;
      const textToSearch = `${g.title} ${g.summary} ${g.realization} ${(g.domains||[]).join(' ')} ${(g.keywords_banner||[]).join(' ')}`.toLowerCase();
      return textToSearch.includes(query);
    });

    const badgeEl = document.getElementById('realizations-count-badge');
    const totalScraped = (window._appState && window._appState.analysisData && window._appState.analysisData.metadata) ? window._appState.analysisData.metadata.total_posts : 371;
    if (badgeEl) {
      badgeEl.textContent = `Showing ${filtered.length} of ${goals.length} Dynamic Realizations (from ${totalScraped} Scraped Signals)`;
    }

    if (filtered.length === 0) {
      goalsContainer.innerHTML = `<div class="goal-card"><p class="goal-summary">No realization goals found matching search filter '${query || activeFilter}'.</p></div>`;
      return;
    }

    goalsContainer.innerHTML = '';
    const isUnfiltered = (activeFilter === 'all') && !query;
    filtered.forEach((goal, idx) => {
      const card = document.createElement('div');
      card.className = 'goal-card';
      const isTodaysDraft = isUnfiltered && idx === 0;
      if (isTodaysDraft) card.classList.add('goal-card-todays-draft');

      const domainTagsHtml = (goal.domains || []).map(d => `<span class="tag tag-${d}">${d}</span>`).join('');
      const keywordsBannerHtml = (goal.keywords_banner || []).map(k => `<span class="keyword-pill">📌 ${k}</span>`).join('');
      const actionsListHtml = (goal.strategic_goals || []).map(a => `<li>${a}</li>`).join('');
      const evidenceHtml = (goal.evidence_posts || []).map(e => `
        <div class="evidence-card">
          <div class="evidence-author">
            <span>${e.author}</span>
            <span class="tag tag-${e.domain}">${e.domain}</span>
          </div>
          <p class="evidence-snippet">"${e.snippet}"</p>
        </div>
      `).join('');

      card.innerHTML = `
        ${isTodaysDraft ? `<div class="todays-draft-badge">📅 Today's Draft — ready to post</div>` : ''}
        ${goal.infographic_url ? `
          <div class="infographic-banner-wrapper">
            <img src="${goal.infographic_url}" alt="${goal.title} Infographic" class="infographic-img" onerror="this.src='/assets/infographic_sovereign_ai.jpg'">
            <div class="infographic-overlay">
              <span class="infographic-badge">Data Artwork Asset #${idx+1}</span>
            </div>
          </div>
        ` : ''}

        <div class="keywords-banner-bar">
          ${keywordsBannerHtml}
        </div>

        <div class="goal-header" style="margin-top:0.75rem;">
          <div>
            <h3 class="goal-title">${goal.title}</h3>
            <div class="domain-tags" style="margin-top:0.4rem;">${domainTagsHtml}</div>
          </div>
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.4rem;">
            <span class="surprise-badge">Surprise Index: ${(goal.surprise_index * 100).toFixed(0)}%</span>
            <button type="button" class="btn btn-primary btn-publish-goal" data-goalid="${goal.id}" style="padding:0.35rem 0.75rem; font-size:0.78rem;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              Publish to Multi-Platform
            </button>
          </div>
        </div>
        <p class="goal-summary">${goal.summary}</p>
        <div class="realization-box">
          <strong>Surprising Realization:</strong>
          ${goal.realization}
        </div>
        <h4 class="strategic-actions-header">Actionable Strategic Goals:</h4>
        <ul class="strategic-actions-list">
          ${actionsListHtml}
        </ul>
        <h4 class="strategic-actions-header" style="margin-top:1rem;">Cross-Domain Evidence:</h4>
        <div class="evidence-section">
          ${evidenceHtml}
        </div>
      `;

      // Attach publish button event
      const pubBtn = card.querySelector('.btn-publish-goal');
      if (pubBtn) {
        pubBtn.addEventListener('click', () => openPublishModal(goal));
      }

      goalsContainer.appendChild(card);
    });
  }

  window._renderGoals = renderGoals;

  // --- 2. 2D PCA TOPOLOGY CANVAS MAP ---
  function renderPCACanvas(nodes) {
    if (!ctx || !canvas) return;

    // Resize canvas for sharp rendering
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const width = canvas.width;
    const height = canvas.height;
    const padding = 60;

    // Find min/max PCA coords
    const xs = nodes.map(n => n.pca_x);
    const ys = nodes.map(n => n.pca_y);
    const minX = Math.min(...xs, -0.2);
    const maxX = Math.max(...xs, 0.2);
    const minY = Math.min(...ys, -0.2);
    const maxY = Math.max(...ys, 0.2);

    function mapX(x) {
      return padding + ((x - minX) / (maxX - minX || 1)) * (width - 2 * padding);
    }
    function mapY(y) {
      return height - padding - ((y - minY) / (maxY - minY || 1)) * (height - 2 * padding);
    }

    // Color map for domains
    const domainColors = {
      Finance: '#10b981',
      Tech: '#06b6d4',
      Politics: '#f59e0b',
      Geopolitics: '#ef4444'
    };

    // Draw Background Grid
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = padding; x < width - padding; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, padding); ctx.lineTo(x, height - padding); ctx.stroke();
    }
    for (let y = padding; y < height - padding; y += 40) {
      ctx.beginPath(); ctx.moveTo(padding, y); ctx.lineTo(width - padding, y); ctx.stroke();
    }

    // Draw Connecting Lines for high similarity / cluster members
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (nodes[i].cluster === nodes[j].cluster && nodes[i].domain !== nodes[j].domain) {
          ctx.beginPath();
          ctx.moveTo(mapX(nodes[i].pca_x), mapY(nodes[i].pca_y));
          ctx.lineTo(mapX(nodes[j].pca_x), mapY(nodes[j].pca_y));
          ctx.stroke();
        }
      }
    }

    // Draw Nodes
    const renderedNodes = [];
    nodes.forEach(node => {
      const cx = mapX(node.pca_x);
      const cy = mapY(node.pca_y);
      const radius = 10;
      const color = domainColors[node.domain] || '#3b82f6';

      // Glow
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label author name
      ctx.fillStyle = 'rgba(248, 250, 252, 0.8)';
      ctx.font = '11px Inter, sans-serif';
      ctx.fillText(node.author, cx + 14, cy + 4);

      renderedNodes.push({ ...node, cx, cy, radius });
    });

    // Canvas Hover Interaction
    canvas.onmousemove = (e) => {
      const canvasRect = canvas.getBoundingClientRect();
      const mx = e.clientX - canvasRect.left;
      const my = e.clientY - canvasRect.top;

      let hovered = null;
      for (const node of renderedNodes) {
        const dist = Math.hypot(mx - node.cx, my - node.cy);
        if (dist <= node.radius + 4) {
          hovered = node;
          break;
        }
      }

      if (hovered && canvasTooltip) {
        canvasTooltip.style.left = `${hovered.cx + 15}px`;
        canvasTooltip.style.top = `${hovered.cy - 15}px`;
        canvasTooltip.innerHTML = `
          <strong>${hovered.author}</strong> (${hovered.domain})<br>
          <span style="color: #94a3b8; font-size: 0.75rem;">Cluster ${hovered.cluster}</span><br>
          <p style="margin-top:0.3rem; font-style:italic;">"${hovered.text.substring(0, 110)}..."</p>
        `;
        canvasTooltip.classList.remove('hidden');
      } else if (canvasTooltip) {
        canvasTooltip.classList.add('hidden');
      }
    };
  }

  // --- 3. SURPRISE MATRIX RENDERER ---
  function renderSurpriseMatrix(matrix) {
    if (!matrixContainer) return;
    matrixContainer.innerHTML = '';

    matrix.forEach(item => {
      const card = document.createElement('div');
      card.className = 'matrix-card';

      card.innerHTML = `
        <div class="matrix-card-header">
          <span class="domain-pair-badge">${item.domain_pair}</span>
          <span class="sim-score">Surprise Score: ${(item.surprise_score * 100).toFixed(0)}%</span>
        </div>
        <div class="matrix-posts-compare">
          <div class="matrix-post-box">
            <div class="matrix-post-author">${item.post1.author_name} (${item.post1.domain})</div>
            <p style="color:var(--text-secondary); font-size:0.8rem;">"${item.post1.text}"</p>
          </div>
          <div class="matrix-post-box">
            <div class="matrix-post-author">${item.post2.author_name} (${item.post2.domain})</div>
            <p style="color:var(--text-secondary); font-size:0.8rem;">"${item.post2.text}"</p>
          </div>
        </div>
      `;

      matrixContainer.appendChild(card);
    });
  }

  // --- 4. INFLUENCERS FEED RENDERER ---
  function renderInfluencersFeed(influencers) {
    if (!influencersContainer) return;
    influencersContainer.innerHTML = '';

    const query = appState.searchQuery.toLowerCase();

    influencers.forEach(inf => {
      const postsMatch = inf.posts.filter(p => 
        !query || 
        inf.name.toLowerCase().includes(query) || 
        inf.domain.toLowerCase().includes(query) || 
        p.text.toLowerCase().includes(query)
      );

      if (query && postsMatch.length === 0) return;

      const latestPost = postsMatch[0] || inf.posts[0];

      const card = document.createElement('div');
      card.className = 'influencer-card';

      card.innerHTML = `
        <div class="influencer-head">
          <img src="${inf.avatar}" alt="${inf.name}" class="influencer-avatar">
          <div class="influencer-info">
            <h4>${inf.name}</h4>
            <p>${inf.title}</p>
            <span class="tag tag-${inf.domain}" style="margin-top:0.3rem; display:inline-block;">${inf.domain}</span>
          </div>
        </div>
        ${latestPost ? `
          <div class="post-preview">
            <p>"${latestPost.text}"</p>
            <div class="post-stats">
              <span>❤️ ${latestPost.likes}</span>
              <span>🔄 ${latestPost.reposts}</span>
              <span>📅 ${latestPost.date}</span>
            </div>
          </div>
        ` : '<p class="post-preview">No posts found.</p>'}
      `;

      influencersContainer.appendChild(card);
    });
  }

  // --- EVENT LISTENERS ---
  function setupTabSwitching() {
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        const tabId = btn.getAttribute('data-tab');
        const targetTab = document.getElementById(tabId);
        if (targetTab) {
          targetTab.classList.add('active');
          if (tabId === 'tab-cluster-map' && appState.analysisData) {
            setTimeout(() => renderPCACanvas(appState.analysisData.pca_nodes), 50);
          }
        }
      });
    });
  }

  function setupEventListeners() {
    // Filter chips for Goals Tab
    document.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        appState.activeDomainFilter = chip.getAttribute('data-filter');
        if (appState.analysisData) {
          renderGoals(appState.analysisData.synthesized_realizations);
        }
      });
    });

    // Search input
    if (feedSearch) {
      feedSearch.addEventListener('input', (e) => {
        appState.searchQuery = e.target.value;
        if (appState.influencersData) {
          renderInfluencersFeed(appState.influencersData.influencers);
        }
      });
    }

    // Run Scraper Button
    if (btnTriggerScrape) {
      btnTriggerScrape.addEventListener('click', async () => {
        btnTriggerScrape.disabled = true;
        btnTriggerScrape.innerHTML = `<span>Running Scraper & ML...</span>`;
        try {
          const res = await fetch('/api/scrape', { method: 'POST' });
          const data = await res.json();
          if (data.analysis) {
            appState.analysisData = data.analysis;
            await loadDashboardData();
            showToast('LinkedIn Influencers Scraped & Re-Clustered!');
          }
        } catch (err) {
          showToast('Failed to trigger scraper');
        } finally {
          btnTriggerScrape.disabled = false;
          btnTriggerScrape.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
            Run Scraper & ML Re-Cluster
          `;
        }
      });
    }

    // Modal Add Influencer
    if (btnAddInfluencerModal) {
      btnAddInfluencerModal.addEventListener('click', () => modalAddInfluencer.classList.remove('hidden'));
    }
    if (modalClose) {
      modalClose.addEventListener('click', () => modalAddInfluencer.classList.add('hidden'));
    }
    if (btnModalCancel) {
      btnModalCancel.addEventListener('click', () => modalAddInfluencer.classList.add('hidden'));
    }

    if (formAddInfluencer) {
      formAddInfluencer.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
          name: document.getElementById('inf-name').value,
          title: document.getElementById('inf-title').value,
          domain: document.getElementById('inf-domain').value,
          postText: document.getElementById('inf-post').value
        };

        try {
          const res = await fetch('/api/add-influencer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (res.ok) {
            modalAddInfluencer.classList.add('hidden');
            formAddInfluencer.reset();
            await loadDashboardData();
            showToast(`Added post for ${payload.name} and re-clustered!`);
          }
        } catch (err) {
          showToast('Failed to save post');
        }
      });
    }

    // Auth Handlers (Google & mctigue.co SSO)
    const btnGoogleLoginDemo = document.getElementById('btn-google-login-demo');
    const btnMctigueLoginDemo = document.getElementById('btn-mctigue-login-demo');
    const userProfileBadge = document.getElementById('user-profile-badge');
    const userAvatar = document.getElementById('user-avatar');
    const userName = document.getElementById('user-name');
    const authStatusTag = document.getElementById('auth-status-tag');
    const btnLogout = document.getElementById('btn-logout');

    if (btnGoogleLoginDemo) {
      btnGoogleLoginDemo.addEventListener('click', async () => {
        try {
          const res = await fetch('/api/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              testUser: {
                name: 'Jake (Google Auth User)',
                email: 'jake@google.com',
                picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
              }
            })
          });
          const data = await res.json();
          if (data.user) {
            appState.currentUser = data.user;
            updateAuthUI(data.user);
            showToast(`Signed in via Google as ${data.user.name}`);
          }
        } catch (err) {
          showToast('Google Sign-In Error');
        }
      });
    }

    if (btnMctigueLoginDemo) {
      btnMctigueLoginDemo.addEventListener('click', async () => {
        try {
          const res = await fetch('/api/auth/mctigue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mctigueUser: {
                name: 'McTigue Executive Strategist',
                email: 'partner@mctigue.co',
                title: 'Managing Director',
                picture: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
              }
            })
          });
          const data = await res.json();
          if (data.user) {
            appState.currentUser = data.user;
            updateAuthUI(data.user);
            showToast(`Authenticated with mctigue.co Corporate SSO!`);
          }
        } catch (err) {
          showToast('mctigue.co Auth Error');
        }
      });
    }

    // AI Analysis Chatboard Listener
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatMessages = document.getElementById('chat-messages');

    async function handleChatMessage(msgText) {
      if (!msgText || !msgText.trim()) return;

      // Append User Message
      appendMessage('user', msgText);
      if (chatInput) chatInput.value = '';

      // Append Loading Bot Indicator
      const loadingId = 'bot-loading-' + Date.now();
      appendMessage('bot', '<em>Analyzing cross-landscape vectors...</em>', loadingId);

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: msgText })
        });
        const data = await res.json();
        
        // Remove loading message
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();

        if (res.ok && data.reply) {
          appendMessage('bot', data.reply, null, data.followUpQuestions);
        } else {
          appendMessage('bot', '⚠️ Analysis engine error: ' + (data.error || 'Failed to analyze query'));
        }
      } catch (err) {
        console.error('Chat error:', err);
        appendMessage('bot', '⚠️ Network error communicating with ML vector engine.');
      }
    }

    function appendMessage(sender, htmlContent, customId, followUps = []) {
      if (!chatMessages) return;

      const msgDiv = document.createElement('div');
      msgDiv.className = `chat-message ${sender}-message`;
      if (customId) msgDiv.id = customId;

      const avatar = sender === 'user' ? '👤' : '🤖';
      
      let followUpHtml = '';
      if (followUps && followUps.length > 0) {
        followUpHtml = `<div class="chat-prompt-pills">` +
          followUps.map(q => `<button type="button" class="chat-pill" data-prompt="${q}">${q}</button>`).join('') +
          `</div>`;
      }

      msgDiv.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-body">
          <p>${htmlContent.replace(/\n/g, '<br>')}</p>
          ${followUpHtml}
        </div>
      `;

      chatMessages.appendChild(msgDiv);
      chatMessages.scrollTop = chatMessages.scrollHeight;

      // Attach click listeners to new pills
      msgDiv.querySelectorAll('.chat-pill').forEach(pill => {
        pill.addEventListener('click', (e) => {
          const prompt = e.currentTarget.getAttribute('data-prompt');
          handleChatMessage(prompt);
        });
      });
    }

    if (chatForm) {
      chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = chatInput ? chatInput.value : '';
        handleChatMessage(text);
      });
    }

    // Attach click listener for initial chat pills
    document.querySelectorAll('.chat-pill').forEach(pill => {
      pill.addEventListener('click', (e) => {
        const prompt = e.currentTarget.getAttribute('data-prompt');
        handleChatMessage(prompt);
      });
    });

    // Multi-Platform Scraper & ML Re-Analysis Trigger Listener
    const btnTriggerScrapeAnalysis = document.getElementById('btn-trigger-scrape-analysis');
    if (btnTriggerScrapeAnalysis) {
      btnTriggerScrapeAnalysis.addEventListener('click', async () => {
        btnTriggerScrapeAnalysis.disabled = true;
        btnTriggerScrapeAnalysis.innerHTML = `⚡ Scraping & Re-Analyzing ML...`;

        try {
          const res = await fetch('/api/scrape-and-analyze', { method: 'POST' });
          const data = await res.json();
          if (res.ok) {
            showToast(`🚀 ${data.message}`);
            // Re-render UI
            await loadDashboardData();
          } else {
            showToast(data.error || 'Scrape and re-analysis failed.');
          }
        } catch (err) {
          console.error('Scrape trigger error:', err);
          showToast('Network error triggering scrape & re-analysis.');
        } finally {
          btnTriggerScrapeAnalysis.disabled = false;
          btnTriggerScrapeAnalysis.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6"/><path d="M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
            ⚡ Trigger Fresh Scrape & ML Re-Analysis
          `;
        }
      });
    }
    if (btnTriggerDailyPost) {
      btnTriggerDailyPost.addEventListener('click', async () => {
        btnTriggerDailyPost.disabled = true;
        btnTriggerDailyPost.innerHTML = `⚡ Executing 24h Daily Dispatch...`;

        try {
          const res = await fetch('/api/scheduler/trigger-daily-post', { method: 'POST' });
          const data = await res.json();
          if (res.ok) {
            showToast(`🚀 ${data.message}`);
            await loadDashboardData();
          } else {
            showToast(data.error || 'Failed to trigger daily auto-post.');
          }
        } catch (err) {
          console.error('Daily trigger error:', err);
          showToast('Network error triggering daily auto-poster.');
        } finally {
          btnTriggerDailyPost.disabled = false;
          btnTriggerDailyPost.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            ⚡ Trigger Daily Auto-Publish Run
          `;
        }
      });
    }

    function updateAuthUI(user) {
      if (user) {
        if (btnGoogleLoginDemo) btnGoogleLoginDemo.classList.add('hidden');
        if (btnMctigueLoginDemo) btnMctigueLoginDemo.classList.add('hidden');
        if (userProfileBadge) userProfileBadge.classList.remove('hidden');
        if (userAvatar) userAvatar.src = user.picture;
        if (userName) userName.textContent = user.name;
        if (authStatusTag) authStatusTag.textContent = user.authMethod || 'Verified Partner';
      } else {
        if (btnGoogleLoginDemo) btnGoogleLoginDemo.classList.remove('hidden');
        if (btnMctigueLoginDemo) btnMctigueLoginDemo.classList.remove('hidden');
        if (userProfileBadge) userProfileBadge.classList.add('hidden');
      }
    }

    // Multi-Platform Publisher Handlers
    const modalPublish = document.getElementById('modal-publish');
    const modalPublishClose = document.getElementById('modal-publish-close');
    const btnModalPublishCancel = document.getElementById('btn-modal-publish-cancel');
    const btnPubSelectAll = document.getElementById('btn-pub-select-all');
    const btnPubDeselectAll = document.getElementById('btn-pub-deselect-all');
    const btnSubmitPublish = document.getElementById('btn-submit-publish');

    if (modalPublishClose) modalPublishClose.addEventListener('click', window.closePublishModal);
    if (btnModalPublishCancel) btnModalPublishCancel.addEventListener('click', window.closePublishModal);
    
    // Close on backdrop click outside modal box
    if (modalPublish) {
      modalPublish.addEventListener('click', (e) => {
        if (e.target === modalPublish) window.closePublishModal();
      });
    }

    // Select All / Deselect All
    if (btnPubSelectAll) btnPubSelectAll.addEventListener('click', () => window.selectAllPlatforms(true));
    if (btnPubDeselectAll) btnPubDeselectAll.addEventListener('click', () => window.selectAllPlatforms(false));

    // Platform editor tab switching
    document.querySelectorAll('.pub-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = btn.getAttribute('data-pubtab');
        window.switchPubTab(targetId, btn);
      });
    });

    // Checkbox toggles
    document.querySelectorAll('.platform-chip-toggle input').forEach(chk => {
      chk.addEventListener('change', () => {
        const parent = chk.closest('.platform-chip-toggle');
        if (chk.checked) parent.classList.add('active');
        else parent.classList.remove('active');
      });
    });

    // Independent Single-Platform Publish Buttons
    document.querySelectorAll('.btn-publish-single').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const targetPlatform = btn.getAttribute('data-singleplatform');
        if (targetPlatform) {
          await window.publishSinglePlatform(targetPlatform, btn);
        }
      });
    });

    // Multi-Platform Publisher Global Click Handler
    if (btnSubmitPublish) {
      btnSubmitPublish.addEventListener('click', async (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        await window.executeGlobalPublish(btnSubmitPublish);
      });
    }
  }

  window._executePublish = executeMultiPlatformPublish;
  window._showToast = showToast;

  async function executeMultiPlatformPublish(targetPlatforms = [], actionBtn = null) {
    if (!targetPlatforms || targetPlatforms.length === 0) {
      showToast('Please select at least one target platform to publish.');
      return;
    }

    const origBtnText = actionBtn ? actionBtn.innerHTML : '';
    if (actionBtn) {
      actionBtn.disabled = true;
      actionBtn.innerHTML = `<span>Publishing to ${targetPlatforms.join(', ')}...</span>`;
    }

    const getVal = (id) => {
      const el = document.getElementById(id);
      return el ? el.value : '';
    };

    const goalTitleEl = document.getElementById('pub-goal-title');
    const modalPublish = document.getElementById('modal-publish');
    const payload = {
      goalId: getVal('pub-goal-id'),
      goalTitle: goalTitleEl ? goalTitleEl.textContent : 'Strategic Realization',
      infographicUrl: getVal('pub-infographic-url'),
      authorName: appState.currentUser ? appState.currentUser.name : 'Google Authenticated User',
      platforms: targetPlatforms,
      content: {
        mctigue: getVal('pub-content-mctigue'),
        linkedIn: getVal('pub-content-linkedin'),
        bluesky: getVal('pub-content-bluesky'),
        threads: getVal('pub-content-threads'),
        medium: getVal('pub-content-medium'),
        substack: getVal('pub-content-substack'),
        tumblr: getVal('pub-content-tumblr'),
        x: getVal('pub-content-x'),
        facebook: getVal('pub-content-facebook'),
        youtube: getVal('pub-content-youtube')
      }
    };

    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.dispatches) {
        if (modalPublish) modalPublish.classList.add('hidden');
        
        // Auto-copy formatted content to clipboard for 1-click paste fallback
        const primaryText = payload.content && payload.content.linkedIn ? payload.content.linkedIn : payload.goalTitle;
        const fullShareCopy = `${primaryText}\n\n🖼️ Visual Infographic Asset: ${payload.infographicUrl || ''}`;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(fullShareCopy).catch(() => {});
        }

        // Launch official live post intent windows for each target platform!
        data.dispatches.forEach(dispatch => {
          if (dispatch.share_url && dispatch.share_url !== 'http://localhost:3000/') {
            window.open(dispatch.share_url, '_blank');
          }
        });

        showToast(`🚀 Dispatched to ${targetPlatforms.join(', ')}! Formatted post & image link pre-filled & copied to clipboard (Ctrl+V).`);
      } else {
        showToast(data.error || 'Failed to generate live dispatches');
      }
    } catch (err) {
      console.error('Publish error:', err);
      showToast('Publishing network error');
    } finally {
      if (actionBtn) {
        actionBtn.disabled = false;
        actionBtn.innerHTML = origBtnText;
      }
    }
  }

  function openPublishModal(goal) {
    const modalPublish = document.getElementById('modal-publish');
    if (!modalPublish || !goal) return;

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    };

    setVal('pub-goal-id', goal.id || '');
    
    const titleEl = document.getElementById('pub-goal-title');
    if (titleEl) titleEl.textContent = goal.title || 'Strategic Realization';
    
    const infographicUrl = goal.infographic_url || '/assets/infographic_sovereign_ai.jpg';
    setVal('pub-infographic-url', infographicUrl);

    const domainsText = (goal.domains || []).join(' ⚡ ');
    const hashtags = (goal.domains || []).map(d => `#${d}`).join(' ');
    const keywordsStr = (goal.keywords_banner || []).map(k => `#${k.replace(/[^a-zA-Z0-9]/g, '')}`).join(' ');
    const shortRealization = (goal.realization || '').substring(0, 180);
    const authorName = appState.currentUser ? appState.currentUser.name : 'McTigue Strategic Intelligence';

    // 1. mctigue.co Executive Strategy Article
    setVal('pub-content-mctigue', 
      `🌐 MCTIGUE.CO EXECUTIVE STRATEGY ARTICLE\n` +
      `--------------------------------------------------\n` +
      `Title: ${goal.title || ''}\n` +
      `Author: ${authorName}\n` +
      `Domain Pair: ${domainsText}\n` +
      `Infographic Asset: ${infographicUrl}\n\n` +
      `EXECUTIVE OVERVIEW:\n${goal.summary || ''}\n\n` +
      `KEY SURPRISING REALIZATION:\n"${goal.realization || ''}"\n\n` +
      `STRATEGIC ACTIONABLE ROADMAP:\n` + (goal.strategic_goals || []).map((g, i) => `[0${i+1}] ${g}`).join('\n') +
      `\n\n[CONFIDENTIAL CORPORATE INTELLIGENCE BRIEFING - MCTIGUE & PARTNERS]`
    );

    // 2. LinkedIn Post Content (Professional Thought Leadership)
    setVal('pub-content-linkedin', 
      `💼 SURPRISING STRATEGIC REALIZATION: ${(goal.title || '').toUpperCase()}\n\n` +
      `Fusing insights across ${domainsText} reveals an unexpected market shift:\n\n` +
      `💡 Key Realization:\n"${goal.realization || ''}"\n\n` +
      `🚀 Actionable Strategic Roadmap:\n` + (goal.strategic_goals || []).map(g => `• ${g}`).join('\n') +
      `\n\n🖼️ Visual Infographic Asset: ${infographicUrl}\n\n` +
      `What are your thoughts on this cross-domain convergence? Let's discuss in the comments below.\n\n` +
      `#CrossDomain #ArtificialIntelligence #Strategy #Leadership #FutureOfWork #Innovation ${hashtags} ${keywordsStr}`
    );

    // 3. Bluesky Post Content (Open-Protocol Tech Micro-Blog)
    setVal('pub-content-bluesky', 
      `🦋 Realization: ${goal.title || ''}\n\n` +
      `"${shortRealization}..."\n\n` +
      `🎯 Key Goal: ${(goal.strategic_goals ? goal.strategic_goals[0] : '')}\n\n` +
      `🖼️ Visual Asset: ${infographicUrl}\n\n` +
      `${hashtags} #OpenSource #ATProto #Tech`
    );

    // 4. Threads Post Content (Casual Tech & Strategy Thread)
    setVal('pub-content-threads', 
      `🧵 1/3 ${goal.title || ''}\n\n` +
      `Fusing ${domainsText} surfaced something surprising:\n\n` +
      `"${shortRealization}..."\n\n` +
      `🧵 2/3 Roadmap:\n` + (goal.strategic_goals || []).map((g, i) => `👉 ${i+1}. ${g}`).join('\n') +
      `\n\n🧵 3/3 Visual Infographic attached below 🖼️\n${infographicUrl}\n\n` +
      `Drop your thoughts below! 👇`
    );

    // 5. Medium Article Draft Content (In-Depth Technical Deep Dive)
    setVal('pub-content-medium', 
      `# ${goal.title || ''}\n\n` +
      `*A Cross-Domain Machine Learning Synthesis across ${domainsText}*\n\n` +
      `![Header Infographic Banner](${infographicUrl})\n\n` +
      `## Executive Summary\n${goal.summary || ''}\n\n` +
      `## The Surprising Realization\n> "${goal.realization || ''}"\n\n` +
      `## Actionable Strategic Roadmap\n` + (goal.strategic_goals || []).map((g, i) => `### ${i+1}. ${g}\nDetailed implementation plan for scaling localized inference hypervisors with zero-knowledge attestations.\n`).join('\n') +
      `\n\n---\n*Published via LinkedIn Cross-Domain ML Agent*`
    );

    // 6. Substack Newsletter Issue (Strategic Newsletter)
    setVal('pub-content-substack', 
      `[STRATEGIC BRIEFING #${Math.floor(Math.random() * 90) + 10}] ${goal.title || ''}\n\n` +
      `Dear Subscribers,\n\n` +
      `Our daily ML cross-domain analysis has surfaced a major convergence between ${domainsText}.\n\n` +
      `📸 ISSUE GRAPHIC ASSET:\n${infographicUrl}\n\n` +
      `KEY REALIZATION:\n"${goal.realization || ''}"\n\n` +
      `ACTIONABLE STRATEGIC TAKEAWAWAYS:\n` + (goal.strategic_goals || []).map(g => `📌 ${g}`).join('\n') +
      `\n\nSubscribe for daily automated cross-domain intelligence briefings!`
    );

    // 7. Tumblr Blog Post Content (Visual & Micro-Blogging)
    setVal('pub-content-tumblr', 
      `📝 ${(goal.title || '').toUpperCase()}\n\n` +
      `🖼️ VISUAL INFOGRAPHIC:\n${infographicUrl}\n\n` +
      `> "${goal.realization || ''}"\n\n` +
      `Strategic Highlights:\n` + (goal.strategic_goals || []).map(g => `✨ ${g}`).join('\n') +
      `\n\nTags: ${hashtags} #technology #ai art #future #data science #macroeconomics`
    );

    // 8. X (Twitter) Thread Content (Punchy Tweet Thread)
    setVal('pub-content-x', 
      `1/4 🧵 Surprising Discovery: ${goal.title || ''}\n\n` +
      `Cross-domain signals across ${domainsText} reveal:\n\n` +
      `"${shortRealization}..."\n\n` +
      `2/4 Strategic Action Items:\n` + (goal.strategic_goals || []).map((g, i) => `${i+1}. ${g}`).join('\n') +
      `\n\n3/4 Visual Infographic Asset: ${infographicUrl}\n\n` +
      `4/4 Retweet if you found this insight valuable! ${hashtags}`
    );

    // 9. Facebook Business Group Post (Community Discussion)
    setVal('pub-content-facebook', 
      `📘 STRATEGIC REALIZATION DISPATCH: ${goal.title || ''}\n\n` +
      `Hey everyone! 👋 Our daily ML cross-domain agent discovered an interesting trend fusing ${domainsText}:\n\n` +
      `Key Realization:\n"${goal.realization || ''}"\n\n` +
      `Strategic Action Deliverables:\n` + (goal.strategic_goals || []).map(g => `✔ ${g}`).join('\n') +
      `\n\n🖼️ Visual Infographic Asset Attached: ${infographicUrl}\n\n` +
      `What are your thoughts on this direction?`
    );

    // 10. YouTube Script & Community Tab Announcement
    setVal('pub-content-youtube', 
      `🔴 YOUTUBE SHORTS & COMMUNITY POST SCRIPT\n\n` +
      `🎬 Video Title: ${goal.title || ''}\n` +
      `🖼️ Thumbnail Asset: ${infographicUrl}\n\n` +
      `[0:00 - HOOK]: "Here is a surprising realization that nobody in ${domainsText} is talking about..."\n\n` +
      `[0:05 - REALIZATION]: "${goal.realization || ''}"\n\n` +
      `[0:20 - ROADMAP]:\n` + (goal.strategic_goals || []).map((g, i) => `[0${i+1}] ${g}`).join('\n') +
      `\n\n[0:35 - CTA]: "Like, subscribe, and drop a comment below!"`
    );

    modalPublish.classList.remove('hidden');
  }

  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3500);
  }
});

