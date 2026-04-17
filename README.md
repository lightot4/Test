# GG Auction to Sheets (MVP)

지지옥션 결과 화면에서 실제 매물 블록만 파싱해 Google Spreadsheet에 적재하는 크롬 익스텐션 + Apps Script 샘플입니다.

## 구성 파일
- `manifest.json`: MV3 설정
- `popup.html`, `popup.js`: 버튼 UI와 실행 제어
- `parser.js`: 매물 블록 정규화 파서(헤더/광고/스크립트 제외, 스키마 매핑)
- `content.js`: 매물 컨테이너 범위 추출 + 페이지 이동
- `service-worker.js`: 페이지 순회/중복제거/전송
- `Code.gs`: Apps Script Web App 수신 및 시트 적재
- `tests/parser.test.js`: 샘플 fixture 기반 파싱 회귀 테스트

## 핵심 파싱 규칙
- 시작 패턴: `매각기일 / (상대일자) / 용도 / 법원계 / 사건번호`
- 제외: 검색조건/광고/UI/script/footer 및 빈 블록
- 복수물건: `2024-1933[1]`, `[2]`를 각각 별도 물건으로 유지
- 특수조건: 대괄호 조건을 `|`로 정규화
- 도로명주소: `[]` 안 도로명 패턴 분리
- 추가정보: `·` 목록을 `|`로 정규화

## 설치
1. 이 폴더를 로컬로 복사
2. 크롬에서 `chrome://extensions` 접속
3. 개발자 모드 활성화
4. "압축해제된 확장 프로그램을 로드"로 본 폴더 선택

## 테스트
```bash
node tests/parser.test.js
```
