(() => {
  const roles = {graphics:'Graphics',video_photo:'Video and photography',events:'Event planning and logistics',undecided:'Not sure yet'};
  const steps = [['full_name','email','school','study_year'],['preferred_role','experience'],['motivation','consent']];
  const limits = {full_name:100,email:254,school:200,study_year:80,motivation:2000,experience:2000};
  const labels = {full_name:'Full name',email:'Email',school:'School / university',study_year:'Year of study',motivation:'Why would you like to join?',experience:'Relevant experience (optional)'};
  const state = {step:0,values:{},busy:false,reference:null,requestId:null,errors:{},message:''};
  const config = window.APPLICATION_CONFIG || {};
  let widget = null, token = '', host;
  const form = document.createElement('form');
  form.className = 'application'; form.noValidate = true;
  const field = (name, multiline=false) => `<div class="field"><label for="app-${name}">${labels[name]}</label>${multiline?`<textarea id="app-${name}" name="${name}" maxlength="${limits[name]}" ${name==='motivation'?'required':''}></textarea>`:`<input id="app-${name}" name="${name}" type="${name==='email'?'email':'text'}" maxlength="${limits[name]}" autocomplete="${name==='full_name'?'name':name==='email'?'email':'off'}" required>`}<p class="field-error" id="error-${name}" hidden></p></div>`;
  form.innerHTML = `<p class="application-progress"></p>
    <section data-step="0" aria-labelledby="app-title-0"><h3 id="app-title-0" tabindex="-1">About you</h3>${steps[0].map(n=>field(n)).join('')}</section>
    <section data-step="1" aria-labelledby="app-title-1"><h3 id="app-title-1" tabindex="-1">Team interest</h3><fieldset><legend>Preferred role</legend>${Object.entries(roles).map(([value,label])=>`<label class="choice"><input type="radio" name="preferred_role" value="${value}" required>${label}</label>`).join('')}<p class="field-error" id="error-preferred_role" hidden></p></fieldset>${field('experience',true)}</section>
    <section data-step="2" aria-labelledby="app-title-2"><h3 id="app-title-2" tabindex="-1">Your motivation</h3>${field('motivation',true)}<div class="application-review"><h4>Your details</h4><dl></dl><button type="button" data-edit="0">Edit about you</button><button type="button" data-edit="1">Edit team interest</button></div><p class="application-notice">NextStep Tokyo will use your answers and contact details to review your application and contact you about recruitment. Only authorized organizers will access your application.</p><label class="choice"><input type="checkbox" name="consent" required><span>I agree to this use of my information.</span></label><p class="field-error" id="error-consent" hidden></p><div class="application-verification"></div></section>
    <div class="application-status" role="status" aria-live="polite"></div><div class="application-actions"><button type="button" data-back>Back</button><button type="submit">Continue →</button></div>`;
  function collect() {
    for (const name of Object.keys(limits)) state.values[name] = form.elements.namedItem(name).value;
    state.values.preferred_role = form.elements.namedItem('preferred_role').value;
    state.values.consent = form.elements.namedItem('consent').checked;
  }
  function validate(names) {
    const errors = {};
    for (const name of names) {
      const value = state.values[name];
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
      releaseWidget();
      host.replaceChildren();
      const heading=document.createElement('h3'); heading.textContent='Application received'; heading.tabIndex=-1;
      const copy=document.createElement('p'); copy.textContent='Thank you for taking your next step with us. Keep your application reference for your records.';
      const ref=document.createElement('strong'); ref.className='application-reference'; ref.textContent=state.reference;
      host.append(heading,copy,ref); if(focus) heading.focus(); return;
    }
    form.querySelectorAll('[data-step]').forEach(node=>node.hidden=Number(node.dataset.step)!==state.step);
    form.querySelector('.application-progress').textContent=`Step ${state.step+1} of 3`;
    form.querySelector('[data-back]').hidden=state.step===0;
    const submit=form.querySelector('[type=submit]'); submit.textContent=state.busy?'Submitting…':state.step===2?'Submit application':'Continue →';
    form.querySelectorAll('button').forEach(button=>button.disabled=state.busy);
    form.querySelectorAll('input,textarea').forEach(input=>input.disabled=state.busy);
    form.setAttribute('aria-busy',String(state.busy));
    const configured=!!(config.endpoint&&config.turnstileSiteKey);
    if(state.step===2&&!configured) submit.disabled=true;
    form.querySelector('.application-status').textContent=state.message||(!configured?'Applications are not open yet. You can explore the form, but submissions are currently unavailable.':'');
    const dl=form.querySelector('dl'); dl.replaceChildren();
    for(const name of [...steps[0],'preferred_role','experience']) {
      const dt=document.createElement('dt'), dd=document.createElement('dd');
      dt.textContent=labels[name]||'Preferred role'; dd.textContent=name==='preferred_role'?roles[state.values[name]]||'—':state.values[name]||'—'; dl.append(dt,dd);
    }
    errors(); ensureWidget(); if(focus) form.querySelector(`#app-title-${state.step}`).focus();
  }
  function releaseWidget(){if(widget!==null&&window.turnstile) window.turnstile.remove(widget); widget=null;token='';}
  function ensureWidget(){
    if(state.step!==2||!config.turnstileSiteKey||!window.turnstile||widget!==null||!form.isConnected)return;
    widget=window.turnstile.render(form.querySelector('.application-verification'),{sitekey:config.turnstileSiteKey,action:'application',callback:value=>{token=value;},'expired-callback':()=>{token='';},'error-callback':()=>{token='';state.message='Verification could not load. Check your connection and try again.';show();}});
  }
  window.applicationTurnstileReady=ensureWidget;
  if(config.turnstileSiteKey){const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?onload=applicationTurnstileReady&render=explicit';script.async=true;script.onerror=()=>{state.message='Verification could not load. Please try again later.';show();};document.head.append(script);}
  form.addEventListener('input',()=>{collect();state.requestId=null;});
  form.addEventListener('click',event=>{const edit=event.target.closest('[data-edit],[data-back]');if(!edit||state.busy)return;collect();state.step=edit.hasAttribute('data-edit')?Number(edit.dataset.edit):state.step-1;state.errors={};state.message='';show(true);});
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(state.busy)return;collect();state.errors=validate(state.step===2?steps.flat():steps[state.step]);
    if(Object.keys(state.errors).length){const first=Object.keys(state.errors)[0];state.step=steps.findIndex(names=>names.includes(first));show();form.querySelector(`[name="${first}"]`).focus();return;}
    if(state.step<2){state.step++;state.message='';show(true);return;}
    if(!config.endpoint||!config.turnstileSiteKey)return;
    if(!token){state.message='Please complete the verification before submitting.';show();return;}
    state.busy=true;state.message='';state.requestId ||= crypto.randomUUID();show();
    const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),20000);
    try{
      const response=await fetch(config.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({...state.values,request_id:state.requestId,consent_version:'recruitment-v1',turnstile_token:token})});
      const result=await response.json();
      if(response.ok&&typeof result.reference==='string')state.reference=result.reference;
      else {state.errors=result.errors||{};state.message=response.status===403?'Verification expired or failed. Please verify and try again.':response.status===400?'Check the highlighted fields.':'We could not submit your application. Please try again.';
        const first=Object.keys(state.errors).find(name=>steps.flat().includes(name));if(first)state.step=steps.findIndex(names=>names.includes(first));}
    }catch{state.message='We could not confirm your submission. Check your connection and try again. Your answers are still here.';}
    finally{clearTimeout(timeout);state.busy=false;releaseWidget();show(true);}
  });
  window.applicationForm={mount(target){host=target;if(!state.reference)target.append(form);show();},detach(){releaseWidget();form.remove();host=null;}};
})();
