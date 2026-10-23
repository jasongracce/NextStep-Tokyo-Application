import { createClient } from 'npm:@supabase/supabase-js@2';

// Invoke hourly from a scheduler with a dedicated secret, never from the browser.
Deno.serve(async request => {
  const secret=Deno.env.get('CLEANUP_SECRET');
  if(request.method!=='POST'||!secret||request.headers.get('authorization')!==`Bearer ${secret}`)
    return new Response(null,{status:403});
  try {
    const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const {data,error}=await client.rpc('unreferenced_application_work');
    if(error)throw error;
    if(data.length){
      const {error:removeError}=await client.storage.from('application-work').remove(data.map((row:{name:string})=>row.name));
      if(removeError)throw removeError;
    }
    return Response.json({removed:data.length});
  }catch{return Response.json({error:'cleanup_failed'},{status:503});}
});
