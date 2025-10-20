import express from "express";
import puppeteer from "puppeteer";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
import cors from "cors";
import { WebSocketServer } from 'ws';
import http from 'http';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// API Version
const API_VERSION = 'v1';

// ============================================
// BROWSER POOL MANAGEMENT
// ============================================
class BrowserPool {
  constructor(minBrowsers = 2, maxBrowsers = 5) {
    this.minBrowsers = minBrowsers;
    this.maxBrowsers = maxBrowsers;
    this.browsers = [];
    this.availableBrowsers = [];
    this.busyBrowsers = new Set();
    this.isInitialized = false;
    this.initPromise = null;
  }

  async initialize() {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      console.log(`🚀 Initializing browser pool with ${this.minBrowsers} browsers...`);
      
      for (let i = 0; i < this.minBrowsers; i++) {
        try {
          const browser = await this.createBrowser();
          this.browsers.push(browser);
          this.availableBrowsers.push(browser);
          console.log(`✅ Browser ${i + 1}/${this.minBrowsers} initialized`);
        } catch (error) {
          console.error(`❌ Failed to initialize browser ${i + 1}:`, error);
        }
      }
      
      this.isInitialized = true;
      console.log(`🎉 Browser pool initialized with ${this.browsers.length} browsers`);
    })();

    return this.initPromise;
  }

  async createBrowser() {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-infobars',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1080'
      ],
      ignoreHTTPSErrors: true,
      ignoreDefaultArgs: ['--enable-automation']
    });

    browser.on('disconnected', () => {
      console.log('⚠️ Browser disconnected, removing from pool');
      this.removeBrowser(browser);
    });

    return browser;
  }

  async getBrowser() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    let attempts = 0;
    const maxAttempts = 30;
    
    while (this.availableBrowsers.length === 0 && attempts < maxAttempts) {
      if (this.browsers.length < this.maxBrowsers) {
        console.log('📈 Creating additional browser for pool...');
        try {
          const browser = await this.createBrowser();
          this.browsers.push(browser);
          this.availableBrowsers.push(browser);
          console.log(`✅ Browser pool expanded to ${this.browsers.length} browsers`);
          break;
        } catch (error) {
          console.error('❌ Failed to create additional browser:', error);
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    if (this.availableBrowsers.length === 0) {
      throw new Error('No browsers available in pool. Please try again later.');
    }

    const browser = this.availableBrowsers.shift();
    this.busyBrowsers.add(browser);
    return browser;
  }

  releaseBrowser(browser) {
    if (this.busyBrowsers.has(browser)) {
      this.busyBrowsers.delete(browser);
      this.availableBrowsers.push(browser);
      console.log(`♻️ Browser released back to pool (${this.availableBrowsers.length} available)`);
    }
  }

  removeBrowser(browser) {
    const index = this.browsers.indexOf(browser);
    if (index > -1) {
      this.browsers.splice(index, 1);
    }
    
    const availIndex = this.availableBrowsers.indexOf(browser);
    if (availIndex > -1) {
      this.availableBrowsers.splice(availIndex, 1);
    }
    
    this.busyBrowsers.delete(browser);
  }

  async cleanup() {
    console.log('🧹 Cleaning up browser pool...');
    for (const browser of this.browsers) {
      try {
        await browser.close();
      } catch (error) {
        console.error('Error closing browser:', error);
      }
    }
    this.browsers = [];
    this.availableBrowsers = [];
    this.busyBrowsers.clear();
    this.isInitialized = false;
  }

  getStats() {
    return {
      total: this.browsers.length,
      available: this.availableBrowsers.length,
      busy: this.busyBrowsers.size,
      maxCapacity: this.maxBrowsers
    };
  }
}

const browserPool = new BrowserPool(2, 5);
browserPool.initialize().catch(console.error);

// ============================================
// RATE LIMITING
// ============================================
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const scrapeLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    error: 'Scraping rate limit exceeded. Please try again later.',
    retryAfter: '5 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

function rapidAPIRateLimit(req, res, next) {
  // For development/testing, allow requests without API key
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const apiKey = req.headers['x-rapidapi-key'] || req.headers['x-api-key'];
  
  if (!apiKey && !isDevelopment) {
    return res.status(401).json({
      success: false,
      error: 'API key required',
      message: 'Please provide a valid API key in the X-RapidAPI-Key header'
    });
  }
  
  req.apiKey = apiKey || 'development-key';
  next();
}

// ============================================
// MIDDLEWARE
// ============================================
app.use(helmet());
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(generalLimiter);

// ============================================
// WEBSOCKET
// ============================================
const clients = new Map();

wss.on('connection', function connection(ws) {
  const clientId = Math.random().toString(36).substring(7);
  clients.set(clientId, ws);
  
  console.log(`Client ${clientId} connected`);
  
  ws.send(JSON.stringify({
    type: 'connection',
    message: 'Connected to ASOS Scraper API',
    timestamp: new Date().toISOString()
  }));
  
  ws.on('close', () => {
    clients.delete(clientId);
    console.log(`Client ${clientId} disconnected`);
  });
});

function broadcastProgress(data) {
  const message = JSON.stringify({
    ...data,
    timestamp: new Date().toISOString()
  });
  
  clients.forEach((ws) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(message);
    }
  });
}

