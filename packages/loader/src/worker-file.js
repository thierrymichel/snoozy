// #TODO: browser support… (const, await, destructuring…)
function imageFetcher() {
  self.addEventListener('message', async event => {
    const { id, src } = event.data
    const response = await fetch(src)
    const blob = await response.blob()

    self.postMessage({
      id,
      src,
      blob,
    })
  })
}
