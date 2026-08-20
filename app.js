/**
 * CREATOR PARTNERSHIP PIPELINE - APPLICATION CONTROLLER
 * Model-Agnostic AI Integration (Gemini, OpenAI, Claude, OpenRouter, Custom/Local).
 */

class App {
  constructor() {
    window.app = this;
    this.data = window.TIKTOK_DATA || { creators: [], overview: {} };
    this.creators = this.data.creators || [];
    this.filteredCreators = [...this.creators];
    
    // Default to top partnership target
    this.selectedCreator = this.creators[0] || null;

    this.currentFilter = 'all';
    this.currentSort = 'shares';
    this.searchQuery = '';

    this.initDOM();
    this.initServices();
    this.initEvents();

    this.applyFilters();
    if (this.selectedCreator) {
      this.renderCreatorDetail(this.selectedCreator);
    }
  }

  initDOM() {
    // Header KPIs
    this.kpiTotalCreators = document.getElementById('kpiTotalCreators');
    this.kpiShares = document.getElementById('kpiShares');
    this.kpiComments = document.getElementById('kpiComments');
    this.kpiUnverified = document.getElementById('kpiUnverified');
    this.llmStatusBadge = document.getElementById('llmStatusBadge');

    // Panel 1 - AI Chat
    this.chatStream = document.getElementById('chatStream');
    this.chatInput = document.getElementById('chatInput');
    this.btnSendChat = document.getElementById('btnSendChat');
    this.btnClearChat = document.getElementById('btnClearChat');
    this.chatEngineSub = document.getElementById('chatEngineSub');

    // Panel 2 - Leads
    this.sortSelect = document.getElementById('sortSelect');
    this.segmentBtns = document.querySelectorAll('.segment-btn');
    this.searchInput = document.getElementById('searchInput');
    this.btnClearSearch = document.getElementById('btnClearSearch');
    this.creatorCardsList = document.getElementById('creatorCardsList');
    this.leadCountBadge = document.getElementById('leadCountBadge');

    // Panel 3 - Dossier & Videos
    this.creatorProfileImg = document.getElementById('creatorProfileImg');
    this.creatorName = document.getElementById('creatorName');
    this.creatorStatusBadge = document.getElementById('creatorStatusBadge');
    this.creatorTier = document.getElementById('creatorTier');
    this.creatorScore = document.getElementById('creatorScore');
    this.mViews = document.getElementById('mViews');
    this.mShares = document.getElementById('mShares');
    this.mComments = document.getElementById('mComments');
    this.fitBullets = document.getElementById('fitBullets');
    this.videoCountLabel = document.getElementById('videoCountLabel');
    this.videoCardsScroll = document.getElementById('videoCardsScroll');

    // Model-Agnostic LLM Modal
    this.llmModal = document.getElementById('llmModal');
    this.btnAISettings = document.getElementById('btnAISettings');
    this.btnCloseLLMModal = document.getElementById('btnCloseLLMModal');
    this.btnSaveLLMConfig = document.getElementById('btnSaveLLMConfig');
    this.btnRemoveLLMKey = document.getElementById('btnRemoveLLMKey');
    this.llmProviderSelect = document.getElementById('llmProviderSelect');
    this.llmApiKeyInput = document.getElementById('llmApiKeyInput');
    this.llmModelInput = document.getElementById('llmModelInput');
    this.llmBaseUrlInput = document.getElementById('llmBaseUrlInput');
    this.groupBaseUrl = document.getElementById('groupBaseUrl');
    this.llmModalStatus = document.getElementById('llmModalStatus');
  }

  initServices() {
    this.llm = new LLMService();
    this.qaEngine = new QAEngine(this.llm, (c) => this.selectCreator(c));
    this.updateLLMStatusUI();
  }

