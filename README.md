# Interactive Manual Maker (IMM)

이미지와 텍스트가 유기적으로 연결된 고품질 매뉴얼을 웹상에서 쉽게 작성, 관리하고 링크 하나로 배포하는 플랫폼.

## 기술 스택

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Auth**: NextAuth.js (Google Provider)
- **Database**: PostgreSQL (Prisma ORM)
- **Storage**: Vercel Blob (이미지 저장)
- **State Management**: Zustand / Jotai
- **Markdown**: react-markdown

## 시작하기

```bash
# 의존성 설치
bun install

# 환경 변수 설정
cp .env.example .env.local

# 데이터베이스 마이그레이션
bun run db:push

# 개발 서버 실행
bun run dev
```

## 환경 변수

`.env.local` 파일에 다음 변수들을 설정해야 합니다:

- `DATABASE_URL`: PostgreSQL 연결 문자열 (예: `postgresql://user:password@localhost:5432/imm?schema=public`)
- `AUTH_URL` 또는 `NEXTAUTH_URL`: 애플리케이션 URL (예: `http://localhost:3000`)
- `AUTH_SECRET` 또는 `NEXTAUTH_SECRET`: NextAuth 시크릿 키 (최소 32자)
- `GOOGLE_CLIENT_ID`: Google OAuth 클라이언트 ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth 클라이언트 시크릿
- `BLOB_READ_WRITE_TOKEN`: Vercel Blob 토큰

