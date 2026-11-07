// HumanizeAnythingFully — Phase 1 frontend. Plain JS, no framework.
// The key, when pasted, lives only in the input box on this page. It is
// sent only with the rewrite request it belongs to, and is never stored,
// never logged, and never sent anywhere else.

const MAX_CHARS = 5000;
const CHUNK_CHARS = 4500;

const $ = (id) => document.getElementById(id);
const inputText = $("inputText");
const outputText = $("outputText");
const keyInput = $("keyInput");
const modeSelect = $("modeSelect");
const humanizeBtn = $("humanizeBtn");
const detectBtn = $("detectBtn");
const errorBox = $("errorBox");
const outputSection = $("output");
const progress = $("progress");
const progressBar = $("progressBar");
const progressText = $("progressText");

const SAMPLE = [
  "# Turmeric",
  "",
  "Turmeric is a spice obtained from the rhizome of Curcuma longa, a plant in the ginger family. It has been used in India for thousands of years as a flavouring agent, a colouring agent, and a medicine.",
  "",
  "## Detection of adulteration",
  "",
  "Chalk powder is a common adulterant in turmeric powder. It is added to increase the weight of the product and to improve its colour. Moreover, chalk powder is cheap and easily available, furthermore it is difficult to detect by sight alone. The presence of chalk powder can be detected by a simple chemical test. When dilute hydrochloric acid is added to the sample, effervescence occurs if chalk is present, because calcium carbonate reacts with the acid and releases carbon dioxide gas.",
  "",
  "- Turmeric contains curcumin, which gives it a yellow colour.",
  "- Curcumin is the main active compound in turmeric.",
  "- Adulterated turmeric can cause stomach problems when consumed regularly.",
].join("\n");

function countWords(t) {
  return t.split(/\s+/).filter(Boolean).length;
}