// ============================================
// SUPABASE (OPTIONAL)
// ============================================
const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// ============================================
// ASOS CATEGORIES
// ============================================
const ASOS_CATEGORIES = {
  women: {
    name: "Women",
    url: "/women/",
    subcategories: {
      clothing: {
        name: "Clothing",
        url: "/women/ctas/clothing/cat/?cid=3934",
        subcategories: {
          tops: {
            name: "Tops",
            url: "/women/tops/cat/?cid=4169",
            subcategories: {
              "t-shirts": { name: "T-Shirts", url: "/women/t-shirts-vests/cat/?cid=4718" },
              "shirts": { name: "Shirts", url: "/women/shirts/cat/?cid=15200" },
              "blouses": { name: "Blouses", url: "/women/blouses/cat/?cid=15199" },
              "crop-tops": { name: "Crop Tops", url: "/women/top/cat/?cid=15196" },
            }
          }
        }
      }
    }
  },
  men: {
    name: "Men",
    url: "/men/",
    subcategories: {
      clothing: {
        name: "Clothing",
        url: "/men/ctas/clothing/cat/?cid=1059",
        subcategories: {
          tops: {
            name: "Tops",
            url: "/men/t-shirts-vests/cat/?cid=7616",
            subcategories: {
              "t-shirts": { name: "T-Shirts & Vests", url: "/men/t-shirts-vests/cat/?cid=7616" },
              "shirts": { name: "Shirts", url: "/men/shirts/cat/?cid=3602" },
            }
          }
        }
      }
    }
  }
};

// ============================================
// HELPER FUNCTIONS
// ============================================
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

const randomDelay = (min = 1000, max = 3000) => 
  new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));

async function simulateHumanBehavior(page) {
  await page.mouse.move(Math.random() * 1920, Math.random() * 1080);
  await randomDelay(500, 1500);
  
  await page.evaluate(() => {
    window.scrollBy(0, Math.random() * 500);
  });
  await randomDelay(1000, 2000);
}

function getCategoryPath(categories, targetPath) {
  const pathParts = targetPath.split('.');
  let current = categories;
  
  for (const part of pathParts) {
    if (current[part]) {
      current = current[part];
    } else {
      return null;
    }
  }
  
  return current;
}

function buildCategoryBreadcrumb(categoryPath) {
  const parts = categoryPath.split('.');
  const breadcrumb = [];
  
  let current = ASOS_CATEGORIES;
  for (const part of parts) {
    if (current[part]) {
      current = current[part];
      breadcrumb.push(current.name || part);
    }
  }
  
  return breadcrumb.join(' > ');
}

// ============================================
// SCRAPING FUNCTIONS
// ============================================
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

