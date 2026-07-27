import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const TYPE_LABELS = {
  "multiple-choice": "เลือกตอบ",
  "true-false": "ถูก-ผิด",
  completion: "เติมคำ",
  "short-answer": "ตอบสั้น",
  matching: "จับคู่",
  essay: "เขียนตอบ",
};

function getOptionLabel(idx) {
  return String.fromCharCode(65 + idx);
}

function buildQuizHTML(quiz, questions, showAnswers) {
  const title = quiz?.title || "ข้อสอบ";
  const date = new Date().toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  let qHTML = "";
  questions.forEach((q, idx) => {
    const type = q.type || "multiple-choice";
    const typeLabel = TYPE_LABELS[type] || type;

    qHTML += `
      <div class="question-block">
        <div class="q-header">
          <span class="q-number">${idx + 1}</span>
          <span class="q-type-badge">${typeLabel}</span>
        </div>
        <div class="q-text">${escapeHtml(q.question)}</div>
    `;

    if (type === "multiple-choice" || type === "true-false") {
      const options = q.options || [];
      qHTML += `<div class="options">`;
      options.forEach((opt, oi) => {
        const isCorrect = showAnswers && oi === q.correctIndex;
        qHTML += `
          <div class="option ${isCorrect ? "correct" : ""}">
            <span class="option-letter ${isCorrect ? "correct" : ""}">${getOptionLabel(oi)}</span>
            <span class="option-text">${escapeHtml(opt)}</span>
            ${isCorrect ? '<span class="check-mark">✓</span>' : ""}
          </div>
        `;
      });
      qHTML += `</div>`;
    }

    if (type === "completion" || type === "short-answer") {
      if (showAnswers) {
        qHTML += `
          <div class="answer-box">
            <div class="answer-label">เฉลย:</div>
            <div class="answer-text">${escapeHtml(q.answer || q.acceptableAnswers?.[0] || "-")}</div>
          </div>
        `;
        if (q.acceptableAnswers?.length > 1) {
          qHTML += `<div class="alt-answers">หรือ: ${q.acceptableAnswers.map((a) => escapeHtml(a)).join(", ")}</div>`;
        }
        if (q.keywords?.length > 0) {
          qHTML += `<div class="keywords">คีย์เวิร์ด: ${q.keywords.map((k) => escapeHtml(k)).join(", ")}</div>`;
        }
      } else {
        qHTML += `<div class="blank-line">..................................................................................</div>`;
      }
    }

    if (type === "matching") {
      const leftCol = q.leftColumn || q.pairs?.map((p) => ({ id: p.left, text: p.left })) || [];
      const rightCol = q.rightColumn || q.pairs?.map((p) => ({ id: p.right, text: p.right })).sort(() => Math.random() - 0.5) || [];

      if (showAnswers) {
        qHTML += `<div class="matching-grid">`;
        (q.pairs || []).forEach((pair) => {
          qHTML += `
            <div class="matching-row">
              <span class="matching-left">${escapeHtml(pair.left)}</span>
              <span class="matching-arrow">→</span>
              <span class="matching-right correct">${escapeHtml(pair.right)}</span>
            </div>
          `;
        });
        qHTML += `</div>`;
      } else {
        qHTML += `<div class="matching-grid">`;
        leftCol.forEach((item, idx) => {
          const rightItem = rightCol[idx];
          qHTML += `
            <div class="matching-row">
              <span class="matching-left">${escapeHtml(item.text)}</span>
              <span class="matching-arrow">—</span>
              <span class="matching-right empty">(${rightItem?.text ? "..." : ""})</span>
            </div>
          `;
        });
        qHTML += `</div>`;
      }
    }

    if (type === "essay") {
      if (showAnswers) {
        if (q.guidelines?.length > 0) {
          qHTML += `<div class="guidelines-box"><div class="answer-label">แนวคำตอบ:</div><ul>`;
          q.guidelines.forEach((g) => {
            qHTML += `<li>${escapeHtml(g)}</li>`;
          });
          qHTML += `</ul></div>`;
        }
        if (q.explanation) {
          qHTML += `<div class="explanation-box">${escapeHtml(q.explanation)}</div>`;
        }
      } else {
        qHTML += `<div class="blank-line" style="height:80px">&nbsp;</div>`;
      }
    }

    if (showAnswers && q.explanation && type !== "essay") {
      qHTML += `<div class="explanation-box">💡 ${escapeHtml(q.explanation)}</div>`;
    }

    qHTML += `</div>`;
  });

  return `
    <div class="pdf-container">
      <div class="pdf-header">
        <h1 class="pdf-title">${escapeHtml(title)}</h1>
        <div class="pdf-meta">
          <span>${questions.length} ข้อ</span>
          <span>•</span>
          <span>${date}</span>
          ${showAnswers ? '<span>•</span><span class="has-answers">พร้อมเฉลย</span>' : ""}
        </div>
      </div>
      ${qHTML}
      <div class="pdf-footer">สร้างโดย GenQ (genq-dlg.pages.dev)</div>
    </div>
  `;
}

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Export quiz questions to a PDF file.
 * @param {Object} quiz - Quiz metadata { title, source, ... }
 * @param {Array} questions - Questions array with answer data
 * @param {boolean} showAnswers - Whether to include answers in the PDF
 * @returns {Promise<void>}
 */
