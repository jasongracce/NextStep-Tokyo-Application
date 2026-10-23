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
  const creative=['graphics','video_photo'].includes(body.preferred_role);
  for(const [name,max] of Object.entries({work_description:1000,portfolio_url:2000})) {
    const value=creative?(body[name]??''):'';
    if(typeof value!=='string'||value.trim().length>max)errors[name]=`Use ${max} characters or fewer.`;
    else data[name]=value.trim();
  }
  if(data.portfolio_url){try{const url=new URL(data.portfolio_url);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw Error();}catch{errors.portfolio_url='Enter a complete http or https link.';}}
  return {data,errors};
}
export function createHandler({origins,save}) {
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
    const contentType=request.headers.get('content-type')||'';
    const multipart=contentType.toLowerCase().startsWith('multipart/form-data;');
    if(!multipart&&!contentType.toLowerCase().startsWith('application/json'))return reply(415,{error:'json_required'});
    try {
      // Bound both JSON and multipart requests, including streamed bodies.
      const maxBody=multipart?31*1024*1024:32768;
      const reader=request.body?.getReader();if(!reader)return reply(400,{error:'invalid_body'});
      const chunks=[];let length=0;
      while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>maxBody){await reader.cancel();return reply(413,{error:'body_too_large'});}chunks.push(value);}
      const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
      let body,files=[];
      try {
        if(multipart){
          const parts=await new Request(request.url,{method:'POST',headers:{'content-type':contentType},body:bytes}).formData();
          const json=parts.get('application');if(typeof json!=='string'||new TextEncoder().encode(json).length>32768)throw Error();
          body=JSON.parse(json);files=parts.getAll('files');
        } else body=JSON.parse(new TextDecoder().decode(bytes));
      }catch{return reply(400,{error:'invalid_json'});}
      if(!body||typeof body!=='object'||Array.isArray(body))return reply(400,{error:'invalid_body'});
      const {data,errors}=validate(body);
      if(files.length && !['graphics','video_photo'].includes(data.preferred_role))errors.work_files='Past work is available for creative roles only.';
      if(files.length>3)errors.work_files='Choose up to 3 files.';
      const attachments=[];
      for(const file of files.slice(0,3)){
        if(typeof file==='string'||!file.size||file.size>10*1024*1024||file.name.length>200){errors.work_files='Each file must be between 1 byte and 10 MB, with a filename of 200 characters or fewer.';continue;}
        const bytes=new Uint8Array(await file.arrayBuffer());
        const starts=(...values)=>values.every((value,index)=>bytes[index]===value);
        const type=starts(255,216,255)?'image/jpeg':starts(137,80,78,71,13,10,26,10)?'image/png':starts(37,80,68,70,45)?'application/pdf':starts(82,73,70,70)&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'?'image/webp':null;
        const extensions={'image/jpeg':/\.jpe?g$/i,'image/png':/\.png$/i,'image/webp':/\.webp$/i,'application/pdf':/\.pdf$/i};
        if(!type||!extensions[type].test(file.name)||(file.type&&file.type!==type)){errors.work_files='Choose valid JPG, PNG, WebP or PDF files.';continue;}
        attachments.push({name:file.name,type,size:file.size,bytes});
      }
      if(Object.keys(errors).length)return reply(400,{errors});
      return reply(200,{reference:await save(data,attachments)});
    }catch{return reply(503,{error:'temporarily_unavailable'});}
  };
}
