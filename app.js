/* ══════════════════════════════════════════
   AI 출제위원 — app.js
   Gemini API 연동 + 문제 출제 + PDF 출력
══════════════════════════════════════════ */

const STORAGE_KEY_API  = 'examgen_gemini_key';
const STORAGE_KEY_REMEMBER = 'examgen_remember';

/* ── DOM refs ── */
const apiKeyInput       = document.getElementById('apiKeyInput');
const rememberKeyChk    = document.getElementById('rememberKey');
const toggleApiVisBtn   = document.getElementById('toggleApiVisibility');
const eyeIcon           = document.getElementById('eyeIcon');
const sourceText        = document.getElementById('sourceText');
const charCount         = document.getElementById('charCount');
const questionCount     = document.getElementById('questionCount');
const difficultyLevel   = document.getElementById('difficultyLevel');
const examTitleInput    = document.getElementById('examTitle');
const generateBtn       = document.getElementById('generateBtn');
const btnText           = generateBtn.querySelector('.btn-text');
const btnLoading        = generateBtn.querySelector('.btn-loading');
const resultsSection    = document.getElementById('resultsSection');
const questionsContainer= document.getElementById('questionsContainer');
const resultTitleDisplay= document.getElementById('resultTitleDisplay');
const resultCount       = document.getElementById('resultCount');
const toggleAllBtn      = document.getElementById('toggleAllBtn');
const downloadPdfBtn    = document.getElementById('downloadPdfBtn');
const errorToast        = document.getElementById('errorToast');
const errorMessage      = document.getElementById('errorMessage');
const pdfTitle          = document.getElementById('pdfTitle');
const pdfQuestionCount  = document.getElementById('pdfQuestionCount');
const pdfDate           = document.getElementById('pdfDate');

let allAnswersOpen = false;
let currentQuestions = [];

