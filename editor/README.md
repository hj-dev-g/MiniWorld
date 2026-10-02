# MiniWorld Reels Editor

브라우저 기반 Instagram Reels 편집기 프로토타입입니다.

## 현재 구현

- React + TypeScript + Vite
- Zustand 프로젝트 상태
- 9:16 Preview Canvas UI
- Media / Properties 패널
- Video / Text / Audio 멀티 트랙 Timeline
- 로컬 MP4 / WebM / MOV 선택
- Object URL 기반 브라우저 로컬 영상 Preview
- Play / Pause
- ±1초 Seek
- 영상 재생 시간과 Timeline Playhead 동기화
- Timeline 클릭 Seek
- 업로드 영상 길이로 Timeline 자동 갱신
- Clip 선택 상태
- Playhead 기준 Clip Split
- Timeline Zoom
- GitHub Actions production build 검증
- 1080x1920 / 30fps 기본 프로젝트 모델

## 실행

```bash
cd editor
npm install
npm run dev
```

## 다음 구현 순서

1. Clip drag
2. Trim handles
3. Delete + gap 처리
4. Text overlay
5. Image overlay
6. Audio track
7. Undo / Redo
8. MP4 export
