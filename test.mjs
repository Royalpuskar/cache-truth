import test from 'node:test';
import assert from 'node:assert/strict';
import {run} from './engine.mjs';
import {sample} from './sample.mjs';
test('domain behavior and boundary cases',()=>{assert.equal(run(sample).metrics.staleReads,1);assert.equal(run(sample).rows[3].action,'source read');assert.equal(run({...sample,ttl:0}).metrics.staleReads,0);});
test('deterministic result and input preservation',()=>{const copy=JSON.stringify(sample);assert.deepEqual(run(sample),run(sample));assert.equal(JSON.stringify(sample),copy);});
test('reject malformed root and oversized input',()=>{assert.throws(()=>run(null));assert.throws(()=>run([]));assert.throws(()=>run({...sample,oversized:'x'.repeat(200001)}));});

test('detect missed writes even when content returns to its original value', () => {
  const report=run({ttl:10,initial:'A',events:[{at:0,action:'read'},
    {at:1,action:'write',value:'B'},{at:2,action:'write',value:'A'},{at:3,action:'read'}]});
  assert.equal(report.rows[3].stale,false);
  assert.equal(report.rows[3].revisionLag,2);
  assert.equal(report.metrics.staleReads,0);
  assert.equal(report.metrics.revisionStaleReads,1);
});
test('invalidation forces a source read without changing source revision', () => {
  const report=run({ttl:10,initial:'A',events:[{at:0,action:'read'},
    {at:1,action:'write',value:'B'},{at:2,action:'invalidate'},{at:2,action:'read'}]});
  assert.equal(report.rows[2].cacheRevision,null);
  assert.equal(report.rows[2].sourceRevision,1);
  assert.equal(report.rows[3].action,'source read');
  assert.equal(report.rows[3].revisionLag,0);
  assert.equal(report.rows[3].value,'"B"');
});
test('TTL expiry is exclusive and hits do not extend lifetime', () => {
  const report=run({ttl:5,initial:null,events:[0,4,5].map(at=>({at,action:'read'}))});
  assert.deepEqual(report.rows.map(r=>r.action),['source read','cache hit','source read']);
  assert.deepEqual(report.rows.map(r=>r.age),[0,4,0]);
  assert.deepEqual(report.rows.map(r=>r.expiry),[5,5,10]);
});
test('canonical comparison ignores object property order but respects array order', () => {
  const scenario=value=>({ttl:5,initial:{a:1,b:[1,2]},events:[{at:0,action:'read'},{at:1,action:'write',value},{at:2,action:'read'}]});
  assert.equal(run(scenario({b:[1,2],a:1})).metrics.staleReads,0);
  assert.equal(run(scenario({b:[2,1],a:1})).metrics.staleReads,1);
});
test('identical writes advance revision; zero TTL refreshes even at equal times', () => {
  const report=run({ttl:0,initial:false,events:[{at:0,action:'read'},{at:0,action:'write',value:false},{at:0,action:'read'}]});
  assert.equal(report.rows[2].sourceRevision,1);
  assert.equal(report.rows[2].cacheRevision,1);
  assert.equal(report.rows[2].action,'source read');
});
test('empty cache invalidation is idempotent and falsy JSON values are retained', () => {
  for(const initial of [null,false,0,'']) {
    const report=run({ttl:1,initial,events:[{at:0,action:'invalidate'},{at:0,action:'invalidate'},{at:0,action:'read'}]});
    assert.equal(report.rows[2].value,JSON.stringify(initial));
    assert.equal(report.metrics.invalidations,2);
  }
});
test('reject missing, non-JSON, deeply nested and malformed inputs', () => {
  for(const initial of [undefined,NaN,Infinity,()=>1])assert.throws(()=>run({...sample,initial}));
  assert.throws(()=>run({ttl:1,events:[]}));
  for(const events of [[null],new Array(1),[{at:0,action:'write'}],[{at:0,action:'other'}],[{at:2,action:'read'},{at:1,action:'read'}]])
    assert.throws(()=>run({...sample,events}));
  let initial=0;for(let i=0;i<52;i++)initial=[initial];
  assert.throws(()=>run({...sample,initial}));
});
