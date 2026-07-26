import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hlcxuhzbpugzzbwogfvg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsY3h1aHpicHVnenpid29nZnZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwNTU3NzIsImV4cCI6MjEwMDYzMTc3Mn0.wBEhD14EhYOii0ze1KSOeg4fuuMCgXg_CRVf_NtoCeA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedAdmins() {
  console.log('Fetching roles...');
  const { data: roles, error: rolesErr } = await supabase.from('roles').select('id, name');
  
  if (rolesErr) {
    console.error('Error fetching roles (Did you run the SQL script in Supabase?):', rolesErr.message);
    return;
  }

  const superAdminRole = roles.find(r => r.name === 'Super Admin')?.id;
  const adminRole = roles.find(r => r.name === 'Admin')?.id;

  if (!superAdminRole || !adminRole) {
    console.error('Roles not found in the database. Please ensure the SQL schema is executed properly.');
    return;
  }

  console.log('Creating Super Admin...');
  const { data: saData, error: saError } = await supabase.auth.signUp({
    email: 'abdullahwali79@gmail.com',
    password: 'Abdullah123@',
    options: {
      data: { full_name: 'Abdullah Wali (Super Admin)' }
    }
  });

  if (saError && saError.message !== 'User already registered') {
    console.error('Error creating Super Admin:', saError.message);
  } else if (saData?.user) {
    console.log('Waiting for database trigger to create profile...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('Approving Super Admin profile...');
    const { error: saUpdateErr } = await supabase.from('profiles').update({
      role_id: superAdminRole,
      status: 'Approved'
    }).eq('id', saData.user.id);
    
    if (saUpdateErr) console.error('Error updating Super Admin profile:', saUpdateErr.message);
    else console.log('Super Admin successfully setup!');
  } else {
    console.log('Super Admin might already exist.');
  }

  console.log('\nCreating Regular Admin...');
  const { data: aData, error: aError } = await supabase.auth.signUp({
    email: 'admin@banoqabil.com',
    password: 'AdminPassword123@',
    options: {
      data: { full_name: 'Main Admin' }
    }
  });

  if (aError && aError.message !== 'User already registered') {
    console.error('Error creating Admin:', aError.message);
  } else if (aData?.user) {
    console.log('Waiting for database trigger to create profile...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('Approving Admin profile...');
    const { error: aUpdateErr } = await supabase.from('profiles').update({
      role_id: adminRole,
      status: 'Approved'
    }).eq('id', aData.user.id);

    if (aUpdateErr) console.error('Error updating Admin profile:', aUpdateErr.message);
    else console.log('Regular Admin successfully setup!');
  } else {
    console.log('Admin might already exist.');
  }
}

seedAdmins();
