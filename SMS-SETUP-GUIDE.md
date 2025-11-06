# SMS 발송 설정 가이드

## 📂 파일 구조

프로젝트 루트에 다음과 같이 파일을 배치하세요:

```
your-project/
├── api/
│   └── send-sms.js          ← Vercel Serverless Function
├── src/
│   └── components/
│       └── admin/
│           └── NotificationManager.jsx
├── .env                      ← 환경변수 설정
└── vercel.json              ← Vercel 설정 (선택사항)
```

## 🔧 설정 방법

### 1. api 폴더 생성

프로젝트 **루트 디렉토리**에 `api` 폴더를 만들고, `send-sms.js` 파일을 넣으세요.

```
your-project/
├── api/              ← 여기!
│   └── send-sms.js
```

### 2. 환경변수 설정

#### 로컬 개발 (.env 파일)

프로젝트 루트에 `.env` 파일을 만들고 다음 내용을 추가:

```env
VITE_ALIGO_API_KEY=your_api_key
VITE_ALIGO_USER_ID=your_user_id
VITE_ALIGO_SENDER=your_sender_number
```

#### Vercel 배포 환경

Vercel 대시보드에서 환경변수 설정:

1. Vercel 프로젝트 선택
2. Settings → Environment Variables
3. 다음 3개 변수 추가:
   - `VITE_ALIGO_API_KEY`
   - `VITE_ALIGO_USER_ID`
   - `VITE_ALIGO_SENDER`

### 3. 파일 교체

- `NotificationManager.jsx` → `src/components/admin/NotificationManager.jsx`

### 4. 배포

```bash
git add .
git commit -m "SMS 발송 기능 수정"
git push
```

Vercel이 자동으로 배포합니다!

## 🧪 테스트

1. **로컬 테스트:**
   ```bash
   npm run dev
   ```
   - 로컬에서는 `/api/send-sms` 경로로 요청이 가지 않을 수 있습니다.
   - **실제 테스트는 Vercel 배포 후 진행하세요.**

2. **Vercel 배포 후:**
   - 알림 발송 탭에서 SMS 발송 테스트
   - 콘솔에서 발송 결과 확인

## ⚠️ 주의사항

1. **api 폴더 위치**: 반드시 프로젝트 **루트**에 있어야 합니다.
2. **환경변수**: Vercel에서 환경변수를 설정하지 않으면 SMS가 발송되지 않습니다.
3. **Aligo 충전**: Aligo 계정에 충분한 잔액이 있는지 확인하세요.

## 🔍 문제 해결

### SMS가 발송되지 않을 때

1. **환경변수 확인**
   - Vercel 대시보드 → Environment Variables 확인

2. **Aligo 설정 확인**
   - API 키가 올바른지 확인
   - 발신번호가 등록되어 있는지 확인
   - 잔액이 충분한지 확인

3. **콘솔 확인**
   - 브라우저 개발자 도구에서 에러 메시지 확인

4. **Vercel 로그 확인**
   - Vercel 대시보드 → Deployments → 최근 배포 → Functions 탭

## 📞 지원

문제가 계속되면 Vercel Functions 로그를 확인하거나 Aligo 고객센터에 문의하세요.
