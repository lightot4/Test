# GG Auction to Sheets (MVP)

지지옥션 결과 화면에서 매물 정보를 수집해, 정리 후 Google Spreadsheet에 적재하는 크롬 익스텐션 + Apps Script 샘플입니다.

## 구성 파일
- `manifest.json`: MV3 설정
- `popup.html`, `popup.js`: 버튼 UI와 실행 제어
- `content.js`: 페이지 DOM에서 매물 목록 추출 + `.pagenation` 기반 다음 페이지 이동
- `service-worker.js`: 페이지 순회/중복제거/전송
- `Code.gs`: Apps Script Web App 수신 및 시트 적재

## 설치
1. 이 폴더를 로컬로 복사
2. 크롬에서 `chrome://extensions` 접속
3. 개발자 모드 활성화
4. "압축해제된 확장 프로그램을 로드"로 본 폴더 선택

## Apps Script 설정
1. 스프레드시트에서 `확장 프로그램 > Apps Script` 열기
2. `Code.gs` 내용 붙여넣기
3. `배포 > 새 배포 > 웹 앱`
4. 실행 사용자: 본인, 접근 권한: 링크 있는 모든 사용자(또는 조직 정책에 맞게)
5. 발급된 Web App URL을 익스텐션에 입력 후 저장

## 사용
1. 지지옥션 검색결과 페이지를 연다
2. 익스텐션 팝업에서 수집 범위를 선택
3. `수집 시작` 클릭
4. 완료 후 시트의 `RAW`, `NORMALIZED` 탭 확인

## 페이지 순회 방식 (현재 구현)
- 현재 페이지: `.pagenation .selecPg`
- 다음 페이지 우선순위
  1. `.pagenation .pagenav` 중 `onclick="submit_page('현재+1')"`
  2. `.pagenation .pagenav`의 `>` 버튼
  3. `.page-direct` 입력 + `이동` 버튼
- URL이 바뀌지 않는 AJAX 페이지도 지원하도록, 페이지 번호 + 첫 물건 키 기준으로 실제 페이지 변경을 확인합니다.

## 주의
- 본 MVP는 페이지 DOM 구조 변화에 민감합니다.
- 사이트 이용약관, robots 정책, 법적 제한을 반드시 확인하세요.
- 테이블 컬럼명이 달라지면 `content.js` 추출 규칙을 사이트 구조에 맞게 보정하세요.
