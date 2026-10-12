import { Snek } from '../src/index.js'
const app = new Snek()
app.get('/', (c) => c.text('Hello, world!'))
app.get('/users/:id', (c) => c.json({ id: c.req.param('id') }))
await app.listen(3000)
console.log('snekweb listening on http://localhost:3000')
