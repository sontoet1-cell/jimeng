const form = document.getElementById("download-form");
const input = document.getElementById("url");
const submitBtn = document.getElementById("submit-btn");
const statusText = document.getElementById("status");
const resultSection = document.getElementById("result");
const cover = document.getElementById("cover");
const itemIdEl = document.getElementById("item-id");
const titleEl = document.getElementById("title");
const downloadBest = document.getElementById("download-best");
const qualityList = document.getElementById("quality-list");
const progressWrap = document.getElementById("progress-wrap");
const progressBar = document.getElementById("progress-bar");
const progressLabel = document.getElementById("progress-label");
const FALLBACK_COVER = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#111827"/><stop offset="1" stop-color="#334155"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="320" cy="180" r="56" fill="#0ea5e9" opacity="0.8"/><polygon points="300,150 300,210 350,180" fill="#ffffff"/><text x="320" y="300" text-anchor="middle" fill="#cbd5e1" font-family="Arial,sans-serif" font-size="22">Tienich.pro Video</text></svg>')}`;

let currentBestItem = null;
let currentItemId = "";
let currentPlatform = "";
let currentRequiresPostprocess = false;
cover.onerror = () => {
  if (cover.src !== FALLBACK_COVER) {
    cover.src = FALLBACK_COVER;
  }
};

function setStatus(message, isError = false) {
  statusText.textContent = message;
  statusText.style.color = isError ? "#f87171" : "#facc15";
}

function setProgress(value, label) {
  const percent = Math.max(0, Math.min(100, Math.floor(Number(value) || 0)));
  progressWrap.classList.add("active");
  progressBar.style.width = `${percent}%`;
  progressLabel.textContent = `${percent}% - ${label || "Đang xử lý..."}`;
}

function resetProgress() {
  progressWrap.classList.remove("active");
  progressBar.style.width = "0%";
  progressLabel.textContent = "Đang chờ xử lý...";
}

function makeDirectDownloadUrl(item, name) {
  if (item?.audio_url && !item?.has_audio) {
    const qs = new URLSearchParams({ video: item.url, audio: item.audio_url, name });
    return `/api/download-merge?${qs.toString()}`;
  }
  const qs = new URLSearchParams({
    url: item?.url || "",
    name,
    platform: item?.platform || "",
    page_url: item?.page_url || ""
  });
  return `/api/download?${qs.toString()}`;
}

