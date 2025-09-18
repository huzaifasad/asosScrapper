import express from "express";
import puppeteer from "puppeteer";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
import cors from "cors";
import { WebSocketServer } from 'ws';
import http from 'http';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Store active WebSocket connections
const clients = new Map();
//https://www.asos.com/women/tops/t-shirts-vests/cat/?cid=4718#ctaref-cat_header
// ASOS Category Structure
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
              //https://www.asos.com/women/tops/shirts/cat/?cid=15200#ctaref-cat_header
              "shirts": { name: "Shirts", url: "/women/shirts/cat/?cid=15200" },
              "shirts-blouses": { name: "Blouses", url: "/women/blouses/cat/?cid=15199" },
              "blazers": { name: "Blazers", url: "/women/blazers/cat/?cid=7618" },//move outside tops inside women direct 
              "jackets": { name: "Jackets & Coats", url: "/women/jackets-coats/cat/?cid=2641" },//move outsite tops inside woment direct
              "knitwear": { name: "Knitwear", url: "/women/knitwear/cat/?cid=2637" },//move outsite tops inside woment direct
              "crop-tops": { name: "Crop Tops", url: "/women/top/cat/?cid=15196" },//15196
              "bodysuits": { name: "Bodysuits", url: "/women/top/bodysuits/cat/?cid=11323" }
            }
          },
          bottoms: {
            name: "Bottoms",
            url: "/women/trousers-leggings/cat/?cid=2640",
            subcategories: {
              "jeans": { name: "Jeans", url: "/women/jeans/cat/?cid=2639" },
              "trousers": { name: "Trousers", url: "/women/trousers-leggings/cat/?cid=2640" },
              "skirts": { name: "Skirts", url: "/women/skirts/cat/?cid=2639" },
              "shorts": { name: "Shorts", url: "/women/shorts/cat/?cid=7078" },
              "leggings": { name: "Leggings", url: "/women/leggings/cat/?cid=6463" }
            }
          },
          dresses: {
            name: "Dresses",
            url: "/women/dresses/cat/?cid=8799",
            subcategories: {
              "casual-dresses": { name: "Casual Dresses", url: "/women/day-dresses/cat/?cid=8799" },
              "evening-dresses": { name: "Evening Dresses", url: "/women/going-out-dresses/cat/?cid=8799" },
              "midi-dresses": { name: "Midi Dresses", url: "/women/midi-dresses/cat/?cid=15210" },
              "maxi-dresses": { name: "Maxi Dresses", url: "/women/maxi-dresses/cat/?cid=15156" },
              "mini-dresses": { name: "Mini Dresses", url: "/women/mini-dresses/cat/?cid=15947" }
            }
          }
        }
      },
      shoes: {
        name: "Shoes",
        url: "/women/shoes/cat/?cid=4172",
        subcategories: {
          "trainers": { name: "Trainers", url: "/women/trainers/cat/?cid=5775" },
          "heels": { name: "Heels", url: "/women/heels/cat/?cid=4174" },
          "flats": { name: "Flats", url: "/women/flat-shoes/cat/?cid=5834" },
          "boots": { name: "Boots", url: "/women/boots/cat/?cid=4175" },
          "sandals": { name: "Sandals", url: "/women/sandals/cat/?cid=4176" },
          "wedges": { name: "Wedges", url: "/women/wedges/cat/?cid=6992" }
        }
      },
      accessories: {
        name: "Accessories",
        url: "/women/accessories/cat/?cid=4210",
        subcategories: {
          "bags": { name: "Bags & Handbags", url: "/women/bags-purses/cat/?cid=8730" },
          "jewelry": { name: "Jewelry", url: "/women/jewelry/cat/?cid=4231" },
          "belts": { name: "Belts", url: "/women/belts/cat/?cid=4177" },
          "scarves": { name: "Scarves & Wraps", url: "/women/scarves-wraps/cat/?cid=4178" },
          "hats": { name: "Hats & Caps", url: "/women/hats/cat/?cid=6992" },
          "sunglasses": { name: "Sunglasses", url: "/women/sunglasses/cat/?cid=6519" }
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
              "polo-shirts": { name: "Polo Shirts", url: "/men/polo-shirts/cat/?cid=4616" },
              "hoodies": { name: "Hoodies & Sweatshirts", url: "/men/hoodies-sweatshirts/cat/?cid=5668" },
              "knitwear": { name: "Knitwear", url: "/men/knitwear/cat/?cid=7617" },
              "tank-tops": { name: "Tank Tops", url: "/men/vest-tops/cat/?cid=13210" }
            }
          },
          bottoms: {
            name: "Bottoms",
            url: "/men/trousers-chinos/cat/?cid=4910",
            subcategories: {
              "jeans": { name: "Jeans", url: "/men/jeans/cat/?cid=4208" },
              "trousers": { name: "Trousers & Chinos", url: "/men/trousers-chinos/cat/?cid=4910" },
              "shorts": { name: "Shorts", url: "/men/shorts/cat/?cid=7078" },
              "joggers": { name: "Joggers", url: "/men/joggers/cat/?cid=26090" },
              "cargo-pants": { name: "Cargo Pants", url: "/men/cargo-trousers/cat/?cid=18797" }
            }
          },
          outerwear: {
            name: "Jackets & Coats",
            url: "/men/jackets-coats/cat/?cid=3606",
            subcategories: {
              "jackets": { name: "Jackets", url: "/men/jackets/cat/?cid=3606" },
              "coats": { name: "Coats", url: "/men/coats/cat/?cid=12181" },
              "blazers": { name: "Blazers", url: "/men/blazers/cat/?cid=12103" },
              "bombers": { name: "Bomber Jackets", url: "/men/bomber-jackets/cat/?cid=13210" }
            }
          }
        }
      },
      shoes: {
        name: "Shoes",
        url: "/men/shoes/cat/?cid=4209",
        subcategories: {
          "trainers": { name: "Trainers", url: "/men/trainers/cat/?cid=5775" },
          "boots": { name: "Boots", url: "/men/boots/cat/?cid=4212" },
          "formal-shoes": { name: "Formal Shoes", url: "/men/formal-shoes/cat/?cid=5770" },
          "casual-shoes": { name: "Casual Shoes", url: "/men/casual-shoes/cat/?cid=1935" },
          "sandals": { name: "Sandals & Flip Flops", url: "/men/sandals-flip-flops/cat/?cid=4213" }
        }
      },
      accessories: {
        name: "Accessories",
        url: "/men/accessories/cat/?cid=4210",
        subcategories: {
          "bags": { name: "Bags", url: "/men/bags/cat/?cid=9265" },
          "belts": { name: "Belts", url: "/men/belts/cat/?cid=4251" },
          "hats": { name: "Hats & Caps", url: "/men/hats-caps/cat/?cid=6102" },
          "watches": { name: "Watches", url: "/men/watches/cat/?cid=4252" },
          "jewelry": { name: "Jewelry", url: "/men/jewelry/cat/?cid=4253" },
          "sunglasses": { name: "Sunglasses", url: "/men/sunglasses/cat/?cid=6519" }
        }
      }
    }
  }
};

