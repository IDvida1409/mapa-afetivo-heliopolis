const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'helio-publicacao-'));process.env.FORM_DATA_DIR=path.join(tmp,'form');let server;
async function start(){const app=require('./server.js');server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));return 'http://127.0.0.1:'+server.address().port}
async function run(){let base=await start();let r=await fetch(base+'/');assert.equal(r.status,200);assert.match(await r.text(),/<form/);
 r=await fetch(base+'/cartografia',{redirect:'manual'});assert.equal(r.status,302);assert.equal(r.headers.get('location'),'/cartografia/');
 assert.equal((await fetch(base+'/cartografia/')).status,200);
 const form=new FormData();form.set('local','Local de teste');form.set('categoria','Educação');form.set('relato','Conferência isolada do envio de foto.');form.set('autorizacao','sim');form.set('foto',new Blob([fs.readFileSync(path.join(__dirname,'cartografia/public/assets/web/novo-1-vista-aerea.webp'))],{type:'image/webp'}),'teste.webp');r=await fetch(base+'/enviar',{method:'POST',body:form,redirect:'manual'});assert.equal(r.status,302);assert.equal(r.headers.get('location'),'/obrigado.html');assert.equal(JSON.parse(fs.readFileSync(path.join(tmp,'form/submissions.json'),'utf8')).length,1);
 for(const url of ['/server.js','/data/submissions.json','/cartografia/server.cjs','/cartografia/data/community.json'])assert.equal((await fetch(base+url)).status,404);
 const p=await(await fetch(base+'/cartografia/places.json')).json();assert.equal(p.length,27);assert.equal(p.filter(p=>p.complementary).length,10);assert.equal(p.filter(p=>p.demo).length,0);assert.equal(new Set(p.map(p=>p.id)).size,27);assert.equal(p.reduce((n,p)=>n+p.photos.length,0),27);assert.equal(p.filter(p=>!p.coord).length,2);
 for(const x of p){assert(x.history?.length>60,x.id);assert(x.story?.length>50,x.id);assert(x.dateNote,x.id);for(const img of x.photos)assert(fs.existsSync(path.join(__dirname,'cartografia/public',img.src)));}
 const stats=await(await fetch(base+'/cartografia/statistics.json')).json();assert.equal(stats.total,1400);assert.equal(stats.mappedTotal,1382);assert.equal(stats.series.length,10);assert.equal(stats.states.length,27);
 async function call(route,method='GET',body){const r=await fetch(base+'/cartografia/api/'+route,{method,headers:{'Content-Type':'application/json','X-Requested-With':'HeliopolisPreview'},body:body?JSON.stringify(body):undefined});return{status:r.status,data:await r.json()}}
 const reactions=['afeto','acolhimento','alegria','surpresa','tristeza','indignacao','atencao','alagamento','violencia'];for(const reaction of reactions){const r=await call('reaction','POST',{id:'demo-1',reaction});assert.equal(r.status,200);assert.equal(r.data.reactions['demo-1'][reaction],1)}
 assert.equal((await call('reaction','POST',{id:'demo-1',reaction:'invalida'})).status,400);
 const note=(await call('note','POST',{id:'demo-1',text:'Teste de persistência.',name:'Teste',affect:'atencao'})).data.notes['demo-1'][0];assert.equal(note.affect,'atencao');
 assert(fs.existsSync(path.join(tmp,'form/cartografia/community.json')));
 await new Promise(r=>server.close(r));delete require.cache[require.resolve('./server.js')];delete require.cache[require.resolve('./cartografia/server.cjs')];base=await start();let c=(await call('community')).data;assert.equal(c.notes['demo-1'][0].text,'Teste de persistência.');assert.equal(Object.keys(c.reactions['demo-1']).length,9);
 await call('note','DELETE',{id:'demo-1',noteId:note.id});assert.equal((await call('community')).data.notes['demo-1'].length,0);
 console.log('OK: formulário preservado; cartografia em /cartografia/; arquivos privados protegidos; 27 registros, dez novos, 27 imagens e histórias; dez anos de dados; reações e bilhetes persistentes após reinício.');
}
run().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(server?.listening)await new Promise(r=>server.close(r));fs.rmSync(tmp,{recursive:true,force:true})});
