/* eslint-disable class-methods-use-this */
import { sourceSelector, targetSelector } from '@/constants'
import {
  CloneData,
  Options,
  Ref,
  RootData,
  SourceData,
  SourceElement,
  SourceTag,
  SrcElement,
  TargetElement,
  // DEV
  // TargetTag,
  WorkerMessage,
} from '@/types'
import {
  blankImg,
  closestDescendant,
  // detectSupports,
  // DEV
  // isTag,
  MapId,
  resolveUrl,
} from '@/utils'
import { worker } from '@/worker'

// TODO: add comments
class Loader {
  private _worker = worker
  private _options: Options = {} as Options
  // private _supports = detectSupports()
  private _blobUrlByOrigin: Map<string, string> = new Map()
  private _rootsMap: MapId<HTMLElement, RootData> = new MapId()
  private _sourcesMap: MapId<SourceElement, SourceData> = new MapId()

  constructor() {
    this._onMessage = this._onMessage.bind(this)
  }

  /**
   * Init loader with options
   */
  public init(options: Options) {
    this._options = options
    this._worker.addEventListener('message', this._onMessage)
  }

  /**
   * Add an element
   */
  public add(root: HTMLElement) {
    const target = this._getTarget(root)

    if (target === null) {
      console.error('[@snoozy] No target found')

      return null
    }

    const sources = this._getSources(target)
    const refs: Ref[] = []
    const id = this._rootsMap.add(root, { root, target, sources, refs })

    console.info('ADD', id, `[${target.dataset.test}]`)
    console.info(sources)

    if (root.dataset?.lazyMode !== 'visible') {
      this.load(root)
    }

    return id
  }

  /**
   * Start loading
   */
  public async load(root: HTMLElement) {
    // Get data from root element
    const { id, data } = this._getRootData(root)

    if (id === null) {
      console.error('[@snoozy] Not a valid element')

      return
    }

    root.classList.remove('lazyload')

    if (data.sources.length === 0) {
      this.swap(root)

      return
    }

    // Get and set refs
    data.refs = await this._getRefs(data)

    // Before load
    this._options.beforeload && this._options.beforeload(root)

    // Loading
    root.classList.add('lazyloading')
    this._options.loading && this._options.loading(root)

    if (this._hasLoaded(data.refs)) {
      // All sources are loaded…
      this.switch(data.root)
    } else {
      // Post to the worker
      data.refs.forEach(ref => {
        this._worker.postMessage({ id, ref } as WorkerMessage)
      })
    }
  }

  /**
   * Swap sources
   * Replace directly src with data-src
   */
  public swap(root: HTMLElement) {
    const { data } = this._getRootData(root)

    this._swapSrc(data.target as SrcElement)
    data.sources.forEach(el => this._swapSrc(el))
  }

  /**
   * Switch sources
   * Replace data with blob URLs
   */
  public switch(root: HTMLElement) {
    console.info('SWITCH', this._sourcesMap, root)

    const { data } = this._getRootData(root)
    const { refs, sources, target } = data
    const parent = target.parentNode || target
    const img = parent.querySelector('img') as HTMLImageElement

    img.onload = () => {
      console.info('LOADED', refs)
    }

    sources.forEach(el => {
      const id = this._sourcesMap.getIdByKey(el)

      if (id) {
        const source = this._sourcesMap.getValueById(id) as SourceData
        const { attr, origin } = source
        const blob = this._blobUrlByOrigin.get(origin) as string

        console.info('ID', id, source)
        if (attr === 'src') {
          el.src = blob
        } else if (attr === 'srcset') {
          el.srcset = el.dataset.srcset?.replace(origin, blob) as string
        }
      } else {
        if (el.dataset.src) {
          el.src = el.dataset.src
          el.removeAttribute('data-src')
        }
        if (el.dataset.srcset) {
          el.srcset = el.dataset.srcset
          el.removeAttribute('data-srcset')
        }
      }
    })

    // TODO: not the first index…
    // Scénarii for multiple refs ?
    // let [{ id, data: sources }] = refs
    // const isPicture = data.target.tagName === 'PICTURE'
    // const hasChildren = refs.length > 1

    // if (hasChildren) {
    //   if (isPicture && this._supports.picture && this._supports.srcset) {
    //     ;({ id, data: sources } = refs.find(r => r.tag === 'source') as Ref)
    //   } else {
    //     ;({ id, data: sources } = refs.find(r => r.tag !== 'source') as Ref)
    //   }
    // }
    // const el = this._sourcesMap.getKeyById(id)
    // const img = isPicture
    //   ? (target.querySelector('img') as HTMLImageElement)
    //   : (el as HTMLImageElement)

    // console.info('SWITCH:REFS', el, sources, img)

    // #TODO: reduce in a smart way
    // const src = sources.find(s => s.attr === 'src')
    // const srcset = sources.find(s => s.attr === 'srcset')

    // img.onload = async () => {
    //   // CSS classes
    //   root.classList.remove('lazyloading')

    //   // Transition
    //   this._options.loaded && (await this._options.loaded(root))

    //   // CSS classes
    //   root.classList.add('lazyloaded')

    //   // After transition
    //   this._options.afterload && this._options.afterload(root)

    //   // Cleaning
    //   // If revoked, can not be reused…
    //   // URL.revokeObjectURL(url)
    //   el.removeAttribute('data-src')
    //   el.removeAttribute('data-srcset')
    // }

    // Update the right attribute (src? srcset?)
    // TODO: refactoring?
    // Mieux vaut attendre d'avoir implémenté picture…
    // if (this._supports.srcset && srcset && this._hasUrl(srcset)) {
    //   el.srcset = el.dataset.srcset?.replace(
    //     srcset.origin,
    //     this._blobUrlByOrigin.get(srcset.origin) as string
    //   ) as string
    // } else if (src && this._hasUrl(src)) {
    //   el.src = this._blobUrlByOrigin.get(src.origin) as string
    // }
  }

