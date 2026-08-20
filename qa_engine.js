/**
 * QA ENGINE & TALENT PARTNERSHIP INTELLIGENCE
 * Grounded in 802 creators & 1,000 videos dataset.
 * Factors in Verification Status + Total Shares + Total Comments for Partnership Fit.
 */

class QAEngine {
  constructor(geminiService, onSelectCreator) {
    this.gemini = geminiService;
    this.onSelectCreator = onSelectCreator;
    this.data = window.TIKTOK_DATA || { creators: [], overview: {} };
  }

  async answerQuestion(query) {
    const q = query.trim().toLowerCase();
    const analysis = this.analyzeQuery(q);

    // Live Gemini API
    if (this.gemini && this.gemini.isConfigured) {
      try {
        const groundedContext = this.formatGroundedContext(analysis);
        const geminiText = await this.gemini.generateAnswer(query, groundedContext);
        return {
          source: 'gemini',
          text: this.formatMarkdown(geminiText),
          matchedCreators: analysis.matchedCreators || []
        };
      } catch (err) {
        console.warn('Gemini API call failed, using local engine:', err);
      }
    }

    // Grounded Local Synthesis
    return {
      source: 'local',
      text: this.generateLocalResponse(q, analysis),
      matchedCreators: analysis.matchedCreators || []
    };
  }

  analyzeQuery(q) {
    const creators = this.data.creators;

    // Specific creator lookup
    const handleMatch = creators.find(c => q.includes(c.author.toLowerCase()) || q.includes(`@${c.author.toLowerCase()}`));
    if (handleMatch) {
      return { intent: 'creator_profile', creator: handleMatch, matchedCreators: [handleMatch] };
    }

    // Top Shares
    if (q.includes('share') || q.includes('viral') || q.includes('virality')) {
      const shareLeaders = [...creators]
        .sort((a, b) => b.total_shares - a.total_shares)
        .slice(0, 5);
      return { intent: 'top_shares', matchedCreators: shareLeaders };
    }

    // Top Comments / Community Engagement
    if (q.includes('comment') || q.includes('community') || q.includes('discussion')) {
      const commentLeaders = [...creators]
        .sort((a, b) => b.total_comments - a.total_comments)
        .slice(0, 5);
      return { intent: 'top_comments', matchedCreators: commentLeaders };
    }

    // Verified vs Unverified Breakdown
    if (q.includes('verified') || q.includes('unverified') || q.includes('compare') || q.includes('breakdown')) {
      const verified = creators.filter(c => c.verified);
      const unverified = creators.filter(c => !c.verified);
      return {
        intent: 'verified_comparison',
        data: {
          vCount: verified.length,
          uCount: unverified.length,
          vAvgShares: Math.round(verified.reduce((s, c) => s + c.total_shares, 0) / (verified.length || 1)),
          uAvgShares: Math.round(unverified.reduce((s, c) => s + c.total_shares, 0) / (unverified.length || 1)),
          vAvgComments: Math.round(verified.reduce((s, c) => s + c.total_comments, 0) / (verified.length || 1)),
          uAvgComments: Math.round(unverified.reduce((s, c) => s + c.total_comments, 0) / (unverified.length || 1)),
          vAvgScore: Math.round(verified.reduce((s, c) => s + c.partnership_score, 0) / (verified.length || 1)),
          uAvgScore: Math.round(unverified.reduce((s, c) => s + c.partnership_score, 0) / (unverified.length || 1)),
        },
        matchedCreators: unverified.slice(0, 3)
      };
    }

    // Default top high-impact targets (by partnership score)
    const topTargets = [...creators]
      .sort((a, b) => b.partnership_score - a.partnership_score || (b.total_shares + b.total_comments) - (a.total_shares + a.total_comments))
      .slice(0, 5);
    return { intent: 'top_targets', matchedCreators: topTargets };
  }

  formatGroundedContext(analysis) {
    const overview = this.data.overview;
    let ctx = `PARTNERSHIP STRATEGY CONTEXT:
- Total creators: ${overview.total_creators} (Verified: ${overview.verified_count}, Unverified: ${overview.unverified_count})
- Strategy: Unverified accounts are factored into the Partnership Fit Score as better partnership targets (higher accessibility and agency upside compared to enterprise-verified accounts).
- Active engagement metrics: Total Shares (virality) and Total Comments (community discussion) drive the core score.\n\n`;

    if (analysis.matchedCreators && analysis.matchedCreators.length > 0) {
      ctx += `MATCHED CREATORS:\n`;
      analysis.matchedCreators.forEach((c, idx) => {
        ctx += `${idx + 1}. @${c.author} | Fit Score: ${c.partnership_score}% | Verification: ${c.verified ? 'Verified' : 'Unverified'}
   Views: ${(c.total_views / 1e6).toFixed(2)}M | Shares: ${c.total_shares.toLocaleString()} | Comments: ${c.total_comments.toLocaleString()}
   Sample Video ID: ${c.videos[0]?.id || 'N/A'}\n`;
      });
    }
    return ctx;
  }

