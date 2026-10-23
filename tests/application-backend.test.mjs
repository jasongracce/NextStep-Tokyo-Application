import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../supabase/functions/submit-application/handler.js',import.meta.url),'utf8');
const {createHandler,validate}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const valid={full_name:' Jane Student ',email:'JANE@example.com',school:'University',study_year:'Second year',preferred_role:'graphics',motivation:'I want to contribute.',experience:'',consent:true,consent_version:'recruitment-v1',request_id:'12345678-1234-4234-8234-123456789abc'};
const request=(body=valid,origin='https://example.com',method='POST')=>new Request('https://backend.example/submit-application',{method,headers:{origin,'content-type':'application/json'},...(method==='POST'?{body:JSON.stringify(body)}:{})});
test('normalizes applicant fields and ignores privileged client fields',()=>{
  const {data,errors}=validate({...valid,status:'accepted',internal_notes:'injected'});
  assert.deepEqual(errors,{});assert.equal(data.email,'jane@example.com');assert.equal(data.full_name,'Jane Student');assert.equal(data.status,undefined);assert.equal(data.internal_notes,undefined);
});
test('rejects missing, oversized, invalid-role, consent, and reference fields',()=>{
  const {errors}=validate({...valid,full_name:' ',email:'bad',motivation:'a'.repeat(2001),preferred_role:'leader',consent:false,request_id:'bad'});
  for(const field of ['full_name','email','motivation','preferred_role','consent','request_id'])assert.ok(errors[field]);
});
test('accepts valid submissions and returns only a reference',async()=>{
  let saved;const handler=createHandler({origins:['https://example.com'],save:async data=>{saved=data;return 'reference';}});
  const response=await handler(request());assert.equal(response.status,200);assert.deepEqual(await response.json(),{reference:'reference'});assert.equal(saved.email,'jane@example.com');assert.equal(saved.turnstile_token,undefined);
});
test('invalid submissions and disallowed origins never write',async()=>{
  let writes=0;const handler=createHandler({origins:['https://example.com'],save:async()=>{writes++;}});
  assert.equal((await handler(request({...valid,motivation:''}))).status,400);assert.equal((await handler(request(valid,'https://evil.example'))).status,403);assert.equal(writes,0);
});
test('restricts origins, methods, payload size and malformed JSON',async()=>{
  const handler=createHandler({origins:['https://example.com'],save:async()=>''});
  assert.equal((await handler(request(valid,'https://evil.example'))).status,403);
  const preflight=await handler(request(valid,'https://example.com','OPTIONS'));assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),'https://example.com');
  assert.equal((await handler(request(valid,'https://example.com','GET'))).status,405);
  assert.equal((await handler(request({...valid,experience:'x'.repeat(33000)}))).status,413);
  assert.equal((await handler(new Request('https://backend.example',{method:'POST',headers:{origin:'https://example.com','content-type':'application/json'},body:'{'}))).status,400);
});
test('returns generic retryable errors without leaking backend details',async()=>{
  const handler=createHandler({origins:['https://example.com'],save:async()=>{throw new Error('secret database detail');}});
  const response=await handler(request());assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'temporarily_unavailable'});
});

const multipartRequest=(fields,files)=>{
  const form=new FormData();form.append('application',JSON.stringify(fields));
  for(const file of files)form.append('files',file);
  return new Request('https://backend.example/submit-application',{method:'POST',headers:{origin:'https://example.com'},body:form});
};
test('optional past work validates links, lengths, and excludes other roles',()=>{
  assert.deepEqual(validate(valid).errors,{});
  assert.equal(validate({...valid,portfolio_url:'javascript:alert(1)'}).errors.portfolio_url,'Enter a complete http or https link.');
  assert.ok(validate({...valid,work_description:'x'.repeat(1001)}).errors.work_description);
  const {data,errors}=validate({...valid,preferred_role:'events',work_description:'draft',portfolio_url:'invalid'});
  assert.deepEqual(errors,{});assert.equal(data.work_description,'');assert.equal(data.portfolio_url,'');
});
test('multipart attachments submit without a CAPTCHA and reject invalid files',async()=>{
  let saved,writes=0;
  const handler=createHandler({origins:['https://example.com'],save:async(data,files)=>{writes++;saved={data,files};return 'reference';}});
  const pdf=new File(['%PDF-1.7 test'], 'portfolio.pdf',{type:'application/pdf'});
  const response=await handler(multipartRequest({...valid,work_description:'My work',portfolio_url:'https://example.com/work'},[pdf]));
  assert.equal(response.status,200);assert.equal(saved.files[0].name,'portfolio.pdf');assert.equal(saved.files[0].type,'application/pdf');assert.equal(saved.data.work_description,'My work');
  assert.equal((await handler(multipartRequest(valid,[new File(['fake'],'fake.png',{type:'image/png'})]))).status,400);
  assert.equal((await handler(multipartRequest(valid,[pdf,pdf,pdf,pdf]))).status,400);
  assert.equal((await handler(multipartRequest({...valid,preferred_role:'events'},[pdf]))).status,400);
  assert.equal((await handler(multipartRequest(valid,[new File(['%PDF-1.7'],'wrong.png',{type:'image/png'})]))).status,400);
  assert.equal((await handler(multipartRequest(valid,[new File([new Uint8Array(10*1024*1024+1)],'large.pdf',{type:'application/pdf'})]))).status,400);
  assert.equal(writes,1);
});