async function loadAllProducts(page) {
  let lastCount = 0, clicks = 0;
  
  while (true) {
    const currentCount = await page.$$eval("li.productTile_U0clN, [data-testid='product-tile']", (els) => els.length).catch(() => 0);
    if (currentCount === lastCount) break;
    lastCount = currentCount;

    const btn = await page.$("a.loadButton_wWQ3F, [data-testid='load-more-button'], button:has-text('Load More')");
    if (!btn) break;

    clicks++;
    await btn.click();
    await randomDelay(3000, 5000);
  }
}

async function scrapeProduct(browser, link, index, total, categoryInfo = null, saveToDb = false) {
  const page = await browser.newPage();
  
  try {
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
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
      const priceValue = price ? parseFloat(price.replace(/[^\d.]/g, "")) : null;
      const stock_status = safeText("[data-testid='stock-availability']") || "Available";
      const availability = !stock_status.toLowerCase().includes('out of stock');

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

      let brand = null;
      const brandBlock = document.querySelector("#productDescriptionBrand .F_yfF");
      if (brandBlock) {
        const strong = brandBlock.querySelector("strong");
        brand = strong ? strong.innerText.trim() : brandBlock.innerText.trim();
      }

      let category = "";
      const catLink = document.querySelector("#productDescriptionDetails a[href*='/cat/']");
      if (catLink) category = catLink.innerText.trim();

      const materialsText = document.querySelector("#productDescriptionAboutMe .F_yfF")?.innerText.trim() || null;
      
      let care_info = null;
      const careSelectors = [
        "#productDescriptionCareInfo .F_yfF",
        "[data-testid='productDescriptionCareInfo'] .F_yfF",
      ];

      for (const selector of careSelectors) {
        const element = document.querySelector(selector);
        if (element && element.innerText.trim()) {
          care_info = element.innerText.trim().replace(/\s+/g, " ");
          break;
        }
      }

      let size = [];
      document.querySelectorAll("#variantSelector option").forEach((opt) => {
        if (opt.value) size.push(opt.innerText.trim());
      });

      const images = Array.from(document.querySelectorAll("#core-product img"))
        .map((img) => img.src.replace(/\?[^ ]*$/, ""))
        .map((src) => `${src}?$n_960w$&wid=960&fit=constrain`)
        .filter((src) => src.includes("asos-media"));

      const urlParts = window.location.pathname.split('/');
      let product_id = null;
      for (let part of urlParts) {
        if (part.includes('prd')) {
          const idMatch = part.match(/(\d+)/);
          if (idMatch) {
            product_id = parseInt(idMatch[1]);
            break;
          }
        }
      }

      return {
        name,
        description,
        brand,
        category,
        price: priceValue,
        currency,
        stock_status,
        availability,
        materials: materialsText,
        care_info,
        size: size.length > 0 ? size : null,
        color: colors.join(", "),
        images,
        product_url: window.location.href,
        product_id: product_id || Math.floor(Math.random() * 1000000000),
      };
    });

    if (categoryInfo) {
      data.scraped_category = categoryInfo.breadcrumb;
      data.category_path = categoryInfo.path;
      data.scrape_type = 'ASOS Category';
    } else {
      data.scrape_type = 'ASOS Search';
    }

    // Only save to DB if explicitly requested
    if (saveToDb && supabase) {
      try {
        const { error } = await supabase.rpc("upsert_zara_product_v6", {
          p_id: null,
          p_product_name: data.name,
          p_price: data.price,
          p_colour: data.color,
          p_description: data.description,
          p_size: data.size || ['One Size'],
          p_materials: data.materials ? [JSON.stringify({ description: data.materials })] : null,
          p_availability: data.availability,
          p_category_id: 0,
          p_product_id: data.product_id,
          p_colour_code: Math.floor(Math.random() * 1000),
          p_section: null,
          p_product_family: data.category?.toUpperCase() || "CLOTHING",
          p_product_family_en: data.category || "Clothing",
          p_product_subfamily: null,
          p_care: data.care_info ? JSON.stringify({ info: data.care_info }) : null,
          p_materials_description: data.materials,
          p_dimension: null,
          p_low_on_stock: !data.availability,
          p_sku: null,
          p_url: data.product_url,
          p_currency: data.currency,
          p_image: data.images?.length > 0 ? JSON.stringify(data.images.map(url => ({ url }))) : null,
          p_you_may_also_like: null,
          p_category_path: data.category_path || null,
          p_scraped_category: data.scraped_category || null,
          p_scrape_type: data.scrape_type || "ASOS",
          p_brand: data.brand,
          p_category: data.category,
          p_stock_status: data.stock_status,
          p_color: data.color,
          p_images: data.images?.length > 0 ? JSON.stringify(data.images.map(url => ({ url }))) : null,
          p_product_url: data.product_url,
          p_care_info: data.care_info
        });
        
        if (error) console.error('DB save error:', error);
      } catch (e) {
        console.error('DB operation failed:', e);
      }
    }

    return data;
  } catch (err) {
    console.error(`Failed to scrape product ${index + 1}:`, err);
    return null;
  } finally {
    await page.close();
  }
}