  /**
   * On worker message, store new blob URLs
   * Start switch if ready…
   */
  private _onMessage(event: MessageEvent) {
    const { id, ref: newRef } = event.data as WorkerMessage
    const data = this._rootsMap.getValueById(id) as RootData
    const { refs } = data

    const { blob, origin } = newRef.data
    const url = URL.createObjectURL(blob)

    this._blobUrlByOrigin.set(origin, url)
    this._hasLoaded(refs) && this.switch(data.root)
  }

  /**
   * Get the target element to be lazy loaded
   * This allows to use some wrapper
   */
  private _getTarget(root: HTMLElement) {
    return closestDescendant(root, targetSelector)
  }

  /**
   * Get sources from the target element
   * Fast check for valid sources
   * Sources are elements with data attribute(s) to be lazyloaded
   * We can have multiple sources (picture > img + source)
   */
  private _getSources(target: TargetElement) {
    // const elements: SourceElement[] =
    //   target.children.length > 0
    //     ? ([...target.querySelectorAll(sourceSelector)] as SourceElement[])
    //     : [target as SourceElement]

    // if (elements.every(e => e.matches('[data-src],[data-srcset]'))) {
    //   return elements
    // }

    // return null

    return [target, ...target.children].filter(e =>
      e.matches(sourceSelector)
    ) as SourceElement[]
  }

  /**
   * Get refs from the target and sources elements
   * Refs connect a source element with its data
   * because an HTMLElement can not be passed directly to a web worker.
   */
  private async _getRefs(data: RootData) {
    const { sources } = data
    const render = sources.some(el => el.matches('[data-srcset]'))

    if (render) {
      // Render target to know exactly which source to reference
      const ref = await this._getFromRender(data)

      return [ref]
    }

    // Get, replace and reference all sources with src attribute
    return sources.map(el => {
      const origin = this._getSrc(el)
      const data: SourceData = {
        attr: 'src',
        origin,
        resolved: resolveUrl(origin),
      }

      const id = this._sourcesMap.add(el, data)
      const tag = el.tagName.toLowerCase() as SourceTag

      return {
        id,
        tag,
        data,
      }
    })
  }

  private _getFromRender(data: RootData): Promise<Ref> {
    return new Promise(resolve => {
      const { target, sources } = data
      const w = (target as HTMLImageElement).width || target.offsetWidth
      const h = (target as HTMLImageElement).height || target.offsetHeight
      const clone = target.cloneNode(true) as TargetElement

      clone.style.position = 'fixed'
      clone.style.left = '200vw'
      clone.style.top = '200vh'
      clone.style.visibility = 'hidden'
      clone.style.width = `${w}px`
      clone.style.height = `${h}px`

      const contents: CloneData[] = []
      const clonedSources = this._getSources(clone)
      const parent = clone.parentNode || clone
      const img = parent.querySelector('img') as HTMLImageElement

      img.onload = () => {
        const srcTmp = img.currentSrc
        const index = parseInt(srcTmp.split('#')[1], 10) || 0
        const { el, data } = contents[index]
        const id = this._sourcesMap.add(el, data)
        const tag = el.tagName.toLowerCase() as SourceTag

        console.info('RENDERED', clone, data.origin, id)
        clone.remove()

        resolve({
          id,
          tag,
          data,
        })
      }

      let index = 0

      sources.forEach((el, i) => {
        if (el.dataset.src) {
          const origin = el.dataset.src

          contents.push({
            el,
            data: {
              attr: 'src',
              origin,
              resolved: resolveUrl(origin),
            },
          })

          clonedSources[i].src = `${blankImg}#${index}`
          index += 1
        }

        if (el.dataset.srcset) {
          clonedSources[i].srcset = el.dataset.srcset
            .split(',')
            .map(set => {
              const [src, w] = set.replace(/^ /, '').split(' ')
              const origin = src
              const newSet = `${blankImg}#${index} ${w}`

              contents.push({
                el,
                data: {
                  attr: 'srcset',
                  origin,
                  resolved: resolveUrl(origin),
                },
              })
              index += 1

              return newSet
            })
            .join(',') as string
        }
      })
    })
  }

