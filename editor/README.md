# MiniWorld Reels Editor

브라우저 기반 Instagram Reels 편집기 프로토타입입니다.

## 현재 구현

- React + TypeScript + Vite
- Zustand 프로젝트 상태
- 9:16 Preview Canvas UI
- Media / Properties 패널
- Video / Text / Audio 멀티 트랙 Timeline
- Timeline 클릭 시 Playhead 이동
- 1080x1920 / 30fps 기본 프로젝트 모델

## 실행

```bash
cd editor
npm install
npm run dev
```

## 다음 구현 순서

1. 로컬 MP4 업로드 + Object URL
2. HTMLVideoElement Preview 연결
3. Play / Pause / Seek 동기화
4. Timeline clip drag
5. Trim / Split
6. Text overlay
7. Image overlay
8. Audio track
9. Undo / Redo
10. MP4 export