async function scrapeASOS(searchTerm = null, categoryPath = null, options = { mode: "limit", limit: 5 }, concurrency = 5, saveToDb = false) {
  const isSearchMode = !!searchTerm;
  const isCategoryMode = !!categoryPath;
  
  if (!isSearchMode && !isCategoryMode) {
    throw new Error('Either searchTerm or categoryPath must be provided');
  }

  const browser = await browserPool.getBrowser();
  const page = await browser.newPage();
  
  try {
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
    });

    await page.goto('https://www.asos.com', {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });
    
    await randomDelay(2000, 4000);
    await simulateHumanBehavior(page);
    
    let targetUrl;
    let categoryInfo = null;
    
    if (isSearchMode) {
      targetUrl = `https://www.asos.com/search/?q=${encodeURIComponent(searchTerm)}`;
    } else {
      const category = getCategoryPath(ASOS_CATEGORIES, categoryPath);
      if (!category || !category.url) {
        throw new Error(`Invalid category path: ${categoryPath}`);
      }
      
      targetUrl = `https://www.asos.com${category.url}`;
      const breadcrumb = buildCategoryBreadcrumb(categoryPath);
      categoryInfo = { breadcrumb, path: categoryPath };
    }
    
    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });

    await randomDelay(3000, 5000);
    await simulateHumanBehavior(page);

    const selectors = [
      'li.productTile_U0clN',
      '[data-testid="product-tile"]',
      '.product-tile',
      'article[data-testid="product-tile"]'
    ];

    let productSelector = null;
    for (const selector of selectors) {
      try {
        await page.waitForSelector(selector, { timeout: 15000 });
        productSelector = selector;
        break;
      } catch (e) {
        continue;
      }
    }

    if (!productSelector) {
      throw new Error('Could not find product tiles');
    }

    if (options.mode === "full" || options.mode === "range") {
      await loadAllProducts(page);
    }

    // FIXED: Use $$eval correctly with Array.from
    let productLinks = [];
    
    // Try direct link extraction with $$eval
    try {
      productLinks = await page.$$eval(
        `${productSelector} a[href*="/prd/"]`,
        (links) => Array.from(links).map(a => a.href).filter(href => href && href.includes('/prd/'))
      );
    } catch (e) {
      console.log('Direct link extraction failed, trying alternative method...');
    }

    // Fallback: Try broader selectors
    if (productLinks.length === 0) {
      try {
        productLinks = await page.$$eval(
          `${productSelector} a`,
          (links) => Array.from(links)
            .map(a => a.href)
            .filter(href => href && href.includes('/prd/'))
        );
      } catch (e) {
        console.log('Fallback link extraction also failed');
      }
    }

    // Last resort: Evaluate in page context
    if (productLinks.length === 0) {
      productLinks = await page.evaluate(() => {
        const links = [];
        const allAs = document.querySelectorAll('a');
        allAs.forEach(a => {
          if (a.href && a.href.includes('/prd/')) {
            links.push(a.href);
          }
        });
        return [...new Set(links)];
      });
    }

    if (productLinks.length === 0) {
      // Debug information
      const pageInfo = await page.evaluate(() => ({
        title: document.title,
        url: window.location.href,
        productTileCount: document.querySelectorAll('li.productTile_U0clN, [data-testid="product-tile"]').length,
        allLinksCount: document.querySelectorAll('a').length
      }));
      
      console.error('Debug info:', pageInfo);
      throw new Error('No product links found');
    }

    // Determine which products to scrape based on mode
    let linksToScrape = [];
    if (options.mode === "limit") {
      linksToScrape = productLinks.slice(0, options.limit);
    } else if (options.mode === "range") {
      linksToScrape = productLinks.slice(options.startIndex, options.endIndex);
    } else {
      linksToScrape = productLinks;
    }

    console.log(`Found ${productLinks.length} products, scraping ${linksToScrape.length}`);

    // Close the listing page
    await page.close();

    // Scrape products in batches
    const results = [];
    
    for (let i = 0; i < linksToScrape.length; i += concurrency) {
      const batch = linksToScrape.slice(i, i + concurrency);
      
      const scrapedBatch = await Promise.allSettled(
        batch.map((link, batchIndex) => 
          scrapeProduct(browser, link, i + batchIndex, linksToScrape.length, categoryInfo, saveToDb)
        )
      );
      
      scrapedBatch.forEach((res) => {
        if (res.status === "fulfilled" && res.value) {
          results.push(res.value);
        }
      });
      
      if (i + concurrency < linksToScrape.length) {
        await randomDelay(2000, 4000);
      }
    }

    return results;
    
  } catch (error) {
    throw error;
  } finally {
    // Make sure page is closed
    if (!page.isClosed()) {
      await page.close();
    }
    // Release browser back to pool
    browserPool.releaseBrowser(browser);
  }
}

