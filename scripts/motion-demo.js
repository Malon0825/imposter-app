async function demoMotion(page) {
  // Run after motion-check.js in the same isolated browser session.
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.setViewportSize({width:390,height:750});
  if (await page.getByRole('button',{name:'Back to home',exact:true}).count()) {
    await page.getByRole('button',{name:'Back to home',exact:true}).click();
    await page.getByRole('button',{name:'Host party',exact:true}).waitFor();
  }
  await page.evaluate(()=>{const f=window.__motionTest;f.delay=0;Object.assign(f.view,{phase:'lobby',result:null,my_vote:null,private_role:null,role_ready:false,topics:['animals'],players:f.players});for(const p of f.players){p.points=0;p.earned=0;}f.view.revision++;});
  const marks=[];const start=Date.now();
  const mark=name=>marks.push({name,seconds:(Date.now()-start)/1000});
  const hold=async(ms=700)=>page.waitForTimeout(ms);
  const phase=async(name,extra={})=>{
    await page.evaluate(({name,extra})=>{const f=window.__motionTest;Object.assign(f.view,{phase:name,my_vote:null,private_role:null,role_ready:false,result:null,...extra});f.view.revision++;},{name,extra});
    await page.locator('main.screen-'+name).waitFor();await hold(400);
  };
  mark('welcome');await hold(1000);
  await page.getByRole('button',{name:'Host party',exact:true}).click();await hold();
  await page.getByRole('button',{name:'Go back',exact:true}).click();await hold();
  await page.getByRole('button',{name:'Host party',exact:true}).click();
  await page.getByRole('button',{name:'Continue',exact:true}).click();await hold();
  await page.getByRole('button',{name:'Keep app open instead',exact:true}).click();
  await page.getByRole('heading',{name:'Friday night',exact:true}).waitFor();await hold();
  mark('sheet');await page.getByRole('button',{name:'Show invitation QR code',exact:true}).click();await hold();
  const handle=await page.getByRole('button',{name:'Close dialog',exact:true}).boundingBox();
  await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();
  for(let i=1;i<=14;i++){await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2+i*10);await hold(20);}
  await page.mouse.up();await hold(500);
  mark('selections');await page.getByRole('button',{name:'Choose topics',exact:true}).click();
  await page.locator('.topic-tile').filter({hasText:'Food'}).click();await hold(450);
  await page.locator('.topic-tile').filter({hasText:'Psychology'}).click();await hold(650);
  await page.getByRole('button',{name:'Save topics',exact:true}).click();await hold(650);
  await phase('roles',{private_role:{imposter:true,clue:'Paws'}});await hold(650);
  mark('role reveal');await page.getByRole('button',{name:'Reveal my role',exact:true}).click();await hold(1300);
  await page.getByRole('button',{name:'Hide & ready',exact:true}).click();await hold(350);
  await phase('voting');
  await page.locator('.ballot-row').filter({hasText:'Mia'}).click();await hold(450);
  mark('vote lock');await page.getByRole('button',{name:'Confirm vote',exact:true}).click();
  await page.getByRole('heading',{name:'Your vote is locked',exact:true}).waitFor();await hold(1300);
  await page.evaluate(()=>{const f=window.__motionTest;f.view.vote_count=4;f.view.revision++;});await hold(850);
  const result={imposter_id:'sam',word:'Dog',accused_id:'mia',escaped:true,my_vote:'mia',earned:0,was_imposter:false};
  await page.evaluate(()=>{const f=window.__motionTest;f.players[1].points=2;f.players[1].earned=2;f.players[2].points=1;f.players[2].earned=1;});
  mark('score count');await phase('rankings',{result});await hold(1100);
  mark('final celebration');await phase('ended',{result});await hold(1900);
  mark('resting final');
  return {durationSeconds:(Date.now()-start)/1000,marks};
}
