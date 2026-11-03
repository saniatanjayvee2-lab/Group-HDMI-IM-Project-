(function(){
"use strict";
if(window.FixTrackLoading)return;
const nativeFetch=window.fetch.bind(window);
const born=Date.now();
let count=0,overlay=null,title=null,delay=null,hide=null,opened=0,refreshAt=0;
function mount(){
 if(overlay||!document.body)return;
 overlay=document.createElement("div");
 overlay.id="ft-loading-overlay";
 overlay.setAttribute("role","status");
 overlay.setAttribute("aria-live","polite");
 const card=document.createElement("div");card.className="ft-loading-card";
 const spin=document.createElement("div");spin.className="ft-loading-spinner";spin.setAttribute("aria-hidden","true");
 title=document.createElement("strong");title.textContent="Loading";
 const info=document.createElement("p");info.textContent="Please wait while FixTrack processes your request.";
 card.append(spin,title,info);overlay.append(card);document.body.append(overlay);
 if(count>0)display();
}
function display(){
 if(!overlay)return;
 if(hide){clearTimeout(hide);hide=null;}
 if(count>0&&!delay&&!overlay.classList.contains("ft-loading-show")){
   delay=setTimeout(function(){delay=null;if(count>0){opened=Date.now();overlay.classList.add("ft-loading-show");}},180);
 }
}
function dismiss(){
 if(delay){clearTimeout(delay);delay=null;}
 if(!overlay)return;
 if(hide)clearTimeout(hide);
 const wait=overlay.classList.contains("ft-loading-show")?Math.max(0,320-(Date.now()-opened)):0;
 hide=setTimeout(function(){hide=null;if(count===0)overlay.classList.remove("ft-loading-show");},wait);
}
function begin(text){
 count++;
 if(title)title.textContent=text||"Loading";
 display();
 let ended=false;
 return function(){
  if(ended)return;ended=true;count=Math.max(0,count-1);
  if(count===0)dismiss();else display();
 };
}
const boot=begin("Opening FixTrack");
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount,{once:true});else mount();
if(document.readyState==="complete")boot();
else window.addEventListener("load",boot,{once:true});
document.addEventListener("click",function(e){
 const control=e.target.closest("button,a");if(!control)return;
 const text=(control.textContent||"").trim().toLowerCase();
 if(/refresh|reload|try again/.test(text))refreshAt=Date.now();
},true);
window.fetch=function(input,options){
 const method=String((options&&options.method)||(typeof Request!=="undefined"&&input instanceof Request?input.method:"GET")).toUpperCase();
 const mutation=["POST","PUT","PATCH","DELETE"].includes(method);
 const initial=method==="GET"&&Date.now()-born<5000;
 const manual=method==="GET"&&Date.now()-refreshAt<1000;
 const end=(mutation||initial||manual)?begin(mutation?({POST:"Submitting request",PUT:"Saving changes",PATCH:"Updating information",DELETE:"Removing item"}[method]):manual?"Refreshing data":"Loading information"):null;
 try{const promise=nativeFetch(input,options);return end?promise.finally(end):promise;}
 catch(error){if(end)end();throw error;}
};
window.FixTrackLoading={show:begin};
})();