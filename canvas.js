/**
 * CREATOR IMPACT MATRIX - HIGH PERFORMANCE 2D CANVAS VISUALIZER
 * Renders 802 creators mapped on Shares (X-axis) vs Comments (Y-axis)
 * Supports Log/Linear scale, zoom/pan, smooth hover tooltips, and click-to-inspect.
 */

class CreatorMatrixCanvas {
  constructor(canvasId, tooltipId, onSelectCreator) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.tooltip = document.getElementById(tooltipId);
    this.onSelectCreator = onSelectCreator;

    this.creators = [];
    this.filteredCreators = [];
    this.selectedCreator = null;
    this.hoveredCreator = null;

    // View & Transformation State
    this.scaleMode = 'log'; // 'log' or 'linear'
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;

    // Padding for axes
    this.padding = { top: 30, right: 30, bottom: 40, left: 50 };

    this.initEvents();
    this.resize();
  }

  setData(creators) {
    this.creators = creators;
    this.filteredCreators = [...creators];
    this.render();
  }

  setFilteredData(filtered) {
    this.filteredCreators = filtered;
    this.render();
  }

  setSelectedCreator(creator) {
    this.selectedCreator = creator;
    this.render();
  }

  setScaleMode(mode) {
    this.scaleMode = mode;
    this.resetView();
  }

  resetView() {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.render();
  }

  resize() {
    const parent = this.canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    this.width = parent.clientWidth;
    this.height = parent.clientHeight;

    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.scale(dpr, dpr);

    this.render();
  }

  initEvents() {
    window.addEventListener('resize', () => this.resize());

    // Mouse movement for hover tooltip
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseleave', () => {
      this.hoveredCreator = null;
      this.tooltip.style.display = 'none';
      this.render();
    });

    // Click to select
    this.canvas.addEventListener('click', (e) => this.handleClick(e));

    // Pan & Drag
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.isDragging = true;
        this.dragStartX = e.clientX - this.panX;
        this.dragStartY = e.clientY - this.panY;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        this.panX = e.clientX - this.dragStartX;
        this.panY = e.clientY - this.dragStartY;
        this.render();
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // Zoom on wheel
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.min(Math.max(this.zoom * zoomFactor, 0.6), 5.0);

      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      this.panX = mouseX - (mouseX - this.panX) * (newZoom / this.zoom);
      this.panY = mouseY - (mouseY - this.panY) * (newZoom / this.zoom);
      this.zoom = newZoom;

      this.render();
    }, { passive: false });
  }

  // Coordinate Mapping
  getPlotBounds() {
    return {
      left: this.padding.left,
      right: this.width - this.padding.right,
      top: this.padding.top,
      bottom: this.height - this.padding.bottom,
      width: this.width - this.padding.left - this.padding.right,
      height: this.height - this.padding.top - this.padding.bottom
    };
  }

  mapX(shares) {
    const bounds = this.getPlotBounds();
    const minShares = 1;
    const maxShares = 250000;

    let norm = 0;
    if (this.scaleMode === 'log') {
      const val = Math.max(shares, minShares);
      norm = (Math.log10(val) - Math.log10(minShares)) / (Math.log10(maxShares) - Math.log10(minShares));
    } else {
      norm = Math.min(shares / maxShares, 1);
    }

    norm = Math.max(0, Math.min(1, norm));
    const plotX = bounds.left + norm * bounds.width;
    return plotX * this.zoom + this.panX;
  }

  mapY(comments) {
    const bounds = this.getPlotBounds();
    const minComments = 1;
    const maxComments = 650000;

    let norm = 0;
    if (this.scaleMode === 'log') {
      const val = Math.max(comments, minComments);
      norm = (Math.log10(val) - Math.log10(minComments)) / (Math.log10(maxComments) - Math.log10(minComments));
    } else {
      norm = Math.min(comments / maxComments, 1);
    }

    norm = Math.max(0, Math.min(1, norm));
    // Invert Y because canvas origin is at top
    const plotY = bounds.bottom - norm * bounds.height;
    return plotY * this.zoom + this.panY;
  }

  mapRadius(views) {
    // Bubble radius scaled by views (between 4px and 22px)
    const minR = 4;
    const maxR = 22;
    const logMin = Math.log10(1000);
    const logMax = Math.log10(260000000);
    const logVal = Math.log10(Math.max(views, 1000));
    const norm = (logVal - logMin) / (logMax - logMin);
    return (minR + Math.max(0, Math.min(1, norm)) * (maxR - minR)) * Math.sqrt(this.zoom);
  }

  getNodeColor(c) {
    if (c.verified) return '#3b82f6'; // Mega Verified Blue
    if (c.high_impact_rate_pct >= 1.0) return '#10b981'; // High Impact Gem Emerald
    if (c.share_rate_pct > c.comment_rate_pct * 2) return '#06b6d4'; // Viral Amplifier Cyan
    if (c.comment_rate_pct > c.share_rate_pct * 2) return '#8b5cf6'; // Community Driver Violet
    return '#64748b'; // Emerging Slate
  }

  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);

    this.drawAxesAndGrid();

    // Draw creators
    const isFiltered = this.filteredCreators.length > 0;
    const listToDraw = isFiltered ? this.filteredCreators : this.creators;

    // Sort so selected and hovered are drawn on top
    const sorted = [...listToDraw].sort((a, b) => {
      if (a === this.selectedCreator) return 1;
      if (b === this.selectedCreator) return -1;
      return a.total_views - b.total_views;
    });

    for (const c of sorted) {
      const cx = this.mapX(c.total_shares);
      const cy = this.mapY(c.total_comments);
      const r = this.mapRadius(c.total_views);
      const isSelected = this.selectedCreator && this.selectedCreator.author === c.author;
      const isHovered = this.hoveredCreator && this.hoveredCreator.author === c.author;
      const baseColor = this.getNodeColor(c);

      ctx.save();

      // Glowing aura for selected or hovered
      if (isSelected || isHovered) {
        ctx.beginPath();
        ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? 'rgba(16, 185, 129, 0.35)' : 'rgba(56, 189, 248, 0.3)';
        ctx.fill();

        ctx.strokeStyle = isSelected ? '#10b981' : '#38bdf8';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Main Bubble
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#10b981' : baseColor;
      ctx.globalAlpha = isSelected || isHovered ? 1.0 : 0.75;
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = isSelected ? 2 : 0.8;
      ctx.globalAlpha = isSelected ? 1.0 : 0.4;
      ctx.stroke();

      // Draw author name label for top tier creators or when zoomed
      if (r > 12 || isSelected || isHovered || c.promising_score > 70) {
        ctx.globalAlpha = 0.9;
        ctx.font = `${Math.max(10, 11 * Math.sqrt(this.zoom))}px Inter, sans-serif`;
        ctx.fillStyle = '#f0f6fc';
        ctx.textAlign = 'left';
        ctx.fillText(`@${c.author}`, cx + r + 4, cy + 3);
      }

      ctx.restore();
    }
  }

  drawAxesAndGrid() {
    const ctx = this.ctx;
    const bounds = this.getPlotBounds();

    ctx.save();
    ctx.strokeStyle = 'rgba(240, 246, 252, 0.06)';
    ctx.lineWidth = 1;
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillStyle = '#8b949e';

    // Grid lines for X (Shares)
    const xTicks = this.scaleMode === 'log' 
      ? [10, 100, 1000, 10000, 100000, 250000]
      : [0, 50000, 100000, 150000, 200000, 250000];

    for (const val of xTicks) {
      const gx = this.mapX(val);
      if (gx >= bounds.left && gx <= bounds.right) {
        ctx.beginPath();
        ctx.moveTo(gx, bounds.top);
        ctx.lineTo(gx, bounds.bottom);
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.fillText(this.formatNumber(val), gx, bounds.bottom + 16);
      }
    }

    // Grid lines for Y (Comments)
    const yTicks = this.scaleMode === 'log'
      ? [10, 100, 1000, 10000, 100000, 600000]
      : [0, 100000, 200000, 300000, 400000, 500000, 600000];

    for (const val of yTicks) {
      const gy = this.mapY(val);
      if (gy >= bounds.top && gy <= bounds.bottom) {
        ctx.beginPath();
        ctx.moveTo(bounds.left, gy);
        ctx.lineTo(bounds.right, gy);
        ctx.stroke();

        ctx.textAlign = 'right';
        ctx.fillText(this.formatNumber(val), bounds.left - 8, gy + 3);
      }
    }

    // Outer Plot Border
    ctx.strokeStyle = 'rgba(240, 246, 252, 0.12)';
    ctx.strokeRect(bounds.left, bounds.top, bounds.width, bounds.height);

    // Axis Labels
    ctx.font = 'bold 10px Inter, sans-serif';
    ctx.fillStyle = '#8b949e';
    ctx.textAlign = 'center';
    ctx.fillText('VIRALITY → TOTAL SHARES (PEER AMPLIFICATION)', bounds.left + bounds.width / 2, bounds.bottom + 32);

    ctx.save();
    ctx.translate(bounds.left - 35, bounds.top + bounds.height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('COMMUNITY DEPTH → TOTAL COMMENTS (ENGAGEMENT)', 0, 0);
    ctx.restore();

    ctx.restore();
  }

  handleMouseMove(e) {
    if (this.isDragging) return;

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    let found = null;
    let minDist = Infinity;

    const listToCheck = this.filteredCreators.length > 0 ? this.filteredCreators : this.creators;

    for (const c of listToCheck) {
      const cx = this.mapX(c.total_shares);
      const cy = this.mapY(c.total_comments);
      const r = this.mapRadius(c.total_views);

      const dist = Math.hypot(mouseX - cx, mouseY - cy);
      if (dist <= r + 5 && dist < minDist) {
        minDist = dist;
        found = c;
      }
    }

    if (found !== this.hoveredCreator) {
      this.hoveredCreator = found;
      this.render();

      if (found) {
        this.showTooltip(found, e.clientX, e.clientY);
      } else {
        this.tooltip.style.display = 'none';
      }
    } else if (found) {
      this.updateTooltipPosition(e.clientX, e.clientY);
    }
  }

  showTooltip(c, clientX, clientY) {
    const parentRect = this.canvas.parentElement.getBoundingClientRect();
    const x = clientX - parentRect.left + 15;
    const y = clientY - parentRect.top + 15;

    this.tooltip.innerHTML = `
      <div style="font-weight:700; font-size:12.5px; margin-bottom:4px; display:flex; justify-content:space-between; align-items:center;">
        <span>@${c.author}</span>
        <span class="badge ${c.verified ? 'badge-verified' : 'badge-emerald'}">${c.verified ? 'Verified' : 'Unsigned Gem'}</span>
      </div>
      <div style="font-size:10.5px; color:#8b949e; margin-bottom:6px;">${c.tier}</div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-family:JetBrains Mono, monospace; font-size:11px;">
        <div>Shares: <strong style="color:#06b6d4;">${c.total_shares.toLocaleString()}</strong></div>
        <div>Comments: <strong style="color:#8b5cf6;">${c.total_comments.toLocaleString()}</strong></div>
        <div>Views: <strong>${(c.total_views / 1e6).toFixed(1)}M</strong></div>
        <div>S+C Rate: <strong style="color:#10b981;">${c.high_impact_rate_pct.toFixed(2)}%</strong></div>
      </div>
      <div style="margin-top:6px; font-size:10px; color:#10b981; border-top:1px solid rgba(240,246,252,0.1); padding-top:4px;">
        👉 Click to inspect ${c.video_count} associated video(s)
      </div>
    `;

    this.tooltip.style.left = `${x}px`;
    this.tooltip.style.top = `${y}px`;
    this.tooltip.style.display = 'block';
  }

  updateTooltipPosition(clientX, clientY) {
    const parentRect = this.canvas.parentElement.getBoundingClientRect();
    const x = clientX - parentRect.left + 15;
    const y = clientY - parentRect.top + 15;
    this.tooltip.style.left = `${x}px`;
    this.tooltip.style.top = `${y}px`;
  }

  handleClick(e) {
    if (this.hoveredCreator) {
      this.selectedCreator = this.hoveredCreator;
      this.render();
      if (this.onSelectCreator) {
        this.onSelectCreator(this.hoveredCreator);
      }
    }
  }

  formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(0) + 'K';
    return num.toString();
  }
}

window.CreatorMatrixCanvas = CreatorMatrixCanvas;
