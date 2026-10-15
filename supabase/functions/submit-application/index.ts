import { createClient } from 'npm:@supabase/supabase-js@2';
import { createHandler } from './handler.js';

const origins=(Deno.env.get('ALLOWED_ORIGINS')||'').split(',').map(value=>value.trim()).filter(Boolean);
const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(createHandler({
  origins,
  async verify(token:string,hostname:string) {
    if(!token)return false;
    const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
      method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(10000),
      body:JSON.stringify({secret:Deno.env.get('TURNSTILE_SECRET_KEY'),response:token})
    });
    if(!response.ok)throw new Error('Verification unavailable');
    const result=await response.json();
    return result.success===true&&result.action==='application'&&result.hostname===hostname;
  },
  async save(data:Record<string,string>) {
    const {data:inserted,error}=await client.from('applications').insert(data).select('id').single();
    if(!error)return inserted.id;
    if(error.code!=='23505')throw error;
    const {data:existing,error:lookupError}=await client.from('applications').select('id,full_name,email,school,study_year,preferred_role,motivation,experience,consent_version').eq('request_id',data.request_id).single();
    if(lookupError||!existing)throw lookupError||new Error('Missing retry');
    for(const [key,value] of Object.entries(data))if(key!=='request_id'&&existing[key]!==value)throw new Error('Retry payload changed');
    return existing.id;
  }
}));
