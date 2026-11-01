async function checkNativeMotion(page) {
  // Attach to the installed Android WebView and create a test lobby first.
  const assert = (value, message) => { if (!value) throw Error(message); };
  await page.getByRole('heading',{name:'Friday night',exact:true}).waitFor();
  await page.screenshot({path:'output/playwright/motion-check/android-lobby.png'});
  const drag = async distance => {
    const h = await page.getByRole('button',{name:'Close dialog',exact:true}).boundingBox();
    await page.mouse.move(h.x+h.width/2,h.y+h.height/2);
    await page.mouse.down();
    for(let i=1;i<=15;i++) {
      await page.mouse.move(h.x+h.width/2,h.y+h.height/2+distance*i/15);
      await page.waitForTimeout(16);
    }
    await page.mouse.up();await page.waitForTimeout(600);
  };
  await page.getByRole('button',{name:'Show invitation QR code',exact:true}).click();
  await page.waitForTimeout(700);
  await drag(25);
  assert(await page.getByRole('dialog').count()===1,'Short drag dismissed the native sheet');
  const settled = await page.getByRole('dialog').evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).m42);
  assert(Math.abs(settled)<1,'Native sheet did not return to rest');
  await page.screenshot({path:'output/playwright/motion-check/android-sheet.png'});
  await drag(150);
  assert(await page.getByRole('dialog').count()===0,'Native sheet drag did not dismiss');
  await page.getByRole('button',{name:'Choose topics',exact:true}).click();
  const tile=page.locator('.topic-tile').filter({hasText:'Psychology'});
  await tile.click();await page.waitForTimeout(400);
  assert(await tile.getAttribute('aria-pressed')==='true','Native topic selection failed');
  await page.getByRole('button',{name:'Save topics',exact:true}).click();
  await page.getByRole('button',{name:'End party',exact:true}).click();
  await page.getByRole('dialog').waitFor();
  await page.getByRole('dialog').getByRole('button',{name:'End party',exact:true}).click();
  await page.getByRole('button',{name:'Back to home',exact:true}).click();
  await page.getByRole('button',{name:'Host party',exact:true}).waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({path:'output/playwright/motion-check/android-home.png'});
  assert((await page.evaluate(()=>document.body.style.overflow))!=='hidden','Native sheet left scrolling locked');
  return {passed:true,checks:['native transition rest','sheet short drag return','sheet drag dismissal','topic spring selection','confirmation and party cleanup']};
}
