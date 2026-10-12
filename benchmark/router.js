import { Snek } from '../src/index.js'
const request = new Request('http://localhost/users/42')
const iterations = Number(process.env.ITERATIONS || 500_000)

async function measure(app) {
  const samples = []
  for (let run = 0; run < 5; run++) {
    const start = performance.now()
    for (let i = 0; i < iterations; i++) await app.fetch(request)
    samples.push(performance.now() - start)
  }
  samples.sort((a, b) => a - b)
  const median = samples[2]
  return {
    samplesMs: samples.map((x) => +x.toFixed(2)),
    medianRequestsPerSecond: Math.round(iterations / median * 1000)
  }
}

const singleRouteApp = new Snek().get('/users/:id', (c) => c.text(c.req.param('id')))
const manyRoutesApp = new Snek()
for (let i = 0; i < 100; i++) {
  manyRoutesApp.get(`/static/${i}`, (c) => c.text(String(i)))
}
manyRoutesApp.get('/users/:id', (c) => c.text(c.req.param('id')))

console.log(JSON.stringify({
  runtime: process.version,
  iterations,
  workloads: {
    singleParameterizedRoute: await measure(singleRouteApp),
    '100StaticRoutesAndParameterizedRoute': await measure(manyRoutesApp)
  },
  memory: process.memoryUsage()
}, null, 2))
