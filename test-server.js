const puppeteer = require('puppeteer');
const fs = require('fs');
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const BASE = 'https://agency-os-topaz.vercel.app';

const results = [];
const addResult = (category, item, ok, detail) => {
  results.push({ category, item, ok, detail });
};

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    // ═══════════════════════════════════════
    // 1. 로그인 테스트
    // ═══════════════════════════════════════
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 15000 });
    const loginFormExists = !!(await page.$('input[type="email"]'));
    addResult('로그인', '로그인 폼 렌더링', loginFormExists, '이메일/비밀번호 입력창');
    const loginBtnExists = !!(await page.$('button[type="submit"]'));
    addResult('로그인', '로그인 버튼 렌더링', loginBtnExists, '제출 버튼');

    await page.type('input[type="email"]', 'admin@agency.com');
    await page.type('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
    await wait(3000);
    const loginUrl = page.url();
    addResult('로그인', '인증 성공 및 리다이렉트', loginUrl.includes('/dashboard'), loginUrl);

    if (!loginUrl.includes('/dashboard')) {
      console.log('로그인 실패 — 테스트 중단');
      fs.writeFileSync('test-detail-results.json', JSON.stringify(results, null, 2));
      await browser.close();
      return;
    }

    // ═══════════════════════════════════════
    // 2. 대시보드 (메인)
    // ═══════════════════════════════════════
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(2000);
    let text = await page.evaluate(() => document.body.innerText);
    addResult('대시보드', '사이드바 네비게이션', text.includes('대시보드') || text.includes('Dashboard'), '사이드바 메뉴');
    addResult('대시보드', 'KPI 카드 (총 광고비)', text.includes('총 광고비') || text.includes('광고비'), '광고비 지표');
    addResult('대시보드', 'KPI 카드 (총 클릭수)', text.includes('총 클릭수') || text.includes('클릭'), '클릭수 지표');
    addResult('대시보드', 'KPI 카드 (전환수/ROAS)', text.includes('전환') || text.includes('ROAS'), '전환/ROAS 지표');
    const hasChart = await page.evaluate(() => !!document.querySelector('svg') || !!document.querySelector('canvas') || !!document.querySelector('.recharts-wrapper'));
    addResult('대시보드', '차트 렌더링', hasChart, 'SVG/Canvas 차트');

    // ═══════════════════════════════════════
    // 3. 캠페인
    // ═══════════════════════════════════════
    await page.goto(`${BASE}/dashboard/campaigns`, { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(1500);
    text = await page.evaluate(() => document.body.innerText);
    addResult('캠페인', '페이지 로드', !text.includes('Application error'), '에러 없이 로드');
    addResult('캠페인', '캠페인 목록/테이블', text.includes('캠페인') || text.includes('campaign'), '캠페인 데이터 표시');
    const campaignTableRows = await page.evaluate(() => document.querySelectorAll('table tr, [class*="row"], [class*="card"]').length);
    addResult('캠페인', '데이터 행 존재', campaignTableRows > 0, `${campaignTableRows}개 행/카드 발견`);
    addResult('캠페인', '상태 표시', text.includes('활성') || text.includes('active') || text.includes('일시중지') || text.includes('ON'), '캠페인 상태값');

    // ═══════════════════════════════════════
    // 4. 광고그룹
    // ═══════════════════════════════════════
    await page.goto(`${BASE}/dashboard/adgroups`, { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(1500);
    text = await page.evaluate(() => document.body.innerText);
    addResult('광고그룹', '페이지 로드', !text.includes('Application error'), '에러 없이 로드');
    addResult('광고그룹', '콘텐츠 렌더링', text.length > 200, `본문 ${text.length}자`);
    const adgroupElements = await page.evaluate(() => document.querySelectorAll('table, [class*="card"], [class*="group"]').length);
    addResult('광고그룹', 'UI 컴포넌트', adgroupElements > 0, `${adgroupElements}개 컴포넌트`);

    // ═══════════════════════════════════════
    // 5. 키워드
    // ═══════════════════════════════════════
    await page.goto(`${BASE}/dashboard/keywords`, { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(1500);
    text = await page.evaluate(() => document.body.innerText);
    addResult('키워드', '페이지 로드', !text.includes('Application error'), '에러 없이 로드');
    addResult('키워드', '키워드 테이블', text.includes('키워드'), '키워드 데이터');
    const kwTable = await page.evaluate(() => !!document.querySelector('table'));
    addResult('키워드', '테이블 태그 존재', kwTable, '<table> 렌더링');
    addResult('키워드', '입찰가 데이터', text.includes('입찰') || text.includes('CPC') || text.includes('원'), '입찰가/CPC 표시');
    addResult('키워드', '품질지수', text.includes('품질') || text.includes('QI') || text.includes('quality'), '품질지수 컬럼');

    // ═══════════════════════════════════════
    // 6. 광고소재
    // ═══════════════════════════════════════
    await page.goto(`${BASE}/dashboard/ads`, { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(1500);
    text = await page.evaluate(() => document.body.innerText);
    addResult('광고소재', '페이지 로드', !text.includes('Application error'), '에러 없이 로드');
    addResult('광고소재', '광고 데이터', text.includes('광고') || text.includes('소재'), '광고소재 콘텐츠');
    addResult('광고소재', '모의 데이터', text.includes('프리미엄') || text.includes('GRP') || text.includes('법률') || text.length > 500, '모의 데이터 표시');

    // ═══════════════════════════════════════
    // 7. 자동입찰
    // ═══════════════════════════════════════
    await page.goto(`${BASE}/dashboard/auto-bidding`, { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(1500);
    text = await page.evaluate(() => document.body.innerText);
    addResult('자동입찰', '페이지 로드', !text.includes('Application error'), '에러 없이 로드');
    addResult('자동입찰', '콘텐츠 렌더링', text.length > 200, `본문 ${text.length}자`);
    addResult('자동입찰', '입찰 관련 UI', text.includes('입찰') || text.includes('최적화') || text.includes('규칙') || text.includes('전략'), '입찰 관련 텍스트');
    const autoBidButtons = await page.evaluate(() => document.querySelectorAll('button').length);
    addResult('자동입찰', '버튼 컴포넌트', autoBidButtons > 0, `${autoBidButtons}개 버튼`);

    // ═══════════════════════════════════════
    // 8. 경쟁분석
    // ═══════════════════════════════════════
    await page.goto(`${BASE}/dashboard/competitive`, { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(1500);
    text = await page.evaluate(() => document.body.innerText);
    addResult('경쟁분석', '페이지 로드', !text.includes('Application error'), '에러 없이 로드');
    addResult('경쟁분석', '경쟁 데이터', text.includes('경쟁'), '경쟁분석 콘텐츠');
    addResult('경쟁분석', '차트/그래프', await page.evaluate(() => !!document.querySelector('svg, canvas, .recharts-wrapper')), '시각화 요소');

    // ═══════════════════════════════════════
    // 9. 수익성분석
    // ═══════════════════════════════════════
    await page.goto(`${BASE}/dashboard/profitability`, { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(1500);
    text = await page.evaluate(() => document.body.innerText);
    addResult('수익성분석', '페이지 로드', !text.includes('Application error'), '에러 없이 로드');
    addResult('수익성분석', '수익성 데이터', text.includes('수익') || text.includes('마진') || text.includes('ROI'), '수익성 지표');
    addResult('수익성분석', '차트/그래프', await page.evaluate(() => !!document.querySelector('svg, canvas, .recharts-wrapper')), '시각화 요소');

    // ═══════════════════════════════════════
    // 10. 리포트
    // ═══════════════════════════════════════
    await page.goto(`${BASE}/dashboard/reports`, { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(1500);
    text = await page.evaluate(() => document.body.innerText);
    addResult('리포트', '페이지 로드', !text.includes('Application error'), '에러 없이 로드');
    addResult('리포트', '리포트 콘텐츠', text.includes('리포트') || text.includes('보고서'), '리포트 관련 텍스트');
    addResult('리포트', 'PDF/다운로드 버튼', text.includes('PDF') || text.includes('다운로드') || text.includes('생성'), '리포트 생성 UI');

    // ═══════════════════════════════════════
    // 11. 자동화
    // ═══════════════════════════════════════
    await page.goto(`${BASE}/dashboard/automation`, { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(1500);
    text = await page.evaluate(() => document.body.innerText);
    addResult('자동화', '페이지 로드', !text.includes('Application error'), '에러 없이 로드');
    addResult('자동화', '자동화 콘텐츠', text.includes('자동') || text.includes('규칙') || text.includes('스케줄'), '자동화 관련 텍스트');
    addResult('자동화', '규칙/워크플로 UI', await page.evaluate(() => document.querySelectorAll('[class*="card"], [class*="rule"], table tr').length > 0), '자동화 규칙 카드/행');

    // ═══════════════════════════════════════
    // 12. 알림센터
    // ═══════════════════════════════════════
    await page.goto(`${BASE}/dashboard/notifications`, { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(1500);
    text = await page.evaluate(() => document.body.innerText);
    addResult('알림센터', '페이지 로드', !text.includes('Application error'), '에러 없이 로드');
    addResult('알림센터', '알림 목록', text.includes('알림') || text.includes('notification'), '알림 콘텐츠');
    addResult('알림센터', '알림 항목 존재', text.includes('입찰') || text.includes('예산') || text.includes('이상') || text.includes('보고서') || text.includes('시스템'), '알림 항목 텍스트');

    // ═══════════════════════════════════════
    // 13. 계정관리
    // ═══════════════════════════════════════
    await page.goto(`${BASE}/dashboard/accounts`, { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(1500);
    text = await page.evaluate(() => document.body.innerText);
    addResult('계정관리', '페이지 로드', !text.includes('Application error'), '에러 없이 로드');
    addResult('계정관리', '계정 목록', text.includes('계정') || text.includes('account'), '계정 데이터');
    addResult('계정관리', 'API 연결 상태', text.includes('연결') || text.includes('connected') || text.includes('동기화'), '연결 상태 표시');
    addResult('계정관리', '계정 추가 버튼', await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some(b => b.innerText.includes('추가') || b.innerText.includes('연결') || b.innerText.includes('등록'));
    }), '추가/연결 버튼');

    // ═══════════════════════════════════════
    // 14. 설정
    // ═══════════════════════════════════════
    await page.goto(`${BASE}/dashboard/settings`, { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(1500);
    text = await page.evaluate(() => document.body.innerText);
    addResult('설정', '페이지 로드', !text.includes('Application error'), '에러 없이 로드');
    addResult('설정', '설정 항목', text.includes('설정') || text.includes('프로필') || text.includes('조직'), '설정 관련 텍스트');
    addResult('설정', '입력 필드', await page.evaluate(() => document.querySelectorAll('input, select, textarea').length > 0), '폼 요소');

    // ═══════════════════════════════════════
    // 15. 코파일럿
    // ═══════════════════════════════════════
    await page.goto(`${BASE}/dashboard/copilot`, { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(2000);
    text = await page.evaluate(() => document.body.innerText);
    addResult('코파일럿', '페이지 로드', !text.includes('Application error'), '에러 없이 로드');
    addResult('코파일럿', 'AI 채팅 UI', text.includes('코파일럿') || text.includes('AI') || text.includes('챗'), 'AI 채팅 인터페이스');
    const chatInput = await page.$('input') || await page.$('textarea');
    addResult('코파일럿', '메시지 입력창', !!chatInput, '채팅 입력 필드');
    addResult('코파일럿', '전송 버튼', await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some(b => b.innerText.includes('전송') || b.innerText.includes('보내기'));
    }), '전송 버튼');

    // 채팅 전송 테스트
    if (chatInput) {
      await chatInput.type('서버 세분화 테스트');
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const sendBtn = btns.find(b => b.innerText.includes('전송'));
        if (sendBtn) sendBtn.click();
      });
      await wait(4000);
      text = await page.evaluate(() => document.body.innerText);
      addResult('코파일럿', '메시지 전송', text.includes('서버 세분화 테스트'), '전송 메시지 화면 표시');
      const hasAiReply = text.length > 800;
      addResult('코파일럿', 'AI 응답 수신', hasAiReply, hasAiReply ? 'AI 응답 감지' : '응답 없음');
    }

    // ═══════════════════════════════════════
    // 16. API 엔드포인트
    // ═══════════════════════════════════════
    await page.goto(`${BASE}/api/health`, { waitUntil: 'networkidle2', timeout: 10000 });
    text = await page.evaluate(() => document.body.innerText);
    addResult('API', 'Health API', text.includes('healthy'), text.substring(0, 100));

    await page.goto(`${BASE}/api/auth/session`, { waitUntil: 'networkidle2', timeout: 10000 });
    text = await page.evaluate(() => document.body.innerText);
    addResult('API', 'Auth Session API', text.includes('user') || text.includes('email'), '세션 데이터 확인');

  } catch (err) {
    addResult('시스템', '테스트 실행', false, err.message.substring(0, 100));
  } finally {
    await browser.close();
  }

  // ═══════════════════════════════════════
  // 결과 요약 출력
  // ═══════════════════════════════════════
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  const total = results.length;

  const categories = [...new Set(results.map(r => r.category))];
  const lines = [];
  lines.push(`\n${'='.repeat(60)}`);
  lines.push(`📊 세분화 테스트 결과: ${passed}/${total} 통과 (${failed}개 실패)`);
  lines.push(`${'='.repeat(60)}`);

  for (const cat of categories) {
    const catResults = results.filter(r => r.category === cat);
    const catPassed = catResults.filter(r => r.ok).length;
    lines.push(`\n📁 ${cat} [${catPassed}/${catResults.length}]`);
    for (const r of catResults) {
      lines.push(`   ${r.ok ? '✅' : '❌'} ${r.item} — ${r.detail}`);
    }
  }

  lines.push(`\n${'='.repeat(60)}`);
  const output = lines.join('\n');
  console.log(output);

  fs.writeFileSync('test-detail-results.json', JSON.stringify({ passed, failed, total, results }, null, 2));
  fs.writeFileSync('test-detail-results.txt', output);
})();
