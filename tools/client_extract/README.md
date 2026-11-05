# 클라이언트 추출 도구 (2026-11-05)

뉴럴 클라우드 클라이언트 `configs.ab` 에서 사이트 데이터(시계 기록 · 로딩 팁 · 아이템 · 가구)를 뽑는 데 쓴 스크립트.

## 준비
- Python 3 + `pip install UnityPy` (그림은 Pillow 도 함께 깔림)
- `.ab` 파일은 맨 앞 0 바이트 8개를 떼야 Unity 파일로 열림 → `tools/fix_ab_header.ps1` 또는 `tail -c +9`

## 순서
1. 번들 풀기: `python dump.py <앞머리 뗀 .ab 폴더> <출력 폴더>`
   - 서버별로 `out/configs` (한국) · `out_jp/configs` · `out_en/configs` · `out_tw/configs` · `out_cn/configs` 에 `LuaConfigs.*.lua` 가 생기게 둔다
2. 이 폴더에서 실행 (`out*/` 폴더도 이 폴더 안에 둠)
   - `python items.py` → `data/<언어>/items.json`
   - `python furn.py` → `data/<언어>/furniture.json`
3. 이어서 저장소 루트에서
   - `python3 tools/build_gift_links.py` (선물 ↔ 인형)
   - `python3 tools/build_item_groups.py` (탭 · 묶음)

## 파일
| 파일 | 하는 일 |
|---|---|
| `luac.py` | 뉴럴 클라우드용 Lua 5.3 바이트코드 읽기 (헤더 형식 01 · size_t 4바이트) |
| `vm.py` | 표를 만드는 명령만 따라가는 작은 해석기 → 설정 표 복원 |
| `cfg.py` | 표 + `locale_text`(글자 번호 → 글) 연결, `CFG` 환경 변수로 서버 폴더 지정 |
| `pb.py` | UI 글자 사전(`ko_kr.ab` 안 protobuf) 읽기 |
| `dump.py` | `.ab` 안의 TextAsset · MonoBehaviour 꺼내기 |
| `disasm.py` | 바이트코드 명령 보기 (디버깅용) |

설정 표 이름 예: `noun_des`(시계 기록) · `noun_des_type` · `loading_tips` · `item` · `dorm_furniture` · `dorm_fnt_category` · `dorm_theme` · `skin` · `hero_data` · `attr_combat`(작전능력 공식) · `hero_star`(기본 수치)
