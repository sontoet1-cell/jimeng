const form = document.getElementById("download-form");
const input = document.getElementById("url");
const submitBtn = document.getElementById("submit-btn");
const statusText = document.getElementById("status");
const resultSection = document.getElementById("result");
const cover = document.getElementById("cover");
const author = document.getElementById("author");
const title = document.getElementById("title");
const downloadHd = document.getElementById("download-hd");
const downloadNormal = document.getElementById("download-normal");

function setStatus(message, isError = false) {
  statusText.textContent = message;
  statusText.style.color = isError ? "#b42318" : "";
}

function resetResult() {
  resultSection.classList.add("hidden");
  cover.removeAttribute("src");
  author.textContent = "";
  title.textContent = "";
  downloadHd.setAttribute("href", "#");
  downloadNormal.setAttribute("href", "#");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const url = input.value.trim();
  if (!url) {
    setStatus("Vui long nhap link TikTok.", true);
    resetResult();
    return;
  }

  submitBtn.disabled = true;
  setStatus("Dang lay link tai video...");
  resetResult();

  try {
    const response = await fetch("/api/resolve", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ url })
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Khong the xu ly link nay.");
    }

    cover.src = payload.cover || "";
    author.textContent = payload.author || "TikTok";
    title.textContent = payload.title || "TikTok video";
    downloadHd.href = payload.hdplay || payload.play;
    downloadNormal.href = payload.play || payload.hdplay;
    resultSection.classList.remove("hidden");
    setStatus("Da tim thay video. Ban co the tai ngay.");
  } catch (error) {
    setStatus(error.message || "Da co loi xay ra.", true);
    resetResult();
  } finally {
    submitBtn.disabled = false;
  }
});
