import express from "express";
import puppeteer from "puppeteer";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
import cors from "cors";

const app = express();

// Use CORS middleware
app.use(cors({
  origin: "*",
}));
app.use(express.json());
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Sleep helper
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// Random delay for human-like behavior
const randomDelay = (min = 1000, max = 3000) => 
  new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));

// Simulate human-like behavior
async function simulateHumanBehavior(page) {
  // Move mouse randomly
  await page.mouse.move(Math.random() * 1920, Math.random() * 1080);
  await randomDelay(500, 1500);
  
  // Random scroll
  await page.evaluate(() => {
    window.scrollBy(0, Math.random() * 500);
  });
  await randomDelay(1000, 2000);
}

// Accordion expander
async function expandAccordions(page) {
  const selectors = [
    "button[aria-controls='productDescriptionDetails']",
    "button[aria-controls='productDescriptionBrand']",
    "button[aria-controls='productDescriptionCareInfo']",
    "button[aria-controls='productDescriptionAboutMe']",
  ];
  for (let sel of selectors) {
    try {
      const btn = await page.$(sel);
      if (btn) {
        const expanded = await page.$eval(sel, (el) => el.getAttribute("aria-expanded"));
        if (expanded === "false") {
          await btn.click();
          await randomDelay(300, 800);
        }
      }
    } catch {}
  }
}

// Load all products
async function loadAllProducts(page) {
  let lastCount = 0, clicks = 0;
  while (true) {
    const currentCount = await page.$$eval("li.productTile_U0clN", (els) => els.length).catch(() => 0);
    if (currentCount === lastCount) break;
    lastCount = currentCount;

    const btn = await page.$("a.loadButton_wWQ3F");
    if (!btn) break;

    clicks++;
    console.log(`🔄 Clicking "Load more" (${clicks})`);
    await btn.click();
    await randomDelay(3000, 5000);
  }
  console.log(`✅ Finished loading, total visible: ${lastCount}`);
}

// Scrape one product page
async function scrapeProduct(browser, link) {
  const page = await browser.newPage();
  
  try {
    // Set viewport and user agent for the product page too
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Remove webdriver property
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
    });

    await page.goto(link, { waitUntil: "domcontentloaded", timeout: 60000 });
    await randomDelay(2000, 4000);
    await expandAccordions(page);

    const data = await page.evaluate(() => {
      const safeText = (sel) => document.querySelector(sel)?.innerText?.trim() || null;

      const name = safeText("h1[data-testid='product-title']") || document.title.split("|")[0].trim();
      const price = safeText("[data-testid='current-price']");
      const currency = price?.match(/[£$€]/)?.[0] || null;
      const stock_status = safeText("[data-testid='stock-availability']") || "Available";

      // colors
      let colors = [];
      const selectedColor = document.querySelector("span[data-testid='product-colour']")?.innerText.trim();
      if (selectedColor) colors.push(selectedColor);
      document.querySelectorAll("[data-testid='facetList'] li a").forEach((a) => {
        const label = a.getAttribute("aria-label")?.trim();
        if (label && !colors.includes(label)) colors.push(label);
      });

      let description = null;
      const descBlock = document.querySelector("#productDescriptionDetails .F_yfF");
      if (descBlock) description = descBlock.innerText.replace(/\s+/g, " ").trim();
      if (!description) {
        const metaDesc = document.querySelector("meta[name='description']")?.content;
        if (metaDesc) description = metaDesc.trim();
      }

      let brand = null;
      const brandBlock = document.querySelector("#productDescriptionBrand .F_yfF");
      if (brandBlock) {
        const strong = brandBlock.querySelector("strong");
        brand = strong ? strong.innerText.trim() : brandBlock.innerText.trim();
      }
      if (!brand) {
        const parts = window.location.pathname.split("/");
        if (parts.length > 1) {
          brand = parts[1].replace(/-/g, " ");
          brand = brand.charAt(0).toUpperCase() + brand.slice(1);
        }
      }

      let category = "";
      const catLink = document.querySelector("#productDescriptionDetails a[href*='/cat/']");
      if (catLink) category = catLink.innerText.trim();

      const materials = document.querySelector("#productDescriptionAboutMe .F_yfF")?.innerText.trim() || null;
      const care_info = document.querySelector("#productDescriptionCareInfo .F_yfF")?.innerText.trim() || null;

      let size = [];
      document.querySelectorAll("#variantSelector option").forEach((opt) => {
        if (opt.value) size.push(opt.innerText.trim());
      });
      if (size.length === 0) size = null;

      const images = Array.from(document.querySelectorAll("#core-product img"))
        .map((img) => img.src.replace(/\?[^ ]*$/, ""))
        .map((src) => `${src}?$n_960w$&wid=960&fit=constrain`)
        .filter((src) => src.includes("asos-media"));

      return {
        name,
        description,
        brand,
        category,
        price: price ? parseFloat(price.replace(/[^\d.]/g, "")) : null,
        currency,
        stock_status,
        materials,
        care_info,
        size: size ? size.join(", ") : null,
        color: colors.join(", "),
        images,
        product_url: window.location.href,
      };
    });

    // Insert into Supabase
    const { error } = await supabase.from("products").insert(data);
    if (error) console.error("❌ Supabase insert error:", error.message);
    else console.log(`✅ Inserted: ${data.name}`);

    return data;
  } catch (err) {
    console.error(`❌ Failed scraping ${link}`, err);
    return null;
  } finally {
    await page.close();
  }
}