function countSentences(t) {
  const m = t.match(/[^.!?]+[.!?]+["')\]]*/g);
  return m ? m.length : t.trim() ? 1 : 0;
}

function refreshCounts() {
  const v = inputText.value;
  $("charCount").textContent = `${v.length.toLocaleString()} / ${MAX_CHARS.toLocaleString()} chars per request`;
  $("wordCount").textContent = `${countWords(v).toLocaleString()} words · ${countSentences(v)} sentences`;
}

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.remove("hidden");
}

function clearError() {
  errorBox.textContent = "";
  errorBox.classList.add("hidden");
}

function setBusy(busy) {
  humanizeBtn.disabled = busy;
  detectBtn.disabled = busy;
  progress.classList.toggle("hidden", !busy);
  if (!busy) progressBar.style.width = "0%";
}

function setProgress(done, total, label) {
  progressBar.style.width = total ? `${Math.round((done / total) * 100)}%` : "0%";
  progressText.textContent = label || "";
}

// Split long text into chunks at paragraph, then sentence, boundaries.
// Headings and list items stay inside their chunk; chunks are joined back
// with the same blank lines they came from.
function splitSentences(text) {
  const matches = text.match(/[^.!?]+[.!?]+["')\]]*/g);
  if (!matches) return text.trim() ? [text.trim()] : [];
  const out = matches.map((s) => s.trim()).filter(Boolean);
  const consumed = matches.join("").length;
  const rest = text.slice(consumed).trim();
  if (rest) out.push(rest);
  return out;
}

function chunkText(text) {
  if (text.length <= CHUNK_CHARS) return [text];
  const chunks = [];
  const blocks = text.split(/\n\s*\n/);
  let current = "";
  const push = () => {
    if (current) chunks.push(current);
    current = "";
  };
  for (const block of blocks) {
    if (!block.trim()) continue;
    if (current && current.length + block.length + 2 > CHUNK_CHARS) push();
    if (block.length > CHUNK_CHARS) {
      push();
      // Oversized single block: split it by sentences.
      let piece = "";
      for (const s of splitSentences(block)) {
        if (piece && piece.length + s.length + 1 > CHUNK_CHARS) {
          chunks.push(piece);
          piece = s;
        } else {
          piece = piece ? `${piece} ${s}` : s;
        }
      }
      if (piece) chunks.push(piece);
      continue;
    }
    current = current ? `${current}\n\n${block}` : block;
  }
  push();
  return chunks.length ? chunks : [text];
}

async function postJson(path, payload) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const msg =
      (data && data.message) || `Request failed (HTTP ${res.status}).`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function renderDetector(d) {
  const scoreEl = $("detScore");
  scoreEl.textContent = d.estimate;
  scoreEl.className = "score " + (d.estimate < 30 ? "good" : d.estimate <= 60 ? "mid" : "bad");
  $("detVerdict").textContent = d.verdict;
  $("detNote").textContent =
    d.note ||
    "This is a local heuristic estimate from surface signals (sentence rhythm, stock phrases, repeated openers). It is not ZeroGPT and not Turnitin. Confirm with ZeroGPT or Turnitin before reporting a score.";
  const metrics = [
    ["CV", d.cv != null ? d.cv : "–", "sentence-length variation (aim 0.55)"],
    ["SD", d.sd != null ? `${d.sd} words` : "–", "sentence-length spread"],
    ["Sentences", d.stats ? d.stats.sentences : "–", "in the rewritten text"],
    ["Words", d.stats ? d.stats.words.toLocaleString() : "–", "in the rewritten text"],
    ["Stock words", d.stockWords ? d.stockWords.reduce((a, b) => a + b.count, 0) : 0, "banned phrases found"],
  ];
  $("metricsGrid").innerHTML = metrics
    .map(
      ([label, value, sub]) =>
        `<div class="metric"><b>${value}</b><span>${label} — ${sub}</span></div>`
    )
    .join("");
  const flagged = d.flagged || [];
  $("flaggedWrap").classList.toggle("hidden", !flagged.length);
  $("flaggedList").innerHTML = flagged
    .slice(0, 10)
    .map(
      (f) =>
        `<li>${escapeHtml(f.sentence)}<span class="reason">${escapeHtml(
          f.reasons.join("; ")
        )}</span></li>`
    )
    .join("");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function onHumanize() {
  clearError();
  const text = inputText.value;
  if (!text.trim()) {
    showError("Paste some text first.");
    return;
  }
  const key = keyInput.value.trim();
  const mode = modeSelect.value;
  setBusy(true);
  try {
    const chunks = chunkText(text);
    const parts = [];
    let lastDetector = null;
    let passes = 1;
    for (let i = 0; i < chunks.length; i++) {
      setProgress(i, chunks.length, `Rewriting part ${i + 1} of ${chunks.length}...`);
      const data = await postJson("/api/humanize", {
        text: chunks[i],
        mode,
        key: key || undefined,
      });
      parts.push(data.rewritten);
      lastDetector = data.detector;
      passes = Math.max(passes, data.passes || 1);
      setProgress(i + 1, chunks.length, `Rewriting part ${i + 1} of ${chunks.length}...`);
    }
    const rewritten = parts.join("\n\n");
    outputText.value = rewritten;
    outputSection.classList.remove("hidden");
    $("passPill").textContent = `Passes: ${passes} · ${chunks.length} part${chunks.length > 1 ? "s" : ""}`;
    $("outStats").textContent = `${countWords(rewritten).toLocaleString()} words · ${countSentences(rewritten)} sentences (was ${countWords(text).toLocaleString()} words)`;
    if (lastDetector) {
      const combined = { ...lastDetector };
      if (chunks.length > 1) {
        // Detector numbers are per-chunk; re-check the whole result so the
        // panel reports the full text, not just the last part.
        try {
          const full = await postJson("/api/detect", { text: rewritten });
          renderDetector(full);
        } catch {
          renderDetector(combined);
        }
      } else {
        renderDetector(combined);
      }
    }
    outputSection.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    showError(err.message || "Something went wrong. Try again.");
  } finally {
    setBusy(false);
  }
}

async function onDetect() {
  clearError();
  const text = inputText.value;
  if (!text.trim()) {
    showError("Paste some text first.");
    return;
  }
  setBusy(true);
  try {
    const data = await postJson("/api/detect", { text });
    outputText.value = text;
    outputSection.classList.remove("hidden");
    $("passPill").textContent = "Check only — no rewrite";
    $("outStats").textContent = `${countWords(text).toLocaleString()} words · ${countSentences(text)} sentences`;
    renderDetector(data);
    outputSection.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    showError(err.message || "Something went wrong. Try again.");
  } finally {
    setBusy(false);
  }
}

inputText.addEventListener("input", refreshCounts);
humanizeBtn.addEventListener("click", onHumanize);
detectBtn.addEventListener("click", onDetect);
$("sampleBtn").addEventListener("click", () => {
  inputText.value = SAMPLE;
  refreshCounts();
  clearError();
});
$("clearBtn").addEventListener("click", () => {
  inputText.value = "";
  outputText.value = "";
  outputSection.classList.add("hidden");
  refreshCounts();
  clearError();
});
$("copyBtn").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(outputText.value);
    $("copyBtn").textContent = "Copied";
    setTimeout(() => ($("copyBtn").textContent = "Copy"), 1500);
  } catch {
    outputText.select();
    document.execCommand("copy");
  }
});
$("downloadBtn").addEventListener("click", () => {
  const blob = new Blob([outputText.value], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "humanized.txt";
  a.click();
  URL.revokeObjectURL(a.href);
});

refreshCounts();
