import {createClient} from '@supabase/supabase-js'
import 'dotenv/config';


const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);


async function CreateTable() {
   const { error } = await supabase.rpc('exec_sql', {
    query: `
      

create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  brand text,
  category text,
  price numeric(10,2),
  currency text,
  stock_status text,
  materials text,
  size text,
  color text,
  images jsonb,
  product_url text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

    `
  });

  if (error) {
    console.error("Error creating table:", error);
  } else {
    console.log("✅ Table created successfully!");
  }
}


CreateTable();