// WebSocket connection handling
wss.on('connection', function connection(ws) {
  const clientId = Math.random().toString(36).substring(7);
  clients.set(clientId, ws);
  
  console.log(`Client ${clientId} connected`);
  
  ws.send(JSON.stringify({
    type: 'connection',
    message: 'Connected to scraper',
    timestamp: new Date().toISOString()
  }));
  
  ws.on('close', () => {
    clients.delete(clientId);
    console.log(`Client ${clientId} disconnected`);
  });
});

// Function to broadcast progress to all connected clients
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
  await page.mouse.move(Math.random() * 1920, Math.random() * 1080);
  await randomDelay(500, 1500);
  
  await page.evaluate(() => {
    window.scrollBy(0, Math.random() * 500);
  });
  await randomDelay(1000, 2000);
}

// Function to get category path from categories object
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

// Function to build category breadcrumb
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

// Accordion expander
async function expandAccordions(page) {
  broadcastProgress({
    type: 'info',
    message: 'Expanding product details accordion...'
  });
  
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
  
  broadcastProgress({
    type: 'info',
    message: 'Loading all products from category...'
  });
  
  while (true) {
    const currentCount = await page.$$eval("li.productTile_U0clN, [data-testid='product-tile']", (els) => els.length).catch(() => 0);
    if (currentCount === lastCount) break;
    lastCount = currentCount;

    const btn = await page.$("a.loadButton_wWQ3F, [data-testid='load-more-button'], button:has-text('Load More')");
    if (!btn) break;

    clicks++;
    broadcastProgress({
      type: 'progress',
      message: `Loading more products... (Click ${clicks} - Total visible: ${currentCount})`
    });
    
    await btn.click();
    await randomDelay(3000, 5000);
  }
  
  broadcastProgress({
    type: 'success',
    message: `Finished loading all products. Total visible: ${lastCount}`
  });
}