  /**
   * Get sources data from the source element
   * Sources are data values form data attribute(s) to be lazyloaded
   * We can have multiple sources (img[data-src][data-srcset])
   * Target is needed for the "rendering" step
   */
  // private async _getSourcesData(el: SourceElement, target: TargetElement) {
  //   const sources: SourceData[] = []

  //   if (el.dataset.src) {
  //     const origin = this._getSrc(el)

  //     sources.push({ attr: 'src', origin, resolved: resolveUrl(origin) })
  //   }

  //   if (el.dataset.srcset) {
  //     const origin = await this._getSrcset(el, target)

  //     sources.push({ attr: 'srcset', origin, resolved: resolveUrl(origin) })
  //   }

  //   return sources
  // }

  private _swapSrc(el: SrcElement) {
    if (el.hasAttribute('data-src')) {
      el.src = el.getAttribute('data-src') as string
    }
  }

  // TODO: needed???
  // private _hasAttr(el: HTMLElement, attr: string) {
  //   return el.hasAttribute(`data-${attr}`)
  // }

  // private _getAttr(el: HTMLElement, attr: string) {
  //   return el.getAttribute(`data-${attr}`)
  // }

  /**
   * Get src value
   */
  private _getSrc(el: SourceElement | SrcElement): string {
    return el.getAttribute('data-src') as string
  }

  /**
   * Get srcset value
   * This invokes a "pre-rendering" to get
   * accurate element (e.g. `<picture>` with `media`) and
   * correct URL from `srcset` (e.g. based on viewport or `sizes`)
   */
  // private _getSrcset(
  //   el: SourceElement,
  //   target: TargetElement
  // ): Promise<string> {
  //   const isImg = el.tagName === 'IMG'

  //   return new Promise(resolve => {
  //     const { srcset } = el.dataset
  //     const w = isImg ? (el as HTMLImageElement).width : target.offsetWidth
  //     const h = isImg ? (el as HTMLImageElement).height : target.offsetHeight
  //     const sources: string[] = []

  //     const testSrc = blankImg
  //     const testSet = srcset
  //       ?.split(',')
  //       .map((set, i) => {
  //         const [src, w] = set.replace(/^ /, '').split(' ')

  //         sources.push(src)

  //         return `${testSrc}#${i} ${w}`
  //       })
  //       .join(',') as string

  //     const testEl = target.cloneNode(true) as TargetElement

  //     testEl.style.position = 'fixed'
  //     testEl.style.left = '200vw'
  //     testEl.style.top = '200vh'
  //     testEl.style.visibility = 'hidden'
  //     testEl.style.width = `${w}px`
  //     testEl.style.height = `${h}px`

  //     if (isImg) {
  //       ;(testEl as HTMLImageElement).src = testSrc
  //       ;(testEl as HTMLImageElement).srcset = testSet
  //     } else {
  //       const img = testEl.querySelector('img')

  //       if (img) {
  //         img.src = testSrc
  //       }

  //       const source = testEl.querySelector('source')

  //       if (source) {
  //         source.srcset = testSet
  //       }
  //     }

  //     document.body.appendChild(testEl)

  //     const img = isImg
  //       ? (testEl as HTMLImageElement)
  //       : (testEl.querySelector('img') as HTMLImageElement)

  //     img.onload = () => {
  //       const srcTmp = img.currentSrc
  //       const i = parseInt(srcTmp.split('#')[1], 10) || 0

  //       console.info('LOADED', sources[i])
  //       testEl.remove()
  //       resolve(sources[i])
  //     }
  //   })
  // }

  /**
   * Get data (id, value) associated to a root element
   * Add it if not present
   */
  private _getRootData(root: HTMLElement) {
    const id = this._rootsMap.getIdByKey(root) || this.add(root)
    const data = this._rootsMap.getValueByKey(root) as RootData

    return { id, data }
  }

  // DEV
  // private _needsRendering(sources: SourceElement[]) {
  //   // return (
  //   //   data.target.matches('[data-srcset]') ||
  //   //   data.sources.some(el => el.matches('[data-srcset]'))
  //   // )
  //   return sources.some(el => el.matches('[data-srcset]'))
  // }

  /**
   * Are all blob URLs loaded?
   */
  private _hasLoaded(refs: Ref[]) {
    return refs.every(ref => this._blobUrlByOrigin.has(ref.data.origin))
  }

  /**
   * Does this origin have a blob URL?
   */
  // private _hasUrl(source: SourceData | undefined) {
  //   return source && this._blobUrlByOrigin.has(source.origin)
  // }
}

export default new Loader()
