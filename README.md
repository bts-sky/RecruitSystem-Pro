# RecruitSystem-Pro V1.0.14

## 이번 버전
- Google Apps Script 웹 앱 주소 연결 완료
- 최종 제출 데이터를 Google Sheets로 전송하는 기능 추가
- Google Apps Script 백엔드 파일 추가
- 전송 오류 시 재시도 안내
- 완료 화면에서 Google Sheets 연동 상태 표시

## Google Sheets 연결 순서
1. 새 Google 스프레드시트를 만듭니다.
2. 스프레드시트에서 `확장 프로그램 → Apps Script`를 엽니다.
3. `apps-script/Code.gs` 내용을 Apps Script의 `Code.gs`에 전체 붙여넣습니다.
4. `배포 → 새 배포 → 웹 앱`을 선택합니다.
5. 실행 사용자는 본인, 액세스 권한은 모든 사용자로 설정하여 배포합니다.
6. 발급된 `/exec` 주소를 복사합니다.
7. `js/config.js`의 `googleAppsScriptUrl` 따옴표 안에 주소를 붙여넣습니다.
8. GitHub에 전체 파일을 올린 후 배포 페이지에서 Ctrl+F5를 누릅니다.

## 주의
- Google Apps Script 주소가 비어 있어도 기존처럼 브라우저 접수 완료 화면은 작동합니다.
- 실제 Google Sheets 저장을 사용하려면 위 연결 작업이 반드시 필요합니다.
- 지원자의 개인정보를 수집하므로 Google 계정과 스프레드시트 공유 권한을 안전하게 관리하세요.

## 연결된 웹 앱 주소
- Google Sheets 저장용 Apps Script URL이 `js/config.js`에 적용되어 있습니다.