// Scrape one product page
async function scrapeProduct(browser, link, index, total, categoryInfo = null) {
  const page = await browser.newPage();
  
  try {
    broadcastProgress({
      type: 'progress',
      message: `Scraping product ${index + 1} of ${total}...`,
      progress: {
        current: index + 1,
        total: total,
        percentage: Math.round(((index + 1) / total) * 100)
      }
    });
    
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

    // Add category information if provided
    if (categoryInfo) {
      data.scraped_category = categoryInfo.breadcrumb;
      data.category_path = categoryInfo.path;
      data.scrape_type = 'category';
    } else {
      data.scrape_type = 'search';
    }

    // Insert into Supabase
    const { error } = await supabase.from("products").insert(data);
    if (error) {
      broadcastProgress({
        type: 'error',
        message: `Failed to save "${data.name}" to database: ${error.message}`
      });
    } else {
      broadcastProgress({
        type: 'success',
        message: `Successfully saved "${data.name}" to database${categoryInfo ? ` (Category: ${categoryInfo.breadcrumb})` : ''}`,
        productData: {
          name: data.name,
          price: data.price,
          currency: data.currency,
          brand: data.brand,
          category: categoryInfo?.breadcrumb
        }
      });
    }

    return data;
  } catch (err) {
    broadcastProgress({
      type: 'error',
      message: `Failed to scrape product ${index + 1}: ${err.message}`
    });
    return null;
  } finally {
    await page.close();
  }
}

