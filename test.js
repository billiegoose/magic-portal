import MagicPortal from './index.js'
import { EventEmitter } from 'events'

const Channel = () => {
  let left = new EventEmitter()
  let right = new EventEmitter()
  left.addEventListener = jest.fn((evt, cb) => left.on(evt, cb))
  right.addEventListener = jest.fn((evt, cb) => right.on(evt, cb))
  left.postMessage = jest.fn(data => right.emit('message', {data}))
  right.postMessage = jest.fn(data => left.emit('message', {data}))
  return {left, right}
}

describe('MagicPortal', () => {

  it('inits', async () => {
    let {left} = Channel()
    let mp = new MagicPortal(left)
    expect(left.addEventListener.mock.calls.length).toBe(1)
    expect(left.postMessage.mock.calls.length).toBe(1)
  })
  
  it('syncs (in order)', async () => {
    let {left, right} = Channel()
    let mpl = new MagicPortal(left)
    mpl.set('foo', {
      bar: async () => void(0)
    })
    let mpr = new MagicPortal(right)
    expect(left.addEventListener.mock.calls.length).toBe(1)
    expect(right.addEventListener.mock.calls.length).toBe(1)
    expect(left.postMessage.mock.calls.length).toBe(3) // INIT, SET, INIT
    expect(right.postMessage.mock.calls.length).toBe(1) // INIT
    let foo = await mpr.get('foo')
    expect(foo).toBeTruthy()
    expect(typeof foo.bar).toBe('function')
    expect(left.postMessage.mock.calls[1][0]).toEqual({
      type: 'MP_SET',
      object: 'foo',
      methods: ['bar'],
      void: []
    })
  })

  it('syncs (out of order)', async () => {
    let {left, right} = Channel()
    let mpl = new MagicPortal(left)
    let foo = mpl.get('foo')
    let mpr = new MagicPortal(right)
    mpr.set('foo', {
      bar: async () => void(0)
    })
    expect(left.addEventListener.mock.calls.length).toBe(1)
    expect(right.addEventListener.mock.calls.length).toBe(1)
    expect(left.postMessage.mock.calls.length).toBe(2) // INIT, INIT
    expect(right.postMessage.mock.calls.length).toBe(2) // INIT, SET
    foo = await foo
    expect(foo).toBeTruthy()
    expect(typeof foo.bar).toBe('function')
  })

  it('calls (no response requested)', async () => {
    let {left, right} = Channel()
    let mpl = new MagicPortal(left)
    let mpr = new MagicPortal(right)
    mpr.set('foo', {
      bar: async () => void(0)
    }, {
      void: ['bar']
    })
    let foo = await mpl.get('foo')
    foo.bar('baz')
    expect(left.postMessage.mock.calls[2][0]).toEqual({
      type: 'MP_CALL',
      id: 1,
      object: 'foo',
      method: 'bar',
      args: ['baz'],
      reply: false
    })
    expect(right.postMessage.mock.calls.length).toBe(2)
  })

  it('calls (reply requested)', async () => {
    let {left, right} = Channel()
    let mpl = new MagicPortal(left)
    let mpr = new MagicPortal(right)
    mpr.set('foo', {
      bar: async () => 'buzz'
    })
    let foo = await mpl.get('foo')
    let result = await foo.bar('baz')
    expect(left.postMessage.mock.calls[2][0]).toEqual({
      type: 'MP_CALL',
      id: 1,
      object: 'foo',
      method: 'bar',
      args: ['baz'],
      reply: true
    })
    expect(right.postMessage.mock.calls.length).toBe(3)
    expect(right.postMessage.mock.calls[2][0]).toEqual({
      type: 'MP_RETURN',
      id: 1,
      result: 'buzz'
    })
    expect(result).toBe('buzz')
  })

  it('callId increments each time', async () => {
    let {left, right} = Channel()
    let mpl = new MagicPortal(left)
    let mpr = new MagicPortal(right)
    mpr.set('foo', {
      bar: async () => void(0)
    }, {
      void: ['bar']
    })
    let foo = await mpl.get('foo')
    for (let i = 0; i < 10; i++) {
      await foo.bar()
    }
    let id = null
    right.on('message', ({data}) => {
      id = data.id
    })
    await foo.bar()
    expect(id).toBe(11)
  })

})
