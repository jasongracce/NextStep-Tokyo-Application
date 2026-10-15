const limits = {full_name:100,email:254,school:200,study_year:80,motivation:2000,experience:2000};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validate(body) {
  const errors={}, data={};
  for(const [name,limit] of Object.entries(limits)) {
    const value=body[name]===undefined&&name==='experience'?'':body[name];
    if(typeof value!=='string') {errors[name]='Enter text for this field.';continue;}
    data[name]=value.trim();
    if((name!=='experience'&&!data[name])||Array.from(data[name]).length>limit)errors[name]=`Use ${name==='experience'?0:1}–${limit} characters.`;
  }
  if(data.email){data.email=data.email.toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))errors.email='Enter a valid email address.';}
  if(!['graphics','video_photo','events','undecided'].includes(body.preferred_role))errors.preferred_role='Choose a preferred role.';
  if(body.consent!==true||body.consent_version!=='recruitment-v1')errors.consent='Please agree to the recruitment notice.';
  if(typeof body.request_id!=='string'||!uuid.test(body.request_id))errors.request_id='Invalid submission reference.';
  data.preferred_role=body.preferred_role;data.request_id=body.request_id;data.consent_version='recruitment-v1';
  return {data,errors};
}
export function createHandler({origins,verify,save}) {
  return async request=>{
    const origin=request.headers.get('origin');
    const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
    const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers});
    if(!origin||!origins.includes(origin))return reply(403,{error:'origin_not_allowed'});
    headers['Access-Control-Allow-Origin']=origin;
    headers['Access-Control-Allow-Methods']='POST, OPTIONS';
    headers['Access-Control-Allow-Headers']='content-type';
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(request.method!=='POST')return reply(405,{error:'method_not_allowed'});
    if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return reply(415,{error:'json_required'});
    try {
      // Read at most 32 KiB, including requests without Content-Length.
      const reader=request.body?.getReader();if(!reader)return reply(400,{error:'invalid_body'});
      const chunks=[];let length=0;
      while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>32768){await reader.cancel();return reply(413,{error:'body_too_large'});}chunks.push(value);}
      const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
      let body;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{return reply(400,{error:'invalid_json'});}
      if(!body||typeof body!=='object'||Array.isArray(body))return reply(400,{error:'invalid_body'});
      const {data,errors}=validate(body);
      if(Object.keys(errors).length)return reply(400,{errors});
      if(typeof body.turnstile_token!=='string'||body.turnstile_token.length>2048||!await verify(body.turnstile_token,new URL(origin).hostname))return reply(403,{error:'verification_failed'});
      return reply(200,{reference:await save(data)});
    }catch{return reply(503,{error:'temporarily_unavailable'});}
  };
}
