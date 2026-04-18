# GG Auction to Sheets (MVP)

지지옥션 결과 화면에서 실제 매물 블록만 파싱해 Google Spreadsheet에 적재하는 크롬 익스텐션 + Apps Script 샘플입니다.

## 변경점 (고정 미니 창)
- 기존 popup 대신 **Chrome Side Panel** 기반 UI를 사용합니다.
- 브라우저 우측에 고정된 패널에서 작업이 계속 유지됩니다.
- 페이지별 진행 로그(페이지 번호/유효 매물/누적 유니크/상태)와 최종 요약을 확인할 수 있습니다.

## 구성 파일
- `manifest.json`: MV3 + side panel 설정
- `sidepanel.html`, `sidepanel.js`: 고정 패널 UI 및 진행 로그
- `parser.js`: 매물 블록 정규화 파서(헤더/광고/스크립트 제외, 스키마 매핑)
- `content.js`: 매물 컨테이너 범위 추출 + 페이지 이동
- `service-worker.js`: 페이지 순회/중복제거/전송/진행률 이벤트
- `Code.gs`: Apps Script Web App 수신 및 시트 적재
- `tests/parser.test.js`: 샘플 fixture 기반 파싱 회귀 테스트

## 사용
1. 확장 프로그램 아이콘 클릭
2. 우측 Side Panel 열림
3. Web App URL 저장 후 `수집 시작`
4. 패널에서 페이지별 처리 현황 확인

## 테스트
```bash
node tests/parser.test.js
```


## 파서 안정화 메모
- DOM이 매물 단위로 잘리지 않는 화면에서는 컨테이너 전체 텍스트를 읽어 시작 패턴(매각기일/법원계/사건번호) 기준으로 매물 블록을 재분할한 뒤 파싱합니다.
- RAW가 `totalCount=0`으로 나오는 경우, 익스텐션 업데이트 후 페이지 새로고침(Ctrl+R) 뒤 다시 실행하세요.


## NORMALIZED 헤더
매각기일, 상대일자, 용도, 법원계, 사건번호, 물건기본내역, 소재지, 도로명주소, 건물㎡, 건물평, 평형표기, 토지㎡, 토지평, 특수조건, 감정가, 최저가, 가격3, 가격4, 상태, 비율, 조회수, 유찰회수, 추가정보
