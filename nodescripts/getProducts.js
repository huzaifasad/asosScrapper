import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function getProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*');   // fetch all rows & all columns

  if (error) {
    console.error("❌ Fetch error:", error);
  } else {
    console.log("✅ Products:", data);
  }
}

getProducts();
