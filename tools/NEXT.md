# 다음 작업 (2026-11-05 정리)

지금 사이트: v1.5.5 (브랜치 v1.5.6: 스킬 육각 MAX=빨강 · 아래 레벨=분류 색 그림, 아직 병합 안 함) (게임식 스킬 육각 · 게임 그림 무장각인) (바로가기 퀵 바 · 자료실 화면 · 인형 페이지 목차 · 스킬 · 무장각인 · 이야기 접기)

## 업데이트 예정

### 0. ~~무장각인 화면 고치기~~ → v1.5.7 끝 (마름모 색만 · 단계 칸 꺾쇠 유지 · 로고 정중앙 · 레벨 0~30, 스킬 카드는 아래 패널 그대로)

### 1. UI/UX · 검색 필터 개선
- ~~검색 필터 아이콘~~ → v1.5.3 필터 줄 앞에 아이콘 하나로 끝남
- 시계 기록 목록을 제목만 보이는 폴더 격자로
- 그 밖에 화면 다듬기 (그때그때 제안)

### 1-2. 스킬 창을 게임 화면처럼
- 무장각인처럼 게임 UI 조각(KR spriteatlas)과 배치 정보(uiprefabs)를 찾아 1920×1080 판으로 다시 그리기
- 필요: 인형 스킬 화면 프리팹 · 아틀라스 (이름 검색 → KR raw 에서)

### 2. 궁극기 컷씬
- 스킬 데이터에 컷씬 이름이 이미 있음 (`skills.json` 의 `cut`, 예: `ultskill####`)
- 클라이언트 `.usm` 영상을 웹용(mp4/webm)으로 변환해 Cloudflare 에 올리기
- 스킬 탭 궁극기 상세에 재생 버튼 (`app.js` skillPanel 의 `if(sk.cut){…}` 자리)
- 필요: CN 클라이언트에서 컷씬 파일 위치 찾기 → 변환 방법 정하기

### 3. 알고리즘 · 성령
- 알고리즘: 아이템 「알고리즘」 탭은 있음 → 세트 효과 · 주/부 옵션 · 아이콘 정리
- 성령(요정): 얼굴 그림은 `fairysmallheadicon` 에 있음 → 스킬 · 설명 데이터 추출
- 탐색 · 카드 아이콘(`cardicon`, `explorationicon`)도 이때 같이
- 자료실 화면(`#archive`)에 카드 추가

### 4. 효과 · 기믹 정리 (내일부터 계속)
- 고유 스킬 · 패시브 등의 효과: 버프 · 디버프 · 상태 이상 목록과 설명 (스킬 용어 사전 `skills.json` 의 terms 를 바탕으로 넓히기)
- 함수(기능 카드) 정리
- 필드 효과 정리
- 그 밖의 전투 기믹
- 자료실 화면(`#archive`)에 카드로 추가, 스킬 설명 속 용어와 서로 연결

## 천천히
- 전투력 계산기 (데이터 둘 곳 정하기: 이 저장소 / 비공개 저장소)

## 확인할 것
- 무장각인 전용 틀 그림 (마름모 · 단계 칸 · "ARMA INSCRIPTA" 글자): 못 찾은 번들 6개 (`cd2211…` 등) 다시 찾기
- 무장각인 단계 해금 레벨 (지금 10 · 20 · 30)
- 성장 등급 (수에요이: 공격 B · 연산 S · 체력 B · 물방 C · 산방 B)

## 쌓아 둔 것
- 숙소 3D 프리셋 미리보기 그림
- 마인드 조각 선택지 아이콘 (heroheadicon)
- 메일 모음 화면

## 그림 올리기 (pnc-item)
- 압축은 `D:\42lab-resource\pnc-item` 을 대상 폴더로 지정해 풀기 (안의 폴더 `arma/` · `skill/` 유지)
- 올리기: `npx wrangler pages deploy "D:\42lab-resource\pnc-item" --project-name pnc-item --branch production`

## 그림 위치 메모 (CN png 내보내기, 2026-11-06 검토)
- commonicon.ab_export: 가구 538개는 모두 사이트에 있음 (ICON_furniture_1097 은 쓰는 아이템 없음, 눈송이 721152 는 임시 그림 = 미공개)
  - 나중에: ICON_spic_* (성령 · 보스) · ICON_Friendship_* (친밀도) · attri_* (능력치 아이콘) · reinforce_card_* · UserInfo_*
- explorationicon.ab_export: 함수 작업용 — ICON_tag_buff_* (chip_tag 묶음) · Corner_* (chip_mark) · ICON_xy_* · ICON_LBuff_* · ICON_Room_*
- ui_fairylist.ab_export: 성령 목록 UI 틀 (등급 S·A·B·C, 카드 테두리, 스킬 칸) · 얼굴은 fairysmallheadicon