// ============================================
// API ROUTES
// ============================================

app.get(`/api/${API_VERSION}/health`, (req, res) => {
  const poolStats = browserPool.getStats();
  res.json({ 
    success: true,
    status: 'healthy',
    version: API_VERSION,
    timestamp: new Date().toISOString(),
    browserPool: poolStats
  });
});

app.get(`/api/${API_VERSION}/categories`, (req, res) => {
  res.json({ 
    success: true, 
    version: API_VERSION,
    categories: ASOS_CATEGORIES 
  });
});

// Search products - JSON only (no DB save)
app.post(`/api/${API_VERSION}/products/search`, scrapeLimiter, rapidAPIRateLimit, async (req, res) => {
  const { searchTerm, mode = "limit", limit = 5, startIndex, endIndex, concurrency = 5, saveToDb = false } = req.body;
  
  if (!searchTerm) {
    return res.status(400).json({ 
      success: false, 
      error: 'searchTerm is required',
      example: {
        searchTerm: "dress",
        mode: "limit",
        limit: 10,
        saveToDb: false
      }
    });
  }

  const maxLimit = 50;
  const maxConcurrency = 10;
  const effectiveLimit = Math.min(limit, maxLimit);
  const effectiveConcurrency = Math.min(concurrency, maxConcurrency);

  try {
    const results = await scrapeASOS(
      searchTerm,
      null,
      { mode, limit: effectiveLimit, startIndex, endIndex },
      effectiveConcurrency,
      saveToDb
    );
    
    res.json({ 
      success: true,
      version: API_VERSION,
      type: 'search',
      query: searchTerm,
      mode,
      count: results.length,
      savedToDatabase: saveToDb,
      results
    });
  } catch (err) {
    console.error('Search scraping error:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message,
      type: 'search_error'
    });
  }
});

