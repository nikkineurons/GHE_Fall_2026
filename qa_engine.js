/**
 * QA ENGINE & TALENT PARTNERSHIP INTELLIGENCE
 * Grounded in provided_materials/2026datathon_interview_data.csv (802 creators, 1,000 videos).
 * Model-Agnostic LLM Synthesis & Deterministic Fallback Engine.
 */

class QAEngine {
  constructor(llmService, onSelectCreator) {
    this.llm = llmService;
    this.onSelectCreator = onSelectCreator;
    this.data = window.TIKTOK_DATA || { creators: [], overview: {} };
  }

  async answerQuestion(query) {
    const q = query.trim().toLowerCase();
    const analysis = this.analyzeQuery(q);

    // Live Model-Agnostic LLM Provider
    if (this.llm && this.llm.isConfigured) {
      try {
        const groundedContext = this.formatGroundedContext(analysis);
        const llmText = await this.llm.generateAnswer(query, groundedContext);
        return {
          source: this.llm.provider,
          text: this.formatMarkdown(llmText),
          matchedCreators: analysis.matchedCreators || []
        };
      } catch (err) {
        console.warn(`${this.llm.provider.toUpperCase()} call failed, using local grounded engine:`, err);
      }
    }

    // Grounded Local Synthesis (Zero API Key / Offline)
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
    let ctx = `SOURCE DATASET: provided_materials/2026datathon_interview_data.csv
DATASET METADATA:
- Total Creators: ${overview.total_creators} (Verified: ${overview.verified_count}, Unverified: ${overview.unverified_count})
- Total Dataset Videos: ${overview.total_videos}
- Total Interactions: ${overview.total_shares.toLocaleString()} shares, ${overview.total_comments.toLocaleString()} comments
- Strategic Scoring Rules:
  * Unverified accounts represent accessible partnership opportunities with high agency upside (scores: 50% - 99%).
  * Verified accounts carry an intentional score cap at 50% max due to existing enterprise commitments.\n\n`;

    if (analysis.matchedCreators && analysis.matchedCreators.length > 0) {
      ctx += `MATCHED DATASET RECORDS FROM 2026datathon_interview_data.csv:\n`;
      analysis.matchedCreators.forEach((c, idx) => {
        ctx += `${idx + 1}. @${c.author} | Fit Score: ${c.partnership_score}% | Verification: ${c.verified ? 'Verified' : 'Unverified'}
   Dataset Metrics: ${(c.total_views / 1e6).toFixed(2)}M views | ${c.total_shares.toLocaleString()} shares | ${c.total_comments.toLocaleString()} comments
   Sample Video Record ID: ${c.videos[0]?.id || 'N/A'}\n`;
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
<p>High share volume in the dataset indicates strong organic peer-to-peer distribution and brand reach.</p>
<p style="font-size:10.5px; color:#94a3b8; margin-top:4px;">Source: <code>provided_materials/2026datathon_interview_data.csv</code></p>
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
<p>High comment volume in the dataset signifies audience dialogue, community loyalty, and active interaction.</p>
<p style="font-size:10.5px; color:#94a3b8; margin-top:4px;">Source: <code>provided_materials/2026datathon_interview_data.csv</code></p>
      `;
    }

    if (analysis.intent === 'verified_comparison') {
      const d = analysis.data;
      return `
<p><strong>Verified vs Unverified Dataset Comparison:</strong></p>
<table class="grounded-table">
  <tr><th>Platform Status</th><th>Count</th><th class="num-col">Avg Shares</th><th class="num-col">Avg Comments</th><th class="num-col">Avg Fit Score</th></tr>
  <tr><td>Unverified</td><td>${d.uCount} (94.6%)</td><td class="num-col">${d.uAvgShares.toLocaleString()}</td><td class="num-col">${d.uAvgComments.toLocaleString()}</td><td class="num-col"><strong>${d.uAvgScore}%</strong></td></tr>
  <tr><td>Verified</td><td>${d.vCount} (5.4%)</td><td class="num-col">${d.vAvgShares.toLocaleString()}</td><td class="num-col">${d.vAvgComments.toLocaleString()}</td><td class="num-col">${d.vAvgScore}%</td></tr>
</table>
<p>Unverified accounts in <code>2026datathon_interview_data.csv</code> represent 94.6% of records with high engagement and greater agency partnership potential.</p>
<p style="font-size:10.5px; color:#94a3b8; margin-top:4px;">Source: <code>provided_materials/2026datathon_interview_data.csv</code></p>
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
<p><strong>Top Partnership Targets (Verification + Engagement):</strong></p>
<table class="grounded-table">
  <tr><th>Creator</th><th class="num-col">Views</th><th class="num-col">Shares</th><th class="num-col">Comments</th><th class="num-col">Status</th><th class="num-col">Fit Score</th></tr>
  ${rows}
</table>
<p>Click any creator above to inspect their profile and associated video records in the right panel.</p>
<p style="font-size:10.5px; color:#94a3b8; margin-top:4px;">Source: <code>provided_materials/2026datathon_interview_data.csv</code></p>
    `;
  }

  formatMarkdown(md) {
    if (!md) return '';

    // Strip any accidental memo header residue
    let cleaned = md.replace(/^(MEMORANDUM|MEMO)[\s\S]*?(SUBJECT:[^\n]*\n+)/i, '').trim();

    // Parse Markdown tables into styled HTML tables
    const tableRegex = /((?:\|[^\n]+\|\r?\n)+)/g;
    cleaned = cleaned.replace(tableRegex, (match) => {
      const lines = match.trim().split('\n').filter(l => l.includes('|'));
      if (lines.length < 2) return match;

      // Extract header
      const headers = lines[0].split('|').map(s => s.trim()).filter(s => s.length > 0);
      let htmlTable = '<table class="grounded-table"><thead><tr>';
      headers.forEach(h => {
        htmlTable += `<th>${h}</th>`;
      });
      htmlTable += '</tr></thead><tbody>';

      // Skip separator line (line 1)
      for (let i = 2; i < lines.length; i++) {
        const cells = lines[i].split('|').map(s => s.trim()).filter(s => s.length > 0);
        if (cells.length > 0) {
          htmlTable += '<tr>';
          cells.forEach((cell, idx) => {
            const isNum = /^[\d,]+(\.\d+)?[KM%]?$/i.test(cell.replace(/<[^>]+>/g, '').trim());
            htmlTable += `<td class="${isNum ? 'num-col' : ''}">${cell}</td>`;
          });
          htmlTable += '</tr>';
        }
      }
      htmlTable += '</tbody></table>';
      return htmlTable;
    });

    // Formatting elements
    let html = cleaned
      .replace(/^### (.*$)/gim, '<h4 style="font-size:12px; font-weight:700; color:#cbd5e1; margin:8px 0 3px 0;">$1</h4>')
      .replace(/^## (.*$)/gim, '<h3 style="font-size:13px; font-weight:700; color:#f8fafc; margin:10px 0 4px 0;">$1</h3>')
      .replace(/^# (.*$)/gim, '<h2 style="font-size:14px; font-weight:800; color:#f8fafc; margin:12px 0 4px 0;">$1</h2>')
      .replace(/^\* (.*$)/gim, '<li style="margin-left:14px; margin-bottom:2px;">$1</li>')
      .replace(/^- (.*$)/gim, '<li style="margin-left:14px; margin-bottom:2px;">$1</li>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/`([^`]+)`/gim, '<code style="background:rgba(240,246,252,0.1); padding:1px 4px; border-radius:3px; font-family:JetBrains Mono, monospace; font-size:10.5px;">$1</code>');

    // Paragraph wrapping for loose lines (ignoring tables and headers)
    const blocks = html.split(/\n\n+/);
    html = blocks.map(b => {
      b = b.trim();
      if (!b) return '';
      if (b.startsWith('<table') || b.startsWith('<h') || b.startsWith('<li')) return b;
      return `<p style="margin-bottom:6px;">${b.replace(/\n/g, '<br>')}</p>`;
    }).join('');

    // Auto-link @handles to clickable interactive buttons
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
