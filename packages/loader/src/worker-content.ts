// #TODO: browser support… (const, await, destructuring…)
// #TODO: minify "prebuild" step
export default `function sourceFetcher() {
  self.addEventListener('message', async event => {
    const { id, ref } = event.data

    // console.log('WORKER', ref.data)
    const r = await fetch(ref.data.resolved)
    const b = await r.blob()

    ref.data.blob = b

    self.postMessage({
      id,
      ref,
    })

    // Promise
    //   .all(ref.data.map(async d => {
    //     const r = await fetch(d.resolved)
    //     const b = await r.blob()

    //     d.blob = b

    //     return d
    //   }))
    //   .then(data => {
    //     ref.data = data

    //     self.postMessage({
    //       id,
    //       ref,
    //     })
    //   })
  })
}`