// Scrape by category - JSON only (no DB save by default)
app.post(`/api/${API_VERSION}/products/category`, scrapeLimiter, rapidAPIRateLimit, async (req, res) => {
  const { categoryPath, mode = "limit", limit = 5, startIndex, endIndex, concurrency = 5, saveToDb = false } = req.body;
  
  if (!categoryPath) {
    return res.status(400).json({ 
      success: false, 
      error: 'categoryPath is required',
      example: {
        categoryPath: "women.clothing.tops.t-shirts",
        mode: "limit",
        limit: 10,
        saveToDb: false
      }
    });
  }

  const category = getCategoryPath(ASOS_CATEGORIES, categoryPath);
  if (!category) {
    return res.status(400).json({ 
      success: false, 
      error: `Invalid category path: ${categoryPath}`,
      hint: `Use GET /api/${API_VERSION}/categories to see available categories`
    });
  }

  const maxLimit = 50;
  const maxConcurrency = 10;
  const effectiveLimit = Math.min(limit, maxLimit);
  const effectiveConcurrency = Math.min(concurrency, maxConcurrency);

  try {
    const results = await scrapeASOS(
      null,
      categoryPath,
      { mode, limit: effectiveLimit, startIndex, endIndex },
      effectiveConcurrency,
      saveToDb
    );
    
    res.json({ 
      success: true,
      version: API_VERSION,
      type: 'category',
      categoryName: buildCategoryBreadcrumb(categoryPath),
      categoryPath,
      mode,
      count: results.length,
      savedToDatabase: saveToDb,
      results
    });
  } catch (err) {
    console.error('Category scraping error:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message,
      type: 'category_error'
    });
  }
});

// Get browser pool stats
app.get(`/api/${API_VERSION}/admin/pool-stats`, (req, res) => {
  const stats = browserPool.getStats();
  res.json({
    success: true,
    version: API_VERSION,
    poolStats: stats,
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'ASOS Product Scraper API',
    version: API_VERSION,
    status: 'active',
    endpoints: {
      health: `GET /api/${API_VERSION}/health`,
      categories: `GET /api/${API_VERSION}/categories`,
      searchProducts: `POST /api/${API_VERSION}/products/search`,
      categoryProducts: `POST /api/${API_VERSION}/products/category`,
      poolStats: `GET /api/${API_VERSION}/admin/pool-stats`
    },
    features: [
      'Browser pool management for efficient scraping',
      'Rate limiting protection',
      'WebSocket real-time updates',
      'Optional database saving',
      'Category and search-based scraping'
    ],
    usage: {
      search: {
        endpoint: `POST /api/${API_VERSION}/products/search`,
        body: {
          searchTerm: "dress",
          mode: "limit",
          limit: 10,
          saveToDb: false
        }
      },
      category: {
        endpoint: `POST /api/${API_VERSION}/products/category`,
        body: {
          categoryPath: "women.clothing.tops.t-shirts",
          mode: "limit",
          limit: 10,
          saveToDb: false
        }
      }
    }
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await browserPool.cleanup();
  server.close(() => {
    console.log('HTTP server closed');
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  await browserPool.cleanup();
  server.close(() => {
    console.log('HTTP server closed');
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 ASOS Scraper API v${API_VERSION} running at http://localhost:${PORT}`);
  console.log(`🔌 WebSocket server running on ws://localhost:${PORT}`);
  console.log(`🏊 Browser pool initializing...`);
  console.log(`\n📖 API Documentation:`);
  console.log(`   - Health Check: GET http://localhost:${PORT}/api/${API_VERSION}/health`);
  console.log(`   - Categories: GET http://localhost:${PORT}/api/${API_VERSION}/categories`);
  console.log(`   - Search Products: POST http://localhost:${PORT}/api/${API_VERSION}/products/search`);
  console.log(`   - Category Products: POST http://localhost:${PORT}/api/${API_VERSION}/products/category`);
  console.log(`\n💡 Note: By default, products are returned as JSON without saving to database.`);
  console.log(`   Set "saveToDb: true" in request body to enable database saving.`);
});