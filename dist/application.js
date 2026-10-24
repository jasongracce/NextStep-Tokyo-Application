(() => {
  const roles = {graphics:'Graphics',video_photo:'Video and photography',events:'Event planning and logistics'};
  const steps = [['full_name','email','school','study_year'],['preferred_role','experience'],['motivation','work_description','portfolio_url','work_files'],['consent']];
  const limits = {full_name:100,email:254,school:200,study_year:80,motivation:2000,experience:2000,work_description:1000,portfolio_url:2000};
  const labels = {full_name:'Full name',email:'Email',school:'School / university',study_year:'Year of study',motivation:'Why would you like to join?',work_description:'About your past work (optional)',portfolio_url:'Portfolio or video link (optional)',experience:'Relevant experience (optional)'};
  const creative = () => ['graphics','video_photo'].includes(state.values.preferred_role);
  let files = [];
  const state = {step:0,values:{},busy:false,reference:null,requestId:null,errors:{},message:''};
  const config = window.APPLICATION_CONFIG || {};
  let host;
  const form = document.createElement('form');
  form.className = 'application'; form.noValidate = true;
  const field = (name, multiline=false) => `<div class="field"><label for="app-${name}">${labels[name]}</label>${multiline?`<textarea id="app-${name}" name="${name}" maxlength="${limits[name]}" ${name==='motivation'?'required':''}></textarea>`:`<input id="app-${name}" name="${name}" type="${name==='email'?'email':'text'}" maxlength="${limits[name]}" autocomplete="${name==='full_name'?'name':name==='email'?'email':'off'}" required>`}<p class="field-error" id="error-${name}" hidden></p></div>`;
  form.innerHTML = `<p class="application-progress"></p>
    <section data-step="0" aria-labelledby="app-title-0"><h3 id="app-title-0" tabindex="-1">About you</h3>${steps[0].map(n=>field(n)).join('')}</section>
    <section data-step="1" aria-labelledby="app-title-1"><h3 id="app-title-1" tabindex="-1">Team interest</h3><fieldset><legend>Preferred role</legend>${Object.entries(roles).map(([value,label])=>`<label class="choice"><input type="radio" name="preferred_role" value="${value}" required>${label}</label>`).join('')}<p class="field-error" id="error-preferred_role" hidden></p></fieldset>
      <div class="role-skills" aria-labelledby="role-skills-title">
        <h4 id="role-skills-title">What we’re looking for</h4>
        <h5>Graphics</h5>
        <ul><li>An eye for layout, colour, and typography</li><li>Familiarity with design tools such as Canva, Figma, or Adobe</li><li>An interest in creating social media posts and event visuals</li></ul>
        <h5>Video and photography</h5>
        <ul><li>An eye for framing and visual storytelling</li><li>Basic photography, filming, or editing skills</li><li>An interest in capturing events and creating short videos</li></ul>
        <h5>Event planning and logistics</h5>
        <ul><li>Good organisation and attention to detail</li><li>Clear communication and teamwork</li><li>An interest in coordinating activities and helping events run smoothly</li></ul>
      </div>${field('experience',true)}</section>
    <section data-step="2" aria-labelledby="app-title-2"><h3 id="app-title-2" tabindex="-1">Your motivation</h3>${field('motivation',true)}<fieldset class="past-work" hidden><legend>Past Works</legend><p>Share something you've created. You can leave this section blank.</p>${field('work_description',true)}${field('portfolio_url')}<div class="field"><label for="app-work_files">Attach past work (optional)</label><input id="app-work_files" name="work_files" type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf" aria-describedby="work-help"><p id="work-help">Up to 3 JPG, PNG, WebP or PDF files, 10 MB each. For videos, share a link above.</p><ul class="work-file-list"></ul><p class="field-error" id="error-work_files" hidden></p></div></fieldset></section>
    <section data-step="3" aria-labelledby="app-title-3"><h3 id="app-title-3" tabindex="-1">Review your answers</h3><div class="application-review"><dl></dl><button type="button" data-edit="0">Edit about you</button><button type="button" data-edit="1">Edit team interest</button><button type="button" data-edit="2">Edit motivation</button></div><p class="application-notice">NextStep Tokyo will use your answers and contact details to review your application and contact you about recruitment. Only authorized organizers will access your application.</p><label class="choice"><input type="checkbox" name="consent" required><span>I agree to this use of my information.</span></label><p class="field-error" id="error-consent" hidden></p></section>
    <div class="application-status" role="status" aria-live="polite"></div><div class="application-actions"><button type="button" data-back>Back</button><button type="submit">Continue →</button></div>`;
  form.elements.namedItem('portfolio_url').required = false;
  form.elements.namedItem('portfolio_url').type = 'url';
  function collect() {
    for (const name of Object.keys(limits)) state.values[name] = form.elements.namedItem(name).value;
    state.values.preferred_role = form.elements.namedItem('preferred_role').value;
    state.values.consent = form.elements.namedItem('consent').checked;
  }
  function validate(names) {
    const errors = {};
    for (const name of names) {
      const value = state.values[name];
      if (['work_description','portfolio_url','work_files'].includes(name)) {
        if (!creative()) continue;
        if (name==='work_files') {
          if(files.length>3 || files.some(file=>file.size>10*1024*1024 || !/\.(jpe?g|png|webp|pdf)$/i.test(file.name))) errors[name]='Choose up to 3 JPG, PNG, WebP or PDF files, 10 MB each.';
        } else if (value.trim().length>limits[name]) errors[name]=`Use ${limits[name]} characters or fewer.`;
        else if(name==='portfolio_url' && value.trim()) {try {const url=new URL(value.trim());if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error();}catch{errors[name]='Enter a complete http or https link.';}}
        continue;
      }
      if (name==='consent') { if (!value) errors[name]='Please agree before submitting.'; }
      else if (name==='preferred_role') { if (!roles[value]) errors[name]='Choose a preferred role.'; }
      else if (name!=='experience' && !value?.trim()) errors[name]='Please complete this field.';
      else if (value?.trim().length>limits[name]) errors[name]=`Use ${limits[name]} characters or fewer.`;
      else if (name==='email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) errors[name]='Enter a valid email address.';
    }
    return errors;
  }
  function errors() {
    for (const name of steps.flat()) {
      const message=state.errors[name], node=form.querySelector(`#error-${name}`);
      node.textContent=message||''; node.hidden=!message;
      form.querySelectorAll(`[name="${name}"]`).forEach(input=>{
        input.setAttribute('aria-invalid',String(!!message));
        if(message) input.setAttribute('aria-describedby',node.id); else input.removeAttribute('aria-describedby');
      });
    }
  }
  function show(focus=false) {
    if(state.reference) {
      if(!host)return;
      host.replaceChildren();
      const heading=document.createElement('h3'); heading.textContent='Application received'; heading.tabIndex=-1;
      const copy=document.createElement('p'); copy.textContent='Thank you for taking your next step with us. Keep your application reference for your records.';
      const ref=document.createElement('strong'); ref.className='application-reference'; ref.textContent=state.reference;
      host.append(heading,copy,ref); if(focus) heading.focus(); return;
    }
    form.querySelector('.past-work').hidden=!creative();
    form.querySelectorAll('[data-step]').forEach(node=>node.hidden=Number(node.dataset.step)!==state.step);
    form.querySelector('.application-progress').textContent=`Step ${state.step+1} of ${steps.length}`;
    form.querySelector('[data-back]').hidden=state.step===0;
    const submit=form.querySelector('[type=submit]'); submit.textContent=state.busy?'Submitting…':state.step===3?'Submit application':'Continue →';
    form.querySelectorAll('button').forEach(button=>button.disabled=state.busy);
    form.querySelectorAll('input,textarea').forEach(input=>input.disabled=state.busy);
    form.setAttribute('aria-busy',String(state.busy));
    const configured=!!config.endpoint;
    form.querySelector('.application-status').textContent=state.message||(!configured?'Applications are not open yet. You can explore the form, but submissions are currently unavailable.':'');
    const dl=form.querySelector('dl'); dl.replaceChildren();
    for(const name of [...steps[0],'preferred_role','experience','motivation']) {
      const dt=document.createElement('dt'), dd=document.createElement('dd');
      dt.textContent=labels[name]||'Preferred role'; dd.textContent=name==='preferred_role'?roles[state.values[name]]||'—':state.values[name]||'—'; dl.append(dt,dd);
    }
    if(creative()) {
      for(const name of ['work_description','portfolio_url','work_files']) {
        const dt=document.createElement('dt'),dd=document.createElement('dd');
        dt.textContent=labels[name]||'Attached past work';dd.textContent=name==='work_files'?files.map(file=>file.name).join(', ')||'None':state.values[name]||'?';dl.append(dt,dd);
      }
    }
    errors(); if(focus) form.querySelector(`#app-title-${state.step}`).focus();
  }
  form.addEventListener('change',event=>{
    if(event.target.name!=='work_files')return;
    files=[...files,...event.target.files];event.target.value='';state.requestId=null;
    renderFiles();
  });
  function renderFiles(){
    const list=form.querySelector('.work-file-list');list.replaceChildren();
    files.forEach((file,index)=>{const item=document.createElement('li'),remove=document.createElement('button');item.append(document.createTextNode(`${file.name} (${(file.size/1024/1024).toFixed(1)} MB) `));remove.type='button';remove.textContent='Remove';remove.setAttribute('aria-label',`Remove ${file.name}`);remove.onclick=()=>{files.splice(index,1);state.requestId=null;renderFiles();};item.append(remove);list.append(item);});
  }
  form.addEventListener('input',()=>{collect();state.requestId=null;});
  form.addEventListener('click',event=>{const edit=event.target.closest('[data-edit],[data-back]');if(!edit||state.busy)return;collect();state.step=edit.hasAttribute('data-edit')?Number(edit.dataset.edit):state.step-1;state.errors={};state.message='';show(true);});
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(state.busy)return;collect();state.errors=validate(state.step===3?steps.flat():steps[state.step]);
    if(Object.keys(state.errors).length){const first=Object.keys(state.errors)[0];state.step=steps.findIndex(names=>names.includes(first));show();form.querySelector(`[name="${first}"]`).focus();return;}
    if(state.step<3){state.step++;state.message='';show(true);return;}
    if(!config.endpoint){state.message='Your application has not been sent. Submissions need to be connected before we can receive your answers. Please try again once applications are open.';show();return;}
    state.busy=true;state.message='';state.requestId ||= crypto.randomUUID();show();
    const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),120000);
    try{
      const payload={...state.values,work_description:creative()?state.values.work_description:'',portfolio_url:creative()?state.values.portfolio_url:'',request_id:state.requestId,consent_version:'recruitment-v1'};
      let body=JSON.stringify(payload),headers={'Content-Type':'application/json'};
      if(creative()&&files.length){
        body=new FormData();body.append('application',JSON.stringify(payload));files.forEach(file=>body.append('files',file));headers={};
        state.message='Uploading past work and submitting? Please keep this page open.';show();
      }
      const response=await fetch(config.endpoint,{method:'POST',headers,signal:controller.signal,body});
      const result=await response.json();
      if(response.ok&&typeof result.reference==='string')state.reference=result.reference;
      else {state.errors=result.errors||{};state.message=response.status===403?'This website is not authorized to submit applications. Please contact NextStep Tokyo.':response.status===400?'Check the highlighted fields.':'We could not submit your application. Please try again.';
        const first=Object.keys(state.errors).find(name=>steps.flat().includes(name));if(first)state.step=steps.findIndex(names=>names.includes(first));}
    }catch{state.message='We could not confirm your submission. Check your connection and try again. Your answers are still here.';}
    finally{clearTimeout(timeout);state.busy=false;show(true);}
  });
  window.applicationForm={mount(target){host=target;if(!state.reference)target.append(form);show();},detach(){form.remove();host=null;}};
})();