  generateLocalResponse(q, analysis) {
    if (analysis.intent === 'top_shares') {
      let rows = analysis.matchedCreators.map(c => `
        <tr>
          <td><button class="btn-text" onclick="app.selectCreatorByAuthor('${c.author}')">@${c.author}</button></td>
          <td class="num-col"><strong>${c.total_shares.toLocaleString()}</strong></td>
          <td class="num-col">${c.total_comments.toLocaleString()}</td>
          <td class="num-col">${c.verified ? 'Verified' : 'Unverified'}</td>
          <td class="num-col"><strong>${c.partnership_score}%</strong></td>
        </tr>
      `).join('');

      return `
<p><strong>Top Creators by Total Shares:</strong></p>
<table class="grounded-table">
  <tr><th>Creator</th><th class="num-col">Total Shares</th><th class="num-col">Comments</th><th class="num-col">Status</th><th class="num-col">Fit Score</th></tr>
  ${rows}
</table>
<p>High share volume indicates strong peer-to-peer distribution and organic brand reach.</p>
      `;
    }

    if (analysis.intent === 'top_comments') {
      let rows = analysis.matchedCreators.map(c => `
        <tr>
          <td><button class="btn-text" onclick="app.selectCreatorByAuthor('${c.author}')">@${c.author}</button></td>
          <td class="num-col"><strong>${c.total_comments.toLocaleString()}</strong></td>
          <td class="num-col">${c.total_shares.toLocaleString()}</td>
          <td class="num-col">${c.verified ? 'Verified' : 'Unverified'}</td>
          <td class="num-col"><strong>${c.partnership_score}%</strong></td>
        </tr>
      `).join('');

      return `
<p><strong>Top Creators by Total Comments:</strong></p>
<table class="grounded-table">
  <tr><th>Creator</th><th class="num-col">Total Comments</th><th class="num-col">Shares</th><th class="num-col">Status</th><th class="num-col">Fit Score</th></tr>
  ${rows}
</table>
<p>High comment volume signifies audience dialogue, community loyalty, and active interaction.</p>
      `;
    }

    if (analysis.intent === 'verified_comparison') {
      const d = analysis.data;
      return `
<p><strong>Verified vs Unverified Partnership Analysis:</strong></p>
<table class="grounded-table">
  <tr><th>Platform Status</th><th>Count</th><th class="num-col">Avg Shares</th><th class="num-col">Avg Comments</th><th class="num-col">Avg Fit Score</th></tr>
  <tr><td>Unverified</td><td>${d.uCount} (94.6%)</td><td class="num-col">${d.uAvgShares.toLocaleString()}</td><td class="num-col">${d.uAvgComments.toLocaleString()}</td><td class="num-col"><strong>${d.uAvgScore}%</strong></td></tr>
  <tr><td>Verified</td><td>${d.vCount} (5.4%)</td><td class="num-col">${d.vAvgShares.toLocaleString()}</td><td class="num-col">${d.vAvgComments.toLocaleString()}</td><td class="num-col">${d.vAvgScore}%</td></tr>
</table>
<p>Unverified accounts receive a strategic fit boost because they represent accessible, high-upside partnership targets compared to established verified accounts.</p>
      `;
    }

    // Default Top Targets (by Partnership Score)
    let rows = analysis.matchedCreators.map(c => `
      <tr>
        <td><button class="btn-text" onclick="app.selectCreatorByAuthor('${c.author}')">@${c.author}</button></td>
        <td class="num-col">${(c.total_views / 1e3).toFixed(0)}K</td>
        <td class="num-col">${c.total_shares.toLocaleString()}</td>
        <td class="num-col">${c.total_comments.toLocaleString()}</td>
        <td class="num-col">${c.verified ? 'Verified' : 'Unverified'}</td>
        <td class="num-col"><strong>${c.partnership_score}%</strong></td>
      </tr>
    `).join('');

    return `
<p><strong>Top Partnership Targets (Factoring Verification + Engagement):</strong></p>
<table class="grounded-table">
  <tr><th>Creator</th><th class="num-col">Views</th><th class="num-col">Shares</th><th class="num-col">Comments</th><th class="num-col">Status</th><th class="num-col">Fit Score</th></tr>
  ${rows}
</table>
<p>Click any creator above to inspect their profile and video records in the right panel.</p>
    `;
  }

  formatMarkdown(md) {
    if (!md) return '';
    let html = md
      .replace(/^### (.*$)/gim, '<h4 style="font-size:12px; font-weight:700; color:#cbd5e1; margin:6px 0 2px 0;">$1</h4>')
      .replace(/^## (.*$)/gim, '<h3 style="font-size:13px; font-weight:700; color:#f8fafc; margin:8px 0 3px 0;">$1</h3>')
      .replace(/^\* (.*$)/gim, '<li style="margin-left:12px;">$1</li>')
      .replace(/^- (.*$)/gim, '<li style="margin-left:12px;">$1</li>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/`([^`]+)`/gim, '<code style="background:rgba(240,246,252,0.1); padding:1px 4px; border-radius:3px; font-family:JetBrains Mono, monospace; font-size:10.5px;">$1</code>');

    // Auto-link @handles
    html = html.replace(/@([a-zA-Z0-9._]+)/g, (match, author) => {
      const exists = this.data.creators.some(c => c.author.toLowerCase() === author.toLowerCase());
      if (exists) {
        return `<button class="btn-text" onclick="app.selectCreatorByAuthor('${author}')">@${author}</button>`;
      }
      return match;
    });

    return html;
  }
}

window.QAEngine = QAEngine;
