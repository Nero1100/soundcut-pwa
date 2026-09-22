import { FFmpeg } from './vendor/ffmpeg/classes.js';

const VERSION='0.12.10';
const CACHE=`soundcut-engine-${VERSION}`;
let instance=null,loading=null,activeSignal=null;
const aborted=()=>new DOMException('已取消','AbortError');

async function engineAsset(name,mime,signal,onProgress){
  const canonical=`https://cdn.jsdelivr.net/npm/@ffmpeg/core@${VERSION}/dist/esm/${name}`;
  let cache;try{cache=await caches.open(CACHE);}catch{}
  const saved=await cache?.match(canonical);
  if(saved){signal?.throwIfAborted();onProgress('正在载入已缓存的转换引擎…');return URL.createObjectURL(new Blob([await saved.arrayBuffer()],{type:mime}));}
  let response;
  for(const base of ['https://cdn.jsdelivr.net/npm','https://unpkg.com']){
    try{response=await fetch(`${base}/@ffmpeg/core@${VERSION}/dist/esm/${name}`,{signal});if(response.ok)break;response=null;}catch(e){if(signal?.aborted)throw aborted();}
  }
  if(!response?.ok)throw Error('无法下载浏览器转换引擎。请检查网络后重试；已支持的音频格式仍可直接编辑。');
  const parts=[],reader=response.body.getReader();let size=0;
  while(true){signal?.throwIfAborted();const {done,value}=await reader.read();if(done)break;parts.push(value);size+=value.byteLength;if(name.endsWith('.wasm'))onProgress(`首次准备转换引擎：已下载 ${(size/1048576).toFixed(1)} MB / 约 31 MB`,Math.min(95,size/32200000*95));}
  const blob=new Blob(parts,{type:mime});
  if(cache)try{await cache.put(canonical,new Response(blob,{headers:{'Content-Type':mime}}));}catch{}
  return URL.createObjectURL(blob);
}

export async function prepare({signal,onProgress=()=>{}}={}){
  signal?.throwIfAborted();if(instance?.loaded)return instance;
  if(loading)return loading;
  const ff=new FFmpeg();instance=ff;let coreURL,wasmURL;
  const cancel=()=>ff.terminate();signal?.addEventListener('abort',cancel,{once:true});
  loading=(async()=>{try{
    onProgress('首次准备浏览器转换引擎（约 31 MB），之后会使用本机缓存…');
    coreURL=await engineAsset('ffmpeg-core.js','text/javascript',signal,onProgress);
    wasmURL=await engineAsset('ffmpeg-core.wasm','application/wasm',signal,onProgress);
    signal?.throwIfAborted();onProgress('正在启动本机转换引擎…',98);
    await ff.load({coreURL,wasmURL});signal?.throwIfAborted();onProgress('转换引擎已就绪',100);return ff;
  }catch(e){ff.terminate();if(instance===ff)instance=null;if(signal?.aborted)throw aborted();throw Error(`浏览器转换引擎未能启动：${e.message||'请重试或换用最新版浏览器。'}`);
  }finally{if(coreURL)URL.revokeObjectURL(coreURL);if(wasmURL)URL.revokeObjectURL(wasmURL);signal?.removeEventListener('abort',cancel);loading=null;}})();
  return loading;
}

export async function transcode(blob,name,{signal,onProgress=()=>{}}={}){
  if(activeSignal)throw Error('另一份素材仍在转换，请稍后再试。');
  const ff=await prepare({signal,onProgress});signal?.throwIfAborted();activeSignal=signal||true;
  const extension=(name.match(/\.([a-z0-9]{1,8})$/i)||[])[1]||'media';
  const input=`input.${extension}`;
  let log='';const listen=({message})=>{log=(log+'\n'+message).slice(-2000);};
  const progress=({progress})=>onProgress('正在设备上提取音轨…',Math.min(99,Math.max(0,progress*100)));
  const cancel=()=>{ff.terminate();if(instance===ff)instance=null;};
  signal?.addEventListener('abort',cancel,{once:true});ff.on('log',listen);ff.on('progress',progress);
  try{
    onProgress('正在设备上读取视频…');await ff.writeFile(input,new Uint8Array(await blob.arrayBuffer()));signal?.throwIfAborted();
    // A compressed intermediate bounds memory use for long videos; PCM/WAV is only produced on export.
    const audioOutput='audio.m4a';
    const code=await ff.exec(['-i',input,'-map','0:a:0','-vn','-ac','2','-ar','44100','-c:a','aac','-b:a','192k','-y',audioOutput],180000);
    signal?.throwIfAborted();if(code!==0)throw Error(/matches no streams|does not contain any stream/i.test(log)?'这个视频没有可提取的音轨。':'这个格式无法转换，或处理超过 3 分钟。请使用较短的视频后重试。');
    onProgress('正在绘制音频波形…');const data=await ff.readFile(audioOutput);await ff.deleteFile(audioOutput);return data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);
  }catch(e){if(signal?.aborted)throw aborted();throw e;
  }finally{signal?.removeEventListener('abort',cancel);ff.off('log',listen);ff.off('progress',progress);if(ff.loaded){try{await ff.deleteFile(input);}catch{}try{await ff.deleteFile('audio.m4a');}catch{}}activeSignal=null;}
}
