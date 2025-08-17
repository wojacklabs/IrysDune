# IrysDune

Irys 생태계 분석 대시보드 - Dune Analytics와 같은 스타일의 데이터 분석 도구

## 🔒 보안 정보

IrysDune은 **읽기 전용 분석 플랫폼**입니다:
- ❌ 개인키나 시드 문구를 **절대** 요구하지 않습니다
- ✅ 모든 스마트 컨트랙트 상호작용은 투명하게 공개됩니다
- ✅ NFT 민팅은 공식 Irys 테스트넷 컨트랙트를 통해서만 이루어집니다
- ✅ 지갑 연결은 읽기 전용 데이터 조회에만 사용됩니다

**주의**: 일부 기능(뱃지 민팅, 대시보드 생성)은 0.1 IRYS의 수수료가 필요합니다

## 🚀 기능

### 📈 트렌드 섹션
- Irys에서 미리 지정된 태그를 GraphQL로 카운트하여 숫자를 기반으로 앱별 활성화 그래프 표시
- 앱별로 미리 preset을 지정해두고 해당 preset을 기반으로 쿼리
- 하나의 차트에 모든 앱을 그려주며, 원하는 앱만 선택 가능
- 일반형/누적형 차트 선택 (기본값: 누적형)

### 🔍 쿼리 섹션
- 원하는 태그를 직접 지정하여 preset을 여러개 만들어 직접 그래프 생성 (Dune처럼)
- 쿼리하는 동안 로딩 퍼센트로 진행상황 표시
- 만들어진 그래프는 트위터 공유 가능 (캡쳐 기능 지원)

## 🛠️ 기술 스택

- **React 19** + **TypeScript** - UI 프레임워크
- **Vite** - 빌드 도구
- **Tailwind CSS** - 스타일링
- **Chart.js** + **react-chartjs-2** - 차트 렌더링
- **Axios** - HTTP 클라이언트 (GraphQL 쿼리)
- **Lucide React** - 아이콘
- **dom-to-image-more** + **html2canvas** - 차트 캡쳐

## 🚀 시작하기

### 설치

```bash
npm install
```

### 개발 서버 시작

```bash
npm run dev
```

### 빌드

```bash
npm run build
```

### 미리보기

```bash
npm run preview
```

## 📊 지원하는 앱 Presets

1. **CM Note** - Irys 기반 노트 앱
2. **GitHirys** - GitHub와 연동된 Irys 앱
3. **Arweave Files** - 파일 저장 앱
4. **NFT Metadata** - NFT 메타데이터
5. **Social Posts** - 소셜 미디어 포스트
6. **Atomic Assets** - 원자적 자산
7. **Permacast** - 영구 팟캐스트
8. **ArConnect** - Arweave 연결 도구

## 🔗 Vercel 배포

이 프로젝트는 Vercel에 배포할 수 있도록 설정되어 있습니다:

1. GitHub에 저장소 푸시
2. Vercel에서 프로젝트 import
3. 자동으로 빌드 및 배포

## 📱 기능

### 차트 캡쳐 및 공유
- 차트를 PNG로 캡쳐
- 클립보드에 복사 후 트위터 공유
- 실패시 자동으로 다운로드 fallback

### 커스텀 쿼리
- 태그 이름과 값을 직접 지정
- 여러 태그 조합 쿼리
- 색상 선택 가능
- 쿼리 저장 및 관리

### 반응형 디자인
- 모바일 및 데스크톱 지원
- 터치 친화적 인터페이스

## 🔧 API

Irys GraphQL API를 사용합니다:
- **Endpoint**: `https://uploader.irys.xyz/graphql`
- **쿼리**: 태그 기반 트랜잭션 검색
- **데이터 처리**: 일별 집계 및 시각화

## 📄 라이센스

MIT License

## 🔌 API 엔드포인트

### Irys Challenge API

매일 Dashboard 작성 챌린지 완료 여부를 확인하는 API입니다. (Daily Challenge)

**Endpoint:**
```
GET /api/irys-challenge?address=WALLET_ADDRESS
```

**Parameters:**
- `address` (required): 확인할 지갑 주소

**Response:**
- `1`: 챌린지 완료 (오늘 dashboard를 작성함)
- `0`: 챌린지 미완료 (오늘 dashboard를 작성하지 않음)

**Example:**
```bash
# 챌린지 완료 확인
curl https://your-domain.vercel.app/api/irys-challenge?address=0x1234...

# 로컬 테스트
vercel dev  # 다른 터미널에서 실행
curl http://localhost:3000/api/irys-challenge?address=0x1234...
```

**테스트:**
```bash
# 테스트 스크립트 실행
node test-api.js YOUR_WALLET_ADDRESS

# 프로덕션 테스트 포함
node test-api.js YOUR_WALLET_ADDRESS --prod
```

**Note:** 
- **매일 챌린지**: UTC 기준 당일(00:00-23:59)에 생성된 dashboard만 인정됩니다
- Dashboard 작성은 edit을 제외한 새로운 dashboard 생성만 카운트됩니다
- 결과는 JSON 형식으로 반환됩니다 (1 또는 0)
- 시간대는 UTC 기준이므로 한국 시간으로는 오전 9시에 날짜가 바뀝니다

## 🤝 기여

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
