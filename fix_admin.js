import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hlcxuhzbpugzzbwogfvg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsY3h1aHpicHVnenpid29nZnZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwNTU3NzIsImV4cCI6MjEwMDYzMTc3Mn0.wBEhD14EhYOii0ze1KSOeg4fuuMCgXg_CRVf_NtoCeA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fix() {
  console.log("Fetching super admin role...");
  const { data: roles } = await supabase.from('roles').select('id, name');
  const saRole = roles.find(r => r.name === 'Super Admin')?.id;
  const aRole = roles.find(r => r.name === 'Admin')?.id;

  console.log("Approving abdullahwali79@gmail.com...");
  const { error: e1 } = await supabase.from('profiles').update({ status: 'Approved', role_id: saRole }).eq('email', 'abdullahwali79@gmail.com');
  if(e1) console.error(e1);
  
  console.log("Approving admin@banoqabil.com...");
  const { error: e2 } = await supabase.from('profiles').update({ status: 'Approved', role_id: aRole }).eq('email', 'admin@banoqabil.com');
  if(e2) console.error(e2);
  
  console.log("Done!");
}

fix();
