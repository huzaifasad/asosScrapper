import express from "express";
import puppeteer from "puppeteer";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
import cors from "cors"; // 👈 Import the cors package


const app = express();

// 👇 Use CORS middleware
app.use(cors({
  origin: "*", // Allow only your frontend
}));
app.use(express.json());
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Sleep helper
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

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
          await sleep(300);
        }
      }
    } catch {}
  }
}

// Load all products
async function loadAllProducts(page) {
  let lastCount = 0, clicks = 0;
  while (true) {
    const currentCount = await page.$$eval("li.productTile_U0clN", (els) => els.length);
    if (currentCount === lastCount) break;
    lastCount = currentCount;

    const btn = await page.$("a.loadButton_wWQ3F");
    if (!btn) break;

    clicks++;
    console.log(`🔄 Clicking "Load more" (${clicks})`);
    await btn.click();
    await sleep(3500);
  }
  console.log(`✅ Finished loading, total visible: ${lastCount}`);
}

// Scrape one product page
async function scrapeProduct(browser, link) {
  const page = await browser.newPage();
  try {
    await page.goto(link, { waitUntil: "networkidle2", timeout: 0 });
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
  .map((img) => img.src.replace(/\?[^ ]*$/, "")) // strip query
  .map((src) => `${src}?$n_960w$&wid=960&fit=constrain`) // enforce hi-res
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

// Main scraper
async function scrapeASOS(searchTerm, options = { mode: "limit", limit: 5 }, concurrency = 5) {
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
    '--disable-gpu'
  ]
});  const page = await browser.newPage();

  await page.goto(`https://www.asos.com/search/?q=${encodeURIComponent(searchTerm)}`, {
    waitUntil: "networkidle2",
  });

  if (options.mode === "full" || options.mode === "range") {
    await loadAllProducts(page);
  }

  await page.waitForSelector("li.productTile_U0clN");
  const productLinks = await page.$$eval("li.productTile_U0clN a.productLink_KM4PI", (links) =>
    links.map((a) => a.href)
  );

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
  }

  await browser.close();
  return results;
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

app.get('/health',(req,res)=>{
  res.json({message:"everything is working "})
})

const PORT = 4000;
app.listen(PORT, () => console.log(`🚀 API running at http://localhost:${PORT}`));
