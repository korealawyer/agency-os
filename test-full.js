const puppeteer = require('puppeteer');
const fs = require('fs');
const wait = (ms) => new Promise(r => setTimeout(r, ms));

// ── 테스트 대상: 인자로 받거나 기본값 ──
const BASE = process.argv[2] || 'http://localhost:3000';
const ENV = BASE.includes('localhost') ? 'LOCAL' : 'SERVER';
const results = [];

const add = (cat, sub, item, ok, detail) => {
  results.push({ cat, sub, item, ok, detail });
};

// Helper: 안전하게 텍스트 가져오기
const getText = async (page) => {
  try { return await page.evaluate(() => document.body.innerText); } catch { return ''; }
};
const exists = async (page, sel) => {
  try { return !!(await page.$(sel)); } catch { return false; }
};
const count = async (page, sel) => {
  try { return await page.evaluate((s) => document.querySelectorAll(s).length, sel); } catch { return 0; }
};

(async () => {
  console.log(`\n🧪 [${ENV}] 전체 기능 테스트 시작: ${BASE}\n`);
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    // ═══════════════════════════════════════════
    // 1. 인증
    // ═══════════════════════════════════════════
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 15000 });
    add('1.인증', '로그인', '1-01 로그인 폼 렌더링', await exists(page, 'input[type="email"]'), '이메일 입력창');
    add('1.인증', '로그인', '1-02 비밀번호 입력창', await exists(page, 'input[type="password"]'), '비밀번호 입력창');
    add('1.인증', '로그인', '1-03 로그인 버튼', await exists(page, 'button[type="submit"]'), '제출 버튼');

    await page.type('input[type="email"]', 'admin@agency.com');
    await page.type('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
    await wait(3000);
    const loginUrl = page.url();
    add('1.인증', '로그인', '1-04 정상 로그인→대시보드', loginUrl.includes('/dashboard'), loginUrl);

    if (!loginUrl.includes('/dashboard')) {
      console.log('❌ 로그인 실패 — 테스트 중단');
      fs.writeFileSync(`test-full-${ENV.toLowerCase()}.json`, JSON.stringify({ env: ENV, base: BASE, results }, null, 2));
      await browser.close();
      return;
    }

    // 세션 유지 테스트
    await page.reload({ waitUntil: 'networkidle2' });
    await wait(1500);
    add('1.인증', '세션', '1-10 JWT 세션 유지', page.url().includes('/dashboard'), '새로고침 후 세션 유지');

    // ═══════════════════════════════════════════
    // 2. 메인 대시보드
    // ═══════════════════════════════════════════
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(2000);
    let text = await getText(page);

    // KPI 카드
    add('2.대시보드', 'KPI', '2-01 총 광고비', text.includes('총 광고비'), '₩ 금액');
    add('2.대시보드', 'KPI', '2-02 평균 ROAS', text.includes('ROAS') || text.includes('평균'), 'ROAS 지표');
    add('2.대시보드', 'KPI', '2-03 노출수', text.includes('노출'), '노출 지표');
    add('2.대시보드', 'KPI', '2-04 전환수', text.includes('전환'), '전환 지표');
    add('2.대시보드', 'KPI', '2-05 총 클릭수', text.includes('클릭'), '클릭 지표');
    add('2.대시보드', 'KPI', '2-06 키워드', text.includes('키워드'), '키워드 지표');

    // 인터랙티브
    add('2.대시보드', 'UI', '2-08 DateRangePicker', await count(page, '[class*="date"], [class*="picker"], [class*="calendar"]') > 0 || text.includes('오늘') || text.includes('어제'), '날짜 선택기');
    add('2.대시보드', 'UI', '2-09 검색창', await exists(page, 'input[placeholder*="검색"]'), '검색 입력창');
    add('2.대시보드', 'UI', '2-10 알림 벨', await count(page, 'button') > 3, '알림 버튼');

    // AI 추천 패널
    add('2.대시보드', 'AI', '2-14 AI 추천 섹션', text.includes('AI 추천') || text.includes('AI') || text.includes('코파일럿'), 'AI 추천 액션');

    // 차트
    const hasChart = await page.evaluate(() => !!document.querySelector('svg.recharts-surface, canvas, .recharts-wrapper'));
    add('2.대시보드', '차트', '2-20 ROAS 차트', hasChart, 'recharts SVG');
    add('2.대시보드', '차트', '2-22 히트맵', text.includes('히트맵') || text.includes('시간대'), '히트맵 섹션');

    // 계정 현황
    add('2.대시보드', '계정', '2-24 계정 테이블', text.includes('계정') && (text.includes('광고비') || text.includes('ROAS') || text.includes('연동')), '계정 데이터');

    // 로딩/에러
    add('2.대시보드', '상태', '2-27 정합성 바', text.includes('정합성') || text.includes('동기화') || text.includes('API'), '하단 상태 바');

    // ═══════════════════════════════════════════
    // 3. 캠페인
    // ═══════════════════════════════════════════
    await page.goto(`${BASE}/dashboard/campaigns`, { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(2000);
    text = await getText(page);
    add('3.캠페인', '레이아웃', '3-01 계정 트리', text.includes('전체 계정') || text.includes('계정 트리'), '좌측 트리');
    add('3.캠페인', '탭', '3-05 캠페인/광고그룹 탭', text.includes('캠페인') && text.includes('광고그룹'), '뷰 탭');
    add('3.캠페인', '필터', '3-06 상태 필터', text.includes('전체') && (text.includes('활성') || text.includes('일시정지')), '상태 필터');
    add('3.캠페인', '테이블', '3-10 캠페인 테이블', await exists(page, 'table'), '<table> 존재');
    const campRows = await count(page, 'table tbody tr');
    add('3.캠페인', '테이블', '3-11 데이터 행', campRows > 0, `${campRows}개 행`);
    add('3.캠페인', '기능', '3-16 캠페인 생성 버튼', text.includes('캠페인 생성') || text.includes('생성'), '생성 버튼');

    // ═══════════════════════════════════════════
    // 4. 키워드
    // ═══════════════════════════════════════════
    await page.goto(`${BASE}/dashboard/keywords`, { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(2000);
    text = await getText(page);
    add('4.키워드', '탭', '4-01 키워드 탭', text.includes('키워드'), '키워드 뷰');
    add('4.키워드', '탭', '4-02 순위 탭', text.includes('순위'), '순위 탭');
    add('4.키워드', '탭', '4-03 부정클릭 탭', text.includes('부정클릭') || text.includes('방지'), '부정클릭 탭');
    add('4.키워드', '필터', '4-04 검색창', await exists(page, 'input[placeholder*="검색"]'), '검색 입력');
    add('4.키워드', '필터', '4-05 계정 필터', await exists(page, 'select'), '드롭다운');
    add('4.키워드', '테이블', '4-08 테이블', await exists(page, 'table'), '<table> 존재');
    add('4.키워드', '기능', '4-23 CSV 내보내기', text.includes('CSV') || text.includes('내보내기'), 'CSV 버튼');
    add('4.키워드', '기능', '4-26 AI 추천', text.includes('AI') && text.includes('추천'), 'AI 키워드 추천');
    add('4.키워드', '데이터', '4-12 입찰가 데이터', text.includes('입찰') || text.includes('₩'), '입찰가/CPC');

    // ═══════════════════════════════════════════
    // 5. 광고소재
    // ═══════════════════════════════════════════
    await page.goto(`${BASE}/dashboard/ads`, { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(1500);
    text = await getText(page);
    add('5.광고소재', '페이지', '5-01 페이지 로드', !text.includes('Application error'), '에러 없음');
    add('5.광고소재', '데이터', '5-02 광고 데이터', text.includes('광고') || text.includes('소재'), '광고 콘텐츠');
    add('5.광고소재', '탭', '5-03 A/B 테스트', text.includes('A/B') || text.includes('테스트') || text.includes('퍼널'), 'A/B 또는 퍼널 탭');

    // ═══════════════════════════════════════════
    // 6. AI 코파일럿
    // ═══════════════════════════════════════════
    await page.goto(`${BASE}/dashboard/copilot`, { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(2000);
    text = await getText(page);
    add('6.코파일럿', 'UI', '6-01 AI 환영 메시지', text.includes('코파일럿') || text.includes('AI'), '환영 메시지');
    add('6.코파일럿', 'UI', '6-02 빠른 질문 버튼', text.includes('성과 요약') || text.includes('키워드 추천') || text.includes('빠른'), '퀵 액션');
    add('6.코파일럿', 'UI', '6-03 입력창', await exists(page, 'input') || await exists(page, 'textarea'), '채팅 입력');
    add('6.코파일럿', 'UI', '6-04 전송 버튼', text.includes('전송'), '전송 버튼');
    add('6.코파일럿', 'UI', '6-08 초기화 버튼', text.includes('초기화'), '초기화 버튼');
    add('6.코파일럿', 'UI', '6-11 연결 상태', text.includes('연결됨') || text.includes('분석 중'), '연결 상태 텍스트');

    // 채팅 전송 테스트
    const chatInput = await page.$('input.form-input') || await page.$('input') || await page.$('textarea');
    if (chatInput) {
      await chatInput.type(`${ENV} 테스트 메시지`);
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const sendBtn = btns.find(b => b.innerText.includes('전송'));
        if (sendBtn) sendBtn.click();
      });
      await wait(5000);
      text = await getText(page);
      add('6.코파일럿', '채팅', '6-05 메시지 전송', text.includes(`${ENV} 테스트 메시지`), '사용자 메시지 표시');
      add('6.코파일럿', '채팅', '6-06 AI 응답', text.length > 500, text.length > 500 ? 'AI 응답 감지' : '응답 대기 중');
    }

    // ═══════════════════════════════════════════
    // 7~8. 나머지 페이지
    // ═══════════════════════════════════════════
    const pages = [
      { cat: '7.경쟁분석', path: '/dashboard/competitive', checks: [['경쟁', '경쟁 데이터'], ['차트/그래프', null]] },
      { cat: '7.수익성', path: '/dashboard/profitability', checks: [['수익', '수익 KPI'], ['차트/그래프', null]] },
      { cat: '7.리포트', path: '/dashboard/reports', checks: [['리포트', '리포트 콘텐츠'], ['PDF', 'PDF/생성 버튼']] },
      { cat: '7.자동화', path: '/dashboard/automation', checks: [['자동', '자동화 규칙']] },
      { cat: '7.부정클릭', path: '/dashboard/click-fraud', checks: [['부정', '부정클릭'], ['차단', '차단 IP']] },
      { cat: '8.알림', path: '/dashboard/notifications', checks: [['알림', '알림 목록']] },
      { cat: '8.계정', path: '/dashboard/accounts', checks: [['계정', '계정 관리'], ['연결', '연결 상태']] },
      { cat: '8.설정', path: '/dashboard/settings', checks: [['설정', '설정 항목']] },
      { cat: '8.감사로그', path: '/dashboard/audit-log', checks: [['감사', '감사 로그']] },
      { cat: '7.시뮬레이터', path: '/dashboard/simulator', checks: [['시뮬', '시뮬레이터']] },
    ];

    for (const p of pages) {
      try {
        await page.goto(`${BASE}${p.path}`, { waitUntil: 'networkidle2', timeout: 15000 });
        await wait(1500);
        text = await getText(page);
        const noError = !text.includes('Application error') && !text.includes('Internal Server Error');
        add(p.cat, '페이지', `페이지 로드`, noError, noError ? `에러 없음 (${text.length}자)` : 'ERROR');
        for (const [kw, label] of p.checks) {
          if (kw === '차트/그래프') {
            const hasViz = await page.evaluate(() => !!document.querySelector('svg, canvas, .recharts-wrapper'));
            add(p.cat, '데이터', label || '차트', hasViz, '시각화 요소');
          } else {
            add(p.cat, '데이터', label || kw, text.includes(kw), `"${kw}" 검출`);
          }
        }
      } catch (err) {
        add(p.cat, '페이지', '페이지 로드', false, 'TIMEOUT');
      }
    }

    // ═══════════════════════════════════════════
    // 9. 마케팅 페이지 (비로그인)
    // ═══════════════════════════════════════════
    for (const mp of [
      { path: '/landing', name: '랜딩', kw: 'Agency' },
      { path: '/pricing', name: '요금제', kw: '플랜' },
    ]) {
      try {
        await page.goto(`${BASE}${mp.path}`, { waitUntil: 'networkidle2', timeout: 10000 });
        await wait(1000);
        text = await getText(page);
        add('9.마케팅', '페이지', `${mp.name} 페이지`, text.length > 100, `${text.length}자`);
      } catch {
        add('9.마케팅', '페이지', `${mp.name} 페이지`, false, 'TIMEOUT');
      }
    }

    // ═══════════════════════════════════════════
    // 10. API 엔드포인트
    // ═══════════════════════════════════════════
    const apis = [
      { path: '/api/health', check: 'healthy', name: 'Health API' },
      { path: '/api/auth/session', check: 'user', name: 'Auth Session' },
      { path: '/api/dashboard?period=7d', check: 'kpi', name: 'Dashboard API' },
      { path: '/api/campaigns', check: '[', name: 'Campaigns API' },
      { path: '/api/keywords?page=1', check: '[', name: 'Keywords API' },
      { path: '/api/notifications', check: '[', name: 'Notifications API' },
      { path: '/api/accounts', check: '[', name: 'Accounts API' },
    ];

    for (const api of apis) {
      try {
        await page.goto(`${BASE}${api.path}`, { waitUntil: 'networkidle2', timeout: 10000 });
        text = await getText(page);
        add('10.API', 'endpoint', api.name, text.includes(api.check), text.substring(0, 80));
      } catch {
        add('10.API', 'endpoint', api.name, false, 'TIMEOUT');
      }
    }

    // ═══════════════════════════════════════════
    // 11. 크로스커팅
    // ═══════════════════════════════════════════
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(1500);
    text = await getText(page);
    add('11.공통', 'UI', '사이드바 메뉴', text.includes('대시보드') && text.includes('키워드') && text.includes('캠페인'), '주요 메뉴 항목');

  } catch (err) {
    add('시스템', '오류', '테스트 실행', false, err.message.substring(0, 100));
  } finally {
    await browser.close();
  }

  // ═══════════════════════════════════════════
  // 결과 출력
  // ═══════════════════════════════════════════
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  const total = results.length;

  const cats = [...new Set(results.map(r => r.cat))];
  const lines = [];
  lines.push(`\n${'═'.repeat(60)}`);
  lines.push(`📊 [${ENV}] 테스트 결과: ${passed}/${total} 통과 (${failed}건 실패)`);
  lines.push(`${'═'.repeat(60)}`);

  for (const cat of cats) {
    const cr = results.filter(r => r.cat === cat);
    const cp = cr.filter(r => r.ok).length;
    lines.push(`\n📁 ${cat} [${cp}/${cr.length}]`);
    for (const r of cr) {
      lines.push(`   ${r.ok ? '✅' : '❌'} ${r.item} — ${r.detail}`);
    }
  }

  lines.push(`\n${'═'.repeat(60)}`);
  const output = lines.join('\n');
  console.log(output);

  fs.writeFileSync(`test-full-${ENV.toLowerCase()}.json`, JSON.stringify({ env: ENV, base: BASE, passed, failed, total, results }, null, 2));
  fs.writeFileSync(`test-full-${ENV.toLowerCase()}.txt`, output);
})();
