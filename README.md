# RecruitSystem-Pro V1.0.16-1

## 추가 기능
- `/admin/` 관리자 로그인 화면
- Google Sheets `지원자관리` 시트 조회
- 이름·연락처·접수번호 검색
- 처리상태 필터
- 모바일 관리자 화면

## 최초 관리자 비밀번호
Apps Script `Code.gs` 상단의 아래 값을 원하는 비밀번호로 변경하세요.

```javascript
const ADMIN_PASSWORD = '하늘2026';
```

## 업데이트 순서
1. 프로젝트 파일 전체를 기존 로컬 폴더에 덮어쓰기
2. GitHub Desktop에서 Commit 후 Push origin
3. Google Apps Script의 `Code.gs`를 새 파일 내용으로 전체 교체
4. 저장 후 기존 웹 앱 배포를 새 버전으로 업데이트
5. 웹 앱 주소에서 `version: 1.0.16-1` 확인
6. GitHub Pages 주소 뒤에 `/admin/`을 붙여 관리자 페이지 접속

## 주의
- 이번 단계는 조회·검색 전용입니다. 처리상태와 메모 수정은 V1.0.16-2에서 추가합니다.
- 비밀번호는 URL 요청에 사용되므로 공용 PC에서 사용 후 반드시 로그아웃하세요.

---

# RecruitSystem-Pro V1.0.15

## 이번 버전

- Google Sheets 관리용 시트를 `지원자관리`로 정리
- 개발용 컬럼명을 실제 한글 항목명으로 변경
- 접수일시를 한국시간 형식으로 저장
- 처리상태 기본값 `신규` 추가
- 처리상태 드롭다운 추가: 신규 / 연락완료 / 면접예정 / 합격 / 불합격
- 담당자 메모 컬럼 추가
- 기존 `지원자목록` 테스트 자료 자동 이전
- 시트 제목행 고정, 필터, 기본 너비 적용
- 기존 날짜 입력 방식 유지 및 검증

## 중요한 적용 순서

1. 이 폴더 전체를 GitHub 저장소에 덮어쓰기 후 Commit / Push
2. Google Apps Script의 기존 `Code.gs` 내용을 `apps-script/Code.gs` 내용으로 전부 교체
3. 저장 후 함수 목록에서 `initializeV1015`를 선택해 한 번 실행
4. 배포 → 배포 관리 → 수정 → 새 버전 → 배포
5. 테스트 지원서 1건 제출
6. 스프레드시트의 `지원자관리` 탭 확인

지원자용 주소는 계속 동일합니다.

https://bts-sky.github.io/RecruitSystem/