function resetResult() {
  resultSection.classList.add("hidden");
  cover.src = FALLBACK_COVER;
  itemIdEl.textContent = "";
  titleEl.textContent = "";
  downloadBest.setAttribute("href", "#");
  downloadBest.textContent = "Xử lý HD";
  downloadBest.dataset.mode = "idle";
  qualityList.innerHTML = "";
  currentBestItem = null;
  currentItemId = "";
  currentPlatform = "";
  currentRequiresPostprocess = false;
  resetProgress();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeSupportedInput(rawInput) {
  const trimmed = String(rawInput || "").trim().replace(/^["']|["']$/g, "");
  if (!trimmed) return "";

  const extracted = trimmed.match(/(https?:\/\/[^\s"'<>]+|(?:www\.|m\.|mbasic\.|web\.)?facebook\.com\/[^\s"'<>]+|fb\.watch\/[^\s"'<>]+|(?:www\.)?tiktok\.com\/[^\s"'<>]+|vm\.tiktok\.com\/[^\s"'<>]+|vt\.tiktok\.com\/[^\s"'<>]+|(?:www\.)?douyin\.com\/[^\s"'<>]+|v\.douyin\.com\/[^\s"'<>]+|(?:www\.)?youtube\.com\/[^\s"'<>]+|youtu\.be\/[^\s"'<>]+|jimeng\.jianying\.com\/[^\s"'<>]+)/i);
  const candidate = extracted ? extracted[0].replace(/[)\].,;]+$/, "") : trimmed;

  const withProtocol = (/^https?:\/\//i.test(candidate) || /^\/\//.test(candidate))
    ? candidate
    : (
      /^(?:www\.|m\.|mbasic\.|web\.)?facebook\.com\//i.test(candidate)
      || /^fb\.watch\//i.test(candidate)
      || /^(?:www\.)?tiktok\.com\//i.test(candidate)
      || /^v[mt]\.tiktok\.com\//i.test(candidate)
      || /^(?:www\.)?douyin\.com\//i.test(candidate)
      || /^v\.douyin\.com\//i.test(candidate)
      || /^(?:www\.)?youtube\.com\//i.test(candidate)
      || /^youtu\.be\//i.test(candidate)
      || /^jimeng\.jianying\.com\//i.test(candidate)
        ? `https://${candidate}`
        : candidate
    );

  return withProtocol.replace(/[)\].,;]+$/, "");
}

function detectQuality(item, fallbackIndex) {
  const candidates = [item?.quality, item?.label, item?.url, ""];
  for (const source of candidates) {
    const hit = String(source).match(/(2160|1440|1080|720|540|480|360|240)p/i);
    if (hit) return `${hit[1]}p`;
  }
  if (Number(item?.height) > 0) return `${item.height}p`;
  return `Q${fallbackIndex + 1}`;
}

function qualityClassByQuality(quality) {
  if (quality === "1440p") return "background:#5b21b6;border-color:#a78bfa";
  if (quality === "1080p") return "background:#047857;border-color:#34d399";
  if (quality === "720p") return "background:#1d4ed8;border-color:#60a5fa";
  return "background:#334155;border-color:#64748b";
}

function renderQualities(itemId, qualities) {
  qualityList.innerHTML = "";

  qualities.forEach((item, index) => {
    if (!item || !item.url) return;
    const quality = detectQuality(item, index);
    const qualityKey = String(quality).toLowerCase();
    const name = `tienich.pro_${itemId || Date.now()}_${qualityKey}.mp4`;

    const a = document.createElement("a");
    a.href = makeDirectDownloadUrl(item, name);
    a.target = "_blank";
    a.rel = "noopener";
    a.style.cssText = qualityClassByQuality(quality);
    const soundTag = item?.has_audio ? "Có tiếng" : (item?.audio_url ? "Cần ghép" : "Không tiếng");
    a.textContent = `${quality} · ${soundTag}`;
    qualityList.appendChild(a);
  });
}

async function resolveWithRetry(url) {
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch("/api/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });

      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        if (response.status >= 500 && attempt === 0) {
          setStatus(`Máy chủ lỗi ${response.status}, đang thử lại...`);
          await sleep(900);
          continue;
        }
        throw new Error(`HTTP ${response.status}: ${payload?.error || "Không thể xử lý link này."}`);
      }

      return payload || {};
    } catch (error) {
      lastError = error;
      const message = String(error?.message || "").toLowerCase();
      const retryable = message.includes("failed to fetch") || message.includes("network");
      if (retryable && attempt === 0) {
        setStatus("Kết nối không ổn định, đang thử lại...");
        await sleep(900);
        continue;
      }
      throw error;
    }
  }
  throw lastError || new Error("Không thể xử lý link này.");
}

async function createProcessJob(item, itemId) {
  const q = detectQuality(item, 0).toLowerCase();
  const name = `tienich.pro_${itemId || Date.now()}_${q}_processed.mp4`;

  const response = await fetch("/api/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      video_url: item.url,
      audio_url: item.audio_url || "",
      name
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${payload?.error || "Không tạo được job xử lý."}`);
  }
  return payload;
}

async function pollProcessJob(id) {
  for (let i = 0; i < 400; i += 1) {
    const response = await fetch(`/api/process/${encodeURIComponent(id)}`);
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${payload?.error || "Không đọc được tiến trình."}`);
    }

    setProgress(payload.progress || 0, payload.stage || "Đang xử lý...");

    if (payload.status === "done") {
      return payload;
    }
    if (payload.status === "error") {
      throw new Error(payload.error || "Xử lý thất bại.");
    }

    await sleep(700);
  }

  throw new Error("Xử lý quá lâu, vui lòng thử lại.");
}

