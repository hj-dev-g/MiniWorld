# My Creative Portfolio

네이버 OGQ 마켓 스타일의 크리에이터 포트폴리오 웹사이트입니다. 이모티콘, 캘리그라피 등 다양한 작품을 보여줄 수 있습니다.

## 특징

- 크리에이터 프로필 섹션 (배너, 프로필 사진, 팔로우 버튼)
- 깔끔한 작품 카드 (작품 설명, 좋아요 표시)
- 작품 카테고리별 필터링 (이모티콘, 캘리그라피)
- Lightbox로 작품 크게 보기
- 반응형 디자인 (모바일/태블릿/PC 지원)
- 밝고 현대적인 디자인

## 사용 방법

### 1. 프로필 이미지 추가하기

`images/` 폴더에 다음 이미지들을 추가하세요:

```
images/
  ├── banner.jpg        # 프로필 배너 이미지 (1200x240px 권장)
  ├── profile.jpg       # 프로필 사진 (정사각형, 300x300px 권장)
  ├── emoticon-1.jpg    # 작품 이미지
  ├── emoticon-2.jpg
  ├── emoticon-3.jpg
  ├── calligraphy-1.jpg
  ├── calligraphy-2.jpg
  └── calligraphy-3.jpg
```

### 2. 갤러리 아이템 추가/수정하기

`index.html` 파일에서 갤러리 아이템을 추가하거나 수정하세요:

```html
<div class="gallery-item" data-category="emoticon">
    <div class="item-image">
        <img src="images/your-image.jpg" alt="작품 설명">
        <button class="like-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
        </button>
    </div>
    <div class="item-info">
        <h3 class="item-title">작품 제목</h3>
        <p class="item-description">작품에 대한 간단한 설명</p>
        <div class="item-stats">
            <span class="stat">❤️ 128</span>
        </div>
    </div>
</div>
```

**카테고리 종류:**
- `data-category="emoticon"` - 이모티콘
- `data-category="calligraphy"` - 캘리그라피

### 3. 개인 정보 수정하기

`index.html` 파일에서 다음 정보를 수정하세요:

- **사이트 제목**: `<title>` 태그와 `<h1 class="logo">` 수정
- **소개 문구**: Hero Section의 제목과 부제목
- **About**: About Section의 내용
- **Contact**: 이메일 주소와 소셜 미디어 링크

### 4. 로컬에서 테스트하기

브라우저에서 `index.html` 파일을 직접 열거나, 간단한 로컬 서버를 실행하세요:

```bash
# Python 3
python -m http.server 8000

# 또는 Python 2
python -m SimpleHTTPServer 8000
```

그 후 브라우저에서 `http://localhost:8000` 접속

### 5. GitHub Pages로 배포하기

1. GitHub 저장소 Settings로 이동
2. 왼쪽 메뉴에서 "Pages" 클릭
3. Source에서 배포할 브랜치 선택 (예: `main` 또는 현재 브랜치)
4. Save 클릭
5. 몇 분 후 제공되는 URL로 사이트 접속 가능

**배포 URL**: `https://[username].github.io/MiniWorld/`

## 파일 구조

```
MiniWorld/
├── index.html          # 메인 HTML 파일
├── styles.css          # 스타일시트
├── script.js           # JavaScript (필터링, lightbox)
├── images/             # 작품 이미지 폴더
│   └── .gitkeep
└── README.md           # 이 파일
```

## 커스터마이징

### 색상 변경

`styles.css` 파일에서 다음 색상을 변경할 수 있습니다:

- 배경색: `#fafafa`
- 메인 텍스트: `#333`
- 버튼 활성화: `#333`
- 호버 효과 등

### 새 카테고리 추가

1. `index.html`의 필터 버튼 섹션에 새 버튼 추가:
```html
<button class="filter-btn" data-filter="new-category">새 카테고리</button>
```

2. 갤러리 아이템에 새 카테고리 적용:
```html
<div class="gallery-item" data-category="new-category">
    ...
</div>
```

## 라이선스

MIT License - 자유롭게 사용하세요!

## 문의

작품이나 사이트에 대한 문의는 [your.email@example.com]으로 연락주세요.
