const puppeteer = require('puppeteer');
const wait = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  console.log("Starting Dashboard automated tests...");
  
  try {
    // 1. Initial login
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    if (page.url().includes('/login')) {
      console.log("Logging in...");
      await page.type('input[type="email"]', 'admin@agency.com');
      await page.type('input[type="password"]', 'password123');
      await page.click('button[type="submit"]');
    }
    await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
    await wait(3000);

    // 2. Test Keywords Page
    console.log("Testing Keywords Page...");
    await page.goto('http://localhost:3000/dashboard/keywords', { waitUntil: 'networkidle2' });
    await wait(2000);
    const cols = await page.evaluate(() => document.querySelectorAll('colgroup').length);
    console.log(`[x] Keyword Table Colgroup check: found ${cols} <colgroup> tags.`);

    // 3. Test Ads Mock
    console.log("Testing Ads Page...");
    await page.goto('http://localhost:3000/dashboard/ads', { waitUntil: 'networkidle2' });
    await wait(2000);
    const adsText = await page.evaluate(() => document.body.innerText);
    const hasMock = adsText.includes('프리미엄 법률 상담') || adsText.includes('GRP-');
    console.log(`[x] Ads Page mock check: ${hasMock ? 'Mock data detected!' : 'No mock data found.'}`);

    // 4. Test Reports PDF click
    console.log("Testing Reports Page...");
    await page.goto('http://localhost:3000/dashboard/reports', { waitUntil: 'networkidle2' });
    await wait(2000);
    const templates = await page.$$('.card');
    if (templates.length > 1) {
       await page.evaluate(() => {
           const cards = Array.from(document.querySelectorAll('.card'));
           const templateCard = cards.find(c => c.innerText.includes('활성') || c.innerText.includes('매주'));
           if (templateCard) templateCard.click();
       });
       await wait(1000);
       await page.evaluate(() => {
           const buttons = Array.from(document.querySelectorAll('button'));
           const pdfBtn = buttons.find(b => b.innerText.includes('PDF'));
           if (pdfBtn) pdfBtn.click();
       });
       await wait(1000);
       const reportText = await page.evaluate(() => document.body.innerText);
       const toastFound = reportText.includes('리포트 PDF가 생성되었습니다.') || reportText.includes('PDF 다운로드');
       console.log(`[x] PDF Button clicked: Toast appeared = ${toastFound}`);
    } else {
       console.log('No templates found.');
    }

    // 5. Test Copilot localStorage
    console.log("Testing Copilot LocalStorage...");
    await page.goto('http://localhost:3000/dashboard/copilot', { waitUntil: 'networkidle2' });
    await wait(2000);
    await page.type('input', '테스트 발송입니다');
    await page.evaluate(() => {
       const buttons = Array.from(document.querySelectorAll('button'));
       const sendBtn = buttons.find(b => b.innerText.includes('전송'));
       if (sendBtn) sendBtn.click();
    });
    await wait(2000); // API takes time
    
    await page.reload({ waitUntil: 'networkidle2' });
    await wait(2000);
    const chatText = await page.evaluate(() => document.body.innerText);
    console.log(`[x] Copilot cache check: message persisted = ${chatText.includes('테스트 발송입니다')}`);

  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    await browser.close();
    console.log("All tests finished.");
  }
})();