downloadBest.addEventListener("click", async (event) => {
  if (downloadBest.dataset.mode === "direct") return;
  if (downloadBest.dataset.mode === "ready") return;

  event.preventDefault();
  if (!currentBestItem?.url) {
    setStatus("Chưa có dữ liệu video để xử lý.", true);
    return;
  }

  try {
    downloadBest.dataset.mode = "processing";
    downloadBest.textContent = "Đang xử lý...";
    downloadBest.style.pointerEvents = "none";
    setProgress(2, "Đang tạo tiến trình xử lý");
    setStatus("Đang xử lý hậu kỳ và ghép audio...");

    const started = await createProcessJob(currentBestItem, currentItemId);
    const finalJob = await pollProcessJob(started.id);

    if (!finalJob.download_url) {
      throw new Error("Không nhận được link tải file cuối.");
    }

    downloadBest.href = finalJob.download_url;
    downloadBest.dataset.mode = "ready";
    downloadBest.textContent = "Tải File Đã Xử Lý";
    downloadBest.style.pointerEvents = "auto";
    setProgress(100, "Hoàn tất, bấm nút để tải file");
    setStatus("Xử lý xong. Bấm 'Tải File Đã Xử Lý' để tải.");
  } catch (error) {
    downloadBest.dataset.mode = "process";
    downloadBest.textContent = "Xử lý HD";
    downloadBest.style.pointerEvents = "auto";
    setStatus(error.message || "Xử lý thất bại.", true);
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const finalUrl = normalizeSupportedInput(input.value);
  if (!finalUrl) {
    setStatus("Không tìm thấy link hợp lệ.", true);
    resetResult();
    return;
  }
  input.value = finalUrl;

  submitBtn.disabled = true;
  setStatus("Đang phân tích link...");
  resetResult();

  try {
    const payload = await resolveWithRetry(finalUrl);
    const qualities = Array.isArray(payload.qualities) ? payload.qualities : [];
    if (qualities.length === 0) {
      throw new Error("Không tìm thấy file để tải.");
    }

    const itemId = payload.item_id || "N/A";
    const best = qualities[0];
    const bestQuality = detectQuality(best, 0);

    currentBestItem = best;
    currentItemId = itemId;
    currentPlatform = String(payload.platform || "").toLowerCase();
    currentRequiresPostprocess = !!payload.requires_postprocess;

    cover.src = payload.cover_url || FALLBACK_COVER;

    itemIdEl.textContent = `video_id: ${itemId}`;
    const platform = payload.platform ? ` [${String(payload.platform).toUpperCase()}]` : "";
    titleEl.textContent = payload.title
      ? `${payload.title}${platform} (Uu tien: ${bestQuality})`
      : `Đã tìm thấy video${platform}. Ưu tiên: ${bestQuality}.`;

    const directUrl = makeDirectDownloadUrl(best, `tienich.pro_${itemId || Date.now()}_best.mp4`);
    if (!currentRequiresPostprocess || currentPlatform === "tiktok") {
      downloadBest.href = directUrl;
      downloadBest.dataset.mode = "direct";
      downloadBest.textContent = "Tải Bản Tốt Nhất";
      downloadBest.style.pointerEvents = "auto";
      resetProgress();
    } else {
      downloadBest.href = "#";
      downloadBest.dataset.mode = "process";
      downloadBest.textContent = "Xử Lý HD Và Ghép Tiếng";
      downloadBest.style.pointerEvents = "auto";
    }

    renderQualities(itemId, qualities);
    resultSection.classList.remove("hidden");

    const needMerge = currentRequiresPostprocess && !!best.audio_url && !best.has_audio;
    if (currentPlatform === "tiktok") {
      setStatus("TikTok: đã chọn bản có tiếng tốt nhất. Bấm tải trực tiếp.");
    } else if (needMerge) {
      setStatus("Đã tìm thấy bản chất lượng cao tách audio. Bấm nút để xử lý và ghép.");
    } else {
      setStatus("Đã tìm thấy bản cao nhất có tiếng. Bấm nút để tải trực tiếp.");
    }
  } catch (error) {
    setStatus(error.message || "Đã có lỗi trong quá trình xử lý.", true);
    resetResult();
  } finally {
    submitBtn.disabled = false;
  }
});

const fbIdForm = document.getElementById("fbid-form");
const fbIdInput = document.getElementById("fbid-input");
const fbIdBtn = document.getElementById("fbid-btn");
const fbIdResult = document.getElementById("fbid-result");

if (fbIdForm && fbIdInput && fbIdBtn && fbIdResult) {
  fbIdForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const url = String(fbIdInput.value || "").trim();
    if (!url) {
      fbIdResult.textContent = "Vui long nhap link Facebook.";
      fbIdResult.style.color = "#f87171";
      return;
    }

    fbIdBtn.disabled = true;
    fbIdResult.textContent = "Dang truy van Facebook ID...";
    fbIdResult.style.color = "#facc15";

    try {
      const response = await fetch("/api/facebook-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${payload?.error || "Khong truy van duoc Facebook ID."}`);
      }

      const id = String(payload.id || "").trim();
      const username = String(payload.username || "").trim();
      if (!id) throw new Error("Khong tim thay Facebook ID.");

      fbIdResult.textContent = username
        ? `Facebook ID: ${id} (username: ${username})`
        : `Facebook ID: ${id}`;
      fbIdResult.style.color = "#22c55e";
    } catch (error) {
      fbIdResult.textContent = error.message || "Khong truy van duoc Facebook ID.";
      fbIdResult.style.color = "#f87171";
    } finally {
      fbIdBtn.disabled = false;
    }
  });
}

