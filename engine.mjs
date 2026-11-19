
function obj(v){if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Expected an object');return v;}
function arr(v,label='array'){if(!Array.isArray(v)||v.length>500)throw Error(label+' must be an array with at most 500 items');return v;}
function str(v){if(typeof v!=='string'||!v.trim()||v.length>100000)throw Error('Expected nonempty text (max 100000 characters)');return v;}
function num(v,label='number',min=-1e12){if(typeof v!=='number'||!Number.isFinite(v)||v<min||Math.abs(v)>1e12)throw Error(label+' must be a finite number in range');return v;}
function bool(v){if(typeof v!=='boolean')throw Error('Expected a boolean');return v;}
function date(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))throw Error('Expected YYYY-MM-DD');const t=Date.parse(v+'T00:00:00Z');if(!Number.isFinite(t)||new Date(t).toISOString().slice(0,10)!==v)throw Error('Invalid calendar date');return t;}
export function run(x){obj(x);if(JSON.stringify(x).length>200000)throw Error('Input exceeds 200 KB limit');

num(x.ttl,'ttl',0);let source=x.initial,cached,expiry=-Infinity,previous=-Infinity;const rows=arr(x.events,'events').map(e=>{num(e.at,'time');if(e.at<previous)throw Error('Events must be chronological');previous=e.at;if(e.action==='write'){if(!Object.hasOwn(e,'value'))throw Error('Write requires value');source=e.value;return {at:e.at,action:'write',value:JSON.stringify(source),stale:false};}if(e.action!=='read')throw Error('Unknown action');const hit=e.at<expiry;if(!hit){cached=source;expiry=e.at+x.ttl;}return {at:e.at,action:hit?'cache hit':'source read',value:JSON.stringify(cached),stale:JSON.stringify(cached)!==JSON.stringify(source)};});return {metrics:{events:rows.length,staleReads:rows.filter(r=>r.stale).length},rows};

}
