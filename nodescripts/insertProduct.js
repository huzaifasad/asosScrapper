import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const productUrl = 'https://en.zalando.de/jordan-print-t-shirt-blackiron-grey-joc22o0a1-q11.html';

async function fetchZalandoProduct() {
  try {
    const response = await fetch(
      `https://app.retailed.io/api/v1/scraper/zalando/product?url=${encodeURIComponent(productUrl)}`,
      {
        method: 'GET',
        headers: {
          'x-api-key': process.env.RETAILD_API_KEY
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const p = await response.json();
    console.log("Fetched:", p);

    // Map response into Supabase schema
    const product = {
      product_id: p.sku || p.id,
      title: p.name || p.title,
      brand: p.brand || null,
      price: p.price?.value || null,
      currency: p.price?.currency || null,
      category: p.category || null,
      images: p.images || [],
      product_url: p.url || productUrl,
      size_color_options: {
        sizes: p.sizes || [],
        colors: p.colors || []
      },
      stock_status: p.stock_status || null,
      materials: p.materials || null
    };

    const { data, error } = await supabase.from('products').insert([product]);
    if (error) console.error("❌ Insert error:", error);
    else console.log("✅ Inserted:", data);

  } catch (err) {
    console.error("❌ Fetch error:", err.message);
  }
}

fetchZalandoProduct();
