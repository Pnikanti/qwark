import { chromium } from 'playwright'
const OUT = '/tmp/claude-1000/-home-pate-repositories-qwark/b6317403-d00a-49bd-ba07-005543764d15/scratchpad'
const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, colorScheme: 'dark', deviceScaleFactor: 2 })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', e => errs.push('pageerror: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
const step = async (l, fn) => { try { await fn(); console.log('OK   ' + l) } catch (e) { console.log('FAIL ' + l + ' :: ' + String(e).split('\n')[0]) } }
const typeInto = async (which, value) => {
  await page.locator('.draft-row .cell').nth(which).click()
  await page.waitForSelector('.keypad')
  for (let i = 0; i < 6; i++) await page.locator('.key:has-text("⌫")').click()
  for (const ch of String(value)) await page.locator(`.key:text-is("${ch}")`).first().click()
  await page.locator('.sheet-commit').click()
  await page.waitForFunction(() => !document.querySelector('.keypad'))
}
const accentCount = () => page.evaluate(() => {
  const hit = (c) => c.replace(/\s/g, '') === 'rgb(91,149,255)'
  const out = []
  for (const el of document.querySelectorAll('body *')) {
    if (!el.offsetParent) continue
    const s = getComputedStyle(el)
    const marks = []
    if (hit(s.backgroundColor)) marks.push('fill')
    if (hit(s.color)) marks.push('text')
    if (hit(s.borderTopColor) || hit(s.borderLeftColor)) marks.push('border')
    if (marks.length) out.push(`${(el.className || el.tagName).toString().split(' ')[0]}:${marks.join('+')}`)
  }
  return out
})
const cta = () => page.evaluate(() => {
  const t = document.querySelector('.tick.big'), f = document.querySelector('.masthead .btn')
  const box = (e) => { const r = e.getBoundingClientRect(); return Math.round(r.width * r.height) }
  return {
    tick: { disabled: t.disabled, fill: getComputedStyle(t).backgroundColor, area: box(t) },
    finish: { fill: getComputedStyle(f).backgroundColor, area: box(f) },
  }
})

await page.goto('http://localhost:5173/', { waitUntil: 'load' })
await page.evaluate(() => indexedDB.deleteDatabase('qwark'))
await page.reload({ waitUntil: 'load' })
await page.waitForSelector('.hero-action')
await page.locator('.hero-action').click()
await page.waitForSelector('.entry.routine')
await page.locator('.entry.routine:has-text("Yläkroppa") .btn').click()
await page.waitForSelector('.draft-row')

await step('tick is quiet while it cannot be pressed', async () => {
  const c = await cta()
  console.log('       ', JSON.stringify(c))
  if (!c.tick.disabled) throw new Error('expected disabled')
  if (c.tick.fill !== 'rgba(0, 0, 0, 0)') throw new Error('disabled tick should not be filled')
  if (c.finish.fill.includes('91, 149, 255')) throw new Error('Lopeta treeni still solid accent')
})

await step('tick becomes the solid primary once it can be pressed', async () => {
  await typeInto(0, 60)
  const c = await cta()
  console.log('       ', JSON.stringify(c))
  if (c.tick.fill.replace(/\s/g,'') !== 'rgb(91,149,255)') throw new Error('tick not filled accent')
  if (c.tick.area <= c.finish.area) throw new Error(`tick ${c.tick.area} should outweigh finish ${c.finish.area}`)
  console.log(`       tick is ${(c.tick.area / c.finish.area).toFixed(1)}× the area of Lopeta treeni`)
  await page.screenshot({ path: `${OUT}/al1-cta.png` })
})

await step('accent spend is down', async () => {
  const a = await accentCount()
  console.log(`       ${a.length} accent elements:`, a.join(', '))
  if (a.length > 8) throw new Error(`${a.length} accent elements, still too many`)
})

await step('rest bar names the extra set instead of skipping ahead', async () => {
  for (let i = 0; i < 3; i++) {
    if (await page.locator('.suggestion').count()) {
      await page.locator('.suggestion').click()
      await page.waitForFunction(() => !document.querySelector('.suggestion'))
    }
    await page.locator('.tick.big').click(); await page.waitForTimeout(230)
  }
  // Park back on the finished movement and start an extra set.
  await page.locator('.upcoming').click().catch(() => {})
  await page.locator('.folded:has-text("Penkkipunnerrus") .folded-body').click()
  await page.waitForSelector('.draft-row')
  if (await page.locator('.suggestion').count()) {
    await page.locator('.suggestion').click()
    await page.waitForFunction(() => !document.querySelector('.suggestion'))
  }
  await page.locator('.tick.big').click()
  await page.waitForSelector('.rest-next')
  const label = await page.locator('.draft-label').textContent()
  const next = await page.locator('.rest-next').textContent()
  console.log(`       input says "${label}" | rest bar says "${next.trim()}"`)
  if (next.includes('Kulmasoutu')) throw new Error('rest bar still skips past the extra set')
  await page.screenshot({ path: `${OUT}/al2-extra.png` })
})

await step('add-movement is a link, not a competing button', async () => {
  const m = await page.evaluate(() => {
    const a = document.querySelector('.append-link')
    const s = getComputedStyle(a)
    const r = a.getBoundingClientRect()
    return { border: s.borderTopWidth, height: Math.round(r.height), width: Math.round(r.width) }
  })
  console.log('       ', JSON.stringify(m))
  if (m.border !== '0px') throw new Error('still bordered')
  if (m.height < 44) throw new Error('tap target under 44px')
})

console.log('\nerrors:', errs.length ? [...new Set(errs)] : 'none')
await browser.close()
