// API 테스트 스크립트 (ES Module)
// 사용법: node test-api.mjs [wallet-address]

const address = process.argv[2] || 'YOUR_WALLET_ADDRESS_HERE';
const localUrl = `http://localhost:3000/api/irys-challenge?address=${address}`;
const prodUrl = `https://irys-dune.vercel.app/api/irys-challenge?address=${address}`;

console.log('🔍 Testing Irys Challenge API...');
console.log(`📍 Wallet Address: ${address}`);
console.log(`📅 Today (UTC): ${new Date().toISOString().split('T')[0]}`);
console.log(`🕐 Current time: ${new Date().toISOString()}`);

// 로컬 테스트
if (!process.argv.includes('--prod-only')) {
  fetch(localUrl)
    .then(res => res.text())
    .then(data => {
      console.log(`\n✅ Local Response: ${data}`);
      try {
        const jsonData = JSON.parse(data);
        if (jsonData === 1) {
          console.log('   → 오늘의 Dashboard 챌린지 완료! ✨');
        } else if (jsonData === 0) {
          console.log('   → 오늘 아직 Dashboard를 작성하지 않았습니다');
        } else {
          console.log('   → Response:', data);
        }
      } catch (e) {
        console.log('   → Raw response:', data);
      }
    })
    .catch(err => {
      console.log('\n❌ Local test failed:', err.message);
      console.log('   → Vercel dev server가 실행 중인지 확인하세요');
    });
}

// 프로덕션 테스트
if (process.argv.includes('--prod') || process.argv.includes('--prod-only')) {
  console.log(`\n🌐 Testing production: ${prodUrl}`);
  
  fetch(prodUrl)
    .then(async res => {
      const text = await res.text();
      console.log(`\n📡 Production Status: ${res.status}`);
      console.log(`📄 Response Headers:`, Object.fromEntries(res.headers.entries()));
      console.log(`📦 Response Body: ${text}`);
      
      if (res.ok) {
        try {
          const jsonData = JSON.parse(text);
          if (jsonData === 1) {
            console.log('   → 오늘의 Dashboard 챌린지 완료! ✨');
          } else if (jsonData === 0) {
            console.log('   → 오늘 아직 Dashboard를 작성하지 않았습니다');
          } else {
            console.log('   → Unexpected response:', jsonData);
          }
        } catch (e) {
          console.log('   → Failed to parse JSON:', e.message);
        }
      } else {
        console.log('   → Server error detected');
      }
    })
    .catch(err => {
      console.log('\n❌ Production test failed:', err.message);
      console.log('   → Error details:', err);
    });
} 