// Main scraper function (updated to handle both search and category)
async function scrapeASOS(searchTerm = null, categoryPath = null, options = { mode: "limit", limit: 5 }, concurrency = 5) {
  const isSearchMode = !!searchTerm;
  const isCategoryMode = !!categoryPath;
  
  if (!isSearchMode && !isCategoryMode) {
    throw new Error('Either searchTerm or categoryPath must be provided');
  }

  if (isSearchMode) {
    broadcastProgress({
      type: 'info',
      message: `Starting search scraper for "${searchTerm}" in ${options.mode} mode...`
    });
  } else {
    const categoryInfo = getCategoryPath(ASOS_CATEGORIES, categoryPath);
    const breadcrumb = buildCategoryBreadcrumb(categoryPath);
    broadcastProgress({
      type: 'info',
      message: `Starting category scraper for "${breadcrumb}" in ${options.mode} mode...`
    });
  }
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu',
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

  broadcastProgress({
    type: 'success',
    message: 'Browser launched successfully'
  });

  const page = await browser.newPage();
  
  try {
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
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

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
      
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
    });

    broadcastProgress({
      type: 'info',
      message: 'Navigating to ASOS homepage...'
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
      broadcastProgress({
        type: 'info',
        message: `Navigating to search page for "${searchTerm}"...`
      });
    } else {
      const category = getCategoryPath(ASOS_CATEGORIES, categoryPath);
      if (!category || !category.url) {
        throw new Error(`Invalid category path: ${categoryPath}`);
      }
      
      targetUrl = `https://www.asos.com${category.url}`;
      const breadcrumb = buildCategoryBreadcrumb(categoryPath);
      categoryInfo = { breadcrumb, path: categoryPath };
      
      broadcastProgress({
        type: 'info',
        message: `Navigating to category page: "${breadcrumb}"...`
      });
    }
    
    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });

    await randomDelay(3000, 5000);
    await simulateHumanBehavior(page);

    const currentUrl = page.url();
    broadcastProgress({
      type: 'info',
      message: `Successfully navigated to: ${currentUrl}`
    });
    
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
        broadcastProgress({
          type: 'info',
          message: `Looking for products using selector: ${selector}`
        });
        await page.waitForSelector(selector, { timeout: 15000 });
        productSelector = selector;
        broadcastProgress({
          type: 'success',
          message: `Found products using selector: ${selector}`
        });
        break;
      } catch (e) {
        broadcastProgress({
          type: 'warning',
          message: `Selector ${selector} not found, trying next...`
        });
      }
    }

    if (!productSelector) {
      try {
        await page.screenshot({ path: 'debug-screenshot.png', fullPage: true });
        broadcastProgress({
          type: 'info',
          message: 'Debug screenshot saved as debug-screenshot.png'
        });
      } catch (e) {
        broadcastProgress({
          type: 'warning',
          message: 'Could not take screenshot'
        });
      }
      
      const pageTitle = await page.title();
      broadcastProgress({
        type: 'info',
        message: `Page title: ${pageTitle}`
      });
      
      throw new Error('Could not find product tiles with any selector. Check debug-screenshot.png for more info.');
    }

    if (options.mode === "full" || options.mode === "range") {
      await loadAllProducts(page);
    }

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
          broadcastProgress({
            type: 'success',
            message: `Found ${productLinks.length} product links`
          });
          break;
        }
      } catch (e) {
        broadcastProgress({
          type: 'warning',
          message: `Failed to get links with selector: ${linkSel}`
        });
      }
    }

    if (productLinks.length === 0) {
      throw new Error('No product links found');
    }

    let linksToScrape = [];
    if (options.mode === "limit") {
      linksToScrape = productLinks.slice(0, options.limit);
      broadcastProgress({
        type: 'info',
        message: `Using limit mode: scraping first ${options.limit} products out of ${productLinks.length} available`
      });
    } else if (options.mode === "range") {
      linksToScrape = productLinks.slice(options.startIndex, options.endIndex);
      broadcastProgress({
        type: 'info',
        message: `Using range mode: scraping products ${options.startIndex}-${options.endIndex} out of ${productLinks.length} available`
      });
    } else {
      linksToScrape = productLinks;
      broadcastProgress({
        type: 'info',
        message: `Using full mode: scraping all ${productLinks.length} products`
      });
    }

    broadcastProgress({
      type: 'info',
      message: `Starting to scrape ${linksToScrape.length} products with concurrency = ${concurrency}`
    });

    const results = [];
    let processedCount = 0;
    
    for (let i = 0; i < linksToScrape.length; i += concurrency) {
      const batch = linksToScrape.slice(i, i + concurrency);
      
      broadcastProgress({
        type: 'info',
        message: `Processing batch ${Math.floor(i / concurrency) + 1} of ${Math.ceil(linksToScrape.length / concurrency)} (${batch.length} products)`
      });
      
      const scrapedBatch = await Promise.allSettled(
        batch.map((link, batchIndex) => scrapeProduct(browser, link, i + batchIndex, linksToScrape.length, categoryInfo))
      );
      
      scrapedBatch.forEach((res, batchIndex) => {
        processedCount++;
        if (res.status === "fulfilled" && res.value) {
          results.push(res.value);
        }
      });
      
      broadcastProgress({
        type: 'progress',
        message: `Completed batch ${Math.floor(i / concurrency) + 1}. Total processed: ${processedCount}/${linksToScrape.length}`,
        progress: {
          current: processedCount,
          total: linksToScrape.length,
          percentage: Math.round((processedCount / linksToScrape.length) * 100)
        }
      });
      
      if (i + concurrency < linksToScrape.length) {
        await randomDelay(2000, 4000);
      }
    }

    await browser.close();
    
    const finalMessage = isSearchMode 
      ? `Search scraping completed for "${searchTerm}"! Successfully processed ${results.length} out of ${linksToScrape.length} products`
      : `Category scraping completed for "${categoryInfo.breadcrumb}"! Successfully processed ${results.length} out of ${linksToScrape.length} products`;
    
    broadcastProgress({
      type: 'success',
      message: finalMessage,
      finalStats: {
        totalFound: productLinks.length,
        totalAttempted: linksToScrape.length,
        totalSuccessful: results.length,
        totalFailed: linksToScrape.length - results.length,
        mode: options.mode,
        searchTerm: searchTerm,
        categoryPath: categoryPath,
        categoryName: categoryInfo?.breadcrumb,
        scrapeType: isSearchMode ? 'search' : 'category'
      }
    });
    
    return results;
    
  } catch (error) {
    try {
      await page.screenshot({ path: 'error-screenshot.png', fullPage: true });
      broadcastProgress({
        type: 'info',
        message: 'Error screenshot saved as error-screenshot.png'
      });
    } catch (e) {
      broadcastProgress({
        type: 'warning',
        message: 'Could not take error screenshot'
      });
    }
    
    await browser.close();
    
    broadcastProgress({
      type: 'error',
      message: `Scraping failed: ${error.message}`
    });
    
    throw error;
  }
}

