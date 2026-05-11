# Carlife Admin - 온보딩 가이드

## 목차

- [프로젝트 개요](#프로젝트-개요)
- [기술 스택](#기술-스택)
- [프로젝트 구조](#프로젝트-구조)
- [핵심 기능](#핵심-기능)
- [데이터 흐름](#데이터-흐름)
- [인증 시스템](#인증-시스템)
- [API 통합](#api-통합)
- [Excel 연동](#excel-연동)
- [상태 관리](#상태-관리)
- [주요 유틸리티 함수](#주요-유틸리티-함수)
- [타입 정의](#타입-정의)
- [개발 환경 설정](#개발-환경-설정)
- [배포 및 빌드](#배포-및-빌드)
- [트러블슈팅](#트러블슈팅)

---

## 프로젝트 개요

**Carlife Admin**은 두 가지 서비스를 통합 관리하는 어드민 웹 애플리케이션입니다.

| 서비스      | 역할                                                                                                                                | 백엔드                           |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **Pickle**  | 상용 콘텐츠(에피소드·채널·큐레이션) 조회 및 Google Sheets 동기화<br>데모 콘텐츠(프로그램·에피소드·시리즈·테마·카테고리·방송사) CRUD | Pickle REST API + Supabase       |
| **Picknow** | Configuration 설정 데이터를 고객사별로 추출하여 Excel로 내보내기                                                                    | Picknow REST API + Google Sheets |

앱 진입 시 서비스를 선택하면 로그인·사이드바 메뉴·API 인스턴스가 해당 서비스에 맞게 분기됩니다.

---

## 기술 스택

| 영역          | 라이브러리                                       |
| ------------- | ------------------------------------------------ |
| UI            | React 19.1.1, Tailwind CSS 4.1.14                |
| 언어          | TypeScript 5.9.3                                 |
| 라우팅        | React Router 7.15.0                              |
| 상태 관리     | Zustand 5.0.8                                    |
| HTTP          | Axios 1.15.2 (prod / stg / picknow 3개 인스턴스) |
| DB (데모)     | @supabase/supabase-js 2.98.0                     |
| Google Sheets | googleapis, Google Identity Services             |
| 보안          | jsencrypt (Picknow RSA 암호화)                   |
| 빌드          | Vite 7.3.3, ESLint + Prettier                    |
| 가상화        | @tanstack/react-virtual                          |

---

## 프로젝트 구조

```
src/
├── feature/
│   ├── service-entry/        # 서비스 선택 진입 페이지
│   ├── login/                # PickleLogin / PicknowLogin
│   ├── pickle/
│   │   ├── production/       # 상용: episode / channel-book / curation
│   │   └── demo/             # 데모: program / episode / series / theme / category / broadcasting
│   └── picknow/              # Configuration 데이터 추출
│
├── components/
│   ├── common/               # AuthGuard, Button, Dropdown, Pagination 등
│   ├── demo/                 # 데모 공통 목록·상세 레이아웃
│   ├── filter/               # 시트 선택, 사용여부 필터
│   ├── form/                 # 폼 필드·레이아웃·탭
│   ├── language/             # 언어 뱃지·선택
│   ├── sync/                 # 동기화 툴바·카운트·빈 상태
│   └── table/                # 공통 테이블, 썸네일, 정렬
│
├── hook/                     # useListSort, usePagination, useStagingEnv 등
├── layout/                   # Header, Sidebar, Layout
├── lib/                      # supabase.ts
├── store/                    # useAccessTokenStore, useLoginTokenStore, useServiceStore
├── types/                    # type.ts (상용), demoContents.ts (데모), google.d.ts
├── constants/                # languages, sidebarMenus, picknowExcel
└── utils/
    ├── api/                  # api.ts (3 인스턴스), fetchAllData, requestPool 등
    ├── auth/                 # Google OAuth
    ├── excel/                # updateExcel, syncNewEpisodes, updateLogs 등
    ├── format/               # formatDateString, formatPlayTime 등
    └── googleSheets/         # Picknow Configuration 관련
```

---

## 핵심 기능

### Pickle — 상용 콘텐츠 관리

| 기능           | 경로                 | 설명                                                      |
| -------------- | -------------------- | --------------------------------------------------------- |
| 에피소드 관리  | `/episode-list`      | 신규 데이터 조회·중복 탐지·Google Sheets 동기화·상세 열람 |
| 채널/도서 관리 | `/channel-book-list` | 채널 목록 조회·최신 에피소드 업로드일 추적·동기화         |
| 큐레이션 관리  | `/curation-list`     | 전시 기간별 큐레이션 조회·에피소드 연결·동기화            |
| 검증 환경      | `/stg/*`             | 위 3가지 기능을 검증(Staging) 서버 기준으로 별도 운영     |

### Pickle — 데모 콘텐츠 관리 (Supabase CRUD)

| 기능     | 경로                 |
| -------- | -------------------- |
| 프로그램 | `/demo/program`      |
| 에피소드 | `/demo/episode`      |
| 시리즈   | `/demo/series`       |
| 테마     | `/demo/theme`        |
| 카테고리 | `/demo/category`     |
| 방송사   | `/demo/broadcasting` |

각 모듈은 목록·추가·수정·상세 페이지를 제공하며, 다국어(`language[]`)·활성 여부(`is_active`)·검색 가능 여부(`is_searchable`) 필드를 지원합니다.

### Picknow — Configuration 추출

**경로**: `/picknow/excel-sync`

Google Sheets에서 Picknow Configuration 데이터를 읽어 고객사(디바이스)별로 필터링한 뒤 Excel 파일로 내보냅니다.

---

## 데이터 흐름

<details>
<summary>Pickle 상용 — 에피소드 신규 데이터 동기화</summary>

```
사용자 액션: "새로운 에피소드 검색" 버튼 클릭
    ↓
[getNewDataWithExcel() 실행]
    ↓
├─ Pickle API 호출
│  └─ GET /admin/episode?page={page}&size={size}
│     └─ 페이지 단위로 전체 에피소드 조회
│
├─ Google Sheets 데이터 읽기
│  └─ getExcelData("Episode", "episode")
│     └─ 기존 Excel 데이터 배치 읽기 (범위: B4:M{lastRow})
│
└─ 데이터 비교 및 필터링
   ├─ Excel에서 최대 episodeId 추출
   ├─ API 데이터에서 새 데이터만 필터링 (id > maxId)
   └─ findUpdateData()로 변경 사항 탐지
    ↓
[UI에 새 데이터 표시]
    ↓
사용자 액션: "Excel 동기화" 버튼 클릭
    ↓
[syncNewDataToExcel() 실행]
    ↓
├─ 기존 Excel 데이터 읽기
├─ 새 데이터 병합
├─ 중복 제거 (episodeId 기준)
└─ overwriteExcelData()로 전체 덮어쓰기
    ↓
├─ findChangedData()로 중복 에피소드 탐지
└─ syncNewDuplicateDataToExcel()로 Episode_Logs 시트에 기록
    ↓
[완료: 토스트 알림 표시]
```

</details>

<details>
<summary>Pickle 상용 — 전체 에피소드 변환</summary>

```
사용자 액션: "전체 에피소드 시트로 변환" 버튼 클릭
    ↓
[fetchAllData() 실행]
    ↓
├─ Pickle API에서 전체 에피소드 조회 (페이지 크기: 10,000)
├─ 진행률 추적 (totalPages, currentPage)
└─ 모든 페이지 데이터 수집
    ↓
[findChangedData() 실행]
    ↓
├─ 에피소드명 기준으로 중복 탐지
└─ 중복 에피소드 목록 생성
    ↓
[addMissingRows() 실행]
    ↓
├─ 기존 Excel 데이터 읽기
├─ 누락된 에피소드 식별 (episodeId 비교)
└─ 배치 단위(10,000행)로 Google Sheets에 추가
    ↓
└─ 중복 에피소드를 Episode_Logs 시트에 추가
    ↓
[완료: 토스트 알림 표시]
```

</details>

<details>
<summary>Pickle 상용 — 채널 최신 에피소드 업로드일 조회</summary>

```
사용자 액션: "채널 최신 에피소드 업로드일 조회" 버튼 클릭
    ↓
[fetchAllData() 실행 - 채널 모드]
    ↓
├─ Pickle API에서 전체 채널 조회
│  └─ GET /admin/channel?page={page}&size={size}
│
└─ 각 채널별로 최신 에피소드 조회
   └─ GET /admin/channel/{channelId}/episode?page=1&size=1
      ├─ AbortSignal로 취소 가능
      ├─ 진행률 실시간 표시
      └─ dispDtime (최신 에피소드 업로드일) 추출
    ↓
[UI에 채널 데이터 표시]
    ↓
사용자 액션: "전체 채널 시트로 변환" 버튼 클릭
    ↓
[addMissingRows() 실행]
    ↓
├─ 기존 Channel 시트 데이터 읽기
├─ 누락된 채널 식별
└─ Google Sheets에 배치 추가
    ↓
[완료: 토스트 알림 표시]
```

</details>

<details>
<summary>Picknow — Configuration 추출</summary>

```
사용자 액션: Google Sheets 로그인
    ↓
[fetchSettingData() 실행]
    ↓
└─ Google Sheets에서 Configuration 시트 전체 읽기
    ↓
[UI에 데이터 표시 및 고객사(디바이스) 선택]
    ↓
사용자 액션: 고객사 선택 후 "추출" 버튼 클릭
    ↓
[syncPicknowConfigurationSheet() 실행]
    ↓
├─ 선택된 고객사 기준으로 데이터 필터링
└─ Excel 파일로 내보내기
    ↓
[완료: 파일 다운로드]
```

</details>

---

## 인증 시스템

| 인증           | 대상        | 방식                                                                 |
| -------------- | ----------- | -------------------------------------------------------------------- |
| Pickle 로그인  | Pickle API  | ID/PW → JWT (accessToken + refreshToken), 만료 시 Supabase 세션 폴백 |
| Picknow 로그인 | Picknow API | ID/PW → RSA 암호화(`jsencrypt`) 후 전송 → JWT                        |
| Google Sheets  | Sheets API  | OAuth 2.0 팝업, 만료 시 `acquireTokenSilently()`로 자동 갱신         |

<details>
<summary>Pickle / Picknow 관리자 로그인 흐름</summary>

```
1. 로그인 페이지에서 ID/PW 입력
   ↓
2. POST {API_URL}/admin/login
   - Pickle:  { id, password }
   - Picknow: { id, password: RSA암호화(password) }
   ↓
3. 응답으로 토큰 수신
   { accessToken, refreshToken }
   ↓
4. localStorage 및 Zustand 스토어에 저장
   - useAccessTokenStore.setAccessToken()
   ↓
5. /episode-list (Pickle) 또는 /picknow/excel-sync (Picknow) 로 리다이렉트
```

**토큰 갱신**: 응답 `resultCode === 'E0123'` 감지 → `POST /admin/reissue` → 실패 시 로그아웃.
Pickle은 갱신 실패 시 Supabase 세션(`supabase.auth.getSession()`)으로 추가 폴백.

</details>

<details>
<summary>Google Sheets OAuth 2.0 흐름</summary>

```
[초기화] Header 컴포넌트 마운트 시
    ↓
initializeGoogleAPI() 실행
    ↓
├─ gapi.client.init() 호출
├─ google.accounts.oauth2.initTokenClient() 설정
│  └─ scope: https://www.googleapis.com/auth/spreadsheets
└─ localStorage의 "googleAccessToken" 확인 → 존재 시 자동 복원

[로그인] "Google Sheets 로그인" 버튼 클릭
    ↓
login() 실행 → OAuth 팝업 표시
    ↓
사용자 동의 후 토큰 수신
    ↓
localStorage + useLoginTokenStore.setToken() 저장
    ↓
gapi.client.setToken() 호출

[자동 갱신] Google Sheets API 호출 시 401 발생
    ↓
acquireTokenSilently() 실행
    ↓
tokenClient.requestAccessToken({ prompt: '' })
    ↓
새 토큰 발급 (사용자 상호작용 없음) → 저장 → 요청 재시도
```

</details>

---

## API 통합

### Axios 인스턴스 ([src/utils/api/api.ts](src/utils/api/api.ts))

| 인스턴스     | 환경 변수              | 용도             |
| ------------ | ---------------------- | ---------------- |
| `api`        | `VITE_PROD_API_URL`    | Pickle 상용 서버 |
| `stgApi`     | `VITE_STG_API_URL`     | Pickle 검증 서버 |
| `picknowApi` | `VITE_PICKNOW_API_URL` | Picknow 서버     |

`useStagingEnv()` 훅이 현재 경로(`/stg/*` 여부)에 따라 `api` / `stgApi`를 자동 선택합니다.

### 주요 엔드포인트

| Method | Endpoint                      | 설명                           |
| ------ | ----------------------------- | ------------------------------ |
| POST   | `/admin/login`                | 로그인                         |
| POST   | `/admin/reissue`              | 토큰 갱신                      |
| GET    | `/admin/episode`              | 에피소드 목록 (`page`, `size`) |
| GET    | `/admin/episode/{id}`         | 에피소드 상세                  |
| GET    | `/admin/channel`              | 채널 목록                      |
| GET    | `/admin/channel/{id}/episode` | 채널별 에피소드                |
| GET    | `/admin/curation`             | 큐레이션 목록                  |
| GET    | `/admin/curation/{id}`        | 큐레이션 상세                  |

---

## Excel 연동

Google Sheets를 Excel처럼 활용하며, 최대 300,000행을 10,000행 배치 단위로 읽고 씁니다.

### 에피소드 시트 컬럼

| 열  | 필드        | 열  | 필드         |
| --- | ----------- | --- | ------------ |
| B   | episodeId   | H   | playTime     |
| C   | usageYn     | I   | likeCnt      |
| D   | channelName | J   | listenCnt    |
| E   | episodeName | K   | thumbnailUrl |
| F   | dispDtime   | L   | audioUrl     |
| G   | createdAt   | M   | channelId    |

### 채널 시트 컬럼

| 열  | 필드            | 열  | 필드                      |
| --- | --------------- | --- | ------------------------- |
| B   | channelId       | I   | categoryName              |
| C   | interfaceUrl    | J   | vendorName                |
| D   | usageYn         | K   | likeCnt                   |
| E   | channelName     | L   | listenCnt                 |
| F   | channelTypeName | M   | createdAt                 |
| G   | interfaceType   | N   | dispDtime (최신 업로드일) |
| H   | categoryId      | O   | thumbnailUrl              |

#### 큐레이션 시트

| 열  | 필드명              | 설명                                                                                                                                                    |
| --- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B-K | 큐레이션 메타데이터 | thumbnailTitle, field, section, activeState, exhibitionState, curationType, curationName, curationDesc, dispStartDtime, dispEndDtime, curationCreatedAt |
| L-W | 에피소드 정보       | channelId, episodeId, usageYn, channelName, episodeName, dispDtime, createdAt, playTime, likeCnt, listenCnt, thumbnailUrl, audioUrl                     |

---

## 상태 관리

| 스토어                | 파일                                                             | 역할                                     |
| --------------------- | ---------------------------------------------------------------- | ---------------------------------------- |
| `useAccessTokenStore` | [store/useAccessTokenStore.ts](src/store/useAccessTokenStore.ts) | Pickle/Picknow API JWT 토큰              |
| `useLoginTokenStore`  | [store/useLoginTokenStore.ts](src/store/useLoginTokenStore.ts)   | Google Sheets OAuth 토큰                 |
| `useServiceStore`     | [store/useServiceStore.ts](src/store/useServiceStore.ts)         | 선택된 서비스(`'pickle'` \| `'picknow'`) |

`useServiceStore`의 `selectedService` 값에 따라 사이드바 메뉴, 로그인 경로, API 인스턴스가 분기됩니다.

---

## 주요 유틸리티 함수

| 파일                                                                               | 주요 함수                                              | 역할                                           |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------- |
| [utils/excel/updateExcel.ts](src/utils/excel/updateExcel.ts)                       | `getExcelData`, `addMissingRows`, `overwriteExcelData` | Google Sheets 배치 읽기/쓰기 핵심              |
| [utils/excel/updateLogs.ts](src/utils/excel/updateLogs.ts)                         | `findChangedData`, `findUpdateData`                    | 중복 탐지 및 변경 데이터 추출                  |
| [utils/excel/syncNewEpisodesToExcel.ts](src/utils/excel/syncNewEpisodesToExcel.ts) | `syncNewDataToExcel`, `syncNewDuplicateDataToExcel`    | 신규 에피소드 동기화·로그 기록                 |
| [utils/api/api.ts](src/utils/api/api.ts)                                           | `api`, `stgApi`, `picknowApi`                          | Axios 인스턴스 (토큰 인터셉터 포함)            |
| [utils/api/fetchAllData.ts](src/utils/api/fetchAllData.ts)                         | `fetchAllData`                                         | 페이지 단위 전체 데이터 수집                   |
| [utils/auth/auth.ts](src/utils/auth/auth.ts)                                       | `initializeGoogleAPI`, `login`, `acquireTokenSilently` | Google OAuth 초기화·로그인·갱신                |
| [hook/useStagingEnv.ts](src/hook/useStagingEnv.ts)                                 | `useStagingEnv`                                        | 경로 기반 stg/prod API·SpreadsheetId 자동 선택 |

---

## 타입 정의

| 파일                                                         | 주요 타입                                                                                                               |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| [src/types/type.ts](src/types/type.ts)                       | `usingDataProps` (에피소드), `usingChannelProps` (채널), `usingCurationExcelProps` (큐레이션), `curationDetailProps` 등 |
| [src/types/demoContents.ts](src/types/demoContents.ts)       | `Program`, `Episode`, `Series`, `Theme`, `Category`, `Broadcasting` (Supabase 테이블 대응)                              |
| [src/store/useServiceStore.ts](src/store/useServiceStore.ts) | `ServiceType = 'pickle' \| 'picknow'`                                                                                   |

---

## 개발 환경 설정

### 설치 및 실행

```bash
npm install
npm run dev      # 개발 서버 (포트 5173)
npm run build    # 프로덕션 빌드
npm run preview  # 빌드 결과 미리보기
npm run lint     # ESLint 검사
```

### 환경 변수 (.env)

```env
# Pickle API
VITE_PROD_API_URL=
VITE_STG_API_URL=

# Picknow API
VITE_PICKNOW_API_URL=

# Google Sheets
VITE_SPREADSHEET_ID=
VITE_STG_SPREADSHEET_ID=
VITE_GOOGLE_CLIENT_ID=
VITE_GOOGLE_API_KEY=

# Supabase (데모 콘텐츠)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# 어드민 바로가기
VITE_ADMIN_EPI_URL=
VITE_ADMIN_EPI_URL_STG=
VITE_PICKNOW_ADMIN_EPI_URL_STG=
```

---

## 배포 및 빌드

```bash
npm run build   # dist/ 생성
```

**배포 체크리스트**

1. 프로덕션 `.env` 값 설정 및 Google OAuth 승인 도메인 추가
2. Supabase 허용 URL에 프로덕션 도메인 추가
3. Pickle/Picknow API 서버에서 CORS 허용 도메인 확인
4. `dist/` 폴더를 Vercel / Netlify 등 정적 호스팅에 배포

---

## 트러블슈팅

| 증상                             | 원인                                                  | 해결                                                            |
| -------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------- |
| Google Sheets 로그인 팝업 미표시 | 팝업 차단 또는 `VITE_GOOGLE_CLIENT_ID` 오류           | 팝업 허용 설정, `.env` 및 Google Cloud Console 승인 도메인 확인 |
| Excel 읽기 401                   | Google 토큰 만료                                      | 재로그인 또는 `acquireTokenSilently()` 동작 확인                |
| Pickle API E0123 반복            | 리프레시 토큰 만료                                    | 로그아웃 후 재로그인                                            |
| 스테이징 데이터가 상용과 같음    | `VITE_STG_API_URL` / `VITE_STG_SPREADSHEET_ID` 미설정 | `.env` 검증 환경 변수 확인                                      |
| 배치 쓰기 일부 누락              | Sheets API 할당량 초과                                | Google Cloud Console 할당량 확인, `BATCH_SIZE` 조정             |
| Supabase 데이터 조회 실패        | URL/키 오류 또는 RLS 정책                             | `.env` 확인 및 Supabase 대시보드 RLS 정책 점검                  |
| Picknow 로그인 실패              | RSA 공개키 불일치 또는 API URL 오류                   | `PicknowLogin.tsx` 공개키, `VITE_PICKNOW_API_URL` 확인          |