export async function exportQuizToPDF(quiz, questions, showAnswers = true) {
  const title = quiz?.title || "ข้อสอบ";
  const filename = title.replace(/[^a-zA-Z0-9ก-๙\s]/g, "").trim().substring(0, 50) || "quiz";

  const html = buildQuizHTML(quiz, questions, showAnswers);

  const container = document.createElement("div");
  container.innerHTML = html;
  container.style.cssText = `
    position: absolute;
    left: -9999px;
    top: 0;
    width: 210mm;
    background: #fff;
    font-family: 'Noto Sans Thai', 'Sarabun', 'Sukhumvit Set', 'Kanit', sans-serif;
    padding: 0;
    line-height: 1.6;
    color: #1f2937;
  `;
  document.body.appendChild(container);

  try {
    // Inject a style block for the temporary container
    const style = document.createElement("style");
    style.textContent = `
      .pdf-container { padding: 20mm 15mm; }
      .pdf-header { text-align: center; margin-bottom: 12mm; padding-bottom: 6mm; border-bottom: 3px solid #6366f1; }
      .pdf-title { font-size: 22pt; font-weight: 800; color: #1f2937; margin: 0 0 4px 0; }
      .pdf-meta { font-size: 10pt; color: #9ca3af; display: flex; justify-content: center; gap: 8px; }
      .has-answers { color: #059669; font-weight: 600; }
      .question-block {
        margin-bottom: 8mm;
        padding-bottom: 6mm;
        border-bottom: 1px solid #e5e7eb;
        page-break-inside: avoid;
      }
      .q-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4mm; }
      .q-number {
        width: 28px; height: 28px;
        background: #eef2ff; color: #6366f1;
        font-weight: 700; font-size: 11pt;
        border-radius: 6px;
        display: inline-flex; align-items: center; justify-content: center;
      }
      .q-type-badge {
        font-size: 8pt; color: #6b7280;
        background: #f3f4f6;
        padding: 2px 8px; border-radius: 10px;
      }
      .q-text { font-size: 12pt; font-weight: 600; color: #111827; margin-bottom: 4mm; line-height: 1.7; }
      .options { display: flex; flex-direction: column; gap: 3mm; padding-left: 2mm; }
      .option {
        display: flex; align-items: center; gap: 3mm;
        padding: 2.5mm 3mm;
        border: 1px solid #e5e7eb; border-radius: 6px;
      }
      .option.correct {
        background: #f0fdf4; border-color: #86efac;
      }
      .option-letter {
        width: 22px; height: 22px;
        background: #f3f4f6; color: #6b7280;
        font-weight: 700; font-size: 10pt;
        border-radius: 5px;
        display: inline-flex; align-items: center; justify-content: center;
        flex-shrink: 0;
      }
      .option-letter.correct {
        background: #22c55e; color: #fff;
      }
      .option-text { font-size: 11pt; color: #374151; }
      .check-mark { margin-left: auto; color: #22c55e; font-weight: 700; font-size: 14pt; }
      .answer-box {
        margin-top: 3mm; padding: 3mm 4mm;
        background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px;
      }
      .answer-label { font-size: 9pt; font-weight: 700; color: #16a34a; margin-bottom: 1mm; }
      .answer-text { font-size: 12pt; font-weight: 600; color: #15803d; }
      .alt-answers { font-size: 9pt; color: #6b7280; margin-top: 1mm; }
      .keywords { font-size: 9pt; color: #6366f1; margin-top: 1mm; }
      .blank-line { color: #d1d5db; font-size: 12pt; margin-top: 3mm; padding: 0 2mm; }
      .matching-grid { display: flex; flex-direction: column; gap: 2mm; margin-top: 3mm; }
      .matching-row {
        display: flex; align-items: center; gap: 3mm;
        padding: 2mm 3mm;
        background: #f9fafb; border-radius: 6px;
      }
      .matching-left { flex: 1; font-size: 10pt; font-weight: 500; color: #374151; }
      .matching-arrow { color: #9ca3af; font-size: 12pt; }
      .matching-right { flex: 1; font-size: 10pt; color: #6b7280; }
      .matching-right.correct { color: #16a34a; font-weight: 600; }
      .matching-right.empty { color: #d1d5db; font-style: italic; }
      .guidelines-box {
        margin-top: 3mm; padding: 3mm 4mm;
        background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px;
      }
      .guidelines-box ul { margin: 2mm 0 0 0; padding-left: 5mm; }
      .guidelines-box li { font-size: 10pt; color: #92400e; margin-bottom: 1mm; }
      .explanation-box {
        margin-top: 3mm; padding: 2.5mm 4mm;
        background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 6px;
        font-size: 10pt; color: #5b21b6; line-height: 1.6;
      }
      .pdf-footer {
        text-align: center; font-size: 8pt; color: #d1d5db;
        margin-top: 10mm; padding-top: 3mm; border-top: 1px solid #f3f4f6;
      }
    `;
    container.appendChild(style);

    // Wait for fonts to render
    await new Promise((r) => setTimeout(r, 500));

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      width: container.scrollWidth,
      height: container.scrollHeight,
      windowWidth: container.scrollWidth,
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const pdf = new jsPDF("p", "mm", "a4");
    let yOffset = 0;
    let remainingHeight = imgHeight;

    while (remainingHeight > 0) {
      if (yOffset !== 0) pdf.addPage();

      // Calculate how much of the image fits on this page
      const pageImgHeight = Math.min(pageHeight, remainingHeight);
      const srcY = (yOffset / imgHeight) * canvas.height;

      // Crop and add
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = (pageImgHeight / imgHeight) * canvas.height;
      const ctx = pageCanvas.getContext("2d");
      ctx.drawImage(
        canvas,
        0, srcY, canvas.width, pageCanvas.height,
        0, 0, canvas.width, pageCanvas.height
      );
      const pageImgData = pageCanvas.toDataURL("image/jpeg", 0.95);

      pdf.addImage(pageImgData, "JPEG", 0, 0, imgWidth, pageImgHeight);
      yOffset += pageImgHeight;
      remainingHeight -= pageImgHeight;
    }

    pdf.save(`${filename}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Export with answers — quick wrapper
 */
export async function exportQuizWithAnswers(quiz, questions) {
  return exportQuizToPDF(quiz, questions, true);
}

/**
 * Export WITHOUT answers (exam paper only)
 */
export async function exportQuizBlank(quiz, questions) {
  return exportQuizToPDF(quiz, questions, false);
}
