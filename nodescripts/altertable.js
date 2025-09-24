import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

// Initialize Supabase client
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

console.log('🔧 Testing with CORRECT parameters based on hint...\n');

// Test with _materials_arr (jsonb array)
async function testWithMaterialsArr() {
  console.log('1️⃣ Testing with _materials_arr (jsonb array)...');
  
  const testData = {
    "_id": null,
    "_product_name": "Classic White T-Shirt",
    "_price": 19.99,
    "_color": "White",
    "_category": "Tops",
    "_brand": "Zara",
    "_currency": "USD",
    "_description": "Soft cotton T-shirt with a round neck.",
    "_images": [
      "https://example.com/images/tshirt1.jpg",
      "https://example.com/images/tshirt1-back.jpg"
    ],
    "_materials_arr": [  // Changed from _materials to _materials_arr
      { "material": "Cotton", "percentage": 100 }
    ],
    "_product_url": "https://www.zara.com/product/12345",
    "_category_path": "Women > Tops > T-Shirts",
    "_scrape_type": "zara_scraper_v2",
    "_scraped_category": "Women/Tops",
    "_size": ["S", "M", "L"],
    "_stock_status": "in_stock"
  };

  try {
    const { data, error } = await supabase.rpc('upsert_zara_product_v2', testData);
    
    if (error) {
      console.log('❌ _materials_arr test failed:');
      console.log('   Code:', error.code);
      console.log('   Message:', error.message);
      if (error.hint) console.log('   Hint:', error.hint);
    } else {
      console.log('✅ _materials_arr test SUCCESS!');
      console.log('📥 Response:', data);
      return true;
    }
  } catch (err) {
    console.log('❌ _materials_arr error:', err.message);
  }
  console.log('');
  return false;
}

// Test with _materials_str (comma-separated string)
async function testWithMaterialsStr() {
  console.log('2️⃣ Testing with _materials_str (string)...');
  
  const testData = {
    "_id": null,
    "_product_name": "Blue Denim Jacket",
    "_price": 120.5,
    "_color": "Blue",
    "_category": "Jackets",
    "_brand": "ASOS",
    "_currency": "GBP",
    "_description": "Classic fit denim jacket",
    "_images": ["https://example.com/jacket.jpg"],
    "_materials_str": "Cotton,Polyester", // Changed to _materials_str
    "_product_url": "https://asos.com/item/123",
    "_category_path": "Women > Jackets",
    "_scrape_type": "asos_scraper",
    "_scraped_category": "Outerwear",
    "_size": ["S", "M", "L"],
    "_stock_status": "in_stock"
  };

  try {
    const { data, error } = await supabase.rpc('upsert_zara_product_v2', testData);
    
    if (error) {
      console.log('❌ _materials_str test failed:');
      console.log('   Code:', error.code);
      console.log('   Message:', error.message);
      if (error.hint) console.log('   Hint:', error.hint);
    } else {
      console.log('✅ _materials_str test SUCCESS!');
      console.log('📥 Response:', data);
      return true;
    }
  } catch (err) {
    console.log('❌ _materials_str error:', err.message);
  }
  console.log('');
  return false;
}

// Test with both parameters (see what happens)
async function testWithBothMaterials() {
  console.log('3️⃣ Testing with BOTH _materials_arr and _materials_str...');
  
  const testData = {
    "_id": null,
    "_product_name": "Test Both Materials",
    "_price": 50.0,
    "_color": "Red",
    "_category": "Test",
    "_brand": "Test",
    "_currency": "USD",
    "_description": "Testing both material parameters",
    "_images": ["https://example.com/test.jpg"],
    "_materials_arr": [{ "material": "Cotton", "percentage": 80 }],
    "_materials_str": "Cotton,Polyester",
    "_product_url": "https://example.com/test",
    "_category_path": "Test > Test",
    "_scrape_type": "test",
    "_scraped_category": "Test",
    "_size": ["M"],
    "_stock_status": "in_stock"
  };

  try {
    const { data, error } = await supabase.rpc('upsert_zara_product_v2', testData);
    
    if (error) {
      console.log('❌ Both materials test failed:');
      console.log('   Code:', error.code);
      console.log('   Message:', error.message);
      if (error.hint) console.log('   Hint:', error.hint);
    } else {
      console.log('✅ Both materials test SUCCESS!');
      console.log('📥 Response:', data);
      return true;
    }
  } catch (err) {
    console.log('❌ Both materials error:', err.message);
  }
  console.log('');
  return false;
}

// Run tests
async function runTests() {
  console.log('🎯 Testing with corrected parameter names based on Supabase hint...\n');
  
  const results = [];
  
  results.push(await testWithMaterialsArr());
  results.push(await testWithMaterialsStr());
  results.push(await testWithBothMaterials());
  
  const successCount = results.filter(Boolean).length;
  
  console.log(`\n🏁 Test Results: ${successCount}/3 tests passed`);
  
  if (successCount > 0) {
    console.log('🎉 SUCCESS! At least one method worked.');
    console.log('📝 Use the successful method in your scraper.');
  } else {
    console.log('❌ All tests failed. The function signature might be different.');
    console.log('💡 Ask your client to show the actual function definition.');
  }
  
  process.exit(0);
}

runTests();