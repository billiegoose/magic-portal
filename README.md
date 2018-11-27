# magic-portal

Pass objects with async methods between WebWorkers and the main thread easily

## Installation

This is a [Node.js](https://nodejs.org/) module available through the 
[npm registry](https://www.npmjs.com/). It can be installed using the 
[`npm`](https://docs.npmjs.com/getting-started/installing-npm-packages-locally)
or 
[`yarn`](https://yarnpkg.com/en/)
command line tools.

```sh
npm install magic-portal --save
```

## Usage

You load the library in both the main thread and the worker (same library, there's no client/server distinction)
and then create a `new MagicPortal(channel)` where `channel` is either the worker or the window.
Then you call `.set` and `.get` on it like it's a `Map`, except you have to `await` the `.get`.
The functions on the object HAVE to be async functions that return Promises.

`index.html`
```html
<script src="https://unpkg.com/magic-portal/dist/index.umd.js"></script>
<script>
;(async () => {

  let worker = new Worker("./worker.js")
  const portal = new MagicPortal(worker)

  portal.set('main', {
    alert: async (msg) => window.alert(msg)
  })

  let adder = await portal.get('adder')

  let result = await adder.add(2, 2)
  console.log('2 + 2 =', result)

})();
</script>
```

`worker.js`
```js
importScripts([
  "https://unpkg.com/magic-portal/dist/index.umd.js"
])
;(async () => {

  const portal = new MagicPortal(self)

  portal.set('adder', {
    add: async (a, b) => a + b
  })

  let main = await portal.get('main')

  main.alert('hello from worker')

})();
```

<details>
  <summary> The same examples, but using ES modules </summary>

`index.html`
```html
<script type="module">
import MagicPortal from "https://unpkg.com/magic-portal/dist/index.es6.js"
;(async () => {

  let worker = new Worker("./worker.js", {type: "module"})
  const portal = new MagicPortal(worker)

  portal.set('main', {
    alert: async (msg) => window.alert(msg)
  })

  let adder = await portal.get('adder')

  let result = await adder.add(2, 2)
  console.log('2 + 2 =', result)

})();
</script>
```

`worker.js`
```js
import MagicPortal from "https://unpkg.com/magic-portal/dist/index.es6.js"
;(async () => {

  const portal = new MagicPortal(self)

  portal.set('adder', {
    add: async (a, b) => a + b
  })

  let main = await portal.get('main')

  main.alert('hello from worker')

})();
```

</details>

### Options

If you have some methods where you don't care about the return value, you can use the `void` option to tell MagicPortal you don't need to wait for the result.
This will cut the number of `postMessage` calls used in half, which could be useful if you have very high throughput (like an event emitter).

```js
portal.set('main', {
  add: async (a, b) => a + b,
  alert: async (msg) => window.alert(msg)
}, {
  void: ['alert']
})
```

## How it works

Under the hood it uses a very simple `postMessage` remote procedure call (RPC) that looks like this:

```js
// Announce "I am able to start receiving messages"
{
  type: "MP_INIT"
}
// Announce "I have this object"
{
  type: "MP_SET",
  object: "adder",
  methods: ["adder"]
}
// Method call (request)
{
  type: "MP_CALL",
  object: "adder",
  method: "add",
  args: [2, 2],
  id: 36
}
// Return value (response)
{
  type: "MP_RETURN",
  id: 36,
  result: 4
}
// or Error
{
  type: "MP_RETURN",
  id: 36,
  error: "this is the error message"
}
```

Both sides of the MagicPortal queue their messages until they have received an `MP_INIT` message to account for the slight delay in starting up WebWorker threads.
Calling `.set` sends (or queues) an `MP_SET` message, and when you call `.get`, it returns a promise that is resolved once a corresponding `MP_SET` message is received.
(Therefore you should try to make all your `.set` calls before you start `await`ing for `.get` calls to avoid a mutual deadlock where both threads are `await`ing.)
The object returned by `.get` has methods that correspond to the `function` properties of the original object passed to `.set`.
Calling these methods sends an `MP_CALL` message with the arguments, and the MagicPortal on the other side of the channel will receive the `MP_CALL` message and call the original method with those arguments.
Therefore the function arguments have to be serializable by the [structured clone algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm) used by `postMessage` to send values.

## Tests

```sh
npm install
npm test
```

## Dependencies

None

## Dev Dependencies

- [babel-core](https://ghub.io/babel-core): Babel compiler core.
- [babel-preset-env](https://ghub.io/babel-preset-env): A Babel preset for each environment.
- [jest](https://ghub.io/jest): Delightful JavaScript Testing.
- [microbundle](https://ghub.io/microbundle): Zero-configuration bundler for tiny JS libs, powered by Rollup.

## License

MIT
