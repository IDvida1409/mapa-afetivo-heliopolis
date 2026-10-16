'use strict';

let tourReturn=null,tourArrivalTimer,tourPhotoTimer,tourPhase='reading',tourArrival=null,tourReadingMs=14000;

function tourUI(){
 const showing=tourState!=='idle';
 document.body.classList.toggle('presenting',showing);
 $('#tour-controls').hidden=!showing;
 $('#tour-controls').dataset.state=tourState;
 if(!showing)return;
 const p=tourStops[tourIndex];
 $('#tour-title').textContent=tourState==='paused'?'Tour pausado':tourState==='complete'?'Tour concluído':tourPhase==='moving'?'A caminho':'Histórias do território';
 $('#tour-location').textContent=p?.name||'';
 $('#tour-count').textContent=String(tourIndex+1).padStart(2,'0')+' / '+tourStops.length;
 $('#tour-progress').style.width=(tourIndex+1)/tourStops.length*100+'%';
 $('#tour-pause').textContent=tourState==='paused'?'Continuar':tourState==='complete'?'Recomeçar':'Pausar';
 $('#tour-pause').setAttribute('aria-label',tourState==='running'?'Pausar tour':tourState==='complete'?'Recomeçar tour':'Continuar tour');
 $('#tour-next').disabled=tourIndex>=tourStops.length-1;
}

function scheduleTour(delay=tourReadingMs){
 clearTimeout(tourTimer);tourRemaining=delay;tourDue=Date.now()+delay;
 tourTimer=setTimeout(()=>{if(tourState!=='running')return;if(tourIndex>=tourStops.length-1){tourState='complete';clearInterval(tourPhotoTimer);tourUI();return}visitStop(tourIndex+1)},delay);
}

function tourStory(p){
 const sentences=(p.history||p.story||'').match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g)||[p.story||''];
 let text='';for(const sentence of sentences.slice(0,2)){if(text&&text.length+sentence.length>360)break;text+=sentence}
 return text.trim();
}

function showTourStop(p,version){
 if(version!==tourToken||tourState==='idle'||tourPhase==='reading')return;
 clearTimeout(tourArrivalTimer);if(tourArrival){map.off('moveend',tourArrival);tourArrival=null}
 tourPhase='reading';openPlace(p.id,false);
 const story=tourStory(p);$('.card-summary').textContent=story;$('.card-summary').classList.add('tour-story');
 $('.card-body .eyebrow').textContent='HISTÓRIA DO LOCAL · '+p.category+(p.coord?'':' · PONTO A CONFIRMAR');
 tourReadingMs=Math.max(14000,Math.min(26000,story.split(/\s+/).length*350+4000));
 tourRemaining=tourReadingMs;
 let photoIndex=0;
 clearInterval(tourPhotoTimer);
 if(p.photos?.length>1)tourPhotoTimer=setInterval(()=>{if(tourState!=='running'||tourPhase!=='reading'||activeId!==p.id)return;photoIndex=(photoIndex+1)%p.photos.length;const photo=p.photos[photoIndex];$('#card-main-photo').src=photo.src;$('#card-main-photo').alt=photo.alt;$('#photo-position').textContent=(photoIndex+1)+' / '+p.photos.length;$('.card-photo figcaption').textContent=photoCredit(p,photo);$('#open-photo').onclick=()=>openPhoto(p,photoIndex)},5000);
 tourUI();if(tourState==='running')scheduleTour();
}