  initEvents() {
    // Sort dropdown
    this.sortSelect.addEventListener('change', (e) => {
      this.currentSort = e.target.value;
      this.applyFilters();
    });

    // Filter Segments
    this.segmentBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.segmentBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.dataset.filter;
        this.applyFilters();
      });
    });

    // Search Input
    this.searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.trim().toLowerCase();
      this.btnClearSearch.style.display = this.searchQuery ? 'block' : 'none';
      this.applyFilters();
    });

    this.btnClearSearch.addEventListener('click', () => {
      this.searchInput.value = '';
      this.searchQuery = '';
      this.btnClearSearch.style.display = 'none';
      this.applyFilters();
    });

    // Chat
    this.btnSendChat.addEventListener('click', () => this.handleSendMessage());
    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handleSendMessage();
      }
    });

    this.btnClearChat.addEventListener('click', () => {
      this.chatStream.innerHTML = `
        <div class="chat-msg ai">
          <div class="msg-content">
            <p><strong>Chat Cleared.</strong> Ready for your next inquiry.</p>
          </div>
        </div>
      `;
    });

    // Prompt Buttons
    document.querySelectorAll('.prompt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.chatInput.value = btn.dataset.prompt;
        this.handleSendMessage();
      });
    });

    // LLM Settings Modal
    this.btnAISettings.addEventListener('click', () => this.openLLMModal());
    this.btnCloseLLMModal.addEventListener('click', () => this.closeLLMModal());
    this.btnSaveLLMConfig.addEventListener('click', () => this.saveLLMConfig());
    this.btnRemoveLLMKey.addEventListener('click', () => this.resetLLMConfig());

    this.llmProviderSelect.addEventListener('change', (e) => {
      const p = e.target.value;
      this.groupBaseUrl.style.display = (p === 'custom' || p === 'openrouter') ? 'flex' : 'none';
      if (p === 'gemini') this.llmModelInput.placeholder = 'gemini-2.5-flash, gemini-1.5-flash...';
      else if (p === 'openai') this.llmModelInput.placeholder = 'gpt-4o, gpt-4o-mini, gpt-3.5-turbo...';
      else if (p === 'anthropic') this.llmModelInput.placeholder = 'claude-3-5-sonnet-20241022, claude-3-haiku-20240307...';
      else if (p === 'openrouter') this.llmModelInput.placeholder = 'meta-llama/llama-3.1-70b-instruct...';
      else if (p === 'custom') this.llmModelInput.placeholder = 'llama3, mistral, qwen2.5...';
    });
  }

  applyFilters() {
    let list = [...this.creators];

    // Filter segment
    if (this.currentFilter === 'unverified') {
      list = list.filter(c => !c.verified);
    } else if (this.currentFilter === 'verified') {
      list = list.filter(c => c.verified);
    }

    // Search query
    if (this.searchQuery) {
      list = list.filter(c => 
        c.author.toLowerCase().includes(this.searchQuery) ||
        c.hashtags.some(h => h.toLowerCase().includes(this.searchQuery)) ||
        c.videos.some(v => v.caption.toLowerCase().includes(this.searchQuery))
      );
    }

    // Sort
    list.sort((a, b) => {
      if (this.currentSort === 'shares') return b.total_shares - a.total_shares;
      if (this.currentSort === 'comments') return b.total_comments - a.total_comments;
      if (this.currentSort === 'partnership_score') return b.partnership_score - a.partnership_score || (b.total_shares + b.total_comments) - (a.total_shares + a.total_comments);
      if (this.currentSort === 'views') return b.total_views - a.total_views;
      return 0;
    });

    this.filteredCreators = list;
    this.leadCountBadge.textContent = `${list.length} Leads`;
    this.renderLeadsList(list);

    if (list.length > 0 && (!this.selectedCreator || !list.some(c => c.author === this.selectedCreator.author))) {
      this.selectCreator(list[0]);
    }
  }

  renderLeadsList(creators) {
    const container = this.creatorCardsList;
    container.innerHTML = '';

    if (creators.length === 0) {
      container.innerHTML = `<p style="color:#94a3b8; font-size:11.5px; padding:20px; text-align:center;">No creators found for this criteria.</p>`;
      return;
    }

    const fragment = document.createDocumentFragment();
    creators.slice(0, 75).forEach(c => {
      const card = document.createElement('div');
      card.className = `lead-item-card ${this.selectedCreator && this.selectedCreator.author === c.author ? 'selected' : ''}`;

      card.innerHTML = `
        <div class="lead-card-top">
          <span class="lead-author">@${c.author}</span>
          <span class="fit-pill">${c.partnership_score}% Fit</span>
        </div>
        <div class="lead-metrics-row">
          <span>Views: <strong>${this.formatNumber(c.total_views)}</strong></span>
          <span>Shares: <strong>${this.formatNumber(c.total_shares)}</strong></span>
          <span>Comments: <strong>${this.formatNumber(c.total_comments)}</strong></span>
        </div>
        <div class="lead-badges-row">
          <span class="mini-badge">${c.verified ? 'Verified' : 'Unverified'}</span>
        </div>
      `;

      card.addEventListener('click', () => {
        this.selectCreator(c);
      });

      fragment.appendChild(card);
    });

    container.appendChild(fragment);
  }

  selectCreator(creator) {
    this.selectedCreator = creator;

    // Highlight card in Panel 2
    const cards = this.creatorCardsList.querySelectorAll('.lead-item-card');
    cards.forEach(c => {
      const author = c.querySelector('.lead-author')?.textContent;
      if (author === `@${creator.author}`) {
        c.classList.add('selected');
        c.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        c.classList.remove('selected');
      }
    });

    this.renderCreatorDetail(creator);
  }

  selectCreatorByAuthor(author) {
    const c = this.creators.find(item => item.author.toLowerCase() === author.toLowerCase());
    if (c) {
      this.selectCreator(c);
    }
  }

  renderCreatorDetail(c) {
    // Set Creator Profile Photo
    const primaryImgUrl = `https://unavatar.io/tiktok/${c.author}`;
    const fallbackImgUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(c.author)}&background=141c2b&color=cbd5e1&bold=true&size=128`;
    
    this.creatorProfileImg.src = primaryImgUrl;
    this.creatorProfileImg.onerror = () => {
      this.creatorProfileImg.onerror = null;
      this.creatorProfileImg.src = fallbackImgUrl;
    };

    this.creatorName.textContent = `@${c.author}`;
    this.creatorStatusBadge.textContent = c.verified ? 'Verified Account' : 'Unverified Account';
    this.creatorTier.textContent = `Engagement Potential: ${c.partnership_score}%`;
    this.creatorScore.textContent = c.partnership_score;

    this.mViews.textContent = this.formatNumber(c.total_views);
    this.mShares.textContent = this.formatNumber(c.total_shares);
    this.mComments.textContent = this.formatNumber(c.total_comments);

    this.fitBullets.innerHTML = c.pitch_points.map(p => `<li>${p}</li>`).join('');

    this.videoCountLabel.textContent = c.videos.length;
    this.renderVideosFeed(c.videos, c.author);
  }

  renderVideosFeed(videos, author) {
    const container = this.videoCardsScroll;
    container.innerHTML = '';

    if (!videos || videos.length === 0) {
      container.innerHTML = `<p style="color:#94a3b8; font-size:12px;">No video records in dataset.</p>`;
      return;
    }

    videos.forEach(v => {
      const card = document.createElement('div');
      card.className = 'video-entry-card';

      const tiktokUrl = `https://www.tiktok.com/@${author}/video/${v.id}`;

      card.innerHTML = `
        <div class="video-entry-top">
          <span class="video-id-badge" title="Verified TikTok Video ID">
            ID: <code>${v.id}</code>
          </span>
          <span style="font-size:10.5px; color:#94a3b8;">Date: ${v.upload_date || '2020'} &bull; Duration: ${v.duration_sec || 15}s</span>
        </div>

        <p class="video-caption-block">${v.caption || '<em style="color:#64748b;">[No caption text]</em>'}</p>

        <div class="video-tags-container">
          ${v.hashtag ? `<span class="video-tag-chip">#${v.hashtag}</span>` : ''}
          ${v.music_name ? `<span class="video-tag-chip">${v.music_is_original ? 'Original Audio' : v.music_name}</span>` : ''}
        </div>

        <div class="video-stats-row">
          <div class="stat-cell">
            <span class="stat-title">VIEWS</span>
            <span class="stat-number">${this.formatNumber(v.views)}</span>
          </div>
          <div class="stat-cell">
            <span class="stat-title">SHARES</span>
            <span class="stat-number">${this.formatNumber(v.shares)}</span>
          </div>
          <div class="stat-cell">
            <span class="stat-title">COMMENTS</span>
            <span class="stat-number">${this.formatNumber(v.comments)}</span>
          </div>
        </div>

        <div class="video-button-row">
          <button class="btn btn-secondary btn-sm" onclick="navigator.clipboard.writeText('${v.id}'); alert('Copied Video ID: ${v.id}');">Copy ID</button>
          <a href="${tiktokUrl}" target="_blank" rel="noopener noreferrer" class="btn-tiktok-link">
            Watch on TikTok
          </a>
        </div>
      `;

      container.appendChild(card);
    });
  }

  // Model-Agnostic Messaging
  async handleSendMessage() {
    const text = this.chatInput.value.trim();
    if (!text) return;

    this.chatInput.value = '';
    this.addChatMessage('user', text);

    const loadingId = this.addLoadingMessage();

    try {
      const response = await this.qaEngine.answerQuestion(text);
      this.removeLoadingMessage(loadingId);
      this.addChatMessage('ai', response.text);
    } catch (err) {
      this.removeLoadingMessage(loadingId);
      this.addChatMessage('ai', `<p style="color:#f43f5e;"><strong>Error:</strong> ${err.message}</p>`);
    }
  }

  addChatMessage(role, content) {
    const div = document.createElement('div');
    div.className = `chat-msg ${role}`;

    div.innerHTML = `
      <div class="msg-content">${content}</div>
    `;

    this.chatStream.appendChild(div);
    this.chatStream.scrollTop = this.chatStream.scrollHeight;
  }

  addLoadingMessage() {
    const id = 'loading_' + Date.now();
    const div = document.createElement('div');
    div.id = id;
    div.className = 'chat-msg ai';
    div.innerHTML = `
      <div class="msg-content"><p style="color:#94a3b8;">Analyzing dataset and synthesizing strategic response...</p></div>
    `;
    this.chatStream.appendChild(div);
    this.chatStream.scrollTop = this.chatStream.scrollHeight;
    return id;
  }

  removeLoadingMessage(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  // Model-Agnostic LLM Modal
  openLLMModal() {
    this.llmProviderSelect.value = this.llm.provider || 'gemini';
    this.llmApiKeyInput.value = this.llm.apiKey || '';
    this.llmModelInput.value = this.llm.model || '';
    this.llmBaseUrlInput.value = this.llm.baseUrl || '';
    
    this.groupBaseUrl.style.display = (this.llm.provider === 'custom' || this.llm.provider === 'openrouter') ? 'flex' : 'none';
    this.llmModal.style.display = 'flex';
  }

  closeLLMModal() { this.llmModal.style.display = 'none'; }

  async saveLLMConfig() {
    const provider = this.llmProviderSelect.value;
    const key = this.llmApiKeyInput.value.trim();
    const model = this.llmModelInput.value.trim();
    const baseUrl = this.llmBaseUrlInput.value.trim();

    this.llm.setProvider(provider);
    this.llm.setApiKey(key);
    if (model) this.llm.setModel(model);
    if (baseUrl) this.llm.setBaseUrl(baseUrl);

    this.llmModalStatus.textContent = 'Testing connection with provider...';

    try {
      if (key || provider === 'custom') {
        await this.llm.testConnection();
      }
      this.updateLLMStatusUI();
      alert(`Connected successfully to ${provider.toUpperCase()}.`);
      this.closeLLMModal();
    } catch (err) {
      this.llmModalStatus.textContent = `Connection Error: ${err.message}`;
    }
  }

  resetLLMConfig() {
    this.llm.setApiKey('');
    this.llm.setBaseUrl('');
    this.llmApiKeyInput.value = '';
    this.updateLLMStatusUI();
    alert('Reset to Grounded Local Analytics Engine mode.');
  }

  updateLLMStatusUI() {
    const providerNames = {
      gemini: 'Google Gemini',
      openai: 'OpenAI',
      anthropic: 'Claude',
      openrouter: 'OpenRouter',
      custom: 'Custom LLM'
    };

    if (this.llmStatusBadge) {
      if (this.llm.isConfigured || this.llm.provider === 'custom') {
        this.llmStatusBadge.textContent = providerNames[this.llm.provider] || 'Live';
        this.llmStatusBadge.className = 'badge-status online';
      } else {
        this.llmStatusBadge.textContent = 'Offline Engine';
        this.llmStatusBadge.className = 'badge-status';
      }
    }
    if (this.chatEngineSub) {
      if (this.llm.isConfigured || this.llm.provider === 'custom') {
        this.chatEngineSub.textContent = `Powered by ${providerNames[this.llm.provider]} (${this.llm.model || 'Default'})`;
      } else {
        this.chatEngineSub.textContent = `Grounded Local Analytics Engine`;
      }
    }
  }

  formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num ? num.toLocaleString() : '0';
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
