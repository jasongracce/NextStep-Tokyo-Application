import { createClient } from 'npm:@supabase/supabase-js@2';
import { createHandler } from './handler.js';

const origins=(Deno.env.get('ALLOWED_ORIGINS')||'').split(',').map(value=>value.trim()).filter(Boolean);
const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(createHandler({
  origins,
  async save(data:Record<string,unknown>,files:Array<{name:string,type:string,size:number,bytes:Uint8Array}>) {
    const bucket=client.storage.from('application-work');
    const workFiles=[];
    for(const [index,file] of files.entries()) {
      const digest=await crypto.subtle.digest('SHA-256',file.bytes);
      const hash=Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('');
      workFiles.push({name:file.name,type:file.type,size:file.size,path:`${data.request_id}/${index}-${hash}`});
    }
    const row={...data,work_files:workFiles};
    async function existingReference() {
      const {data:existing,error}=await client.from('applications').select('*').eq('request_id',data.request_id).maybeSingle();
      if(error)throw error;
      if(!existing)return null;
      for(const [key,value] of Object.entries(row))if(key!=='request_id'&&JSON.stringify(existing[key])!==JSON.stringify(value)){
        // JSONB may reorder attachment keys; compare their fields explicitly.
        if(key==='work_files'&&JSON.stringify(existing[key].map((f:Record<string,unknown>)=>[f.path,f.name,f.size,f.type]))===JSON.stringify(workFiles.map(f=>[f.path,f.name,f.size,f.type])))continue;
        throw new Error('Retry payload changed');
      }
      return existing.id;
    }
    const existing=await existingReference();if(existing)return existing;
    for(const [index,file] of files.entries()) {
      const {error}=await bucket.upload(workFiles[index].path,file.bytes,{contentType:file.type,upsert:false});
      // A concurrent retry may already have uploaded the identical object.
      if(error&&String(error.statusCode)!=='409')throw error;
    }
    const {data:inserted,error}=await client.from('applications').insert(row).select('id').single();
    if(!error)return inserted.id;
    if(error.code==='23505'){const reference=await existingReference();if(reference)return reference;}
    // Retain uploads on ambiguous failures so concurrent retries cannot lose their files.
    // The scheduled cleanup function removes unreferenced objects after 24 hours.
    throw error;
  }
}));
