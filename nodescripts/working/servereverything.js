import puppeteer from "puppeteer";
import fs from "fs";

// Small sleep helper
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// Expand accordion helper
async function expandAccordions(page) {
  const accordionSelectors = [
    "button[aria-controls='productDescriptionDetails']",
    "button[aria-controls='productDescriptionBrand']",
    "button[aria-controls='productDescriptionCareInfo']",
    "button[aria-controls='productDescriptionAboutMe']",
  ];

  for (let sel of accordionSelectors) {
    try {
      const btn = await page.$(sel);
      if (btn) {
        const expanded = await page.$eval(sel, el => el.getAttribute("aria-expanded"));
        if (expanded === "false") {
          await btn.click();
          await sleep(400);
          console.log(`✅ Expanded accordion: ${sel}`);
        }
      } else {
        console.log(`⚠️ Accordion not found: ${sel}`);
      }
    } catch (e) {
      console.log(`⚠️ Error expanding accordion: ${sel}`, e.message);
    }
  }
}

// Load ALL products by clicking "load more" until it's gone
async function loadAllProducts(page) {
  let lastCount = 0;
  while (true) {
    const currentCount = await page.$$eval("li.productTile_U0clN", (els) => els.length);
    console.log(`👀 Currently loaded: ${currentCount} products`);

    if (currentCount === lastCount) {
      console.log("✅ No more new products loaded → all products visible.");
      break;
    }
    lastCount = currentCount;

    const loadMoreBtn = await page.$("a.loadButton_wWQ3F");
    if (!loadMoreBtn) {
      console.log("✅ 'Load more' button not found → finished loading.");
      break;
    }

    console.log("🔘 Clicking 'Load more'...");
    await loadMoreBtn.click();
    await sleep(4000); // wait for new products to load
  }
}

async function scrapeASOS(searchTerm, options = { mode: "limit", limit: 5 }) {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto(`https://www.asos.com/search/?q=${encodeURIComponent(searchTerm)}`, {
    waitUntil: "networkidle2",
  });

  // Load all if mode = full or range
  if (options.mode === "full" || options.mode === "range") {
    await loadAllProducts(page);
  }

  // Grab all product links after loading
  await page.waitForSelector("li.productTile_U0clN");
  const productLinks = await page.$$eval("li.productTile_U0clN a.productLink_KM4PI", (links) =>
    links.map((a) => a.href)
  );

  console.log(`🔍 Found ${productLinks.length} products for "${searchTerm}"`);

  let linksToScrape = [];
  if (options.mode === "limit") {
    linksToScrape = productLinks.slice(0, options.limit);
  } else if (options.mode === "range") {
    linksToScrape = productLinks.slice(options.startIndex, options.endIndex);
  } else {
    linksToScrape = productLinks; // full scrape
  }

  console.log(`➡️ Scraping ${linksToScrape.length} products...\n`);

  const results = [];

  for (let i = 0; i < linksToScrape.length; i++) {
    const link = linksToScrape[i];
    console.log(`🛒 Scraping product: ${link}`);
    const productPage = await browser.newPage();

    try {
      await productPage.goto(link, { waitUntil: "networkidle2", timeout: 0 });
      await expandAccordions(productPage);

      const data = await productPage.evaluate(() => {
        const safeText = (sel) => document.querySelector(sel)?.innerText?.trim() || null;

        const name = safeText("h1[data-testid='product-title']") || document.title.split("|")[0].trim();
        const price = safeText("[data-testid='current-price']");
        const currency = price?.match(/[£$€]/)?.[0] || null;
        const stock_status = safeText("[data-testid='stock-availability']") || "Available";

        // ✅ Multi-color handling
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
          .map((img) => img.src)
          .filter((src) => src.includes("asos-media"));

        return {
          name, description, brand, category, price, currency,
          stock_status, materials, care_info, size, colors, images,
          product_url: window.location.href,
        };
      });

      results.push(data);
      console.log(`(${i + 1}/${linksToScrape.length}) ✅ Scraped Product: ${data.name}`);
    } catch (err) {
      console.error(`❌ Failed scraping ${link}`, err);
    } finally {
      await productPage.close();
    }
  }

  await browser.close();

  const fileName = `asos_${searchTerm}.json`;
  fs.writeFileSync(fileName, JSON.stringify(results, null, 2));

  console.log(`🎉 Scraping finished.`);
  console.log(`📦 Total products fetched: ${results.length}`);
  console.log(`💾 Data saved to: ${fileName}`);
}

// Example runs
(async () => {
  // 1. Limit mode (scrape first 5)
  await scrapeASOS("loafers", { mode: "limit", limit: 2 });

  // 2. Range mode (scrape products 100 → 200)
  // await scrapeASOS("loafers", { mode: "range", startIndex: 100, endIndex: 102 });

  // 3. Full mode (scrape ALL products)
  // await scrapeASOS("loafers", { mode: "full" });
})();
