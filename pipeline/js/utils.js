/* pipeline/js/utils.js */
function escapeHtml(v) { return String(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c])); }

function pill(text, cls) { return '<span class="status-pill ' + (cls || "proposed") + '">' + escapeHtml(text) + "</span>"; }

function uid(p) { return p + Math.random().toString(36).substring(2, 10); }