// Main scraper with enhanced headless configuration
async function scrapeASOS(searchTerm, options = { mode: "limit", limit: 5 }, concurrency = 5) {
  const browser = await puppeteer.launch({
    headless: "new", // Use new headless mode
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu',
      
      // Additional args to avoid detection
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-infobars',
      '--disable-blink-features=AutomationControlled',
      '--no-default-browser-check',
      '--disable-default-apps',
      '--disable-popup-blocking',
      '--disable-translate',
      '--disable-background-media-track',
      '--disable-ipc-flooding-protection',
      '--window-size=1920,1080'
    ],
    ignoreHTTPSErrors: true,
    ignoreDefaultArgs: ['--enable-automation']
  });

  const page = await browser.newPage();
  
  try {
    // Set a realistic viewport
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Set user agent to mimic real browser
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Add extra headers
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1'
    });

    // Remove webdriver property
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
      
      // Remove automation indicators
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
    });

    console.log('Navigating to ASOS homepage first...');
    
    // First visit homepage to appear more natural
    await page.goto('https://www.asos.com', {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });
    
    await randomDelay(2000, 4000);
    await simulateHumanBehavior(page);
    
    console.log('Now navigating to search page...');
    
    // Then navigate to search
    await page.goto(`https://www.asos.com/search/?q=${encodeURIComponent(searchTerm)}`, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });

    // Wait for page to fully load
    await randomDelay(3000, 5000);
    await simulateHumanBehavior(page);

    // Check if we're blocked or redirected
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);
    
    if (currentUrl.includes('blocked') || currentUrl.includes('captcha')) {
      throw new Error('Page appears to be blocked or showing captcha');
    }

    // Try multiple selectors as fallback
    const selectors = [
      'li.productTile_U0clN',
      '[data-testid="product-tile"]',
      '.product-tile',
      'article[data-testid="product-tile"]',
      '.product',
      '[data-auto-id="productTile"]'
    ];

    let productSelector = null;
    for (const selector of selectors) {
      try {
        console.log(`Trying selector: ${selector}`);
        await page.waitForSelector(selector, { timeout: 15000 });
        productSelector = selector;
        console.log(`✅ Found products using selector: ${selector}`);
        break;
      } catch (e) {
        console.log(`❌ Selector ${selector} not found, trying next...`);
      }
    }

    if (!productSelector) {
      // Take screenshot for debugging
      try {
        await page.screenshot({ path: 'debug-screenshot.png', fullPage: true });
        console.log('Debug screenshot saved as debug-screenshot.png');
      } catch (e) {
        console.log('Could not take screenshot');
      }
      
      // Log page content for debugging
      const pageContent = await page.content();
      const pageTitle = await page.title();
      console.log('Page title:', pageTitle);
      console.log('Page content preview (first 1000 chars):', pageContent.substring(0, 1000));
      
      // Check for common error messages
      const bodyText = await page.$eval('body', el => el.innerText).catch(() => '');
      if (bodyText.toLowerCase().includes('blocked') || bodyText.toLowerCase().includes('access denied')) {
        throw new Error('Access blocked by website. Try using different user agent or proxy.');
      }
      
      throw new Error('Could not find product tiles with any selector. Check debug-screenshot.png for more info.');
    }

    if (options.mode === "full" || options.mode === "range") {
      await loadAllProducts(page);
    }

    // Use the found selector for getting product links
    const linkSelectors = [
      `${productSelector} a.productLink_KM4PI`,
      `${productSelector} a[href*="/prd/"]`,
      `${productSelector} a[data-testid="product-link"]`,
      `${productSelector} a`
    ];
    
    let productLinks = [];
    for (const linkSel of linkSelectors) {
      try {
        productLinks = await page.$$eval(linkSel, (links) =>
          links.map((a) => a.href).filter(href => href && href.includes('/prd/'))
        );
        if (productLinks.length > 0) {
          console.log(`Found ${productLinks.length} product links using: ${linkSel}`);
          break;
        }
      } catch (e) {
        console.log(`Failed to get links with selector: ${linkSel}`);
      }
    }

    if (productLinks.length === 0) {
      throw new Error('No product links found');
    }

    let linksToScrape = [];
    if (options.mode === "limit") {
      linksToScrape = productLinks.slice(0, options.limit);
    } else if (options.mode === "range") {
      linksToScrape = productLinks.slice(options.startIndex, options.endIndex);
    } else {
      linksToScrape = productLinks;
    }

    console.log(`➡️ Scraping ${linksToScrape.length} products with concurrency = ${concurrency}`);

    const results = [];
    for (let i = 0; i < linksToScrape.length; i += concurrency) {
      const batch = linksToScrape.slice(i, i + concurrency);
      const scrapedBatch = await Promise.allSettled(batch.map((link) => scrapeProduct(browser, link)));
      scrapedBatch.forEach((res) => {
        if (res.status === "fulfilled" && res.value) results.push(res.value);
      });
      
      // Add delay between batches to avoid rate limiting
      if (i + concurrency < linksToScrape.length) {
        await randomDelay(2000, 4000);
      }
    }

    await browser.close();
    return results;
    
  } catch (error) {
    // Take screenshot for debugging
    try {
      await page.screenshot({ path: 'error-screenshot.png', fullPage: true });
      console.log('Error screenshot saved as error-screenshot.png');
    } catch (e) {
      console.log('Could not take error screenshot');
    }
    
    await browser.close();
    throw error;
  }
}

// API endpoint
app.post("/scrape", async (req, res) => {
  console.log('Scrape request received:', req.body);
  const { searchTerm, mode, limit, startIndex, endIndex, concurrency } = req.body;
  
  if (!searchTerm) {
    return res.status(400).json({ success: false, error: "searchTerm is required" });
  }

  try {
    console.log('Starting scrape for:', searchTerm);
    const results = await scrapeASOS(
      searchTerm,
      { mode, limit, startIndex, endIndex },
      concurrency || 5
    );
    console.log('Scrape completed. Results:', results.length);
    res.json({ success: true, count: results.length, results });
  } catch (err) {
    console.error('Error in scrape endpoint:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ message: "everything is working" });
});

const PORT = 4000;
app.listen(PORT, () => console.log(`🚀 API running at http://localhost:${PORT}`));