/* ══════════════════════════════════════════
   INIT — restore saved key
══════════════════════════════════════════ */
(function init() {
  try {
    const remember = localStorage.getItem(STORAGE_KEY_REMEMBER) === 'true';
    rememberKeyChk.checked = remember;
    if (remember) {
      const savedKey = localStorage.getItem(STORAGE_KEY_API);
      if (savedKey) apiKeyInput.value = savedKey;
    }
  } catch (e) { /* storage unavailable */ }

  // PWA service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();

/* ══════════════════════════════════════════
   API KEY — remember / forget
══════════════════════════════════════════ */
rememberKeyChk.addEventListener('change', () => {
  try {
    if (rememberKeyChk.checked) {
      localStorage.setItem(STORAGE_KEY_REMEMBER, 'true');
      if (apiKeyInput.value.trim()) {
        localStorage.setItem(STORAGE_KEY_API, apiKeyInput.value.trim());
      }
    } else {
      localStorage.removeItem(STORAGE_KEY_REMEMBER);
      localStorage.removeItem(STORAGE_KEY_API);
    }
  } catch (e) {}
});

apiKeyInput.addEventListener('input', () => {
  if (rememberKeyChk.checked) {
    try {
      localStorage.setItem(STORAGE_KEY_API, apiKeyInput.value.trim());
    } catch (e) {}
  }
});

/* ══════════════════════════════════════════
   TOGGLE API KEY VISIBILITY
══════════════════════════════════════════ */
toggleApiVisBtn.addEventListener('click', () => {
  const isPassword = apiKeyInput.type === 'password';
  apiKeyInput.type = isPassword ? 'text' : 'password';
  eyeIcon.innerHTML = isPassword
    ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
    : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
});

/* ══════════════════════════════════════════
   CHAR COUNT
══════════════════════════════════════════ */
sourceText.addEventListener('input', () => {
  charCount.textContent = sourceText.value.length.toLocaleString('ko-KR');
});

/* ══════════════════════════════════════════
   GENERATE QUESTIONS
══════════════════════════════════════════ */
generateBtn.addEventListener('click', async () => {
  const apiKey = apiKeyInput.value.trim();
  const text   = sourceText.value.trim();
  const count  = questionCount.value;
  const diff   = difficultyLevel.value;
  const title  = examTitleInput.value.trim() || '본문 기반 시험 문제';

  if (!apiKey) { showError('Gemini API 키를 입력해주세요.'); return; }
  if (!text)   { showError('본문 텍스트를 입력해주세요.'); return; }
  if (text.length < 100) { showError('본문이 너무 짧습니다. 최소 100자 이상 입력해주세요.'); return; }

  setLoading(true);
  resultsSection.classList.add('hidden');

  try {
    const questions = await callGeminiAPI(apiKey, text, count, diff);
    currentQuestions = questions;
    renderQuestions(questions, title, count);
    resultsSection.classList.remove('hidden');
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    showError(err.message || 'API 호출 중 오류가 발생했습니다.');
  } finally {
    setLoading(false);
  }
});

/* ══════════════════════════════════════════
   GEMINI API CALL
══════════════════════════════════════════ */
async function callGeminiAPI(apiKey, text, count, difficulty) {
  const difficultyKo = { easy: '쉬움(기초적인 사실 확인)', medium: '보통(핵심 개념 이해)', hard: '어려움(세부 내용 구분)' }[difficulty];

  const systemInstruction = `너는 극도로 엄격하고 객관적인 시험 출제위원이다.

핵심 규칙:
1. 오직 제공된 [본문 텍스트]에 명시적으로 기록된 사실만을 바탕으로 문제를 출제하라.
2. 너의 주관, 상식, 외부 지식, 혹은 사전에 학습한 데이터는 0%로 배제하라.
3. 본문의 내용을 바탕으로 유추하거나 짐작해야 하는 '추론형 문제'는 절대 출제하지 마라.
4. 오답 선지를 만들 때 본문의 단어나 숫자를 교묘하게 왜곡(예: 증가를 감소로, 수치 변경)하여 만들어라. 본문에 언급조차 없는 완전히 새로운 가짜 개념을 오답으로 사용하지 마라.
5. 모든 선지는 본문에서 파생된 내용이어야 한다.
6. 반드시 아래 JSON 형식으로만 응답하라. 마크다운 코드블록(backtick)이나 다른 텍스트 없이 순수 JSON만 출력하라.`;

  const userPrompt = `아래 [본문 텍스트]를 읽고, 난이도 "${difficultyKo}" 수준의 4지선다 객관식 문제를 정확히 ${count}개 출제하라.

[본문 텍스트]
---
${text}
---

다음 JSON 형식으로만 응답하라:
{
  "questions": [
    {
      "id": 1,
      "question": "문제 내용",
      "choices": ["① 선지1", "② 선지2", "③ 선지3", "④ 선지4"],
      "answer": 1,
      "explanation": "정답에 대한 해설 (본문의 어느 부분에서 근거를 찾을 수 있는지 설명)",
      "citation": "본문에서 정답의 근거가 되는 핵심 문장이나 구절을 그대로 인용"
    }
  ]
}

answer는 정답 번호(1~4)다. 반드시 순수 JSON만 출력하라.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemInstruction }]
        },
        contents: [{
          parts: [{ text: userPrompt }]
        }],
        generationConfig: {
          temperature: 0.3,
          topP: 0.8,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json'
        }
      })
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err?.error?.message || `API 오류 (${response.status})`;
    if (response.status === 400) throw new Error('API 요청 오류: ' + msg);
    if (response.status === 403) throw new Error('API 키가 유효하지 않습니다. 키를 확인해주세요.');
    if (response.status === 429) throw new Error('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
    throw new Error(msg);
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) throw new Error('AI로부터 응답을 받지 못했습니다. 다시 시도해주세요.');

  // Parse JSON (strip markdown fences if present)
  const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error('AI 응답을 파싱하는 데 실패했습니다. 다시 시도해주세요.');
  }

  if (!parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    throw new Error('문제를 생성하지 못했습니다. 본문이 충분한지 확인하고 다시 시도해주세요.');
  }

  return parsed.questions;
}

/* ══════════════════════════════════════════
   RENDER QUESTIONS
══════════════════════════════════════════ */
const CHOICE_LABELS = ['①', '②', '③', '④'];

function renderQuestions(questions, title, count) {
  questionsContainer.innerHTML = '';
  allAnswersOpen = false;
  toggleAllBtn.textContent = '전체 정답 보기';

  // Toolbar meta
  resultTitleDisplay.textContent = title;
  resultCount.textContent = `총 ${questions.length}문항`;

  // PDF header
  pdfTitle.textContent = title;
  pdfQuestionCount.textContent = questions.length + '문항';
  pdfDate.textContent = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

  questions.forEach((q, idx) => {
    const card = document.createElement('div');
    card.className = 'question-card';
    card.setAttribute('data-index', idx);

    const safeAnswer = parseInt(q.answer, 10);
    const choicesHtml = (q.choices || []).map((c, i) => {
      const isCorrect = (i + 1) === safeAnswer;
      return `<li class="choice-item" data-correct="${isCorrect}">
        <span class="choice-label">${CHOICE_LABELS[i] || (i + 1)}</span>
        <span class="choice-text">${escapeHtml(stripChoicePrefix(c))}</span>
      </li>`;
    }).join('');

    card.innerHTML = `
      <div class="question-header">
        <div class="question-number">${idx + 1}</div>
        <p class="question-text">${escapeHtml(q.question)}</p>
      </div>
      <ul class="choices-list">${choicesHtml}</ul>
      <button class="answer-toggle-btn no-print" data-idx="${idx}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        정답 및 해설 보기
      </button>
      <div class="answer-panel" id="answer-panel-${idx}">
        <div class="answer-panel-inner">
          <div class="answer-correct">
            <div class="answer-correct-badge">${safeAnswer}</div>
            정답: ${CHOICE_LABELS[safeAnswer - 1] || safeAnswer}번 — ${escapeHtml(stripChoicePrefix(q.choices?.[safeAnswer - 1] || ''))}
          </div>
          <p class="answer-explanation">${escapeHtml(q.explanation || '')}</p>
          ${q.citation ? `<div class="answer-citation">${escapeHtml(q.citation)}</div>` : ''}
        </div>
      </div>
    `;

    questionsContainer.appendChild(card);

    // Toggle button listener
    const toggleBtn = card.querySelector('.answer-toggle-btn');
    const panel     = card.querySelector('.answer-panel');
    toggleBtn.addEventListener('click', () => {
      const isOpen = panel.classList.contains('open');
      panel.classList.toggle('open', !isOpen);
      toggleBtn.classList.toggle('open', !isOpen);
      toggleBtn.innerHTML = isOpen
        ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg> 정답 및 해설 보기`
        : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg> 해설 닫기`;
    });
  });
}

/* ══════════════════════════════════════════
   TOGGLE ALL ANSWERS
══════════════════════════════════════════ */
toggleAllBtn.addEventListener('click', () => {
  allAnswersOpen = !allAnswersOpen;
  document.querySelectorAll('.answer-panel').forEach((panel, idx) => {
    panel.classList.toggle('open', allAnswersOpen);
    const btn = document.querySelector(`.answer-toggle-btn[data-idx="${idx}"]`);
    if (btn) {
      btn.classList.toggle('open', allAnswersOpen);
      btn.innerHTML = allAnswersOpen
        ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg> 해설 닫기`
        : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg> 정답 및 해설 보기`;
    }
  });
  toggleAllBtn.textContent = allAnswersOpen ? '전체 정답 숨기기' : '전체 정답 보기';
});

/* ══════════════════════════════════════════
   PDF DOWNLOAD
══════════════════════════════════════════ */
downloadPdfBtn.addEventListener('click', async () => {
  // 1. 모든 정답 패널 열기
  document.querySelectorAll('.answer-panel').forEach(p => p.classList.add('open'));

  const title = pdfTitle.textContent || 'exam';
  const pdfArea = document.getElementById('pdfArea');

  const opt = {
    margin:      [14, 14, 14, 14],
    filename:    `${title}.pdf`,
    image:       { type: 'jpeg', quality: 0.96 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      letterRendering: true,
      logging: false
    },
    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait'
    },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'], before: '.question-card' }
  };

  // Temporarily show pdf-header for print
  const pdfHeader = document.querySelector('.pdf-header.print-only');
  if (pdfHeader) pdfHeader.style.display = 'flex';

  // Hide no-print elements inside pdfArea if any
  const noPrintEls = pdfArea.querySelectorAll('.no-print');
  noPrintEls.forEach(el => el.style.display = 'none');

  try {
    await html2pdf().set(opt).from(pdfArea).save();
  } catch (e) {
    showError('PDF 생성 중 오류가 발생했습니다.');
  } finally {
    if (pdfHeader) pdfHeader.style.display = '';
    noPrintEls.forEach(el => el.style.display = '');
  }
});

/* ══════════════════════════════════════════
   UTILS
══════════════════════════════════════════ */
function setLoading(on) {
  generateBtn.disabled = on;
  btnText.classList.toggle('hidden', on);
  btnLoading.classList.toggle('hidden', !on);
}

function showError(msg) {
  errorMessage.textContent = msg;
  errorToast.classList.remove('hidden');
  setTimeout(() => errorToast.classList.add('hidden'), 5000);
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function stripChoicePrefix(text) {
  // Remove leading ①②③④ or 1. 2. etc if AI duplicated it
  return (text || '').replace(/^[①②③④\d][.）\s]\s*/, '').trim();
}