function visitStop(index){
 clearTimeout(tourTimer);clearTimeout(tourArrivalTimer);clearInterval(tourPhotoTimer);
 if(tourArrival){map.off('moveend',tourArrival);tourArrival=null}
 map.stop();tourIndex=index;tourPhase='moving';tourRemaining=0;const p=tourStops[index],version=++tourToken;
 $('#place-card').hidden=true;map.closePopup();activeId=p.id;refreshMarkers();
 $('#map-location').textContent=p.name;$('#map-street').textContent=p.coord?p.address:'Localização ainda em confirmação';
 tourUI();
 if(!p.coord){overview(false);$('#map-location').textContent=p.name;$('#map-street').textContent='Localização ainda em confirmação';tourArrivalTimer=setTimeout(()=>showTourStop(p,version),reduced()?0:450);return}
 const z=p.approx?18:19,target=[p.coord[1],p.coord[0]],pixel=map.project(target,z);
 pixel.y+=Math.min(75,map.getSize().y*.1);pixel.x+=innerWidth>760?map.getSize().x*.1:0;
 const center=map.unproject(pixel,z);
 tourArrival=()=>showTourStop(p,version);map.once('moveend',tourArrival);
 map.flyTo(center,z,{duration:reduced()?0:1.5});
 // A same-view stop (for example, two spaces in the CEU) may emit no moveend.
 tourArrivalTimer=setTimeout(()=>showTourStop(p,version),reduced()?0:1650);
}

function startTour(){
 if(!map)ensureMap();if(!map)return;
 if(tourState!=='idle')stopTour(true);
 tourReturn={center:map.getCenter(),zoom:map.getZoom(),activeId,cardHidden:$('#place-card').hidden,illustration:showIllustration,category,query:$('#search').value,location:$('#map-location').textContent,street:$('#map-street').textContent};
 setPlacing(false);showIllustration=false;$('#illustration').hidden=true;$('#rail-filters').hidden=true;
 category='Todos';$('#search').value='';buildFilters();refreshMarkers();renderList();
 const available=places.filter(p=>!p.demo),preferred=['unas','radio','biblioteca','gotas','cine','redondinhos','hospital','cca','smartfit','etec','campos','baccarelli','ceu'];
 tourStops=preferred.map(id=>available.find(p=>p.id===id)).filter(Boolean);
 tourStops.push(...available.filter(p=>!tourStops.some(stop=>stop.id===p.id)));
 if(!tourStops.length)return;
 tourState='running';tourUI();
 requestAnimationFrame(()=>{if(tourState==='idle')return;map.invalidateSize({pan:false});visitStop(0)});
}

function pauseTour(){
 if(tourState!=='running')return;
 tourRemaining=tourPhase==='reading'?Math.max(0,tourDue-Date.now()):0;
 clearTimeout(tourTimer);tourState='paused';tourUI();
}

function resumeTour(){
 if(tourState==='complete'){startTour();return}if(tourState!=='paused')return;
 tourState='running';tourUI();
 if(tourPhase==='reading')scheduleTour(tourRemaining||tourReadingMs);
}

function stopTour(){
 if(tourState==='idle')return;
 clearTimeout(tourTimer);clearTimeout(tourArrivalTimer);clearInterval(tourPhotoTimer);tourToken++;
 if(tourArrival){map?.off('moveend',tourArrival);tourArrival=null}map?.stop();
 tourState='idle';tourUI();const previous=tourReturn;tourReturn=null;
 if($('#history-dialog').open)$('#history-dialog').close();if($('#photo-dialog').open)$('#photo-dialog').close();
 if(previous){activeId=previous.activeId;category=previous.category;$('#search').value=previous.query;buildFilters();showIllustration=previous.illustration;$('#illustration').hidden=!showIllustration;map.invalidateSize({pan:false});map.setView(previous.center,previous.zoom,{animate:false});if(activeId&&!previous.cardHidden)openPlace(activeId,false);else $('#place-card').hidden=true;$('#map-location').textContent=previous.location;$('#map-street').textContent=previous.street;refreshMarkers();renderList()}
}

$('#tour-start').onclick=startTour;
$('#tour-pause').onclick=()=>tourState==='running'?pauseTour():resumeTour();
$('#tour-next').onclick=()=>{if(tourIndex<tourStops.length-1)visitStop(tourIndex+1)};
$('#tour-exit').onclick=()=>stopTour();
document.addEventListener('keydown',e=>{if(tourState==='idle'||e.target.closest('input,textarea,select')||document.querySelector('dialog[open]'))return;if(e.key==='Escape'){e.preventDefault();stopTour()}if(e.code==='Space'){e.preventDefault();tourState==='running'?pauseTour():resumeTour()}});
