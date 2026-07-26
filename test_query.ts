import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, status, permissions, roles!inner(name)')
    .eq('roles.name', 'Admin');
    
  console.log('Error:', error);
  console.log('Data:', JSON.stringify(data, null, 2));
}

test();