const totpSecretInput = document.getElementById("totp-secret");
const totpCodeEl = document.getElementById("totp-code");
const totpTimerEl = document.getElementById("totp-timer");
const totpCopyBtn = document.getElementById("totp-copy");
const totpStatusEl = document.getElementById("totp-status");

function base32ToBytes(input) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = String(input || "").toUpperCase().replace(/[^A-Z2-7]/g, "");
  if (!clean) return new Uint8Array();

  let bits = 0;
  let value = 0;
  const out = [];
  for (let i = 0; i < clean.length; i += 1) {
    const idx = alphabet.indexOf(clean[i]);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

function parseOtpauthSecret(input) {
  const raw = String(input || "").trim();
  if (!raw) {
    throw new Error("Vui long nhap chuoi otpauth.");
  }
  if (!/^otpauth:\/\//i.test(raw)) {
    throw new Error("Sai dinh dang. Hay dan dung chuoi otpauth://totp/...");
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("Chuoi otpauth khong hop le.");
  }

  const type = String(parsed.hostname || "").toLowerCase();
  if (type !== "totp") {
    throw new Error("Chi ho tro otpauth dang TOTP.");
  }

  const secret = String(parsed.searchParams.get("secret") || "").trim();
  if (!secret) {
    throw new Error("Thieu tham so secret trong chuoi otpauth.");
  }

  if (!/^[A-Z2-7]+=*$/i.test(secret)) {
    throw new Error("Secret khong dung Base32.");
  }

  return secret;
}

async function generateTotp(secret, period = 30, digits = 6) {
  const keyBytes = base32ToBytes(secret);
  if (!keyBytes.length) throw new Error("Secret key khong hop le.");

  const epoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / period);
  const counterBuf = new ArrayBuffer(8);
  const view = new DataView(counterBuf);
  view.setUint32(0, Math.floor(counter / 0x100000000), false);
  view.setUint32(4, counter >>> 0, false);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, counterBuf);
  const hmac = new Uint8Array(sig);
  const offset = hmac[hmac.length - 1] & 0x0f;
  const codeInt = (
    ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff)
  ) % (10 ** digits);

  return String(codeInt).padStart(digits, "0");
}

async function updateTotpView() {
  if (!totpSecretInput || !totpCodeEl || !totpTimerEl || !totpStatusEl) return;
  const secret = String(totpSecretInput.value || "").trim();
  const remain = 30 - (Math.floor(Date.now() / 1000) % 30);
  totpTimerEl.textContent = `${remain}s`;

  if (!secret) {
    totpCodeEl.textContent = "------";
    totpStatusEl.textContent = "Nhap chuoi otpauth de tao ma 2FA.";
    totpStatusEl.style.color = "#94a3b8";
    return;
  }

  try {
    const parsedSecret = parseOtpauthSecret(secret);
    const code = await generateTotp(parsedSecret);
    totpCodeEl.textContent = code;
    totpStatusEl.textContent = "Ma 2FA dang hoat dong.";
    totpStatusEl.style.color = "#22c55e";
  } catch (error) {
    totpCodeEl.textContent = "------";
    totpStatusEl.textContent = error.message || "Chuoi otpauth khong hop le.";
    totpStatusEl.style.color = "#f87171";
  }
}

if (totpSecretInput && totpCodeEl && totpTimerEl && totpCopyBtn && totpStatusEl) {
  let ticking = null;
  const startTicking = () => {
    if (ticking) clearInterval(ticking);
    updateTotpView();
    ticking = setInterval(updateTotpView, 1000);
  };
  totpSecretInput.addEventListener("input", startTicking);
  totpCopyBtn.addEventListener("click", async () => {
    const code = String(totpCodeEl.textContent || "").trim();
    if (!/^\d{6}$/.test(code)) {
      totpStatusEl.textContent = "Chua co ma hop le de copy.";
      totpStatusEl.style.color = "#f87171";
      return;
    }
    try {
      await navigator.clipboard.writeText(code);
      totpStatusEl.textContent = "Da copy ma 2FA.";
      totpStatusEl.style.color = "#22c55e";
    } catch {
      totpStatusEl.textContent = "Khong copy duoc. Hay copy thu cong.";
      totpStatusEl.style.color = "#f87171";
    }
  });
  startTicking();
}
