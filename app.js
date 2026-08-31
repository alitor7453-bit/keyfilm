async function api(url, options={}) {
  const r = await fetch(url, {credentials:"include", ...options});
  const data = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(data.error || "İşlem başarısız");
  return data;
}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}

async function loadFilms(){
  const grid=document.getElementById("filmGrid");
  grid.innerHTML="<p>Yükleniyor...</p>";
  try{
    const films=await api("/api/films");
    grid.innerHTML=films.length?films.map(f=>`
      <article class="film">
        <div class="film-cover">🎬</div>
        <div class="film-body">
          <h3>${esc(f.title)}</h3>
          <p>${esc(f.description)}</p>
          ${f.videoUrl?`<button class="btn" onclick='openPlayer(${JSON.stringify(f)})'>▶ Oynat</button>`:`<span>Video henüz yüklenmedi.</span>`}
        </div>
      </article>`).join(""):"<p>Henüz film eklenmemiş.</p>";
  }catch(e){grid.innerHTML=`<p>${esc(e.message)}</p>`}
}
function openPlayer(f){
  document.getElementById("playerTitle").textContent=f.title;
  document.getElementById("playerDescription").textContent=f.description||"";
  const p=document.getElementById("player");p.src=f.videoUrl;
  document.getElementById("playerModal").hidden=false;
}
function closePlayer(){const p=document.getElementById("player");p.pause();p.removeAttribute("src");p.load();document.getElementById("playerModal").hidden=true}

document.getElementById("loginForm").addEventListener("submit",async e=>{
 e.preventDefault(); const f=new FormData(e.target);
 try{const d=await api("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.fromEntries(f))});
 document.getElementById("loginMsg").textContent=`Hoş geldin ${d.user.name}!`;
 if(d.user.role==="admin")document.getElementById("adminLink").hidden=false;
 }catch(x){document.getElementById("loginMsg").textContent=x.message}
});
document.getElementById("registerForm").addEventListener("submit",async e=>{
 e.preventDefault();const f=new FormData(e.target);
 try{await api("/api/auth/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.fromEntries(f))});document.getElementById("registerMsg").textContent="Kayıt başarılı.";e.target.reset();loadMe()}catch(x){document.getElementById("registerMsg").textContent=x.message}
});
document.getElementById("forgotForm").addEventListener("submit",async e=>{
 e.preventDefault();const f=new FormData(e.target);
 try{const d=await api("/api/auth/forgot",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.fromEntries(f))});document.getElementById("forgotMsg").textContent=d.message}catch(x){document.getElementById("forgotMsg").textContent=x.message}
});
async function loadMe(){try{const d=await api("/api/auth/me");if(d.user.role==="admin")document.getElementById("adminLink").hidden=false}catch{}}
loadFilms();loadMe();