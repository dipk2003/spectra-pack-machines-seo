const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
async function main(){
 const handlers=new Map(),events=[],outgoing=[],timers=new Map();let timer=0;
 const window={addEventListener:(name,fn)=>handlers.set(name,fn),removeEventListener:name=>handlers.delete(name),dispatchEvent:event=>{events.push(event);return true;}};
 class CustomEvent {constructor(type,options={}){this.type=type;this.detail=options.detail;}}
 const port={postMessage:raw=>outgoing.push(JSON.parse(raw))};
 const state={deviceId:'device',version:'1.1.0',foreground:true,location:'off'};
 const script=fs.readFileSync('android/app/src/main/assets/mobile.js','utf8').replace('__NONCE__',JSON.stringify('private-channel')).replace('__STATE__',JSON.stringify(state));
 vm.runInNewContext(script,{window,CustomEvent,crypto:{randomUUID:()=> 'request-id'},setTimeout:fn=>{timers.set(++timer,fn);return timer;},clearTimeout:id=>timers.delete(id)});
 handlers.get('message')({data:'wrong',ports:[port]});assert.equal(window.SpectraCRM,undefined);
 handlers.get('message')({data:'private-channel',ports:[port]});assert.equal(events[0].type,'spectra-native-ready');
 const opening=window.SpectraCRM.request({type:'open_external',url:'tel:+919370440729'});assert.equal(outgoing[0].nonce,'private-channel');
 port.onmessage({data:JSON.stringify({nonce:'wrong',id:'request-id',opened:true})});assert.equal(timers.size,1);
 port.onmessage({data:JSON.stringify({nonce:'private-channel',id:'request-id',opened:true})});assert.equal((await opening).opened,true);assert.equal(timers.size,0);
 port.onmessage({data:JSON.stringify({nonce:'private-channel',state:{foreground:false,location:'off'}})});
 const before=events.filter(event=>event.type==='spectra-native-location').length;
 port.onmessage({data:JSON.stringify({nonce:'private-channel',type:'location',point:{latitude:1,longitude:2}})});
 assert.equal(events.filter(event=>event.type==='spectra-native-location').length,before,'Background fixes must be discarded');
 await assert.rejects(window.SpectraCRM.request({type:'read_calls'}));
 const manifest=fs.readFileSync('android/app/src/main/AndroidManifest.xml','utf8');
 for(const permission of ['ACCESS_BACKGROUND_LOCATION','READ_CALL_LOG','READ_SMS','RECORD_AUDIO','READ_CONTACTS'])assert.equal(manifest.includes(permission),false,'Unrequested permission: '+permission);
 assert.equal(manifest.includes('ACCESS_FINE_LOCATION'),true);
 const lifecycle=fs.readFileSync('android/app/src/main/java/com/spectrapackmachines/crm/MainActivity.java','utf8');assert.match(lifecycle,/onPause\(\) \{ mobile\.pause\(\)/);
 const gps=fs.readFileSync('android/app/src/main/java/com/spectrapackmachines/crm/ForegroundLocation.java','utf8');assert.match(gps,/void pause\(\) \{ resumed = false; stop\(\); \}/);
 console.log('Native contact handshake, foreground-only location and minimal-permission checks passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
