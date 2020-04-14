import workerContent from './worker-content'

const workerBlob = new Blob([`(${workerContent})()`], {
  type: 'application/javascript',
})
const workerUrl = URL.createObjectURL(workerBlob)

export const worker = new Worker(workerUrl)
