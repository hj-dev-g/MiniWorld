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
- 1080x1920 / 30fps 기본 프로젝트 모델

## 실행

```bash
cd editor
npm install
npm run dev
```

## 다음 구현 순서

1. Timeline clip 선택
2. Clip drag
3. Trim handles
4. Split
5. Delete
6. Text overlay
7. Image overlay
8. Audio track
9. Undo / Redo
10. MP4 export