// API endpoint to get category structure
app.get("/categories", (req, res) => {
  broadcastProgress({
    type: 'info',
    message: 'Categories structure requested'
  });
  
  res.json({ success: true, categories: ASOS_CATEGORIES });
});

// API endpoint for search-based scraping
app.post("/scrape", async (req, res) => {
  broadcastProgress({
    type: 'info',
    message: 'Search scrape request received',
    requestData: req.body
  });
  
  const { searchTerm, mode, limit, startIndex, endIndex, concurrency } = req.body;
  
  if (!searchTerm) {
    const errorMsg = "searchTerm is required for search scraping";
    broadcastProgress({
      type: 'error',
      message: errorMsg
    });
    return res.status(400).json({ success: false, error: errorMsg });
  }

  try {
    const results = await scrapeASOS(
      searchTerm, // searchTerm
      null, // categoryPath
      { mode, limit, startIndex, endIndex },
      concurrency || 5
    );
    
    res.json({ success: true, count: results.length, results, type: 'search' });
  } catch (err) {
    broadcastProgress({
      type: 'error',
      message: `Fatal error in search scraping: ${err.message}`
    });
    res.status(500).json({ success: false, error: err.message });
  }
});

// API endpoint for category-based scraping
app.post("/scrape-category", async (req, res) => {
  broadcastProgress({
    type: 'info',
    message: 'Category scrape request received',
    requestData: req.body
  });
  
  const { categoryPath, mode, limit, startIndex, endIndex, concurrency } = req.body;
  
  if (!categoryPath) {
    const errorMsg = "categoryPath is required for category scraping";
    broadcastProgress({
      type: 'error',
      message: errorMsg
    });
    return res.status(400).json({ success: false, error: errorMsg });
  }

  // Validate category path
  const category = getCategoryPath(ASOS_CATEGORIES, categoryPath);
  if (!category) {
    const errorMsg = `Invalid category path: ${categoryPath}`;
    broadcastProgress({
      type: 'error',
      message: errorMsg
    });
    return res.status(400).json({ success: false, error: errorMsg });
  }

  try {
    const results = await scrapeASOS(
      null, // searchTerm
      categoryPath, // categoryPath
      { mode, limit, startIndex, endIndex },
      concurrency || 5
    );
    
    res.json({ 
      success: true, 
      count: results.length, 
      results, 
      type: 'category',
      categoryName: buildCategoryBreadcrumb(categoryPath),
      categoryPath: categoryPath
    });
  } catch (err) {
    broadcastProgress({
      type: 'error',
      message: `Fatal error in category scraping: ${err.message}`
    });
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ message: "everything is working" });
});

const PORT = 4000;
server.listen(PORT, () => {
  console.log(`🚀 API running at http://localhost:${PORT}`);
  console.log(`🔌 WebSocket server running on ws://localhost:${PORT}`);
  console.log(`📂 Categories API available at http://localhost:${PORT}/categories`);
});