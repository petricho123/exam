# AI 출제위원 — 본문 기반 시험 문제 생성기

> Gemini AI가 본문 텍스트를 분석해 엄격한 객관식 문제를 자동 출제하는 PWA입니다.

---

## 📁 파일 구조

```
exam-generator/
├── index.html       ← 메인 HTML (앱 진입점)
├── style.css        ← 전체 스타일
├── app.js           ← 앱 로직 (Gemini API 연동)
├── manifest.json    ← PWA 설정
├── sw.js            ← 서비스 워커 (오프라인 지원)
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

---

## 🚀 실행 방법

### 로컬 개발 서버 (권장)
```bash
# Python 내장 서버
python3 -m http.server 8080
# → http://localhost:8080 접속
```

```bash
# Node.js (npx serve)
npx serve .
```

### 웹 호스팅 배포
파일 전체를 GitHub Pages, Netlify, Vercel 등에 업로드하면 됩니다.
- HTTPS 환경에서만 PWA 설치 기능이 활성화됩니다.

---

## 🔑 Gemini API 키 발급

1. https://aistudio.google.com 접속
2. "Get API Key" → 새 키 생성
3. 앱 상단 입력창에 붙여넣기

> API 키는 브라우저(LocalStorage)에만 저장되며 서버로 전송되지 않습니다.

---

## 📱 PWA 설치 방법

### Android (Chrome)
- 브라우저 메뉴 → "앱 설치" 또는 "홈 화면에 추가"

### iOS (Safari)
- 공유 버튼 → "홈 화면에 추가"

### PC (Chrome/Edge)
- 주소창 오른쪽 설치 아이콘 클릭

---

## ⚙️ 주요 기능

- **본문 기반 출제**: 외부 지식 없이 본문에 명시된 내용만으로 문제 출제
- **정답 토글**: 아코디언 방식으로 정답/해설 개별 확인
- **PDF 다운로드**: 모든 정답 포함된 완성형 PDF 자동 저장
- **API 키 기억**: LocalStorage를 이용한 안전한 키 저장
- **PWA**: 홈 화면 설치 + 오프라인 앱 지원

---

## 🛠️ 커스터마이징

`app.js`의 `systemInstruction` 변수에서 AI 출제 규칙을 수정할 수 있습니다.

`style.css`의 `:root` 토큰에서 색상/폰트를 변경할 수 있습니다.
