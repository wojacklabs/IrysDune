// API 테스트 스크립트
// 사용법: node test-api.js [wallet-address]

const https = require('https');

const address = process.argv[2] || 'YOUR_WALLET_ADDRESS_HERE';
const localUrl = `http://localhost:3000/api/irys-challenge?address=${address}`;
const prodUrl = `https://irys-dune.vercel.app/api/irys-challenge?address=${address}`;

console.log('🔍 Testing Irys Challenge API...');
console.log(`📍 Wallet Address: ${address}`);
console.log(`📅 Today (UTC): ${new Date().toISOString().split('T')[0]}`);
console.log(`🕐 Current time: ${new Date().toISOString()}`);

// 로컬 테스트
fetch(localUrl)
  .then(res => res.json())
  .then(data => {
    console.log(`\n✅ Local Response: ${data}`);
    if (data === 1) {
      console.log('   → 오늘의 Dashboard 챌린지 완료! ✨');
    } else if (data === 0) {
      console.log('   → 오늘 아직 Dashboard를 작성하지 않았습니다');
    } else {
      console.log('   → Error:', data);
    }
  })
  .catch(err => {
    console.log('\n❌ Local test failed:', err.message);
    console.log('   → Vercel dev server가 실행 중인지 확인하세요');
  });

// 프로덕션 테스트 (옵션)
if (process.argv[3] === '--prod') {
  fetch(prodUrl)
    .then(res => res.json())
    .then(data => {
      console.log(`\n✅ Production Response: ${data}`);
      if (data === 1) {
        console.log('   → 오늘의 Dashboard 챌린지 완료! ✨');
      } else if (data === 0) {
        console.log('   → 오늘 아직 Dashboard를 작성하지 않았습니다');
      } else {
        console.log('   → Error:', data);
      }
    })
    .catch(err => {
      console.log('\n❌ Production test failed:', err.message);
    });
} 