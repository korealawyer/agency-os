const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER_LOG:', msg.text()));
  page.on('response', async response => {
    if (response.url().includes('login') || response.url().includes('auth') || response.url().includes('api')) {
      console.log('NETWORK_RESPONSE:', response.status(), response.url());
      if (response.status() === 401 || response.status() === 400 || response.status() === 500) {
        try {
           const body = await response.text();
           console.log('ERROR_RESPONSE_BODY:', body);
        } catch(e) {}
      }
    }
  });

  try {
    console.log("Navigating to login...");
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    
    console.log("Logging in...");
    await page.type('input[type="email"]', 'admin@agency.com');
    await page.type('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Wait for 5 seconds to capture all logs
    await new Promise(r => setTimeout(r, 5000));
    
    const url = page.url();
    console.log("Current URL after login:", url);
    
  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    await browser.close();
  }
})();
